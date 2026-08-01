import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles, StarIcon } from "@/lib/icons";
import { useData } from "../data/DataContext";

const BookCard = memo(function BookCard({ book }) {
  return (
    <Link to={`/app/livro/${book.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)]">
        <img
          src={book.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      </div>
      <h3 className="mt-1.5 truncate text-[11px] font-semibold text-[var(--text-primary)] sm:text-xs">
        {book.title}
      </h3>
      <p className="truncate text-[10px] text-[var(--text-muted)] sm:text-[11px]">
        {book.autorNome || book.authorName}
      </p>
      {book.ratingCount > 0 ? (
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium text-[var(--text-secondary)] sm:text-[11px]">
          <StarIcon className="size-2.5 text-amber-500 sm:size-3" weight="fill" />
          <span>{book.nota.toFixed(1)}</span>
          <span className="text-[var(--text-muted)]">({book.ratingCount})</span>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] sm:text-[11px]">
          <StarIcon className="size-2.5 sm:size-3" />
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
      className="flex w-[200px] shrink-0 items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-2.5 transition-colors hover:bg-[var(--hover-overlay)] sm:w-[220px]"
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
        className="flex gap-2 overflow-x-auto pb-1 sm:gap-3"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
      >
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/app/livro/${book.id}`}
            className="w-[68px] shrink-0 sm:w-[88px] md:w-[100px]"
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

function FeaturedBook({ book }) {
  return (
    <Link
      to={`/app/livro/${book.id}`}
      className="block w-full shrink-0 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-colors hover:bg-[var(--hover-overlay)] sm:p-4 md:w-[44%]"
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="w-[100px] shrink-0 sm:w-[120px]">
          <div className="aspect-[2/3] overflow-hidden rounded-[8px]">
            <img src={book.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)] sm:text-base">
            {book.title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-[var(--text-muted)] sm:text-xs">
            {book.autorNome || book.authorName} (2024)
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)] sm:text-xs">
            {book.bio || "Descubra uma nova leitura selecionada pela nossa equipe."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 sm:text-xs">
            Ler mais <ArrowRight className="size-3" weight="bold" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LibraryPage() {
  const { books, authors } = useData();
  const [searchParams] = useSearchParams();
  const urlCategoria = searchParams.get("categoria");
  const [genero, setGenero] = useState(urlCategoria || "Todas");

  useEffect(() => {
    setGenero(urlCategoria || "Todas");
  }, [urlCategoria]);

  const autoresMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  const livrosComMeta = useMemo(() => books.map((book) => ({
    ...book,
    autorNome: autoresMap.get(book.authorId)?.name || book.authorName || "",
    progress: Number(book.progress || 0),
  })), [books, autoresMap]);

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
    <div className="space-y-6 sm:space-y-8">
      {destaque ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" weight="fill" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">Populares</h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
            <FeaturedBook book={destaque} />
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
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {grid.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </section>
      ) : (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">Nenhum livro encontrado.</p>
      )}

      {continueReading.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:text-lg">Continuar lendo</h2>
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
