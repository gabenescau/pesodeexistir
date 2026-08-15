import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  sendClientError,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import { handleBookPdf } from "../server/book-pdf.js";
import { fulfillPaidCheckoutSession } from "../server/stripe-sync.js";
import { getStripe } from "../server/stripe.js";
import { parseStripeSessionInput } from "../src/lib/api-contracts.js";

export default async function handler(req, res) {
  if (new URL(req.url || "/api/stripe-session", "https://app.pesodeexistir.online").searchParams.get("mode") === "book-pdf") {
    return handleBookPdf(req, res);
  }
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { sessionId } = parseStripeSessionInput(req.body);
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
      return sendClientError(req, res, 403, "Checkout nao pertence a esta conta");
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
    return sendSuccess(req, res, {
      status: session.status,
      paymentStatus: session.payment_status,
      mode: session.mode,
      fulfilled,
    });
  } catch (error) {
    logServerError("stripe_session", error, req);
    return sendError(req, res, error, "Nao foi possivel confirmar o pagamento");
  }
}
