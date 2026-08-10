import {
  logAuditEvent,
  logServerError,
  prepareResponse,
  supabaseRequest,
} from "../server/supabase.js";
import { getStripe } from "../server/stripe.js";
import {
  cancelDeletedStripeSubscription,
  fulfillPaidCheckoutSession,
  markCheckoutFailed,
  syncStripeInvoice,
  syncStripeSubscription,
} from "../server/stripe-sync.js";

export const config = {
  api: { bodyParser: false },
};

const MAX_WEBHOOK_BYTES = 1024 * 1024;

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body && typeof req.body === "object") {
    const error = new Error("Assinatura do webhook invalida");
    error.status = 400;
    throw error;
  }

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
  return Buffer.concat(chunks);
}

async function claimEvent(event) {
  const rows = await supabaseRequest(
    "stripe_webhook_events?on_conflict=event_id",
    {
      method: "POST",
      headers: { "Prefer": "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        event_id: String(event.id).slice(0, 255),
        event_type: String(event.type || "unknown").slice(0, 255),
        subscription_id: String(
          event.data?.object?.subscription || event.data?.object?.id || ""
        ).slice(0, 255) || null,
        status: "processing",
      }),
    }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function finishEvent(eventId) {
  await supabaseRequest(
    `stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString() }),
    }
  );
}

async function releaseEvent(eventId, error) {
  await supabaseRequest(
    `stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({
        status: "failed",
        last_error: String(error?.message || "Erro desconhecido").slice(0, 500),
      }),
    }
  ).catch(() => null);
  await supabaseRequest(
    `stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&status=eq.failed`,
    { method: "DELETE", headers: { "Prefer": "return=minimal" } }
  ).catch(() => null);
}

async function processEvent(stripe, event) {
  const object = event.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfillPaidCheckoutSession(stripe, object);
    case "checkout.session.async_payment_failed":
      return markCheckoutFailed(object, "expired");
    case "checkout.session.expired":
      return markCheckoutFailed(object, "expired");
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.pending_update_applied": {
      const current = await stripe.subscriptions.retrieve(object.id, {
        expand: ["items.data.price"],
      });
      return syncStripeSubscription(current, { userId: current.metadata?.user_id });
    }
    case "customer.subscription.deleted":
      return cancelDeletedStripeSubscription(object);
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return syncStripeInvoice(stripe, object, true);
    case "invoice.payment_failed":
      return syncStripeInvoice(stripe, object, false);
    default:
      return null;
  }
}

export default async function handler(req, res) {
  prepareResponse(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Metodo nao permitido" });
  }

  let eventId = null;
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret?.startsWith("whsec_")) {
      throw new Error("STRIPE_WEBHOOK_SECRET nao configurado corretamente");
    }

    const rawBody = await readRawBody(req);
    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        req.headers["stripe-signature"] || "",
        webhookSecret
      );
    } catch {
      const error = new Error("Assinatura do webhook invalida");
      error.status = 400;
      throw error;
    }

    eventId = event.id;
    if (!await claimEvent(event)) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    await processEvent(stripe, event);
    await finishEvent(event.id);
    logAuditEvent("stripe.webhook.processed", req, {
      targetId: event.id,
      outcome: event.type,
      provider: "stripe",
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (eventId) await releaseEvent(eventId, error);
    logServerError("stripe_webhook", error, req);
    const status = [400, 413].includes(Number(error?.status)) ? Number(error.status) : 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? error.message : "Erro interno ao processar webhook",
      requestId: req.requestId,
    });
  }
}

