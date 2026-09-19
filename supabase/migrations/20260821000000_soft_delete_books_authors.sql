-- Soft-delete para books e authors.
--
-- Contexto: o admin fazia hard DELETE via service_role (bypassa RLS), sem
-- rastro e sem volta — origem dos relatos de "livros que somem". A partir
-- daqui, book-delete/author-delete apenas marcam deleted_at; a leitura
-- publica e o catalogo do servidor ignoram deletados; book-restore e
-- author-restore revertem. Nenhum dado existente e alterado (coluna nova
-- sempre NULL = visivel, como antes).
--
-- Aplicar com: supabase db push  (ou rode este arquivo no SQL editor).
-- Rollback: UPDATE ... SET deleted_at = NULL; (nada e perdido no deploy).

-- ---------------------------------------------------------------------------
-- 1. Colunas (idempotente: IF NOT EXISTS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.authors
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- ---------------------------------------------------------------------------
-- 2. Indices parciais (só cobrem linhas visiveis; escrita de delete continua barata)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_books_deleted_at
  ON public.books (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_authors_deleted_at
  ON public.authors (deleted_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS: leitura direta (anon/autenticado) ve apenas nao-deletados.
-- O backend usa service_role (bypassa RLS) e filtra deleted_at nas queries,
-- entao o app continua funcionando igual. Admins continuam com acesso total
-- via policies *_admin (is_admin()).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "books_read" ON public.books;
CREATE POLICY "books_read" ON public.books
  FOR SELECT TO authenticated, anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "authors_read" ON public.authors;
CREATE POLICY "authors_read" ON public.authors
  FOR SELECT TO authenticated, anon
  USING (deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- 4. Verificacao pos-deploy (rode e confira 0 linhas):
--    SELECT count(*) FROM public.books WHERE deleted_at IS NOT NULL;
--    SELECT count(*) FROM public.authors WHERE deleted_at IS NOT NULL;
-- ---------------------------------------------------------------------------
