import { useEffect, useMemo, useState } from "react";
import { BookOpen, Copy, InstagramLogo, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { copyShareText, downloadShareFile, openWhatsAppShare, shareArtwork } from "@/app/components/share-utils";
import { drawBookmarkIcon, drawBrandFooter, drawBrandHeader, drawDivider, drawPersonIcon, drawQuoteIcon } from "@/app/components/share-artwork-style";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1620;

function clean(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return clean(value, "livro").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "livro";
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function wrapLines(ctx, value, maxWidth, maxLines = 3) {
  const lines = [];
  let line = "";
  for (const word of clean(value).split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  result[maxLines - 1] = `${result[maxLines - 1].slice(0, -3).trimEnd()}...`;
  return result;
}

function loadImage(url) {
  if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith("/"))) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function createBookArtwork(book, authorName, readingProgress, currentPage, totalPages) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const title = clean(book?.title, "Declínio de um homem").slice(0, 100);
  const author = clean(authorName || book?.authorName || book?.author, "Osamu Dazai").slice(0, 80);
  const genre = clean(book?.category || book?.genre || book?.tags?.[0], "Existencialismo").slice(0, 50);
  const synopsis = clean(
    book?.bio || book?.synopsis || book?.description,
    "Yozo Oba narra sua própria vida marcada pela sensação de desencaixe e inadequação perante a sociedade."
  );
  const progress = Math.min(100, Math.max(0, Number(readingProgress) || 0));
  const page = Math.max(1, Number(currentPage) || 1);
  const pages = Math.max(0, Number(totalPages) || 0);
  const cover = await loadImage(book?.image);
  const opeLogo = await loadImage("/ope-share-logo.png");

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const cardX = 48;
  const cardY = 60;
  const cardW = 984;
  const cardH = 1488;
  const cardR = 34;

  ctx.fillStyle = "#121214";
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fill();

  ctx.strokeStyle = "#222225";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.stroke();

  drawBrandHeader(ctx, { x: 112, y: 134, logoImage: opeLogo });
  drawDivider(ctx, 112, 252, 856);

  ctx.fillStyle = "#888888";
  ctx.font = "700 25px Arial, sans-serif";
  ctx.fillText("LENDO NO MOMENTO", 112, 352);

  const coverX = 112;
  const coverY = 404;
  const coverWidth = 430;
  const coverHeight = 710;
  const coverRadius = 26;

  ctx.fillStyle = "#222224";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  roundedRect(ctx, coverX, coverY, coverWidth, coverHeight, coverRadius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (cover) {
    const scale = Math.max(coverWidth / cover.width, coverHeight / cover.height);
    const width = cover.width * scale;
    const height = cover.height * scale;
    ctx.save();
    roundedRect(ctx, coverX, coverY, coverWidth, coverHeight, coverRadius);
    ctx.clip();
    ctx.drawImage(cover, coverX + (coverWidth - width) / 2, coverY + (coverHeight - height) / 2, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "#26262a";
    roundedRect(ctx, coverX, coverY, coverWidth, coverHeight, coverRadius);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 90px Arial, sans-serif";
    ctx.fillText("OPE", coverX + 100, coverY + 320);
    ctx.font = "400 32px Arial, sans-serif";
    ctx.fillText("capa indisponivel", coverX + 80, coverY + 380);
  }

  const textX = 590;
  const maxRightWidth = 360;

  ctx.fillStyle = "#888888";
  ctx.font = "700 23px Arial, sans-serif";
  ctx.fillText("LEITURA", textX, 488);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 52px Arial, sans-serif";
  const titleLines = wrapLines(ctx, title, maxRightWidth, 3);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, textX, 558 + index * 62);
  });

  const authorY = 558 + (titleLines.length - 1) * 62 + 65;

  ctx.fillStyle = "#888888";
  ctx.font = "400 31px Arial, sans-serif";
  ctx.fillText(author, textX, authorY);

  const dividerY = authorY + 45;
  drawDivider(ctx, textX, dividerY, maxRightWidth);

  let metaY = dividerY + 48;

  drawPersonIcon(ctx, textX, metaY - 16, "#888888");
  ctx.fillStyle = "#777777";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText("Autor", textX + 38, metaY - 2);
  ctx.fillStyle = "#cccccc";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(wrapLines(ctx, author, maxRightWidth - 38, 1)[0] || author, textX + 38, metaY + 28);

  metaY += 88;

  drawBookmarkIcon(ctx, textX, metaY - 16, "#888888");
  ctx.fillStyle = "#777777";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText("Gênero", textX + 38, metaY - 2);
  ctx.fillStyle = "#cccccc";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(wrapLines(ctx, genre, maxRightWidth - 38, 1)[0] || genre, textX + 38, metaY + 28);

  metaY += 88;

  drawQuoteIcon(ctx, textX, metaY - 16, "#888888");
  ctx.fillStyle = "#777777";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText("Sinopse", textX + 38, metaY - 2);
  ctx.fillStyle = "#999999";
  ctx.font = "400 20px Arial, sans-serif";
  const synopsisLines = wrapLines(ctx, synopsis, maxRightWidth - 38, 2);
  synopsisLines.forEach((line, index) => {
    ctx.fillText(line, textX + 38, metaY + 26 + index * 28);
  });

  const progBoxY = 1250;
  ctx.fillStyle = "#171719";
  roundedRect(ctx, 150, progBoxY, 780, 215, 26);
  ctx.fill();

  ctx.strokeStyle = "#222225";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, 150, progBoxY, 780, 215, 26);
  ctx.stroke();

  ctx.fillStyle = "#888888";
  ctx.font = "700 23px Arial, sans-serif";
  ctx.fillText("PROGRESSO DA LEITURA", 185, progBoxY + 52);

  const barY = progBoxY + 88;
  const barWidth = 710;
  ctx.fillStyle = "#28282c";
  roundedRect(ctx, 185, barY, barWidth, 14, 7);
  ctx.fill();

  const filledWidth = Math.max(14, barWidth * (progress / 100));
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, 185, barY, filledWidth, 14, 7);
  ctx.fill();

  ctx.fillStyle = "#888888";
  ctx.font = "400 23px Arial, sans-serif";
  ctx.fillText(`${progress}% lido`, 185, progBoxY + 160);

  ctx.textAlign = "right";
  ctx.fillText(pages > 0 ? `página ${Math.min(page, pages)} de ${pages}` : `página ${page}`, 895, progBoxY + 160);
  ctx.textAlign = "start";

  drawBrandFooter(ctx, { x: 112, y: 1500, width: 856, logoImage: opeLogo });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a arte."))), "image/png");
  });
}


export function BookShareModal({ book, authorName, readingProgress, currentPage, totalPages, open, onClose }) {
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkBlob, setArtworkBlob] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const bookUrl = useMemo(() => {
    if (typeof window === "undefined" || !book?.id) return "";
    return `${window.location.origin}/app/livro/${encodeURIComponent(book.id)}`;
  }, [book?.id]);
  const fileName = `${slug(book?.title)}-ope-club.png`;
  const progressValue = Math.min(100, Math.max(0, Number(readingProgress ?? book?.progress) || 0));
  const message = `Estou lendo "${clean(book?.title, "este livro")}" (${progressValue}% concluido) no OPE Club: ${bookUrl}`;

  useEffect(() => {
    if (!open || !bookUrl) return undefined;
    let cancelled = false;
    setGenerating(true);
    setError("");
    createBookArtwork(book, authorName, progressValue, currentPage ?? book?.currentPage, totalPages ?? book?.totalPages)
      .then((blob) => {
        if (cancelled) return;
        setArtworkBlob(blob);
        setArtworkUrl(URL.createObjectURL(blob));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause?.message || "Nao foi possivel preparar a arte.");
      })
      .finally(() => { if (!cancelled) setGenerating(false); });
    return () => { cancelled = true; };
  }, [open, book, authorName, bookUrl, progressValue, currentPage, totalPages]);

  useEffect(() => () => {
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
  }, [artworkUrl]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function downloadArtwork() {
    if (!downloadShareFile({ blob: artworkBlob, url: artworkUrl, fileName })) return;
    toast.success("Arte pronta. Publique no Story do Instagram ou em outro app.");
  }

  async function shareNative() {
    try {
      const result = await shareArtwork({
        blob: artworkBlob,
        fileName,
        title: `${clean(book?.title)} no OPE Club`,
        text: message,
        url: bookUrl,
        onFallback: downloadArtwork,
      });
      if (result === "shared") toast.success("Compartilhamento aberto.");
    } catch (cause) {
      if (cause?.name !== "AbortError") toast.error("Nao foi possivel abrir o compartilhamento.");
    }
  }

  function shareWhatsApp() {
    openWhatsAppShare(message);
  }

  async function copyLink() {
    try {
      if (await copyShareText(bookUrl)) toast.success("Link do livro copiado.");
      else throw new Error("copy_failed");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Compartilhar livro">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:max-w-[620px] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Compartilhar livro</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Uma leitura para levar adiante</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Fechar compartilhamento">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-[220px_1fr] sm:items-center">
          <div className="mx-auto flex max-h-[62dvh] w-[min(54vw,220px)] items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)] sm:w-full">
            {generating ? <div className="flex min-h-32 items-center justify-center p-4 text-xs text-white/60">Preparando arte...</div> : artworkUrl ? <img src={artworkUrl} alt={`Arte de compartilhamento de ${book?.title || "livro"}`} className="block max-h-[62dvh] w-full object-contain" /> : <div className="flex min-h-32 items-center justify-center p-4 text-center text-xs text-red-300">{error || "Arte indisponivel"}</div>}
          </div>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">Compartilhe a capa e leve seus amigos para a pagina deste livro no OPE Club.</p>
            <div className="rounded-2xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Seu progresso</span>
                <strong className="text-[var(--text-primary)]">{progressValue}%</strong>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hover-overlay)]"><div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${progressValue}%` }} /></div>
              {Number(totalPages ?? book?.totalPages) > 0 && <p className="mt-2 text-[10px] text-[var(--text-muted)]">Pagina {Math.min(Number(currentPage ?? book?.currentPage) || 1, Number(totalPages ?? book?.totalPages))} de {Number(totalPages ?? book?.totalPages)}</p>}
            </div>
            <button type="button" onClick={shareNative} disabled={!artworkUrl || generating} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50">
              <Share2 className="size-5" /> Compartilhar no celular
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={downloadArtwork} disabled={!artworkUrl || generating} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50">
                <InstagramLogo className="size-4" /> Baixar para Story
              </button>
              <button type="button" onClick={shareWhatsApp} disabled={!bookUrl} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50">
                <WhatsappLogo className="size-4" /> WhatsApp
              </button>
            </div>
            <button type="button" onClick={copyLink} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <Copy className="size-4" /> Copiar link do livro
            </button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)]"><BookOpen className="size-3" /> OPE Club no rodape da arte</p>
          </div>
        </div>
      </div>
    </div>
  );
}
