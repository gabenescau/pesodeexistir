import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Maximize2, Minus, NotebookPen, Plus, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useData } from "../data/DataContext";
import { supabase, isSupabaseReady } from "../data/supabase";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function base64ToBlobUrl(base64, mimeType = "application/pdf") {
  try {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    return URL.createObjectURL(new Blob([new Uint8Array(byteNums)], { type: mimeType }));
  } catch {
    return null;
  }
}

// O bucket `pdfs` e privado: a URL publica salva em books.pdf_url nao baixa
// mais nada sozinha. Extraimos o caminho do objeto para pedir uma URL assinada,
// que o Storage so emite se o RLS aprovar (assinante ativo ou admin).
function extractPdfStoragePath(pdfFile) {
  const marker = "/storage/v1/object/public/pdfs/";
  const index = pdfFile.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(pdfFile.slice(index + marker.length));
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function resolvePdfUrl(pdfFile) {
  if (!pdfFile) return null;
  if (pdfFile.startsWith("data:")) return base64ToBlobUrl(pdfFile.split(",")[1]);

  if (pdfFile.startsWith("http") || pdfFile.startsWith("/")) {
    const storagePath = isSupabaseReady() ? extractPdfStoragePath(pdfFile) : null;
    if (!storagePath) return pdfFile;

    const { data, error } = await supabase.storage
      .from("pdfs")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error("Você precisa de uma assinatura ativa para abrir este livro.");
    }

    return data.signedUrl;
  }

  return base64ToBlobUrl(pdfFile);
}

export function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const renderTaskRef = useRef(null);
  const touchStartRef = useRef(null);
  const saveTimerRef = useRef(null);
  const { getBookById, getAuthorById, markBookCompleted, updateReadingProgress } = useData();
  const book = getBookById(id);
  const author = getAuthorById(book?.authorId || book?.author_id);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(Number(book?.currentPage || 1));
  const [totalPages, setTotalPages] = useState(Number(book?.totalPages || 0));
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [pdfUrl, setPdfUrl] = useState(null);
  const rawPdfFile = book?.pdfFile || book?.pdf_url;

  // A URL assinada e pedida ao Storage a cada abertura e expira em 1h, entao
  // ela nao pode ser compartilhada indefinidamente como a URL publica antiga.
  useEffect(() => {
    let active = true;
    setPdfUrl(null);

    if (!rawPdfFile) return;

    resolvePdfUrl(rawPdfFile)
      .then((url) => {
        if (active) setPdfUrl(url);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Nao foi possivel abrir este livro.");
      });

    return () => {
      active = false;
    };
  }, [rawPdfFile]);
  const progress = totalPages ? Math.round((page / totalPages) * 100) : Number(book?.progress || 0);

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
        const doc = await pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false,
          disableAutoFetch: false,
          disableStream: false,
        }).promise;
        if (cancelled) return;
        const lastPage = Math.min(Math.max(1, Number(book?.currentPage || 1)), doc.numPages);
        setPdf(doc);
        setTotalPages(doc.numPages);
        setPage(lastPage);
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
      context.clearRect(0, 0, viewport.width, viewport.height);

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

  useEffect(() => {
    if (!book?.id || !totalPages || loading || error) return;

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      updateReadingProgress(book.id, { currentPage: page, totalPages }).catch(() => {});
    }, 450);

    return () => window.clearTimeout(saveTimerRef.current);
  }, [book?.id, page, totalPages, loading, error, updateReadingProgress]);

  useEffect(() => {
    function saveNow() {
      if (!book?.id || !totalPages) return;
      updateReadingProgress(book.id, { currentPage: page, totalPages }).catch(() => {});
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") saveNow();
    }

    window.addEventListener("pagehide", saveNow);
    window.addEventListener("beforeunload", saveNow);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      saveNow();
      window.removeEventListener("pagehide", saveNow);
      window.removeEventListener("beforeunload", saveNow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [book?.id, page, totalPages, updateReadingProgress]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      if (!isSupabaseReady() || !book?.id) {
        setNotes([]);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data, error: notesError } = await supabase
        .from("book_notes")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", book.id)
        .order("created_at", { ascending: false });

      if (!cancelled && !notesError) setNotes(data || []);
    }

    loadNotes();
    return () => {
      cancelled = true;
    };
  }, [book?.id]);

  async function saveNote() {
    if (!noteText.trim() || !book?.id || savingNote) return;
    setSavingNote(true);

    try {
      if (!isSupabaseReady()) throw new Error("Supabase não configurado.");
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Você precisa estar logado.");

      const payload = {
        user_id: userId,
        book_id: book.id,
        page_number: page,
        note: noteText.trim(),
      };

      const { data, error: insertError } = await supabase
        .from("book_notes")
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;
      setNotes((current) => [data, ...current]);
      setNoteText("");
    } finally {
      setSavingNote(false);
    }
  }

  function goNextPage() {
    setPage((value) => Math.min(totalPages || value + 1, value + 1));
  }

  function goPrevPage() {
    setPage((value) => Math.max(1, value - 1));
  }

  function handleTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) goNextPage();
    else goPrevPage();
  }

  function handlePointerUp(event) {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x > rect.width * 0.62) goNextPage();
    if (x < rect.width * 0.38) goPrevPage();
  }

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
          <span className="min-w-20 rounded-full border border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
            {page}/{totalPages || "..."} · {progress}%
          </span>
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
          <button
            onClick={() => setNotesOpen((value) => !value)}
            className="flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
          >
            <NotebookPen className="size-4" />
            <span className="hidden md:inline">Notas</span>
          </button>
        </div>
      </header>

      <main
        ref={wrapperRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerUp={handlePointerUp}
        className="min-h-0 flex-1 touch-pan-y select-none overflow-auto bg-[var(--bg-canvas)] p-3 sm:p-6"
      >
        {notesOpen && (
          <aside className="mx-auto mb-3 max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-sm)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Anotações do livro</p>
              <span className="text-xs text-[var(--text-muted)]">Página {page}</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={2}
                placeholder="Escreva uma anotação sobre esta página..."
                className="min-w-0 flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
              />
              <button
                onClick={saveNote}
                disabled={!noteText.trim() || savingNote}
                className="self-end rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
            {notes.length > 0 && (
              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--text-muted)]">Página {note.page_number}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

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
          <div className="mx-auto flex w-full flex-col items-center gap-3">
            <canvas ref={canvasRef} className="max-w-full rounded-[6px] bg-white shadow-[0_18px_60px_rgba(0,0,0,.25)]" />
            <p className="pb-6 text-center text-xs text-[var(--text-muted)]">
              Arraste para esquerda ou direita para trocar de página.
            </p>
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
