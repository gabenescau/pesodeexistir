// Preview-only data. It is never sent to the API or persisted in Supabase.
export const DEMO_RETROSPECTIVE = Object.freeze({
  allowed: true,
  isDemo: true,
  month: Object.freeze({
    kind: "month",
    label: "Agosto de 2026",
    start: "2026-08-01",
    hasData: true,
    minutes: 3895,
    booksStarted: 4,
    comments: 11,
    posts: 7,
    topBook: Object.freeze({ title: "O Estrangeiro", image: "/livros/17246e96e1849a868b81412a2de0bcbc.jpg" }),
    topAuthor: Object.freeze({ name: "Albert Camus" }),
  }),
  year: Object.freeze({
    kind: "year",
    label: "2026",
    start: "2026-01-01",
    hasData: true,
    minutes: 18420,
    booksStarted: 18,
    comments: 64,
    posts: 29,
    topBook: Object.freeze({ title: "O Mito de Sísifo", image: "/livros/19ebdf73baa10690da782a6aa11963d8.jpg" }),
    topAuthor: Object.freeze({ name: "Albert Camus" }),
  }),
});
