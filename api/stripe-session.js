import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  sendError,
} from "../server/supabase.js";
import { fulfillPaidCheckoutSession } from "../server/stripe-sync.js";
import { getStripe } from "../server/stripe.js";

const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{8,240}$/;

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const sessionId = String(req.body?.sessionId || "");
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Checkout invalido",
        requestId: req.requestId,
      });
    }
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_session",
      limit: 20,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const ownerId = session.metadata?.user_id || session.client_reference_id;
    if (ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: "Checkout nao pertence a esta conta",
        requestId: req.requestId,
      });
    }

    let fulfilled = false;
    const canFulfill = session.payment_status === "paid" ||
      (session.mode === "subscription" && session.status === "complete");
    if (canFulfill) {
      fulfilled = Boolean(await fulfillPaidCheckoutSession(stripe, session));
    }

    logAuditEvent("stripe.checkout.status", req, {
      actorId: user.id,
      targetId: session.id,
      outcome: fulfilled ? "fulfilled" : session.payment_status,
      provider: "stripe",
    });
    return res.status(200).json({
      success: true,
      data: {
        status: session.status,
        paymentStatus: session.payment_status,
        mode: session.mode,
        fulfilled,
      },
    });
  } catch (error) {
    logServerError("stripe_session", error, req);
    return sendError(req, res, error, "Nao foi possivel confirmar o pagamento");
  }
}
