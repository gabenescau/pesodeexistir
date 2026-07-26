import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import { useData } from "../data/DataContext";

export function ExplorePage() {
  const { books, authors, categories } = useData();
  const [query, setQuery] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);

  // Categorias vindas do banco (admin) + categorias em uso nos livros que ainda
  // não viraram tabela (texto legado). Evita deixar uma categoria fora do filtro.
  const categoriasDisponiveis = useMemo(() => {
    const setNomes = new Set(categories.map((c) => c.name));
    books.forEach((b) => { if (b.category) setNomes.add(b.category); });
    return [...setNomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [categories, books]);

  const termo = query.trim().toLowerCase();
  const buscaAtiva = termo.length > 0;

  const filteredAuthors = useMemo(() => {
    let lista = authors;
    if (buscaAtiva) {
      lista = lista.filter(a =>
        a.name.toLowerCase().includes(termo) ||
        (a.theme || "").toLowerCase().includes(termo)
      );
    }
    return lista;
  }, [authors, termo, buscaAtiva]);

  const filteredBooks = useMemo(() => {
    let lista = books;
    if (buscaAtiva) {
      lista = lista.filter(b =>
        b.title.toLowerCase().includes(termo) ||
        (b.authorName && b.authorName.toLowerCase().includes(termo)) ||
        (b.category || "").toLowerCase().includes(termo)
      );
    }
    if (categoriaAtiva) {
      lista = lista.filter(b => b.category === categoriaAtiva);
    }
    return lista;
  }, [books, termo, buscaAtiva, categoriaAtiva]);

  const limparFiltros = () => {
    setCategoriaAtiva(null);
    setQuery("");
  };
  const temFiltro = Boolean(categoriaAtiva) || buscaAtiva;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Explorar</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Descubra novos autores, livros e ideias.</p>
      </div>

      {/* Barra de pesquisa + botão de filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[var(--text-placeholder)]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar autores ou livros..."
            className="w-full h-10 sm:h-12 pl-11 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
        </div>
        <button
          onClick={() => setFiltroAberto(v => !v)}
          aria-label="Filtrar por categoria"
          aria-expanded={filtroAberto}
          className={`flex h-10 sm:h-12 shrink-0 items-center gap-2 rounded-[6px] border px-4 text-sm font-medium transition-colors ${
            filtroAberto || categoriaAtiva
              ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
              : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          }`}
        >
          <SlidersHorizontal className="size-[18px]" />
          <span className="hidden sm:inline">{categoriaAtiva ? "Filtro" : "Filtrar"}</span>
        </button>
      </div>

      {/* Painel de filtro por categoria (abaixo da barra, fecha ao tocar fora) */}
      {filtroAberto && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Categorias</p>
            {categoriaAtiva && (
              <button
                onClick={() => setCategoriaAtiva(null)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                <X className="size-3" /> Limpar categoria
              </button>
            )}
          </div>
          {categoriasDisponiveis.length > 0 ? (
            <div className="flex flex-wrap gap-2 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
              {categoriasDisponiveis.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaAtiva(prev => prev === cat ? null : cat)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                    categoriaAtiva === cat
                      ? "border-transparent bg-[var(--text-primary)] text-[var(--bg-card)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {categoriaAtiva === cat && <Check className="mr-1 inline size-3" />}
                  {cat}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Nenhuma categoria cadastrada ainda.</p>
          )}
        </div>
      )}

      {temFiltro && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{filteredBooks.length} livros · {filteredAuthors.length} autores</span>
          <button onClick={limparFiltros} className="hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors">
            <X className="size-3" /> Limpar filtros
          </button>
        </div>
      )}

      {filteredBooks.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Livros</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {filteredBooks.map(b => (
              <Link key={b.id} to={`/app/livro/${b.id}`} className="group cursor-pointer">
                <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
                  <img
                    src={b.image}
                    alt={b.title}
                    className="w-full h-full object-cover"
                  />
                  {b.category && (
                    <span className="absolute top-2 left-2 rounded-full bg-[var(--bg-card)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border)]">
                      {b.category}
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 truncate">{b.title}</h3>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{b.authorName}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Autores</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {filteredAuthors.map((a) => (
            <Link key={a.id} to={`/app/autor/${a.id}`} className="group cursor-pointer">
              <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
                <img
                  src={a.image}
                  alt={a.name}
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[var(--bg-card)] via-transparent to-transparent" />
                {a.theme && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-[var(--hover-overlay)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {a.theme}
                  </span>
                )}
              </div>
              <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 truncate">{a.name}</h3>
              {a.theme && <p className="text-[11px] text-[var(--text-muted)] truncate">{a.theme}</p>}
            </Link>
          ))}
        </div>
        {filteredAuthors.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nenhum autor encontrado.</p>
        )}
      </section>
    </div>
  );
}
