import { useParams, useNavigate } from "react-router-dom";
import { Heart, ChevronLeft, BookOpen } from "lucide-react";
import { useData } from "../data/DataContext";
import { PDFViewer } from "../components/PDFViewer";
import { useRef } from "react";

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBookById, getAuthorById } = useData();
  const book = getBookById(id);
  const pdfRef = useRef(null);

  if (!book) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--text-muted)]">Livro não encontrado.</p>
        <button onClick={() => navigate("/app/biblioteca")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para biblioteca
        </button>
      </div>
    );
  }

  const author = getAuthorById(book.authorId);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="mx-auto w-full max-w-48 shrink-0 lg:mx-0 lg:w-48">
          <img
            src={book.image}
            alt={book.title}
            className="w-full aspect-[2/3] rounded-[12px] object-cover border border-[var(--border)]"
          />
          {book.pdfFile && (
            <button
              onClick={() => pdfRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="w-full h-10 mt-3 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="size-4" /> Ler agora
            </button>
          )}
          <div className="flex gap-2 mt-3">
            <button className="flex-1 h-10 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--hover-overlay)] transition-colors">
              <Heart className="size-4 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{book.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{author?.name || book.authorName}</p>

          {book.progress != null && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>Progresso de leitura</span>
                <span>{book.progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${book.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {book.pdfFile ? (
        <div ref={pdfRef}>
          <PDFViewer pdfFile={book.pdfFile} title={book.title} />
        </div>
      ) : (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <BookOpen className="size-8 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Nenhum PDF disponível para este livro ainda.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">O administrador pode adicionar o PDF no painel admin.</p>
        </div>
      )}
    </div>
  );
}
