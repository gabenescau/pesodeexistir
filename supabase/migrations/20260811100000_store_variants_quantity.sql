-- Store variants, quantities and server-side inventory reservation.
-- Run after the existing store/rewards migrations.

begin;

alter table public.shop_products
  add column if not exists images jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-media',
  'shop-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_media_public_read on storage.objects;
create policy shop_media_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'shop-media');

drop policy if exists shop_media_manager_insert on storage.objects;
create policy shop_media_manager_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'shop-media' and (select public.can_manage_content()));

drop policy if exists shop_media_manager_update on storage.objects;
create policy shop_media_manager_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'shop-media' and (select public.can_manage_content()))
  with check (bucket_id = 'shop-media' and (select public.can_manage_content()));

drop policy if exists shop_media_manager_delete on storage.objects;
create policy shop_media_manager_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'shop-media' and (select public.can_manage_content()));

create table if not exists public.shop_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  sku text,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_product_variants_size_check
    check (size is null or size in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO')),
  constraint shop_product_variants_color_check
    check (color is null or (char_length(btrim(color)) between 1 and 40))
);

create unique index if not exists shop_product_variants_product_option_uidx
  on public.shop_product_variants (
    product_id,
    coalesce(size, ''),
    lower(coalesce(color, ''))
  );

create index if not exists shop_product_variants_catalog_lookup
  on public.shop_product_variants(product_id, active, size, color);

drop trigger if exists trg_shop_product_variants_updated_at on public.shop_product_variants;
create trigger trg_shop_product_variants_updated_at
before update on public.shop_product_variants
for each row execute function public.touch_updated_at();

alter table public.shop_redemptions
  add column if not exists variant_id uuid,
  add column if not exists quantity integer not null default 1,
  add column if not exists variant_snapshot jsonb not null default '{}'::jsonb;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shop_redemptions'::regclass
      and conname = 'shop_redemptions_quantity_check'
  ) then
    alter table public.shop_redemptions
      add constraint shop_redemptions_quantity_check check (quantity between 1 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shop_redemptions'::regclass
      and conname = 'shop_redemptions_variant_fkey'
  ) then
    alter table public.shop_redemptions
      add constraint shop_redemptions_variant_fkey
      foreign key (variant_id) references public.shop_product_variants(id)
      on delete set null;
  end if;
end
$constraints$;

alter table public.orders
  add column if not exists variant_id uuid,
  add column if not exists quantity integer not null default 1,
  add column if not exists variant_snapshot jsonb not null default '{}'::jsonb;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_quantity_check'
  ) then
    alter table public.orders
      add constraint orders_quantity_check check (quantity between 1 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_variant_fkey'
  ) then
    alter table public.orders
      add constraint orders_variant_fkey
      foreign key (variant_id) references public.shop_product_variants(id)
      on delete set null;
  end if;
end
$constraints$;

alter table public.shop_product_variants enable row level security;
grant select on public.shop_product_variants to anon, authenticated;
grant insert, update, delete on public.shop_product_variants to authenticated;

drop policy if exists shop_product_variants_catalog_read on public.shop_product_variants;
create policy shop_product_variants_catalog_read
  on public.shop_product_variants for select
  to anon, authenticated
  using (active = true or (select private.is_admin()));

drop policy if exists shop_product_variants_manager_insert on public.shop_product_variants;
create policy shop_product_variants_manager_insert
  on public.shop_product_variants for insert
  to authenticated
  with check ((select public.can_manage_content()));

drop policy if exists shop_product_variants_manager_update on public.shop_product_variants;
create policy shop_product_variants_manager_update
  on public.shop_product_variants for update
  to authenticated
  using ((select public.can_manage_content()))
  with check ((select public.can_manage_content()));

drop policy if exists shop_product_variants_manager_delete on public.shop_product_variants;
create policy shop_product_variants_manager_delete
  on public.shop_product_variants for delete
  to authenticated
  using ((select public.can_manage_content()));

grant select on public.shop_product_variants to service_role;

-- Existing redemptions remain valid, but new ones reserve the requested amount
-- and reserve variant stock when a variant was selected.
create or replace function private.reserve_shop_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_quantity integer := greatest(1, coalesce(new.quantity, 1));
  v_product_stock integer;
  v_variant_stock integer;
begin
  if new.variant_id is not null then
    select v.stock
      into v_variant_stock
      from public.shop_product_variants v
     where v.id = new.variant_id
       and v.product_id = new.product_id
       and v.active
     for update;

    if not found then raise exception 'VARIANTE_NAO_ENCONTRADA'; end if;
    if v_variant_stock < v_quantity then raise exception 'ESTOQUE_INSUFICIENTE'; end if;

    update public.shop_product_variants
       set stock = stock - v_quantity,
           updated_at = now()
     where id = new.variant_id;
  else
    select p.stock
      into v_product_stock
      from public.shop_products p
     where p.id = new.product_id
       and p.active
     for update;

    if not found then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
    if v_product_stock is not null and v_product_stock < v_quantity then
      raise exception 'ESTOQUE_INSUFICIENTE';
    end if;

    if v_product_stock is not null then
      update public.shop_products
         set stock = stock - v_quantity,
             updated_at = now()
       where id = new.product_id;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.reserve_shop_product_stock() from public, anon, authenticated;
grant execute on function private.reserve_shop_product_stock() to service_role;

-- The old RPC stays intact for old clients. This new RPC accepts a variant and
-- quantity while recomputing the total from the server-side product price.
create or replace function private.redeem_product_with_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
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
  v_variant public.shop_product_variants%rowtype;
  v_redemption public.shop_redemptions%rowtype;
  v_profile public.profiles%rowtype;
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_ok boolean;
  v_key text := nullif(btrim(coalesce(p_address ->> 'idempotency_key', '')), '');
  v_address jsonb := coalesce(p_address, '{}'::jsonb) - 'idempotency_key';
  v_total integer;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_quantity < 1 or v_quantity > 20 then raise exception 'QUANTIDADE_INVALIDA'; end if;
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

  select * into v_redemption
    from public.shop_redemptions
   where user_id = v_uid and idempotency_key = v_key;
  if v_redemption.id is not null then
    return jsonb_build_object('redemption', to_jsonb(v_redemption),
      'wallet', private.wallet_state_core(v_uid), 'reused', true);
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null then raise exception 'PERFIL_NAO_ENCONTRADO'; end if;
  select * into v_product from public.shop_products where id = p_product_id and active for update;
  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
  if p_variant_id is not null then
    select * into v_variant
      from public.shop_product_variants
     where id = p_variant_id and product_id = p_product_id and active
     for update;
    if v_variant.id is null then raise exception 'VARIANTE_NAO_ENCONTRADA'; end if;
  end if;
  if not private.has_active_subscription() then raise exception 'ASSINATURA_INATIVA'; end if;
  if private.active_months(v_uid) < v_product.min_months_active then
    raise exception 'TEMPO_MINIMO_NAO_ATINGIDO';
  end if;

  v_total := v_product.credits_cost * v_quantity;
  update public.profiles
     set credits = credits - v_total
   where id = v_uid and credits >= v_total
   returning true into v_ok;
  if coalesce(v_ok, false) = false then raise exception 'CREDITOS_INSUFICIENTES'; end if;

  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (v_uid, 'credit', -v_total, 'redeem', v_product.id::text, current_date);

  insert into public.shop_redemptions(
    user_id, product_id, variant_id, quantity, variant_snapshot,
    credits_spent, status, customer_name, customer_email, address_json, idempotency_key
  ) values (
    v_uid, v_product.id, v_variant.id, v_quantity,
    jsonb_build_object('size', v_variant.size, 'color', v_variant.color, 'sku', v_variant.sku),
    v_total, 'pending',
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

create or replace function public.redeem_product_with_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_customer_email text,
  p_address jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.redeem_product_with_variant($1, $2, $3, $4, $5, $6);
$function$;

revoke all on function private.redeem_product_with_variant(uuid, uuid, integer, text, text, jsonb) from public, anon;
grant execute on function private.redeem_product_with_variant(uuid, uuid, integer, text, text, jsonb) to authenticated, service_role;
revoke all on function public.redeem_product_with_variant(uuid, uuid, integer, text, text, jsonb) from public, anon;
grant execute on function public.redeem_product_with_variant(uuid, uuid, integer, text, text, jsonb) to authenticated, service_role;

create or replace function private.create_shop_order_with_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
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
  v_variant public.shop_product_variants%rowtype;
  v_order public.orders%rowtype;
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_method text := lower(btrim(coalesce(p_payment_method, '')));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_total_credits integer;
  v_total_real numeric;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_method not in ('credits', 'real') then raise exception 'METODO_INVALIDO'; end if;
  if v_quantity < 1 or v_quantity > 20 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if v_key !~ '^[A-Za-z0-9_-]{16,100}$' then raise exception 'CHAVE_IDEMPOTENCIA_INVALIDA'; end if;
  if jsonb_typeof(p_customer) <> 'object' or jsonb_typeof(p_address) <> 'object'
     or char_length(coalesce(p_customer::text, '')) > 2000
     or char_length(coalesce(p_address::text, '')) > 4000 then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select * into v_order from public.orders where user_id = v_uid and idempotency_key = v_key;
  if v_order.id is not null then return to_jsonb(v_order); end if;
  select * into v_product from public.shop_products where id = p_product_id and active;
  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
  if p_variant_id is not null then
    select * into v_variant from public.shop_product_variants
     where id = p_variant_id and product_id = p_product_id and active;
    if v_variant.id is null then raise exception 'VARIANTE_NAO_ENCONTRADA'; end if;
    if v_variant.stock < v_quantity then raise exception 'ESTOQUE_INSUFICIENTE'; end if;
  elsif v_product.stock is not null and v_product.stock < v_quantity then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  v_total_credits := v_product.credits_cost * v_quantity;
  v_total_real := coalesce(v_product.real_price, 0) * v_quantity;
  if v_method = 'real' and v_total_real <= 0 then raise exception 'PRECO_REAL_INDISPONIVEL'; end if;

  insert into public.orders(
    user_id, product_id, variant_id, quantity, variant_snapshot,
    product_name, product_category, payment_method, credits_cost, real_price,
    customer, address, status, idempotency_key
  ) values (
    v_uid, v_product.id, v_variant.id, v_quantity,
    jsonb_build_object('size', v_variant.size, 'color', v_variant.color, 'sku', v_variant.sku),
    v_product.name, v_product.category, v_method,
    case when v_method = 'credits' then v_total_credits else null end,
    case when v_method = 'real' then v_total_real else null end,
    p_customer, p_address, 'pending', v_key
  ) returning * into v_order;
  return to_jsonb(v_order);
exception
  when unique_violation then
    select * into v_order from public.orders where user_id = v_uid and idempotency_key = v_key;
    if v_order.id is null then raise; end if;
    return to_jsonb(v_order);
end;
$function$;

create or replace function public.create_shop_order_with_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_customer jsonb,
  p_address jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.create_shop_order_with_variant($1, $2, $3, $4, $5, $6, $7);
$function$;

revoke all on function private.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text) from public, anon;
grant execute on function private.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text) to authenticated, service_role;
revoke all on function public.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text) to authenticated, service_role;

create index if not exists shop_redemptions_variant_created_lookup
  on public.shop_redemptions(variant_id, created_at desc);
create index if not exists orders_variant_created_lookup
  on public.orders(variant_id, created_at desc);

notify pgrst, 'reload schema';
commit;
