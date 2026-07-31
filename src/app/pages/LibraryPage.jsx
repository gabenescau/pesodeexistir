import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Bookmark, Crown, Sparkles, StarIcon } from "@/lib/icons";
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
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)]">
        <img
          src={book.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        <span className={`absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${meta.cls}`}>
          <meta.Icon className="size-2.5" weight="fill" />
          {meta.label}
        </span>
      </div>
      <h3 className="mt-1.5 truncate text-[11px] font-semibold text-[var(--text-primary)]">{book.title}</h3>
      <p className="truncate text-[10px] text-[var(--text-muted)]">{book.autorNome || book.authorName}</p>
      {book.ratingCount > 0 ? (
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          <StarIcon className="size-2.5 text-amber-500" weight="fill" />
          <span>{book.nota.toFixed(1)}</span>
          <span className="text-[var(--text-muted)]">({book.ratingCount})</span>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
          <StarIcon className="size-2.5" />
          <span>Sem avaliacoes</span>
        </div>
      )}
    </Link>
  );
});

const ContinueCard = memo(function ContinueCard({ book }) {
  return (
    <Link
      to={`/app/livro/${book.id}`}
      className="flex w-[220px] shrink-0 items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-2.5 transition-colors hover:bg-[var(--hover-overlay)]"
    >
      <div className="w-12 shrink-0 overflow-hidden rounded-[6px] border border-[var(--border)]">
        <div className="aspect-[2/3]">
          <img src={book.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-xs font-semibold text-[var(--text-primary)]">{book.title}</h3>
        <p className="truncate text-[10px] text-[var(--text-muted)]">{book.autorNome || book.authorName}</p>
        <div className="mt-1 flex items-center gap-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          <StarIcon className="size-3 text-amber-500" weight="fill" />
          <span>{book.ratingCount > 0 ? book.nota.toFixed(1) : "—"}</span>
        </div>
      </div>
    </Link>
  );
});

function PopularCarousel({ books }) {
  const ref = useRef(null);
  const [page, setPage] = useState(0);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    setPage(Math.min(3, Math.max(0, Math.round((el.scrollLeft / max) * 3))));
  }

  return (
    <div className="min-w-0 flex-1">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
      >
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/app/livro/${book.id}`}
            className="w-[68px] shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="aspect-[2/3] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)]">
              <img src={book.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`size-1.5 rounded-full transition-colors ${
              index === page ? "bg-[var(--text-primary)]" : "bg-[var(--border-strong)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function LibraryPage() {
  const { books, authors, categories } = useData();
  const [searchParams] = useSearchParams();
  const urlCategoria = searchParams.get("categoria");
  const [genero, setGenero] = useState(urlCategoria || "Todas");

  // Categoria vinda do menu superior (?categoria=...): mantem a filtragem
  // sincronizada quando o usuario troca de categoria sem sair da pagina.
  useEffect(() => {
    setGenero(urlCategoria || "Todas");
  }, [urlCategoria]);

  const autoresMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  const livrosComMeta = useMemo(() => books.map((book) => {
    const h = hashCode(book.id || book.title || "");
    return {
      ...book,
      autorNome: autoresMap.get(book.authorId)?.name || book.authorName || "",
      plano: h % 2 === 0 ? "gratis" : "premium",
      destaque: h % 7 === 0,
      progress: Number(book.progress || 0),
    };
  }), [books, autoresMap]);

  // "Popular": livros com mais avaliacoes em primeiro (nota real).
  const popular = useMemo(() => {
    const comNota = [...livrosComMeta].sort(
      (a, b) => (b.ratingCount || 0) - (a.ratingCount || 0) || (b.nota || 0) - (a.nota || 0)
    );
    return comNota.slice(0, 6);
  }, [livrosComMeta]);

  const categorias = useMemo(() => {
    const nomes = new Set();
    for (const book of books) if (book.category) nomes.add(book.category);
    return ["Todas", ...[...nomes].sort((a, b) => a.localeCompare(b, "pt"))];
  }, [books]);

  const destaque = popular[0];
  const carouselBooks = useMemo(() => popular.slice(1, 6), [popular]);

  const grid = useMemo(() => {
    if (genero === "Todas") return livrosComMeta;
    return livrosComMeta.filter((b) => b.category === genero);
  }, [livrosComMeta, genero]);

  const continueReading = useMemo(
    () => livrosComMeta.filter((b) => b.progress > 0 && b.progress < 100).slice(0, 8),
    [livrosComMeta]
  );

  return (
    <div className="space-y-6">
      {destaque ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" weight="fill" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Popular</h2>
          </div>
          <div className="flex items-stretch gap-3">
            <Link
              to={`/app/livro/${destaque.id}`}
              className="w-[40%] shrink-0 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-colors hover:bg-[var(--hover-overlay)]"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-[8px]">
                <img src={destaque.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <h3 className="mt-2 truncate text-xs font-semibold text-[var(--text-primary)]">
                {destaque.title}
              </h3>
              <p className="truncate text-[10px] text-[var(--text-muted)]">
                {destaque.autorNome || destaque.authorName} (2024)
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                Read More <ArrowRight className="size-3" weight="bold" />
              </span>
            </Link>
            {carouselBooks.length > 0 ? <PopularCarousel books={carouselBooks} /> : null}
          </div>
        </section>
      ) : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        {categorias.map((categoria) => {
          const active = genero === categoria;
          return (
            <button
              key={categoria}
              type="button"
              onClick={() => setGenero(categoria)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              {categoria === "Todas" ? "Todos" : categoria}
            </button>
          );
        })}
      </div>

      {grid.length > 0 ? (
        <section className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {grid.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </section>
      ) : (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">Nenhum livro encontrado.</p>
      )}

      {continueReading.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Continue Reading</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
            {continueReading.map((book) => (
              <ContinueCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
