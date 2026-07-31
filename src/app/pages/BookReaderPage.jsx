import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Hand, Info, Keyboard, Lock, Maximize2,
  Minus, MousePointerClick, Plus, X,
} from "@/lib/icons";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useData } from "../data/DataContext";
import { supabase, isSupabaseReady } from "../data/supabase";
import { contagemRegressiva, formatarData } from "@/lib/releases";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const CHAVE_DICA = "ope:reader-hint-visto";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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
// que o Storage so emite se o RLS aprovar (assinante ativo, livro ja lancado
// ou admin).
function extractPdfStoragePath(pdfFile) {
  if (!/^(https?:|data:|blob:|\/)/i.test(pdfFile)) return pdfFile;
  const marker = "/storage/v1/object/public/pdfs/";
  const index = pdfFile.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(pdfFile.slice(index + marker.length));
}

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
      throw new Error("Este livro ainda não está liberado para você (assinatura ativa e data de lançamento alcançada).");
    }

    return data.signedUrl;
  }

  if (isSupabaseReady()) {
    const { data, error } = await supabase.storage
      .from("pdfs")
      .createSignedUrl(pdfFile, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error("Este livro ainda não está liberado para sua conta.");
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
  const { getBookById, getAuthorById, markBookCompleted, updateReadingProgress, getReleaseStatus } = useData();
  const book = getBookById(id);
  const author = getAuthorById(book?.authorId || book?.author_id);
  const release = getReleaseStatus(id);

  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(Number(book?.currentPage || 1));
  const [totalPages, setTotalPages] = useState(Number(book?.totalPages || 0));
  // Guarda a pagina em que o usuario entrou no livro. Quando o PDF carrega,
  // so usamos este valor se a pagina local ainda nao for valida. Evita
  // pular de pagina 5 para pagina 1 quando o DataContext atualiza o livro.
  const initialPageRef = useRef(Number(book?.currentPage || 1));
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dicaVisivel, setDicaVisivel] = useState(false);

  const rawPdfFile = book?.pdfFile || book?.pdf_url;
  const bloqueado = Boolean(book) && !release.liberado;
  const progress = totalPages ? Math.round((page / totalPages) * 100) : Number(book?.progress || 0);

  // Dica de navegacao: aparece na primeira leitura e some depois de dispensada.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CHAVE_DICA)) setDicaVisivel(true);
    } catch {
      setDicaVisivel(true);
    }
  }, []);

  function dispensarDica() {
    setDicaVisivel(false);
    try {
      window.localStorage.setItem(CHAVE_DICA, "1");
    } catch {
      // localStorage bloqueado: a dica volta na proxima sessao, sem quebrar nada.
    }
  }

  // A URL assinada e pedida ao Storage a cada abertura e expira em 1h, entao
  // ela nao pode ser compartilhada indefinidamente como a URL publica antiga.
  useEffect(() => {
    let active = true;
    setPdfUrl(null);

    if (!rawPdfFile || bloqueado) return undefined;

    resolvePdfUrl(rawPdfFile)
      .then((url) => {
        if (active) setPdfUrl(url);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Não foi possível abrir este livro.");
      });

    return () => {
      active = false;
    };
  }, [rawPdfFile, bloqueado]);

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
        // A pagina inicial so e usada na PRIMEIRA carga do documento. Em
        // chamadas subsequentes do effect (que nao deveria acontecer, mas
        // acontecia quando o DataContext atualizava `book.currentPage` apos
        // cada salvamento), o `page` local ja reflete a pagina atual do
        // usuario e nao deve ser sobrescrito.
        const initialPage = Math.min(
          Math.max(1, Number(initialPageRef.current || 1)),
          doc.numPages
        );
        setPdf(doc);
        setTotalPages(doc.numPages);
        setPage((atual) => (atual >= 1 && atual <= doc.numPages ? atual : initialPage));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  // Renderiza a pagina no tamanho do container. Refaz ao girar o celular ou
  // redimensionar a janela — antes o canvas ficava com a largura da orientacao
  // anterior e a pagina saia cortada.
  // O medidor roda uma unica vez e usa ResizeObserver; so atualiza o state
  // quando o tamanho muda de verdade, para evitar loop de re-render
  // (canvas muda tamanho -> observer dispara -> state novo -> render ->
  // canvas muda tamanho -> ...).
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const elemento = wrapperRef.current;
    if (!elemento) return undefined;

    function medir() {
      const w = elemento.clientWidth;
      const h = elemento.clientHeight;
      setContainerSize((atual) => (atual.width === w && atual.height === h ? atual : { width: w, height: h }));
    }

    medir();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }

    const observer = new ResizeObserver(medir);
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!pdf || !canvasRef.current || !containerSize.width) return;

      renderTaskRef.current?.cancel?.();
      const currentPage = await pdf.getPage(page);
      if (cancelled) return;

      const baseViewport = currentPage.getViewport({ scale: 1 });
      const larguraDisponivel = Math.max(240, containerSize.width - 24);
      const alturaDisponivel = Math.max(320, containerSize.height - 24);

      // Celular: cabe a pagina inteira na tela (sem espaco vazio embaixo).
      // Desktop: cabe a pagina inteira na tela, sem rolagem.
      const escalaLargura = larguraDisponivel / baseViewport.width;
      const escalaAltura = alturaDisponivel / baseViewport.height;
      const fitScale = Math.min(escalaLargura, escalaAltura);
      const scale = Math.max(0.3, fitScale) * (zoom / 100);
      const viewport = currentPage.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      // Acima de 2x o ganho visual e nulo e a memoria do canvas explode em
      // celular (canvas grande demais chega a nao renderizar no iOS).
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

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
  }, [pdf, page, zoom, containerSize.width, containerSize.height]);

  useEffect(() => {
    if (!book?.id || !totalPages || loading || error) return undefined;

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

  const goNextPage = useCallback(() => {
    setPage((value) => Math.min(totalPages || value + 1, value + 1));
  }, [totalPages]);

  const goPrevPage = useCallback(() => {
    setPage((value) => Math.max(1, value - 1));
  }, []);

  // Teclado: seta/PageUp/PageDown/espaco viram pagina; +/- ajustam o zoom.
  useEffect(() => {
    function onKeyDown(event) {
      const alvo = event.target;
      const digitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;
      if (digitando) return;

      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        goNextPage();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevPage();
      } else if (event.key === "+" || event.key === "=") {
        setZoom((valor) => Math.min(200, valor + 10));
      } else if (event.key === "-") {
        setZoom((valor) => Math.max(60, valor - 10));
      } else if (event.key === "Escape") {
        navigate(`/app/livro/${id}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNextPage, goPrevPage, navigate, id]);

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

  if (bloqueado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <Lock className="mx-auto mb-3 size-7 text-[var(--text-primary)]" />
          <p className="text-base font-semibold text-[var(--text-primary)]">{book.title}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Este livro faz parte dos lançamentos semanais e abre em {formatarData(release.data)}.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
          <button
            onClick={() => navigate("/app/lancamentos")}
            className="mt-5 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-card)]"
          >
            Ver lançamentos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:size-10"
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
          <span className="hidden rounded-full border border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--text-muted)] sm:inline">
            {page}/{totalPages || "..."} · {progress}%
          </span>
          <button
            onClick={() => setZoom((value) => Math.max(60, value - 10))}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] sm:flex"
            aria-label="Diminuir zoom"
          >
            <Minus className="size-4" />
          </button>
          <button
            onClick={() => setZoom((value) => Math.min(200, value + 10))}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] sm:flex"
            aria-label="Aumentar zoom"
          >
            <Plus className="size-4" />
          </button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="hidden size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] lg:flex"
            aria-label="Tela cheia"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            onClick={() => setDicaVisivel(true)}
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
            aria-label="Como virar a página"
          >
            <Info className="size-4" />
          </button>
          <button
            onClick={() => markBookCompleted(book.id)}
            className="hidden h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] sm:flex"
          >
            <CheckCircle2 className="size-4" />
            <span className="hidden md:inline">{Number(book.progress || 0) >= 100 ? "Concluído" : "Concluir"}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main
          ref={wrapperRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerUp={handlePointerUp}
          className="relative flex min-h-0 flex-1 touch-pan-y select-none items-center justify-center overflow-auto bg-[var(--bg-canvas)] p-3 sm:p-6"
        >
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
              </div>
            </div>
          )}

          {!loading && !error && pdf && (
            <div className="flex h-full w-full items-center justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-full max-w-full rounded-[6px] bg-white shadow-[var(--shadow-sm)]"
              />
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

          {dicaVisivel && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center p-4 sm:items-center">
              <div
                onPointerUp={(event) => event.stopPropagation()}
                className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">Como virar a página</p>
                <ul className="mt-4 space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hover-overlay)] text-[var(--text-primary)]">
                      <Hand className="size-4" />
                    </span>
                    <span className="pt-1"><b className="font-medium text-[var(--text-primary)]">No celular:</b> arraste para a esquerda (avança) ou para a direita (volta).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hover-overlay)] text-[var(--text-primary)]">
                      <MousePointerClick className="size-4" />
                    </span>
                    <span className="pt-1"><b className="font-medium text-[var(--text-primary)]">No computador:</b> clique na metade direita ou esquerda da página.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--hover-overlay)] text-[var(--text-primary)]">
                      <Keyboard className="size-4" />
                    </span>
                    <span className="pt-1">
                      <b className="font-medium text-[var(--text-primary)]">Teclado:</b>{" "}
                      <kbd className="rounded bg-[var(--hover-overlay)] px-1">←</kbd> <kbd className="rounded bg-[var(--hover-overlay)] px-1">→</kbd> viram a página, <kbd className="rounded bg-[var(--hover-overlay)] px-1">+</kbd> / <kbd className="rounded bg-[var(--hover-overlay)] px-1">−</kbd> ajustam o zoom.
                    </span>
                  </li>
                </ul>
                <button
                  onClick={dispensarDica}
                  className="mt-5 w-full rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]"
                >
                  Entendi
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-5">
        <button
          onClick={goPrevPage}
          disabled={page <= 1}
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35"
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="size-5" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="flex min-w-0 flex-col items-center">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {page} / {totalPages || "..."}
          </p>
          <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">
            Arraste, clique nas laterais ou use as setas do teclado
          </p>
          <p className="text-[10px] text-[var(--text-muted)] sm:hidden">Arraste para os lados</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goNextPage}
            disabled={Boolean(totalPages) && page >= totalPages}
            className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35"
            aria-label="Proxima pagina"
          >
            <span className="hidden sm:inline">Proxima</span>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
