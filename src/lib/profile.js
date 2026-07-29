export const PROFILE_LIMITS = Object.freeze({
  name: 80,
  bio: 500,
  avatarBytes: 2 * 1024 * 1024,
});

export const PROFILE_HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

const AVATAR_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

export function validateProfileInput({ name, handle, bio }) {
  const normalized = {
    name: String(name || "").trim(),
    handle: String(handle || "").trim().toLowerCase(),
    bio: String(bio || "").trim(),
  };

  if (!normalized.name || normalized.name.length > PROFILE_LIMITS.name) {
    throw new Error(`O nome precisa ter entre 1 e ${PROFILE_LIMITS.name} caracteres.`);
  }
  if (!PROFILE_HANDLE_PATTERN.test(normalized.handle)) {
    throw new Error("O @ precisa ter de 3 a 24 caracteres, so letras minusculas, numeros e _.");
  }
  if (normalized.bio.length > PROFILE_LIMITS.bio) {
    throw new Error(`A bio pode ter no maximo ${PROFILE_LIMITS.bio} caracteres.`);
  }

  return normalized;
}

export function validateAvatarFile(file) {
  if (!file) return null;
  if (file.size > PROFILE_LIMITS.avatarBytes) {
    throw new Error("A imagem precisa ter no maximo 2 MB.");
  }

  const extension = AVATAR_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }
  return extension;
}

export function storagePathFromPublicUrl(url, bucket) {
  if (!url || !bucket) return null;
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}
