import * as React from "react";
import { cn } from "@/lib/utils";
import { CaretLeft, CaretRight } from "@/lib/icons";

function buildRange(current, total) {
  const siblings = 1;
  const range = [];
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);

  range.push(1);
  if (left > 2) range.push("...");
  for (let page = left; page <= right; page += 1) range.push(page);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);
  return range;
}

export function Pagination({ currentPage, totalPages, onPageChange, className, siblingCount = 1 }) {
  if (totalPages <= 1) return null;
  const items = buildRange(currentPage, totalPages);
  const previousDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  function go(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  }

  return (
    <nav
      role="navigation"
      aria-label="Paginacao"
      className={cn("flex items-center justify-center gap-1", className)}
    >
      <button
        type="button"
        aria-label="Pagina anterior"
        onClick={() => go(currentPage - 1)}
        disabled={previousDisabled}
        className="flex h-9 items-center gap-1 rounded-[8px] border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] disabled:opacity-40"
      >
        <CaretLeft className="size-3.5" weight="bold" />
        <span className="hidden sm:inline">Anterior</span>
      </button>
      {items.map((item, index) =>
        item === "..." ? (
          <span key={`ellipsis-${index}`} className="px-1 text-xs text-[var(--text-muted)]">...</span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Pagina ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            onClick={() => go(item)}
            className={cn(
              "flex size-9 items-center justify-center rounded-[8px] text-xs transition-colors",
              item === currentPage
                ? "bg-[var(--accent-mint)] text-[#111] font-semibold"
                : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            )}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="Proxima pagina"
        onClick={() => go(currentPage + 1)}
        disabled={nextDisabled}
        className="flex h-9 items-center gap-1 rounded-[8px] border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] disabled:opacity-40"
      >
        <span className="hidden sm:inline">Proxima</span>
        <CaretRight className="size-3.5" weight="bold" />
      </button>
    </nav>
  );
}
