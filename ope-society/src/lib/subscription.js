import { supabase, isSupabaseReady } from "@/app/data/supabase";

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
  const userSubscriptions = (list || []).filter((sub) => !userId || sub.user_id === userId);

  const activeSubscription = userSubscriptions
    .filter(isActiveSubscription)
    .sort((a, b) => getSubscriptionSortDate(b) - getSubscriptionSortDate(a))[0];

  if (activeSubscription) return activeSubscription;

  return userSubscriptions
    .sort((a, b) => getSubscriptionSortDate(b) - getSubscriptionSortDate(a))[0] || null;
}

export async function getCurrentSubscription(userId) {
  if (!isSupabaseReady() || !userId) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Erro ao buscar assinatura:", error.message);
    return null;
  }

  return pickCurrentSubscription(data || [], userId);
}
