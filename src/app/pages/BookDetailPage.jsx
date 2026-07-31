import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronLeft, Lock, MoreHorizontal } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";
import { relatedBooks as recomendarLivros } from "@/lib/recommendations";

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBookById, getAuthorById, getReleaseStatus, toggleFavoriteBook, isFavoriteBook, books, authors, rateBook, myBookRating, bookRatingStats } = useData();
  const book = getBookById(id);
  const release = getReleaseStatus(id);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Livros relacionados: pontuados por categoria, autor, tags e popularidade
  // (nota real + numero de avaliacoes), excluindo este livro.
  const relatedBooks = recomendarLivros(livrosComNotaViva, book);

  // Autores relacionados: o proprio autor do livro + autores com obras na
  // mesma categoria (a quem o leitor tambem poderia se interessar).
  const relatedAuthors = [
    ...(author ? [author] : []),
    ...authors.filter(
      (a) => a.id !== author?.id && books.some((b) => b.category === book.category && b.authorId === a.id)
    ),
  ].slice(0, 6);

  const minhaNota = myBookRating(book.id);
  // Nota media reativa: vem das avaliacoes em memoria (bookRatingStats) para
  // que o numero e a contagem atualizem na hora apos o usuario avaliar.
  const statsDesteLivro = bookRatingStats[book.id];
  const notaMedia = statsDesteLivro && statsDesteLivro.count > 0
    ? Math.round((statsDesteLivro.sum / statsDesteLivro.count) * 10) / 10
    : 0;

  function handleStartReading() {
    if (hasPdf && release.liberado) {
      navigate(`/app/ler/${book.id}`);
    }
  }

  function handleRate(valor) {
    rateBook(book.id, valor).catch(() => {});
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-[var(--bg-page)] px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5 text-[var(--text-primary)]" />
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Mais opcoes"
        >
          <MoreHorizontal className="size-5 text-[var(--text-primary)]" />
        </button>
      </div>

      {/* Hero: capa + info */}
      <div className="flex gap-4 px-4 pb-4 sm:gap-5">
        {/* Capa */}
        <div className="w-[32%] shrink-0 sm:w-[36%] md:w-[30%]">
          <div className="aspect-[2/3] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
            <img
              src={book.image}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-[16px] font-[700] leading-[22px] tracking-[-0.32px] text-[var(--text-primary)] sm:text-[18px] sm:leading-[24px] sm:tracking-[-0.36px]">
            {book.title}
          </h1>

          {author && (
            <Link to={`/app/autor/${author.id}`} className="mt-2 flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:underline sm:text-sm">
              {author.image ? (
                <img src={author.image} alt="" className="size-5 rounded-full object-cover" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-[10px] font-bold text-[var(--text-muted)]">
                  {author.name?.charAt(0)}
                </span>
              )}
              {author.name}
            </Link>
          )}

          {/* Status + categoria */}
          <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] sm:text-sm">
              <BookOpen className="size-4 shrink-0 text-[var(--text-muted)]" />
              {status}
            </div>
            {book.category && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] sm:text-sm">
                <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
                {book.category}
              </div>
            )}
          </div>

          {/* Tags */}
          {book.tag && (
            <div className="mt-3 flex flex-wrap gap-1.5">
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

      {/* Botoes de acao - inline, antes das tabs */}
      <div className="flex items-center gap-2.5 px-4 pb-4 sm:gap-3">
        <button
          onClick={handleStartReading}
          disabled={!hasPdf || !release.liberado}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[13px] font-medium text-[var(--bg-card)] transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed sm:h-12 sm:text-sm"
        >
          <BookOpen className="size-4" />
          {hasPdf && release.liberado ? "Comecar a ler" : "Indisponivel"}
        </button>
        <button
          onClick={() => toggleFavoriteBook(book.id)}
          className={`flex size-11 items-center justify-center rounded-full border transition-colors sm:size-12 ${
            favoritado
              ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"
              : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
          }`}
          aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {favoritado ? (
            <CheckCircle2 className="size-5" />
          ) : (
            <span className="text-xl leading-none">+</span>
          )}
        </button>
      </div>

      {/* Avaliacao: nota media real + estrelas para o usuario avaliar */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleRate(value)}
              aria-label={`Avaliar com ${value} estrela${value > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <svg
                viewBox="0 0 24 24"
                className={`size-6 transition-colors ${
                  value <= minhaNota
                    ? "fill-amber-400 text-amber-400"
                    : "fill-none text-[var(--border-strong)]"
                }`}
              >
                <path
                  d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.7l-5.8 3-1.1-6.5L.4 9.3l6.5-.9L12 2.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
        {statsDesteLivro && statsDesteLivro.count > 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">{notaMedia.toFixed(1)}</span> · {statsDesteLivro.count}{" "}
            {statsDesteLivro.count === 1 ? "avaliacao" : "avaliacoes"}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Seja o primeiro a avaliar</p>
        )}
      </div>

      {/* Conteudo */}
      <div className="flex-1 px-4 pt-5">
        <div className="space-y-6">
          {/* Sinopse / bio */}
          {book.bio ? (
            <div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
                {book.bio}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Sinopse indisponivel.</p>
          )}

          {/* Progresso */}
          {progresso > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Progresso</span>
                <span>{progresso}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div className="h-full rounded-full bg-[var(--accent-mint)]" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}

          {/* Liberacao */}
          {hasPdf && !release.liberado && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <Lock className="mx-auto mb-1.5 size-4 text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Libera em {formatarData(release.data)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
            </div>
          )}

          {/* Livros e autores relacionados */}
          {(relatedBooks.length > 0 || relatedAuthors.length > 0) && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Talvez você também goste</h3>

              {relatedBooks.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
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
                          <svg viewBox="0 0 24 24" className="size-3 fill-amber-400 text-amber-400">
                            <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.7l-5.8 3-1.1-6.5L.4 9.3l6.5-.9L12 2.5z" />
                          </svg>
                          {rb.nota.toFixed(1)}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}

              {relatedAuthors.length > 0 && (
                <div className="mt-2 flex gap-4 overflow-x-auto pb-2">
                  {relatedAuthors.map((ra) => (
                    <button
                      key={ra.id}
                      onClick={() => navigate(`/app/autor/${ra.id}`)}
                      className="w-[84px] shrink-0 text-center"
                    >
                      <div className="mx-auto size-16 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
                        {ra.image ? (
                          <img src={ra.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-lg font-bold text-[var(--text-muted)]">
                            {ra.name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium text-[var(--text-primary)]">{ra.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasPdf && (
            <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
              <BookOpen className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum PDF disponivel para este livro ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
