-- OPE Club — correção de RLS ausente e constraints faltando
-- Rode este arquivo no SQL Editor do Supabase.
--
-- Problemas corrigidos:
-- 1. reading_progress, post_likes e post_replies estavam com RLS LIGADO e
--    NENHUMA policy criada. Nesse estado o Postgres nega 100% dos acessos,
--    silenciosamente: progresso de leitura, curtidas e respostas não funcionam.
-- 2. reading_progress não tinha índice único em (user_id, book_id), mas o app
--    faz upsert com onConflict: "user_id,book_id" (DataContext.jsx). Sem o
--    índice o Postgres devolve o erro 42P10.
-- 3. checkout_sessions não tinha a coluna checkout_url, que o app insere
--    em SubscribePage.jsx.
-- 4. webhook_events e weekly_releases nasceram sem os índices únicos previstos:
--    as tabelas já existiam quando o "create table if not exists" rodou, então
--    a cláusula unique daquele create foi ignorada.

-- =====================================================================
-- 1) RLS e grants das três tabelas sem policy
-- =====================================================================
alter table public.reading_progress enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_replies enable row level security;

grant select, insert, update, delete on public.reading_progress to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, delete on public.post_replies to authenticated;

-- =====================================================================
-- 2) reading_progress: cada usuário lê e escreve apenas o próprio progresso
-- =====================================================================
drop policy if exists "reading_progress_select_own" on public.reading_progress;
drop policy if exists "reading_progress_insert_own" on public.reading_progress;
drop policy if exists "reading_progress_update_own" on public.reading_progress;
drop policy if exists "reading_progress_delete_own" on public.reading_progress;

create policy "reading_progress_select_own" on public.reading_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "reading_progress_insert_own" on public.reading_progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "reading_progress_update_own" on public.reading_progress
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reading_progress_delete_own" on public.reading_progress
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =====================================================================
-- 3) post_likes: todos os logados veem as curtidas; cada um curte/descurte por si
-- =====================================================================
drop policy if exists "post_likes_select_authenticated" on public.post_likes;
drop policy if exists "post_likes_insert_own" on public.post_likes;
drop policy if exists "post_likes_delete_own" on public.post_likes;

create policy "post_likes_select_authenticated" on public.post_likes
  for select to authenticated
  using (true);

create policy "post_likes_insert_own" on public.post_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "post_likes_delete_own" on public.post_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =====================================================================
-- 4) post_replies: todos os logados leem; autor cria; autor ou admin apaga
-- =====================================================================
drop policy if exists "post_replies_select_authenticated" on public.post_replies;
drop policy if exists "post_replies_insert_own" on public.post_replies;
drop policy if exists "post_replies_delete_own_or_admin" on public.post_replies;

create policy "post_replies_select_authenticated" on public.post_replies
  for select to authenticated
  using (true);

create policy "post_replies_insert_own" on public.post_replies
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "post_replies_delete_own_or_admin" on public.post_replies
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- =====================================================================
-- 5) reading_progress: índice único exigido pelo upsert do app
--    (remove duplicatas antigas antes, mantendo o registro mais recente)
-- =====================================================================
delete from public.reading_progress
where id not in (
  select distinct on (user_id, book_id) id
  from public.reading_progress
  order by user_id, book_id, updated_at desc nulls last, id desc
);

create unique index if not exists uq_reading_progress_user_book
  on public.reading_progress(user_id, book_id);

-- =====================================================================
-- 6) checkout_sessions: coluna que o app insere e não existia
-- =====================================================================
alter table public.checkout_sessions
  add column if not exists checkout_url text;

-- =====================================================================
-- 7) webhook_events: unicidade para idempotência do webhook da Cakto
--    (evita processar o mesmo evento duas vezes numa corrida)
-- =====================================================================
delete from public.webhook_events
where external_event_id is not null
  and id not in (
    select distinct on (provider, external_event_id) id
    from public.webhook_events
    where external_event_id is not null
    order by provider, external_event_id, received_at desc nulls last, id desc
  );

create unique index if not exists uq_webhook_events_provider_event
  on public.webhook_events(provider, external_event_id)
  where external_event_id is not null;

-- =====================================================================
-- 8) weekly_releases: um lançamento por livro por data
-- =====================================================================
delete from public.weekly_releases
where id not in (
  select distinct on (book_id, release_date) id
  from public.weekly_releases
  order by book_id, release_date, created_at desc nulls last, id desc
);

create unique index if not exists uq_weekly_releases_book_date
  on public.weekly_releases(book_id, release_date);

-- =====================================================================
-- 9) Índices de apoio para as consultas mais comuns do app
-- =====================================================================
create index if not exists idx_reading_progress_user on public.reading_progress(user_id);
create index if not exists idx_post_likes_post on public.post_likes(post_id);
create index if not exists idx_post_replies_post on public.post_replies(post_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_book_notes_user_book on public.book_notes(user_id, book_id);
