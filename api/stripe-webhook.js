import {
  logAuditEvent,
  logServerError,
  prepareResponse,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
} from "../server/supabase.js";
import { getStripe } from "../server/stripe.js";
import {
  cancelDeletedStripeSubscription,
  fulfillPaidCheckoutSession,
  markCheckoutFailed,
  clearExpiredPendingPlan,
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
  const result = await supabaseRequest("rpc/claim_stripe_webhook_event", {
    method: "POST",
    body: JSON.stringify({
      p_event_id: String(event.id).slice(0, 255),
      p_event_type: String(event.type || "unknown").slice(0, 255),
      p_subscription_id: String(
        event.data?.object?.subscription || event.data?.object?.id || ""
      ).slice(0, 255) || null,
    }),
  });
  return Boolean(result?.claimed);
}

async function finishEvent(eventId) {
  await supabaseRequest("rpc/finish_stripe_webhook_event", {
    method: "POST",
    body: JSON.stringify({ p_event_id: String(eventId).slice(0, 255) }),
  });
}

async function releaseEvent(eventId, error) {
  await supabaseRequest("rpc/fail_stripe_webhook_event", {
    method: "POST",
    body: JSON.stringify({
      p_event_id: String(eventId).slice(0, 255),
      p_error: String(error?.message || "Erro desconhecido").slice(0, 500),
    }),
  }).catch(() => null);
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
      const synced = await syncStripeSubscription(current, { userId: current.metadata?.user_id });
      await clearExpiredPendingPlan(object.id);
      return synced;
    }
    case "customer.subscription.pending_update_expired": {
      const current = await stripe.subscriptions.retrieve(object.id, {
        expand: ["items.data.price"],
      });
      await syncStripeSubscription(current, { userId: current.metadata?.user_id });
      return clearExpiredPendingPlan(object.id);
    }
    case "customer.subscription.deleted":
      return cancelDeletedStripeSubscription(object);
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return syncStripeInvoice(stripe, object, true);
    case "invoice.payment_failed":
      return syncStripeInvoice(stripe, object, false);
    case "invoice.payment_action_required":
      return syncStripeInvoice(stripe, object, false);
    default:
      return null;
  }
}

export default async function handler(req, res) {
  prepareResponse(req, res);
  if (req.method !== "POST") {
    return sendClientError(req, res, 405, "Metodo nao permitido");
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
      return sendSuccess(req, res, null, 200, { duplicate: true });
    }

    await processEvent(stripe, event);
    await finishEvent(event.id);
    logAuditEvent("stripe.webhook.processed", req, {
      targetId: event.id,
      outcome: event.type,
      provider: "stripe",
    });
    return sendSuccess(req, res);
  } catch (error) {
    if (eventId) await releaseEvent(eventId, error);
    logServerError("stripe_webhook", error, req);
    const status = [400, 413].includes(Number(error?.status)) ? Number(error.status) : 500;
    if (status === 400) return sendClientError(req, res, status, error.message);
    return sendError(req, res, error, "Erro interno ao processar webhook");
  }
}
