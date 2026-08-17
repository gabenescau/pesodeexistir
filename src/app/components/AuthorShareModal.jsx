import { useEffect, useMemo, useState } from "react";
import { Copy, Download, InstagramLogo, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

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
  if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function createAuthorArtwork(author, books, authorUrl) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const authorName = text(author?.name, "Autor OPE Club").slice(0, 80);
  const era = text(author?.era, "Literatura e pensamento").slice(0, 80);
  const bio = text(author?.bio, "Descubra livros, ideias e conversas no OPE Club.").slice(0, 260);
  const image = await loadImage(author?.image);

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.fillStyle = "#171717";
  roundedRect(ctx, 76, 78, STORY_WIDTH - 152, STORY_HEIGHT - 156, 42);
  ctx.fill();

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 46px Arial, sans-serif";
  ctx.fillText("OPE", 140, 170);
  ctx.fillText("CLUB", 140, 220);
  ctx.fillStyle = "#8d8d8d";
  ctx.font = "400 25px Arial, sans-serif";
  ctx.fillText("uma comunidade para quem pensa junto", 140, 274);

  const imageX = 140;
  const imageY = 350;
  const imageSize = 800;
  ctx.save();
  roundedRect(ctx, imageX, imageY, imageSize, imageSize, 28);
  ctx.clip();
  if (image) {
    const scale = Math.max(imageSize / image.width, imageSize / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, imageX + (imageSize - width) / 2, imageY + (imageSize - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#303030";
    ctx.fillRect(imageX, imageY, imageSize, imageSize);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "700 240px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(authorName.charAt(0).toUpperCase(), imageX + imageSize / 2, imageY + imageSize / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 72px Arial, sans-serif";
  for (const [index, line] of wrapLines(ctx, authorName, 800, 2).entries()) {
    ctx.fillText(line, 140, 1260 + index * 86);
  }
  ctx.fillStyle = "#a9a9a9";
  ctx.font = "400 34px Arial, sans-serif";
  ctx.fillText(era, 140, 1450);

  ctx.fillStyle = "#d6d6d6";
  ctx.font = "400 30px Arial, sans-serif";
  wrapLines(ctx, bio, 800, 3).forEach((line, index) => ctx.fillText(line, 140, 1530 + index * 46));

  ctx.fillStyle = "#8d8d8d";
  ctx.font = "400 27px Arial, sans-serif";
  ctx.fillText(`${books.length} ${books.length === 1 ? "livro" : "livros"} na biblioteca`, 140, 1710);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "600 28px Arial, sans-serif";
  ctx.fillText("Conheca este autor no OPE Club", 140, 1790);
  ctx.fillStyle = "#888888";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText(authorUrl.replace(/^https?:\/\//, ""), 140, 1840);
  ctx.fillStyle = "#686868";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText("OPE CLUB  |  Biblioteca + comunidade", 140, 1900);

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
    createAuthorArtwork(author, books, authorUrl)
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

  async function downloadArtwork() {
    if (!artworkUrl) return;
    const anchor = document.createElement("a");
    anchor.href = artworkUrl;
    anchor.download = fileName;
    anchor.click();
    toast.success("Arte baixada. Agora voce pode publicar no Story.");
  }

  async function shareNative() {
    try {
      const file = artworkBlob ? new File([artworkBlob], fileName, { type: "image/png" }) : null;
      const shareData = { title: `${text(author?.name)} no OPE Club`, text: message, url: authorUrl };
      if (file && navigator.canShare?.({ files: [file] })) shareData.files = [file];
      if (!navigator.share) return downloadArtwork();
      await navigator.share(shareData);
    } catch (cause) {
      if (cause?.name !== "AbortError") toast.error("Nao foi possivel abrir o compartilhamento.");
    }
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(authorUrl);
      toast.success("Link do autor copiado.");
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
          <div className="mx-auto w-[min(54vw,220px)] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)] sm:w-full">
            {generating ? <div className="flex aspect-[9/16] items-center justify-center text-xs text-white/60">Preparando arte...</div> : artworkUrl ? <img src={artworkUrl} alt={`Arte de compartilhamento de ${author?.name || "autor"}`} className="aspect-[9/16] w-full object-cover" /> : <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-red-300">{error || "Arte indisponivel"}</div>}
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
            <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)]"><Download className="size-3" /> OPE Club no rodape da arte</p>
          </div>
        </div>
      </div>
    </div>
  );
}
