-- ============================================================================
-- M11 — [LINTER] Limpa os achados SQL do Supabase Database Linter
-- ----------------------------------------------------------------------------
-- Achados no projeto remoto e a remediacao aqui:
--
--   1. [ERROR 0010] public.book_ratings_public e SECURITY DEFINER (view burla
--      RLS). -> A view vira SECURITY INVOKER e agrega via helper SECURITY
--      DEFINER em `private` (fora do schema exposto na API, mesmo padrao de
--      private.is_admin). Soh o agregado sai pela view; a leitura direta de
--      book_ratings continua owner-only (RLS).
--   2. [WARN 0028] anon pode executar public.sync_user_email_on_change().
--   3. [WARN 0029] authenticated pode executar public.sync_user_email_on_change().
--      -> Trigger function nao precisa de EXECUTE publico: o trigger de
--         auth.users a invoca. Revoga de public/anon/authenticated e mantem
--         apenas supabase_auth_admin (role que dispara o trigger).
--   4. [WARN 0029] authenticated pode executar public.current_role().
--      -> As 3 policies que dependiam dela (0001_full: weekly_releases_admin e
--         suggestions_update_owner_admin) passam a usar public.can_manage_content()
--         (SECURITY INVOKER, mesmo significado admin|editor). current_role()
--         fica sem grant de execucao para qualquer role de API.
--
-- NAO resolve via SQL (acao manual no dashboard, exige plano Pro):
--   * auth_leaked_password_protection (HaveIBeenPwned): setting do Auth em
--     Authentication > Providers > Email ("Prevent password leaks"). Nao ha
--     comando SQL para liga-la; ligar no dashboard e re-rodar o advisor.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. [0010] book_ratings_public -> SECURITY INVOKER + agregado via `private`
-- ---------------------------------------------------------------------------
create or replace function private.book_ratings_summary()
returns table (book_id uuid, rating_count integer, rating_sum integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    r.book_id,
    count(*)::integer as rating_count,
    sum(r.rating)::integer as rating_sum
  from public.book_ratings r
  group by r.book_id;
$function$;

revoke all on function private.book_ratings_summary() from public, anon, authenticated;
grant execute on function private.book_ratings_summary() to anon, authenticated, service_role;

-- anon precisava de USAGE no schema private? Nao tinha (M2/M9 revogaram) e agora
-- a view invoker (executada como anon) chama o helper definer deste schema.
grant usage on schema private to anon;

create or replace view public.book_ratings_public
with (security_invoker = on)
as
  select
    book_id,
    rating_count,
    rating_sum
  from private.book_ratings_summary();

revoke all on public.book_ratings_public from public;
grant select on public.book_ratings_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2/3. [0028][0029] sync_user_email_on_change: so o trigger de auth.users usa
-- ---------------------------------------------------------------------------
revoke all on function public.sync_user_email_on_change() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.sync_user_email_on_change() to supabase_auth_admin;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. [0029] current_role: policies sem dependencia + revoke de EXECUTE
-- ---------------------------------------------------------------------------
drop policy if exists "weekly_releases_admin" on public.weekly_releases;
create policy "weekly_releases_admin" on public.weekly_releases
  for all to authenticated
  using ((select public.can_manage_content()))
  with check ((select public.can_manage_content()));

drop policy if exists "suggestions_update_owner_admin" on public.suggestions;
create policy "suggestions_update_owner_admin" on public.suggestions
  for update to authenticated
  using (
    (user_id = auth.uid() AND status = 'ideas')
    OR (select public.can_manage_content())
  )
  with check (
    (user_id = auth.uid() AND status = 'ideas')
    OR (select public.can_manage_content())
  );

revoke all on function public.current_role() from public, anon, authenticated;

commit;
