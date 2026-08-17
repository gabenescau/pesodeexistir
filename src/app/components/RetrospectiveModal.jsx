import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChatCircle, Clock, Copy, Download, Share2, WhatsappLogo, X } from "@/lib/icons";
import { toast } from "@/lib/toast";

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

function drawMetric(ctx, x, y, value, label) {
  ctx.fillStyle = "#f2f4ee";
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillText(value, x, y);
  ctx.fillStyle = "#9ca89e";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText(label, x, y + 40);
}

function drawButton(ctx, x, y, width, label) {
  ctx.fillStyle = "#b9f36b";
  roundedRect(ctx, x, y, width, 76, 38);
  ctx.fill();
  ctx.fillStyle = "#11150f";
  ctx.font = "700 25px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + width / 2, y + 48);
  ctx.textAlign = "start";
}

function drawCover(ctx, image, x, y, width, height, title) {
  ctx.save();
  roundedRect(ctx, x, y, width, height, 28);
  ctx.clip();
  ctx.fillStyle = "#252d25";
  ctx.fillRect(x, y, width, height);
  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    const imageWidth = image.width * scale;
    const imageHeight = image.height * scale;
    ctx.drawImage(image, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight);
  } else {
    ctx.fillStyle = "#b9f36b";
    ctx.font = "700 24px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("OPE CLUB", x + width / 2, y + height / 2 - 14);
    ctx.fillStyle = "#f2f4ee";
    ctx.font = "400 20px Arial, sans-serif";
    wrapLines(ctx, title, width - 56, 3).forEach((line, index) => ctx.fillText(line, x + width / 2, y + height / 2 + 30 + index * 28));
    ctx.textAlign = "start";
  }
  ctx.restore();
}

async function createArtwork(snapshot, kind, shareUrl) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador nao conseguiu criar a arte.");

  const period = clean(snapshot?.label, kind === "year" ? "seu ano" : "seu mes");
  const topBook = clean(snapshot?.topBook?.title, "Uma leitura marcante");
  const topAuthor = clean(snapshot?.topAuthor?.name, "Autores que acompanharam voce");
  const minutes = formatMinutes(snapshot?.minutes);
  const books = Number(snapshot?.booksStarted) || 0;
  const posts = Number(snapshot?.posts) || 0;
  const comments = Number(snapshot?.comments) || 0;
  const isDemo = snapshot?.isDemo === true;
  const coverImage = await loadArtworkImage(snapshot?.topBook?.image);

  ctx.fillStyle = "#060706";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.fillStyle = "#151914";
  roundedRect(ctx, 112, 190, 856, 1540, 48);
  ctx.fill();

  ctx.fillStyle = "#b9f36b";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText("OPE CLUB", 184, 300);
  ctx.fillStyle = "#9ca89e";
  ctx.font = "400 23px Arial, sans-serif";
  ctx.fillText(kind === "year" ? "retrospectiva anual" : "retrospectiva mensal", 184, 345);
  if (isDemo) {
    ctx.fillStyle = "#b9f36b";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillText("PREVIA COM DADOS FICTICIOS", 184, 380);
  }

  ctx.fillStyle = "#f2f4ee";
  ctx.font = "700 67px Arial, sans-serif";
  ctx.fillText("Sua leitura", 184, 490);
  ctx.fillText("em perspectiva", 184, 570);
  ctx.fillStyle = "#b9f36b";
  ctx.font = "700 31px Arial, sans-serif";
  ctx.fillText(period, 184, 632);

  ctx.strokeStyle = "#394438";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(184, 700);
  ctx.lineTo(896, 700);
  ctx.stroke();

  drawCover(ctx, coverImage, 184, 740, 282, 350, topBook);
  ctx.fillStyle = "#9ca89e";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText("Seu destaque do periodo", 520, 805);
  ctx.fillStyle = "#f2f4ee";
  ctx.font = "700 39px Arial, sans-serif";
  wrapLines(ctx, topBook, 360, 4).forEach((line, index) => ctx.fillText(line, 520, 875 + index * 50));
  ctx.fillStyle = "#b9f36b";
  ctx.font = "400 25px Arial, sans-serif";
  ctx.fillText(topAuthor, 520, 1080);

  drawMetric(ctx, 184, 1205, minutes, "tempo de leitura");
  drawMetric(ctx, 560, 1205, String(books), books === 1 ? "livro iniciado" : "livros iniciados");
  drawMetric(ctx, 184, 1365, String(posts), posts === 1 ? "post publicado" : "posts publicados");
  drawMetric(ctx, 560, 1365, String(comments), comments === 1 ? "comentario" : "comentarios");

  drawButton(ctx, 184, 1515, 712, "Abrir no OPE Club");
  ctx.fillStyle = "#7e897f";
  ctx.font = "400 19px Arial, sans-serif";
  ctx.fillText(shareUrl.replace(/^https?:\/\//, ""), 184, 1645);
  ctx.fillText("OPE CLUB  |  Leia, pense, compartilhe", 184, 1690);

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
  const isDemo = data?.isDemo === true;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/app/retrospectiva?period=${kind}${isDemo ? "&demo=1" : ""}`;
  }, [kind, isDemo]);
  const fileName = `retrospectiva-${kind}-ope-club.png`;
  const message = `${isDemo ? "Exemplo de retrospectiva" : "Minha retrospectiva"} ${clean(snapshot?.label, "no OPE Club")}: ${shareUrl}`;

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
    createArtwork({ ...snapshot, isDemo }, kind, shareUrl)
      .then((blob) => {
        if (cancelled) return;
        setArtworkBlob(blob);
        setArtworkUrl(URL.createObjectURL(blob));
      })
      .catch((cause) => { if (!cancelled) setError(cause?.message || "Nao foi possivel preparar a arte."); })
      .finally(() => { if (!cancelled) setGenerating(false); });
    return () => { cancelled = true; };
  }, [open, snapshot, kind, shareUrl, isDemo]);

  useEffect(() => () => { if (artworkUrl) URL.revokeObjectURL(artworkUrl); }, [artworkUrl]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !snapshot) return null;

  function downloadArtwork() {
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
      const shareData = { title: `Retrospectiva ${clean(snapshot.label)}`, text: message, url: shareUrl };
      if (file && navigator.canShare?.({ files: [file] })) shareData.files = [file];
      if (!navigator.share) return downloadArtwork();
      await navigator.share(shareData);
    } catch (cause) {
      if (cause?.name !== "AbortError") toast.error("Nao foi possivel abrir o compartilhamento.");
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link da retrospectiva copiado."); }
    catch { toast.error("Nao foi possivel copiar o link."); }
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Sua retrospectiva">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:max-w-[720px] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-mint)]">OPE Club</p><h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{isDemo ? "Exemplo de retrospectiva" : "Sua retrospectiva"}</h2></div>
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
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{isDemo ? "Esta e uma pre-visualizacao com dados ficticios para voce testar o formato e o compartilhamento." : "Um resumo da sua jornada de leitura e participacao. A arte foi feita para compartilhar em Stories, WhatsApp ou onde voce quiser."}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <div className="rounded-2xl border border-[var(--border)] p-3"><Clock className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{formatMinutes(snapshot.minutes)}</strong>de leitura</div>
              <div className="rounded-2xl border border-[var(--border)] p-3"><BookOpen className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.booksStarted || 0}</strong>livros iniciados</div>
              <div className="rounded-2xl border border-[var(--border)] p-3"><ChatCircle className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.comments || 0}</strong>comentarios</div>
              <div className="rounded-2xl border border-[var(--border)] p-3"><Share2 className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.posts || 0}</strong>posts</div>
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
