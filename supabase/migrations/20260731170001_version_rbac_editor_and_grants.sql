-- ============================================================================
-- M9 — [MEDIO] Versiona o conteudo de local-sql/ que so existia no dashboard
-- ----------------------------------------------------------------------------
-- Reproduz, como migrations reais e idempotentes, o estado que hoje so existe
-- aplicado a mao no SQL Editor:
--   1. supabase-rbac-editor.sql             (RBAC admin/editor/user)
--   2. supabase-fix-table-permissions.sql   (GRANTs para o PostgREST)
--
-- Correcao aplicada na versionagem (registrada em M2/M9):
--   * as policies de storage para "library files" no local-sql apontavam para
--     buckets inexistentes ('book-pdfs', 'authors'). Ajustado para os buckets
--     reais do schema: 'covers' e 'pdfs'. Sem isso, editor/admin nunca
--     conseguiriam subir PDFs ou capas (falha silenciosa de 403 no storage).
--
-- Dependencia: aplica depois de 20260731170000 (cria o schema `private`).
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. RBAC: normaliza role e garante o CHECK constraint
--    (roda como owner/migration -> sem JWT, o trigger da M1 libera)
-- ---------------------------------------------------------------------------
update public.profiles
set role = 'user'
where role is null or role not in ('admin', 'editor', 'user');

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'editor', 'user'));

-- ---------------------------------------------------------------------------
-- 2. Editor gerencia catalogo (books/authors/categories/weekly_releases),
--    posts (delete) e sugestoes (update/delete). Admin mantem usuarios,
--    assinaturas e cobranca.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_manage_content()
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
      and p.role in ('admin', 'editor')
  );
$function$;

revoke all on function private.can_manage_content() from public, anon;
grant execute on function private.can_manage_content() to authenticated, service_role;

create or replace function public.can_manage_content()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.can_manage_content();
$function$;

revoke all on function public.can_manage_content() from public, anon;
grant execute on function public.can_manage_content() to authenticated, service_role;

do $policies$
declare
  relation_name text;
  operation_name text;
  policy_name text;
begin
  foreach relation_name in array array[
    'books',
    'authors',
    'categories',
    'weekly_releases'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        relation_name
      );

      foreach operation_name in array array['insert', 'update', 'delete']
      loop
        policy_name := format('content_managers_%s_%s', operation_name, relation_name);
        execute format('drop policy if exists %I on public.%I', policy_name, relation_name);

        if operation_name = 'insert' then
          execute format(
            'create policy %I on public.%I for insert to authenticated with check ((select public.can_manage_content()))',
            policy_name,
            relation_name
          );
        elsif operation_name = 'update' then
          execute format(
            'create policy %I on public.%I for update to authenticated using ((select public.can_manage_content())) with check ((select public.can_manage_content()))',
            policy_name,
            relation_name
          );
        else
          execute format(
            'create policy %I on public.%I for delete to authenticated using ((select public.can_manage_content()))',
            policy_name,
            relation_name
          );
        end if;
      end loop;
    end if;
  end loop;

  if to_regclass('public.posts') is not null then
    drop policy if exists content_managers_delete_posts on public.posts;
    create policy content_managers_delete_posts
      on public.posts for delete to authenticated
      using ((select public.can_manage_content()));
  end if;

  if to_regclass('public.suggestions') is not null then
    grant select, insert, update, delete on table public.suggestions to authenticated;
    drop policy if exists content_managers_update_suggestions on public.suggestions;
    create policy content_managers_update_suggestions
      on public.suggestions for update to authenticated
      using ((select public.can_manage_content()))
      with check ((select public.can_manage_content()));

    drop policy if exists content_managers_delete_suggestions on public.suggestions;
    create policy content_managers_delete_suggestions
      on public.suggestions for delete to authenticated
      using ((select public.can_manage_content()));
  end if;
end
$policies$;

-- ---------------------------------------------------------------------------
-- 3. Storage: editor/admin gerencia os arquivos da biblioteca (covers + pdfs).
--    (local-sql apontava para 'book-pdfs'/'authors', buckets inexistentes.)
-- ---------------------------------------------------------------------------
drop policy if exists content_managers_insert_library_files on storage.objects;
create policy content_managers_insert_library_files
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers', 'pdfs')
    and (select public.can_manage_content())
  );

drop policy if exists content_managers_update_library_files on storage.objects;
create policy content_managers_update_library_files
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers', 'pdfs')
    and (select public.can_manage_content())
  )
  with check (
    bucket_id in ('covers', 'pdfs')
    and (select public.can_manage_content())
  );

drop policy if exists content_managers_delete_library_files on storage.objects;
create policy content_managers_delete_library_files
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers', 'pdfs')
    and (select public.can_manage_content())
  );

-- ---------------------------------------------------------------------------
-- 4. GRANTs para o PostgREST (fix dos 403 "permission denied for table").
--    As policies RLS continuam decidindo quais linhas cada usuario acessa.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

do $permissions$
declare
  relation_name text;
begin
  -- Catalogo e roadmap: as policies permitem escrita somente para admin/editor.
  foreach relation_name in array array[
    'books',
    'authors',
    'weekly_releases',
    'categories',
    'suggestions'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        relation_name
      );
    end if;
  end loop;

  -- Identidade, assinatura e eventos: somente leitura no cliente.
  foreach relation_name in array array[
    'profiles',
    'public_profiles',
    'user_emails',
    'subscriptions',
    'abacatepay_webhook_events'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select on table public.%I to authenticated',
        relation_name
      );
    end if;
  end loop;

  -- Dados privados do usuario. As policies RLS limitam cada linha ao dono.
  foreach relation_name in array array[
    'reading_progress',
    'book_notes',
    'book_favorites',
    'author_favorites'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        relation_name
      );
    end if;
  end loop;

  -- Interacoes sem operacao de update no cliente.
  foreach relation_name in array array[
    'posts',
    'post_replies',
    'post_likes',
    'saved_posts',
    'follows',
    'reactions',
    'book_page_comments'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select, insert, delete on table public.%I to authenticated',
        relation_name
      );
    end if;
  end loop;

  foreach relation_name in array array[
    'post_polls',
    'post_poll_options',
    'post_poll_votes'
  ]
  loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format(
        'grant select, insert on table public.%I to authenticated',
        relation_name
      );
    end if;
  end loop;
end
$permissions$;

commit;
