import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Maximize2, Minus, Plus, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useData } from "../data/DataContext";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function base64ToBlobUrl(base64, mimeType = "application/pdf") {
  try {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
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
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const renderTaskRef = useRef(null);
  const { getBookById, getAuthorById, markBookCompleted } = useData();
  const book = getBookById(id);
  const author = getAuthorById(book?.authorId || book?.author_id);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pdfUrl = useMemo(() => resolvePdfUrl(book?.pdfFile || book?.pdf_url), [book?.pdfFile, book?.pdf_url]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!pdfUrl) {
        setPdf(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false,
          disableAutoFetch: false,
          disableStream: false,
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setPage(1);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Não foi possível abrir o PDF dentro do app.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!pdf || !canvasRef.current) return;

      renderTaskRef.current?.cancel?.();
      const currentPage = await pdf.getPage(page);
      if (cancelled) return;

      const containerWidth = wrapperRef.current?.clientWidth || window.innerWidth;
      const baseViewport = currentPage.getViewport({ scale: 1 });
      const fitScale = Math.max(0.5, (containerWidth - 24) / baseViewport.width);
      const scale = fitScale * (zoom / 100);
      const viewport = currentPage.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderTask = currentPage.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException" && !cancelled) {
          setError("Não foi possível renderizar esta página.");
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [pdf, page, zoom]);

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

  const canGoPrev = page > 1;
  const canGoNext = totalPages ? page < totalPages : true;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 sm:px-5">
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

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            disabled={!canGoPrev}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="min-w-16 rounded-full border border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
            pág. {page}{totalPages ? `/${totalPages}` : ""}
          </span>
          <button
            disabled={!canGoNext}
            onClick={() => setPage((value) => Math.min(totalPages || value + 1, value + 1))}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-40"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setZoom((value) => Math.max(70, value - 10))}
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
          <button
            onClick={() => markBookCompleted(book.id)}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          >
            <CheckCircle2 className="size-4" />
            <span className="hidden md:inline">{Number(book.progress || 0) >= 100 ? "Concluído" : "Concluir"}</span>
          </button>
        </div>
      </header>

      <main ref={wrapperRef} className="min-h-0 flex-1 overflow-auto bg-[var(--bg-canvas)] p-3 sm:p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Carregando livro...
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">Não foi possível abrir o livro.</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{error}</p>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm text-[var(--bg-card)]">
                  Abrir PDF
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !error && pdf && (
          <div className="mx-auto flex w-full justify-center">
            <canvas ref={canvasRef} className="max-w-full rounded-[6px] bg-white shadow-[0_18px_60px_rgba(0,0,0,.25)]" />
          </div>
        )}

        {!loading && !error && !pdf && (
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
