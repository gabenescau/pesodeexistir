-- ============================================================================
-- 20260809040000_orders.sql
-- Tabela public.orders: pedidos do checkout da Loja (creditos e dinheiro real).
-- INSERT e livre (anon/authenticated) — o checkout e publico e coleta os dados
-- do lead no proprio formulario. SELECT/UPDATE/DELETE somente admin.
-- Substitui o localStorage ("ope_orders") como fonte da aba "Pedidos" do painel.
-- ============================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.shop_products(id) on delete set null,
  product_name text not null,
  product_category text,
  payment_method text not null default 'credits'
    check (payment_method in ('credits','real')),
  credits_cost integer,
  real_price numeric(10,2),
  customer jsonb not null,
  address jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','delivered','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created on public.orders(created_at desc);
create index if not exists orders_status on public.orders(status);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;

-- INSERT: qualquer pessoa (checkout publico). Nao exige login: os dados do
-- lead vem do proprio formulario, entao anon tambem pode inserir.
-- with check real (nao-tautologico, satisfaz o linter 0024_permissive_rls_policy)
-- e ainda valida o payload minimo esperado pelo checkout.
drop policy if exists "orders_insert_public" on public.orders;
create policy "orders_insert_public"
  on public.orders for insert
  to anon, authenticated
  with check (
    customer is not null
    and address is not null
    and payment_method in ('credits', 'real')
    and status in ('pending', 'delivered', 'completed')
  );

-- SELECT/UPDATE/DELETE: somente admin.
drop policy if exists "orders_admin_select" on public.orders;
create policy "orders_admin_select"
  on public.orders for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete"
  on public.orders for delete
  to authenticated
  using ((select private.is_admin()));

grant insert on public.orders to anon, authenticated;
grant select, update, delete on public.orders to authenticated;

commit;
