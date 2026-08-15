// Recomendacao inteligente de livros relacionados.
// Pontua cada candidato por proximidade com o livro/autor de referencia:
// categoria (+3), mesmo autor (+2), tags em comum (+1 por tag) e popularidade
// (+ ate 3 pela quantidade de avaliacoes e nota media). Exclui o proprio livro.

function tokensDoLivro(book) {
  return String(book.tag || book.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function scoreBook(base, candidate) {
  let score = 0;
  if (base.category && candidate.category && base.category === candidate.category) score += 3;
  if (
    base.authorId &&
    candidate.authorId &&
    String(base.authorId) === String(candidate.authorId)
  ) {
    score += 2;
  }
  const baseTokens = tokensDoLivro(base);
  if (baseTokens.length > 0) {
    const candidateTokens = tokensDoLivro(candidate);
    const overlap = baseTokens.filter((token) => candidateTokens.includes(token)).length;
    score += overlap;
  }
  const ratingCount = candidate.ratingCount || 0;
  score += Math.min(3, ratingCount / 5);
  score += Math.min(1, (candidate.nota || 0) / 5);
  return score;
}

export function relatedBooks(books, base, { limit = 8, excludeIds = new Set() } = {}) {
  if (!base) return [];
  return books
    .filter((book) => book.id !== base.id && !excludeIds.has(book.id))
    .map((book) => ({ book, score: scoreBook(base, book) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.book.ratingCount || 0) - (a.book.ratingCount || 0))
    .slice(0, limit)
    .map((entry) => entry.book);
}
