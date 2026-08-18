import { useEffect, useMemo, useState } from "react";
import { Copy, Download, InstagramLogo, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { copyShareText, downloadShareFile, openWhatsAppShare, shareArtwork } from "@/app/components/share-utils";
import { relativeTime } from "@/lib/social";
import { drawLogoMark } from "@/app/components/share-artwork-style";

const STORY_WIDTH = 1080;
const CARD_X = 80;
const CARD_Y = 100;
const CARD_WIDTH = 920;
const CARD_RADIUS = 44;
const CONTENT_X = 140;
const CONTENT_WIDTH = 800;

function clean(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return clean(value, "post").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "post";
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function wrapLines(ctx, value, maxWidth, maxLines = 6) {
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

function formatCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(".", ",")}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(".", ",")}K`;
  return count.toLocaleString("pt-BR");
}

async function createPostArtwork(post) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const author = clean(post?.author, "Leitor").slice(0, 80);
  const handle = clean(post?.handle, "leitor").slice(0, 32);
  const content = clean(post?.text, "").slice(0, 800);
  const avatar = await loadImage(post?.avatar || post?.authorProfile?.avatar || post?.authorProfile?.avatar_url);
  const imageSource = Array.isArray(post?.images) ? post.images[0] : post?.image;
  const image = await loadImage(imageSource);

  ctx.font = "400 38px Arial, sans-serif";
  const contentLines = wrapLines(ctx, content, CONTENT_WIDTH, 10);
  const contentY = 360;
  const lineHeight = 56;
  const contentHeight = Math.max(contentLines.length, 1) * lineHeight;
  const imageY = contentY + contentHeight + 38;
  const imageWidth = CONTENT_WIDTH;
  const imageHeight = image
    ? Math.min(900, Math.max(320, Math.round(imageWidth * (image.height / image.width))))
    : 0;
  const mediaBottom = image ? imageY + imageHeight : imageY;
  const footerY = mediaBottom + 72;
  const cardHeight = Math.max(430, footerY + 46 - CARD_Y);
  const canvasHeight = CARD_Y + cardHeight + 100;

  // The artwork is sized from its actual content. Posts without media do not
  // reserve a portrait image slot, while image posts keep a bounded ratio.
  canvas.width = STORY_WIDTH;
  canvas.height = canvasHeight;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, STORY_WIDTH, canvasHeight);
  ctx.fillStyle = "#0b0b0b";
  roundedRect(ctx, CARD_X, CARD_Y, CARD_WIDTH, cardHeight, CARD_RADIUS);
  ctx.fill();
  ctx.strokeStyle = "#292929";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawLogoMark(ctx, CARD_X + CARD_WIDTH - 76, CARD_Y + 40, 42);

  const avatarX = 140;
  const avatarY = 170;
  const avatarSize = 96;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    const scale = Math.max(avatarSize / avatar.width, avatarSize / avatar.height);
    const width = avatar.width * scale;
    const height = avatar.height * scale;
    ctx.drawImage(avatar, avatarX + (avatarSize - width) / 2, avatarY + (avatarSize - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#303030";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "700 42px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(author.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText(author, 270, 210);
  if (post?.verified) {
    ctx.fillStyle = "#2997ff";
    ctx.beginPath();
    ctx.arc(270 + ctx.measureText(author).width + 26, 199, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillText("✓", 270 + ctx.measureText(author).width + 19, 206);
  }
  ctx.fillStyle = "#8d8d8d";
  ctx.font = "400 25px Arial, sans-serif";
  ctx.fillText(`@${handle} · ${relativeTime(post?.created_at)}`, 270, 252);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "400 38px Arial, sans-serif";
  contentLines.forEach((line, index) => ctx.fillText(line, CONTENT_X, contentY + index * lineHeight));

  ctx.save();
  if (image) {
    roundedRect(ctx, CONTENT_X, imageY, imageWidth, imageHeight, 28);
    ctx.clip();
    const scale = Math.max(imageWidth / image.width, imageHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, CONTENT_X + (imageWidth - width) / 2, imageY + (imageHeight - height) / 2, width, height);
  }
  ctx.restore();

  const likes = formatCount(post?.likes);
  const replies = formatCount(post?.replies);
  ctx.fillStyle = "#969696";
  ctx.font = "400 23px Arial, sans-serif";
  ctx.fillText(`${likes} curtidas`, CONTENT_X, footerY);
  ctx.fillText(`${replies} respostas`, CONTENT_X + 220, footerY);
  const brandX = CONTENT_X + CONTENT_WIDTH - 168;
  drawLogoMark(ctx, brandX, footerY - 29, 32);
  ctx.fillStyle = "#d8d8d8";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.fillText("OPE CLUB", brandX + 46, footerY - 5);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nao foi possivel gerar a arte."))), "image/png");
  });
}

export function PostShareModal({ post, open, onClose }) {
  const [artworkUrl, setArtworkUrl] = useState("");
  const [artworkBlob, setArtworkBlob] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const postUrl = useMemo(() => {
    if (typeof window === "undefined" || !post?.id) return "";
    return `${window.location.origin}/app/post/${encodeURIComponent(post.id)}`;
  }, [post?.id]);
  const fileName = `${slug(post?.author)}-post-ope-club.png`;
  const message = `${clean(post?.author, "Leitor")}: ${clean(post?.text)}\n${postUrl}`;

  useEffect(() => {
    if (!open || !postUrl) return undefined;
    let cancelled = false;
    setGenerating(true);
    setError("");
    createPostArtwork(post)
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
  }, [open, post, postUrl]);

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
        title: `${clean(post?.author, "Post")} no OPE Club`,
        text: message,
        url: postUrl,
        onFallback: downloadArtwork,
      });
      if (result === "shared") toast.success("Compartilhamento aberto.");
    } catch (cause) {
      if (cause?.name !== "AbortError") toast.error("Nao foi possivel abrir o compartilhamento.");
    }
  }

  async function copyLink() {
    try {
      if (await copyShareText(postUrl)) toast.success("Link do post copiado.");
      else throw new Error("copy_failed");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Compartilhar post">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:max-w-[620px] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Compartilhar post</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Leve esta conversa com voce</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Fechar compartilhamento"><X className="size-5" /></button>
        </div>
        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-[220px_1fr] sm:items-center">
          <div className="mx-auto flex max-h-[62dvh] w-[min(54vw,220px)] items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border)] bg-black shadow-[var(--shadow-sm)] sm:w-full">
            {generating ? <div className="flex min-h-32 items-center justify-center p-4 text-xs text-white/60">Preparando arte...</div> : artworkUrl ? <img src={artworkUrl} alt="Arte de compartilhamento do post" className="block max-h-[62dvh] w-full object-contain" /> : <div className="flex min-h-32 items-center justify-center p-4 text-center text-xs text-red-300">{error || "Arte indisponivel"}</div>}
          </div>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">Compartilhe o post como imagem e leve seus amigos para a conversa no OPE Club.</p>
            <button type="button" onClick={shareNative} disabled={!artworkUrl || generating} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"><Share2 className="size-5" /> Compartilhar no celular</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={downloadArtwork} disabled={!artworkUrl || generating} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><InstagramLogo className="size-4" /> Baixar para Story</button>
              <button type="button" onClick={() => openWhatsAppShare(message)} disabled={!postUrl} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"><WhatsappLogo className="size-4" /> WhatsApp</button>
            </div>
            <button type="button" onClick={copyLink} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"><Copy className="size-4" /> Copiar link do post</button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)]"><Download className="size-3" /> OPE Club no rodape da arte</p>
          </div>
        </div>
      </div>
    </div>
  );
}
