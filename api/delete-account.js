import {
  allowPost,
  deleteAuthUser,
  enforceRateLimit,
  getAuthenticatedUser,
  getOpenCheckoutAttempts,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  sendError,
  sendSuccess,
  updateCheckoutAttempt,
} from "../server/supabase.js";
import { expireCheckoutSession, getStripe } from "../server/stripe.js";
import { cancelAsaasCheckout, deleteAsaasPayment } from "../server/asaas.js";
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

async function cancelOpenBillingAttempts(userId) {
  const attempts = await getOpenCheckoutAttempts(userId);
  for (const attempt of attempts || []) {
    if (attempt.provider === "stripe" && attempt.stripe_session_id) {
      const result = await expireCheckoutSession(attempt.stripe_session_id);
      if (result.paid) {
        await updateCheckoutAttempt(attempt.attempt_id, { status: "completed" });
        continue;
      }
    }
    if (attempt.provider === "asaas" && attempt.provider_checkout_id) {
      try {
        if (attempt.payment_method === "PIX") {
          await deleteAsaasPayment(attempt.provider_checkout_id);
        } else {
          await cancelAsaasCheckout(attempt.provider_checkout_id);
        }
      } catch (error) {
        // A provider may already have expired or removed the resource. Other
        // failures must stop deletion so no active checkout is orphaned.
        if (![404, 409].includes(Number(error?.status))) throw error;
      }
    }
    await updateCheckoutAttempt(attempt.attempt_id, {
      status: attempt.provider === "asaas" ? "canceled" : "expired",
    });
  }
  return attempts || [];
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
    const openAttempts = await cancelOpenBillingAttempts(user.id);
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
      outcome: "billing_resources_canceled",
      provider: [
        recurring.length > 0 ? "stripe" : null,
        openAttempts.some((attempt) => attempt.provider === "asaas") ? "asaas" : null,
      ].filter(Boolean).join(",") || "supabase",
    });
    await deleteAuthUser(user.id);
    return sendSuccess(req, res, null);
  } catch (error) {
    logServerError("delete_account", error, req);
    return sendError(req, res, error, "Nao foi possivel excluir a conta agora");
  }
}
