import { getRequiredCookieSession } from "./auth.js";
import { supabaseRequest } from "./supabase.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE = 2_000_000;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.userSafe = true;
  return error;
}

function parseBookId(value) {
  const bookId = String(value || "").trim();
  if (!UUID.test(bookId)) throw invalid("Livro invalido.");
  return bookId;
}

function boundedPage(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_PAGE) {
    throw invalid("Pagina de leitura invalida.");
  }
  return number || fallback;
}

export function parseProgressBody(body = {}) {
  const bookId = parseBookId(body.bookId);
  const completed = body.completed === true;
  const currentPage = body.currentPage == null
    ? 1
    : boundedPage(body.currentPage, 1);
  const totalPages = body.totalPages == null || body.totalPages === ""
    ? null
    : boundedPage(body.totalPages, 1);

  if (totalPages && currentPage > totalPages && !completed) {
    throw invalid("A pagina atual nao pode ultrapassar o total do livro.");
  }

  const progress = completed
    ? 100
    : totalPages
      ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
      : 0;

  return {
    bookId,
    currentPage: completed && totalPages ? totalPages : currentPage,
    totalPages,
    progress,
  };
}

export async function getReadingProgress(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const url = new URL(req.url || "/api/auth?action=reading", "https://app.pesodeexistir.online");
  const bookId = url.searchParams.get("bookId");
  const bookIds = String(url.searchParams.get("bookIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const filter = bookId
    ? `&book_id=eq.${encodeURIComponent(parseBookId(bookId))}`
    : bookIds.length > 0
      ? `&book_id=in.(${bookIds.map((value) => parseBookId(value)).join(",")})`
      : "";
  const rows = await supabaseRequest(
    `reading_progress?select=book_id,progress,current_page,total_pages,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}${filter}&order=updated_at.desc&limit=5000`,
  );
  return { progress: rows || [] };
}

export async function updateReadingProgress(req, res, body) {
  const session = await getRequiredCookieSession(req, res);
  const input = parseProgressBody(body);

  const books = await supabaseRequest(
    `books?select=id&id=eq.${encodeURIComponent(input.bookId)}&limit=1`,
  );
  if (!books?.[0]) {
    const error = invalid("Livro nao encontrado.");
    error.status = 404;
    throw error;
  }

  const rows = await supabaseRequest(
    "reading_progress?on_conflict=user_id,book_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        book_id: input.bookId,
        progress: input.progress,
        current_page: input.currentPage,
        total_pages: input.totalPages,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return { progress: rows?.[0] || null };
}
