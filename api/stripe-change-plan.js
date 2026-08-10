import { getPlanByKey } from "../server/plans.js";
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
import { getStripe, validatePriceForPlan } from "../server/stripe.js";

// Upgrade / downgrade / troca de ciclo da assinatura.
// - Stripe: troca o Price com pending updates. O plano local so muda depois
//   que a Stripe confirmar a cobranca e enviar customer.subscription.updated.
// - manual_admin / pending: grava a troca localmente mantendo as datas.
export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId, plan: planKey } = req.body || {};
    requireUuid(subscriptionId, "subscriptionId");
    const plan = getPlanByKey(planKey);
    if (!plan) {
      return res.status(400).json({ success: false, error: "Plano invalido", requestId: req.requestId });
    }
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_change_plan",
      limit: 10,
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
    if (subscription.plan === plan.plan) {
      return res.status(409).json({ success: false, error: "Ja e o plano atual" });
    }

    const now = new Date().toISOString();

    if (subscription.provider === "stripe" && subscription.provider_subscription_id) {
      const stripe = getStripe();
      const remote = await stripe.subscriptions.retrieve(
        subscription.provider_subscription_id,
        { expand: ["items.data.price"] }
      );
      const item = remote?.items?.data?.[0];
      if (!item?.id) {
        return res.status(409).json({ success: false, error: "Assinatura no Stripe sem itens" });
      }
      const newPriceId = await validatePriceForPlan(plan);
      const changed = await stripe.subscriptions.update(remote.id, {
        items: [{ id: item.id, price: newPriceId }],
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
      });
      await updateSubscription(subscription.id, {
        metadata: {
          ...subscription.metadata,
          previous_plan: subscription.plan,
          requested_plan: plan.plan,
          changed_by: user.id,
          changed_at: now,
          change_mode: "stripe_pending_update",
        },
      });
      logAuditEvent("subscription.change_plan", req, {
        actorId: user.id,
        targetId: subscription.id,
        outcome: "success",
        provider: "stripe",
        fromPlan: subscription.plan,
        toPlan: plan.plan,
      });
      return res.status(200).json({
        success: true,
        data: {
          pending: Boolean(changed.pending_update),
          subscriptionId: subscription.id,
          requestedPlan: plan.plan,
        },
      });
    }

    if (subscription.provider === "stripe" && !subscription.provider_subscription_id) {
      return res.status(409).json({
        success: false,
        error: "O acesso pago por PIX nao e recorrente. Escolha outro plano quando este periodo terminar.",
      });
    }

    if (subscription.provider === "manual_admin" || subscription.status === "pending") {
      const updated = await updateSubscription(subscription.id, {
        plan: plan.plan,
        metadata: {
          ...subscription.metadata,
          previous_plan: subscription.plan,
          changed_by: user.id,
          changed_at: now,
          change_mode: "manual",
        },
      });
      logAuditEvent("subscription.change_plan", req, {
        actorId: user.id,
        targetId: subscription.id,
        outcome: "success",
        provider: "manual_admin",
        fromPlan: subscription.plan,
        toPlan: plan.plan,
      });
      return res.status(200).json({ success: true, data: updated });
    }

    return res.status(409).json({ success: false, error: "Nao foi possivel trocar o plano desta assinatura" });
  } catch (error) {
    logServerError("stripe_change_plan", error, req);
    return sendError(req, res, error, "Erro interno ao trocar de plano");
  }
}
