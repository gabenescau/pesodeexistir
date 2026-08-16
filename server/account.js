import { getRequiredCookieSession } from "./auth.js";
import { enforceRateLimit, supabaseUserRequest } from "./supabase.js";

const MAX_ROWS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.userSafe = true;
  return error;
}

function id(value, field) {
  const normalized = String(value || "").trim();
  if (!UUID.test(normalized)) throw invalid(`${field} invalido.`);
  return normalized;
}

function text(value, field, max, required = false) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw invalid(`${field} obrigatorio.`);
  if (normalized.length > max) throw invalid(`${field} excede o limite permitido.`);
  return normalized;
}

export async function getAccountState(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const userId = encodeURIComponent(session.user.id);
  const [bookFavorites, authorFavorites, ratings, collections, reactions, replies, pageComments] = await Promise.all([
    supabaseUserRequest(session.accessToken, `book_favorites?select=book_id&user_id=eq.${userId}&limit=${MAX_ROWS}`),
    supabaseUserRequest(session.accessToken, `author_favorites?select=author_id&user_id=eq.${userId}&limit=${MAX_ROWS}`),
    supabaseUserRequest(session.accessToken, `book_ratings?select=book_id,rating&user_id=eq.${userId}&limit=${MAX_ROWS}`),
    supabaseUserRequest(session.accessToken, `collections?select=id,user_id,name,description,cover_path,is_public,created_at,updated_at&or=(user_id.eq.${userId},is_public.eq.true)&order=created_at.desc&limit=200`),
    supabaseUserRequest(session.accessToken, `reactions?select=id&user_id=eq.${userId}&limit=${MAX_ROWS}`),
    supabaseUserRequest(session.accessToken, `post_replies?select=id&user_id=eq.${userId}&limit=${MAX_ROWS}`),
    supabaseUserRequest(session.accessToken, `book_page_comments?select=id&user_id=eq.${userId}&limit=${MAX_ROWS}`),
  ]);
  const collectionIds = (collections || []).map((item) => item.id).filter(Boolean);
  const collectionItems = collectionIds.length > 0
    ? await supabaseUserRequest(
        session.accessToken,
        `collection_items?select=id,collection_id,item_type,item_id,position,created_at&collection_id=in.(${collectionIds.join(",")})&limit=2000`,
      )
    : [];
  return {
    bookFavorites,
    authorFavorites,
    myRatings: ratings,
    collections,
    collectionItems,
    myCounts: { reactions: reactions.length, comments: replies.length + pageComments.length },
  };
}

export async function handleAccountWrite(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const operation = text(req.body?.operation, "Operacao", 50, true);
  const userId = session.user.id;
  if (!await enforceRateLimit(req, res, {
    scope: `account_${operation}`,
    limit: 30,
    windowSeconds: 60,
    userId,
  })) return null;
  const own = (table, conflict, row, enabled) => enabled
    ? supabaseUserRequest(session.accessToken, `${table}?on_conflict=${conflict}`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(row),
      })
    : supabaseUserRequest(session.accessToken, `${table}?${Object.entries(row).map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`).join("&")}`, { method: "DELETE" });

  if (operation === "toggle_book_favorite") {
    const bookId = id(req.body.bookId, "Livro");
    await own("book_favorites", "user_id,book_id", { user_id: userId, book_id: bookId }, req.body.enabled === true);
    return { enabled: req.body.enabled === true };
  }
  if (operation === "toggle_author_favorite") {
    const authorId = id(req.body.authorId, "Autor");
    await own("author_favorites", "user_id,author_id", { user_id: userId, author_id: authorId }, req.body.enabled === true);
    return { enabled: req.body.enabled === true };
  }
  if (operation === "rate_book") {
    const bookId = id(req.body.bookId, "Livro");
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw invalid("Nota invalida.");
    return supabaseUserRequest(session.accessToken, "book_ratings?on_conflict=user_id,book_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ user_id: userId, book_id: bookId, rating }),
    }).then((rows) => rows?.[0] || { book_id: bookId, rating });
  }
  if (operation === "create_collection") {
    const name = text(req.body.name, "Nome", 60, true);
    const description = text(req.body.description, "Descricao", 280) || null;
    const rows = await supabaseUserRequest(session.accessToken, "collections?select=*&limit=1", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, name, description, is_public: req.body.isPublic !== false }),
    });
    return rows?.[0] || null;
  }
  if (operation === "update_collection") {
    const collectionId = id(req.body.collectionId, "Colecao");
    const patch = {};
    if (req.body.name !== undefined) patch.name = text(req.body.name, "Nome", 60, true);
    if (req.body.description !== undefined) patch.description = text(req.body.description, "Descricao", 280) || null;
    if (req.body.isPublic !== undefined) {
      if (typeof req.body.isPublic !== "boolean") throw invalid("Visibilidade invalida.");
      patch.is_public = req.body.isPublic;
    }
    if (!Object.keys(patch).length) throw invalid("Nenhuma alteracao enviada.");
    const rows = await supabaseUserRequest(session.accessToken, `collections?id=eq.${encodeURIComponent(collectionId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
    });
    return rows?.[0] || null;
  }
  if (operation === "delete_collection") {
    const collectionId = id(req.body.collectionId, "Colecao");
    await supabaseUserRequest(session.accessToken, `collections?id=eq.${encodeURIComponent(collectionId)}&user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
    return { id: collectionId };
  }
  if (operation === "add_collection_item") {
    const collectionId = id(req.body.collectionId, "Colecao");
    const itemId = id(req.body.itemId, "Item");
    const itemType = text(req.body.itemType, "Tipo", 20, true);
    if (!new Set(["book", "author"]).has(itemType)) throw invalid("Tipo de item invalido.");
    const rows = await supabaseUserRequest(session.accessToken, "collection_items?select=*&limit=1", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ collection_id: collectionId, item_type: itemType, item_id: itemId, position: Number(req.body.position) || 0 }),
    });
    return rows?.[0] || null;
  }
  if (operation === "remove_collection_item") {
    const itemId = id(req.body.itemId, "Item");
    await supabaseUserRequest(session.accessToken, `collection_items?id=eq.${encodeURIComponent(itemId)}`, { method: "DELETE" });
    return { id: itemId };
  }
  throw invalid("Operacao de conta invalida.");
}
