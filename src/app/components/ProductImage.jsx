import { useMemo, useState } from "react";

const LEGACY_PRODUCT_IMAGES = [
  { match: /memento|mori/i, src: "/shop/camiseta-memento.png" },
  { match: /miracles|leap|faith/i, src: "/shop/camiseta-miracles.png" },
  { match: /thanatos/i, src: "/shop/moletom-thanatos.png" },
];

const CATEGORY_IMAGES = {
  oversized: "/shop/camiseta-miracles.png",
  hoodie: "/shop/moletom-miracles.jpg",
  moletom: "/shop/moletom-miracles.jpg",
};

function normalizeImageSource(value) {
  const candidate = typeof value === "object" && value !== null
    ? value.url || value.src || value.path
    : value;
  if (typeof candidate !== "string") return null;

  const source = candidate.trim();
  if (!source) return null;
  if (/^public\//i.test(source)) return `/${source.slice(7)}`;
  if (/^(shop|livros|autores)\//i.test(source)) return `/${source}`;
  if (/^https:\/\//i.test(source) || source.startsWith("/")) return source;
  return null;
}

function parseProductImages(product) {
  if (!product) return [];
  if (Array.isArray(product.images)) return product.images;
  if (typeof product.images === "string" && product.images.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(product.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return product.image_url ? [product.image_url] : [];
}

export function getProductFallbackImage(product) {
  const name = String(product?.name || "");
  const legacy = LEGACY_PRODUCT_IMAGES.find((entry) => entry.match.test(name));
  if (legacy) return legacy.src;
  return CATEGORY_IMAGES[String(product?.category || "").toLowerCase()] || null;
}

export function getProductImageSources(product) {
  const sources = parseProductImages(product).map(normalizeImageSource).filter(Boolean);
  const fallback = getProductFallbackImage(product);
  return [...new Set([...sources, fallback].filter(Boolean))];
}

function ImageFallback({ className, children }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[var(--bg-canvas)] ${className || ""}`}>
      {children || <span className="text-xs text-[var(--text-muted)]">Imagem indisponível</span>}
    </div>
  );
}

export function ProductImage({
  product,
  sources,
  fallbackSrc,
  alt = "",
  className = "",
  loading = "lazy",
  children,
}) {
  const candidates = useMemo(() => {
    const normalized = (sources || getProductImageSources(product))
      .map(normalizeImageSource)
      .filter(Boolean);
    const fallback = normalizeImageSource(fallbackSrc || getProductFallbackImage(product));
    return [...new Set([...normalized, fallback].filter(Boolean))];
  }, [fallbackSrc, product, sources]);
  const [failedIndex, setFailedIndex] = useState(-1);
  const src = candidates[failedIndex + 1];

  if (!src) return <ImageFallback className={className}>{children}</ImageFallback>;

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailedIndex((current) => current + 1)}
    />
  );
}

