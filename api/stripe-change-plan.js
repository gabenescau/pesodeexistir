import { getPlanByKey } from "../server/plans.js";
import { parseSubscriptionInput } from "../src/lib/api-contracts.js";
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
    const { subscriptionId, plan: planKey } = parseSubscriptionInput(req.body);
    const plan = getPlanByKey(planKey);
    if (!plan) {
      return sendClientError(req, res, 400, "Plano invalido");
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
      return sendClientError(req, res, 404, "Assinatura nao encontrada");
    }
    const isAdmin = profile?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return sendClientError(req, res, 403, "Operacao nao permitida");
    }
    if (subscription.status === "pending" && !isAdmin) {
      return sendClientError(req, res, 403, "A assinatura ainda esta pendente. Aguarde a confirmacao do pagamento.");
    }
    if (subscription.plan === plan.plan) {
      return sendClientError(req, res, 409, "Ja e o plano atual");
    }
    if (subscription.metadata?.requested_plan === plan.plan) {
      return sendSuccess(req, res, { pending: true, subscriptionId: subscription.id, requestedPlan: plan.plan });
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
        return sendClientError(req, res, 409, "Assinatura no Stripe sem itens");
      }
      const newPriceId = await validatePriceForPlan(plan);
      const changed = await stripe.subscriptions.update(remote.id, {
        items: [{ id: item.id, price: newPriceId }],
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
      }, {
        idempotencyKey: `ope-plan-change-${remote.id}-${plan.key}-${remote.current_period_start || "current"}`,
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
      return sendSuccess(req, res, {
        pending: Boolean(changed.pending_update),
        subscriptionId: subscription.id,
        requestedPlan: plan.plan,
      });
    }

    if (subscription.provider === "stripe" && !subscription.provider_subscription_id) {
      return sendClientError(req, res, 409, "Este acesso nao possui assinatura recorrente para alterar.");
    }

    if (subscription.provider === "manual_admin" || subscription.status === "pending") {
      if (!isAdmin) {
        return sendClientError(req, res, 403, "Somente administradores podem alterar assinaturas manuais ou pendentes.");
      }
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
      return sendSuccess(req, res, updated);
    }

    return sendClientError(req, res, 409, "Nao foi possivel trocar o plano desta assinatura");
  } catch (error) {
    logServerError("stripe_change_plan", error, req);
    return sendError(req, res, error, "Erro interno ao trocar de plano");
  }
}
