-- A coluna bio de public.books pode faltar em bancos criados antes da
-- migracao inicial (0001_full.sql) ou quando a tabela foi recriada.
-- Esta migration garante a coluna e o indice mesmo que a tabela ja exista.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS bio text CHECK (bio IS NULL OR char_length(bio) <= 4000);
