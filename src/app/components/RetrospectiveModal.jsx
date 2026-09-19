import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, Copy, Download, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { copyShareImage, copyShareText, downloadShareFile, openWhatsAppShare, shareArtwork } from "@/app/components/share-utils";
import { drawBrandFooter, drawBrandHeader, drawDivider, drawMetricIcon } from "@/app/components/share-artwork-style";
import { publicStorageUrl } from "@/lib/library-media";

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

function artworkImageSources(item) {
  const values = [
    item?.image,
    item?.image_url,
    item?.cover_url,
    item?.cover,
    item?.image_path,
    item?.cover_path,
  ].filter(Boolean);

  return [...new Set(values.flatMap((value) => {
    const raw = clean(value);
    if (!raw) return [];
    const direct = safeArtworkImageUrl(raw);
    if (direct) return [direct];
    const legacyPath = raw.replace(/^\/+/, "");
    const legacyAsset = /^(?:livros|autores|public\/livros|public\/autores)\//i.test(legacyPath)
      ? `/${legacyPath}`
      : /^[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(legacyPath)
        ? `/livros/${legacyPath}`
        : "";
    const storagePath = raw.replace(/^\/?covers\//i, "");
    const storageUrl = publicStorageUrl("covers", storagePath);
    return [legacyAsset, storageUrl].filter(Boolean);
  }))];
}

function loadArtworkImage(item) {
  const sources = Array.isArray(item) ? item : artworkImageSources(item);
  if (!sources.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      const source = safeArtworkImageUrl(sources[index]);
      if (!source) {
        index += 1;
        if (index < sources.length) tryNext();
        else resolve(null);
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        index += 1;
        if (index < sources.length) tryNext();
        else resolve(null);
      };
      image.src = source;
    };
    tryNext();
  });
}

function drawFavoriteList(ctx, x, y, width, items, getLabel) {
  const list = Array.isArray(items) && items.length ? items.slice(0, 5) : [];
  if (!list.length) {
    ctx.fillStyle = "#666666";
    ctx.font = "400 22px Arial, sans-serif";
    ctx.fillText("Sem registros", x, y);
    return;
  }
  list.forEach((item, index) => {
    const label = clean(getLabel(item), "Sem registro");
    const line = wrapLines(ctx, label, width - 50, 1)[0] || "Sem registro";
    const rowY = y + index * 46;
    ctx.fillStyle = "#666666";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), x, rowY);
    ctx.fillStyle = "#d4d4d4";
    ctx.font = "400 22px Arial, sans-serif";
    ctx.fillText(line, x + 42, rowY);
  });
}

function drawCover(ctx, image, x, y, width, height, title) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 20);
  ctx.clip();
  ctx.fillStyle = "#222226";
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
    ctx.fillStyle = "#a4a4a4";
    ctx.font = "400 18px Arial, sans-serif";
    wrapLines(ctx, title, width - 40, 2).forEach((line, index) => ctx.fillText(line, x + width / 2, y + height / 2 + 25 + index * 24));
    ctx.textAlign = "start";
  }
  ctx.restore();
}

export async function createArtwork(snapshot, kind) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const period = clean(snapshot?.label, kind === "year" ? "ANO ATUAL" : "MES ATUAL");
  const rawTopBooks = Array.isArray(snapshot?.topBooks) && snapshot.topBooks.length
    ? snapshot.topBooks
    : [snapshot?.topBook].filter(Boolean);
  const topBooks = rawTopBooks;

  const rawTopAuthors = Array.isArray(snapshot?.topAuthors) && snapshot.topAuthors.length
    ? snapshot.topAuthors
    : [snapshot?.topAuthor].filter(Boolean);
  const topAuthors = rawTopAuthors;

  const topBook = clean(topBooks[0]?.title, "Sem destaque");
  const topAuthor = clean(topAuthors[0]?.name, "Sem autor registrado");
  const minutes = formatMinutes(snapshot?.minutes);
  const books = Number(snapshot?.booksStarted) || 0;
  const ratings = Number(snapshot?.ratings ?? snapshot?.reviews ?? 0) || 0;
  const coverImage = await loadArtworkImage(topBooks[0] || snapshot?.topBook);
  const opeLogo = await loadArtworkImage("/ope-official-logo.png");

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const cardX = 112;
  const cardY = 100;
  const cardW = 856;
  const cardH = 1720;
  const cardR = 48;

  ctx.fillStyle = "#121214";
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fill();

  ctx.strokeStyle = "#242427";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.stroke();

  drawBrandHeader(ctx, { x: 150, y: 160, date: period.toUpperCase(), logoImage: opeLogo });
  drawDivider(ctx, 150, 310, 780);

  ctx.fillStyle = "#888888";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText(kind === "year" ? "RETROSPECTIVA ANUAL" : "RETROSPECTIVA MENSAL", 150, 390);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px Arial, sans-serif";
  ctx.fillText(kind === "year" ? "Seu ano" : "Seu mes", 150, 470);
  ctx.fillText("em perspectiva", 150, 545);

  const hX = 150;
  const hY = 605;
  const hW = 780;
  const hH = 340;
  const hR = 26;

  ctx.fillStyle = "#17171a";
  roundedRect(ctx, hX, hY, hW, hH, hR);
  ctx.fill();

  ctx.strokeStyle = "#242427";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, hX, hY, hW, hH, hR);
  ctx.stroke();

  drawCover(ctx, coverImage, 180, 635, 220, 280, topBook);

  const textX = 430;
  ctx.fillStyle = "#888888";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("SEU DESTAQUE", textX, 700);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px Arial, sans-serif";
  const titleLines = wrapLines(ctx, topBook, 460, 3);
  titleLines.forEach((line, index) => ctx.fillText(line, textX, 760 + index * 48));

  ctx.fillStyle = "#888888";
  ctx.font = "400 28px Arial, sans-serif";
  ctx.fillText(topAuthor, textX, 875);

  ctx.save();
  ctx.strokeStyle = "#242427";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(410, 1030);
  ctx.lineTo(410, 1220);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(670, 1030);
  ctx.lineTo(670, 1220);
  ctx.stroke();
  ctx.restore();

  drawMetricIcon(ctx, "book", 246, 1000);
  drawMetricIcon(ctx, "clock", 506, 1000);
  drawMetricIcon(ctx, "star", 766, 1000);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 52px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(books), 280, 1145);

  ctx.font = "700 44px Arial, sans-serif";
  ctx.fillText(minutes, 540, 1145);

  ctx.font = "700 52px Arial, sans-serif";
  ctx.fillText(String(ratings), 800, 1145);

  ctx.fillStyle = "#888888";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.fillText("LIVROS LIDOS", 280, 1195);
  ctx.fillText("TEMPO DE LEITURA", 540, 1195);
  ctx.fillText("AVALIACOES", 800, 1195);
  ctx.textAlign = "start";

  drawDivider(ctx, 150, 1270, 780);

  ctx.save();
  ctx.strokeStyle = "#242427";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(540, 1300);
  ctx.lineTo(540, 1610);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#888888";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("LIVROS MAIS LIDOS", 150, 1325);
  drawFavoriteList(ctx, 150, 1375, 350, topBooks, (item) => item?.title);

  ctx.fillStyle = "#888888";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText("AUTORES MAIS LIDOS", 580, 1325);
  drawFavoriteList(ctx, 580, 1375, 350, topAuthors, (item) => item?.name);

  drawBrandFooter(ctx, { x: 150, y: 1660, logoImage: opeLogo });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a arte."))), "image/png");
  });
}

export function RetrospectiveArtworkPreview({ data, kind = "month" }) {
  const snapshot = data?.[kind];
  const [artworkUrl, setArtworkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!snapshot?.hasData) {
      setArtworkUrl("");
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    createArtwork(snapshot, kind)
      .then((blob) => {
        if (cancelled) return;
        setArtworkUrl(URL.createObjectURL(blob));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause?.message || "Nao foi possivel preparar a previa.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [snapshot, kind]);

  useEffect(() => () => {
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
  }, [artworkUrl]);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Previa da arte</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Gerada com os seus dados reais.</p>
        </div>
        {snapshot?.label ? <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{snapshot.label}</span> : null}
      </div>
      <div className="mx-auto w-[min(100%,220px)] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)] sm:mx-0">
        {loading ? <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-white/60">Preparando previa...</div> : artworkUrl ? <img src={artworkUrl} alt={`Previa da retrospectiva ${snapshot?.label || "atual"}`} className="aspect-[9/16] w-full object-cover" /> : <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-[var(--text-muted)]">{error || "A previa aparece depois da sua primeira atividade de leitura."}</div>}
      </div>
    </div>
  );
}

export function RetrospectiveModal({ data, initialKind = "month", open, onClose }) {
  const available = useMemo(() => ({
    month: data?.month || null,
    previousMonth: data?.previousMonth || null,
    year: data?.year || null,
  }), [data]);
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
    const preferred = initialKind === "previousMonth" ? "previousMonth" : initialKind === "year" ? "year" : "month";
    setKind(available[preferred] ? preferred : available.month ? "month" : available.previousMonth ? "previousMonth" : "year");
    return undefined;
  }, [open, initialKind, available.year, available.month, available.previousMonth]);

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
    if (snapshot?.canShare === false) {
      toast.info("O compartilhamento sera liberado quando o mes terminar.");
      return;
    }
    if (!downloadShareFile({ blob: artworkBlob, url: artworkUrl, fileName })) return;
    toast.success("Arte pronta. Publique no Story do Instagram ou em outro app.");
  }

  async function shareNative() {
    if (snapshot?.canShare === false) {
      toast.info("O compartilhamento sera liberado quando o mes terminar.");
      return;
    }
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

  async function copyImage() {
    if (snapshot?.canShare === false) {
      toast.info("O compartilhamento sera liberado quando o mes terminar.");
      return;
    }
    const copied = await copyShareImage({ blob: artworkBlob, url: artworkUrl });
    if (copied) toast.success("Imagem copiada. Cole no Story ou em uma conversa.");
    else toast.info("Seu navegador nao permite copiar imagens diretamente. Use Compartilhar no celular.");
  }

  async function copyLink() {
    if (snapshot?.canShare === false) {
      toast.info("O compartilhamento sera liberado quando o mes terminar.");
      return;
    }
    try { if (await copyShareText(shareUrl)) toast.success("Link da retrospectiva copiado."); else throw new Error("copy_failed"); }
    catch { toast.error("Nao foi possivel copiar o link."); }
  }

  function shareWhatsApp() {
    if (snapshot?.canShare === false) {
      toast.info("O compartilhamento sera liberado quando o mes terminar.");
      return;
    }
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
          {["month", "previousMonth", "year"].map((option) => available[option] ? <button key={option} type="button" onClick={() => setKind(option)} className={`min-h-10 rounded-full px-4 text-xs font-semibold transition-colors ${kind === option ? "bg-[var(--text-primary)] text-[var(--bg-card)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"}`}>{option === "month" ? "Mensal ao vivo" : option === "previousMonth" ? "Mes encerrado" : "Anual"}</button> : null)}
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
            <button type="button" onClick={shareNative} disabled={!artworkUrl || generating || snapshot?.canShare === false} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"><Share2 className="size-5" /> Compartilhar no celular</button>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={downloadArtwork} disabled={!artworkUrl || generating || snapshot?.canShare === false} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><Download className="size-4" /> Baixar para Story</button><button type="button" onClick={shareWhatsApp} disabled={snapshot?.canShare === false} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><WhatsappLogo className="size-4" /> WhatsApp</button></div>
             <button type="button" onClick={copyLink} disabled={snapshot?.canShare === false} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><Copy className="size-4" /> Copiar link da retrospectiva</button>
             <button type="button" onClick={copyImage} disabled={!artworkUrl || generating || snapshot?.canShare === false} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><Copy className="size-4" /> Copiar imagem</button>
            <p className="text-center text-[10px] text-[var(--text-muted)]">{snapshot?.canShare === false ? "A retrospectiva mensal ao vivo fica disponivel para compartilhar quando o mes terminar." : "No celular, o compartilhamento abre Instagram, WhatsApp e outros apps instalados."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
