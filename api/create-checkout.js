import { findOrCreateCustomer, findOrCreateProduct, createCheckout } from "./abacatepay.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_CATALOG = {
  monthly: {
    plan: "ope_club_monthly",
    externalId: "ope_club_monthly",
    name: "OPE Club Mensal",
    price: 2400,
    durationDays: 30,
    description: "Assinatura mensal OPE Club",
  },
  annual: {
    plan: "ope_club_annual",
    externalId: "ope_club_annual",
    name: "OPE Club Anual",
    price: 14400,
    durationDays: 365,
    description: "Assinatura anual OPE Club com mais de 50% de desconto",
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

async function createPendingSubscription({ user, planKey, planConfig, checkout, product }) {
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
    metadata: {
      source: "abacatepay_checkout",
      plan_key: planKey,
      checkout_id: checkout.id,
      checkout_url: checkout.url,
      product_id: product.id,
      product_external_id: planConfig.externalId,
      checkout_external_id: checkout.externalId || null,
      amount_cents: planConfig.price,
      methods: ["PIX"],
    },
    updated_at: now.toISOString(),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });

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
    });

    const baseUrl = getBaseUrl(req);
    const checkout = await createCheckout({
      customerId: customer.id,
      items: [{ id: product.id, quantity: 1 }],
      methods: ["PIX"],
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

    const subscription = await createPendingSubscription({
      user,
      planKey,
      planConfig,
      checkout,
      product,
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
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Erro interno ao criar checkout",
    });
  }
}
