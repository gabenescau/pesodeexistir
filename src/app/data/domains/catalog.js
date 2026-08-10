// Catalog domain boundary. Queries and asset normalization live here so pages
// do not need to know the database column aliases used by legacy content.
export const BOOK_SELECT = "id,title,image,image_path,author_id,pdf_url,pdf_path,category,bio,progress,created_at,updated_at,authors(name)";
export const AUTHOR_SELECT = "id,name,image,image_path,theme,era,bio,created_at,updated_at";
export const WEEKLY_RELEASE_SELECT = "id,book_id,release_date,visible,created_at,books(id,title,image,image_path,author_id,category,bio,authors(name))";

export function firstFilled(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

export function normalizeAssetUrl(value, folder) {
  const raw = firstFilled(value);
  if (!raw) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
  if (raw.startsWith(`${folder}/`)) return `/${raw}`;
  if (/^[^/]+\.(png|jpe?g|webp|gif|svg)$/i.test(raw)) return `/${folder}/${raw}`;
  return raw;
}

export function normalizeBooks(rows, {
  progress = [],
  ratingsByBook = {},
  coverUrlMap = new Map(),
  localBooks = [],
} = {}) {
  const localBookById = new Map(localBooks.map((book) => [book.id, book]));
  const localBookByTitle = new Map(localBooks.map((book) => [book.title, book]));
  return (rows || []).map((book) => {
    const userProgress = progress.find((item) => item.book_id === book.id);
    const localBook = localBookById.get(book.id) || localBookByTitle.get(book.title) || {};
    const ratingAgg = ratingsByBook[book.id];
    const rating = ratingAgg && ratingAgg.count > 0
      ? Math.round((ratingAgg.sum / ratingAgg.count) * 10) / 10
      : 0;
    return {
      ...book,
      authorId: book.author_id,
      authorName: book.authors?.name || "",
      author: book.authors?.name || "",
      nota: rating,
      ratingCount: ratingAgg?.count || 0,
      image: normalizeAssetUrl(
        firstFilled(coverUrlMap.get(book.image_path), book.image, book.image_url, book.cover_url, book.cover, book.thumbnail_url, localBook.image),
        "livros"
      ),
      pdfFile: firstFilled(book.pdf_path, book.pdf_url),
      progress: userProgress?.progress ?? 0,
      currentPage: userProgress?.current_page ?? 1,
      totalPages: userProgress?.total_pages ?? null,
    };
  });
}

export function normalizeAuthors(rows, {
  coverUrlMap = new Map(),
  localAuthors = [],
} = {}) {
  const localAuthorById = new Map(localAuthors.map((author) => [author.id, author]));
  const localAuthorByName = new Map(localAuthors.map((author) => [author.name, author]));
  return (rows || []).map((author) => {
    const localAuthor = localAuthorById.get(author.id) || localAuthorByName.get(author.name) || {};
    return {
      ...author,
      image: normalizeAssetUrl(
        firstFilled(coverUrlMap.get(author.image_path), author.image, author.image_url, author.avatar_url, author.photo_url, localAuthor.image),
        "autores"
      ),
    };
  });
}
