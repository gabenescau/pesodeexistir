import { sanitizeSingleLine } from "./sanitize.js";

export const POST_IMAGE_BUCKET = "post-media";
export const MAX_POST_IMAGES = 4;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_TEXT = 5000;

export function relativeTime(value) {
  if (!value) return "agora";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "agora";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / 1440);
  if (days < 30) return `${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes${months > 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `${years} ano${years > 1 ? "s" : ""}`;
}

export function isVerifiedProfile(profile) {
  // The backend is authoritative. Accept only explicit true values so a
  // serialized string such as "false" can never render the badge.
  const verified = profile?.verified === true || profile?.verified === 1 || profile?.verified === "true";
  const legacyVerified = profile?.is_verified === true || profile?.is_verified === 1 || profile?.is_verified === "true";
  return verified || legacyVerified || profile?.role === "admin";
}

export function safeFileName(name) {
  return String(name || "imagem")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function sanitizePollOptions(options) {
  return (options || [])
    .map((option) => sanitizeSingleLine(option, 120))
    .filter(Boolean)
    .slice(0, 4);
}
