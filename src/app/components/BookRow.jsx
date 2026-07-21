import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function BookRow({ title, books }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">{title}</h2>
        <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-0.5 transition-colors">
          Ver todos <ChevronRight className="size-3" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0" style={{ scrollbarWidth: "none" }}>
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/app/livro/${book.id}`}
            className="group cursor-pointer w-28 sm:w-32 shrink-0"
          >
            <div className="aspect-[2/3] rounded-[8px] sm:rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
              <img
                src={book.image}
                alt={book.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-[var(--text-primary)]/0 group-hover:bg-[var(--text-primary)]/30 transition-colors duration-300" />
              {"progress" in book && book.progress != null && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--text-primary)]/20">
                  <div
                    className="h-full bg-[var(--text-primary)] transition-all"
                    style={{ width: `${book.progress}%` }}
                  />
                </div>
              )}
            </div>
            <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 truncate">{book.title}</h3>
            <p className="text-[11px] text-[var(--text-muted)] truncate">{book.authorName || book.author}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
