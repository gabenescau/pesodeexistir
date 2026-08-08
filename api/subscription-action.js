import {
  changeAbacateSubscriptionPlan,
  findOrCreateProduct,
  listHostedCheckouts,
  listSubscriptionCheckouts,
} from "../server/abacatepay.js";
import { getPlanByCode, getPlanByKey } from "../server/plans.js";
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

function isAdmin(profile) {
  return profile?.role === "admin";
}

function providerSubscriptionId(remote) {
  const candidates = [
    remote?.subscription?.id,
    remote?.subscriptionId,
    remote?.providerSubscriptionId,
  ];
  return candidates.find((id) => typeof id === "string" && id.startsWith("subs_")) || null;
}

function localStatus(remoteStatus) {
  return {
    PENDING: "pending",
    PAID: "active",
    CANCELLED: "canceled",
    EXPIRED: "expired",
    REFUNDED: "refunded",
  }[remoteStatus] || null;
}

function initialPeriod(plan) {
  const start = new Date();
  const end = new Date(start);
  if (plan.cycle === "ANNUALLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return {
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
  };
}

async function synchronize(subscription) {
  if (subscription.provider !== "abacatepay") return subscription;

  const checkoutId = subscription.metadata?.checkout_id;
  const externalId = subscription.metadata?.checkout_external_id;
  const filters = checkoutId ? { id: checkoutId } : externalId ? { externalId } : null;
  if (!filters) {
    throw new Error("Assinatura local sem identificador de checkout da AbacatePay");
  }

  const listCheckouts = subscription.metadata?.billing_mode === "one_time"
    ? listHostedCheckouts
    : listSubscriptionCheckouts;
  const remote = (await listCheckouts(filters))[0];
  if (!remote) {
    throw new Error("Checkout de assinatura nao encontrado na AbacatePay");
  }

  const status = localStatus(remote.status);
  if (!status) throw new Error(`Status desconhecido retornado pela AbacatePay: ${remote.status}`);

  const plan = getPlanByCode(subscription.plan);
  const payload = {
    status,
    provider_customer_id: remote.customerId || subscription.provider_customer_id,
    provider_subscription_id: providerSubscriptionId(remote) || subscription.provider_subscription_id,
    canceled_at: status === "canceled" ? new Date().toISOString() : subscription.canceled_at,
    metadata: {
      ...(subscription.metadata || {}),
      checkout_url: remote.url || subscription.metadata?.checkout_url,
      abacatepay_checkout_status: remote.status,
      last_synced_at: new Date().toISOString(),
    },
  };

  if (status === "active" && !subscription.current_period_end && plan) {
    Object.assign(payload, initialPeriod(plan));
  }

  return updateSubscription(subscription.id, payload);
}

async function changePlan(subscription, planKey) {
  if (subscription.provider !== "abacatepay") {
    throw new Error("Upgrade e downgrade oficial exigem uma assinatura da AbacatePay");
  }
  if (subscription.status !== "active") {
    throw new Error("Somente assinaturas ativas podem alterar de plano");
  }
  if (subscription.metadata?.billing_mode === "one_time") {
    throw new Error("Planos pagos por PIX nao possuem cobranca recorrente. A troca pode ser feita na proxima renovacao.");
  }
  if (!subscription.provider_subscription_id) {
    throw new Error("ID remoto da assinatura ausente. Sincronize o webhook antes de alterar o plano");
  }

  const target = getPlanByKey(planKey);
  if (!target) throw new Error("Plano de destino invalido");
  if (target.plan === subscription.plan) throw new Error("A assinatura ja esta neste plano");

  const product = await findOrCreateProduct(target);
  const pendingChange = await changeAbacateSubscriptionPlan({
    id: subscription.provider_subscription_id,
    productId: product.id,
  });

  return updateSubscription(subscription.id, {
    metadata: {
      ...(subscription.metadata || {}),
      pending_plan: target.plan,
      pending_plan_key: target.key,
      pending_product_id: product.id,
      plan_change_id: pendingChange.id,
      plan_change_status: pendingChange.status,
      plan_change_requested_at: pendingChange.requestedAt || new Date().toISOString(),
      plan_change_new_amount: pendingChange.newAmount,
    },
  });
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { action, subscriptionId, plan } = req.body || {};
    requireUuid(subscriptionId, "subscriptionId");
    if (!await enforceRateLimit(req, res, {
      scope: "subscription_action",
      limit: 20,
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
    if (!isAdmin(profile) && subscription.user_id !== user.id) {
      return res.status(403).json({ success: false, error: "Operacao nao permitida" });
    }

    let updated;
    if (action === "sync") updated = await synchronize(subscription);
    else if (action === "change_plan") updated = await changePlan(subscription, plan);
    else return res.status(400).json({ success: false, error: "Acao invalida" });

    logAuditEvent(`subscription.${action}`, req, {
      actorId: user.id,
      targetId: subscriptionId,
      outcome: "success",
      provider: subscription.provider,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logServerError("subscription_action", error, req);
    return sendError(req, res, error, "Erro interno na assinatura");
  }
}
