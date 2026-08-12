import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "@/lib/icons";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 12;

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

export function AuthorsPage() {
  const {
    authors,
    loadMoreAuthors,
    authorsHasMore = false,
    authorsLoadingMore = false,
  } = useData();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebouncedValue(query, 350);
  const termo = debouncedQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!termo) return authors;
    return authors.filter(
      (a) =>
        a.name.toLowerCase().includes(termo) ||
        (a.theme || "").toLowerCase().includes(termo) ||
        (a.era || "").toLowerCase().includes(termo)
    );
  }, [authors, termo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Autores</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{authors.length} autores em nossa coleção de filosofia e literatura.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--text-placeholder)]" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar autores por nome ou tema..."
          className="h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)] sm:h-12"
        />
      </div>

      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((a) => (
              <Link key={a.id} to={`/app/autor/${a.id}`} className="group cursor-pointer">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
                  <img
                    src={a.image}
                    alt={a.name}
                    className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[var(--bg-card)] via-transparent to-transparent" />
                  {a.theme && (
                    <span className="absolute bottom-2 left-2 rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      {a.theme}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 truncate text-xs font-medium text-[var(--text-primary)]">{a.name}</h3>
                {a.theme && <p className="truncate text-[11px] text-[var(--text-muted)]">{a.theme}</p>}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="pt-1">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    render={<button type="button" />}
                    disabled={currentPage === 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                  />
                </PaginationItem>

                {pageItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        render={<button type="button" />}
                        isActive={item === currentPage}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    render={<button type="button" />}
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          {authorsHasMore && (
            <button
              type="button"
              onClick={() => loadMoreAuthors?.()}
              disabled={authorsLoadingMore}
              className="mx-auto flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-60"
            >
              {authorsLoadingMore ? "Carregando autores..." : "Carregar mais autores"}
            </button>
          )}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">Nenhum autor encontrado.</p>
      )}
    </div>
  );
}
