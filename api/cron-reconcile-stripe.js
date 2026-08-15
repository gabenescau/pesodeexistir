import crypto from "node:crypto";
import { prepareResponse, sendClientError, sendError, sendSuccess, supabaseRequest } from "../server/supabase.js";
import { getStripe } from "../server/stripe.js";
import { syncStripeSubscription } from "../server/stripe-sync.js";

const REQUIRED_SERVER_ENV_GROUPS = [
  ["SUPABASE_URL"],
  ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  ["SUPABASE_PUBLISHABLE_KEY"],
  ["STRIPE_SECRET_KEY"],
  ["STRIPE_WEBHOOK_SECRET"],
  ["CRON_SECRET"],
];

function isAuthorized(req) {
  const expected = process.env.CRON_SECRET;
  const received = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isHealthRequest(req) {
  return req.query?.health === "1";
}

function handleHealth(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ status: "error", error: "Metodo nao permitido" });
  }

  const missingConfiguration = REQUIRED_SERVER_ENV_GROUPS.some(
    (alternatives) => !alternatives.some((name) => process.env[name])
  );
  const status = missingConfiguration ? "degraded" : "ok";

  if (req.method === "HEAD") {
    return res.status(missingConfiguration ? 503 : 200).end();
  }
  return res.status(missingConfiguration ? 503 : 200).json({
    status,
    timestamp: new Date().toISOString(),
  });
}

export default async function handler(req, res) {
  prepareResponse(req, res);
  if (isHealthRequest(req)) return handleHealth(req, res);
  if (req.method !== "GET") return sendClientError(req, res, 405, "Metodo nao permitido");
  if (!isAuthorized(req)) return sendClientError(req, res, 401, "Nao autorizado");
  try {
    const stripe = getStripe();
    const local = [];
    const pageSize = 100;
    for (let offset = 0; offset < 1000; offset += pageSize) {
      const page = await supabaseRequest(
        `subscriptions?provider=eq.stripe&provider_subscription_id=not.is.null&select=id,user_id,provider_subscription_id&order=id.asc&limit=${pageSize}&offset=${offset}`
      );
      local.push(...(page || []));
      if (!Array.isArray(page) || page.length < pageSize) break;
    }
    let synced = 0;
    let missing = 0;
    let failed = 0;
    for (const row of local || []) {
      try {
        const remote = await stripe.subscriptions.retrieve(row.provider_subscription_id, { expand: ["items.data.price"] });
        await syncStripeSubscription(remote, { userId: remote.metadata?.user_id || row.user_id });
        synced += 1;
      } catch (error) {
        const missingRemote = error?.code === "resource_missing" || Number(error?.statusCode) === 404;
        if (missingRemote) {
          await supabaseRequest(`subscriptions?id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              status: "canceled",
              canceled_at: new Date().toISOString(),
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            }),
          });
          missing += 1;
        } else {
          failed += 1;
          console.warn(JSON.stringify({
            level: "warn",
            context: "cron_reconcile_stripe_row",
            requestId: req.requestId,
            subscriptionId: row.id,
            message: String(error?.message || "falha").slice(0, 240),
          }));
        }
      }
    }
    const now = encodeURIComponent(new Date().toISOString());
    const expired = await supabaseRequest(
      `subscriptions?provider=eq.stripe&provider_subscription_id=is.null&status=in.(active,trialing,past_due)&current_period_end=lt.${now}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }) }
    );
    await supabaseRequest(
      `billing_checkout_attempts?status=eq.open&expires_at=lt.${now}`,
      { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }) }
    );
    return sendSuccess(req, res, {
      reconciled: synced,
      missing,
      failed,
      expired: Array.isArray(expired) ? expired.length : 0,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", context: "cron_reconcile_stripe", requestId: req.requestId, message: String(error?.message || "erro").slice(0, 300) }));
    return sendError(req, res, error, "Falha na reconciliacao");
  }
}
