import {
  allowPost,
  deleteAuthUser,
  enforceRateLimit,
  getAuthenticatedUser,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import { getStripe } from "../server/stripe.js";
import { parseDeleteAccountInput } from "../src/lib/api-contracts.js";

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    if (!await enforceRateLimit(req, res, {
      scope: "delete_account",
      limit: 2,
      windowSeconds: 600,
      userId: user.id,
    })) return;

    parseDeleteAccountInput(req.body);

    const subscriptions = await listUserSubscriptions(user.id);
    const recurring = (subscriptions || []).filter((subscription) =>
      subscription.provider === "stripe" &&
      subscription.provider_subscription_id &&
      ["active", "trialing", "past_due", "pending"].includes(subscription.status)
    );

    if (recurring.length > 0) {
      const stripe = getStripe();
      for (const subscription of recurring) {
        await stripe.subscriptions.cancel(subscription.provider_subscription_id, {
          idempotencyKey: `ope-delete-account-${user.id}-${subscription.provider_subscription_id}`,
        });
      }
    }

    logAuditEvent("account.delete.requested", req, {
      actorId: user.id,
      outcome: "subscriptions_canceled",
      provider: recurring.length > 0 ? "stripe" : "supabase",
    });
    await deleteAuthUser(user.id);
    return sendSuccess(req, res, null);
  } catch (error) {
    logServerError("delete_account", error, req);
    return sendError(req, res, error, "Nao foi possivel excluir a conta agora");
  }
}
