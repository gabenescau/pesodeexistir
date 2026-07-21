import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronLeft, Heart } from "lucide-react";
import { useData } from "../data/DataContext";

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBookById, getAuthorById, markBookCompleted } = useData();
  const book = getBookById(id);

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

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="mx-auto w-full max-w-48 shrink-0 lg:mx-0 lg:w-48">
          <img
            src={book.image}
            alt={book.title}
            className="aspect-[2/3] w-full rounded-[12px] border border-[var(--border)] object-cover"
          />

          {hasPdf && (
            <button
              onClick={() => navigate(`/app/ler/${book.id}`)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-sm font-medium text-[var(--bg-card)] transition-colors hover:opacity-90"
            >
              <BookOpen className="size-4" /> Ler agora
            </button>
          )}

          <button
            onClick={() => markBookCompleted(book.id)}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
          >
            <CheckCircle2 className="size-4" />
            {Number(book.progress || 0) >= 100 ? "Concluído" : "Marcar como concluído"}
          </button>

          <div className="mt-3 flex gap-2">
            <button className="flex h-10 flex-1 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:bg-[var(--hover-overlay)]">
              <Heart className="size-4 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{book.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{author?.name || book.authorName}</p>

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
