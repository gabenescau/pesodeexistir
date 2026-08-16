import crypto from "node:crypto";
import { getRequiredCookieSession } from "./auth.js";
import {
  enforceRateLimit,
  supabaseRequest,
  supabaseUserRequest,
} from "./supabase.js";

const PRODUCT_SELECT = "id,name,description,category,credits_cost,min_months_active,image_url,images,active,external_sku,created_at,updated_at,real_price,stock,season_id,early_access_at,public_release_at";
const REDEMPTION_SELECT = "id,product_id,variant_id,quantity,variant_snapshot,credits_spent,status,customer_name,customer_email,address_json,tracking_code,notes,created_at,updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.userSafe = true;
  return error;
}

function text(value, max, field, { required = false } = {}) {
  const valueText = String(value ?? "").trim();
  if (required && !valueText) throw invalid(`${field} obrigatorio.`);
  if (valueText.length > max) throw invalid(`${field} excede o limite permitido.`);
  return valueText;
}

function parseId(value, field) {
  const id = text(value, 80, field, { required: true });
  if (!UUID.test(id)) throw invalid(`${field} invalido.`);
  return id;
}

function parseQuantity(value) {
  const quantity = Number(value ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw invalid("Quantidade invalida.");
  return quantity;
}

function parseAddress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Endereco invalido.");
  const allowed = ["linha1", "linha2", "street", "number", "complement", "neighborhood", "city", "state", "cep", "zipCode", "country"];
  return Object.fromEntries(allowed
    .map((key) => [key, text(value[key], 160, "Endereco")])
    .filter(([, item]) => item));
}

async function callUserRpc(session, name, args = {}) {
  const allowed = new Set([
    "wallet_state", "reward_login", "report_reading_session", "reward_post",
    "reward_comment", "reward_likes_received", "complete_daily_mission",
    "complete_weekly_mission", "get_my_referral_code", "register_referral",
    "referral_claim", "redeem_product_with_variant", "create_shop_order_with_variant", "credits_ranking",
  ]);
  if (!allowed.has(name)) throw invalid("Operacao de recompensa invalida.");
  return supabaseUserRequest(session.accessToken, `rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function getStoreCatalog() {
  const products = await supabaseRequest(
    `shop_products?select=${encodeURIComponent(PRODUCT_SELECT)}&active=eq.true&order=credits_cost.asc&limit=500`,
  );
  const ids = (products || []).map((product) => product.id).filter((id) => UUID.test(String(id)));
  let variants = [];
  if (ids.length > 0) {
    try {
      variants = await supabaseRequest(
        `shop_product_variants?select=id,product_id,sku,size,color,stock,active&product_id=in.(${ids.join(",")})&active=eq.true&order=size.asc&order=color.asc&limit=2000`,
      );
    } catch (error) {
      if (!/schema cache|does not exist|relation/i.test(String(error?.message || ""))) throw error;
    }
  }
  const variantsByProduct = new Map();
  for (const variant of variants || []) {
    const list = variantsByProduct.get(variant.product_id) || [];
    list.push(variant);
    variantsByProduct.set(variant.product_id, list);
  }
  return (products || []).map((product) => {
    let images = Array.isArray(product.images) ? product.images : [];
    if (typeof product.images === "string" && product.images.startsWith("[")) {
      try {
        const parsed = JSON.parse(product.images);
        images = Array.isArray(parsed) ? parsed : [];
      } catch {
        images = [];
      }
    }
    return {
      ...product,
      images: images.length > 0 ? images : product.image_url ? [product.image_url] : [],
      variants: variantsByProduct.get(product.id) || [],
    };
  });
}

async function getMyRedemptions(session) {
  return supabaseUserRequest(
    session.accessToken,
    `shop_redemptions?select=${encodeURIComponent(REDEMPTION_SELECT)}&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=100`,
  );
}

async function getMyReferrals(session) {
  return supabaseUserRequest(
    session.accessToken,
    `referrals?select=referred_user_id,rewarded_at,created_at&referrer_user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc&limit=50`,
  );
}

function parseRewardInput(operation, body = {}, userId) {
  switch (operation) {
    case "reward_login":
    case "wallet_state":
    case "complete_daily_mission":
    case "complete_weekly_mission":
    case "get_my_referral_code":
      return {};
    case "credits_ranking": {
      const limit = Number(body.limit ?? body.p_limit ?? 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw invalid("Limite invalido.");
      return { p_limit: limit };
    }
    case "report_reading_session": {
      const bookId = parseId(body.bookId, "Livro");
      const seconds = Number(body.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7200) throw invalid("Sessao de leitura invalida.");
      return { p_book_id: bookId, p_seconds: seconds, p_interacted: body.interacted === true };
    }
    case "reward_post":
      return { p_user_id: userId, p_source_ref: text(body.sourceRef, 120) || null };
    case "reward_comment":
      return { p_user_id: userId, p_text: text(body.text, 2000, "Comentario", { required: true }) };
    case "reward_likes_received":
      return { p_owner_id: userId };
    case "register_referral":
      return { p_referrer_code: text(body.code, 80, "Codigo", { required: true }) };
    case "referral_claim":
      return { p_referred_user_id: parseId(body.referredUserId, "Indicado") };
    case "redeem_product_with_variant": {
      const idempotencyKey = text(body.idempotencyKey, 100, "Chave de idempotencia") || `redeem-${crypto.randomUUID()}`;
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) throw invalid("Chave de idempotencia invalida.");
      const email = text(body.customerEmail, 254, "E-mail", { required: true }).toLowerCase();
      if (!EMAIL.test(email)) throw invalid("E-mail invalido.");
      return {
        p_product_id: parseId(body.productId, "Produto"),
        p_variant_id: body.variantId ? parseId(body.variantId, "Variacao") : null,
        p_quantity: parseQuantity(body.quantity),
        p_customer_name: text(body.customerName, 120, "Nome", { required: true }),
        p_customer_email: email,
        p_address: { ...parseAddress(body.address), idempotency_key: idempotencyKey },
      };
    }
    case "create_shop_order_with_variant": {
      const paymentMethod = text(body.paymentMethod, 20, "Forma de pagamento", { required: true }).toLowerCase();
      if (!new Set(["credits", "real"]).has(paymentMethod)) throw invalid("Forma de pagamento invalida.");
      const idempotencyKey = text(body.idempotencyKey, 100, "Chave de idempotencia", { required: true });
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) throw invalid("Chave de idempotencia invalida.");
      const email = text(body.customer?.email, 254, "E-mail", { required: true }).toLowerCase();
      if (!EMAIL.test(email)) throw invalid("E-mail invalido.");
      return {
        p_product_id: parseId(body.productId, "Produto"),
        p_variant_id: body.variantId ? parseId(body.variantId, "Variacao") : null,
        p_quantity: parseQuantity(body.quantity),
        p_payment_method: paymentMethod,
        p_customer: {
          name: text(body.customer?.name, 120, "Nome", { required: true }),
          email,
          phone: text(body.customer?.phone, 40, "Telefone", { required: true }),
        },
        p_address: parseAddress(body.address),
        p_idempotency_key: idempotencyKey,
      };
    }
    default:
      throw invalid("Operacao de recompensa invalida.");
  }
}

export async function handleRewardsAction(req, res, action) {
  const session = await getRequiredCookieSession(req, res);
  const userId = session.user.id;
  if (!await enforceRateLimit(req, res, {
    scope: `rewards_${action}`,
    limit: action === "store" ? 60 : action === "reward" ? 30 : 60,
    windowSeconds: 60,
    userId,
  })) return null;

  if (action === "wallet") return callUserRpc(session, "wallet_state");
  if (action === "store") return getStoreCatalog();
  if (action === "redemptions") return getMyRedemptions(session);
  if (action === "referrals") return getMyReferrals(session);

  const operation = text(req.body?.operation, 80, "Operacao", { required: true });
  return callUserRpc(session, operation, parseRewardInput(operation, req.body, userId));
}
