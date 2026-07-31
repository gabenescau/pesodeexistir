import { useMemo, useState } from "react";
import { SlidersHorizontal, X, Check } from "@/lib/icons";
import { BookRow } from "../components/BookRow";
import { useData } from "../data/DataContext";
import { CATEGORIES, groupByCategory } from "@/lib/categories";
import { AutocompleteSearch, buildSearchItems } from "@/components/ui/autocomplete";

function LibrarySkeleton() {
  return (
    <div className="space-y-9" aria-busy="true" aria-label="Carregando biblioteca">
      {[0, 1, 2].map((row) => (
        <section key={row}>
          <div className="mb-3 h-4 w-32 rounded bg-[var(--hover-overlay)]" />
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4].map((card) => (
              <div
                key={card}
                className="w-28 shrink-0 animate-pulse sm:w-32"
              >
                <div className="aspect-[2/3] w-full rounded-[8px] bg-[var(--hover-overlay)] sm:rounded-[12px]" />
                <div className="mt-2 h-3 w-3/4 rounded bg-[var(--hover-overlay)]" />
                <div className="mt-1 h-2 w-1/2 rounded bg-[var(--hover-overlay)]" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const { books, authors, categories, bookFavorites, loading } = useData();
  const [query, setQuery] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  const [autorAtivo, setAutorAtivo] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("todos"); // todos | favoritos | lendo
  const [filtroAberto, setFiltroAberto] = useState(false);

  const searchItems = useMemo(
    () => buildSearchItems({ books, authors, categories }),
    [books, authors, categories]
  );

  const allBooks = useMemo(() => books.map((b) => ({
    ...b,
    authorName: authors.find((a) => a.id === b.authorId)?.name || b.authorName || "",
    author: authors.find((a) => a.id === b.authorId)?.name || b.authorName || "",
    authorId: b.authorId || authors.find((a) => a.name === (b.authorName || b.author))?.id || null,
  })), [books, authors]);

  const readingBooks = useMemo(() => allBooks.filter((b) => Number(b.progress || 0) > 0), [allBooks]);
  const favoriteBooks = useMemo(() => allBooks.filter((b) => bookFavorites.includes(b.id)), [allBooks, bookFavorites]);

  const categoriasDisponiveis = useMemo(() => {
    const presentes = new Set(allBooks.map((b) => b.category).filter(Boolean));
    return CATEGORIES.filter((c) => presentes.has(c));
  }, [allBooks]);

  const autoresDisponiveis = useMemo(() => {
    const ids = new Set(allBooks.map((b) => b.authorId).filter(Boolean));
    return authors
      .filter((a) => ids.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [allBooks, authors]);

  const termo = query.trim().toLowerCase();
  const buscaAtiva = termo.length > 0;

  const resultadosBusca = useMemo(() => {
    if (!buscaAtiva) return [];
    return allBooks.filter((b) =>
      b.title.toLowerCase().includes(termo) ||
      b.authorName.toLowerCase().includes(termo) ||
      (b.category || "").toLowerCase().includes(termo)
    );
  }, [allBooks, termo, buscaAtiva]);

  const livrosParaPrateleiras = useMemo(() => {
    if (abaAtiva === "favoritos") return favoriteBooks;
    if (abaAtiva === "lendo") return readingBooks;
    let base = categoriaAtiva === "Todas" ? allBooks : allBooks.filter((b) => b.category === categoriaAtiva);
    if (autorAtivo) base = base.filter((b) => b.authorId === autorAtivo);
    return base;
  }, [abaAtiva, categoriaAtiva, autorAtivo, allBooks, favoriteBooks, readingBooks]);

  const prateleiras = useMemo(() => groupByCategory(livrosParaPrateleiras), [livrosParaPrateleiras]);

  const totalResultados = resultadosBusca.length;
  const filtroAtivo = categoriaAtiva !== "Todas" || autorAtivo;

  const limparFiltros = () => {
    setCategoriaAtiva("Todas");
    setAutorAtivo(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Biblioteca</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{books.length} livros em nossa coleção de filosofia e literatura.</p>
      </div>

      {/* Abas: Todos / Lendo / Favoritos */}
      <div className="flex gap-2">
        {[
          { key: "todos", label: `Todos (${allBooks.length})` },
          { key: "lendo", label: `Lendo (${readingBooks.length})` },
          { key: "favoritos", label: `Favoritos (${favoriteBooks.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAbaAtiva(tab.key)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              abaAtiva === tab.key
                ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pesquisa + botão de filtro (categorias/autores) */}
      <div className="flex gap-2">
        <AutocompleteSearch
          className="flex-1"
          placeholder="Pesquisar livros, autores ou categorias..."
          items={searchItems}
          onSelect={(item) => {
            if (item.kind === "category") setCategoriaAtiva(item.label);
            if (item.kind === "author") setAutorAtivo(item.id?.replace("author-", ""));
          }}
        />
        <button
          onClick={() => setFiltroAberto((v) => !v)}
          aria-label="Abrir filtros"
          aria-expanded={filtroAberto}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-[6px] border px-4 text-sm font-medium transition-colors sm:h-12 ${
            filtroAberto || filtroAtivo
              ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
              : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          }`}
        >
          <SlidersHorizontal className="size-[18px]" />
          <span className="hidden sm:inline">Filtros{filtroAtivo ? " *" : ""}</span>
        </button>
      </div>

      {/* Painel de filtros: categoria + autor — some durante a busca */}
      {filtroAberto && !buscaAtiva && abaAtiva === "todos" && (categoriasDisponiveis.length > 0 || autoresDisponiveis.length > 0) && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-4">
          {filtroAtivo && (
            <div className="flex justify-end">
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="size-3" /> Limpar filtros
              </button>
            </div>
          )}

          {categoriasDisponiveis.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Categorias</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
                {["Todas", ...categoriasDisponiveis].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaAtiva(cat)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                      categoriaAtiva === cat
                        ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                    }`}
                  >
                    {categoriaAtiva === cat && cat !== "Todas" && <Check className="mr-1 inline size-3" />}
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {autoresDisponiveis.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Autores</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
                <button
                  onClick={() => setAutorAtivo(null)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                    autorAtivo === null
                      ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  Todos
                </button>
                {autoresDisponiveis.map((autor) => (
                  <button
                    key={autor.id}
                    onClick={() => setAutorAtivo((prev) => (prev === autor.id ? null : autor.id))}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                      autorAtivo === autor.id
                        ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                    }`}
                  >
                    {autorAtivo === autor.id && <Check className="mr-1 inline size-3" />}
                    {autor.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {buscaAtiva ? (
        totalResultados > 0 ? (
          <BookRow title={`Resultados (${totalResultados})`} books={resultadosBusca} defaultOpen />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
            Nenhum livro encontrado para "{query}".
          </p>
        )
      ) : abaAtiva === "lendo" ? (
        readingBooks.length > 0 ? (
          <BookRow title="Continue lendo" books={readingBooks} defaultOpen />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
            Você ainda não começou nenhuma leitura. Explore a biblioteca e comece um livro.
          </p>
        )
      ) : abaAtiva === "favoritos" ? (
        favoriteBooks.length > 0 ? (
          <BookRow title="Meus favoritos" books={favoriteBooks} defaultOpen />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
            Nenhum livro favoritado ainda. Toque no coração de um livro para salvá-lo aqui.
          </p>
        )
      ) : (
        <div className="space-y-9">
          {loading && books.length === 0 ? (
            <LibrarySkeleton />
          ) : prateleiras.length > 0 ? (
            prateleiras.map(({ categoria, livros }) => (
              <BookRow key={categoria} title={categoria} books={livros} defaultOpen />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
              Nenhum livro encontrado com esses filtros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
