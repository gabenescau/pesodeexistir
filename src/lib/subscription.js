import { isSupabaseReady } from "@/app/data/supabase";
import { loadMySubscriptions } from "./subscription-api";

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "trialing",
  "paid",
  "approved",
  "authorized",
  "complete",
  "completed",
  "succeeded",
];

// Codigos legados (modelo antigo de 2 planos) apontando para o equivalente atual.
const LEGACY_PLAN_CODE_ALIASES = {
  ope_club_monthly: "ope_club_leitor_monthly",
  ope_club_annual: "ope_club_leitor_annual",
};

export function normalizePlanCode(planCode) {
  if (!planCode) return planCode;
  return LEGACY_PLAN_CODE_ALIASES[planCode] || planCode;
}

function getSubscriptionEndDate(sub) {
  return sub?.current_period_end || sub?.ends_at || sub?.expires_at || sub?.expiration_date || null;
}

function getSubscriptionSortDate(sub) {
  return new Date(
    getSubscriptionEndDate(sub) ||
      sub?.updated_at ||
      sub?.created_at ||
      0
  ).getTime();
}

export function isActiveSubscription(sub) {
  if (!sub) return false;

  const status = String(sub.status || "").toLowerCase();
  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(status)) return false;

  const endDateValue = getSubscriptionEndDate(sub);
  if (!endDateValue) return true;

  const endDate = new Date(endDateValue);
  if (Number.isNaN(endDate.getTime())) return true;

  return endDate.getTime() >= Date.now();
}

export function pickCurrentSubscription(list = [], userId) {
  const userSubscriptions = (list || [])
    .map((sub) => ({ ...sub, plan: normalizePlanCode(sub.plan) }))
    .filter((sub) => !userId || sub.user_id === userId);

  const activeSubscription = userSubscriptions
    .filter(isActiveSubscription)
    .sort((a, b) => getSubscriptionSortDate(b) - getSubscriptionSortDate(a))[0];

  if (activeSubscription) return activeSubscription;

  const pendingSubscription = userSubscriptions
    .filter((sub) => String(sub.status || "").toLowerCase() === "pending")
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];

  if (pendingSubscription) return pendingSubscription;

  return userSubscriptions
    .sort((a, b) => getSubscriptionSortDate(b) - getSubscriptionSortDate(a))[0] || null;
}

export async function getCurrentSubscription(userId) {
  if (!isSupabaseReady() || !userId) return null;

  try {
    const data = await loadMySubscriptions();
    return pickCurrentSubscription(data, userId);
  } catch (error) {
    console.error("Erro ao buscar assinatura:", error?.message || error);
    return null;
  }
}
