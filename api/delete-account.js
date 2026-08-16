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

const USER_STORAGE_BUCKETS = ["avatars", "post-media"];

function getStorageHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key };
  if (!key?.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function deleteUserStorageFiles(userId) {
  for (const bucket of USER_STORAGE_BUCKETS) {
    let offset = 0;
    while (true) {
      const listResponse = await fetch(
        `${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/${bucket}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getStorageHeaders(),
          },
          body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
        }
      );
      if (!listResponse.ok) throw new Error(`Supabase: storage list ${listResponse.status}`);
      const objects = await listResponse.json();
      const paths = (Array.isArray(objects) ? objects : [])
        .map((object) => object?.name)
        .filter(Boolean)
        .map((name) => name.startsWith(`${userId}/`) ? name : `${userId}/${name}`);
      if (!paths.length) break;

      const removeResponse = await fetch(
        `${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/remove`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getStorageHeaders(),
          },
          body: JSON.stringify({ prefixes: paths }),
        }
      );
      if (!removeResponse.ok) throw new Error(`Supabase: storage remove ${removeResponse.status}`);
      if (paths.length < 1000) break;
      offset += paths.length;
    }
  }
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req, res);
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

    await deleteUserStorageFiles(user.id);

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
