-- OPE Club - corrige 403 "permission denied for table ..."
-- Rode no SQL Editor do Supabase.
--
-- GRANT libera a operacao no PostgREST. As policies RLS continuam decidindo
-- quais linhas cada usuario pode ler ou alterar.

begin;

grant usage on schema public to authenticated;

do $permissions$
declare
  relation_name text;
begin
  -- Catalogo e roadmap: as policies permitem escrita somente para admin.
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
