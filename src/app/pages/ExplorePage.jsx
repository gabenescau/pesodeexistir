import { memo, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Bookmark, Crown, Search, Sparkles, StarIcon } from "@/lib/icons";
import { useData } from "../data/DataContext";

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PLAN_BADGE = {
  destaque: { label: "Destaque", Icon: Sparkles, cls: "bg-amber-100 text-amber-700" },
  gratis: { label: "Gratis", Icon: Bookmark, cls: "bg-emerald-100 text-emerald-700" },
  premium: { label: "Premium", Icon: Crown, cls: "bg-violet-100 text-violet-700" },
};

const BookCard = memo(function BookCard({ book }) {
  const meta = book.destaque ? PLAN_BADGE.destaque : PLAN_BADGE[book.plano] || PLAN_BADGE.premium;
  return (
    <Link to={`/app/livro/${book.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
        <img
          src={book.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
          <meta.Icon className="size-3" weight="fill" />
          {meta.label}
        </span>
        {book.category ? (
          <span className="absolute right-2 top-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            {book.category}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-start gap-1.5">
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{book.title}</h3>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          <StarIcon className="size-3 text-amber-500" weight="fill" />
          {book.nota.toFixed(1)}
        </span>
      </div>
      <p className="truncate text-[11px] text-[var(--text-muted)]">{book.autorNome || book.authorName}</p>
    </Link>
  );
});

const TABS = [
  { key: "tudo", label: "Tudo" },
  { key: "gratis", label: "Gratis" },
  { key: "premium", label: "Premium" },
  { key: "autor", label: "Autor" },
  { key: "genero", label: "Genero" },
];

export function ExplorePage() {
  const { books, authors, categories } = useData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("tudo");
  const [autorSelecionado, setAutorSelecionado] = useState(null);
  const [generoSelecionado, setGeneroSelecionado] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const deferredQuery = useDeferredValue(query);
  const termo = deferredQuery.trim().toLowerCase();

  const authorsMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  const categoriasDisponiveis = useMemo(() => {
    const nomes = new Set(categories.map((c) => c.name));
    for (const book of books) if (book.category) nomes.add(book.category);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [categories, books]);

  const autoresDisponiveis = useMemo(() => {
    const ids = new Set();
    for (const book of books) if (book.authorId) ids.add(book.authorId);
    return authors
      .filter((a) => ids.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [authors, books]);

  const livrosComMeta = useMemo(() => books.map((book) => {
    const h = hashCode(book.id || book.title || "");
    return {
      ...book,
      plano: h % 2 === 0 ? "gratis" : "premium",
      destaque: h % 7 === 0,
      nota: 3.8 + (h % 13) / 10,
      autorNome: authorsMap.get(book.authorId)?.name || book.authorName || "",
    };
  }), [books, authorsMap]);

  const filtrados = useMemo(() => {
    let lista = livrosComMeta;
    if (tab === "gratis") lista = lista.filter((b) => b.plano === "gratis");
    else if (tab === "premium") lista = lista.filter((b) => b.plano === "premium");
    else if (tab === "autor" && autorSelecionado) {
      lista = lista.filter((b) => b.authorId === autorSelecionado);
    } else if (tab === "genero" && generoSelecionado) {
      lista = lista.filter((b) => b.category === generoSelecionado);
    }
    if (termo) {
      lista = lista.filter(
        (b) =>
          b.title.toLowerCase().includes(termo) ||
          b.autorNome.toLowerCase().includes(termo) ||
          (b.category || "").toLowerCase().includes(termo)
      );
    }
    return [...lista].sort((a, b) => (sortAsc ? a.title : b.title).localeCompare(sortAsc ? b.title : a.title, "pt"));
  }, [livrosComMeta, tab, autorSelecionado, generoSelecionado, termo, sortAsc]);

  function selectTab(key) {
    setTab(key);
    if (key !== "autor") setAutorSelecionado(null);
    if (key !== "genero") setGeneroSelecionado(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--text-placeholder)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar livros"
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg-card)] pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setSortAsc((value) => !value)}
          aria-label={sortAsc ? "Ordenar Z-A" : "Ordenar A-Z"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)]"
        >
          <ArrowUpDown className="size-[18px]" />
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTab(item.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "autor" || tab === "genero" ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {tab === "autor" ? (
            <>
              <SecondaryChip active={!autorSelecionado} onClick={() => setAutorSelecionado(null)}>
                Todos
              </SecondaryChip>
              {autoresDisponiveis.map((autor) => (
                <SecondaryChip
                  key={autor.id}
                  active={autorSelecionado === autor.id}
                  onClick={() => setAutorSelecionado((current) => (current === autor.id ? null : autor.id))}
                >
                  {autor.name}
                </SecondaryChip>
              ))}
            </>
          ) : (
            <>
              <SecondaryChip active={!generoSelecionado} onClick={() => setGeneroSelecionado(null)}>
                Todas
              </SecondaryChip>
              {categoriasDisponiveis.map((categoria) => (
                <SecondaryChip
                  key={categoria}
                  active={generoSelecionado === categoria}
                  onClick={() => setGeneroSelecionado((current) => (current === categoria ? null : categoria))}
                >
                  {categoria}
                </SecondaryChip>
              ))}
            </>
          )}
        </div>
      ) : null}

      {filtrados.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtrados.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">Nenhum livro encontrado.</p>
      )}
    </div>
  );
}

function SecondaryChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
          : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
      }`}
    >
      {children}
    </button>
  );
}
