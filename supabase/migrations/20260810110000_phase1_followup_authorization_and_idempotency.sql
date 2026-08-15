-- Follow-up da Fase 1: corrigir entitlement legado, impedir chamadas diretas
-- a helpers de saldo e tornar pedidos/resgates idempotentes.
-- Aplicar depois de 20260810100000_phase1_security_and_billing.sql.

begin;

-- O follow-up tambem pode ser executado depois de uma tentativa abortada da Fase 1.
-- Recria somente pre-requisitos de schema que estiverem ausentes.
do $followup_schema$
declare
  relation_name text;
begin
  if to_regclass('public.subscriptions') is not null then
    execute 'alter table public.subscriptions add column if not exists user_id uuid';
    execute 'alter table public.subscriptions add column if not exists status text default ''pending''';
    execute 'alter table public.subscriptions add column if not exists current_period_end timestamptz';
    execute 'alter table public.subscriptions add column if not exists plan text';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders add column if not exists user_id uuid';
    execute 'alter table public.orders add column if not exists product_id uuid';
    execute 'alter table public.orders add column if not exists product_name text';
    execute 'alter table public.orders add column if not exists product_category text';
    execute 'alter table public.orders add column if not exists payment_method text';
    execute 'alter table public.orders add column if not exists credits_cost integer default 0';
    execute 'alter table public.orders add column if not exists real_price numeric default 0';
    execute 'alter table public.orders add column if not exists customer jsonb';
    execute 'alter table public.orders add column if not exists address jsonb';
    execute 'alter table public.orders add column if not exists status text default ''pending''';
  end if;

  if to_regclass('public.shop_redemptions') is not null then
    execute 'alter table public.shop_redemptions add column if not exists user_id uuid';
    execute 'alter table public.shop_redemptions add column if not exists product_id uuid';
    execute 'alter table public.shop_redemptions add column if not exists status text default ''pending''';
  end if;

  foreach relation_name in array array['posts', 'post_replies', 'post_likes', 'saved_posts', 'post_poll_votes'] loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I add column if not exists user_id uuid', relation_name);
    end if;
  end loop;
end;
$followup_schema$;

create or replace function private.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.role = 'admin'
  )
  or exists (
    select 1 from public.subscriptions s
    where s.user_id = profile_id
      and s.status in (
        'active', 'trialing', 'past_due', 'paid', 'approved', 'authorized',
        'complete', 'completed', 'succeeded'
      )
      and (s.current_period_end is null or s.current_period_end > now())
      and s.plan in (
        'ope_club_leitor_monthly', 'ope_club_leitor_annual',
        'ope_club_pensador_monthly', 'ope_club_pensador_annual',
        'ope_club_monthly', 'ope_club_annual'
      )
  );
$function$;

-- Reaplica o least privilege no schema exposto pelo PostgREST mesmo quando o
-- projeto remoto veio de uma execucao manual anterior das migrations.
do $grants$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('can_read_book_pdf', 'has_active_subscription', 'is_admin', 'profile_is_verified')
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$grants$;

alter function private.is_book_released(uuid) set search_path = '';

-- O revoke de anon nao remove a permissao de leitura do papel authenticated.
-- Reaplica os grants de catalogo para corrigir bancos que foram endurecidos
-- manualmente e perderam o grant, causa comum do 403 em books/releases.
do $catalog_grants$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'authors', 'books', 'weekly_releases', 'categories',
    'book_ratings_public'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('grant select on table public.%I to authenticated', relation_name);
    end if;
  end loop;
end
$catalog_grants$;

-- award_both so deve ser chamado pelas RPCs de recompensa, nunca pelo cliente.
revoke all on function private.award_both(uuid, integer, integer, text, text, boolean)
  from public, anon, authenticated;
grant execute on function private.award_both(uuid, integer, integer, text, text, boolean)
  to service_role;

alter table public.shop_redemptions
  add column if not exists idempotency_key text;
alter table public.shop_redemptions
  drop constraint if exists shop_redemptions_idempotency_key_format;
alter table public.shop_redemptions
  add constraint shop_redemptions_idempotency_key_format
  check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,100}$');
create unique index if not exists shop_redemptions_user_idempotency_uidx
  on public.shop_redemptions(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.redeem_product(
  p_product_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_product public.shop_products%rowtype;
  v_redemption public.shop_redemptions%rowtype;
  v_profile public.profiles%rowtype;
  v_ok boolean;
  v_key text := nullif(btrim(coalesce(p_address ->> 'idempotency_key', '')), '');
  v_address jsonb := coalesce(p_address, '{}'::jsonb) - 'idempotency_key';
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_key is null or v_key !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'CHAVE_IDEMPOTENCIA_INVALIDA';
  end if;
  if jsonb_typeof(coalesce(p_address, '{}'::jsonb)) <> 'object'
     or char_length(coalesce(p_address::text, '')) > 4000 then
    raise exception 'ENDERECO_INVALIDO';
  end if;
  if not (select allowed from public.check_api_rate_limit(
    md5(v_uid::text || ':redeem'), 'redeem', 10, 60
  )) then
    raise exception 'MUITAS_REQUISICOES';
  end if;

  select * into v_redemption from public.shop_redemptions
  where user_id = v_uid and idempotency_key = v_key;
  if v_redemption.id is not null then
    return jsonb_build_object('redemption', to_jsonb(v_redemption),
      'wallet', private.wallet_state_core(v_uid), 'reused', true);
  end if;

  -- Serializa dois cliques simultaneos antes de debitar o saldo.
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null then raise exception 'PERFIL_NAO_ENCONTRADO'; end if;
  select * into v_product from public.shop_products where id = p_product_id and active;
  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
  if not private.has_active_subscription() then raise exception 'ASSINATURA_INATIVA'; end if;
  if private.active_months(v_uid) < v_product.min_months_active then
    raise exception 'TEMPO_MINIMO_NAO_ATINGIDO';
  end if;

  update public.profiles
     set credits = credits - v_product.credits_cost
   where id = v_uid and credits >= v_product.credits_cost
  returning true into v_ok;
  if coalesce(v_ok, false) = false then raise exception 'CREDITOS_INSUFICIENTES'; end if;

  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (v_uid, 'credit', -v_product.credits_cost, 'redeem', v_product.id::text, current_date);
  insert into public.shop_redemptions(
    user_id, product_id, credits_spent, status,
    customer_name, customer_email, address_json, idempotency_key
  ) values (
    v_uid, v_product.id, v_product.credits_cost, 'pending',
    nullif(btrim(coalesce(p_customer_name, '')), ''),
    nullif(btrim(coalesce(p_customer_email, '')), ''), v_address, v_key
  ) returning * into v_redemption;

  return jsonb_build_object('redemption', to_jsonb(v_redemption),
    'wallet', private.wallet_state_core(v_uid), 'reused', false);
exception
  when unique_violation then
    select * into v_redemption from public.shop_redemptions
    where user_id = v_uid and idempotency_key = v_key;
    if v_redemption.id is null then raise; end if;
    return jsonb_build_object('redemption', to_jsonb(v_redemption),
      'wallet', private.wallet_state_core(v_uid), 'reused', true);
end;
$function$;

alter table public.orders add column if not exists idempotency_key text;
alter table public.orders drop constraint if exists orders_idempotency_key_format;
alter table public.orders add constraint orders_idempotency_key_format
  check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,100}$');
create unique index if not exists orders_user_idempotency_uidx
  on public.orders(user_id, idempotency_key)
  where idempotency_key is not null;

drop policy if exists "orders_insert_authenticated_own" on public.orders;
revoke insert on public.orders from anon, authenticated;

create or replace function public.create_shop_order(
  p_product_id uuid,
  p_payment_method text,
  p_customer jsonb,
  p_address jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_product public.shop_products%rowtype;
  v_order public.orders%rowtype;
  v_method text := lower(btrim(coalesce(p_payment_method, '')));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_method not in ('credits', 'real') then raise exception 'METODO_INVALIDO'; end if;
  if v_key !~ '^[A-Za-z0-9_-]{16,100}$' then raise exception 'CHAVE_IDEMPOTENCIA_INVALIDA'; end if;
  if jsonb_typeof(p_customer) <> 'object' or jsonb_typeof(p_address) <> 'object'
     or char_length(coalesce(p_customer::text, '')) > 2000
     or char_length(coalesce(p_address::text, '')) > 4000 then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select * into v_order from public.orders
  where user_id = v_uid and idempotency_key = v_key;
  if v_order.id is not null then return to_jsonb(v_order); end if;
  select * into v_product from public.shop_products where id = p_product_id and active;
  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;

  insert into public.orders(
    user_id, product_id, product_name, product_category, payment_method,
    credits_cost, real_price, customer, address, status, idempotency_key
  ) values (
    v_uid, v_product.id, v_product.name, v_product.category, v_method,
    case when v_method = 'credits' then v_product.credits_cost else null end,
    case when v_method = 'real' then v_product.real_price else null end,
    p_customer, p_address, 'pending', v_key
  ) returning * into v_order;
  return to_jsonb(v_order);
exception
  when unique_violation then
    select * into v_order from public.orders
    where user_id = v_uid and idempotency_key = v_key;
    if v_order.id is null then raise; end if;
    return to_jsonb(v_order);
end;
$function$;

revoke all on function public.redeem_product(uuid, text, text, jsonb) from public, anon;
grant execute on function public.redeem_product(uuid, text, text, jsonb) to authenticated, service_role;
revoke all on function public.create_shop_order(uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.create_shop_order(uuid, text, jsonb, jsonb, text) to authenticated, service_role;

commit;
