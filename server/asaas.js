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
  if (!/^\/[a-zA-Z0-9_/?=&.%:+-]+$/.test(path)) {
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

export async function createAsaasCheckout({ plan, attemptId, siteUrl }) {
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
    // Do not send a partial customerData object. Asaas requires cpfCnpj when
    // customerData is present; omitting it lets the hosted checkout collect
    // and validate the payer's CPF/CNPJ without storing it in our database.
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

function assertProviderId(value, label, pattern = /^[A-Za-z0-9_-]{8,120}$/) {
  if (typeof value !== "string" || !pattern.test(value)) {
    const error = new Error(`${label} Asaas invalido`);
    error.status = 502;
    throw error;
  }
  return value;
}

function customerReference(userId) {
  return `ope-user:${assertProviderId(userId, "Usuario", /^[0-9a-f-]{36}$/i)}`;
}

function documentDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function createAsaasCustomer({ name, email, cpfCnpj, userId }) {
  const externalReference = customerReference(userId);
  const existing = await asaasRequest(
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`
  );
  const customer = Array.isArray(existing?.data) ? existing.data[0] : null;
  if (customer?.id) {
    const storedDocument = documentDigits(customer.cpfCnpj);
    if (storedDocument && storedDocument !== documentDigits(cpfCnpj)) {
      const error = new Error("O CPF/CNPJ informado nao corresponde ao cadastro de pagamento");
      error.status = 400;
      error.userSafe = true;
      throw error;
    }
    return { id: assertProviderId(customer.id, "Cliente"), externalReference };
  }

  const created = await asaasRequest("/customers", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      cpfCnpj,
      externalReference,
      notificationDisabled: false,
    }),
  });
  if (!created?.id) {
    const error = new Error("Asaas nao retornou o identificador do cliente");
    error.status = 502;
    throw error;
  }
  return { id: assertProviderId(created.id, "Cliente"), externalReference };
}

export async function getAsaasPayment(paymentId) {
  return asaasRequest(`/payments/${encodeURIComponent(assertProviderId(paymentId, "Pagamento"))}`);
}

export async function getAsaasPixQrCode(paymentId) {
  const id = assertProviderId(paymentId, "Pagamento");
  // The Asaas endpoint requires a genuinely empty GET body. Do not pass a
  // JSON body here or the provider can reject the request with HTTP 403.
  const qrCode = await asaasRequest(`/payments/${encodeURIComponent(id)}/pixQrCode`, {
    method: "GET",
  });
  if (!qrCode?.encodedImage || !qrCode?.payload) {
    const error = new Error("Asaas nao retornou um QR Code Pix valido");
    error.status = 502;
    throw error;
  }
  return {
    encodedImage: String(qrCode.encodedImage),
    payload: String(qrCode.payload),
    expirationDate: qrCode.expirationDate || null,
  };
}

export async function createAsaasPixPayment({ plan, email, name, cpfCnpj, userId, attemptId }) {
  const customer = await createAsaasCustomer({ name, email, cpfCnpj, userId });
  const externalReference = `ope-checkout:${assertProviderId(attemptId, "Tentativa", /^[A-Za-z0-9_-]{16,100}$/)}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payment = await asaasRequest("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "PIX",
      value: Number((plan.price / 100).toFixed(2)),
      dueDate,
      description: plan.name,
      externalReference,
    }),
  });
  const paymentId = assertProviderId(payment?.id, "Pagamento");
  const qrCode = await getAsaasPixQrCode(paymentId);
  return {
    id: paymentId,
    customerId: customer.id,
    externalReference,
    status: payment?.status || "PENDING",
    qrCode,
  };
}

export async function deleteAsaasPayment(paymentId) {
  const id = assertProviderId(paymentId, "Pagamento");
  return asaasRequest(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
}
