import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Bookmark as BookmarkIcon, ChevronLeft, Lock, Share2, StarIcon, Globe as GlobeIcon } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";
import { relatedBooks as recomendarLivros } from "@/lib/recommendations";
import { CreatePost } from "../components/CreatePost";
import { PostCard } from "../components/PostCard";

const DEFAULT_LANGUAGE = "Portugues";

function StarButton({ value, active, onRate }) {
  return (
    <button
      type="button"
      onClick={() => onRate(value)}
      aria-label={`Avaliar com ${value} estrela${value > 1 ? "s" : ""}`}
      className="p-0.5"
    >
      <StarIcon
        weight={active ? "fill" : "regular"}
        className={`size-6 transition-colors ${
          active ? "text-amber-400" : "text-[var(--border-strong)]"
        }`}
      />
    </button>
  );
}

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getBookById, getAuthorById, getReleaseStatus, toggleFavoriteBook,
    isFavoriteBook, books, rateBook, myBookRating, bookRatingStats,
    posts, deletePost,
  } = useData();
  const book = getBookById(id);
  const release = getReleaseStatus(id);

  if (!book) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-muted)]">Livro nao encontrado.</p>
        <button onClick={() => navigate("/app/biblioteca")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para biblioteca
        </button>
      </div>
    );
  }

  const author = getAuthorById(book.authorId || book.author_id);
  const hasPdf = Boolean(book.pdfFile || book.pdf_url);
  const favoritado = isFavoriteBook(book.id);
  const progresso = Number(book.progress || 0);
  const isCompleted = progresso >= 100;
  const status = isCompleted ? "Concluido" : progresso > 0 ? "Em leitura" : "Nao iniciado";
  const language = book.language || DEFAULT_LANGUAGE;
  const totalPages = book.totalPages || book.total_pages;

  // Livros com a nota reativa (para os cards relacionados atualizarem na hora).
  const livrosComNotaViva = useMemo(() => {
    return books.map((b) => {
      const stats = bookRatingStats[b.id];
      if (!stats || stats.count === 0) return { ...b, nota: b.nota || 0, ratingCount: b.ratingCount || 0 };
      return {
        ...b,
        nota: Math.round((stats.sum / stats.count) * 10) / 10,
        ratingCount: stats.count,
      };
    });
  }, [books, bookRatingStats]);

  const relatedBooks = recomendarLivros(livrosComNotaViva, book);

  const bookPosts = useMemo(() => {
    return posts.filter(
      (p) => p.tag === `entity-thread:book:${book.id}`
    );
  }, [posts, book.id]);

  const minhaNota = myBookRating(book.id);
  const statsDesteLivro = bookRatingStats[book.id];
  const notaMedia = statsDesteLivro && statsDesteLivro.count > 0
    ? Math.round((statsDesteLivro.sum / statsDesteLivro.count) * 10) / 10
    : 0;
  const totalAvaliacoes = statsDesteLivro?.count || 0;

  function handleStartReading() {
    if (hasPdf && release.liberado) {
      navigate(`/app/ler/${book.id}`);
    }
  }

  function handleRate(valor) {
    rateBook(book.id, valor).catch(() => {});
  }

  async function handleShare() {
    const shareData = {
      title: book.title,
      text: author ? `${book.title} — ${author.name}` : book.title,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {}
  }

  const ctaLabel = !hasPdf || !release.liberado
    ? "Indisponivel"
    : isCompleted ? "Continuar lendo"
    : progresso > 0 ? "Lendo agora"
    : "Comecar a ler";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header sticky com botoes voltar / mais opcoes */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-[var(--bg-page)] px-4 py-3 sm:px-0">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5 text-[var(--text-primary)]" />
        </button>
        <button
          onClick={handleShare}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Compartilhar"
        >
          <Share2 className="size-5 text-[var(--text-primary)]" />
        </button>
      </div>

      {/* Hero centralizado: capa grande, titulo e autor */}
      <div className="mx-auto w-full max-w-md px-4 pb-5 sm:max-w-lg sm:px-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-balance text-[20px] font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[22px]">
            {book.title}
          </h1>
          {author && (
            <Link
              to={`/app/autor/${author.id}`}
              className="mt-1.5 text-sm text-[var(--text-secondary)] hover:underline"
            >
              {author.name}
            </Link>
          )}

          {/* Capa do livro (centralizada, com sombra) */}
          <div className="mt-6 w-[58%] max-w-[260px] sm:mt-8 sm:w-[52%] sm:max-w-[300px]">
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
              <div className="aspect-[2/3]">
                <img
                  src={book.image}
                  alt={book.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Metadados do livro (status, categoria, tags) */}
          <div className="mt-5 flex flex-col items-center gap-1.5 text-[13px] text-[var(--text-secondary)] sm:text-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-[var(--text-muted)]" />
              {status}
            </div>
            {book.category && (
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
                {book.category}
              </div>
            )}
          </div>

          {book.tag && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {book.tag.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bloco de estatisticas: Rating / Language / Pages */}
      <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-3 px-4 sm:max-w-lg sm:px-6">
        <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] py-3">
          <StarIcon className="size-4 text-amber-500" weight="fill" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {notaMedia > 0 ? notaMedia.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Avaliacao</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] py-3">
          <GlobeIcon className="size-4 text-[var(--text-muted)]" />
          <p className="truncate px-1 text-sm font-semibold text-[var(--text-primary)]">{language}</p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Idioma</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] py-3">
          <BookOpen className="size-4 text-[var(--text-muted)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {totalPages || "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Paginas</p>
        </div>
      </div>

      {/* Avaliacao interativa: 5 estrelas + contagem */}
      <div className="mx-auto mt-5 flex w-full max-w-md items-center justify-center gap-3 px-4 sm:max-w-lg sm:px-6">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <StarButton
              key={value}
              value={value}
              active={value <= minhaNota}
              onRate={handleRate}
            />
          ))}
        </div>
        {totalAvaliacoes > 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">{notaMedia.toFixed(1)}</span>
            {" "}· {totalAvaliacoes} {totalAvaliacoes === 1 ? "avaliacao" : "avaliacoes"}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Seja o primeiro a avaliar</p>
        )}
      </div>

      {/* Botoes de acao: bookmark + CTA principal */}
      <div className="mx-auto mt-6 flex w-full max-w-md items-center gap-3 px-4 sm:max-w-lg sm:px-6">
        <button
          onClick={() => toggleFavoriteBook(book.id)}
          className={`flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
            favoritado
              ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"
              : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
          }`}
          aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {favoritado ? (
            <BookmarkIcon className="size-5" weight="fill" />
          ) : (
            <BookmarkIcon className="size-5" />
          )}
        </button>
        <button
          onClick={handleStartReading}
          disabled={!hasPdf || !release.liberado}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-500/40 disabled:shadow-none"
        >
          <BookOpen className="size-4" weight="bold" />
          {ctaLabel}
        </button>
      </div>

      {/* Conteudo: Overview, progresso, livros e autores relacionados */}
      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-7 sm:max-w-lg sm:px-6">
        <div className="space-y-6">
          {/* Overview */}
          <section>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Visao geral</h2>
            {book.bio ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
                {book.bio}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Sinopse indisponivel.</p>
            )}
          </section>

          {/* Progresso */}
          {progresso > 0 && (
            <section>
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Progresso</span>
                <span>{progresso}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div className="h-full rounded-full bg-[var(--accent-mint)]" style={{ width: `${progresso}%` }} />
              </div>
            </section>
          )}

          {/* Liberacao futura */}
          {hasPdf && !release.liberado && (
            <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <Lock className="mx-auto mb-1.5 size-4 text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Libera em {formatarData(release.data)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
            </section>
          )}

          {/* Livros relacionados */}
          {relatedBooks.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Talvez voce tambem goste</h3>

              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
                {relatedBooks.map((rb) => (
                  <button
                    key={rb.id}
                    onClick={() => navigate(`/app/livro/${rb.id}`)}
                    className="w-[120px] shrink-0 text-left"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)]">
                      <img src={rb.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-[var(--text-primary)]">{rb.title}</p>
                    {rb.ratingCount > 0 ? (
                      <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-[var(--text-secondary)]">
                        <StarIcon weight="fill" className="size-3 text-amber-400" />
                        {rb.nota.toFixed(1)}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Discussoes do livro: posts da comunidade vinculados ao livro */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discussoes do livro</h3>
                <p className="text-xs text-[var(--text-muted)]">Postagens da comunidade sobre este livro.</p>
              </div>
              <CreatePost initialBookId={book.id} tag={`entity-thread:book:${book.id}`} />
            </div>

            {bookPosts.length > 0 ? (
              <div className="space-y-4">
                {bookPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={deletePost}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-[12px] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                Ainda nao ha discussoes sobre este livro. Seja a primeira pessoa a postar.
              </p>
            )}
          </section>

          {!hasPdf && (
            <section className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
              <BookOpen className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum PDF disponivel para este livro ainda.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
