import { getPlanByCode, getPlanByExternalId } from "../server/plans.js";
import {
  DEFAULT_ABACATEPAY_WEBHOOK_PUBLIC_KEY,
  verifyAbacateSignature,
} from "../server/webhook-security.js";
import {
  logAuditEvent,
  logServerError,
  prepareResponse,
} from "../server/supabase.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SERVICE_HEADERS = {
  "apikey": SUPABASE_SERVICE_KEY,
  ...(!SUPABASE_SERVICE_KEY?.startsWith("sb_secret_")
    ? { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` }
    : {}),
};
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;
const WEBHOOK_PUBLIC_KEY =
  process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY || DEFAULT_ABACATEPAY_WEBHOOK_PUBLIC_KEY;
const MAX_WEBHOOK_BYTES = 1024 * 1024;

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
  return req.headers["x-webhook-signature"] || "";
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8");
  if (typeof req.rawBody === "string") return req.rawBody;
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_WEBHOOK_BYTES) {
      const error = new Error("Payload do webhook muito grande");
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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
        ...SUPABASE_SERVICE_HEADERS,
      },
    }
  );

  if (!res.ok) {
    console.error("Erro ao buscar assinatura do webhook:", await res.text());
    return null;
  }

  const rows = await res.json();
  if (rows?.[0]) return rows[0];

  const parts = String(externalId || "").split(":");
  if (parts.length < 3) return null;

  const userId = parts[0];
  const productExternalId = parts.slice(1, -1).join(":");
  const eventPlan = getPlanByExternalId(productExternalId);
  if (!eventPlan || !/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const fallbackRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&order=updated_at.desc&limit=1`,
    {
      headers: {
        ...SUPABASE_SERVICE_HEADERS,
      },
    }
  );
  if (!fallbackRes.ok) return null;

  const fallbackRows = await fallbackRes.json();
  return fallbackRows?.[0] ? { ...fallbackRows[0], event_plan: eventPlan.plan } : null;
}

async function markWebhookProcessed({ eventType, checkoutId, payload }) {
  const eventId = payload?.id || payload?.eventId || `${eventType}:${checkoutId || "unknown"}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/abacatepay_webhook_events?on_conflict=event_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SUPABASE_SERVICE_HEADERS,
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
        ...SUPABASE_SERVICE_HEADERS,
      },
    }
  );
}

async function updateSubscription(subscription, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscription.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...SUPABASE_SERVICE_HEADERS,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Erro ao atualizar assinatura: ${await res.text()}`);
  }
}

function nextPeriodEnd(subscription, renewed = false, planCode = subscription.plan) {
  const now = new Date();
  const currentEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const start = renewed && currentEnd && currentEnd > now ? currentEnd : now;
  const end = new Date(start);

  const plan = getPlanByCode(planCode);
  if (plan?.cycle === "ANNUALLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  return { now, start, end };
}

async function activateSubscription(subscription, data, renewed = false, eventType = "subscription.completed") {
  const providerSubscription = data?.subscription || data || {};
  const remoteSubscriptionId = data?.subscription?.id || null;
  const checkout = data?.checkout || data || {};
  const pendingPlan = renewed ? subscription.metadata?.pending_plan : null;
  const effectivePlan = pendingPlan || subscription.event_plan || subscription.plan;
  const { now, start, end } = nextPeriodEnd(subscription, renewed, effectivePlan);
  await updateSubscription(subscription, {
    plan: effectivePlan,
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    provider_customer_id: data?.customer?.id || providerSubscription.customerId || subscription.provider_customer_id || null,
    provider_subscription_id: remoteSubscriptionId || subscription.provider_subscription_id || null,
    metadata: {
      ...(subscription.metadata || {}),
      paid_at: now.toISOString(),
      payment_method:
        providerSubscription.method ||
        data?.payerInformation?.method ||
        checkout?.methods?.[0] ||
        subscription.metadata?.payment_method ||
        null,
      abacatepay_status: providerSubscription.status || checkout?.status || "ACTIVE",
      last_event: eventType,
      ...(pendingPlan ? {
        previous_plan: subscription.plan,
        plan_change_status: "APPLIED",
        plan_changed_at: now.toISOString(),
        pending_plan: null,
        pending_plan_key: null,
        pending_product_id: null,
      } : {}),
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
  prepareResponse(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo nao permitido" });
  }

  let processedEventId = null;
  try {
    requireServerConfig();

    const rawBody = await readRawBody(req);
    if (!verifyAbacateSignature(rawBody, getSignature(req), WEBHOOK_PUBLIC_KEY)) {
      return res.status(401).json({ success: false, error: "Assinatura invalida" });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.event || payload?.type || "";
    const data = payload?.data || payload?.checkout || payload || {};
    const providerSubscription = data?.subscription || null;
    const checkout = data?.checkout || (eventType.startsWith("checkout.") ? data : null);
    const checkoutId = checkout?.id || payload?.checkoutId || payload?.checkout_id || null;
    const externalId = checkout?.externalId || checkout?.external_id || payload?.externalId || null;
    const providerSubscriptionId =
      providerSubscription?.id ||
      data?.subscriptionId ||
      data?.subscriptionChange?.subscriptionId ||
      null;

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
      await activateSubscription(subscription, data, false, eventType);
    }

    if (["subscription.completed", "subscription.trial_started"].includes(eventType)) {
      await activateSubscription(subscription, data);
    }

    if (eventType === "subscription.renewed") {
      await activateSubscription(subscription, data, true, eventType);
    }

    if (eventType === "subscription.plan_changed") {
      const change = data?.subscriptionChange || data?.change || data;
      await updateSubscription(subscription, {
        metadata: {
          ...(subscription.metadata || {}),
          plan_change_id: change?.id || subscription.metadata?.plan_change_id || null,
          plan_change_status: change?.status || "PENDING",
          pending_product_id: change?.productId || subscription.metadata?.pending_product_id || null,
          plan_change_requested_at: change?.requestedAt || new Date().toISOString(),
          plan_change_new_amount: change?.newAmount || subscription.metadata?.plan_change_new_amount || null,
          last_event: "subscription.plan_changed",
        },
        updated_at: new Date().toISOString(),
      });
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

    logAuditEvent("webhook.process", req, {
      targetId: checkoutId,
      outcome: eventType,
      provider: "abacatepay",
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    await releaseWebhookEvent(processedEventId);
    logServerError("abacate_webhook", error, req);
    const status = error?.status === 413 ? 413 : 500;
    return res.status(status).json({
      success: false,
      error: status === 413 ? error.message : "Erro interno ao processar webhook",
      requestId: req.requestId,
    });
  }
}
