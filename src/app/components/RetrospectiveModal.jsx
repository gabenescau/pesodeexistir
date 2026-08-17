import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, Copy, Download, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { copyShareText, downloadShareFile, openWhatsAppShare, shareArtwork } from "@/app/components/share-utils";
import { drawBrandFooter, drawBrandHeader, drawDivider, drawMetricIcon } from "@/app/components/share-artwork-style";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

function clean(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function wrapLines(ctx, value, maxWidth, maxLines = 3) {
  const words = clean(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  result[maxLines - 1] = `${result[maxLines - 1].slice(0, -3).trimEnd()}...`;
  return result;
}

function safeArtworkImageUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    const sameOrigin = url.origin === window.location.origin;
    const supabaseStorage = url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co");
    return sameOrigin || supabaseStorage ? url.href : "";
  } catch {
    return "";
  }
}

function loadArtworkImage(value) {
  const source = safeArtworkImageUrl(value);
  if (!source) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawFavoriteList(ctx, x, y, width, title, items, getLabel) {
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 27px Arial, sans-serif";
  ctx.fillText(title, x, y);

  const list = Array.isArray(items) && items.length ? items.slice(0, 5) : [{}];
  list.forEach((item, index) => {
    const label = clean(getLabel(item), "Sem registro");
    const line = wrapLines(ctx, label, width - 48, 1)[0] || "Sem registro";
    const rowY = y + 62 + index * 48;
    ctx.fillStyle = "#8d8d8d";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), x, rowY);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "400 22px Arial, sans-serif";
    ctx.fillText(line, x + 38, rowY);
  });
}

function drawCover(ctx, image, x, y, width, height, title) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 28);
  ctx.clip();
  ctx.fillStyle = "#303030";
  ctx.fillRect(x, y, width, height);
  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    const imageWidth = image.width * scale;
    const imageHeight = image.height * scale;
    ctx.drawImage(image, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight);
  } else {
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "700 24px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("OPE CLUB", x + width / 2, y + height / 2 - 14);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "400 20px Arial, sans-serif";
    wrapLines(ctx, title, width - 56, 3).forEach((line, index) => ctx.fillText(line, x + width / 2, y + height / 2 + 30 + index * 28));
    ctx.textAlign = "start";
  }
  ctx.restore();
}

async function createArtwork(snapshot, kind) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const period = clean(snapshot?.label, kind === "year" ? "seu ano" : "seu mês");
  const topBooks = Array.isArray(snapshot?.topBooks) && snapshot.topBooks.length
    ? snapshot.topBooks
    : [snapshot?.topBook].filter(Boolean);
  const topAuthors = Array.isArray(snapshot?.topAuthors) && snapshot.topAuthors.length
    ? snapshot.topAuthors
    : [snapshot?.topAuthor].filter(Boolean);
  const topBook = clean(topBooks[0]?.title, "Uma leitura marcante");
  const topAuthor = clean(topAuthors[0]?.name, "Autores que acompanharam você");
  const minutes = formatMinutes(snapshot?.minutes);
  const books = Number(snapshot?.booksStarted) || 0;
  const ratings = Number(snapshot?.ratings ?? snapshot?.reviews ?? 0) || 0;
  const coverImage = await loadArtworkImage(topBooks[0]?.image || snapshot?.topBook?.image);

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.fillStyle = "#171717";
  roundedRect(ctx, 40, 40, 1000, 1840, 36);
  ctx.fill();
  drawBrandHeader(ctx, { x: 100, y: 120, date: period.toUpperCase() });
  drawDivider(ctx, 100, 250, 880);

  ctx.fillStyle = "#a4a4a4";
  ctx.font = "700 25px Arial, sans-serif";
  ctx.fillText(kind === "year" ? "RETROSPECTIVA ANUAL" : "RETROSPECTIVA MENSAL", 100, 335);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 68px Arial, sans-serif";
  ctx.fillText(kind === "year" ? "Seu ano" : "Seu mês", 100, 425);
  ctx.fillText("em perspectiva", 100, 505);

  ctx.fillStyle = "#111111";
  roundedRect(ctx, 100, 590, 880, 350, 28);
  ctx.fill();
  drawCover(ctx, coverImage, 135, 625, 265, 280, topBook);
  ctx.fillStyle = "#a4a4a4";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("SEU DESTAQUE", 455, 700);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 42px Arial, sans-serif";
  wrapLines(ctx, topBook, 410, 3).forEach((line, index) => ctx.fillText(line, 455, 770 + index * 54));
  ctx.fillStyle = "#a4a4a4";
  ctx.font = "400 28px Arial, sans-serif";
  ctx.fillText(topAuthor, 455, 890);

  drawMetricIcon(ctx, "book", 190, 1005);
  drawMetricIcon(ctx, "clock", 500, 1005);
  drawMetricIcon(ctx, "star", 810, 1005);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 52px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(books), 224, 1150);
  ctx.fillText(minutes, 534, 1150);
  ctx.fillText(String(ratings), 844, 1150);
  ctx.fillStyle = "#a4a4a4";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText("LIVROS LIDOS", 224, 1195);
  ctx.fillText("TEMPO DE LEITURA", 534, 1195);
  ctx.fillText("AVALIAÇÕES", 844, 1195);
  ctx.textAlign = "start";

  drawDivider(ctx, 100, 1280, 880);
  drawFavoriteList(ctx, 100, 1360, 360, "LIVROS MAIS LIDOS", topBooks, (item) => item?.title);
  drawFavoriteList(ctx, 570, 1360, 360, "AUTORES MAIS LIDOS", topAuthors, (item) => item?.name);
  drawBrandFooter(ctx, { x: 100, y: 1720 });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a arte."))), "image/png");
  });
}

export function RetrospectiveModal({ data, initialKind = "month", open, onClose }) {
  const available = useMemo(() => ({ month: data?.month || null, year: data?.year || null }), [data]);
  const [kind, setKind] = useState(initialKind);
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkBlob, setArtworkBlob] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const snapshot = available[kind] || available.month || available.year;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/app/retrospectiva?period=${kind}`;
  }, [kind]);
  const fileName = `retrospectiva-${kind}-ope-club.png`;
  const message = `Minha retrospectiva ${clean(snapshot?.label, "no OPE Club")}: ${shareUrl}`;

  useEffect(() => {
    if (!open) return undefined;
    setKind(initialKind === "year" && available.year ? "year" : available.month ? "month" : "year");
    return undefined;
  }, [open, initialKind, available.year, available.month]);

  useEffect(() => {
    if (!open || !snapshot || !shareUrl) return undefined;
    let cancelled = false;
    setGenerating(true);
    setError("");
    createArtwork(snapshot, kind)
      .then((blob) => {
        if (cancelled) return;
        setArtworkBlob(blob);
        setArtworkUrl(URL.createObjectURL(blob));
      })
      .catch((cause) => { if (!cancelled) setError(cause?.message || "Nao foi possivel preparar a arte."); })
      .finally(() => { if (!cancelled) setGenerating(false); });
    return () => { cancelled = true; };
  }, [open, snapshot, kind, shareUrl]);

  useEffect(() => () => { if (artworkUrl) URL.revokeObjectURL(artworkUrl); }, [artworkUrl]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !snapshot) return null;

  function downloadArtwork() {
    if (!downloadShareFile({ blob: artworkBlob, url: artworkUrl, fileName })) return;
    toast.success("Arte pronta. Publique no Story do Instagram ou em outro app.");
  }

  async function shareNative() {
    try {
      const result = await shareArtwork({
        blob: artworkBlob,
        fileName,
        title: `Retrospectiva ${clean(snapshot.label)}`,
        text: message,
        url: shareUrl,
        onFallback: downloadArtwork,
      });
      if (result === "shared") toast.success("Compartilhamento aberto.");
    } catch (cause) {
      if (cause?.name !== "AbortError") toast.error("Nao foi possivel abrir o compartilhamento.");
    }
  }

  async function copyLink() {
    try { if (await copyShareText(shareUrl)) toast.success("Link da retrospectiva copiado."); else throw new Error("copy_failed"); }
    catch { toast.error("Nao foi possivel copiar o link."); }
  }

  function shareWhatsApp() {
    openWhatsAppShare(message);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Sua retrospectiva">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:max-w-[720px] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-mint)]">OPE Club</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Sua retrospectiva</h2></div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Fechar retrospectiva"><X className="size-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-5 py-3">
          {["month", "year"].map((option) => available[option] ? <button key={option} type="button" onClick={() => setKind(option)} className={`min-h-10 rounded-full px-4 text-xs font-semibold transition-colors ${kind === option ? "bg-[var(--text-primary)] text-[var(--bg-card)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"}`}>{option === "month" ? "Mensal" : "Anual"}</button> : null)}
        </div>
        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-[240px_1fr] sm:items-center">
          <div className="mx-auto w-[min(55vw,240px)] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)]">
            {generating ? <div className="flex aspect-[9/16] items-center justify-center p-5 text-center text-xs text-white/60">Preparando sua arte...</div> : artworkUrl ? <img src={artworkUrl} alt={`Retrospectiva ${snapshot.label} do OPE Club`} className="aspect-[9/16] w-full object-cover" /> : <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-red-300">{error || "Arte indisponivel"}</div>}
          </div>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">Um resumo da sua jornada de leitura. A arte foi feita para compartilhar em Stories, WhatsApp ou onde voce quiser.</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <div className="rounded-2xl border border-[var(--border)] p-3"><Clock className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{formatMinutes(snapshot.minutes)}</strong>de leitura</div>
              <div className="rounded-2xl border border-[var(--border)] p-3"><BookOpen className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.booksStarted || 0}</strong>livros iniciados</div>
            </div>
            <button type="button" onClick={shareNative} disabled={!artworkUrl || generating} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"><Share2 className="size-5" /> Compartilhar no celular</button>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={downloadArtwork} disabled={!artworkUrl || generating} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><Download className="size-4" /> Baixar para Story</button><button type="button" onClick={shareWhatsApp} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"><WhatsappLogo className="size-4" /> WhatsApp</button></div>
            <button type="button" onClick={copyLink} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"><Copy className="size-4" /> Copiar link da retrospectiva</button>
            <p className="text-center text-[10px] text-[var(--text-muted)]">No celular, o compartilhamento abre Instagram, WhatsApp e outros apps instalados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
