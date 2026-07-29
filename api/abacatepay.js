const API_BASE = "https://api.abacatepay.com/v2";

export class AbacatePayError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "AbacatePayError";
    this.status = status;
    this.body = body;
  }
}

function getApiKey() {
  const key = process.env.ABACATEPAY_API_KEY;
  if (!key) throw new Error("ABACATEPAY_API_KEY nao configurada");
  return key;
}

function errorMessage(body, fallback) {
  const value = body?.error || body?.message || fallback;
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // The API contract is JSON. Keep a useful error if a proxy returns otherwise.
  }

  if (!response.ok || body?.success !== true) {
    throw new AbacatePayError(
      errorMessage(body, `AbacatePay respondeu HTTP ${response.status}`),
      { status: response.status, body }
    );
  }

  return body;
}

function queryString(values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

async function getData(path, options) {
  return (await request(path, options)).data;
}

export async function getStore() {
  return getData("/store/get");
}

export async function getProductByExternalId(externalId) {
  try {
    return await getData(`/products/get${queryString({ externalId })}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function validateCatalogProduct(product, expected) {
  if (!product?.id || !String(product.id).startsWith("prod_")) {
    throw new Error(`Produto ${expected.externalId} retornou sem um id valido`);
  }
  if (product.externalId !== expected.externalId) {
    throw new Error(`Produto encontrado nao corresponde a ${expected.externalId}`);
  }
  if (product.status !== "ACTIVE") {
    throw new Error(`Produto ${expected.externalId} nao esta ativo na AbacatePay`);
  }
  if (product.currency !== "BRL" || Number(product.price) !== expected.price) {
    throw new Error(`Produto ${expected.externalId} esta com preco ou moeda diferente do catalogo`);
  }
  if (product.cycle !== expected.cycle) {
    throw new Error(`Produto ${expected.externalId} esta com ciclo diferente de ${expected.cycle}`);
  }
  return product;
}

export async function findOrCreateProduct(plan) {
  const existing = await getProductByExternalId(plan.externalId);
  if (existing) return validateCatalogProduct(existing, plan);

  const created = await getData("/products/create", {
    method: "POST",
    body: JSON.stringify({
      externalId: plan.externalId,
      name: plan.name,
      price: plan.price,
      currency: "BRL",
      description: plan.description,
      cycle: plan.cycle,
    }),
  });
  return validateCatalogProduct(created, plan);
}

export async function findOrCreateCustomer({ email, name }) {
  const list = await request(`/customers/list${queryString({ email, limit: 100 })}`);
  const existing = Array.isArray(list.data)
    ? list.data.find((customer) => customer.email?.toLowerCase() === email.toLowerCase())
    : null;
  if (existing) return existing;

  return getData("/customers/create", {
    method: "POST",
    body: JSON.stringify({ email, ...(name ? { name } : {}) }),
  });
}

export async function createSubscriptionCheckout({
  customerId,
  productId,
  returnUrl,
  completionUrl,
  externalId,
  metadata,
}) {
  const checkout = await getData("/subscriptions/create", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: productId, quantity: 1 }],
      customerId,
      methods: ["PIX", "CARD"],
      returnUrl,
      completionUrl,
      externalId,
      metadata,
      retryPolicy: { maxRetry: 3, retryEvery: 2 },
    }),
  });

  if (!checkout?.id || !checkout?.url) {
    throw new Error("AbacatePay criou o checkout sem retornar id e url");
  }
  return checkout;
}

export async function listSubscriptionCheckouts(filters = {}) {
  const body = await request(`/subscriptions/list${queryString({ limit: 100, ...filters })}`);
  return Array.isArray(body.data) ? body.data : [];
}

export async function cancelAbacateSubscription(id) {
  if (!id?.startsWith("subs_")) {
    throw new Error("ID da assinatura AbacatePay invalido para cancelamento");
  }
  return getData("/subscriptions/cancel", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export async function changeAbacateSubscriptionPlan({ id, productId }) {
  if (!id?.startsWith("subs_")) {
    throw new Error("ID da assinatura AbacatePay invalido para alterar plano");
  }
  return getData("/subscriptions/change-plan", {
    method: "POST",
    body: JSON.stringify({ id, productId, quantity: 1 }),
  });
}
