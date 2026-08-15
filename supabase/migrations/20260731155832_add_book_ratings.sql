-- ============================================================================
-- book_ratings: nota de 1 a 5 que cada usuario da para um livro.
-- A media vira a "nota" exibida nos cards (substitui a nota fake por hash).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.book_ratings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_book_ratings_book_id ON public.book_ratings (book_id);
CREATE INDEX IF NOT EXISTS idx_book_ratings_user_id ON public.book_ratings (user_id);

ALTER TABLE public.book_ratings ENABLE ROW LEVEL SECURITY;

-- Leitura publica da nota (a media e mostrada nos cards para todos).
DROP POLICY IF EXISTS "book_ratings_read" ON public.book_ratings;
CREATE POLICY "book_ratings_read" ON public.book_ratings FOR SELECT TO authenticated, anon USING (true);

-- Escrita apenas da propria nota.
DROP POLICY IF EXISTS "book_ratings_write_own" ON public.book_ratings;
CREATE POLICY "book_ratings_write_own" ON public.book_ratings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.book_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_ratings TO authenticated;
