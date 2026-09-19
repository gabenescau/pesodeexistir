import { getRequiredCookieSession } from "./auth.js";
import { supabaseRequest } from "./supabase.js";

const SUBSCRIPTION_SELECT = [
  "id",
  "user_id",
  "plan",
  "status",
  "provider",
  "provider_product_id",
  "provider_subscription_id",
  "provider_customer_id",
  "provider_order_id",
  "current_period_start",
  "current_period_end",
  "cancel_at_period_end",
  "canceled_at",
  "last_payment_at",
  "created_at",
  "updated_at",
].join(",");

// The browser receives only the caller's subscriptions. The user id is always
// taken from the HttpOnly session, never from query parameters or request JSON.
export async function getMySubscriptions(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const userId = encodeURIComponent(session.user.id);
  const rows = await supabaseRequest(
    `subscriptions?select=${SUBSCRIPTION_SELECT}&user_id=eq.${userId}&order=current_period_end.desc.nullslast,updated_at.desc&limit=20`,
  );

  return {
    subscriptions: Array.isArray(rows) ? rows : [],
  };
}
