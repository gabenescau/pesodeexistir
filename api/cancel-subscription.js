import { cancelAbacateSubscription } from "./abacatepay.js";
import {
  allowPost,
  getAuthenticatedUser,
  getProfile,
  getSubscription,
  updateSubscription,
} from "./_server.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId } = req.body || {};
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: "subscriptionId obrigatorio" });
    }

    const [profile, subscription] = await Promise.all([
      getProfile(user.id),
      getSubscription(subscriptionId),
    ]);
    if (!subscription) {
      return res.status(404).json({ success: false, error: "Assinatura nao encontrada" });
    }

    const isAdmin = profile?.role === "admin" || user?.app_metadata?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, error: "Operacao nao permitida" });
    }
    if (!["active", "past_due", "trialing"].includes(subscription.status)) {
      return res.status(409).json({ success: false, error: "A assinatura nao esta ativa" });
    }

    let remote = null;
    if (subscription.provider === "abacatepay") {
      if (!subscription.provider_subscription_id) {
        return res.status(409).json({
          success: false,
          error: "ID remoto ausente. Sincronize a assinatura ou verifique o webhook antes de cancelar.",
        });
      }
      remote = await cancelAbacateSubscription(subscription.provider_subscription_id);
    }

    const now = new Date().toISOString();
    const updated = await updateSubscription(subscription.id, {
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: now,
      metadata: {
        ...(subscription.metadata || {}),
        canceled_by: user.id,
        cancellation_mode: remote ? "abacatepay_api" : "manual_admin",
        abacatepay_cancellation_status: remote?.status || null,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Erro interno ao cancelar assinatura",
    });
  }
}
