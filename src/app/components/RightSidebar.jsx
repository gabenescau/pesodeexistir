import { useData } from "@/app/data/DataContext";

export function RightSidebar() {
  const { books, authors, posts } = useData();

  const popularTags = Object.entries(
    posts
      .map((post) => post.tag)
      .filter(Boolean)
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => (tag.startsWith("#") ? tag : `#${tag}`));

  const featuredAuthors = authors.slice(0, 3).map((author) => ({
    ...author,
    works: books.filter((book) => (book.author_id || book.authorId) === author.id).length,
    initial: author.name?.charAt(0)?.toUpperCase() || "A",
  }));

  const featuredBooks = books.slice(0, 3);

  return (
    <aside className="hidden w-[260px] shrink-0 space-y-5 2xl:block">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Comunidade
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
          Biblioteca e comunidade conectadas aos dados cadastrados no projeto.
        </p>
        <div className="space-y-3 text-sm">
          {[
            { label: "Autores", value: authors.length },
            { label: "Livros", value: books.length },
            { label: "Discussões", value: posts.length, highlight: true },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{s.label}</span>
              <span className={`font-medium ${s.highlight ? "text-[var(--accent-mint)]" : "text-[var(--text-primary)]"}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Tags em alta
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(popularTags.length ? popularTags : ["Sem tags ainda"]).map((tag) => (
            <span
              key={tag}
              className="cursor-pointer rounded-[6px] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Autores em destaque
        </h3>
        <div className="space-y-3">
          {featuredAuthors.length ? featuredAuthors.map((author) => (
            <div key={author.id || author.name} className="group flex cursor-pointer items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
                {author.initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-secondary)]">
                  {author.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{author.works} obras</p>
              </div>
            </div>
          )) : (
            <p className="text-xs text-[var(--text-muted)]">Nenhum autor cadastrado.</p>
          )}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Livros cadastrados
        </h3>
        <div className="space-y-3">
          {featuredBooks.length ? featuredBooks.map((book) => (
            <div
              key={book.id || book.title}
              className="cursor-pointer text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              {book.title}
            </div>
          )) : (
            <p className="text-xs text-[var(--text-muted)]">Nenhum livro cadastrado.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
