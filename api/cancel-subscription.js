import { cancelAbacateSubscription } from "./abacatepay.js";

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
    const error = new Error("Sessao obrigatoria para cancelar assinatura");
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

async function getProfile(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function getSubscription(subscriptionId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${encodeURIComponent(subscriptionId)}&select=*`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar assinatura: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
}

async function updateSubscription(subscription, user) {
  const now = new Date().toISOString();
  let remoteCancellation = null;

  if (subscription.provider === "abacatepay" && subscription.provider_subscription_id) {
    remoteCancellation = await cancelAbacateSubscription(subscription.provider_subscription_id);
  }

  const metadata = {
    ...(subscription.metadata || {}),
    canceled_by: user.id,
    canceled_source: "user_request",
    cancellation_mode: remoteCancellation ? "abacatepay_api" : "local_legacy",
    abacatepay_cancellation_status: remoteCancellation?.status || null,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: now,
      metadata,
      updated_at: now,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erro ao cancelar assinatura: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
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
    const { subscriptionId } = req.body || {};

    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: "subscriptionId obrigatorio" });
    }

    const [profile, subscription] = await Promise.all([
      getProfile(user.id),
      getSubscription(subscriptionId),
    ]);

    if (!subscription) {
      return res.status(404).json({ success: false, error: "Assinatura nao encontrada" });
    }

    const isAdmin = profile?.role === "admin" || user?.app_metadata?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, error: "Voce nao pode cancelar esta assinatura" });
    }

    const updated = await updateSubscription(subscription, user);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Erro interno ao cancelar assinatura",
    });
  }
}
