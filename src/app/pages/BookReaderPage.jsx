import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Lock, Maximize2, Minimize2, Minus, Plus, Share2,
} from "@/lib/icons";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useData } from "../data/DataContext";
import { supabase, isSupabaseReady } from "../data/supabase";
import { useRewards } from "../data/RewardsContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";
import { toast } from "@/lib/toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 100;

// A URL do PDF nunca e criada no navegador. O endpoint valida a sessao, o
// plano, a data de lancamento e o objeto antes de devolver uma URL temporaria.
async function resolvePdfUrl(bookId) {
  if (!bookId) throw new Error("Livro invalido.");
  if (!isSupabaseReady()) {
    throw new Error("A conexao segura com a biblioteca nao esta disponivel. Recarregue a pagina e tente novamente.");
  }
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sua sessao expirou. Entre novamente para continuar.");
  }

  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requestOptions = { headers, cache: "no-store" };
  let response = await fetch(`/api/book-pdf/${encodeURIComponent(bookId)}`, requestOptions);
  let contentType = response.headers.get("content-type") || "";
  let payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  // If a deployment serves the SPA fallback for the pretty API route, call
  // the underlying serverless handler directly. A 4xx JSON response is kept
  // intact so authorization failures are never bypassed by this fallback.
  if (!payload && !contentType.includes("application/json")) {
    response = await fetch(
      `/api/stripe-session?mode=book-pdf&bookId=${encodeURIComponent(bookId)}`,
      requestOptions,
    );
    contentType = response.headers.get("content-type") || "";
    payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel liberar este livro para sua conta.");
  }

  const signedUrl = payload?.success === true && payload?.data?.url;
  if (typeof signedUrl !== "string" || !/^https:\/\//i.test(signedUrl)) {
    throw new Error("Nao foi possivel confirmar a liberacao deste livro. Tente novamente.");
  }
  return signedUrl;
}

export function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const touchStartRef = useRef(null);
  const saveTimerRef = useRef(null);
  const initialZoom = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_ZOOM;
    try {
      const stored = window.localStorage.getItem("ope:reader-zoom");
      if (stored) {
        const value = Number(stored);
        if (value >= MIN_ZOOM && value <= MAX_ZOOM) return value;
      }
    } catch { /* ignore */ }
    return DEFAULT_ZOOM;
  }, []);
  const { getBookById, getAuthorById, markBookCompleted, updateReadingProgress, getReleaseStatus, toggleFavoriteBook, isFavoriteBook } = useData();
  const { reportReading } = useRewards();
  const book = getBookById(id);
  const author = getAuthorById(book?.authorId || book?.author_id);
  const release = getReleaseStatus(id);

  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(Number(book?.currentPage || 1));
  const [totalPages, setTotalPages] = useState(Number(book?.totalPages || 0));
  const initialPageRef = useRef(Number(book?.currentPage || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showHint, setShowHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const favoritado = book ? isFavoriteBook(book.id) : false;

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }, []);

  const rawPdfFile = book?.id || null;
  const bloqueado = Boolean(book) && !release.liberado;
  const progress = totalPages ? Math.round((page / totalPages) * 100) : Number(book?.progress || 0);

  useEffect(() => {
    let active = true;
    setPdfUrl(null);
    if (!rawPdfFile || bloqueado) return undefined;
    resolvePdfUrl(rawPdfFile)
      .then((url) => { if (active) setPdfUrl(url); })
      .catch((err) => { if (active) setError(err?.message || "Não foi possível abrir este livro."); });
    return () => { active = false; };
  }, [rawPdfFile, bloqueado]);

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      if (!pdfUrl) { setPdf(null); setLoading(false); return; }
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
        const initialPage = Math.min(Math.max(1, Number(initialPageRef.current || 1)), doc.numPages);
        setPdf(doc);
        setTotalPages(doc.numPages);
        setPage((atual) => (atual >= 1 && atual <= doc.numPages ? atual : initialPage));
      } catch (err) {
        if (!cancelled) setError(err?.message || "Não foi possível abrir o PDF dentro do app.");
      } finally {
        if (!cancelled) setLoading(false); }
    }
    loadPdf();
    return () => { cancelled = true; renderTaskRef.current?.cancel?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

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
    function handleVisibility() { if (document.visibilityState === "hidden") saveNow(); }
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

  // Sensor de tempo de leitura: acumula segundos ativos e reporta em lotes
  // para o RPC report_reading_session (server-authoritative, aplica caps e
  // missao diaria). Nunca bloqueia a leitura; erros sao silenciosos.
  useEffect(() => {
    if (!book?.id || !pdf || loading || error) return undefined;
    let accumulated = 0;
    let lastTick = Date.now();
    const interactedRef = { value: true };
    function onPointer() { interactedRef.value = true; }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onPointer);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const seconds = Math.floor((now - lastTick) / 1000);
      lastTick = now;
      if (seconds < 1) return;
      accumulated += seconds;
      if (accumulated < 30) return;
      const chunk = accumulated;
      accumulated = 0;
      reportReading(book.id, chunk, interactedRef.value).catch(() => {});
      interactedRef.value = false;
    }, 15000);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onPointer);
      window.clearInterval(interval);
      if (accumulated > 0 && document.visibilityState !== "hidden") {
        reportReading(book.id, accumulated, interactedRef.value).catch(() => {});
      }
    };
  }, [book?.id, pdf, loading, error, reportReading]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;
    function medir() {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setContainerSize((atual) => (atual.width === w && atual.height === h ? atual : { width: w, height: h }));
    }
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const observer = new ResizeObserver(medir);
    observer.observe(el);
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
      const largura = Math.max(240, containerSize.width - 24);
      const altura = Math.max(320, containerSize.height - 24);
      const fit = Math.min(largura / baseViewport.width, altura / baseViewport.height);
      const scale = Math.max(0.3, fit) * (zoom / 100);
      const viewport = currentPage.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);
      const task = currentPage.render({ canvasContext: context, viewport });
      renderTaskRef.current = task;
      try { await task.promise; } catch (err) { if (err?.name !== "RenderingCancelledException" && !cancelled) setError("Não foi possível renderizar esta página."); }
    }
    renderPage();
    return () => { cancelled = true; renderTaskRef.current?.cancel?.(); };
  }, [pdf, page, zoom, containerSize.width, containerSize.height]);

  const goNextPage = useCallback(() => {
    setPage((value) => Math.min(totalPages || value + 1, value + 1));
  }, [totalPages]);
  const goPrevPage = useCallback(() => {
    setPage((value) => Math.max(1, value - 1));
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const alvo = event.target;
      if (alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); goNextPage(); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goPrevPage(); }
      else if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom((v) => Math.min(MAX_ZOOM, v + 10)); }
      else if (event.key === "-") { event.preventDefault(); setZoom((v) => Math.max(MIN_ZOOM, v - 10)); }
      else if (event.key === "Escape") { if (showHint) setShowHint(false); else navigate(-1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNextPage, goPrevPage, navigate, showHint]);

  function changeZoom(value) {
    const v = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    setZoom(v);
    try { window.localStorage.setItem("ope:reader-zoom", String(v)); } catch { /* ignore */ }
  }

  async function handleShare() {
    if (!book) return;
    const shareData = { title: book.title, url: typeof window !== "undefined" ? window.location.href : "" };
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareData.url);
      toast.success("Compartilhamento aberto.");
    } catch { /* cancelado */ }
  }

  if (!book) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">Livro não encontrado.</p>
          <button onClick={() => navigate("/app/biblioteca")} className="mt-4 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm text-[var(--bg-card)]">Voltar para biblioteca</button>
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
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Este livro faz parte dos lançamentos semanais e abre em {formatarData(release.data)}.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
          <button onClick={() => navigate("/app/lancamentos")} className="mt-5 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-card)]">Ver lançamentos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:size-10"
            aria-label="Fechar leitor"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{book.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {author?.name || book.authorName || book.author} <span className="inline-block sm:hidden font-semibold text-[var(--text-primary)]">• Pág. {page}/{totalPages || "..."}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden h-9 items-center gap-1 rounded-full border border-[var(--border)] px-2 sm:flex">
            <button type="button" onClick={() => changeZoom(zoom - 10)} className="flex size-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Diminuir zoom"><Minus className="size-4" /></button>
            <span className="min-w-10 text-center text-xs font-medium text-[var(--text-primary)]">{zoom}%</span>
            <button type="button" onClick={() => changeZoom(zoom + 10)} className="flex size-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Aumentar zoom"><Plus className="size-4" /></button>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:size-10"
            aria-label={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
            title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => toggleFavoriteBook(book.id).then(() => toast.success(favoritado ? "Removido dos favoritos." : "Salvo nos favoritos.")).catch((err) => toast.error(err?.message || "Não foi possível salvar."))}
            className={`flex size-9 items-center justify-center rounded-full border border-[var(--border)] transition-colors ${
              favoritado ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            }`}
            aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Bookmark className="size-4" weight={favoritado ? "fill" : "regular"} />
          </button>
          <button type="button" onClick={handleShare} className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Compartilhar"><Share2 className="size-4" /></button>
          <button
            type="button"
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
          onTouchStart={(event) => {
            const touch = event.touches?.[0];
            if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            const touch = event.changedTouches?.[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            touchStartRef.current = null;
            if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
            if (dx < 0) goNextPage(); else goPrevPage();
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            if (x > rect.width * 0.62) goNextPage();
            else if (x < rect.width * 0.38) goPrevPage();
          }}
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-auto bg-[var(--bg-canvas)] p-3 sm:p-6"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Carregando livro...</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">Não foi possível abrir o livro.</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{error}</p>
              </div>
            </div>
          ) : pdf ? (
            <canvas ref={canvasRef} className="rounded-[6px] bg-white shadow-[var(--shadow-sm)]" />
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

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-5">
        <button type="button" onClick={goPrevPage} disabled={page <= 1} className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35 sm:h-11 sm:px-3" aria-label="Pagina anterior">
          <ChevronLeft className="size-5" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex shrink-0 flex-col items-center sm:items-end leading-tight px-1 min-w-[64px]">
            <p className="whitespace-nowrap text-xs font-bold text-[var(--text-primary)]">
              {page}/{totalPages || "..."}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] font-medium">{progress}%</p>
          </div>
        </div>
        <button type="button" onClick={goNextPage} disabled={Boolean(totalPages) && page >= totalPages} className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35 sm:h-11 sm:px-3" aria-label="Proxima pagina">
          <span className="hidden sm:inline">Proxima</span>
          <ChevronRight className="size-5" />
        </button>
      </footer>
    </div>
  );
}
