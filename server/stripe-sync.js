import {
  insertSubscription,
  supabaseRequest,
  updateSubscription,
} from "./supabase.js";
import { getPlanByCode, getPlanByKey } from "./plans.js";
import { getPlanByPriceId, mapStripeStatus } from "./stripe.js";

function isoTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function stableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 255) : null;
}

async function findSubscriptionByProviderId(providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  const rows = await supabaseRequest(
    `subscriptions?provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&select=*`
  );
  return rows?.[0] || null;
}

async function findSubscriptionByCheckoutId(checkoutId) {
  if (!checkoutId) return null;
  const rows = await supabaseRequest(
    `subscriptions?provider_order_id=eq.${encodeURIComponent(checkoutId)}&select=*`
  );
  return rows?.[0] || null;
}

function resolveSubscriptionPlan(subscription) {
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  const byPrice = getPlanByPriceId(priceId);
  if (byPrice) return byPrice;

  const byKey = getPlanByKey(subscription?.metadata?.plan_key);
  if (byKey) return byKey;
  return getPlanByCode(subscription?.metadata?.plan);
}

export async function syncStripeSubscription(subscription, extra = {}) {
  const providerSubscriptionId = stableString(subscription?.id);
  const plan = resolveSubscriptionPlan(subscription);
  if (!providerSubscriptionId || !plan) return null;

  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  const existing = await findSubscriptionByProviderId(providerSubscriptionId);
  const metadata = {
    ...existing?.metadata,
    ...(extra.checkoutId ? { checkout_id: extra.checkoutId } : {}),
    ...(priceId ? { price_id: priceId } : {}),
    payment_method: "CARD",
  };
  const payload = {
    plan: plan.plan,
    status: mapStripeStatus(subscription.status),
    provider: "stripe",
    provider_product_id: stableString(subscription?.items?.data?.[0]?.price?.product),
    provider_subscription_id: providerSubscriptionId,
    provider_customer_id: stableString(subscription.customer),
    customer_email: extra.email || existing?.customer_email || "",
    current_period_start: isoTime(subscription.current_period_start),
    current_period_end: isoTime(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: isoTime(subscription.canceled_at),
    metadata,
  };

  if (existing) return updateSubscription(existing.id, payload);
  const userId = extra.userId || subscription?.metadata?.user_id;
  if (!userId) return null;

  return insertSubscription({
    ...payload,
    user_id: userId,
    created_at: new Date().toISOString(),
  });
}

export async function fulfillPaidCheckoutSession(stripe, session) {
  if (!session?.id) return null;

  if (session.mode === "subscription") {
    if (!session.subscription) return null;
    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ["items.data.price"],
    });
    return syncStripeSubscription(subscription, {
      userId: session.metadata?.user_id,
      checkoutId: session.id,
      email: session.customer_details?.email || "",
    });
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") return null;
  const plan = getPlanByKey(session.metadata?.plan_key);
  if (!plan || session.metadata?.payment_method !== "PIX") return null;
  if (session.currency !== "brl" || Number(session.amount_total) !== plan.price) {
    throw new Error("Checkout PIX pago nao corresponde ao catalogo do servidor");
  }

  const existing = await findSubscriptionByCheckoutId(session.id);
  const paidAt = new Date();
  const periodEnd = new Date(paidAt);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + plan.durationDays);
  const payload = {
    plan: plan.plan,
    status: "active",
    provider: "stripe",
    provider_order_id: session.id,
    provider_customer_id: stableString(session.customer),
    customer_email: session.customer_details?.email || existing?.customer_email || "",
    current_period_start: paidAt.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    canceled_at: null,
    last_payment_at: paidAt.toISOString(),
    metadata: {
      ...existing?.metadata,
      checkout_id: session.id,
      payment_intent_id: stableString(session.payment_intent),
      payment_method: "PIX",
      access_duration_days: plan.durationDays,
    },
  };

  if (existing) return updateSubscription(existing.id, payload);
  const userId = session.metadata?.user_id;
  if (!userId) return null;

  try {
    return await insertSubscription({
      ...payload,
      user_id: userId,
      created_at: paidAt.toISOString(),
    });
  } catch (error) {
    if (Number(error?.status) !== 409) throw error;
    const concurrent = await findSubscriptionByCheckoutId(session.id);
    return concurrent ? updateSubscription(concurrent.id, payload) : null;
  }
}

export async function markCheckoutFailed(session, status = "expired") {
  const existing = await findSubscriptionByCheckoutId(session?.id);
  if (!existing || existing.status !== "pending") return null;
  return updateSubscription(existing.id, { status });
}

export async function syncStripeInvoice(stripe, invoice, paid) {
  const providerSubscriptionId = stableString(invoice?.subscription);
  if (!providerSubscriptionId) return null;
  let existing = await findSubscriptionByProviderId(providerSubscriptionId);
  if (!existing) {
    const subscription = await stripe.subscriptions.retrieve(providerSubscriptionId, {
      expand: ["items.data.price"],
    });
    await syncStripeSubscription(subscription, {
      userId: subscription.metadata?.user_id,
    });
    existing = await findSubscriptionByProviderId(providerSubscriptionId);
  }
  if (!existing) return null;
  return updateSubscription(existing.id, paid
    ? { status: "active", last_payment_at: new Date().toISOString() }
    : { status: "past_due" });
}

export async function cancelDeletedStripeSubscription(subscription) {
  const existing = await findSubscriptionByProviderId(stableString(subscription?.id));
  if (!existing) return null;
  return updateSubscription(existing.id, {
    status: "canceled",
    cancel_at_period_end: false,
    canceled_at: isoTime(subscription.canceled_at) || new Date().toISOString(),
  });
}
