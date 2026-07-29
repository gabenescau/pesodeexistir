import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;
const WEBHOOK_PUBLIC_KEY = process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY;

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
  if (!WEBHOOK_PUBLIC_KEY) {
    throw new Error("ABACATEPAY_WEBHOOK_PUBLIC_KEY nao configurada");
  }
}

function getSignature(req) {
  return req.headers["x-webhook-signature"] || "";
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

  const base64 = crypto.createHmac("sha256", WEBHOOK_PUBLIC_KEY).update(rawBody).digest("base64");
  return safeCompare(signature, base64);
}

async function findSubscriptionByCheckout({ checkoutId, externalId, providerSubscriptionId }) {
  const filters = [];
  if (checkoutId) filters.push(`metadata->>checkout_id.eq.${encodeURIComponent(checkoutId)}`);
  if (externalId) filters.push(`metadata->>checkout_external_id.eq.${encodeURIComponent(externalId)}`);
  if (providerSubscriptionId) {
    filters.push(`provider_subscription_id.eq.${encodeURIComponent(providerSubscriptionId)}`);
  }

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
      "Prefer": "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      checkout_id: checkoutId || null,
      payload,
    }),
  });

  if (!res.ok) {
    throw new Error(`Nao foi possivel registrar idempotencia do webhook: ${await res.text()}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? eventId : null;
}

async function releaseWebhookEvent(eventId) {
  if (!eventId) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/abacatepay_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
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

function nextPeriodEnd(subscription, renewed = false) {
  const now = new Date();
  const currentEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const start = renewed && currentEnd && currentEnd > now ? currentEnd : now;
  const end = new Date(start);

  if (subscription.plan === "ope_club_annual") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  return { now, start, end };
}

async function activateSubscription(subscription, data, renewed = false) {
  const providerSubscription = data?.subscription || data || {};
  const { now, start, end } = nextPeriodEnd(subscription, renewed);
  await updateSubscription(subscription, {
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    provider_customer_id: data?.customer?.id || providerSubscription.customerId || subscription.provider_customer_id || null,
    provider_subscription_id: providerSubscription.id || subscription.provider_subscription_id || null,
    metadata: {
      ...(subscription.metadata || {}),
      paid_at: now.toISOString(),
      payment_method: providerSubscription.method || data?.payerInformation?.method || null,
      abacatepay_status: providerSubscription.status || "ACTIVE",
      last_event: renewed ? "subscription.renewed" : "subscription.completed",
    },
    updated_at: now.toISOString(),
  });
}

async function deactivateSubscription(subscription, status, eventData) {
  const providerSubscription = eventData?.subscription || eventData || {};
  const now = new Date().toISOString();
  await updateSubscription(subscription, {
    status,
    canceled_at: now,
    metadata: {
      ...(subscription.metadata || {}),
      abacatepay_status: providerSubscription.status || status,
      cancelled_due_to: providerSubscription.cancelledDueTo || null,
    },
    updated_at: now,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo nao permitido" });
  }

  let processedEventId = null;
  try {
    requireServerConfig();

    const rawBody = await readRawBody(req);
    if (!safeCompare(req.query?.webhookSecret || "", WEBHOOK_SECRET)) {
      return res.status(401).json({ success: false, error: "Secret do webhook invalido" });
    }
    if (!verifyHmac(rawBody, getSignature(req))) {
      return res.status(401).json({ success: false, error: "Assinatura invalida" });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.event || payload?.type || "";
    const data = payload?.data || payload?.checkout || payload || {};
    const providerSubscription = data?.subscription || null;
    const checkout = data?.checkout || (eventType.startsWith("checkout.") ? data : null);
    const checkoutId = checkout?.id || payload?.checkoutId || payload?.checkout_id || null;
    const externalId = checkout?.externalId || checkout?.external_id || payload?.externalId || null;
    const providerSubscriptionId = providerSubscription?.id || null;

    const subscription = await findSubscriptionByCheckout({
      checkoutId,
      externalId,
      providerSubscriptionId,
    });
    if (!subscription) {
      console.warn("Webhook sem assinatura correspondente:", eventType, checkoutId, externalId);
      return res.status(500).json({ success: false, error: "Assinatura local ainda nao encontrada" });
    }

    processedEventId = await markWebhookProcessed({ eventType, checkoutId, payload });
    if (!processedEventId) return res.status(200).json({ success: true, duplicate: true });

    if (eventType === "checkout.completed") {
      await activateSubscription(subscription, data);
    }

    if (["subscription.completed", "subscription.trial_started"].includes(eventType)) {
      await activateSubscription(subscription, data);
    }

    if (eventType === "subscription.renewed") {
      await activateSubscription(subscription, data, true);
    }

    if (eventType === "subscription.payment_failed") {
      await updateSubscription(subscription, {
        status: "past_due",
        metadata: {
          ...(subscription.metadata || {}),
          retry_number: data?.retryNumber || null,
          abacatepay_status: providerSubscription?.status || "PAYMENT_FAILED",
        },
        updated_at: new Date().toISOString(),
      });
    }

    if (eventType === "subscription.cancelled") {
      await deactivateSubscription(subscription, "canceled", data);
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
    await releaseWebhookEvent(processedEventId);
    console.error("Erro no webhook:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
