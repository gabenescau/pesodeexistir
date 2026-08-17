import { asaasRequest, getAsaasPayment } from "./asaas.js";
import {
  insertSubscription,
  listUserSubscriptions,
  supabaseRequest,
  updateCheckoutAttempt,
  updateSubscription,
} from "./supabase.js";
import { getBillingPlan, hasActiveSubscription } from "./domains/billing.js";

function providerFailure(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  error.userSafe = true;
  return error;
}

function asaasStatus(checkout) {
  return String(checkout?.status || "").toUpperCase();
}

function checkoutReference(checkout) {
  return String(
    checkout?.externalReference ||
    checkout?.external_reference ||
    checkout?.metadata?.externalReference ||
    ""
  );
}

function amountInCents(checkout) {
  const items = Array.isArray(checkout?.items) ? checkout.items : [];
  if (items.length > 0) {
    const total = items.reduce((sum, item) => {
      const value = Number(item?.value);
      const quantity = Number(item?.quantity || 1);
      if (!Number.isFinite(value) || !Number.isFinite(quantity) || quantity <= 0) return NaN;
      return sum + Math.round(value * 100) * quantity;
    }, 0);
    return Number.isFinite(total) ? total : null;
  }

  const totalValue = Number(checkout?.totalValue ?? checkout?.value);
  return Number.isFinite(totalValue) ? Math.round(totalValue * 100) : null;
}

async function findAttempt(checkoutId) {
  const rows = await supabaseRequest(
    `billing_checkout_attempts?provider=eq.asaas&provider_checkout_id=eq.${encodeURIComponent(checkoutId)}&limit=1&select=*`
  );
  return rows?.[0] || null;
}

function periodEnd(durationDays) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + Number(durationDays));
  return end.toISOString();
}

async function grantSubscription(attempt, checkout, plan, paymentMethod = "ASAAS_CHECKOUT") {
  const subscriptions = await listUserSubscriptions(attempt.user_id);
  const existing = subscriptions.find((subscription) =>
    subscription.provider === "asaas" && subscription.provider_order_id === checkout.id
  );
  const metadata = {
    ...existing?.metadata,
    provider: "asaas",
    checkout_id: checkout.id,
    external_reference: attempt.external_reference,
    payment_method: paymentMethod,
  };
  const payload = {
    user_id: attempt.user_id,
    provider: "asaas",
    provider_order_id: checkout.id,
    provider_customer_id: checkout.customer || checkout.customerId || null,
    customer_email: attempt.customer_email,
    plan: plan.plan,
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd(plan.durationDays),
    cancel_at_period_end: false,
    canceled_at: null,
    last_payment_at: new Date().toISOString(),
    metadata,
  };

  // The application allows one effective access at a time. If another
  // provider record is already active, update that entitlement instead of
  // creating two competing sources of truth for the same user.
  const active = subscriptions.find((subscription) => hasActiveSubscription([subscription]));
  if (active && active.id !== existing?.id) {
    return updateSubscription(active.id, payload);
  }
  if (existing) return updateSubscription(existing.id, payload);
  return insertSubscription(payload);
}

async function revokeSubscriptionForPayment(attempt, paymentId) {
  const subscriptions = await listUserSubscriptions(attempt.user_id);
  const subscription = subscriptions.find((item) =>
    item.provider === "asaas" && item.provider_order_id === paymentId
  );
  if (!subscription || subscription.status === "refunded") return subscription || null;
  return updateSubscription(subscription.id, {
    status: "refunded",
    cancel_at_period_end: false,
    canceled_at: new Date().toISOString(),
    metadata: {
      ...subscription.metadata,
      refund_confirmed_by: "asaas",
      refunded_at: new Date().toISOString(),
    },
  });
}

export async function syncAsaasCheckout(checkoutId) {
  if (typeof checkoutId !== "string" || !/^[A-Za-z0-9-]{8,160}$/.test(checkoutId)) {
    throw providerFailure("Checkout Asaas invalido", 400);
  }

  const attempt = await findAttempt(checkoutId);
  if (!attempt) throw providerFailure("Checkout Asaas nao encontrado", 404);

  const checkout = await asaasRequest(`/checkouts/${encodeURIComponent(checkoutId)}`);
  const status = asaasStatus(checkout);
  if (status === "CANCELED") {
    const updated = attempt.status === "completed"
      ? attempt
      : await updateCheckoutAttempt(attempt.attempt_id, { status: "canceled" });
    return { status: updated?.status || "canceled", attempt: updated || attempt, subscription: null };
  }
  if (status === "EXPIRED") {
    const updated = attempt.status === "completed"
      ? attempt
      : await updateCheckoutAttempt(attempt.attempt_id, { status: "expired" });
    return { status: updated?.status || "expired", attempt: updated || attempt, subscription: null };
  }
  if (status !== "PAID") {
    return { status: attempt.status, attempt, subscription: null };
  }

  const reference = checkoutReference(checkout);
  if (reference !== attempt.external_reference || reference !== `ope-checkout:${attempt.attempt_id}`) {
    throw providerFailure("Referencia do checkout Asaas nao confere", 409);
  }

  const plan = getBillingPlan(attempt.plan_key);
  const amount = amountInCents(checkout);
  if (amount !== plan.price) {
    throw providerFailure("Valor do checkout Asaas nao confere com o plano", 409);
  }

  const subscription = await grantSubscription(attempt, checkout, plan, "ASAAS_CHECKOUT");
  const updatedAttempt = attempt.status === "completed"
    ? attempt
    : await updateCheckoutAttempt(attempt.attempt_id, { status: "completed" });
  return { status: "completed", attempt: updatedAttempt || attempt, subscription };
}

export async function syncAsaasPayment(paymentId) {
  if (typeof paymentId !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(paymentId)) {
    throw providerFailure("Pagamento Asaas invalido", 400);
  }

  const attempt = await findAttempt(paymentId);
  if (!attempt) throw providerFailure("Pagamento Asaas nao encontrado", 404);
  const payment = await getAsaasPayment(paymentId);
  const status = asaasStatus(payment);

  if (["CANCELED", "DELETED", "OVERDUE", "REFUNDED", "PAYMENT_REFUNDED"].includes(status)) {
    const subscription = status === "REFUNDED" || status === "PAYMENT_REFUNDED"
      ? await revokeSubscriptionForPayment(attempt, paymentId)
      : null;
    const updated = attempt.status === "completed"
      ? attempt
      : await updateCheckoutAttempt(attempt.attempt_id, { status: status === "OVERDUE" ? "expired" : "canceled" });
    return { status: updated?.status || attempt.status, attempt: updated || attempt, subscription };
  }

  // Asaas documents CONFIRMED as paid but not yet available. Entitlements are
  // granted only after PAYMENT_RECEIVED, when the funds are available.
  if (!["RECEIVED", "RECEIVED_IN_CASH"].includes(status)) {
    return { status: attempt.status, attempt, subscription: null };
  }

  const reference = checkoutReference(payment);
  if (reference !== attempt.external_reference || reference !== `ope-checkout:${attempt.attempt_id}`) {
    throw providerFailure("Referencia do pagamento Asaas nao confere", 409);
  }

  const plan = getBillingPlan(attempt.plan_key);
  const amount = amountInCents(payment);
  if (amount !== plan.price) {
    throw providerFailure("Valor do pagamento Asaas nao confere com o plano", 409);
  }

  const subscription = await grantSubscription(attempt, payment, plan, "PIX");
  const updatedAttempt = attempt.status === "completed"
    ? attempt
    : await updateCheckoutAttempt(attempt.attempt_id, { status: "completed" });
  return { status: "completed", attempt: updatedAttempt || attempt, subscription };
}

export async function markAsaasCheckoutState(checkoutId, status) {
  const attempt = await findAttempt(checkoutId);
  if (!attempt || attempt.status === "completed") return attempt;
  if (!["canceled", "expired"].includes(status)) return attempt;
  return updateCheckoutAttempt(attempt.attempt_id, { status });
}
