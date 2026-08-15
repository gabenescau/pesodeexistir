-- ============================================================================
-- M8 — [MEDIO] book_ratings: nao expor avaliacao individual (user_id legivel)
-- ----------------------------------------------------------------------------
-- Antes: policy SELECT USING(true) liberava user_id+book_id+rating de cada
-- avaliacao para anon/authenticated (dava para inferir quem avaliou o que).
--
-- Fix:
--   1. View agregada public.book_ratings_public (security definer — owner
--      agrega a tabela inteira e expoe SO o agregado): book_id, rating_sum,
--      rating_count. Sem user_id, sem linhas individuais.
--   2. Policy SELECT da tabela vira owner-only (user_id = auth.uid()); anon
--      perde SELECT na tabela.
--   3. O front passa a ler so a view (agregado no banco, nao no cliente).
-- Idempotente.
-- ============================================================================

begin;

create or replace view public.book_ratings_public
as
  select
    book_id,
    count(*)::integer as rating_count,
    sum(rating)::integer as rating_sum
  from public.book_ratings
  group by book_id;

revoke all on public.book_ratings_public from public;
grant select on public.book_ratings_public to anon, authenticated;

drop policy if exists "book_ratings_read" on public.book_ratings;
drop policy if exists "book_ratings_read_own" on public.book_ratings;
create policy "book_ratings_read_own"
  on public.book_ratings for select to authenticated
  using (user_id = auth.uid());

revoke select on public.book_ratings from anon;

commit;
