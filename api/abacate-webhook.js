import crypto from "crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const computed = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(typeof payload === "string" ? payload : JSON.stringify(payload))
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

async function findSubscriptionByCheckoutId(checkoutId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !checkoutId) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?metadata->>checkout_id=eq.${encodeURIComponent(checkoutId)}&order=created_at.desc&limit=1`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return (data || [])[0] || null;
}

async function updateSubscriptionStatus(subscriptionId, status) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !subscriptionId) return;

  const now = new Date().toISOString();
  const isCompleted = status === "completed" || status === "paid";
  const payload = {
    status: isCompleted ? "active" : status,
    updated_at: now,
  };

  if (isCompleted) {
    payload.current_period_start = now;
    const end = new Date();
    const plan = subscriptionId.plan;
    end.setDate(end.getDate() + (plan === "ope_club_annual" ? 365 : 30));
    payload.current_period_end = end.toISOString();
  }

  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscriptionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const signature = req.headers["x-signature"];
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
      console.warn("Assinatura do webhook inválida");
      return res.status(401).json({ success: false, error: "Assinatura inválida" });
    }

    const event = req.body;
    const eventType = event?.event || event?.type || "";

    console.log("Webhook recebido:", eventType);

    if (eventType === "checkout.completed" || eventType === "checkout.paid") {
      const checkout = event?.data || event?.checkout || {};
      const checkoutId = checkout.id || checkout.externalId;

      if (checkoutId) {
        const subscription = await findSubscriptionByCheckoutId(checkoutId);
        if (subscription) {
          await updateSubscriptionStatus(subscription.id, "completed");
          console.log(`Assinatura ${subscription.id} atualizada para active`);
        }
      }
    }

    if (eventType === "checkout.refunded" || eventType === "checkout.disputed" || eventType === "checkout.lost") {
      const checkout = event?.data || event?.checkout || {};
      const checkoutId = checkout.id || checkout.externalId;

      if (checkoutId) {
        const subscription = await findSubscriptionByCheckoutId(checkoutId);
        if (subscription) {
          await updateSubscriptionStatus(subscription.id, eventType === "checkout.refunded" ? "refunded" : "canceled");
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro no webhook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}