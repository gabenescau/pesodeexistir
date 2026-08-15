const authorModules = import.meta.glob("/content/*/index.js", { eager: true, import: "default" });
const bookModules = import.meta.glob("/content/*/*/index.js", { eager: true, import: "default" });

export function loadContent() {
  const authors = [];
  const books = [];

  for (const [path, data] of Object.entries(authorModules)) {
    const authorId = path.replace("/content/", "").replace("/index.js", "");
    authors.push({ id: authorId, ...data });
  }

  for (const [path, data] of Object.entries(bookModules)) {
    const parts = path.replace("/content/", "").split("/");
    const authorId = parts[0];
    const bookId = parts[1];
    books.push({
      id: bookId,
      authorId,
      authorName: authors.find(a => a.id === authorId)?.name || "",
      ...data,
    });
  }

  return { authors, books };
}
