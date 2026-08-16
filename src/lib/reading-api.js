import { authenticatedApiRequest } from "./authenticated-api";

export async function loadReadingProgress(bookId = null, bookIds = []) {
  const query = bookId
    ? `&bookId=${encodeURIComponent(bookId)}`
    : bookIds.length > 0
      ? `&bookIds=${bookIds.map((id) => encodeURIComponent(id)).join(",")}`
      : "";
  const data = await authenticatedApiRequest(`/api/auth?action=reading${query}`);
  return data?.progress || [];
}

export async function saveReadingProgress({
  bookId,
  currentPage = 1,
  totalPages = null,
  completed = false,
}) {
  const data = await authenticatedApiRequest("/api/auth?action=reading", {
    method: "POST",
    body: { bookId, currentPage, totalPages, completed },
  });
  return data?.progress || null;
}
