// Otimizacao client-side de imagens antes do upload.
//
// Regra de ouro: arquivos ANTIGOS nunca sao tocados. Este modulo so atua no
// momento do upload (arquivos novos), redimensionando e convertendo para WebP
// para nao lotar o Storage do Supabase. Se qualquer etapa falhar, o arquivo
// original segue para upload normalmente (fallback seguro).
//
// Sem dependencias externas: usa createImageBitmap + <canvas> nativos.
// GIF animado e PDF nunca passam por aqui (preservam bytes originais).

export const IMAGE_OPTIMIZE_PRESETS = Object.freeze({
  avatar: Object.freeze({ maxDimension: 512, quality: 0.82 }),
  "book-cover": Object.freeze({ maxDimension: 1024, quality: 0.82 }),
  "author-photo": Object.freeze({ maxDimension: 1024, quality: 0.82 }),
  "post-image": Object.freeze({ maxDimension: 1600, quality: 0.82 }),
  "product-image": Object.freeze({ maxDimension: 1024, quality: 0.82 }),
});

const OPTIMIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// WebP pequeno ja otimizado nao precisa de reprocessamento.
const SKIP_BELOW_BYTES = 120 * 1024;

export function presetForKind(kind) {
  return IMAGE_OPTIMIZE_PRESETS[String(kind || "")] || null;
}

export function shouldOptimizeImage(file) {
  if (!file || typeof file.type !== "string") return false;
  if (!OPTIMIZABLE_TYPES.has(file.type)) return false;
  if (!presetForKind(file.kind)) return false;
  // Arquivos pequenos nao ganham nada com reprocessamento — evita custo e
  // superficie de falha (inclui WebP ja otimizado e JPG/PNG minusculos).
  if (Number(file.size) <= SKIP_BELOW_BYTES) return false;
  return true;
}

export function buildOptimizedFileName(name) {
  const base = String(name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 80);
  return `${base || "imagem"}.webp`;
}

function loadBitmap(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
      "image/webp",
      quality,
    );
  });
}

// Redimensiona (preservando proporcao) e converte para WebP.
// Retorna um File novo; em qualquer falha, rejeita para o chamador usar o original.
export async function optimizeImageForUpload(file, kind) {
  const preset = presetForKind(kind);
  if (!preset) throw new Error("kind sem preset");
  if (typeof document === "undefined") throw new Error("sem DOM");

  const source = await loadBitmap(file);
  const width = source.width || 0;
  const height = source.height || 0;
  if (!width || !height) throw new Error("dimensoes invalidas");

  const scale = Math.min(1, preset.maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  // Imagem ja pequena e ja WebP: nao reprocessa (evita perda geracional).
  if (scale === 1 && file.type === "image/webp") return file;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("sem canvas 2d");
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  if (typeof source.close === "function") source.close();

  const blob = await canvasToWebp(canvas, preset.quality);
  // Seguranca: se o browser nao tiver encoder WebP, o toBlob pode devolver
  // bytes em outro formato — nesse caso mantem o original em vez de enviar
  // um arquivo marcado como webp que o servidor rejeitaria (400).
  if (!blob.type || !blob.type.startsWith("image/webp")) return file;
  // Seguranca: se o WebP sair maior que o original, mantem o original.
  if (blob.size >= file.size) return file;
  return new File([blob], buildOptimizedFileName(file.name), { type: "image/webp" });
}
