import {
  findOrCreateCustomer,
  findOrCreateProduct,
  createHostedCheckout,
  createSubscriptionCheckout,
  listHostedCheckouts,
  listSubscriptionCheckouts,
} from "../server/abacatepay.js";
import { getCheckoutProduct, getPlanByKey } from "../server/plans.js";
import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logServerError,
  sendError,
} from "../server/supabase.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SERVICE_HEADERS = {
  "apikey": SUPABASE_SERVICE_KEY,
  ...(!SUPABASE_SERVICE_KEY?.startsWith("sb_secret_")
    ? { "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` }
    : {}),
};
const CHECKOUT_RESERVATION_MS = 2 * 60 * 1000;

async function fetchProfileName(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=name`, {
    headers: {
      ...SUPABASE_SERVICE_HEADERS,
    },
  });

  if (!res.ok) return "";
  const rows = await res.json();
  return rows?.[0]?.name || "";
}

async function listUserSubscriptions(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
    {
      headers: {
        ...SUPABASE_SERVICE_HEADERS,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao consultar assinatura atual: ${await res.text()}`);
  }
  return res.json();
}

function isCurrentlyActive(subscription) {
  if (!["active", "past_due", "trialing"].includes(subscription?.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export function isFreshCheckoutReservation(subscription, now = Date.now()) {
  if (subscription?.status !== "pending") return false;
  if (subscription?.metadata?.checkout_creation_status !== "creating") return false;
  const updatedAt = new Date(subscription.updated_at || subscription.created_at || 0).getTime();
  return Number.isFinite(updatedAt) && now - updatedAt < CHECKOUT_RESERVATION_MS;
}

async function reservePendingSubscription({ user, planKey, planConfig, paymentMethod }) {
  const now = new Date().toISOString();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...SUPABASE_SERVICE_HEADERS,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      user_id: user.id,
      customer_email: user.email || "",
      plan: planConfig.plan,
      status: "pending",
      provider: "abacatepay",
      metadata: {
        checkout_creation_status: "creating",
        plan_key: planKey,
        payment_method: paymentMethod,
        amount_cents: planConfig.price,
      },
      created_at: now,
      updated_at: now,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (response.ok) {
    const rows = await response.json();
    return { subscription: rows?.[0] || null, created: true };
  }

  if (response.status === 409) {
    const current = await listUserSubscriptions(user.id);
    const pending = current.find((subscription) => subscription.status === "pending");
    if (pending) return { subscription: pending, created: false };
    if (current.some(isCurrentlyActive)) {
      const error = new Error("Voce ja possui uma assinatura ativa.");
      error.status = 409;
      throw error;
    }
  }

  throw new Error(`Nao foi possivel reservar o checkout: ${await response.text()}`);
}

async function reusePendingCheckout(pending, planConfig, paymentMethod) {
  const checkoutId = pending?.metadata?.checkout_id;
  if (!checkoutId) return null;
  if (pending?.metadata?.payment_method !== paymentMethod) return null;
  if (pending.plan !== planConfig.plan) return null;

  const listCheckouts = paymentMethod === "PIX"
    ? listHostedCheckouts
    : listSubscriptionCheckouts;
  const checkout = (await listCheckouts({ id: checkoutId }))[0];
  if (!checkout || ["EXPIRED", "CANCELLED", "REFUNDED"].includes(checkout.status)) {
    return null;
  }
  if (checkout.status === "PAID") {
    return {
      checkout,
      checkoutId: checkout.id,
      subscriptionId: pending.id,
      confirmed: true,
    };
  }
  if (checkout.status !== "PENDING") {
    const error = new Error(`Checkout existente com status ${checkout.status}`);
    error.status = 409;
    throw error;
  }
  if (!checkout.url) throw new Error("Checkout pendente sem URL na AbacatePay");

  return {
    url: checkout.url,
    checkoutId: checkout.id,
    subscriptionId: pending.id,
    reused: true,
  };
}

async function activatePaidPending({ pending, planConfig, checkout, paymentMethod }) {
  const start = new Date();
  const end = new Date(start);
  if (paymentMethod === "PIX") end.setDate(end.getDate() + planConfig.durationDays);
  else if (planConfig.cycle === "ANNUALLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${encodeURIComponent(pending.id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...SUPABASE_SERVICE_HEADERS,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        plan: planConfig.plan,
        status: "active",
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        provider_customer_id: checkout.customerId || pending.provider_customer_id || null,
        metadata: {
          ...(pending.metadata || {}),
          paid_at: start.toISOString(),
          payment_method: paymentMethod,
          abacatepay_checkout_status: "PAID",
          last_event: "checkout.status_reconciled",
          last_synced_at: start.toISOString(),
        },
        updated_at: start.toISOString(),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Pagamento confirmado, mas o acesso nao foi atualizado: ${await response.text()}`);
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

async function expireStaleSubscriptions(subscriptions) {
  const stale = subscriptions.filter((subscription) =>
    ["active", "past_due", "trialing"].includes(subscription.status) &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  );

  const responses = await Promise.all(stale.map((subscription) =>
    fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...SUPABASE_SERVICE_HEADERS,
      },
      body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
    })
  ));

  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`Erro ao expirar assinatura antiga: ${await response.text()}`);
    }
  }
}

async function savePendingSubscription({
  user,
  planKey,
  planConfig,
  paymentMethod,
  checkout,
  product,
  customer,
  existingPending,
}) {
  const now = new Date();

  const payload = {
    user_id: user.id,
    customer_email: user.email || "",
    plan: planConfig.plan,
    status: "pending",
    current_period_start: null,
    current_period_end: null,
    provider: "abacatepay",
    provider_customer_id: customer.id || checkout.customerId || null,
    provider_subscription_id: null,
    metadata: {
      source: paymentMethod === "PIX"
        ? "abacatepay_hosted_pix_checkout"
        : "abacatepay_subscription_checkout",
      integration_version: "hybrid_checkout_v2",
      billing_mode: paymentMethod === "PIX" ? "one_time" : "subscription",
      plan_key: planKey,
      checkout_id: checkout.id,
      checkout_url: checkout.url,
      product_id: product.id,
      product_external_id: product.externalId,
      checkout_external_id: checkout.externalId || null,
      amount_cents: planConfig.price,
      cycle: paymentMethod === "PIX" ? null : planConfig.cycle,
      payment_method: paymentMethod,
      methods: [paymentMethod],
    },
    updated_at: now.toISOString(),
  };

  const persist = (pending) => fetch(
    pending
      ? `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${encodeURIComponent(pending.id)}`
      : `${SUPABASE_URL}/rest/v1/subscriptions`,
    {
    method: pending ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...SUPABASE_SERVICE_HEADERS,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });

  let res = await persist(existingPending);

  if (res.status === 409) {
    const current = await listUserSubscriptions(user.id);
    const pending = current.find((subscription) => subscription.status === "pending");
    if (pending) {
      res = await persist(pending);
    } else if (current.some(isCurrentlyActive)) {
      const error = new Error("Voce ja possui uma assinatura ativa.");
      error.status = 409;
      throw error;
    }
  }

  if (!res.ok) {
    throw new Error(`Erro ao salvar assinatura pendente: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
}

function getBaseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const configured = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    if (configured.protocol !== "https:" && configured.hostname !== "localhost") {
      throw new Error("NEXT_PUBLIC_SITE_URL precisa usar HTTPS");
    }
    return configured.origin;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const proto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) {
    throw new Error("Host invalido");
  }
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    if (!await enforceRateLimit(req, res, {
      scope: "create_checkout",
      limit: 8,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const { plan: planKey, paymentMethod: requestedMethod } = req.body || {};
    const planConfig = getPlanByKey(planKey);
    const paymentMethod = String(requestedMethod || "").toUpperCase();

    if (!planConfig) {
      return res.status(400).json({ success: false, error: "Plano invalido" });
    }
    if (!["PIX", "CARD"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: "Metodo de pagamento invalido" });
    }

    const baseUrl = getBaseUrl(req);
    const currentSubscriptions = await listUserSubscriptions(user.id);
    await expireStaleSubscriptions(currentSubscriptions);
    const activeSubscription = currentSubscriptions.find(isCurrentlyActive);
    if (activeSubscription) {
      return res.status(409).json({
        success: false,
        error: "Voce ja possui uma assinatura ativa. Cancele o plano atual antes de assinar outro.",
      });
    }
    let existingPending = currentSubscriptions.find((subscription) => subscription.status === "pending");
    if (existingPending) {
      const reused = await reusePendingCheckout(existingPending, planConfig, paymentMethod);
      if (reused?.confirmed) {
        const subscription = await activatePaidPending({
          pending: existingPending,
          planConfig,
          checkout: reused.checkout,
          paymentMethod,
        });
        return res.status(200).json({
          success: true,
          data: {
            url: `${baseUrl}/app/inicio`,
            checkoutId: reused.checkoutId,
            subscriptionId: subscription?.id || existingPending.id,
            confirmed: true,
          },
        });
      }
      if (reused) return res.status(200).json({ success: true, data: reused });
      if (isFreshCheckoutReservation(existingPending)) {
        return res.status(409).json({
          success: false,
          error: "Seu checkout ja esta sendo criado. Aguarde alguns segundos e tente novamente.",
          requestId: req.requestId,
        });
      }
    } else {
      const reservation = await reservePendingSubscription({
        user,
        planKey,
        planConfig,
        paymentMethod,
      });
      existingPending = reservation.subscription;
      if (!reservation.created) {
        const reused = await reusePendingCheckout(existingPending, planConfig, paymentMethod);
        if (reused) return res.status(200).json({ success: true, data: reused });
        return res.status(409).json({
          success: false,
          error: "Seu checkout ja esta sendo criado. Aguarde alguns segundos e tente novamente.",
          requestId: req.requestId,
        });
      }
    }

    const profileName = await fetchProfileName(user.id);
    const customer = await findOrCreateCustomer({
      email: user.email,
      name: profileName || user.email?.split("@")[0] || "",
    });

    const checkoutProduct = getCheckoutProduct(planConfig, paymentMethod);
    const product = await findOrCreateProduct(checkoutProduct);

    const checkoutParams = {
      customerId: customer.id,
      productId: product.id,
      returnUrl: `${baseUrl}/pagamento/processando`,
      completionUrl: `${baseUrl}/pagamento/processando`,
      externalId: `${user.id}:${checkoutProduct.externalId}:${Date.now()}`,
      metadata: {
        user_id: user.id,
        plan: planConfig.plan,
        plan_key: planKey,
        amount_cents: planConfig.price,
        payment_method: paymentMethod,
      },
    };
    const checkout = paymentMethod === "PIX"
      ? await createHostedCheckout(checkoutParams)
      : await createSubscriptionCheckout(checkoutParams);

    const subscription = await savePendingSubscription({
      user,
      planKey,
      planConfig,
      paymentMethod,
      checkout,
      product,
      customer,
      existingPending,
    });

    return res.status(200).json({
      success: true,
      data: {
        url: checkout.url,
        checkoutId: checkout.id,
        subscriptionId: subscription?.id || null,
      },
    });
  } catch (error) {
    logServerError("create_checkout", error, req);
    const unavailableCard = /card is not available for this store/i.test(error.message || "");
    if (unavailableCard) {
      return res.status(409).json({
        success: false,
        error: "Cartao ainda nao esta habilitado nesta loja AbacatePay. Solicite a liberacao do metodo CARD no painel/suporte da AbacatePay e tente novamente.",
        requestId: req.requestId,
      });
    }
    return sendError(req, res, error, "Erro interno ao criar checkout");
  }
}
