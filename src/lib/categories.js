// Categorias do catálogo. Foco do app é filosofia; as demais cobrem o que a
// biblioteca costuma ter (literatura, psicanálise…). Lista fixa e curada: o
// admin escolhe daqui, a Biblioteca monta as prateleiras nesta ordem.
export const CATEGORIES = [
  "Existencialismo",
  "Estoicismo",
  "Filosofia Antiga",
  "Filosofia Moderna",
  "Ética e Moral",
  "Metafísica",
  "Política",
  "Psicanálise",
  "Literatura",
  "Poesia",
  "Ensaios",
];

export const CATEGORIA_OUTROS = "Outros";

// Agrupa livros por categoria, preservando a ordem de CATEGORIES e jogando o
// resto (categoria vazia ou desconhecida) para "Outros" no fim.
export function groupByCategory(books = []) {
  const mapa = new Map();
  for (const cat of CATEGORIES) mapa.set(cat, []);

  for (const book of books) {
    const cat = CATEGORIES.includes(book.category) ? book.category : CATEGORIA_OUTROS;
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat).push(book);
  }

  return [...mapa.entries()]
    .filter(([, lista]) => lista.length > 0)
    .map(([categoria, lista]) => ({ categoria, livros: lista }));
}
