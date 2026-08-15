const PRODUCTION_URL = "https://api.asaas.com/v3";
const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const ALLOWED_BASE_URLS = new Set([PRODUCTION_URL, SANDBOX_URL]);

function getBaseUrl() {
  const environment = String(process.env.ASAAS_ENVIRONMENT || "production").toLowerCase();
  if (environment !== "production" && environment !== "sandbox") {
    const error = new Error("ASAAS_ENVIRONMENT deve ser production ou sandbox");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  const configured = String(process.env.ASAAS_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const baseUrl = configured || (environment === "sandbox" ? SANDBOX_URL : PRODUCTION_URL);
  if (!ALLOWED_BASE_URLS.has(baseUrl)) {
    const error = new Error("ASAAS_API_BASE_URL nao permitida");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return baseUrl;
}

function getCheckoutHost() {
  return getBaseUrl() === SANDBOX_URL
    ? "https://sandbox.asaas.com"
    : "https://asaas.com";
}

function getApiKey() {
  const key = String(process.env.ASAAS_API_KEY || "").trim();
  if (key.length < 20 || key.length > 500) {
    const error = new Error("ASAAS_API_KEY nao configurada corretamente");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return key;
}

function providerError(status, body) {
  const error = new Error(`Asaas: ${String(body || "resposta invalida").slice(0, 500)}`);
  error.status = status;
  error.provider = true;
  return error;
}

export async function asaasRequest(path, options = {}) {
  if (!/^\/[a-zA-Z0-9_/?=&.-]+$/.test(path)) {
    const error = new Error("Caminho Asaas invalido");
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(12000),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: getApiKey(),
      "User-Agent": "OPE-Club/1.0",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw providerError(response.status, text);
  return text ? JSON.parse(text) : null;
}

export function buildCheckoutLink(checkoutId) {
  if (typeof checkoutId !== "string" || !/^[a-zA-Z0-9-]{16,120}$/.test(checkoutId)) {
    const error = new Error("Checkout Asaas invalido");
    error.status = 502;
    throw error;
  }
  return `${getCheckoutHost()}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
}

export async function createAsaasCheckout({ plan, email, name, attemptId, siteUrl }) {
  const externalReference = `ope-checkout:${attemptId}`;
  const payload = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: 60,
    externalReference,
    callback: {
      successUrl: `${siteUrl}/app/planos?checkout=success&attempt_id=${encodeURIComponent(attemptId)}`,
      cancelUrl: `${siteUrl}/app/planos?checkout=canceled&attempt_id=${encodeURIComponent(attemptId)}`,
      expiredUrl: `${siteUrl}/app/planos?checkout=expired&attempt_id=${encodeURIComponent(attemptId)}`,
    },
    items: [{
      name: plan.name,
      description: plan.description,
      quantity: 1,
      value: Number((plan.price / 100).toFixed(2)),
    }],
    customerData: {
      name: String(name || "").slice(0, 80) || undefined,
      email: String(email || "").slice(0, 254) || undefined,
    },
  };
  const checkout = await asaasRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!checkout?.id) {
    const error = new Error("Asaas nao retornou o identificador do checkout");
    error.status = 502;
    throw error;
  }
  return {
    id: checkout.id,
    url: checkout.link || buildCheckoutLink(checkout.id),
    externalReference,
    status: checkout.status || "ACTIVE",
  };
}

export async function cancelAsaasCheckout(checkoutId) {
  return asaasRequest(`/checkouts/${encodeURIComponent(checkoutId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
