-- Store orders are created by authenticated customers but contain PII.
-- Keep the tables inaccessible to browser roles and expose only narrowly
-- scoped, admin-checked RPCs for the Admin panel.

begin;

-- The customer RPC must never return the submitted address, phone or email.
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
  v_quantity integer := coalesce(p_quantity, 1);
  v_method text := lower(btrim(coalesce(p_payment_method, '')));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_customer jsonb;
  v_address jsonb;
  v_total_credits integer;
  v_total_real numeric;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_method not in ('credits', 'real') then raise exception 'METODO_INVALIDO'; end if;
  if v_quantity < 1 or v_quantity > 20 then raise exception 'QUANTIDADE_INVALIDA'; end if;
  if v_key !~ '^[A-Za-z0-9_-]{16,100}$' then raise exception 'CHAVE_IDEMPOTENCIA_INVALIDA'; end if;
  if jsonb_typeof(coalesce(p_customer, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_address, '{}'::jsonb)) <> 'object'
     or char_length(coalesce(p_customer::text, '')) > 2000
     or char_length(coalesce(p_address::text, '')) > 4000 then
    raise exception 'DADOS_INVALIDOS';
  end if;

  -- Store only the fields used by fulfillment. This prevents callers from
  -- smuggling arbitrary keys into the order record.
  v_customer := jsonb_build_object(
    'name', left(btrim(coalesce(p_customer->>'name', '')), 80),
    'email', lower(left(btrim(coalesce(p_customer->>'email', '')), 254)),
    'phone', left(btrim(coalesce(p_customer->>'phone', '')), 30)
  );
  v_address := jsonb_build_object(
    'cep', left(btrim(coalesce(p_address->>'cep', '')), 20),
    'street', left(btrim(coalesce(p_address->>'street', '')), 120),
    'number', left(btrim(coalesce(p_address->>'number', '')), 20),
    'complement', left(btrim(coalesce(p_address->>'complement', '')), 120),
    'neighborhood', left(btrim(coalesce(p_address->>'neighborhood', '')), 100),
    'city', left(btrim(coalesce(p_address->>'city', '')), 100),
    'state', left(btrim(coalesce(p_address->>'state', '')), 80)
  );

  if char_length(v_customer->>'name') < 1
     or (v_customer->>'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_customer->>'phone') < 8
     or char_length(v_address->>'street') < 1
     or char_length(v_address->>'number') < 1
     or char_length(v_address->>'neighborhood') < 1
     or char_length(v_address->>'city') < 1
     or char_length(v_address->>'state') < 1 then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select * into v_order
    from public.orders
   where user_id = v_uid and idempotency_key = v_key;
  if v_order.id is not null then
    return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'created_at', v_order.created_at);
  end if;

  select * into v_product
    from public.shop_products
   where id = p_product_id and active;
  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;

  if p_variant_id is not null then
    select * into v_variant
      from public.shop_product_variants
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
    case
      when v_variant.id is null then '{}'::jsonb
      else jsonb_build_object('size', v_variant.size, 'color', v_variant.color, 'sku', v_variant.sku)
    end,
    v_product.name, v_product.category, v_method,
    case when v_method = 'credits' then v_total_credits else null end,
    case when v_method = 'real' then v_total_real else null end,
    v_customer, v_address, 'pending', v_key
  ) returning * into v_order;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'created_at', v_order.created_at);
exception
  when unique_violation then
    select * into v_order
      from public.orders
     where user_id = v_uid and idempotency_key = v_key;
    if v_order.id is null then raise; end if;
    return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'created_at', v_order.created_at);
end;
$function$;

-- Keep the legacy 5-argument RPC safe for old clients too.
create or replace function private.create_shop_order(
  p_product_id uuid,
  p_payment_method text,
  p_customer jsonb,
  p_address jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select private.create_shop_order_with_variant(
    p_product_id, null, 1, p_payment_method, p_customer, p_address, p_idempotency_key
  );
$function$;

-- Admin-only list. Explicit columns prevent accidental exposure of new
-- internal fields if the orders table grows later.
create or replace function private.admin_list_orders(p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 200);
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'product_name', o.product_name,
        'product_category', o.product_category,
        'payment_method', o.payment_method,
        'credits_cost', o.credits_cost,
        'real_price', o.real_price,
        'quantity', o.quantity,
        'variant_snapshot', o.variant_snapshot,
        'customer', o.customer,
        'address', o.address,
        'status', o.status,
        'created_at', o.created_at
      )
      order by o.created_at desc
    )
    from (
      select * from public.orders order by created_at desc limit v_limit
    ) o
  ), '[]'::jsonb);
end;
$function$;

create or replace function private.admin_update_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;
  if p_status not in ('pending', 'delivered', 'completed') then
    raise exception 'STATUS_INVALIDO';
  end if;

  update public.orders
     set status = p_status, updated_at = now()
   where id = p_order_id
   returning * into v_order;
  if v_order.id is null then raise exception 'PEDIDO_NAO_ENCONTRADO'; end if;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'updated_at', v_order.updated_at);
end;
$function$;

create or replace function public.admin_list_orders(p_limit integer default 200)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$ select private.admin_list_orders($1); $function$;

create or replace function public.admin_update_order_status(p_order_id uuid, p_status text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$ select private.admin_update_order_status($1, $2); $function$;

revoke all on function private.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.create_shop_order_with_variant(uuid, uuid, integer, text, jsonb, jsonb, text)
  to authenticated, service_role;
revoke all on function private.create_shop_order(uuid, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.create_shop_order(uuid, text, jsonb, jsonb, text)
  to authenticated, service_role;
revoke all on function private.admin_list_orders(integer), private.admin_update_order_status(uuid, text)
  from public, anon;
grant execute on function private.admin_list_orders(integer), private.admin_update_order_status(uuid, text)
  to authenticated, service_role;
revoke all on function public.admin_list_orders(integer), public.admin_update_order_status(uuid, text)
  from public, anon;
grant execute on function public.admin_list_orders(integer), public.admin_update_order_status(uuid, text)
  to authenticated, service_role;

-- No direct browser table access: customer creation happens through RPC and
-- admin reads/updates happen through the checked RPCs above.
revoke all on table public.orders from public, anon, authenticated;
grant all on table public.orders to service_role;

notify pgrst, 'reload schema';
commit;
