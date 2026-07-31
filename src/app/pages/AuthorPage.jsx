import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft, Heart, MessageCircle, Send, X } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { useAuth } from "../data/AuthContext";
import { canUsePaidSocialFeatures } from "@/lib/entitlements";
import { sanitizePlainText } from "@/lib/sanitize";
import { PostCard } from "../components/PostCard";
import { SubscribeModal } from "../components/SubscribeModal";

function Avatar({ src, fallback, className = "size-11" }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http") || src?.startsWith?.("/"));
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]`}>
      {isImage ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : <div className="flex h-full w-full items-center justify-center">{fallback}</div>}
    </div>
  );
}

export function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { getAuthorById, getBooksByAuthor, posts, toggleFavoriteAuthor, isFavoriteAuthor, addPost, deletePost, subscription } = useData();
  const author = getAuthorById(id);
  const authorBooks = getBooksByAuthor(id);
  const isFav = author ? isFavoriteAuthor(author.id) : false;

  const [texto, setTexto] = useState("");
  const [livroId, setLivroId] = useState(null);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState("");
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const canPublish = canUsePaidSocialFeatures({ isAdmin, subscription });
  const nome = profile?.name || user?.user_metadata?.name || "Você";
  const avatar = profile?.avatar || user?.user_metadata?.avatar_url;
  const inicial = nome.charAt(0).toUpperCase();
  const livroSelecionado = livroId || authorBooks[0]?.id || null;

  const authorBookIds = useMemo(() => new Set(authorBooks.map((b) => b.id)), [authorBooks]);
  const authorPosts = useMemo(
    () => posts.filter((p) => p.book_id && authorBookIds.has(p.book_id)),
    [posts, authorBookIds]
  );

  async function publicar() {
    if (!canPublish) {
      setSubscribeOpen(true);
      return;
    }
    const clean = sanitizePlainText(texto, 5000);
    if (!clean || publicando) return;
    setPublicando(true);
    setErro("");
    try {
      await addPost({
        userId: user?.id,
        text: clean,
        tag: null,
        bookId: livroSelecionado,
        author: nome,
        avatar: avatar || inicial,
      });
      setTexto("");
    } catch (err) {
      setErro(err?.message || "Não foi possível publicar a discussão.");
    } finally {
      setPublicando(false);
    }
  }

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

        {authorBooks.length > 0 && (
          <div className="mb-4 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex items-start gap-3">
              <Avatar src={avatar} fallback={inicial} />
              <textarea
                value={texto}
                onChange={(event) => setTexto(event.target.value.slice(0, 5000))}
                rows={2}
                placeholder={`Discuta as obras de ${author.name}...`}
                className="min-h-20 min-w-0 flex-1 resize-none rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)]"
              />
            </div>

            {authorBooks.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {authorBooks.slice(0, 6).map((book) => {
                  const ativo = book.id === livroSelecionado;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setLivroId(ativo ? null : book.id)}
                      className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        ativo
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)]/10 font-medium text-[var(--text-primary)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="truncate">{book.title}</span>
                      {ativo && <X className="size-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--text-muted)]">
                Publicado na comunidade vinculado à obra selecionada.
              </p>
              <button
                type="button"
                onClick={publicar}
                disabled={publicando || !texto.trim()}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="size-4" />
                {publicando ? "Publicando..." : "Publicar"}
              </button>
            </div>
            {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
          </div>
        )}

        {authorPosts.length > 0 ? (
          <div className="space-y-3">
            {authorPosts.slice(0, 20).map((post) => (
              <PostCard key={post.id} post={post} onDelete={deletePost} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Ainda nao ha discussoes sobre obras deste autor. Publique a primeira acima.
          </p>
        )}
      </div>

      <SubscribeModal
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        title="Membros pagantes"
        description="Postar na comunidade é um recurso exclusivo de quem assina o OPE Club. Você pode continuar lendo e curtindo tudo de graça."
        benefits={[
          "Publicar posts na comunidade",
          "Comentar e responder conversas",
          "Participar dos clubes de leitura",
          "Acessar a biblioteca completa",
          "Receber lancamentos semanais",
        ]}
      />
    </div>
  );
}
