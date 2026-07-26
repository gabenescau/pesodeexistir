-- OPE Club — categorias dinâmicas, favoritos (livros e autores) e visibilidade de lançamentos
--
-- Até aqui categorias eram coluna de texto livre em books controlada por uma
-- lista fixa no front. O admin precisa poder criar/renomear/remover categorias,
-- então vira tabela própria. Os textos legados em books.category seguem como
-- texto livre (sem FK forçada) para não travar linhas antigas; o front passa a
-- ler a tabela categories como fonte da verdade e escreve o NAME lá.
--
-- Favoritos de livros e autores não existiam (só follows entre usuários e
-- saved_posts). Lançamentos não tinham flag de visibilidade — agora existe um
-- "visible" (default true) para o admin poder esconder uma seção sem apagar.

begin;

-- ===========================================================================
-- 1) Tabela de categorias gerenciada pelo admin
-- ===========================================================================

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Catálogo: qualquer autenticado lê. Só admin escreve.
create policy "categories_select_authenticated"
  on public.categories for select
  to authenticated
  using (true);

create policy "categories_insert_admin"
  on public.categories for insert
  to authenticated
  with check (private.is_admin());

create policy "categories_update_admin"
  on public.categories for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "categories_delete_admin"
  on public.categories for delete
  to authenticated
  using (private.is_admin());

-- Migra as categorias de texto já existentes em books para a nova tabela (idempotente).
insert into public.categories (name)
select distinct category
  from public.books
 where category is not null
   and category <> ''
on conflict (name) do nothing;

-- Índice para listar categorias na ordem do admin.
create index if not exists idx_categories_sort_order
  on public.categories (sort_order, name);

-- ===========================================================================
-- 2) Favoritos de livros e autores
-- ===========================================================================

create table if not exists public.book_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.book_favorites enable row level security;

create policy "book_favorites_select_own"
  on public.book_favorites for select
  to authenticated
  using (user_id = auth.uid());

create policy "book_favorites_insert_own"
  on public.book_favorites for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "book_favorites_delete_own"
  on public.book_favorites for delete
  using (user_id = auth.uid());

create table if not exists public.author_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

alter table public.author_favorites enable row level security;

create policy "author_favorites_select_own"
  on public.author_favorites for select
  to authenticated
  using (user_id = auth.uid());

create policy "author_favorites_insert_own"
  on public.author_favorites for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "author_favorites_delete_own"
  on public.author_favorites for delete
  using (user_id = auth.uid());

-- ===========================================================================
-- 3) Visibilidade de lançamentos semanais
-- ===========================================================================

alter table public.weekly_releases
  add column if not exists visible boolean not null default true;

-- is_book_released passa a ignorar lançamentos invisíveis: um lançamento
-- futuro só bloqueia o PDF se estiver visível. Admin pode "esconder" a
-- contagem regressiva sem apagar o agendamento.
create or replace function private.is_book_released(p_book_id uuid)
returns boolean
language sql
stable
as $$
  select
    not exists (
      select 1 from public.weekly_releases w
       where w.book_id = p_book_id
         and w.visible = true
    )
    or exists (
      select 1 from public.weekly_releases w
       where w.book_id = p_book_id
         and w.visible = true
         and w.release_date <= current_date
    );
$$;

grant execute on function private.is_book_released(uuid) to authenticated;

-- weekly_releases já tem RLS (admin write, authenticated read). Novas colunas
-- não exigem novas políticas, mas garantimos a leitura autenticada permanece.
-- (Política existente em 00012 já cobre select; nada a refazer.)

commit;
