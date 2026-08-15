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
import {
  getStripe,
  resolveStripeSubscriptionForBilling,
  stripeSubscriptionPatch,
} from "../server/stripe.js";
import { parseSubscriptionIdInput } from "../src/lib/api-contracts.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionId, immediate, resume } = parseSubscriptionIdInput(req.body);
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
      return sendClientError(req, res, 404, "Assinatura nao encontrada");
    }

    const isAdmin = profile?.role === "admin";
    if (!isAdmin && subscription.user_id !== user.id) {
      return sendClientError(req, res, 403, "Operacao nao permitida");
    }
    if (!["active", "past_due", "trialing"].includes(subscription.status)) {
      return sendClientError(req, res, 409, "A assinatura nao esta ativa");
    }

    const now = new Date().toISOString();
    let updated;

    if (resume) {
      if (subscription.provider === "asaas") {
        return sendClientError(req, res, 409, "Este pagamento Asaas e avulso e nao possui renovacao automatica para reativar.");
      }
      if (subscription.provider !== "stripe") {
        return sendClientError(req, res, 400, "Assinatura nao gerenciada por Stripe");
      }
      const resolved = await resolveStripeSubscriptionForBilling(subscription);
      if (!resolved?.subscription) {
        return sendClientError(req, res, 409, "Nao encontramos a assinatura ativa na Stripe");
      }
      if (!["active", "trialing", "past_due", "paused"].includes(resolved.subscription.status)) {
        return sendClientError(req, res, 409, "Esta assinatura nao esta ativa na Stripe");
      }
      if (!resolved.subscription.cancel_at_period_end) return sendSuccess(req, res, subscription);
      const stripe = getStripe();
      const remote = await stripe.subscriptions.update(
        resolved.subscription.id,
        { cancel_at_period_end: false },
        { idempotencyKey: `ope-resume-${resolved.subscription.id}` }
      );
      const patch = stripeSubscriptionPatch(remote, subscription);
      updated = await updateSubscription(subscription.id, {
        ...patch,
        metadata: { ...patch.metadata, resumed_by: user.id, resumed_at: now },
      });
      logAuditEvent("subscription.cancelation.resumed", req, {
        actorId: user.id,
        targetId: subscription.id,
        outcome: "success",
        provider: "stripe",
      });
      return sendSuccess(req, res, updated || subscription);
    }

    if (subscription.provider === "asaas") {
      return sendClientError(req, res, 409, "Este pagamento Asaas e avulso. O acesso permanece ativo ate a data de termino; nao existe renovacao para cancelar.");
    }

    if (subscription.provider === "stripe") {
      const resolved = await resolveStripeSubscriptionForBilling(subscription);
      if (!resolved?.subscription) {
        if (!isAdmin) {
          return sendClientError(req, res, 409, "Nao encontramos a assinatura ativa na Stripe");
        }
        updated = await updateSubscription(subscription.id, {
          status: "canceled",
          cancel_at_period_end: false,
          canceled_at: now,
          metadata: {
            ...subscription.metadata,
            canceled_by: user.id,
            cancellation_mode: "stripe_local_admin_revoke",
          },
        });
      } else {
        if (!["active", "trialing", "past_due", "paused"].includes(resolved.subscription.status)) {
          return sendClientError(req, res, 409, "Esta assinatura nao esta ativa na Stripe");
        }
        // Admin "remover" cancela imediatamente no Stripe (fim imediato do acesso).
        // Usuario comum cancela no fim do periodo (cancel_at_period_end).
        const stripe = getStripe();
        const remote = immediate && isAdmin
          ? await stripe.subscriptions.cancel(resolved.subscription.id, {
              idempotencyKey: `ope-cancel-${resolved.subscription.id}-immediate`,
            })
          : await stripe.subscriptions.update(
              resolved.subscription.id,
              { cancel_at_period_end: true },
              { idempotencyKey: `ope-cancel-${resolved.subscription.id}-period-end` }
            );
        const patch = stripeSubscriptionPatch(remote, subscription);
        updated = await updateSubscription(subscription.id, {
          ...patch,
          metadata: {
            ...patch.metadata,
            canceled_by: user.id,
            cancellation: immediate && isAdmin
              ? "stripe_immediate_admin"
              : "stripe_cancel_at_period_end",
            requested_at: now,
          },
        });
      }
    } else {
      // Provedores locais (manual_admin, legados): encerra imediatamente no banco.
      if (!isAdmin) {
        return sendClientError(req, res, 403, "Somente administradores podem cancelar assinaturas manuais.");
      }
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
    return sendSuccess(req, res, updated);
  } catch (error) {
    logServerError("cancel_subscription", error, req);
    return sendError(req, res, error, "Erro interno ao cancelar assinatura");
  }
}
