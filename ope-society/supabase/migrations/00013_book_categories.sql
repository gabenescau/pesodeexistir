-- OPE Club — categorias de livros (catálogo estilo Netflix, foco em filosofia)
--
-- Uma coluna de texto simples em `books`. Poderia ser uma tabela de categorias
-- com FK, mas o conjunto é pequeno e estável (temas da filosofia/literatura) e
-- o admin escolhe de uma lista fixa no front — texto livre resolve sem custo de
-- join no catálogo. O CHECK impede lixo, mas aceita nulo (livro sem categoria
-- cai em "Outros" na tela).

alter table public.books
  add column if not exists category text;

-- Índice para agrupar o catálogo por categoria sem varrer a tabela toda.
create index if not exists idx_books_category on public.books(category);
