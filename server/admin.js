import {
  enforceRateLimit,
  requireAdmin,
  requirePermission,
  requireUuid,
  supabaseRequest,
  createSignedStorageUrlMap,
} from "./supabase.js";
import { getRequiredCookieSession } from "./auth.js";
import { PERMISSIONS } from "../src/lib/rbac.js";

const UUID_FIELDS = new Set([
  "id",
  "authorId",
  "bookId",
  "releaseId",
  "categoryId",
  "seasonId",
  "productId",
  "orderId",
  "userId",
  "referrerUserId",
  "referredUserId",
]);

function text(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value, max = 5000) {
  const result = text(value, max);
  return result || null;
}

function uuid(value, field) {
  return requireUuid(value, field);
}

function parsePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("Dados administrativos invalidos");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return value;
}

function cleanFields(value, fields) {
  const source = parsePayload(value);
  const result = {};
  for (const [key, max] of Object.entries(fields)) {
    if (source[key] === undefined) continue;
    if (key.endsWith("Id") || UUID_FIELDS.has(key)) {
      result[key] = source[key] == null || source[key] === "" ? null : uuid(source[key], key);
    } else if (typeof max === "number") {
      result[key] = text(source[key], max);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

async function rpc(name, body = {}) {
  return supabaseRequest(`rpc/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function requireOperationAccess(session, operation) {
  if (["bootstrap", "authors", "books", "weekly", "categories"].includes(operation)) {
    return requirePermission(session.user, PERMISSIONS.MANAGE_CONTENT);
  }
  return requireAdmin(session.user);
}

export async function getAdminBootstrap(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const profile = await requirePermission(session.user, PERMISSIONS.MANAGE_CONTENT);
  if (!await enforceRateLimit(req, res, {
    scope: "admin_bootstrap",
    limit: 20,
    windowSeconds: 60,
    userId: session.user.id,
  })) return null;

  const [books, adminBookAssets, authors, releases, categories, ratings] = await Promise.all([
    supabaseRequest("books?select=*&order=created_at.desc&limit=2000"),
    supabaseRequest("rpc/admin_book_pdf_assets", { method: "POST", body: "{}" }).catch(() => []),
    supabaseRequest("authors?select=*&order=name&limit=1000"),
    supabaseRequest("weekly_releases?select=*,books(id,title,image,image_path,author_id,category,bio,authors(name))&order=release_date.asc&limit=200"),
    supabaseRequest("categories?select=id,name,sort_order,created_at,updated_at&order=sort_order&order=name&limit=200"),
    supabaseRequest("book_ratings_public?select=book_id,rating_sum,rating_count&limit=2000").catch(() => []),
  ]);

  if (profile?.role !== "admin") {
    return { books, adminBookAssets, authors, subscriptions: [], profiles: [], emails: [], posts: [], postLikes: [], polls: [], votes: [], releases, categories, ratings, bookFavorites: [], authorFavorites: [], myRatings: [] };
  }

  const [subscriptions, profiles, emails, posts, bookFavorites, authorFavorites, myRatings] = await Promise.all([
    supabaseRequest("subscriptions?select=id,user_id,plan,status,provider,provider_product_id,provider_subscription_id,provider_customer_id,provider_order_id,customer_email,current_period_start,current_period_end,cancel_at_period_end,canceled_at,last_payment_at,metadata,created_at,updated_at&order=created_at.desc&limit=1000"),
    supabaseRequest("profiles?select=id,name,avatar,avatar_url,username,bio,theme,role,private_profile,reading_activity,show_online_status,xp,credits,referral_code,created_at,updated_at&order=created_at.desc&limit=1000"),
    supabaseRequest("user_emails?select=user_id,email&limit=1000"),
    supabaseRequest("posts?select=*&order=created_at.desc&limit=200"),
    supabaseRequest("book_favorites?select=book_id&limit=5000"),
    supabaseRequest("author_favorites?select=author_id&limit=5000"),
    supabaseRequest(`book_ratings?select=book_id,rating&user_id=eq.${encodeURIComponent(session.user.id)}&limit=5000`),
  ]);
  const postIds = (posts || []).map((post) => post.id).filter(Boolean);
  const [postLikes, polls] = postIds.length
    ? await Promise.all([
        supabaseRequest(`post_likes?select=post_id,user_id&post_id=in.(${postIds.join(",")})&limit=5000`).catch(() => []),
        supabaseRequest(`post_polls?select=id,post_id,question,created_at,post_poll_options(id,poll_id,label,sort_order)&post_id=in.(${postIds.join(",")})&limit=200`).catch(() => []),
      ])
    : [[], []];
  const pollIds = (polls || []).map((poll) => poll.id).filter(Boolean);
  const votes = pollIds.length
    ? await supabaseRequest(`post_poll_votes?select=poll_id,option_id,user_id&poll_id=in.(${pollIds.join(",")})&limit=10000`).catch(() => [])
    : [];
  return { books, adminBookAssets, authors, subscriptions, profiles, emails, posts, postLikes, polls, votes, releases, categories, ratings, bookFavorites, authorFavorites, myRatings };
}

export async function handleAdminAction(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const body = parsePayload(req.body);
  const operation = text(body.operation, 80);
  await requireOperationAccess(session, operation);
  if (!await enforceRateLimit(req, res, {
    scope: `admin_${operation}`,
    limit: 90,
    windowSeconds: 60,
    userId: session.user.id,
  })) return null;

  const payload = body.payload || {};
  switch (operation) {
    case "bootstrap":
      return getAdminBootstrap(req, res);
    case "author-create":
      return supabaseRequest("authors", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(mapAuthorPayload(payload)),
      }).then((rows) => rows?.[0] || null);
    case "author-update": {
      const id = uuid(payload.id, "id");
      const fields = cleanFields(payload, { name: 120, theme: 120, era: 80, bio: 3000, image: 500, imagePath: 500 });
      const mapped = { ...fields };
      if (mapped.imagePath !== undefined) { mapped.image_path = mapped.imagePath; delete mapped.imagePath; }
      const rows = await supabaseRequest(`authors?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(mapped),
      });
      return rows?.[0] || null;
    }
    case "author-delete":
      await supabaseRequest(`authors?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "book-create":
      return (await supabaseRequest("books", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(mapBookPayload(payload)),
      }))?.[0] || null;
    case "book-update": {
      const id = uuid(payload.id, "id");
      const rows = await supabaseRequest(`books?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(mapBookPayload(payload)),
      });
      return rows?.[0] || null;
    }
    case "book-delete":
      await supabaseRequest(`books?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "weekly-create":
      return (await supabaseRequest("weekly_releases", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(mapReleasePayload(payload)),
      }))?.[0] || null;
    case "weekly-update": {
      const id = uuid(payload.id, "id");
      const rows = await supabaseRequest(`weekly_releases?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload.bookId ? mapReleasePayload(payload) : { visible: payload.visible !== false }),
      });
      return rows?.[0] || null;
    }
    case "weekly-delete":
      await supabaseRequest(`weekly_releases?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "category-create":
      return (await supabaseRequest("categories", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: text(payload.name, 80), sort_order: Number(payload.sort_order) || 0 }),
      }))?.[0] || null;
    case "category-update": {
      const id = uuid(payload.id, "id");
      const rows = await supabaseRequest(`categories?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: text(payload.name, 80), updated_at: new Date().toISOString() }),
      });
      return rows?.[0] || null;
    }
    case "category-delete":
      await supabaseRequest(`categories?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "shop-catalog":
      return getShopCatalog();
    case "signed-media":
      return createSignedStorageUrlMap(text(payload.bucket, 80), Array.isArray(payload.paths) ? payload.paths.slice(0, 200) : []);
    case "posts-page":
      return getAdminPostsPage(payload);
    case "shop-save":
      return saveShopProduct(payload);
    case "shop-toggle":
      return patchById("shop_products", payload.id, { active: Boolean(payload.active) });
    case "shop-delete":
      await supabaseRequest(`shop_products?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "season-list":
      return supabaseRequest("seasons?select=id,name,description,status,starts_on,ends_on,created_at&order=created_at.desc&limit=200");
    case "season-create":
      return (await supabaseRequest("seasons", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(mapSeasonPayload(payload)) }))?.[0] || null;
    case "season-update":
      return patchById("seasons", payload.id, mapSeasonPayload(payload));
    case "season-delete":
      await supabaseRequest(`seasons?id=eq.${encodeURIComponent(uuid(payload.id, "id"))}`, { method: "DELETE" });
      return { deleted: true };
    case "redemptions-list":
      return getRedemptions();
    case "redemption-update":
      return patchById("shop_redemptions", payload.id, cleanFields(payload, { status: 30, tracking_code: 200, notes: 1000 }));
    case "credits-spent":
      return supabaseRequest("shop_redemptions?select=user_id,credits_spent&limit=5000");
    case "orders-list":
      return rpc("admin_list_orders", { p_limit: 200 });
    case "order-status":
      return rpc("admin_update_order_status", { p_order_id: uuid(payload.id, "id"), p_status: text(payload.status, 30) });
    case "spam-revert":
      return rpc("spam_revert", { p_user_id: uuid(payload.userId, "userId"), p_days: Math.min(90, Math.max(1, Number(payload.days) || 7)) });
    case "referrals-list":
      return rpc("admin_list_referrals");
    case "referral-confirm":
      return rpc("admin_confirm_referral", { p_referrer_user_id: uuid(payload.referrerUserId, "referrerUserId"), p_referred_user_id: uuid(payload.referredUserId, "referredUserId") });
    case "referral-cancel":
      return rpc("admin_cancel_referral", { p_referrer_user_id: uuid(payload.referrerUserId, "referrerUserId"), p_referred_user_id: uuid(payload.referredUserId, "referredUserId") });
    default: {
      const error = new Error("Operacao administrativa desconhecida");
      error.status = 404;
      error.userSafe = true;
      throw error;
    }
  }
}

function mapBookPayload(payload) {
  const result = cleanFields(payload, { title: 180, image: 500, pdf_url: 500, category: 80, bio: 20000, image_path: 500, pdf_path: 500 });
  if (payload.authorId !== undefined) result.author_id = payload.authorId ? uuid(payload.authorId, "authorId") : null;
  if (payload.imagePath !== undefined) result.image_path = optionalText(payload.imagePath, 500);
  if (payload.pdfPath !== undefined) result.pdf_path = optionalText(payload.pdfPath, 500);
  if (payload.pdfFile !== undefined) result.pdf_url = optionalText(payload.pdfFile, 500);
  return result;
}

function mapAuthorPayload(payload) {
  const result = cleanFields(payload, { name: 120, theme: 120, era: 80, bio: 3000, image: 500, imagePath: 500 });
  if (payload.imagePath !== undefined) {
    result.image_path = optionalText(payload.imagePath, 500);
    delete result.imagePath;
  }
  return result;
}

function mapReleasePayload(payload) {
  return {
    book_id: uuid(payload.bookId, "bookId"),
    release_date: text(payload.releaseDate, 30),
    note: optionalText(payload.note, 1000),
    visible: payload.visible !== false,
  };
}

function mapSeasonPayload(payload) {
  return {
    name: text(payload.name, 120),
    description: optionalText(payload.description, 2000),
    status: ["draft", "active", "archived"].includes(payload.status) ? payload.status : "draft",
    starts_on: optionalText(payload.starts_on, 30),
    ends_on: optionalText(payload.ends_on, 30),
  };
}

async function patchById(table, id, payload) {
  const rows = await supabaseRequest(`${table}?id=eq.${encodeURIComponent(uuid(id, "id"))}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

async function getShopCatalog() {
  const products = await supabaseRequest("shop_products?select=*&order=created_at.desc&limit=1000");
  const variants = products.length
    ? await supabaseRequest(`shop_product_variants?select=id,product_id,sku,size,color,stock,active&product_id=in.(${products.map((item) => item.id).join(",")})&order=created_at.asc`).catch(() => [])
    : [];
  const seasons = await supabaseRequest("seasons?select=id,name,status,starts_on,ends_on&order=created_at.desc&limit=200");
  const byProduct = new Map();
  for (const variant of variants || []) byProduct.set(variant.product_id, [...(byProduct.get(variant.product_id) || []), variant]);
  return { products: products.map((item) => ({ ...item, variants: byProduct.get(item.id) || [] })), seasons };
}

async function saveShopProduct(payload) {
  const fields = ["name", "description", "category", "credits_cost", "real_price", "min_months_active", "stock", "image_url", "images", "external_sku", "active", "season_id", "early_access_at", "public_release_at"];
  const data = {};
  for (const key of fields) if (payload[key] !== undefined) data[key] = payload[key];
  data.name = text(data.name, 180);
  data.description = optionalText(data.description, 2000);
  data.credits_cost = Math.max(1, Number(data.credits_cost) || 1);
  data.real_price = Math.max(0, Number(data.real_price) || 0);
  data.min_months_active = Math.max(0, Number(data.min_months_active) || 0);
  data.stock = data.stock === null || data.stock === "" ? null : Math.max(0, Number(data.stock) || 0);
  data.images = Array.isArray(data.images) ? data.images.slice(0, 12).map((item) => text(item, 1000)).filter(Boolean) : [];
  data.image_url = data.images[0] || optionalText(data.image_url, 1000);
  if (data.season_id) data.season_id = uuid(data.season_id, "seasonId");
  const product = payload.id
    ? await patchById("shop_products", payload.id, data)
    : (await supabaseRequest("shop_products", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) }))?.[0];
  if (!product?.id) return product;
  if (Array.isArray(payload.variants)) {
    await supabaseRequest(`shop_product_variants?product_id=eq.${encodeURIComponent(product.id)}`, { method: "DELETE" });
    const variants = payload.variants.map((variant) => ({
      product_id: product.id,
      size: optionalText(variant.size, 30),
      color: optionalText(variant.color, 80),
      stock: Math.max(0, Number(variant.stock) || 0),
      sku: optionalText(variant.sku, 100),
      active: variant.active !== false,
    })).filter((variant) => variant.size || variant.color);
    if (variants.length) await supabaseRequest("shop_product_variants", { method: "POST", body: JSON.stringify(variants) });
  }
  return product;
}

async function getRedemptions() {
  const [redemptions, products, profiles, emails] = await Promise.all([
    supabaseRequest("shop_redemptions?select=*&order=created_at.desc&limit=200"),
    supabaseRequest("shop_products?select=id,name,category,credits_cost&limit=1000"),
    supabaseRequest("profiles?select=id,name,username,avatar&limit=1000"),
    supabaseRequest("user_emails?select=user_id,email&limit=1000"),
  ]);
  return { redemptions, products, profiles, emails };
}

async function getAdminPostsPage(payload) {
  const offset = Math.max(0, Math.min(5000, Number(payload.offset) || 0));
  const limit = Math.min(50, Math.max(1, Number(payload.limit) || 20));
  const posts = await supabaseRequest(`posts?select=*&order=created_at.desc&offset=${offset}&limit=${limit + 1}`);
  const visiblePosts = posts.slice(0, limit);
  const ids = visiblePosts.map((post) => post.id).filter(Boolean);
  const likes = ids.length ? await supabaseRequest(`post_likes?select=post_id,user_id&post_id=in.(${ids.join(",")})&limit=5000`).catch(() => []) : [];
  const polls = ids.length ? await supabaseRequest(`post_polls?select=id,post_id,question,created_at,post_poll_options(id,poll_id,label,sort_order)&post_id=in.(${ids.join(",")})&limit=200`).catch(() => []) : [];
  const pollIds = polls.map((poll) => poll.id).filter(Boolean);
  const votes = pollIds.length ? await supabaseRequest(`post_poll_votes?select=poll_id,option_id,user_id&poll_id=in.(${pollIds.join(",")})&limit=10000`).catch(() => []) : [];
  const imageUrls = await createSignedStorageUrlMap("post-media", visiblePosts.flatMap((post) => post.image_paths || [])).catch(() => ({}));
  return { posts: visiblePosts, hasMore: posts.length > limit, likes, polls, votes, imageUrls };
}
