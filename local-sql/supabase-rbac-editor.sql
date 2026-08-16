-- OPE Club - RBAC admin/editor/user
-- Rode no SQL Editor do Supabase. Seguro para executar novamente.
--
-- Editor gerencia catalogo, posts e sugestoes. Somente admin continua
-- gerenciando usuarios, assinaturas e cobranca.

begin;

update public.profiles
set role = 'user'
where role is null or role not in ('admin', 'editor', 'user');

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'editor', 'user'));

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

drop policy if exists content_managers_insert_library_files on storage.objects;
create policy content_managers_insert_library_files
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers', 'book-pdfs', 'authors')
    and (select public.can_manage_content())
  );

drop policy if exists content_managers_update_library_files on storage.objects;
create policy content_managers_update_library_files
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers', 'book-pdfs', 'authors')
    and (select public.can_manage_content())
  )
  with check (
    bucket_id in ('covers', 'book-pdfs', 'authors')
    and (select public.can_manage_content())
  );

drop policy if exists content_managers_delete_library_files on storage.objects;
create policy content_managers_delete_library_files
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers', 'book-pdfs', 'authors')
    and (select public.can_manage_content())
  );

commit;

-- Promova um usuario depois de revisar o email/UUID:
-- update public.profiles set role = 'editor' where id = 'UUID_DO_USUARIO';
