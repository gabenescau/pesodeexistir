import {
  findOrCreateCustomer,
  findOrCreateProduct,
  createHostedCheckout,
  createSubscriptionCheckout,
  listHostedCheckouts,
  listSubscriptionCheckouts,
} from "./abacatepay.js";
import { getCheckoutProduct, getPlanByKey } from "./_plans.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function requireSupabaseServerConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase server env vars nao configuradas");
  }
}

async function getAuthenticatedUser(req) {
  requireSupabaseServerConfig();

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Sessao obrigatoria para criar checkout");
    error.status = 401;
    throw error;
  }

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!authRes.ok) {
    const error = new Error("Sessao invalida ou expirada");
    error.status = 401;
    throw error;
  }

  return authRes.json();
}

async function fetchProfileName(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=name`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res.ok) return "";
  const rows = await res.json();
  return rows?.[0]?.name || "";
}

async function listUserSubscriptions(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao consultar assinatura atual: ${await res.text()}`);
  }
  return res.json();
}

function isCurrentlyActive(subscription) {
  if (!["active", "past_due", "trialing"].includes(subscription?.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

async function reusePendingCheckout(pending, planConfig, paymentMethod) {
  const checkoutId = pending?.metadata?.checkout_id;
  if (!checkoutId) return null;
  if (pending?.metadata?.payment_method !== paymentMethod) return null;
  if (pending.plan !== planConfig.plan) return null;

  const listCheckouts = paymentMethod === "PIX"
    ? listHostedCheckouts
    : listSubscriptionCheckouts;
  const checkout = (await listCheckouts({ id: checkoutId }))[0];
  if (!checkout || ["EXPIRED", "CANCELLED", "REFUNDED"].includes(checkout.status)) {
    return null;
  }
  if (checkout.status === "PAID") {
    const error = new Error("Pagamento ja confirmado. Sincronize a assinatura ou aguarde o webhook.");
    error.status = 409;
    throw error;
  }
  if (checkout.status !== "PENDING") {
    const error = new Error(`Checkout existente com status ${checkout.status}`);
    error.status = 409;
    throw error;
  }
  if (!checkout.url) throw new Error("Checkout pendente sem URL na AbacatePay");

  return {
    url: checkout.url,
    checkoutId: checkout.id,
    subscriptionId: pending.id,
    reused: true,
  };
}

async function expireStaleSubscriptions(subscriptions) {
  const stale = subscriptions.filter((subscription) =>
    ["active", "past_due", "trialing"].includes(subscription.status) &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  );

  const responses = await Promise.all(stale.map((subscription) =>
    fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
    })
  ));

  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`Erro ao expirar assinatura antiga: ${await response.text()}`);
    }
  }
}

async function savePendingSubscription({
  user,
  planKey,
  planConfig,
  paymentMethod,
  checkout,
  product,
  customer,
  existingPending,
}) {
  const now = new Date();

  const payload = {
    user_id: user.id,
    customer_email: user.email || "",
    plan: planConfig.plan,
    status: "pending",
    current_period_start: null,
    current_period_end: null,
    provider: "abacatepay",
    provider_customer_id: customer.id || checkout.customerId || null,
    provider_subscription_id: null,
    metadata: {
      source: paymentMethod === "PIX"
        ? "abacatepay_hosted_pix_checkout"
        : "abacatepay_subscription_checkout",
      integration_version: "hybrid_checkout_v2",
      billing_mode: paymentMethod === "PIX" ? "one_time" : "subscription",
      plan_key: planKey,
      checkout_id: checkout.id,
      checkout_url: checkout.url,
      product_id: product.id,
      product_external_id: product.externalId,
      checkout_external_id: checkout.externalId || null,
      amount_cents: planConfig.price,
      cycle: paymentMethod === "PIX" ? null : planConfig.cycle,
      payment_method: paymentMethod,
      methods: [paymentMethod],
    },
    updated_at: now.toISOString(),
  };

  const persist = (pending) => fetch(
    pending
      ? `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${encodeURIComponent(pending.id)}`
      : `${SUPABASE_URL}/rest/v1/subscriptions`,
    {
    method: pending ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });

  let res = await persist(existingPending);

  if (res.status === 409) {
    const current = await listUserSubscriptions(user.id);
    const pending = current.find((subscription) => subscription.status === "pending");
    if (pending) {
      res = await persist(pending);
    } else if (current.some(isCurrentlyActive)) {
      const error = new Error("Voce ja possui uma assinatura ativa.");
      error.status = 409;
      throw error;
    }
  }

  if (!res.ok) {
    throw new Error(`Erro ao salvar assinatura pendente: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
}

function getBaseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo nao permitido" });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const { plan: planKey, name, paymentMethod: requestedMethod } = req.body || {};
    const planConfig = getPlanByKey(planKey);
    const paymentMethod = String(requestedMethod || "").toUpperCase();

    if (!planConfig) {
      return res.status(400).json({ success: false, error: "Plano invalido" });
    }
    if (!["PIX", "CARD"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: "Metodo de pagamento invalido" });
    }

    const currentSubscriptions = await listUserSubscriptions(user.id);
    await expireStaleSubscriptions(currentSubscriptions);
    const activeSubscription = currentSubscriptions.find(isCurrentlyActive);
    if (activeSubscription) {
      return res.status(409).json({
        success: false,
        error: "Voce ja possui uma assinatura ativa. Cancele o plano atual antes de assinar outro.",
      });
    }
    const existingPending = currentSubscriptions.find((subscription) => subscription.status === "pending");
    if (existingPending) {
      const reused = await reusePendingCheckout(existingPending, planConfig, paymentMethod);
      if (reused) return res.status(200).json({ success: true, data: reused });
    }

    const profileName = name || await fetchProfileName(user.id);
    const customer = await findOrCreateCustomer({
      email: user.email,
      name: profileName || user.email?.split("@")[0] || "",
    });

    const checkoutProduct = getCheckoutProduct(planConfig, paymentMethod);
    const product = await findOrCreateProduct(checkoutProduct);

    const baseUrl = getBaseUrl(req);
    const checkoutParams = {
      customerId: customer.id,
      productId: product.id,
      returnUrl: `${baseUrl}/pagamento/processando`,
      completionUrl: `${baseUrl}/pagamento/processando`,
      externalId: `${user.id}:${checkoutProduct.externalId}:${Date.now()}`,
      metadata: {
        user_id: user.id,
        plan: planConfig.plan,
        plan_key: planKey,
        amount_cents: planConfig.price,
        payment_method: paymentMethod,
      },
    };
    const checkout = paymentMethod === "PIX"
      ? await createHostedCheckout(checkoutParams)
      : await createSubscriptionCheckout(checkoutParams);

    const subscription = await savePendingSubscription({
      user,
      planKey,
      planConfig,
      paymentMethod,
      checkout,
      product,
      customer,
      existingPending,
    });

    return res.status(200).json({
      success: true,
      data: {
        url: checkout.url,
        checkoutId: checkout.id,
        subscriptionId: subscription?.id || null,
      },
    });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    const unavailableCard = /card is not available for this store/i.test(error.message || "");
    return res.status(error.status || 500).json({
      success: false,
      error: unavailableCard
        ? "Cartao ainda nao esta habilitado nesta loja AbacatePay. Solicite a liberacao do metodo CARD no painel/suporte da AbacatePay e tente novamente."
        : error.message || "Erro interno ao criar checkout",
    });
  }
}
