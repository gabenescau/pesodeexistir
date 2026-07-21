import { useState } from "react";
import { Search } from "lucide-react";
import { BookRow } from "../components/BookRow";
import { useData } from "../data/DataContext";

export function LibraryPage() {
  const { books, authors } = useData();
  const [query, setQuery] = useState("");

  const allBooks = books.map(b => ({
    ...b,
    authorName: authors.find(a => a.id === b.authorId)?.name || b.authorName || "",
    author: authors.find(a => a.id === b.authorId)?.name || b.authorName || "",
  }));

  const readingBooks = allBooks.filter(b => Number(b.progress || 0) > 0);

  const filteredBooks = query
    ? allBooks.filter(b =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.authorName.toLowerCase().includes(query.toLowerCase())
      )
    : allBooks;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Biblioteca</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{books.length} livros em nossa coleção.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[var(--text-placeholder)]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Pesquisar livros ou autores..."
          className="w-full h-10 sm:h-12 pl-11 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
        />
      </div>

      {readingBooks.length > 0 && <BookRow title="Continue lendo" books={readingBooks} />}
      <BookRow title={query ? "Resultados" : "Todos os livros"} books={filteredBooks} />
    </div>
  );
}
