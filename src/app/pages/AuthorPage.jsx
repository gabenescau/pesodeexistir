import { memo, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, MoreHorizontal, Share2, StarIcon, Users } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { CreatePost } from "../components/CreatePost";
import { PostCard } from "../components/PostCard";
import { AuthorShareModal } from "../components/AuthorShareModal";

function formatStat(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n > 0) return `${n}+`;
  return "0";
}

const AuthorBookCard = memo(function AuthorBookCard({ book, authorName }) {
  return (
    <Link to={`/app/livro/${book.id}`} className="w-[140px] shrink-0">
      <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)]">
        <img src={book.image} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
      <h3 className="mt-2 truncate text-xs font-semibold text-[var(--text-primary)]">{book.title}</h3>
      <p className="truncate text-[10px] text-[var(--text-muted)]">por {authorName}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        {book.ratingCount > 0 ? (
          <span className="flex items-center gap-0.5 font-medium text-[var(--text-secondary)]">
            <StarIcon className="size-3 text-amber-500" weight="fill" />
            {book.nota.toFixed(1)}
          </span>
        ) : null}
        <span className="flex items-center gap-0.5 text-[var(--text-muted)]">
          <BookOpen className="size-3" />
          Ebook
        </span>
      </div>
    </Link>
  );
});

function SectionHeader({ title, onSeeAll }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          aria-label="Ver tudo"
          className="flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <ArrowRight className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

const TABS = [
  { key: "bookshelf", label: "ESTANTE" },
  { key: "updates", label: "ATUALIZACOES" },
  { key: "biography", label: "BIOGRAFIA" },
  { key: "discussions", label: "DISCUSSOES" },
];

export function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getAuthorById,
    getBooksByAuthor,
    posts,
    deletePost,
    books,
    bookFavorites,
    toggleFavoriteAuthor,
    isFavoriteAuthor,
  } = useData();
  const author = getAuthorById(id);
  const authorBooks = getBooksByAuthor(id);
  const isFav = author ? isFavoriteAuthor(author.id) : false;
  const [abaAtiva, setAbaAtiva] = useState("bookshelf");
  const [shareOpen, setShareOpen] = useState(false);

  const authorPosts = useMemo(
    () => posts.filter((p) => p.tag === `entity-thread:author:${id}`),
    [posts, id]
  );

  const livrosComMeta = useMemo(() => authorBooks, [authorBooks]);

  const authorBookIds = useMemo(() => new Set(authorBooks.map((b) => b.id)), [authorBooks]);

  // Related books: same category as the author's books, best rated first,
  // excluding the author's own books.
  const relatedBooks = useMemo(() => {
    const categorias = new Set(authorBooks.map((b) => b.category).filter(Boolean));
    if (categorias.size === 0) return [];
    return books
      .filter((b) => categorias.has(b.category) && !authorBookIds.has(b.id))
      .sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0) || (b.nota || 0) - (a.nota || 0))
      .slice(0, 8);
  }, [books, authorBooks, authorBookIds]);

  const stats = useMemo(() => ({
    livros: authorBooks.length,
    // Reviews: posts about this author's books (each post is a discussion/review).
    reviews: authorPosts.length,
    // Seguidores: how many of this author's books users have favorited (proxy).
    seguidores: authorBooks.reduce(
      (total, book) => total + (bookFavorites.includes(book.id) ? 1 : 0),
      0
    ),
  }), [authorBooks, authorPosts, bookFavorites]);

  if (!author) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-muted)]">Autor nao encontrado.</p>
        <button
          onClick={() => navigate("/app/explorar")}
          className="mt-4 text-sm text-[var(--text-primary)] hover:underline"
        >
          Voltar para explorar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Detalhes do autor</h1>
        <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Compartilhar autor"
          className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <Share2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Mais opcoes"
          className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <MoreHorizontal className="size-5" />
        </button>
        </div>
      </div>

      <section className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)]">
          {author.image ? (
            <img src={author.image} alt={author.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--text-muted)]">
              {author.name?.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-[var(--text-primary)]">{author.name}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            {author.era || "Brasil"}
          </p>
          <button
            type="button"
            onClick={() => toggleFavoriteAuthor(author.id)}
            className={`mt-2 inline-flex h-8 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors ${
              isFav
                ? "border border-emerald-500 text-emerald-600 hover:bg-emerald-500/10"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {isFav ? "SEGUINDO" : "SEGUIR"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <BookOpen className="mx-auto size-4 text-[var(--text-muted)]" />
          <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{formatStat(stats.livros)}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Livros</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <StarIcon className="mx-auto size-4 text-amber-500" weight="fill" />
          <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{formatStat(stats.reviews)}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Avaliacoes</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
          <Users className="mx-auto size-4 text-[var(--text-muted)]" />
          <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{formatStat(stats.seguidores)}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Seguidores</p>
        </div>
      </section>

      <div className="border-b border-[var(--border)]">
        <div className="-mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {TABS.map((tab) => {
            const active = abaAtiva === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAbaAtiva(tab.key)}
                className={`relative shrink-0 pb-3 text-xs font-semibold tracking-wide transition-colors ${
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tab.label}
                {active ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--text-primary)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {abaAtiva === "bookshelf" ? (
        <div className="space-y-6">
          <section>
            <SectionHeader title="Livros em destaque" />
            {livrosComMeta.length > 0 ? (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
                {livrosComMeta.map((book) => (
                  <AuthorBookCard key={book.id} book={book} authorName={author.name} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Nenhum livro cadastrado para este autor.</p>
            )}
          </section>

          {relatedBooks.length > 0 ? (
            <section>
              <SectionHeader title="Voce pode gostar" />
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
                {relatedBooks.map((book) => (
                  <AuthorBookCard
                    key={book.id}
                    book={book}
                    authorName={book.authorName || book.author || ""}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : abaAtiva === "updates" ? (
        authorPosts.length > 0 ? (
          <section className="space-y-3">
            {authorPosts.slice(0, 10).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={deletePost}
              />
            ))}
          </section>
        ) : (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            Nenhuma atualizacao sobre este autor ainda.
          </p>
        )
      ) : abaAtiva === "discussions" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Discussoes sobre o autor</h2>
              <p className="text-xs text-[var(--text-muted)]">Postagens da comunidade sobre {author.name}.</p>
            </div>
            <CreatePost tag={`entity-thread:author:${author.id}`} />
          </div>
          {authorPosts.length > 0 ? (
            <div className="space-y-4">
              {authorPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={deletePost}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-[12px] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
              Ainda nao ha discussoes sobre este autor. Seja a primeira pessoa a postar.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
          {author.bio ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
              {author.bio}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Biografia indisponivel.</p>
          )}
          {author.theme ? (
            <p className="mt-4 text-xs text-[var(--text-muted)]">Tema: {author.theme}</p>
          ) : null}
          {author.era ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Epoca: {author.era}</p>
          ) : null}
        </section>
      )}
      <AuthorShareModal author={author} books={authorBooks} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
