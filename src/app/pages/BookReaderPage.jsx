import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, X } from "lucide-react";
import { useData } from "../data/DataContext";

function base64ToBlobUrl(base64, mimeType = "application/pdf") {
  try {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function resolvePdfUrl(pdfFile) {
  if (!pdfFile) return null;
  if (pdfFile.startsWith("data:")) return base64ToBlobUrl(pdfFile.split(",")[1]);
  if (pdfFile.startsWith("http") || pdfFile.startsWith("/")) return pdfFile;
  return base64ToBlobUrl(pdfFile);
}

export function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBookById, getAuthorById } = useData();
  const book = getBookById(id);
  const author = getAuthorById(book?.authorId || book?.author_id);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  const pdfUrl = useMemo(() => resolvePdfUrl(book?.pdfFile || book?.pdf_url), [book?.pdfFile, book?.pdf_url]);
  const viewerUrl = pdfUrl ? `${pdfUrl}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=1` : null;

  if (!book) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">Livro não encontrado.</p>
          <button onClick={() => navigate("/app/biblioteca")} className="mt-4 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm text-[var(--bg-card)]">
            Voltar para biblioteca
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate(`/app/livro/${book.id}`)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            aria-label="Fechar leitor"
          >
            <X className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{book.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{author?.name || book.authorName || book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="min-w-14 rounded-full border border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
            pág. {page}
          </span>
          <button
            onClick={() => setPage((value) => value + 1)}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setZoom((value) => Math.max(60, value - 10))}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] sm:flex"
            aria-label="Diminuir zoom"
          >
            <Minus className="size-4" />
          </button>
          <button
            onClick={() => setZoom((value) => Math.min(180, value + 10))}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] sm:flex"
            aria-label="Aumentar zoom"
          >
            <Plus className="size-4" />
          </button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] sm:flex"
            aria-label="Tela cheia"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 bg-[var(--bg-canvas)]">
        {viewerUrl ? (
          <iframe
            key={`${page}-${zoom}-${pdfUrl}`}
            src={viewerUrl}
            title={book.title}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Este livro ainda não tem PDF.</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Envie o arquivo pelo painel admin em Livros.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
