import { useEffect, useMemo, useState } from "react";
import { Copy, Download, InstagramLogo, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { copyShareImage, copyShareText, downloadShareFile, openWhatsAppShare, shareArtwork } from "@/app/components/share-utils";
import { drawBrandFooter, drawBrandHeader } from "@/app/components/share-artwork-style";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1620;

function text(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return text(value, "autor").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "autor";
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function wrapLines(ctx, value, maxWidth, maxLines = 4) {
  const words = text(value).split(" ").filter(Boolean);
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

async function createAuthorArtwork(author) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const authorName = text(author?.name, "Albert Camus").slice(0, 80);
  const era = text(author?.era || author?.theme, "Século XX").slice(0, 80);
  const image = await loadImage(author?.image);
  const opeLogo = await loadImage("/ope-official-logo.png");

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  const cardX = 151;
  const cardY = 166;
  const cardW = 778;
  const cardR = 34;

  const textX = 214;
  const textY = 968;
  ctx.font = "700 62px Arial, sans-serif";
  const nameLines = wrapLines(ctx, authorName, 650, 2);
  const eraY = textY + 78 + (nameLines.length - 1) * 70 + 66;
  const footerY = eraY + 104;
  const cardH = footerY + 82 - cardY;

  ctx.fillStyle = "#121214";
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fill();

  ctx.strokeStyle = "#242427";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.stroke();

  drawBrandHeader(ctx, { x: 214, y: 228, logoImage: opeLogo });

  const photoX = 270;
  const photoY = 350;
  const photoSize = 540;
  const photoRadius = 28;

  ctx.save();
  roundedRect(ctx, photoX, photoY, photoSize, photoSize, photoRadius);
  ctx.clip();

  if (image) {
    const scale = Math.max(photoSize / image.width, photoSize / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, photoX + (photoSize - width) / 2, photoY + (photoSize - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#222226";
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 180px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(authorName.charAt(0).toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  ctx.fillStyle = "#888888";
  ctx.font = "700 23px Arial, sans-serif";
  ctx.fillText("AUTOR", textX, textY);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 62px Arial, sans-serif";
  nameLines.forEach((line, index) => {
    ctx.fillText(line, textX, textY + 78 + index * 70);
  });

  ctx.fillStyle = "#888888";
  ctx.font = "400 30px Arial, sans-serif";
  ctx.fillText(era, textX, eraY);

  drawBrandFooter(ctx, { x: textX, y: footerY, width: 650, logoImage: opeLogo });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a arte."))), "image/png");
  });
}

export function AuthorShareModal({ author, books = [], open, onClose }) {
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkBlob, setArtworkBlob] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const authorUrl = useMemo(() => {
    if (typeof window === "undefined" || !author?.id) return "";
    return `${window.location.origin}/app/autor/${encodeURIComponent(author.id)}`;
  }, [author?.id]);
  const fileName = `${slug(author?.name)}-ope-club.png`;
  const message = `Conheca ${text(author?.name, "este autor")} no OPE Club: ${authorUrl}`;

  useEffect(() => {
    if (!open || !authorUrl) return undefined;
    let cancelled = false;
    setGenerating(true);
    setError("");
    createAuthorArtwork(author)
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
  }, [open, author, books, authorUrl]);

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
        title: `${text(author?.name)} no OPE Club`,
        text: message,
        url: authorUrl,
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

  async function copyImage() {
    const copied = await copyShareImage({ blob: artworkBlob, url: artworkUrl });
    if (copied) toast.success("Imagem copiada. Cole no Story ou em uma conversa.");
    else toast.info("Seu navegador nao permite copiar imagens diretamente. Use Compartilhar no celular.");
  }

  async function copyLink() {
    try {
      if (await copyShareText(authorUrl)) {
      toast.success("Link do autor copiado.");
      } else throw new Error("copy_failed");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Compartilhar autor">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:max-w-[620px] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Compartilhar autor</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Leve esta descoberta com voce</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Fechar compartilhamento">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-[220px_1fr] sm:items-center">
          <div className="mx-auto flex max-h-[62dvh] w-[min(54vw,220px)] items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)] sm:w-full">
            {generating ? <div className="flex min-h-32 items-center justify-center p-4 text-xs text-white/60">Preparando arte...</div> : artworkUrl ? <img src={artworkUrl} alt={`Arte de compartilhamento de ${author?.name || "autor"}`} className="block max-h-[62dvh] w-full object-contain" /> : <div className="flex min-h-32 items-center justify-center p-4 text-center text-xs text-red-300">{error || "Arte indisponivel"}</div>}
          </div>

          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">No celular, o botao de compartilhar abre as opcoes instaladas, como Instagram e WhatsApp. O link do autor acompanha a arte.</p>
            <button type="button" onClick={shareNative} disabled={!artworkUrl || generating} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50">
              <Share2 className="size-5" /> Compartilhar no celular
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={downloadArtwork} disabled={!artworkUrl || generating} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50">
                <InstagramLogo className="size-4" /> Baixar para Story
              </button>
              <button type="button" onClick={shareWhatsApp} disabled={!authorUrl} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50">
                <WhatsappLogo className="size-4" /> WhatsApp
              </button>
            </div>
            <button type="button" onClick={copyLink} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <Copy className="size-4" /> Copiar link do autor
            </button>
            <button type="button" onClick={copyImage} disabled={!artworkUrl || generating} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50">
              <Copy className="size-4" /> Copiar imagem
            </button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)]"><Download className="size-3" /> OPE Club no rodape da arte</p>
          </div>
        </div>
      </div>
    </div>
  );
}
