-- Recompensas, indicacoes e estoque: correcoes de integridade e concorrencia.
-- Esta migration e aditiva e mantem o banco como fonte da verdade.

begin;

-- ---------------------------------------------------------------------------
-- 1. Os wrappers de recompensa precisam executar como owner.
-- Os helpers privados nao sao executaveis pelo cliente; os wrappers validam
-- auth.uid()/admin antes de chamar qualquer operacao sensivel.
-- ---------------------------------------------------------------------------
alter function public.reward_login() security definer;
alter function public.reward_login() set search_path = '';
alter function public.report_reading_session(uuid, integer, boolean) security definer;
alter function public.report_reading_session(uuid, integer, boolean) set search_path = '';
alter function public.reward_post(uuid, text) security definer;
alter function public.reward_post(uuid, text) set search_path = '';
alter function public.reward_comment(uuid, text) security definer;
alter function public.reward_comment(uuid, text) set search_path = '';
alter function public.reward_likes_received(uuid) security definer;
alter function public.reward_likes_received(uuid) set search_path = '';
alter function public.complete_daily_mission() security definer;
alter function public.complete_daily_mission() set search_path = '';
alter function public.complete_weekly_mission() security definer;
alter function public.complete_weekly_mission() set search_path = '';
alter function public.wallet_state() security definer;
alter function public.wallet_state() set search_path = '';

-- A tela e o texto da missao definem um comentario como objetivo diario.
create or replace function public.complete_daily_mission()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_login integer := private.get_counter(v_uid, 'login', v_day);
  v_read30 integer := private.get_counter(v_uid, 'reading_30min', v_day);
  v_post integer := private.get_counter(v_uid, 'post', v_day);
  v_comment integer := private.get_counter(v_uid, 'comment', v_day);
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_login < 1 or v_read30 < 1 or v_post < 1 or v_comment < 1 then
    return private.wallet_state_core(v_uid);
  end if;
  if private.get_counter(v_uid, 'daily_mission', v_day) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;
  perform private.award_both(v_uid, 80, 15, 'daily_mission', null, true);
  perform private.bump_counter(v_uid, 'daily_mission', v_day);
  return private.wallet_state_core(v_uid);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Estoque opcional por produto.
-- NULL significa estoque ilimitado para preservar o catalogo existente;
-- numero >= 0 significa estoque controlado pelo painel admin.
-- ---------------------------------------------------------------------------
alter table public.shop_products
  add column if not exists stock integer;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shop_products'::regclass
      and conname = 'shop_products_stock_nonnegative'
  ) then
    alter table public.shop_products
      add constraint shop_products_stock_nonnegative check (stock is null or stock >= 0);
  end if;
end
$migration$;

create index if not exists shop_products_active_stock
  on public.shop_products(active, stock);

-- Reserva uma unidade com lock na linha do produto. O trigger roda dentro da
-- mesma transacao do debito de creditos e do resgate: sem overselling.
create or replace function private.reserve_shop_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_stock integer;
begin
  select p.stock
    into v_stock
    from public.shop_products p
   where p.id = new.product_id
     and p.active
   for update;

  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;

  if v_stock is not null then
    if v_stock <= 0 then
      raise exception 'ESTOQUE_INSUFICIENTE';
    end if;
    update public.shop_products
       set stock = stock - 1
     where id = new.product_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_reserve_shop_product_stock on public.shop_redemptions;
create trigger trg_reserve_shop_product_stock
before insert on public.shop_redemptions
for each row execute function private.reserve_shop_product_stock();

revoke all on function private.reserve_shop_product_stock() from public, anon, authenticated;
grant execute on function private.reserve_shop_product_stock() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Indicacao: recompensa automatica quando o convidado possui assinatura
-- ativa. O frontend nao confirma pagamento e o admin nao pode burlar essa
-- regra com uma confirmacao manual.
-- ---------------------------------------------------------------------------
create or replace function private.reward_referral_for_subscriber(
  p_referred_user_id uuid,
  p_referrer_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referrer uuid;
begin
  if p_referred_user_id is null then return false; end if;

  if not exists (
    select 1
      from public.subscriptions s
     where s.user_id = p_referred_user_id
       and s.status = 'active'
       and (s.current_period_end is null or s.current_period_end > now())
  ) then
    return false;
  end if;

  select r.referrer_user_id
    into v_referrer
    from public.referrals r
   where r.referred_user_id = p_referred_user_id
     and r.rewarded_at is null
     and (p_referrer_user_id is null or r.referrer_user_id = p_referrer_user_id)
   order by r.created_at asc
   limit 1
   for update;

  if v_referrer is null then return false; end if;

  perform private.award_both(
    v_referrer,
    500,
    100,
    'referral',
    p_referred_user_id::text,
    true
  );

  update public.referrals
     set rewarded_at = now()
   where referrer_user_id = v_referrer
     and referred_user_id = p_referred_user_id
     and rewarded_at is null;

  return true;
end;
$function$;

create or replace function private.reward_referral_after_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'active' then
    perform private.reward_referral_for_subscriber(new.user_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_reward_referral_after_subscription on public.subscriptions;
create trigger trg_reward_referral_after_subscription
after insert or update of status on public.subscriptions
for each row execute function private.reward_referral_after_subscription();

create or replace function public.referral_claim(p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_rewarded boolean;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  v_rewarded := private.reward_referral_for_subscriber(p_referred_user_id, v_uid);
  if not v_rewarded and not exists (
    select 1
      from public.referrals r
     where r.referrer_user_id = v_uid
       and r.referred_user_id = p_referred_user_id
  ) then
    raise exception 'INDICACAO_NAO_ENCONTRADA';
  end if;
  if not v_rewarded and not exists (
    select 1
      from public.referrals r
     where r.referrer_user_id = v_uid
       and r.referred_user_id = p_referred_user_id
       and r.rewarded_at is not null
  ) then
    raise exception 'CONVIDADO_NAO_ASSINANTE';
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- A confirmacao administrativa apenas solicita a mesma regra oficial.
create or replace function public.admin_confirm_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;
  if not private.reward_referral_for_subscriber(p_referred_user_id, p_referrer_user_id) then
    if not exists (
      select 1
        from public.referrals r
       where r.referrer_user_id = p_referrer_user_id
         and r.referred_user_id = p_referred_user_id
         and r.rewarded_at is not null
    ) then
      raise exception 'CONVIDADO_NAO_ASSINANTE';
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in ('reserve_shop_product_stock', 'reward_referral_for_subscriber', 'reward_referral_after_subscription')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', function_row.signature);
    execute format('grant execute on function %s to service_role', function_row.signature);
  end loop;
end
$migration$;

commit;
