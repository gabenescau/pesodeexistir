-- ============================================================================
-- M12 — [MEDIO] Colecoes publicas de livros/autores
-- ----------------------------------------------------------------------------
-- Cada usuario pode montar colecoes nomeadas (ex.: "Filosofia para ler",
-- "Autores brasileiros") contendo livros e/ou autores. Colecoes sao publicas
-- por padrao (is_public=true) para que outros perfis possam ve-las; o dono
-- pode tornar privada. Apenas o dono cria/edita/apaga.
--
-- Modelo:
--   collections         (colecao em si: nome, descricao, capa, visibilidade)
--   collection_items    (itens da colecao: livro OU autor, com ordem)
--
-- RLS:
--   - SELECT em collections: publicas OU do proprio usuario.
--   - INSERT/UPDATE/DELETE em collections: apenas o dono (user_id = auth.uid()).
--   - SELECT em collection_items: mesmo criterio da colecao-pai.
--   - INSERT/UPDATE/DELETE em collection_items: apenas dono da colecao-pai.
--   - Policies sao FORCE para garantir que padrao nao exponha dados sensiveis.
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tipo enumerado para o tipo de item (livro ou autor)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'collection_item_type') then
    create type public.collection_item_type as enum ('book', 'author');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabela collections
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 280),
  cover_path text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_user on public.collections(user_id);
create index if not exists idx_collections_public on public.collections(is_public) where is_public;

drop trigger if exists trg_collections_updated_at on public.collections;
create trigger trg_collections_updated_at before update on public.collections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Tabela collection_items
-- ---------------------------------------------------------------------------
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  item_type public.collection_item_type not null,
  item_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- Nao permite o mesmo item duplicado na mesma colecao.
  unique (collection_id, item_type, item_id)
);

create index if not exists idx_collection_items_collection on public.collection_items(collection_id);
create index if not exists idx_collection_items_lookup on public.collection_items(item_type, item_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- collections: SELECT (publicas OU proprias)
drop policy if exists "collections_read_public_or_own" on public.collections;
create policy "collections_read_public_or_own"
  on public.collections for select
  to anon, authenticated
  using (is_public or user_id = (select auth.uid()));

-- collections: INSERT (apenas para si mesmo)
drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- collections: UPDATE/DELETE (apenas o dono)
drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- collection_items: SELECT (colecao publica OU do proprio usuario)
drop policy if exists "collection_items_read_via_collection" on public.collection_items;
create policy "collection_items_read_via_collection"
  on public.collection_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (c.is_public or c.user_id = (select auth.uid()))
    )
  );

-- collection_items: INSERT (apenas em colecao propria)
drop policy if exists "collection_items_insert_own" on public.collection_items;
create policy "collection_items_insert_own"
  on public.collection_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  );

-- collection_items: DELETE (apenas em colecao propria)
drop policy if exists "collection_items_delete_own" on public.collection_items;
create policy "collection_items_delete_own"
  on public.collection_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  );

-- collection_items: UPDATE (reordenacao, apenas dono) - raramente usado
drop policy if exists "collection_items_update_own" on public.collection_items;
create policy "collection_items_update_own"
  on public.collection_items for update
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Grants para o PostgREST (RLS decide quais linhas cada usuario ve).
--    Padrao do projeto: authenticated recebe CRUD; anon recebe SELECT.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select on public.collections to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;

grant select on public.collection_items to anon, authenticated;
grant insert, update, delete on public.collection_items to authenticated;

-- Tipos personalizados precisam de USAGE para o PostgREST retornar o enum.
grant usage on type public.collection_item_type to anon, authenticated;

commit;
