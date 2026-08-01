import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bookmark, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Lock, Minus, Plus, Share2,
} from "@/lib/icons";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useData } from "../data/DataContext";
import { supabase, isSupabaseReady } from "../data/supabase";
import { contagemRegressiva, formatarData } from "@/lib/releases";
import { toast } from "@/lib/toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MIN_FONT_SIZE = 13;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 17;

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
  const textContainerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const touchStartRef = useRef(null);
  const saveTimerRef = useRef(null);
  const pageTextCacheRef = useRef(new Map());
  const initialFontSize = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_FONT_SIZE;
    try {
      const stored = window.localStorage.getItem("ope:reader-font-size");
      if (stored) {
        const value = Number(stored);
        if (value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE) return value;
      }
    } catch { /* ignore */ }
    return DEFAULT_FONT_SIZE;
  }, []);
  const { getBookById, getAuthorById, markBookCompleted, updateReadingProgress, getReleaseStatus, toggleFavoriteBook, isFavoriteBook } = useData();
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
  const [pageText, setPageText] = useState(null);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState(null);
  const [canvasFallback, setCanvasFallback] = useState(null);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const rawPdfFile = book?.pdfFile || book?.pdf_url;
  const bloqueado = Boolean(book) && !release.liberado;
  const progress = totalPages ? Math.round((page / totalPages) * 100) : Number(book?.progress || 0);
  const favoritado = book ? isFavoriteBook(book.id) : false;

  async function getPageText(doc, pageNumber) {
    const cached = pageTextCacheRef.current.get(pageNumber);
    if (cached !== undefined) return cached;
    const p = await doc.getPage(pageNumber);
    const content = await p.getTextContent();
    let text = "";
    for (const item of content.items) {
      const str = item.str;
      if (str) {
        text += str;
        if (item.hasEOL) text += "\n";
      }
    }
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    pageTextCacheRef.current.set(pageNumber, text);
    return text;
  }

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
        const doc = await pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false, disableAutoFetch: false, disableStream: false }).promise;
        if (cancelled) return;
        const initialPage = Math.min(Math.max(1, Number(initialPageRef.current || 1)), doc.numPages);
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
    return () => { cancelled = true; renderTaskRef.current?.cancel?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    async function renderCurrent() {
      if (!pdf || !textContainerRef.current) return;
      renderTaskRef.current?.cancel?.();
      const currentPage = await pdf.getPage(page);
      if (cancelled) return;
      try {
        const texto = await getPageText(pdf, page);
        if (cancelled) return;
        if (texto) {
          setPageText(texto);
          setCanvasFallback(false);
          return;
        }
      } catch { /* cai para canvas */ }
      if (cancelled) return;
      setPageText(null);
      setCanvasFallback(true);
      const viewport = currentPage.getViewport({ scale: 1 });
      const container = textContainerRef.current;
      if (!container) return;
      const largura = Math.max(240, container.clientWidth - 16);
      const altura = Math.max(320, container.clientHeight - 16);
      const fit = Math.min(largura / viewport.width, altura / viewport.height);
      const scale = Math.max(0.3, fit);
      const scaled = currentPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(scaled.width * dpr);
      canvas.height = Math.floor(scaled.height * dpr);
      canvas.style.width = `${Math.floor(scaled.width)}px`;
      canvas.style.height = `${Math.floor(scaled.height)}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, scaled.width, scaled.height);
      const task = currentPage.render({ canvasContext: context, viewport: scaled });
      renderTaskRef.current = task;
      try { await task.promise; } catch (err) { if (err?.name !== "RenderingCancelledException" && !cancelled) setError("Não foi possível renderizar esta página."); }
    }
    renderCurrent();
    return () => { cancelled = true; renderTaskRef.current?.cancel?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, page, canvasSize.width, canvasSize.height]);

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
    return () => { saveNow(); window.removeEventListener("pagehide", saveNow); window.removeEventListener("beforeunload", saveNow); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [book?.id, page, totalPages, updateReadingProgress]);

  useEffect(() => {
    const el = textContainerRef.current;
    if (!el) return undefined;
    function medir() {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCanvasSize((atual) => (atual.width === w && atual.height === h ? atual : { width: w, height: h }));
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

  const goNextPage = useCallback(() => {
    setPage((value) => Math.min(totalPages || value + 1, value + 1));
  }, [totalPages]);
  const goPrevPage = useCallback(() => {
    setPage((value) => Math.max(1, value - 1));
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const alvo = event.target;
      const digitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;
      if (digitando) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); goNextPage(); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goPrevPage(); }
      else if (event.key === "+" || event.key === "=") { event.preventDefault(); setFontSize((v) => Math.min(MAX_FONT_SIZE, v + 1)); }
      else if (event.key === "-") { event.preventDefault(); setFontSize((v) => Math.max(MIN_FONT_SIZE, v - 1)); }
      else if (event.key === "Escape") {
        if (showFontMenu) setShowFontMenu(false);
        else navigate(`/app/livro/${id}`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNextPage, goPrevPage, navigate, id, showFontMenu]);

  useEffect(() => {
    function onSelectionChange() {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!sel || sel.isCollapsed) { setSelectionMenu(null); return; }
      const range = sel.getRangeAt(0);
      const container = textContainerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) { setSelectionMenu(null); return; }
      const rect = range.getBoundingClientRect();
      if (!rect.width) { setSelectionMenu(null); return; }
      setSelectionMenu({ x: rect.left + rect.width / 2, y: rect.top });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function changeFontSize(value) {
    const v = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, value));
    setFontSize(v);
    try { window.localStorage.setItem("ope:reader-font-size", String(v)); } catch { /* ignore */ }
  }

  async function handleCopy() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado.");
      sel?.removeAllRanges();
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
    setSelectionMenu(null);
  }

  function handleShare() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text) return;
    const shareData = { title: book?.title || "OPE Club", text: text.slice(0, 500), url: typeof window !== "undefined" ? window.location.href : "" };
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareData.url || text).then(() => toast.success("Link copiado."));
    }
    setSelectionMenu(null);
  }

  function handleBookmark() {
    if (!book) return;
    toggleFavoriteBook(book.id).then(() => toast.success(favoritado ? "Removido dos favoritos." : "Salvo nos favoritos.")).catch((err) => toast.error(err?.message || "Não foi possível salvar."));
    setSelectionMenu(null);
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
          <button onClick={() => navigate("/app/lancamentos")} className="mt-5 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-card)]">
            Ver lançamentos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => navigate(`/app/livro/${id}`)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:size-10"
            aria-label="Fechar leitor"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{book.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{author?.name || book.authorName || book.author}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFontMenu((v) => !v)}
              className="flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--border)] px-2 text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:h-10"
              aria-label="Ajustar tamanho do texto"
            >
              <span className="text-sm font-semibold">A</span>
            </button>
            {showFontMenu ? (
              <div className="absolute right-0 top-11 z-30 w-44 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-[var(--shadow-sm)]">
                <p className="px-2 pb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Tamanho do texto</p>
                <div className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--hover-overlay)] p-1.5">
                  <button type="button" onClick={() => changeFontSize(fontSize - 1)} className="flex size-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]" aria-label="Diminuir">
                    <Minus className="size-4" />
                  </button>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{fontSize}px</span>
                  <button type="button" onClick={() => changeFontSize(fontSize + 1)} className="flex size-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]" aria-label="Aumentar">
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "P", size: 14 },
                    { label: "M", size: 17 },
                    { label: "G", size: 21 },
                    { label: "XG", size: 26 },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      onClick={() => changeFontSize(preset.size)}
                      className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                        fontSize === preset.size
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
                          : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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

      {/* Texto */}
      <div className="flex min-h-0 flex-1">
        <main
          ref={textContainerRef}
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
            if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
            if (window.getSelection()?.toString()) return;
            if (dx < 0) goNextPage(); else goPrevPage();
          }}
          className="relative flex min-h-0 flex-1 items-start justify-center overflow-y-auto bg-[var(--bg-canvas)] px-4 py-6 sm:px-8 sm:py-10"
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
          ) : pageText ? (
            <article className="mx-auto w-full max-w-[680px] select-text">
              <p
                className="whitespace-pre-wrap break-words text-[var(--text-primary)]"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.7, letterSpacing: "0.005em" }}
              >
                {pageText}
              </p>
            </article>
          ) : canvasFallback ? (
            <div className="flex h-full w-full items-center justify-center">
              <canvas ref={canvasRef} className="max-h-full max-w-full rounded-[6px] bg-white shadow-[var(--shadow-sm)]" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">Este livro ainda não tem PDF.</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Envie o arquivo pelo painel admin em Livros.</p>
              </div>
            </div>
          )}

          {/* Toolbar de selecao de texto */}
          {selectionMenu ? (
            <div
              className="fixed z-40 -translate-x-1/2 -translate-y-full"
              style={{ left: `${selectionMenu.x}px`, top: `${Math.max(48, selectionMenu.y - 12)}px` }}
            >
              <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-1 shadow-[var(--shadow-sm)]">
                <button type="button" onClick={handleCopy} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Copiar">
                  <Check className="size-4" />
                  <span className="text-xs font-medium">Copiar</span>
                </button>
                <button type="button" onClick={handleShare} className="flex size-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Compartilhar">
                  <Share2 className="size-4" />
                </button>
                <button type="button" onClick={handleBookmark} className="flex size-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Salvar nos favoritos">
                  <Bookmark className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {/* Barra inferior */}
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-5">
        <button
          type="button"
          onClick={goPrevPage}
          disabled={page <= 1}
          className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35 sm:h-11 sm:px-3"
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="size-5" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex shrink-0 flex-col items-end leading-tight">
            <p className="text-[11px] font-medium text-[var(--text-primary)] sm:text-xs">
              {page}/{totalPages || "..."}
            </p>
            <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">{progress}%</p>
          </div>
        </div>

        <button
          type="button"
          onClick={goNextPage}
          disabled={Boolean(totalPages) && page >= totalPages}
          className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-35 sm:h-11 sm:px-3"
          aria-label="Proxima pagina"
        >
          <span className="hidden sm:inline">Proxima</span>
          <ChevronRight className="size-5" />
        </button>
      </footer>
    </div>
  );
}
