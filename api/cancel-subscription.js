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
import { getStripe } from "../server/stripe.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId, immediate = false } = req.body || {};
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

    const now = new Date().toISOString();
    let updated;

    if (subscription.provider === "stripe" && subscription.provider_subscription_id) {
      // Admin "remover" cancela imediatamente no Stripe (fim imediato do acesso).
      // Usuario comum cancela no fim do periodo (cancel_at_period_end).
      const stripe = getStripe();
      if (immediate && isAdmin) {
        await stripe.subscriptions.cancel(subscription.provider_subscription_id);
        updated = await updateSubscription(subscription.id, {
          status: "canceled",
          cancel_at_period_end: false,
          canceled_at: now,
          metadata: {
            ...subscription.metadata,
            canceled_by: user.id,
            cancellation: "stripe_immediate_admin",
            requested_at: now,
          },
        });
      } else {
        const remote = await stripe.subscriptions.update(
          subscription.provider_subscription_id,
          { cancel_at_period_end: true }
        );
        updated = await updateSubscription(subscription.id, {
          cancel_at_period_end: Boolean(remote.cancel_at_period_end),
          metadata: {
            ...subscription.metadata,
            canceled_by: user.id,
            cancellation: "stripe_cancel_at_period_end",
            requested_at: now,
          },
        });
      }
    } else if (subscription.provider === "stripe") {
      if (!isAdmin) {
        return res.status(409).json({
          success: false,
          error: "O pagamento por PIX nao tem renovacao automatica. Seu acesso termina na data informada e nao ha assinatura recorrente para cancelar.",
        });
      }
      updated = await updateSubscription(subscription.id, {
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: now,
        metadata: {
          ...subscription.metadata,
          canceled_by: user.id,
          cancellation_mode: "stripe_pix_admin_revoke",
        },
      });
    } else {
      // Provedores locais (manual_admin, legados): encerra imediatamente no banco.
      updated = await updateSubscription(subscription.id, {
        status: "canceled",
        cancel_at_period_end: false,
        canceled_at: now,
        metadata: {
          ...subscription.metadata,
          canceled_by: user.id,
          cancellation_mode: "local",
        },
      });
    }

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
