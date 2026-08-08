import { cancelAbacateSubscription } from "../server/abacatepay.js";
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
  updateSubscription,
} from "../server/supabase.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId } = req.body || {};
    requireUuid(subscriptionId, "subscriptionId");
    if (!await enforceRateLimit(req, res, {
      scope: "cancel_subscription",
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
    if (!["active", "past_due", "trialing"].includes(subscription.status)) {
      return res.status(409).json({ success: false, error: "A assinatura nao esta ativa" });
    }

    let remote = null;
    if (subscription.provider === "abacatepay") {
      const isOneTimeCheckout = subscription.metadata?.billing_mode === "one_time";
      if (!subscription.provider_subscription_id && !isOneTimeCheckout) {
        return res.status(409).json({
          success: false,
          error: "ID remoto ausente. Sincronize a assinatura ou verifique o webhook antes de cancelar.",
        });
      }
      if (subscription.provider_subscription_id) {
        remote = await cancelAbacateSubscription(subscription.provider_subscription_id);
      }
    }

    const now = new Date().toISOString();
    const updated = await updateSubscription(subscription.id, {
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: now,
      metadata: {
        ...(subscription.metadata || {}),
        canceled_by: user.id,
        cancellation_mode: remote ? "abacatepay_api" : "one_time_access",
        abacatepay_cancellation_status: remote?.status || null,
      },
    });

    logAuditEvent("subscription.cancel", req, {
      actorId: user.id,
      targetId: subscriptionId,
      outcome: "success",
      provider: subscription.provider,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logServerError("cancel_subscription", error, req);
    return sendError(req, res, error, "Erro interno ao cancelar assinatura");
  }
}
