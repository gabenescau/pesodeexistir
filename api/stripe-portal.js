import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  getProfile,
  getSubscription,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  sendClientError,
  sendError,
  sendSuccess,
  updateSubscription,
} from "../server/supabase.js";
import {
  getSiteUrl,
  getStripe,
  resolveStripeSubscriptionForBilling,
  stripeSubscriptionPatch,
} from "../server/stripe.js";
import { parseSubscriptionIdInput } from "../src/lib/api-contracts.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const syncOnly = req.body?.mode === "sync";
    const { subscriptionId } = syncOnly
      ? { subscriptionId: typeof req.body?.subscriptionId === "string" ? req.body.subscriptionId : null }
      : parseSubscriptionIdInput(req.body);
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_portal",
      limit: 8,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const [profile, localSubscription] = await Promise.all([
      getProfile(user.id),
      subscriptionId
        ? getSubscription(subscriptionId)
        : listUserSubscriptions(user.id).then((items) => items.find((item) =>
          item.provider === "stripe" &&
          ["active", "trialing", "past_due", "pending", "paused"].includes(item.status)
        ) || null),
    ]);
    let subscription = localSubscription;
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
    const stripe = getStripe();
    const resolved = await resolveStripeSubscriptionForBilling(subscription);
    const customerId = resolved?.customerId || subscription.provider_customer_id;
    if (!customerId) {
      return sendClientError(req, res, 409, "Assinatura sem cliente Stripe vinculado");
    }
    if (resolved?.subscription) {
      const synced = await updateSubscription(subscription.id, stripeSubscriptionPatch(resolved.subscription, subscription));
      if (synced) subscription = synced;
      if (syncOnly) {
        return sendSuccess(req, res, { subscription, synchronized: true });
      }
      if (!["active", "trialing", "past_due", "paused"].includes(resolved.subscription.status)) {
        return sendClientError(req, res, 409, "Esta assinatura nao esta disponivel para gerenciamento");
      }
    }
    if (syncOnly) return sendSuccess(req, res, { subscription, synchronized: false });
    const siteUrl = getSiteUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
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
