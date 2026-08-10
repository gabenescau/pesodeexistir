import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  getProfile,
  getSubscription,
  logAuditEvent,
  logServerError,
  sendClientError,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import {
  getSiteUrl,
  getStripe,
} from "../server/stripe.js";
import { parseSubscriptionIdInput } from "../src/lib/api-contracts.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId } = parseSubscriptionIdInput(req.body);
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_portal",
      limit: 8,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const [profile, subscription] = await Promise.all([
      getProfile(user.id),
      getSubscription(subscriptionId),
    ]);
    if (!subscription) {
      return sendClientError(req, res, 404, "Assinatura nao encontrada");
    }

    const isAdmin = profile?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return sendClientError(req, res, 403, "Operacao nao permitida");
    }
    if (subscription.provider !== "stripe") {
      return sendClientError(req, res, 400, "Assinatura nao gerenciada por Stripe");
    }
    if (!subscription.provider_customer_id) {
      return sendClientError(req, res, 409, "Assinatura sem cliente Stripe vinculado");
    }

    const stripe = getStripe();
    const siteUrl = getSiteUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.provider_customer_id,
      return_url: `${siteUrl}/app/configuracoes/assinatura`,
    });

    logAuditEvent("subscription.portal.opened", req, {
      actorId: user.id,
      targetId: subscriptionId,
      outcome: "success",
      provider: "stripe",
    });
    return sendSuccess(req, res, { url: session.url });
  } catch (error) {
    logServerError("stripe_portal", error, req);
    return sendError(req, res, error, "Nao foi possivel abrir o portal de assinatura");
  }
}
