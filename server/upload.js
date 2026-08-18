import crypto from "node:crypto";
import { getRequiredCookieSession } from "./auth.js";
import { supabaseRequest, supabaseStorageRequest } from "./supabase.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const POLICIES = {
  avatars: { maxBytes: 2 * 1024 * 1024, kinds: new Set(["avatar"]), types: IMAGE_TYPES, roles: new Set(["owner"]) },
  covers: { maxBytes: 5 * 1024 * 1024, kinds: new Set(["book-cover", "author-photo"]), types: IMAGE_TYPES, roles: new Set(["admin", "editor"]) },
  "post-media": { maxBytes: 5 * 1024 * 1024, kinds: new Set(["post-image"]), types: IMAGE_TYPES, roles: new Set(["owner"]) },
  "shop-media": { maxBytes: 5 * 1024 * 1024, kinds: new Set(["product-image"]), types: IMAGE_TYPES, roles: new Set(["admin", "editor"]) },
  pdfs: { maxBytes: 50 * 1024 * 1024, kinds: new Set(["book-pdf"]), types: new Set(["application/pdf"]), roles: new Set(["admin", "editor"]) },
};
const MAX_IMAGE_PIXELS = 40_000_000;

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.userSafe = true;
  return error;
}

async function getUserRole(userId) {
  const rows = await supabaseRequest(
    `profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return rows?.[0]?.role || "user";
}

function pathBelongsToUser(bucket, path, userId) {
  return (bucket === "avatars"
    || bucket === "post-media"
    || bucket === "covers"
    || bucket === "shop-media"
    || bucket === "pdfs")
    && String(path).startsWith(`${userId}/`);
}

function validateDeletePath(path) {
  const value = String(path || "").trim();
  if (!value || value.length > 500 || value.startsWith("/") || value.includes("..") || value.includes("\\") || value.includes("://")) {
    throw invalid("Caminho de arquivo invalido.");
  }
  return value;
}

function hasBytes(bytes, offset, values) {
  return offset >= 0 && offset + values.length <= bytes.length
    && values.every((value, index) => bytes[offset + index] === value);
}

function readUint16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes, offset) {
  return (bytes[offset] * 0x1000000)
    + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

function jpegDimensions(bytes) {
  if (!hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const length = readUint16(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;
    const isSof = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isSof && length >= 7) {
      return { width: readUint16(bytes, offset + 5), height: readUint16(bytes, offset + 3) };
    }
    offset += length;
  }
  return null;
}

function imageTypeAndDimensions(bytes) {
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { type: "image/jpeg", dimensions: jpegDimensions(bytes) };
  }
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    if (bytes.length < 24) return null;
    return {
      type: "image/png",
      dimensions: { width: readUint32(bytes, 16), height: readUint32(bytes, 20) },
    };
  }
  if (hasBytes(bytes, 0, [0x47, 0x49, 0x46, 0x38])
    && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    if (bytes.length < 10) return null;
    return {
      type: "image/gif",
      dimensions: { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) },
    };
  }
  if (hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return { type: "image/webp", dimensions: null };
  }
  return null;
}

function validateUploadBytes(bytes, claimedType) {
  if (claimedType === "application/pdf") {
    if (!hasBytes(bytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      throw invalid("O arquivo nao e um PDF valido.");
    }
    return "application/pdf";
  }

  const detected = imageTypeAndDimensions(bytes);
  if (!detected || detected.type !== claimedType) {
    throw invalid("O arquivo nao corresponde a uma imagem permitida.");
  }
  const dimensions = detected.dimensions;
  if (dimensions && (!dimensions.width || !dimensions.height
    || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
    || dimensions.width > 8000 || dimensions.height > 8000)) {
    throw invalid("As dimensoes da imagem nao sao permitidas.");
  }
  return detected.type;
}

function safeBaseName(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 80) || "arquivo";
}

export async function uploadUploadedFile(req, res, form, existingSession = null) {
  const session = existingSession || await getRequiredCookieSession(req, res);
  const file = form.get("file");
  const bucket = String(form.get("bucket") || "");
  const kind = String(form.get("kind") || "");
  const policy = POLICIES[bucket];

  if (!file || typeof file.arrayBuffer !== "function" || !policy || !policy.kinds.has(kind)) {
    throw invalid("Upload invalido");
  }
  const claimedType = String(file.type || "").toLowerCase();
  if (!policy.types.has(claimedType) || !Number.isSafeInteger(file.size)
    || file.size < 1 || file.size > policy.maxBytes) {
    throw invalid("Tipo ou tamanho de arquivo nao permitido");
  }

  const role = await getUserRole(session.user.id);
  if (!policy.roles.has("owner") && !policy.roles.has(role)) {
    throw invalid("Sem permissao para este tipo de arquivo", 403);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = validateUploadBytes(bytes, claimedType);
  const extension = contentType === "application/pdf"
    ? "pdf"
    : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[contentType]);
  if (!extension) throw invalid("Extensao de arquivo nao permitida");

  const path = `${session.user.id}/${kind.replace(/[^a-z0-9_-]/gi, "-").slice(0, 32)}/${crypto.randomUUID()}-${safeBaseName(file.name)}.${extension}`;
  await supabaseStorageRequest(`object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "x-upsert": "false" },
    body: bytes,
  });
  return { path, contentType };
}

export async function deleteUploadedFiles(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const bucket = String(req.body?.bucket || "").trim();
  const paths = Array.isArray(req.body?.paths)
    ? req.body.paths.slice(0, 10).map(validateDeletePath)
    : [];
  if (!POLICIES[bucket] || paths.length === 0) throw invalid("Upload invalido.");

  const role = await getUserRole(session.user.id);
  const canManageAllFiles = role === "admin";
  if (!canManageAllFiles && !paths.every((path) => pathBelongsToUser(bucket, path, session.user.id))) {
    throw invalid("Sem permissao para remover este arquivo.", 403);
  }

  const result = await supabaseStorageRequest(`object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: paths }),
  });
  return { removed: paths, result };
}
