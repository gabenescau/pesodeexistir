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

  let shareData = { title, text, url };
  if (blob && typeof navigator.canShare === "function") {
    const file = new File([blob], fileName, { type: blob.type || "image/png" });
    try {
      // Android chooses share targets from the MIME payload. Sending only the
      // image avoids classifying the action as a text/message share.
      if (navigator.canShare({ files: [file] })) shareData = { files: [file] };
    } catch {
      // Some browsers expose canShare but reject file capability checks.
    }
  }

  if (!shareData.files) {
    onFallback?.();
    return "downloaded";
  }

  try {
    await navigator.share(shareData);
  } catch (cause) {
    // A few Android WebViews reject a file-only payload. Preserve the native
    // chooser as a fallback for those clients before falling back to download.
    if (cause?.name !== "AbortError") {
      await navigator.share({ title, text, url });
      return "shared";
    }
    throw cause;
  }
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

export async function copyShareImage({ blob, url }) {
  if (typeof navigator.clipboard?.write !== "function" || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    const imageBlob = blob || (url ? await fetch(url).then((response) => {
      if (!response.ok) throw new Error("image_fetch_failed");
      return response.blob();
    }) : null);
    if (!imageBlob) return false;

    const type = imageBlob.type || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [type]: imageBlob })]);
    return true;
  } catch {
    return false;
  }
}

export function openWhatsAppShare(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message || "")}`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}
