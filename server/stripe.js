import crypto from "node:crypto";
import Stripe from "stripe";
import { PLAN_CATALOG, getPlanByKey } from "./plans.js";

const SECRET_KEY_PREFIXES = ["sk_test_", "sk_live_", "rk_test_", "rk_live_"];

function isSecretKeyValid(key) {
  return SECRET_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// Cliente Stripe lazy: so instancia quando algum endpoint realmente precisa.
let stripeClient = null;
const validatedPrices = new Map();
const PRICE_CACHE_MS = 10 * 60 * 1000;

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const error = new Error("STRIPE_SECRET_KEY nao configurada");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  if (!isSecretKeyValid(secretKey)) {
    // A API do Stripe rejeita chaves com prefixo diferente (mk_, pk_, gap) com
    // 401 "Invalid API Key provided". Falhamos cedo com um 503 claro e acionavel.
    // A mensagem nao expoe a chave, entao e segura para mostrar na tela.
    const error = new Error(
      "STRIPE_SECRET_KEY invalida: o valor atual nao parece uma chave secreta do Stripe. " +
      "No painel da Vercel (Settings > Environment Variables) substitua por uma chave " +
      "real do Dashboard > Developers > API keys, comecando com sk_test_, sk_live_, rk_test_ ou rk_live_."
    );
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-07-29.dahlia",
      appInfo: {
        name: "OPE Club",
        version: "1.0.0",
        url: "https://pesodeexistir.online",
      },
    });
  }
  return stripeClient;
}

export { getStripe };

export function getConfigError() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return "STRIPE_SECRET_KEY nao configurada";
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return "STRIPE_WEBHOOK_SECRET nao configurado";
  }
  return null;
}

// Price id criado no dashboard do Stripe para cada combinacao do catalogo.
// A fonte da verdade de precos continua em server/plans.js; aqui resolvemos o
// Price via o campo priceEnv de cada plano (um Price por plano x ciclo).
export function getPriceId(planKey) {
  const plan = getPlanByKey(planKey);
  if (!plan) {
    const error = new Error("Plano invalido");
    error.status = 400;
    throw error;
  }
  const envKey = plan.priceEnv;
  const priceId = process.env[envKey];
  if (!priceId) {
    const error = new Error(`${envKey} nao configurado`);
    error.status = 503;
    throw error;
  }
  if (!isPriceIdValid(priceId)) {
    // Erro comum: colar o ID do PRODUTO (prod_...) no lugar do PRECO (price_...).
    // O Stripe rejeita com "No such price"; alertamos cedo com o termo certo.
    const error = new Error(
      `${envKey} com valor invalido: "${priceId}" nao parece um Price do Stripe. ` +
      `Deve comecar com price_ (ex.: "price_1Qx..."). Se copiou um prod_... voce pegou ` +
      `o ID do produto, nao do preco: em Products > produto, copie o ID em "Pricing".`
    );
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return priceId;
}

export async function validatePriceForPlan(plan) {
  const priceId = getPriceId(plan?.key);
  const cached = validatedPrices.get(priceId);
  if (cached && Date.now() - cached < PRICE_CACHE_MS) return priceId;

  const price = await getStripe().prices.retrieve(priceId);
  const expectedInterval = plan.cycle === "ANNUALLY" ? "year" : "month";
  // The server-side Price ID is the billing source of truth. The amount is
  // intentionally not duplicated here: changing a Price in Stripe should not
  // make a valid configured checkout unusable because this catalog is stale.
  // The client never supplies the Price ID, and the structural checks below
  // still prevent one-time, inactive, non-BRL, or wrong-cycle Prices.
  const valid = price.active &&
    price.currency === "brl" &&
    price.type === "recurring" &&
    price.recurring?.interval === expectedInterval &&
    Number(price.recurring?.interval_count || 1) === 1;

  if (!valid) {
    const error = new Error(
      `${plan.priceEnv} nao corresponde a uma assinatura BRL ativa com ciclo ${expectedInterval} para ${plan.name}`
    );
    error.status = 503;
    error.userSafe = true;
    throw error;
  }

  validatedPrices.set(priceId, Date.now());
  return priceId;
}

export async function getOrCreateStripeCustomer({ user, email, subscriptions = [] }) {
  const stripe = getStripe();
  const knownCustomerId = subscriptions.find(
    (subscription) => subscription.provider === "stripe" && subscription.provider_customer_id
  )?.provider_customer_id;
  if (knownCustomerId) {
    try {
      const knownCustomer = await stripe.customers.retrieve(knownCustomerId);
      if (!knownCustomer.deleted) return knownCustomer.id;
    } catch (error) {
      // A customer from another Stripe mode, or a deleted customer, must not
      // prevent a new checkout after switching test/live configuration.
      if (error?.code !== "resource_missing" && Number(error?.statusCode) !== 404) {
        throw error;
      }
    }
  }

  // Customer creation is idempotent for this account/user. Avoid a search
  // request here: restricted Stripe keys commonly do not have customer-search
  // permission, and the idempotency key already prevents duplicate customers.
  const customer = await stripe.customers.create(
    {
      email: email || undefined,
      metadata: { user_id: user.id },
    },
    { idempotencyKey: `ope-customer-${user.id}` }
  );
  return customer.id;
}

export async function expireOpenCheckoutSessions(customerId, userId, planKey, paymentMethod) {
  const stripe = getStripe();
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 30,
  });
  const owned = sessions.data.filter((session) => session.metadata?.user_id === userId);
  const paid = owned.find((session) =>
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.metadata?.plan_key === planKey &&
    session.metadata?.payment_method === paymentMethod
  );
  if (paid) {
    const error = new Error("Pagamento ja confirmado. Aguarde a sincronizacao da assinatura.");
    error.status = 409;
    error.userSafe = true;
    throw error;
  }
  const reusable = owned.find((session) =>
    session.status === "open" &&
    session.metadata?.plan_key === planKey &&
    session.metadata?.payment_method === paymentMethod &&
    session.url
  );

  await Promise.all(
    owned.map(async (session) => {
      if (session.id === reusable?.id) return;
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id).catch(() => null);
        return;
      }
      if (session.status !== "complete" || session.payment_status === "paid") return;
      if (session.mode === "payment" && typeof session.payment_intent === "string") {
        await stripe.paymentIntents.cancel(session.payment_intent).catch(() => null);
      }
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        await stripe.subscriptions.cancel(session.subscription).catch(() => null);
      }
    })
  );
  return reusable || null;
}

export async function expireCheckoutSession(sessionId) {
  if (!sessionId) return { expired: false, paid: false };
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete" && session.payment_status === "paid") {
      return { expired: false, paid: true };
    }
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id);
      return { expired: true, paid: false };
    }
    return { expired: false, paid: false };
  } catch (error) {
    if (error?.code === "resource_missing" || Number(error?.statusCode) === 404) {
      return { expired: true, paid: false };
    }
    throw error;
  }
}

export function checkoutIdempotencyKey(userId, planKey, paymentMethod, attemptId) {
  const normalizedAttempt = String(attemptId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return `ope-checkout-${userId}-${planKey}-${paymentMethod}-${normalizedAttempt}`;
}

// A tentativa e uma reserva de negocio, nao apenas uma chave de idempotencia.
// O endpoint deve recusar tanto IDs de outra conta quanto a troca de plano
// enquanto ainda existe um checkout aberto para o mesmo usuario.
export function getCheckoutAttemptConflict(attempt, { userId, planKey, paymentMethod }) {
  if (!attempt) return null;
  if (attempt.user_id !== userId) return "forbidden";
  if (attempt.plan_key !== planKey || attempt.payment_method !== paymentMethod) {
    return "pending_conflict";
  }
  return null;
}

export function integrationIdentifier() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.randomBytes(8);
  const suffix = [...bytes].map((byte) => letters[byte % letters.length]).join("");
  return `ope_club_${suffix}`;
}

function isPriceIdValid(priceId) {
  return typeof priceId === "string" && priceId.startsWith("price_");
}

export function getPlanByPriceId(priceId) {
  if (!priceId) return null;
  return (
    Object.values(PLAN_CATALOG).find(
      (plan) => process.env[plan.priceEnv] === priceId
    ) || null
  );
}

function normalizeSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    const error = new Error("APP_URL invalida. Use uma URL completa, como https://app.pesodeexistir.online");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }

  const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!["https:", "http:"].includes(parsed.protocol) || (!localHost && parsed.protocol !== "https:")) {
    const error = new Error("APP_URL deve usar HTTPS, como https://app.pesodeexistir.online");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configured =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VITE_APP_URL;
  if (configured) return normalizeSiteUrl(configured);
  if (process.env.VERCEL_URL) return normalizeSiteUrl(process.env.VERCEL_URL);
  return "http://localhost:5173";
}

// Mapeia o status do Stripe para o modelo interno usado na tabela
// subscriptions. "unpaid" e tratado como past_due (cobranca pendente).
export function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return stripeStatus;
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "pending";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "expired";
  }
}

export function requireStripePriceId(planKey) {
  const priceId = getPriceId(planKey);
  if (!priceId) {
    const error = new Error("Preco Stripe nao configurado para o plano");
    error.status = 503;
    throw error;
  }
  return priceId;
}
