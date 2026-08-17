export function downloadShareFile({ blob, url, fileName }) {
  const source = url || (blob ? URL.createObjectURL(blob) : "");
  if (!source) return false;

  const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIos) {
    const opened = window.open(source, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(source);
    return true;
  }

  const anchor = document.createElement("a");
  anchor.href = source;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (!url) window.setTimeout(() => URL.revokeObjectURL(source), 1000);
  return true;
}

export async function shareArtwork({ blob, fileName, title, text, url, onFallback }) {
  if (typeof navigator.share !== "function") {
    onFallback?.();
    return "downloaded";
  }

  const shareData = { title, text, url };
  if (blob && typeof navigator.canShare === "function") {
    const file = new File([blob], fileName, { type: blob.type || "image/png" });
    try {
      if (navigator.canShare({ files: [file] })) shareData.files = [file];
    } catch {
      // Some browsers expose canShare but reject file capability checks.
    }
  }

  if (!shareData.files) {
    onFallback?.();
    return "downloaded";
  }

  await navigator.share(shareData);
  return "shared";
}

export async function copyShareText(value) {
  const text = String(value || "");
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the selection API below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

export function openWhatsAppShare(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message || "")}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

