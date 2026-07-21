import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, TrendingUp } from "lucide-react";
import { useData } from "../data/DataContext";

export function ExplorePage() {
  const { books, authors } = useData();
  const [query, setQuery] = useState("");

  const filteredAuthors = query
    ? authors.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.theme.toLowerCase().includes(query.toLowerCase())
      )
    : authors;

  const filteredBooks = query
    ? books.filter(b =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        (b.authorName && b.authorName.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Explorar</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Descubra novos autores, livros e ideias.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[var(--text-placeholder)]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Pesquisar autores ou livros..."
          className="w-full h-10 sm:h-12 pl-11 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
        />
      </div>

      {query && filteredBooks.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Livros</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {filteredBooks.map(b => (
              <Link key={b.id} to={`/app/livro/${b.id}`} className="group cursor-pointer">
                <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
                  <img
                    src={b.image}
                    alt={b.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                  />
                </div>
                <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 truncate">{b.title}</h3>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{b.authorName}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="size-[18px] text-[var(--text-muted)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{query ? "Autores" : "Autores"}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {filteredAuthors.map((a) => (
            <Link key={a.id} to={`/app/autor/${a.id}`} className="group cursor-pointer">
              <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
                <img
                  src={a.image}
                  alt={a.name}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[var(--bg-card)] via-transparent to-transparent" />
                <span className="absolute bottom-2 left-2 text-[10px] font-medium text-[var(--text-secondary)] px-2 py-0.5 rounded-full bg-[var(--hover-overlay)] border border-[var(--border)]">
                  {a.theme}
                </span>
              </div>
              <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 truncate">{a.name}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{a.theme}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
