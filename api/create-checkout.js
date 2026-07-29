import {
  findOrCreateCustomer,
  findOrCreateProduct,
  createSubscriptionCheckout,
} from "./abacatepay.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_CATALOG = {
  monthly: {
    plan: "ope_club_monthly",
    externalId: "ope_club_monthly_subscription_v1",
    name: "OPE Club Mensal",
    price: 2400,
    durationDays: 30,
    description: "Assinatura mensal OPE Club",
    cycle: "MONTHLY",
  },
  annual: {
    plan: "ope_club_annual",
    externalId: "ope_club_annual_subscription_v1",
    name: "OPE Club Anual",
    price: 14400,
    durationDays: 365,
    description: "Assinatura anual OPE Club com mais de 50% de desconto",
    cycle: "ANNUALLY",
  },
};

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

async function savePendingSubscription({ user, planKey, planConfig, checkout, product, customer, existingPending }) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + planConfig.durationDays);

  const payload = {
    user_id: user.id,
    customer_email: user.email || "",
    plan: planConfig.plan,
    status: "pending",
    current_period_start: now.toISOString(),
    current_period_end: expiresAt.toISOString(),
    provider: "abacatepay",
    provider_customer_id: customer.id || checkout.customerId || null,
    provider_subscription_id: null,
    metadata: {
      source: "abacatepay_subscription_checkout",
      integration_version: "subscriptions_v2",
      plan_key: planKey,
      checkout_id: checkout.id,
      checkout_url: checkout.url,
      product_id: product.id,
      product_external_id: planConfig.externalId,
      checkout_external_id: checkout.externalId || null,
      amount_cents: planConfig.price,
      cycle: planConfig.cycle,
      methods: ["PIX", "CARD"],
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
    const { plan: planKey, name } = req.body || {};
    const planConfig = PLAN_CATALOG[planKey];

    if (!planConfig) {
      return res.status(400).json({ success: false, error: "Plano invalido" });
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

    const profileName = name || await fetchProfileName(user.id);
    const customer = await findOrCreateCustomer({
      email: user.email,
      name: profileName || user.email?.split("@")[0] || "",
    });

    const product = await findOrCreateProduct({
      externalId: planConfig.externalId,
      name: planConfig.name,
      price: planConfig.price,
      description: planConfig.description,
      cycle: planConfig.cycle,
    });

    const baseUrl = getBaseUrl(req);
    const checkout = await createSubscriptionCheckout({
      customerId: customer.id,
      items: [{ id: product.id, quantity: 1 }],
      methods: ["PIX", "CARD"],
      returnUrl: `${baseUrl}/pagamento/processando`,
      completionUrl: `${baseUrl}/pagamento/processando`,
      externalId: `${user.id}:${planConfig.externalId}:${Date.now()}`,
      metadata: {
        user_id: user.id,
        plan: planConfig.plan,
        plan_key: planKey,
        amount_cents: planConfig.price,
      },
    });

    const subscription = await savePendingSubscription({
      user,
      planKey,
      planConfig,
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
