import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookOpenIcon, StarIcon } from "@/lib/icons";
import { useData } from "../data/DataContext";

const SavedBookCard = memo(function SavedBookCard({ book }) {
  return (
    <Link
      to={`/app/livro/${book.id}`}
      className="group flex w-[180px] shrink-0 flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] transition-colors hover:border-blue-500/30 hover:bg-[var(--hover-overlay)] sm:w-[200px]"
    >
      <div className="aspect-[16/9] w-full overflow-hidden">
        <img
          src={book.image}
          alt={book.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-[var(--text-primary)]">
          {book.title}
        </h3>
        <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
          {book.autorNome || book.authorName}
        </p>
        {book.ratingCount > 0 ? (
          <div className="mt-1 flex items-center gap-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            <StarIcon className="size-2.5 text-amber-500" weight="fill" />
            <span>{book.nota?.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
});

export function MyListPage() {
  const { books, authors, isFavoriteBook } = useData();

  const autoresMap = useMemo(
    () => new Map(authors.map((a) => [a.id, a])),
    [authors]
  );

  const livrosComMeta = useMemo(
    () =>
      books.map((book) => ({
        ...book,
        autorNome: autoresMap.get(book.authorId)?.name || book.authorName || "",
      })),
    [books, autoresMap]
  );

  const savedBooks = useMemo(
    () => livrosComMeta.filter((b) => isFavoriteBook(b.id)),
    [livrosComMeta, isFavoriteBook]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Minha Lista</h1>
        <p className="text-xs text-[var(--text-muted)]">Livros que você salvou para ler</p>
      </div>

      {/* Saved books section */}
      {savedBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--bg-card)] py-16 text-center">
          <Bookmark className="mb-3 size-10 text-[var(--text-muted)]" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Sua lista está vazia
          </p>
          <p className="mt-1 max-w-[220px] text-xs text-[var(--text-muted)]">
            Salve livros clicando no ícone de marcador dentro do livro ou na
            página do livro.
          </p>
          <Link
            to="/app/biblioteca"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <BookOpenIcon className="size-3.5" />
            Explorar Biblioteca
          </Link>
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Salvos ({savedBooks.length})
            </h2>
          </div>
          <div
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-x-visible"
            style={{ scrollbarWidth: "none" }}
          >
            {savedBooks.map((book) => (
              <SavedBookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
