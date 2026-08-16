import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Supabase supplies SUPABASE_SERVICE_ROLE_KEY to Edge Functions by default.
// SERVICE_ROLE_KEY is supported as a fallback for projects that configured a
// custom secret after the platform rejected the reserved SUPABASE_ prefix.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
const UPLOAD_TICKET_SECRET = Deno.env.get("UPLOAD_TICKET_SECRET") || "";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

const BUCKETS = {
  avatars: { kind: "avatar", maxBytes: MAX_AVATAR_BYTES, roles: ["owner"] },
  covers: { kind: "image", maxBytes: MAX_IMAGE_BYTES, roles: ["admin", "editor"] },
  "post-media": { kind: "image", maxBytes: MAX_IMAGE_BYTES, roles: ["owner"] },
  "shop-media": { kind: "image", maxBytes: MAX_IMAGE_BYTES, roles: ["admin", "editor"] },
  pdfs: { kind: "pdf", maxBytes: MAX_PDF_BYTES, roles: ["admin", "editor"] },
} as const;

const ALLOWED_KINDS: Record<string, string[]> = {
  avatars: ["avatar"],
  covers: ["book-cover", "author-photo"],
  "post-media": ["post-image"],
  "shop-media": ["product-image"],
  pdfs: ["book-pdf"],
};

const IMAGE_TYPES = new Map([
  ["image/jpeg", { extension: "jpg" }],
  ["image/png", { extension: "png" }],
  ["image/webp", { extension: "webp" }],
  ["image/gif", { extension: "gif" }],
]);

function hasBytes(bytes: Uint8Array, offset: number, values: number[]) {
  return values.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start = 0, end = bytes.length) {
  return new TextDecoder("latin1").decode(bytes.subarray(start, end));
}

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] * 0x1000000) +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function jpegDimensions(bytes: Uint8Array) {
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
    const isSof = marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf;
    if (isSof && length >= 7) {
      return { width: readUint16(bytes, offset + 5), height: readUint16(bytes, offset + 3) };
    }
    offset += length;
  }
  return null;
}

function imageTypeAndDimensions(bytes: Uint8Array) {
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
  if (hasBytes(bytes, 0, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    if (bytes.length < 10) return null;
    return {
      type: "image/gif",
      dimensions: { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) },
    };
  }
  if (hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    const chunk = ascii(bytes, 12, 16);
    if (chunk === "VP8X" && bytes.length >= 30) {
      return {
        type: "image/webp",
        dimensions: {
          width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
          height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
        },
      };
    }
    return { type: "image/webp", dimensions: null };
  }
  return null;
}

function validateImage(bytes: Uint8Array, claimedType: string) {
  const detected = imageTypeAndDimensions(bytes);
  if (!detected || detected.type !== claimedType || !IMAGE_TYPES.has(detected.type)) {
    throw new Error("O arquivo nao corresponde a uma imagem permitida.");
  }
  const dimensions = detected.dimensions;
  if (dimensions && (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS || dimensions.width > 8000 || dimensions.height > 8000)) {
    throw new Error("As dimensoes da imagem nao sao permitidas.");
  }
  return detected.type;
}

function validatePdf(bytes: Uint8Array, claimedType: string) {
  if (claimedType !== "application/pdf" || !hasBytes(bytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error("O arquivo nao e um PDF valido.");
  }
  const tail = ascii(bytes, Math.max(0, bytes.length - 4096)).trimEnd();
  if (!tail.endsWith("%%EOF")) throw new Error("O PDF parece incompleto.");

  // PDF ativo nao entra no Storage. Links e metadados interativos tambem sao
  // bloqueados porque o arquivo sera aberto em leitores no navegador.
  const dangerousTokens = [
    "/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile",
    "/RichMedia", "/SubmitForm", "/GoToR", "/ImportData", "/XFA", "/URI",
  ];
  const source = ascii(bytes);
  if (dangerousTokens.some((token) => source.includes(token))) {
    throw new Error("O PDF contem recursos ativos ou links nao permitidos.");
  }
  return "application/pdf";
}

function safeBaseName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 80) || "arquivo";
}

function corsHeaders(origin: string | null) {
  const allowed = new Set(["https://pesodeexistir.online", "https://www.pesodeexistir.online", "https://app.pesodeexistir.online"]);
  if (Deno.env.get("ALLOW_LOCAL_ORIGIN") === "true") allowed.add("http://localhost:5173");
  const headers = new Headers({ "access-control-allow-headers": "apikey, content-type, x-client-info, x-upload-ticket", "access-control-allow-methods": "POST, OPTIONS" });
  if (origin && allowed.has(origin)) headers.set("access-control-allow-origin", origin);
  return headers;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyUploadTicket(ticket: string) {
  if (UPLOAD_TICKET_SECRET.length < 32) throw new Error("Upload ticket secret ausente");
  const [body, signature] = String(ticket || "").split(".");
  if (!body || !signature || body.length > 4096 || signature.length > 256) throw new Error("Upload ticket invalido");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UPLOAD_TICKET_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signature),
    new TextEncoder().encode(body),
  );
  if (!valid) throw new Error("Upload ticket invalido");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body)));
  } catch {
    throw new Error("Upload ticket invalido");
  }
  if (
    typeof payload.sub !== "string" ||
    typeof payload.bucket !== "string" ||
    typeof payload.kind !== "string" ||
    typeof payload.fileName !== "string" ||
    typeof payload.fileType !== "string" ||
    !Number.isSafeInteger(payload.fileSize) ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) throw new Error("Upload ticket expirado");
  return payload;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Metodo nao permitido" }), { status: 405, headers });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ticket = await verifyUploadTicket(request.headers.get("x-upload-ticket") || "");
    const userId = String(ticket.sub);

    const form = await request.formData();
    const file = form.get("file");
    const bucket = String(form.get("bucket") || "");
    const kind = String(form.get("kind") || "");
    const policy = BUCKETS[bucket as keyof typeof BUCKETS];
    if (!(file instanceof File) || !policy || policy.kind !== (bucket === "pdfs" ? "pdf" : bucket === "avatars" ? "avatar" : "image") || !ALLOWED_KINDS[bucket]?.includes(kind)) {
      return new Response(JSON.stringify({ error: "Upload invalido" }), { status: 400, headers });
    }
    if (ticket.bucket !== bucket || ticket.kind !== kind || ticket.fileName !== file.name || ticket.fileType !== file.type || ticket.fileSize !== file.size) {
      return new Response(JSON.stringify({ error: "O upload nao corresponde a autorizacao" }), { status: 400, headers });
    }
    if (file.size <= 0 || file.size > policy.maxBytes) return new Response(JSON.stringify({ error: "Tamanho de arquivo nao permitido" }), { status: 400, headers });

    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const role = profile?.role || "user";
    const allowedRoles = policy.roles as readonly string[];
    if (!allowedRoles.includes("owner") && !allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Sem permissao para este tipo de arquivo" }), { status: 403, headers });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const claimedType = file.type.toLowerCase();
    const contentType = policy.kind === "pdf" ? validatePdf(bytes, claimedType) : validateImage(bytes, claimedType);
    const extension = contentType === "application/pdf" ? "pdf" : IMAGE_TYPES.get(contentType)!.extension;
    // Every uploaded object is owned by the authenticated user. Admins may
    // manage all objects server-side; editors can only remove their own.
    const folder = userId;
    const path = `${folder}/${kind.replace(/[^a-z0-9_-]/gi, "-").slice(0, 32)}/${crypto.randomUUID()}-${safeBaseName(file.name)}.${extension}`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    return new Response(JSON.stringify({ path, contentType }), { status: 200, headers });
  } catch (error) {
    console.error("secure-upload failed", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Arquivo rejeitado pela validacao de seguranca" }), { status: 400, headers });
  }
});
