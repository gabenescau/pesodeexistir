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
const SAFE_FILE_NAME = /^[^/\\]{1,180}$/;
const TICKET_TTL_SECONDS = 5 * 60;

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.userSafe = true;
  return error;
}

function getTicketSecret() {
  const secret = String(process.env.UPLOAD_TICKET_SECRET || "");
  if (secret.length < 32) {
    const error = new Error("UPLOAD_TICKET_SECRET nao configurado no servidor.");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return secret;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signTicket(payload) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getTicketSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function hasUnsafeFileCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function parseUploadInput(body = {}) {
  const bucket = String(body.bucket || "").trim();
  const kind = String(body.kind || "").trim();
  const fileName = String(body.fileName || "").trim();
  const fileType = String(body.fileType || "").trim().toLowerCase();
  const fileSize = Number(body.fileSize);
  const policy = POLICIES[bucket];

  if (!policy || !policy.kinds.has(kind) || !policy.types.has(fileType)) {
    throw invalid("Tipo de upload nao permitido.");
  }
  if (!SAFE_FILE_NAME.test(fileName) || hasUnsafeFileCharacters(fileName) || fileName === "." || fileName === "..") {
    throw invalid("Nome de arquivo invalido.");
  }
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > policy.maxBytes) {
    throw invalid("Tamanho de arquivo nao permitido.");
  }

  return { bucket, kind, fileName, fileType, fileSize, policy };
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

export async function createUploadTicket(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const input = parseUploadInput(req.body);
  const role = await getUserRole(session.user.id);
  if (!input.policy.roles.has("owner") && !input.policy.roles.has(role)) {
    throw invalid("Sem permissao para este tipo de arquivo.", 403);
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
  return {
    ticket: signTicket({
      sub: session.user.id,
      bucket: input.bucket,
      kind: input.kind,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      exp: expiresAt,
      nonce: crypto.randomUUID(),
    }),
    expiresAt,
  };
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
