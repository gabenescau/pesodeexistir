import { useEffect, useMemo, useState } from "react";
import { publicStorageUrl } from "@/lib/library-media";

const PLACEHOLDER_SRC = "/placeholder-book.svg";

export function BookCover({
  src,
  storagePath,
  alt = "",
  title = "",
  className = "h-full w-full object-cover",
  loading = "lazy",
}) {
  const sources = useMemo(() => {
    const stableUrl = storagePath ? publicStorageUrl("covers", storagePath) : "";
    return [...new Set([src, stableUrl].filter(Boolean))];
  }, [src, storagePath]);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src, storagePath]);

  const currentSource = sources[attempt] || "";

  if (failed || !currentSource) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--bg-canvas)]">
        <img src={PLACEHOLDER_SRC} alt={alt || title || "Capa indisponível"} className={className} />
        {title ? (
          <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-center text-[10px] font-medium leading-tight text-[var(--text-muted)]">
            {title}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={currentSource}
      alt={alt || title || ""}
      loading={loading}
      className={className}
      onError={() => {
        if (attempt < sources.length - 1) setAttempt((value) => value + 1);
        else setFailed(true);
      }}
    />
  );
}
