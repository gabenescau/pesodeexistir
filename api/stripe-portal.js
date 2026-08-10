import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  getProfile,
  getSubscription,
  logAuditEvent,
  logServerError,
  requireUuid,
  sendError,
} from "../server/supabase.js";
import {
  getSiteUrl,
  getStripe,
} from "../server/stripe.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId } = req.body || {};
    requireUuid(subscriptionId, "subscriptionId");
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
      return res.status(404).json({ success: false, error: "Assinatura nao encontrada" });
    }

    const isAdmin = profile?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, error: "Operacao nao permitida" });
    }
    if (subscription.provider !== "stripe") {
      return res.status(400).json({ success: false, error: "Assinatura nao gerenciada por Stripe" });
    }
    if (!subscription.provider_customer_id) {
      return res.status(409).json({ success: false, error: "Assinatura sem cliente Stripe vinculado" });
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
    return res.status(200).json({ success: true, data: { url: session.url } });
  } catch (error) {
    logServerError("stripe_portal", error, req);
    return sendError(req, res, error, "Nao foi possivel abrir o portal de assinatura");
  }
}
