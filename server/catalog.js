import {
  createSignedStorageUrlMap,
  supabaseRequest,
} from "./supabase.js";

const BOOK_SELECT = "id,title,image,image_path,author_id,category,bio,progress,created_at,updated_at,has_pdf,authors(name)";
const AUTHOR_SELECT = "id,name,image,image_path,theme,era,bio,created_at,updated_at";
const RELEASE_SELECT = "id,book_id,release_date,visible,created_at,books(id,title,image,image_path,author_id,category,bio,authors(name))";
const CATEGORY_SELECT = "id,name,sort_order,created_at,updated_at";
const RATING_SELECT = "book_id,rating_sum,rating_count";
const PAGE_SIZE = 48;
const MAX_OFFSET = 5000;

function boundedInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, 0), MAX_OFFSET);
}

function selectOnly(value) {
  const only = String(value || "all").toLowerCase();
  return new Set(["books", "authors", "all"]).has(only) ? only : "all";
}

export async function getPublicCatalog(req) {
  const url = new URL(req.url || "/api/auth?action=catalog", "https://app.pesodeexistir.online");
  const only = selectOnly(url.searchParams.get("only"));
  const booksOffset = boundedInteger(url.searchParams.get("booksOffset"));
  const authorsOffset = boundedInteger(url.searchParams.get("authorsOffset"));
  const includeBooks = only === "all" || only === "books";
  const includeAuthors = only === "all" || only === "authors";
  const includeShared = only === "all";

  const [books, authors, releases, categories, ratings] = await Promise.all([
    includeBooks
      ? supabaseRequest(`books?select=${BOOK_SELECT}&order=created_at.desc&offset=${booksOffset}&limit=${PAGE_SIZE + 1}`)
      : Promise.resolve([]),
    includeAuthors
      ? supabaseRequest(`authors?select=${AUTHOR_SELECT}&order=name.asc&offset=${authorsOffset}&limit=${PAGE_SIZE + 1}`)
      : Promise.resolve([]),
    includeShared
      ? supabaseRequest(`weekly_releases?select=${RELEASE_SELECT}&visible=eq.true&order=release_date.asc&limit=100`)
      : Promise.resolve([]),
    includeShared
      ? supabaseRequest(`categories?select=${CATEGORY_SELECT}&order=sort_order.asc,name.asc&limit=200`)
      : Promise.resolve([]),
    includeShared
      ? supabaseRequest(`book_ratings_public?select=${RATING_SELECT}&limit=2000`)
      : Promise.resolve([]),
  ]);

  const coverPaths = [
    ...books.map((book) => book.image_path),
    ...authors.map((author) => author.image_path),
  ];
  let coverUrls = {};
  try {
    coverUrls = await createSignedStorageUrlMap("covers", coverPaths, 3600);
  } catch {
    // A missing optional cover object must not take down the public catalog.
    // The normalized image field can still use its fallback URL.
  }

  return {
    books,
    authors,
    weeklyReleases: releases,
    categories,
    ratings,
    coverUrls,
    pageSize: PAGE_SIZE,
  };
}

export async function getActiveSeasonCatalog() {
  const seasons = await supabaseRequest(
    "seasons?select=id,name,description,status,starts_on,ends_on,created_at&status=eq.active&order=created_at.desc&limit=1",
  );
  const season = seasons?.[0] || null;
  if (!season) return { season: null, products: [] };
  const products = await supabaseRequest(
    `shop_products?select=id,name,description,credits_cost,real_price,image_url,stock,category&season_id=eq.${encodeURIComponent(season.id)}&active=eq.true&order=created_at.desc&limit=200`,
  );
  return { season, products: products || [] };
}
