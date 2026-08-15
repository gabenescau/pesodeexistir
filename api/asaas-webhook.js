import crypto from "node:crypto";
import { markAsaasCheckoutState, syncAsaasCheckout } from "../server/asaas-sync.js";
import {
  prepareResponse,
  sendError,
  supabaseRequest,
} from "../server/supabase.js";

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getWebhookToken(req) {
  return String(req.headers["asaas-access-token"] || req.headers["x-asaas-access-token"] || "").trim();
}

function getEventId(payload) {
  return String(payload?.id || payload?.eventId || payload?.event_id || "").trim();
}

function getEventType(payload) {
  return String(payload?.event || payload?.eventType || payload?.event_type || "").trim().toUpperCase();
}

function getCheckoutId(payload) {
  return String(
    payload?.checkout?.id ||
    payload?.data?.checkout?.id ||
    payload?.checkoutId ||
    payload?.checkout_id ||
    ""
  ).trim();
}

async function claimEvent(eventId, eventType, checkoutId) {
  try {
    const rows = await supabaseRequest("asaas_webhook_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ event_id: eventId, event_type: eventType, checkout_id: checkoutId || null }),
    });
    return { event: rows?.[0] || null, fresh: true };
  } catch (error) {
    if (Number(error?.status) !== 409) throw error;
    const rows = await supabaseRequest(`asaas_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&limit=1&select=event_id,status,attempt_count,updated_at`);
    const existing = rows?.[0] || null;
    const isStale = existing?.updated_at && Date.parse(existing.updated_at) < Date.now() - 5 * 60 * 1000;
    if (existing?.status === "failed" || (existing?.status === "processing" && isStale)) {
      const updated = await supabaseRequest(`asaas_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&status=eq.${existing.status}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "processing", attempt_count: Math.min(100, Number(existing.attempt_count || 1) + 1), updated_at: new Date().toISOString(), last_error: null }),
      });
      return { event: updated?.[0] || existing, fresh: true };
    }
    return { event: existing, fresh: false };
  }
}

export default async function handler(req, res) {
  prepareResponse(req, res);
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Metodo nao permitido" });

  const expected = String(process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
  if (expected.length < 24 || !timingSafeEqualText(getWebhookToken(req), expected)) {
    return res.status(401).json({ success: false, error: "Webhook nao autorizado" });
  }

  const payload = req.body && typeof req.body === "object" ? req.body : null;
  const eventId = getEventId(payload);
  const eventType = getEventType(payload);
  const checkoutId = getCheckoutId(payload);
  if (!/^[A-Za-z0-9._:&-]{1,255}$/.test(eventId) || !/^[A-Z0-9_.-]{1,255}$/.test(eventType)) {
    return res.status(400).json({ success: false, error: "Evento invalido" });
  }

  try {
    const claim = await claimEvent(eventId, eventType, checkoutId);
    if (!claim.fresh) {
      // Asaas retries deliveries. A processed or currently processing event is
      // acknowledged without executing the entitlement mutation twice.
      return res.status(200).json({ received: true });
    }

    if (["CHECKOUT_PAID"].includes(eventType)) {
      if (!checkoutId) throw new Error("Evento pago sem checkout");
      await syncAsaasCheckout(checkoutId);
    } else if (eventType === "CHECKOUT_CANCELED") {
      if (checkoutId) await markAsaasCheckoutState(checkoutId, "canceled");
    } else if (eventType === "CHECKOUT_EXPIRED") {
      if (checkoutId) await markAsaasCheckoutState(checkoutId, "expired");
    }

    await supabaseRequest(`asaas_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }),
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    try {
      await supabaseRequest(`asaas_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed", last_error: String(error?.message || "erro").slice(0, 500), updated_at: new Date().toISOString() }),
      });
    } catch {}
    return sendError(req, res, error, "Webhook recebido, mas ainda nao foi processado");
  }
}
