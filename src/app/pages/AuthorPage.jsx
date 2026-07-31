import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, BookOpen, Heart, MessageCircle } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { EntityComments } from "../components/EntityComments";

export function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthorById, getBooksByAuthor, posts, toggleFavoriteAuthor, isFavoriteAuthor } = useData();
  const author = getAuthorById(id);
  const authorBooks = getBooksByAuthor(id);
  const isFav = author ? isFavoriteAuthor(author.id) : false;

  const authorBookIds = useMemo(() => new Set(authorBooks.map((b) => b.id)), [authorBooks]);
  const authorPosts = useMemo(
    () => posts.filter((p) => p.book_id && authorBookIds.has(p.book_id)),
    [posts, authorBookIds]
  );

  if (!author) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-muted)]">Autor nao encontrado.</p>
        <button onClick={() => navigate("/app/explorar")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para explorar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="size-4" /> Voltar
        </button>
        <button
          onClick={async () => { await toggleFavoriteAuthor(author.id); }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            isFav ? "border-[var(--text-primary)] bg-[var(--text-primary)]/10" : "border-[var(--border)] hover:bg-[var(--hover-overlay)]"
          }`}
          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={`size-4 ${isFav ? "text-[var(--text-primary)] fill-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
        </button>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="mx-auto w-full max-w-48 shrink-0 sm:mx-0 sm:w-48">
          <div className="aspect-[3/4] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
            <img src={author.image} alt={author.name} className="h-full w-full object-cover opacity-90" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{author.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{author.theme}</p>
          {author.era && (
            <span className="mt-2 inline-block rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {author.era}
            </span>
          )}
          {author.bio && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
              {author.bio}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="size-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Obras disponiveis ({authorBooks.length})</h3>
        </div>
        {authorBooks.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {authorBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => navigate(`/app/livro/${book.id}`)}
                className="text-left"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
                  <img
                    src={book.image}
                    alt={book.title}
                    className="h-full w-full object-cover"
                  />
                  {book.category && (
                    <span className="absolute left-2 top-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      {book.category}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 truncate text-xs font-medium text-[var(--text-primary)]">{book.title}</h3>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Nenhum livro cadastrado para este autor.</p>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="size-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discussoes recentes</h3>
        </div>
        {authorPosts.length > 0 ? (
          <div className="space-y-3">
            {authorPosts.slice(0, 20).map((post) => (
              <div
                key={post.id}
                className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4"
              >
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">{post.text}</p>
                {post.images && post.images.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {post.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  {post.book?.title ? `Sobre: ${post.book.title}` : "Discussao geral"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Ainda nao ha discussoes sobre obras deste autor. Seja o primeiro a publicar na comunidade.
          </p>
        )}
      </div>
    </div>
  );
}
