-- Fix linter 0024_permissive_rls_policy em public.orders.
--
-- A policy `orders_insert_public` usava `with check (true)` (tautologia que o
-- linter sinaliza). Mantemos o comportamento de checkout publico (anon +
-- authenticated podem inserir), mas com condicao real que valida o payload
-- minimo esperado pelo formulario — mesma regra aplicada na migracao original,
-- corrigida aqui para o banco ja em producao.

begin;

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

commit;