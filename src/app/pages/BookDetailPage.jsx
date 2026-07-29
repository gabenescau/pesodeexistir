import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronLeft, Heart, Lock, Share2 } from "lucide-react";
import { useData } from "../data/DataContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBookById, getAuthorById, markBookCompleted, getReleaseStatus, toggleFavoriteBook, isFavoriteBook } = useData();
  const book = getBookById(id);
  const release = getReleaseStatus(id);

  if (!book) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-muted)]">Livro não encontrado.</p>
        <button onClick={() => navigate("/app/biblioteca")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para biblioteca
        </button>
      </div>
    );
  }

  const author = getAuthorById(book.authorId || book.author_id);
  const hasPdf = Boolean(book.pdfFile || book.pdf_url);
  const favoritado = isFavoriteBook(book.id);

  return (
    <div className="space-y-6">
      {/* Header com botão voltar + compartilhar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="size-4" /> Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await toggleFavoriteBook(book.id);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              favoritado ? "border-[var(--text-primary)] bg-[var(--text-primary)]/10" : "border-[var(--border)] hover:bg-[var(--hover-overlay)]"
            }`}
            aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart className={`size-4 ${favoritado ? "text-[var(--text-primary)] fill-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: book.title, text: `Confira ${book.title} no OPE Club`, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors"
            aria-label="Compartilhar"
          >
            <Share2 className="size-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Layout mobile-first: capa + ações em cima, conteúdo embaixo */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="mx-auto w-full max-w-48 shrink-0 lg:mx-0 lg:w-48">
          <img
            src={book.image}
            alt={book.title}
            className="aspect-[2/3] w-full rounded-[12px] border border-[var(--border)] object-cover"
          />

          {hasPdf && release.liberado && (
            <button
              onClick={() => navigate(`/app/ler/${book.id}`)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-sm font-medium text-[var(--bg-card)] transition-colors hover:opacity-90"
            >
              <BookOpen className="size-4" /> Ler agora
            </button>
          )}

          {hasPdf && !release.liberado && (
            <div className="mt-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 text-center">
              <Lock className="mx-auto mb-1.5 size-4 text-[var(--text-muted)]" />
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Libera em {formatarData(release.data)}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
            </div>
          )}

          <button
            onClick={() => markBookCompleted(book.id)}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
          >
            <CheckCircle2 className="size-4" />
            {Number(book.progress || 0) >= 100 ? "Concluído" : "Marcar como concluído"}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{book.title}</h1>
          {author && (
            <Link to={`/app/autor/${author.id}`} className="mt-1 text-sm text-[var(--text-secondary)] hover:underline">
              {author.name}
            </Link>
          )}
          {book.category && (
            <span className="mt-2 inline-block rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1 text-xs text-[var(--text-muted)]">
              {book.category}
            </span>
          )}

          {Number(book.progress || 0) > 0 && (
            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Progresso de leitura</span>
                <span>{book.progress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${book.progress}%` }} />
              </div>
            </div>
          )}

          {!hasPdf && (
            <div className="mt-8 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
              <BookOpen className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum PDF disponível para este livro ainda.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">O administrador pode adicionar o PDF no painel admin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
