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
    topBook: Object.freeze({ title: "O Estrangeiro" }),
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
    topBook: Object.freeze({ title: "O Homem Revoltado" }),
    topAuthor: Object.freeze({ name: "Albert Camus" }),
  }),
});
