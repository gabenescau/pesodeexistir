-- OPE Club — camada social + trava real dos lancamentos semanais
--
-- O que entra aqui:
--   1. profiles.username  — handle estavel e unico (hoje o app deriva o handle
--      do email, o que vaza a parte local do email de todo mundo no feed).
--   2. follows            — grafo de seguidores.
--   3. book_page_comments — comentario por pagina de livro (so assinante).
--   4. reactions          — reacoes com emoji em post, resposta e comentario.
--   5. saved_posts        — o botao de salvar do PostCard nunca persistiu nada.
--   6. views de contagem  — curtidas/respostas/seguidores sem N+1 no client.
--   7. trava de lancamento — o PDF de um livro agendado para o futuro nao pode
--      ser assinado pelo Storage antes da data. Ate agora a data era so
--      decoracao na tela: quem tivesse o id do livro abria /app/ler/<id> e lia.

-- =====================================================================
-- 1) profiles.username
-- =====================================================================
alter table public.profiles
  add column if not exists username text;

-- Backfill: parte local do email, sanitizada, com sufixo em caso de colisao.
with candidato as (
  select
    id,
    nullif(regexp_replace(lower(split_part(coalesce(email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), '') as base
  from public.profiles
  where username is null
),
numerado as (
  select
    id,
    coalesce(base, 'leitor') as base,
    row_number() over (partition by coalesce(base, 'leitor') order by id) as n
  from candidato
)
update public.profiles p
set username = case when n.n = 1 then n.base else n.base || n.n::text end
from numerado n
where p.id = n.id
  and p.username is null;

update public.profiles
set username = 'leitor_' || replace(id::text, '-', '')
where username is null or username = '';

create unique index if not exists uq_profiles_username
  on public.profiles (lower(username));

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,24}$') not valid;

-- username entra no grant por coluna do 00009 (que revogou o update amplo).
grant update (username) on public.profiles to authenticated;

-- Novos cadastros ja nascem com handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_sufixo integer := 0;
begin
  v_base := nullif(
    regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'),
    ''
  );
  v_base := coalesce(v_base, 'leitor');
  if length(v_base) < 3 then
    v_base := v_base || 'leitor';
  end if;
  v_base := left(v_base, 20);
  v_username := v_base;

  while exists (select 1 from public.profiles where lower(username) = v_username) loop
    v_sufixo := v_sufixo + 1;
    v_username := left(v_base, 20) || v_sufixo::text;
  end loop;

  insert into public.profiles (id, email, name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_username
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- =====================================================================
-- 2) Trava de lancamento (definida antes das policies que a usam)
-- =====================================================================
-- Livro sem agendamento continua livre. Com agendamento, so libera quando
-- existe uma data ja alcancada.
create or replace function public.is_book_released(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    not exists (select 1 from public.weekly_releases w where w.book_id = p_book_id)
    or exists (
      select 1 from public.weekly_releases w
      where w.book_id = p_book_id
        and w.release_date <= current_date
    );
$$;

revoke all on function public.is_book_released(uuid) from public;
grant execute on function public.is_book_released(uuid) to authenticated;

-- O nome do objeto no bucket e sempre `books/<slug>-<timestamp>.pdf` (ASCII,
-- gerado pelo AdminPage), entao casar o sufixo da pdf_url e seguro aqui.
create or replace function public.is_pdf_object_released(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(bool_and(public.is_book_released(b.id)), true)
  from public.books b
  where b.pdf_url is not null
    and b.pdf_url like '%/pdfs/' || p_name;
$$;

revoke all on function public.is_pdf_object_released(text) from public;
grant execute on function public.is_pdf_object_released(text) to authenticated;

comment on function public.is_book_released(uuid) is
  'Livro liberado: sem agendamento em weekly_releases, ou com uma data ja alcancada.';

-- =====================================================================
-- 3) follows
-- =====================================================================
create table if not exists public.follows (
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint follows_sem_auto_follow check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows_select_authenticated" on public.follows;
drop policy if exists "follows_insert_own" on public.follows;
drop policy if exists "follows_delete_own" on public.follows;

create policy "follows_select_authenticated" on public.follows
  for select to authenticated using (true);

create policy "follows_insert_own" on public.follows
  for insert to authenticated
  with check ((select auth.uid()) = follower_id);

create policy "follows_delete_own" on public.follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id);

grant select, insert, delete on public.follows to authenticated;

create index if not exists idx_follows_following on public.follows(following_id);
create index if not exists idx_follows_follower on public.follows(follower_id);

-- =====================================================================
-- 4) book_page_comments — discussao presa a uma pagina do livro
-- =====================================================================
create table if not exists public.book_page_comments (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references public.books(id) on delete cascade not null,
  page_number integer not null check (page_number >= 1),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.book_page_comments enable row level security;

drop policy if exists "book_page_comments_select_subscribers" on public.book_page_comments;
drop policy if exists "book_page_comments_insert_own" on public.book_page_comments;
drop policy if exists "book_page_comments_update_own" on public.book_page_comments;
drop policy if exists "book_page_comments_delete_own_or_admin" on public.book_page_comments;

-- Comentario de pagina e conteudo de assinante: quem nao paga nao le nem escreve.
create policy "book_page_comments_select_subscribers" on public.book_page_comments
  for select to authenticated
  using (public.has_active_subscription() or public.is_admin());

create policy "book_page_comments_insert_own" on public.book_page_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (public.has_active_subscription() or public.is_admin())
    and public.is_book_released(book_id)
  );

create policy "book_page_comments_update_own" on public.book_page_comments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "book_page_comments_delete_own_or_admin" on public.book_page_comments
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

grant select, insert, update, delete on public.book_page_comments to authenticated;

create index if not exists idx_book_page_comments_book_page
  on public.book_page_comments(book_id, page_number, created_at desc);

-- =====================================================================
-- 5) reactions — emoji em post, resposta e comentario de pagina
-- =====================================================================
create table if not exists public.reactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  target_type text not null check (target_type in ('post', 'post_reply', 'book_comment')),
  target_id uuid not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (user_id, target_type, target_id, emoji)
);

-- Allowlist fechada: impede que a tabela vire canal de texto livre
-- (spam/XSS-bait) via insert direto na API REST.
alter table public.reactions drop constraint if exists reactions_emoji_permitido;
alter table public.reactions add constraint reactions_emoji_permitido
  check (emoji in ('❤️', '🔥', '😂', '😮', '😢', '👏', '🤔', '📖'));

alter table public.reactions enable row level security;

drop policy if exists "reactions_select_authenticated" on public.reactions;
drop policy if exists "reactions_insert_own" on public.reactions;
drop policy if exists "reactions_delete_own" on public.reactions;

create policy "reactions_select_authenticated" on public.reactions
  for select to authenticated using (true);

create policy "reactions_insert_own" on public.reactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "reactions_delete_own" on public.reactions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.reactions to authenticated;

create index if not exists idx_reactions_target on public.reactions(target_type, target_id);

-- =====================================================================
-- 6) saved_posts
-- =====================================================================
create table if not exists public.saved_posts (
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

alter table public.saved_posts enable row level security;

drop policy if exists "saved_posts_select_own" on public.saved_posts;
drop policy if exists "saved_posts_insert_own" on public.saved_posts;
drop policy if exists "saved_posts_delete_own" on public.saved_posts;

create policy "saved_posts_select_own" on public.saved_posts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "saved_posts_insert_own" on public.saved_posts
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "saved_posts_delete_own" on public.saved_posts
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.saved_posts to authenticated;

-- =====================================================================
-- 7) public_profiles ganha o username (e continua sem email/role)
-- =====================================================================
-- DROP antes do CREATE: a view ja existe (00010) com as colunas
-- (id, name, avatar, bio). Inserir `username` no meio renomearia a 3a coluna,
-- e `create or replace view` recusa renomear coluna (42P16). Dropar e recriar
-- resolve — nada depende desta view alem do app, que le por REST.
drop view if exists public.public_profiles;
create view public.public_profiles as
select
  id,
  name,
  username,
  avatar,
  bio
from public.profiles
where private_profile = false;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- =====================================================================
-- 8) Storage: o PDF de um livro agendado nao e assinavel antes da data
-- =====================================================================
drop policy if exists "pdfs_select_subscribers" on storage.objects;

create policy "pdfs_select_subscribers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pdfs'
    and (public.has_active_subscription() or public.is_admin())
    and (public.is_admin() or public.is_pdf_object_released(name))
  );

comment on function public.is_book_released(uuid) is
  'Livro liberado: sem agendamento em weekly_releases, ou com uma data ja alcancada.';

-- =====================================================================
-- 9) Limites de tamanho — posts e respostas nasceram sem teto nenhum
-- =====================================================================
-- Sem isso, um unico insert pela API REST (a anon key esta no bundle) grava
-- megabytes de texto por linha, e o feed inteiro passa a trafegar isso para
-- todo mundo. Os limites sao generosos para leitura humana e fatais para spam.
alter table public.posts drop constraint if exists posts_text_tamanho;
alter table public.posts add constraint posts_text_tamanho
  check (char_length(text) <= 5000) not valid;

alter table public.post_replies drop constraint if exists post_replies_text_tamanho;
alter table public.post_replies add constraint post_replies_text_tamanho
  check (char_length(text) <= 2000) not valid;

-- posts.images guarda data URL base64 hoje (CreatePost.jsx). Ate migrar para o
-- Storage, o teto evita que um post sozinho carregue dezenas de MB.
alter table public.posts drop constraint if exists posts_images_tamanho;
alter table public.posts add constraint posts_images_tamanho
  check (
    images is null
    or (jsonb_array_length(images) <= 4 and char_length(images::text) <= 3000000)
  ) not valid;
