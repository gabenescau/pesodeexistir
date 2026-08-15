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

const ACTIVE_STATUSES = new Set([
  "active", "past_due", "trialing", "paid", "approved", "authorized",
  "complete", "completed", "succeeded",
]);
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isActiveSubscription(subscription) {
  if (!subscription || !ACTIVE_STATUSES.has(String(subscription.status || "").toLowerCase())) return false;
  const end = subscription.current_period_end || subscription.ends_at || subscription.expires_at || subscription.expiration_date;
  if (!end) return true;
  const timestamp = new Date(end).getTime();
  return Number.isNaN(timestamp) || timestamp >= Date.now();
}

function getObjectPath(book) {
  const raw = String(book?.pdf_path || book?.pdf_url || "").trim();
  if (!raw) return "";
  const marker = "/storage/v1/object/public/pdfs/";
  const markerIndex = raw.indexOf(marker);
  const path = markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function handleBookPdf(req, res) {
  prepareResponse(req, res);
  if (!applyCors(req, res)) return sendClientError(req, res, 403, "Origem nao permitida");
  if (req.method !== "GET") return sendClientError(req, res, 405, "Metodo nao permitido");

  try {
    const user = await getAuthenticatedUser(req);
    if (!await enforceRateLimit(req, res, {
      scope: "book_pdf",
      limit: 30,
      windowSeconds: 60,
      userId: user.id,
    })) return;

    const url = new URL(req.url || "/api/book-pdf", "https://app.pesodeexistir.online");
    const bookId = requireUuid(url.searchParams.get("bookId"), "bookId");
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

    const objectPath = getObjectPath(book);
    if (!objectPath) return sendClientError(req, res, 404, "Este livro ainda nao possui um PDF");
    const signedUrl = await createSignedStorageUrl("pdfs", objectPath, SIGNED_URL_TTL_SECONDS);
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
