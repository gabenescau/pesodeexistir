import { supabase, isSupabaseReady } from "@/app/data/supabase";

export async function getCurrentSubscription(userId) {
  if (!isSupabaseReady() || !userId) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar assinatura:", error.message);
    return null;
  }

  return data;
}

export function isActiveSubscription(sub) {
  if (!sub) return false;
  const activeStatuses = ["active", "past_due"];
  return activeStatuses.includes(sub.status);
}
