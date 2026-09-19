import { getPlanByKey } from "../plans.js";

export const BILLING_ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function getBillingPlan(planKey) {
  const plan = getPlanByKey(planKey);
  if (!plan) {
    const error = new Error("Plano invalido");
    error.status = 400;
    error.code = "invalid_plan";
    throw error;
  }
  return plan;
}

export function hasActiveSubscription(subscriptions, now = Date.now()) {
  return (subscriptions || []).some((subscription) => {
    if (!BILLING_ACTIVE_STATUSES.has(subscription.status)) return false;
    const end = subscription.current_period_end
      ? Date.parse(subscription.current_period_end)
      : null;
    return !Number.isFinite(end) || end > now;
  });
}

export function getSubscriptionEntitlement(subscription, now = Date.now()) {
  if (!subscription || !BILLING_ACTIVE_STATUSES.has(subscription.status)) {
    return { active: false, plan: null };
  }
  const end = subscription.current_period_end
    ? Date.parse(subscription.current_period_end)
    : null;
  if (Number.isFinite(end) && end <= now) return { active: false, plan: null };
  return { active: true, plan: getPlanByKey(subscription.plan) };
}
