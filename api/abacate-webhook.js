import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

function requireServerConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase server env vars nao configuradas");
  }
  if (!WEBHOOK_SECRET) {
    throw new Error("ABACATEPAY_WEBHOOK_SECRET nao configurado");
  }
}

function getSignature(req) {
  return (
    req.headers["x-webhook-signature"] ||
    req.headers["x-abacatepay-signature"] ||
    req.headers["abacatepay-signature"] ||
    req.headers.signature ||
    ""
  );
}

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyHmac(rawBody, signature) {
  if (!signature) return false;

  const hex = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const base64 = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("base64");

  return safeCompare(signature, hex) || safeCompare(signature, base64);
}

async function findSubscriptionByCheckout({ checkoutId, externalId }) {
  const filters = [];
  if (checkoutId) filters.push(`metadata->>checkout_id.eq.${encodeURIComponent(checkoutId)}`);
  if (externalId) filters.push(`metadata->>checkout_external_id.eq.${encodeURIComponent(externalId)}`);

  if (filters.length === 0) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?or=(${filters.join(",")})&order=created_at.desc&limit=1`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    console.error("Erro ao buscar assinatura do webhook:", await res.text());
    return null;
  }

  const rows = await res.json();
  return rows?.[0] || null;
}

async function markWebhookProcessed({ eventType, checkoutId, payload }) {
  const eventId = payload?.id || payload?.eventId || `${eventType}:${checkoutId || "unknown"}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/abacatepay_webhook_events?on_conflict=event_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      checkout_id: checkoutId || null,
      payload,
    }),
  });

  if (res.status === 409) return false;
  if (!res.ok) {
    console.warn("Nao foi possivel registrar idempotencia do webhook:", await res.text());
  }
  return true;
}

async function updateSubscription(subscription, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Erro ao atualizar assinatura: ${await res.text()}`);
  }
}

function periodEndForPlan(plan) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + (plan === "ope_club_annual" ? 365 : 30));
  return { now, end };
}

async function activateSubscription(subscription, eventData) {
  const { now, end } = periodEndForPlan(subscription.plan);
  await updateSubscription(subscription, {
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    provider_customer_id: eventData?.customerId || eventData?.customer?.id || subscription.provider_customer_id || null,
    provider_subscription_id: eventData?.id || subscription.provider_subscription_id || null,
    metadata: {
      ...(subscription.metadata || {}),
      paid_at: now.toISOString(),
      abacatepay_status: eventData?.status || "completed",
    },
    updated_at: now.toISOString(),
  });
}

async function deactivateSubscription(subscription, status, eventData) {
  const now = new Date().toISOString();
  await updateSubscription(subscription, {
    status,
    canceled_at: now,
    metadata: {
      ...(subscription.metadata || {}),
      abacatepay_status: eventData?.status || status,
    },
    updated_at: now,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo nao permitido" });
  }

  try {
    requireServerConfig();

    const rawBody = await readRawBody(req);
    if (!verifyHmac(rawBody, getSignature(req))) {
      return res.status(401).json({ success: false, error: "Assinatura invalida" });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.event || payload?.type || "";
    const data = payload?.data || payload?.checkout || payload || {};
    const checkoutId = data?.id || payload?.checkoutId || payload?.checkout_id || null;
    const externalId = data?.externalId || data?.external_id || payload?.externalId || null;

    const shouldProcess = await markWebhookProcessed({ eventType, checkoutId, payload });
    if (!shouldProcess) return res.status(200).json({ success: true, duplicate: true });

    const subscription = await findSubscriptionByCheckout({ checkoutId, externalId });
    if (!subscription) {
      console.warn("Webhook sem assinatura correspondente:", eventType, checkoutId, externalId);
      return res.status(200).json({ success: true, matched: false });
    }

    if (eventType === "checkout.completed") {
      await activateSubscription(subscription, data);
    }

    if (["checkout.refunded", "checkout.disputed", "checkout.lost"].includes(eventType)) {
      await deactivateSubscription(
        subscription,
        eventType === "checkout.refunded" ? "refunded" : "canceled",
        data
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
