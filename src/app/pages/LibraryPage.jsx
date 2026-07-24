import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BookRow } from "../components/BookRow";
import { useData } from "../data/DataContext";
import { CATEGORIES, groupByCategory } from "@/lib/categories";

export function LibraryPage() {
  const { books, authors } = useData();
  const [query, setQuery] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  const allBooks = useMemo(() => books.map((b) => ({
    ...b,
    authorName: authors.find((a) => a.id === b.authorId)?.name || b.authorName || "",
    author: authors.find((a) => a.id === b.authorId)?.name || b.authorName || "",
  })), [books, authors]);

  const readingBooks = allBooks.filter((b) => Number(b.progress || 0) > 0);

  // Só as categorias que têm livro entram nos chips (sem prateleira vazia).
  const categoriasDisponiveis = useMemo(() => {
    const presentes = new Set(allBooks.map((b) => b.category).filter(Boolean));
    return CATEGORIES.filter((c) => presentes.has(c));
  }, [allBooks]);

  const termo = query.trim().toLowerCase();
  const buscaAtiva = termo.length > 0;

  const resultadosBusca = buscaAtiva
    ? allBooks.filter((b) =>
        b.title.toLowerCase().includes(termo) ||
        b.authorName.toLowerCase().includes(termo) ||
        (b.category || "").toLowerCase().includes(termo)
      )
    : [];

  const prateleiras = useMemo(() => {
    const base = categoriaAtiva === "Todas"
      ? allBooks
      : allBooks.filter((b) => b.category === categoriaAtiva);
    return groupByCategory(base);
  }, [allBooks, categoriaAtiva]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Biblioteca</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{books.length} livros em nossa coleção de filosofia e literatura.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--text-placeholder)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar livros, autores ou categorias..."
          className="h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)] sm:h-12"
        />
      </div>

      {/* Filtro de categoria estilo catálogo. Some durante a busca. */}
      {!buscaAtiva && categoriasDisponiveis.length > 0 && (
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
              {cat}
            </button>
          ))}
        </div>
      )}

      {buscaAtiva ? (
        resultadosBusca.length > 0 ? (
          <BookRow title={`Resultados (${resultadosBusca.length})`} books={resultadosBusca} />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
            Nenhum livro encontrado para “{query}”.
          </p>
        )
      ) : (
        <div className="space-y-9">
          {readingBooks.length > 0 && categoriaAtiva === "Todas" && (
            <BookRow title="Continue lendo" books={readingBooks} />
          )}

          {prateleiras.length > 0 ? (
            prateleiras.map(({ categoria, livros }) => (
              <BookRow key={categoria} title={categoria} books={livros} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
              Nenhum livro nesta categoria ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
