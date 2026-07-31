-- ============================================================================
-- M2 — [GRAVE] Paywall de leitura com enforcement no banco (bucket `pdfs`)
-- ----------------------------------------------------------------------------
-- Sem esta migration, o bucket `pdfs` nao tem nenhuma policy de SELECT e as
-- funcoes `is_book_released()` / `has_active_subscription()` citadas pelo
-- codigo nao existem no schema versionado (foram criadas a mao no dashboard —
-- drift M9). Consequencia: o createSignedUrl do cliente falha para TODOS
-- (leitor quebrado), ou um SELECT amplo deixaria qualquer logado gerar URL de
-- PDF pago.
--
-- Aqui recriamos, versionados e endurecidos:
--   1. schema `private` + helpers SECURITY DEFINER com search_path fixo;
--   2. wrappers publicos SECURITY INVOKER (nao expoem funcao definer via RPC);
--   3. `is_book_released(uuid)` / `is_pdf_object_released(text)`;
--   4. policy de SELECT no bucket `pdfs` — o gate real: admin OU assinante
--      ativo, E o objeto pertence a um livro ja liberado.
--
-- Idempotente — pode rodar mais de uma vez. Apos aplicar, o SubscriptionGuard
-- do front vira apenas camada de UX; o banco e quem decide quem le PDF.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema privado para helpers internos (fora do Data API / RPC)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Helpers internos (SECURITY DEFINER, search_path='')
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$function$;

create or replace function private.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$function$;

create or replace function private.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.subscriptions s
    where s.user_id = profile_id
      and s.status in (
        'active', 'trialing', 'paid', 'approved', 'authorized',
        'complete', 'completed', 'succeeded'
      )
      and (s.current_period_end is null or s.current_period_end > now())
      and s.plan in ('ope_club_annual', 'ope_club_monthly')
  );
$function$;

create or replace function private.can_read_book_pdf(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_admin()
    or (
      private.has_active_subscription()
      and exists (
        select 1
        from public.books b
        where b.pdf_path = object_name
          and not exists (
            select 1
            from public.weekly_releases wr
            where wr.book_id = b.id
              and coalesce(wr.visible, true)
              and wr.release_date > current_date
          )
      )
    );
$function$;

-- Livro liberado: sem agendamento em weekly_releases, ou com uma data ja alcancada.
create or replace function private.is_book_released(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    not exists (select 1 from public.weekly_releases w where w.book_id = p_book_id)
    or exists (
      select 1 from public.weekly_releases w
      where w.book_id = p_book_id
        and w.release_date <= current_date
    );
$function$;

-- O nome do objeto no bucket `pdfs` e guardado em books.pdf_path (upload via
-- AdminPage). Registros antigos usam pdf_url do tipo ".../pdfs/<nome>".
-- (usa private.is_book_released: evita referencia futura ao wrapper publico,
-- que ainda nao existe neste ponto do arquivo)
create or replace function private.is_pdf_object_released(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(bool_and(private.is_book_released(b.id)), true)
  from public.books b
  where b.pdf_path is not null and b.pdf_path = p_name
     or b.pdf_url is not null and b.pdf_url like '%/pdfs/' || p_name;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Wrappers publicos SECURITY INVOKER (preservam os nomes usados nas
-- policies/views, mas sem expor SECURITY DEFINER via /rest/v1/rpc)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_admin();
$function$;

create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_active_subscription();
$function$;

create or replace function public.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.profile_is_verified(profile_id);
$function$;

create or replace function public.can_read_book_pdf(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.can_read_book_pdf(object_name);
$function$;

create or replace function public.is_book_released(p_book_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_book_released(p_book_id);
$function$;

create or replace function public.is_pdf_object_released(p_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_pdf_object_released(p_name);
$function$;

-- ---------------------------------------------------------------------------
-- 4. Least privilege: so authenticated/service_role executam. Se o schema ja
-- tiver overloads antigos de private.is_book_released (drift), endurece o
-- search_path e revoga os grants deles tambem.
-- ---------------------------------------------------------------------------
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'is_book_released'
  loop
    execute format('alter function %s set search_path = %L', function_row.signature, '');
    execute format('revoke all on function %s from public, anon, authenticated', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.has_active_subscription() from public, anon, authenticated;
revoke all on function private.profile_is_verified(uuid) from public, anon, authenticated;
revoke all on function private.can_read_book_pdf(text) from public, anon, authenticated;
revoke all on function private.is_pdf_object_released(text) from public, anon, authenticated;

grant execute on function private.is_admin()
  to authenticated, service_role;
grant execute on function private.has_active_subscription()
  to authenticated, service_role;
grant execute on function private.profile_is_verified(uuid)
  to authenticated, service_role;
grant execute on function private.can_read_book_pdf(text)
  to authenticated, service_role;
grant execute on function private.is_pdf_object_released(text)
  to authenticated, service_role;

revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.has_active_subscription() from public, anon, authenticated;
revoke all on function public.profile_is_verified(uuid) from public, anon, authenticated;
revoke all on function public.can_read_book_pdf(text) from public, anon, authenticated;
revoke all on function public.is_book_released(uuid) from public, anon, authenticated;
revoke all on function public.is_pdf_object_released(text) from public, anon, authenticated;

grant execute on function public.is_admin()
  to authenticated, service_role;
grant execute on function public.has_active_subscription()
  to authenticated, service_role;
grant execute on function public.profile_is_verified(uuid)
  to authenticated, service_role;
grant execute on function public.can_read_book_pdf(text)
  to authenticated, service_role;
grant execute on function public.is_book_released(uuid)
  to authenticated, service_role;
grant execute on function public.is_pdf_object_released(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Policy de SELECT no bucket `pdfs`: o gate real da paywall.
--    createSignedUrl no cliente passa pelo RLS desta policy: assinante ativo
--    e livro liberado, ou admin. anon fica de fora (nao pode assinar).
-- ---------------------------------------------------------------------------
drop policy if exists "pdfs_select_released" on storage.objects;
create policy "pdfs_select_released"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs'
    and public.can_read_book_pdf(name)
  );

commit;
