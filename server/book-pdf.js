import {
  applyCors,
  createSignedStorageUrl,
  enforceRateLimit,
  getAuthenticatedUser,
  getProfile,
  logServerError,
  prepareResponse,
  requireUuid,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
} from "./supabase.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isActiveSubscription(subscription) {
  if (!subscription || !ACTIVE_STATUSES.has(String(subscription.status || "").toLowerCase())) return false;
  const end = subscription.current_period_end || subscription.ends_at || subscription.expires_at || subscription.expiration_date;
  // A paid/approved provider response is not, by itself, an entitlement. The
  // local subscription must have a bounded period written by the webhook.
  if (!end) return false;
  const timestamp = new Date(end).getTime();
  return !Number.isNaN(timestamp) && timestamp >= Date.now();
}

function decodePath(value) {
  let decoded = String(value || "");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function getObjectPaths(book) {
  const candidates = [book?.pdf_path, book?.pdf_url]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const paths = [];

  for (const raw of candidates) {
    let path = raw;
    try {
      if (/^https?:\/\//i.test(raw)) path = new URL(raw).pathname;
    } catch {
      continue;
    }

    path = decodePath(path.split(/[?#]/, 1)[0]).replace(/^\/+/, "");
    const storageMarker = path.match(
      /(?:^|\/)(?:storage\/v1\/)?(?:object\/)?(?:public|authenticated|sign)\/pdfs\/(.+)$/i,
    );
    if (storageMarker?.[1]) path = storageMarker[1];
    // Older records may contain only the storage visibility prefix, for
    // example `public/pdfs/file.pdf` or `object/public/pdfs/file.pdf`.
    path = path.replace(/^(?:storage\/v1\/)?(?:object\/)?(?:public|authenticated|sign)\/pdfs\//i, "");
    if (path.toLowerCase().startsWith("pdfs/")) path = path.slice("pdfs/".length);
    path = decodePath(path).replace(/^\/+/, "");

    if (path && !path.includes(String.fromCharCode(0)) && !paths.includes(path)) {
      paths.push(path);
    }
  }

  return paths;
}

function getBookIdFromRequest(req) {
  const url = new URL(req.url || "/api/book-pdf", "https://app.pesodeexistir.online");
  const fromQuery = url.searchParams.get("bookId");
  const fromPath = url.pathname.match(/\/api\/book-pdf\/([^/]+)$/i)?.[1];
  return fromQuery || fromPath || "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function handleBookPdf(req, res) {
  prepareResponse(req, res);
  if (!applyCors(req, res)) return sendClientError(req, res, 403, "Origem nao permitida");
  if (req.method !== "GET") return sendClientError(req, res, 405, "Metodo nao permitido");

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!await enforceRateLimit(req, res, {
      scope: "book_pdf",
      limit: 30,
      windowSeconds: 60,
      userId: user.id,
    })) return;

    const bookId = requireUuid(getBookIdFromRequest(req), "bookId");
    const [profile, books] = await Promise.all([
      getProfile(user.id),
      supabaseRequest(`books?id=eq.${encodeURIComponent(bookId)}&select=id,pdf_path,pdf_url&limit=1`),
    ]);
    const book = books?.[0];
    if (!book) return sendClientError(req, res, 404, "Livro nao encontrado");

    const isAdmin = profile?.role === "admin";
    if (!isAdmin) {
      const subscriptions = await supabaseRequest(
        `subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=status,current_period_end,ends_at,expires_at,expiration_date&order=updated_at.desc&limit=20`,
      );
      if (!subscriptions.some(isActiveSubscription)) {
        return sendClientError(req, res, 403, "Assine um plano ativo para ler este livro.");
      }

      const releases = await supabaseRequest(
        `weekly_releases?book_id=eq.${encodeURIComponent(bookId)}&visible=eq.true&select=release_date&limit=20`,
      );
      if ((releases || []).some((release) => String(release.release_date || "") > todayIso())) {
        return sendClientError(req, res, 403, "Este livro ainda nao foi liberado.");
      }
    }

    const objectPaths = getObjectPaths(book);
    if (objectPaths.length === 0) return sendClientError(req, res, 404, "Este livro ainda nao possui um PDF");

    let signedUrl = null;
    let lastStorageError = null;
    for (const objectPath of objectPaths) {
      try {
        signedUrl = await createSignedStorageUrl("pdfs", objectPath, SIGNED_URL_TTL_SECONDS);
        break;
      } catch (error) {
        lastStorageError = error;
        if (![400, 404].includes(Number(error?.status))) throw error;
      }
    }
    if (!signedUrl) {
      if (lastStorageError) throw lastStorageError;
      return sendClientError(req, res, 404, "Este livro ainda nao possui um PDF");
    }
    res.setHeader("Cache-Control", "private, no-store");
    return sendSuccess(req, res, {
      url: signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    logServerError("book_pdf", error, req);
    return sendError(req, res, error, "Nao foi possivel liberar este livro agora.");
  }
}
