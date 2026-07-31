import { Link } from "react-router-dom";
import { useData } from "@/app/data/DataContext";

function AuthorAvatar({ author }) {
  const src = author.image;
  const isImage = src?.startsWith?.("http") || src?.startsWith?.("/") || src?.startsWith?.("data:");
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
      {isImage ? (
        <img src={src} alt={author.name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        author.initial
      )}
    </div>
  );
}

export function RightSidebar() {
  const { books, authors, posts } = useData();

  // Tags em alta: extrai #hashtags do texto dos posts e conta frequencia.
  // So aparece se pelo menos 2 usuarios usaram a mesma tag.
  const hashtagRegex = /#(\w+)/g;
  const tagCount = {};
  for (const post of posts) {
    const text = post.text || "";
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      const tag = `#${match[1]}`;
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const popularTags = Object.entries(tagCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // Autores em destaque: ordena por total de curtidas nos livros
  // (saved_posts = favoritos). So aparece quem tem pelo menos 1 like.
  const authorLikes = {};
  for (const book of books) {
    const authorId = book.author_id || book.authorId;
    if (authorId) {
      authorLikes[authorId] = (authorLikes[authorId] || 0) + (book.likes || 0);
    }
  }
  const featuredAuthors = authors
    .map((author) => ({
      ...author,
      works: books.filter((book) => (book.author_id || book.authorId) === author.id).length,
      totalLikes: authorLikes[author.id] || 0,
      initial: author.name?.charAt(0)?.toUpperCase() || "A",
    }))
    .filter((a) => a.totalLikes > 0)
    .sort((a, b) => b.totalLikes - a.totalLikes)
    .slice(0, 5);

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
            <Link
              key={author.id || author.name}
              to={`/app/autor/${author.id}`}
              className="group flex items-center gap-3"
            >
              <AuthorAvatar author={author} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-secondary)]">
                  {author.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{author.works} {author.works === 1 ? "obra" : "obras"}</p>
              </div>
            </Link>
          )) : (
            <p className="text-xs text-[var(--text-muted)]">Nenhum autor cadastrado.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
