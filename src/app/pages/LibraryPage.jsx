import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, StarIcon } from "@/lib/icons";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useData } from "../data/DataContext";
import { publicStorageUrl } from "@/lib/library-media";

const GRID_PAGE_SIZE = 24;

function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  for (let i = 2; i < total; i++) {
    if (Math.abs(i - current) <= 1) items.push(i);
    else if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
  }
  items.push(total);
  return items;
}

function BookCover({ src, storagePath, alt, title = "", className = "h-full w-full object-cover" }) {
  const stableSrc = storagePath ? publicStorageUrl("covers", storagePath) : "";
  const [source, setSource] = useState(src || stableSrc);
  const [error, setError] = useState(false);

  useEffect(() => {
    setSource(src || stableSrc);
    setError(false);
  }, [src, stableSrc]);

  if (error || !source) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg-canvas)] p-1.5 text-center">
        <span className="mb-0.5 text-[10px] font-bold text-[var(--accent-mint)] uppercase tracking-wider">OPE</span>
        <p className="line-clamp-2 text-[9px] font-semibold leading-tight text-[var(--text-secondary)]">{title || "Obra OPE"}</p>
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={alt || title || ""}
      loading="lazy"
      className={className}
      onError={() => {
        if (stableSrc && source !== stableSrc) setSource(stableSrc);
        else setError(true);
      }}
    />
  );
}

const BookCard = memo(function BookCard({ book }) {
  return (
    <Link to={`/app/livro/${book.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)]">
        <BookCover
          src={book.image}
          storagePath={book.image_path}
          title={book.title}
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
  const prog = Math.min(100, Math.max(0, Math.round(book.progress || 0)));
  return (
    <Link
      to={`/app/ler/${book.id}`}
      className="group flex w-[220px] shrink-0 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-all duration-200 hover:border-blue-500/30 hover:bg-[var(--hover-overlay)] sm:w-[250px]"
    >
      <div className="relative w-12 shrink-0 overflow-hidden rounded-[8px] border border-[var(--border)] aspect-[2/3]">
        <BookCover src={book.image} storagePath={book.image_path} title={book.title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-blue-500 transition-colors">{book.title}</h3>
        <p className="truncate text-[10px] text-[var(--text-muted)]">{book.autorNome || book.authorName}</p>
        <div className="pt-1">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-[var(--text-secondary)]">
            <span>Progresso</span>
            <span className="font-semibold text-[var(--text-primary)]">{prog}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-canvas)] border border-[var(--border)]/50">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${prog}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
});

const Top10Card = memo(function Top10Card({ book, rank }) {
  const isTop3 = rank <= 3;
  return (
    <Link to={`/app/livro/${book.id}`} className="group relative block shrink-0" style={{ width: "clamp(96px,26vw,136px)" }}>
      <span
        className="pointer-events-none absolute -left-2 -bottom-1 z-10 select-none font-black leading-none"
        style={{
          fontSize: isTop3 ? "72px" : "54px",
          fontFamily: "'Inter',sans-serif",
          color: isTop3 ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.10)",
          textShadow: isTop3 ? "0 2px 16px rgba(37,99,235,0.25)" : "0 1px 8px rgba(0,0,0,0.35)",
        }}
      >
        {rank}
      </span>
      <div className={`relative ml-5 overflow-hidden rounded-[10px] border bg-[var(--bg-card)] aspect-[2/3] transition-transform duration-200 group-hover:scale-[1.03] ${
        isTop3 ? "border-blue-500/40 shadow-[0_0_16px_rgba(37,99,235,0.18)]" : "border-[var(--border)]"
      }`}>
        <BookCover src={book.image} storagePath={book.image_path} title={book.title} />
        {isTop3 && <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-blue-950/70 to-transparent" />}
      </div>
      <p className="mt-1.5 ml-5 line-clamp-2 text-[10px] font-semibold leading-tight text-[var(--text-primary)] sm:text-[11px]">{book.title}</p>
    </Link>
  );
});



function FeaturedBook({ book }) {
  return (
    <Link
      to={`/app/livro/${book.id}`}
      className="block w-full shrink-0 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--hover-overlay)] sm:p-5"
    >
      <div className="flex gap-4 sm:gap-5">
        <div className="w-[100px] shrink-0 sm:w-[130px]">
          <div className="aspect-[2/3] overflow-hidden rounded-[8px]">
            <BookCover src={book.image} storagePath={book.image_path} title={book.title} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)] sm:text-base">
            {book.title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-[var(--text-muted)] sm:text-xs">
            {book.autorNome || book.authorName}
          </p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
            {book.bio || "Descubra uma nova leitura selecionada pela nossa equipe."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 sm:text-sm">
            Ler mais <ArrowRight className="size-3.5" weight="bold" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LibraryPage() {
  const {
    books,
    authors,
    loadMoreBooks,
    booksHasMore = false,
    booksLoadingMore = false,
  } = useData();
  const [searchParams] = useSearchParams();
  const urlCategoria = searchParams.get("categoria");
  const [genero, setGenero] = useState(urlCategoria || "Todas");
  const [gridPage, setGridPage] = useState(1);

  useEffect(() => {
    setGenero(urlCategoria || "Todas");
  }, [urlCategoria]);

  useEffect(() => {
    setGridPage(1);
  }, [genero]);

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

  const grid = useMemo(() => {
    if (genero === "Todas") return livrosComMeta;
    return livrosComMeta.filter((b) => b.category === genero);
  }, [livrosComMeta, genero]);

  const gridTotalPages = Math.max(1, Math.ceil(grid.length / GRID_PAGE_SIZE));
  const gridCurrentPage = Math.min(gridPage, gridTotalPages);
  const visibleGrid = grid.slice(
    (gridCurrentPage - 1) * GRID_PAGE_SIZE,
    gridCurrentPage * GRID_PAGE_SIZE
  );
  const gridPageItems = getPageItems(gridCurrentPage, gridTotalPages);

  const continueReading = useMemo(
    () => livrosComMeta.filter((b) => b.progress > 0 && b.progress < 100).slice(0, 8),
    [livrosComMeta]
  );

  const top10Ref = useRef(null);

  function scrollTop10(direction) {
    if (!top10Ref.current) return;
    const scrollAmount = direction === "left" ? -380 : 380;
    top10Ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  const top10 = useMemo(() => {
    const sorted = [...livrosComMeta].sort(
      (a, b) => (b.ratingCount || 0) - (a.ratingCount || 0) || (b.nota || 0) - (a.nota || 0)
    );
    return sorted.slice(0, 10);
  }, [livrosComMeta]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {destaque ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-4 w-[3px] rounded-full bg-blue-500" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">Populares</h2>
          </div>
          <FeaturedBook book={destaque} />
        </section>
      ) : null}

      {continueReading.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-[3px] rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">Continuar lendo</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{continueReading.length} {continueReading.length === 1 ? "obra em andamento" : "obras em andamento"}</span>
          </div>
          <div
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
            style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          >
            {continueReading.map((book) => (
              <div key={book.id} style={{ scrollSnapAlign: "start" }}>
                <ContinueCard book={book} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top 10 este mês — Netflix style com setas de navegação */}
      {top10.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-[3px] rounded-full bg-blue-500" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">Top 10 este mês</h2>
            </div>
            {/* Setas de navegacao para desktop/mobile */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollTop10("left")}
                className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors shadow-sm cursor-pointer"
                aria-label="Rolar para a esquerda"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTop10("right")}
                className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors shadow-sm cursor-pointer"
                aria-label="Rolar para a direita"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div
            ref={top10Ref}
            className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 scroll-smooth"
            style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
          >
            {top10.map((book, i) => (
              <div key={book.id} style={{ scrollSnapAlign: "start" }}>
                <Top10Card book={book} rank={i + 1} />
              </div>
            ))}
          </div>
        </section>
      )}

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
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visibleGrid.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </section>

          {gridTotalPages > 1 && (
            <Pagination className="pt-1">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    render={<button type="button" />}
                    disabled={gridCurrentPage === 1}
                    onClick={() => setGridPage(Math.max(1, gridCurrentPage - 1))}
                  />
                </PaginationItem>

                {gridPageItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        render={<button type="button" />}
                        isActive={item === gridCurrentPage}
                        onClick={() => setGridPage(item)}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    render={<button type="button" />}
                    disabled={gridCurrentPage === gridTotalPages}
                    onClick={() => setGridPage(Math.min(gridTotalPages, gridCurrentPage + 1))}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          {booksHasMore && (
            <button
              type="button"
              onClick={() => loadMoreBooks?.()}
              disabled={booksLoadingMore}
              className="mx-auto flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
            >
              {booksLoadingMore ? "Carregando livros..." : "Carregar mais livros"}
            </button>
          )}
        </>
      ) : (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">Nenhum livro encontrado.</p>
      )}


    </div>
  );
}
