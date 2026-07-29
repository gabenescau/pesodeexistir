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

function isProductNotFound(error) {
  const message = String(error?.message || "");
  return error?.status === 404 || /product not found|produto n[aã]o encontrado/i.test(message);
}

async function getProduct(filters) {
  try {
    return await getData(`/products/get${queryString(filters)}`);
  } catch (error) {
    if (isProductNotFound(error)) return null;
    throw error;
  }
}

async function listProducts(filters = {}) {
  const body = await request(`/products/list${queryString({ limit: 100, ...filters })}`);
  return Array.isArray(body.data) ? body.data : [];
}

export async function getProductByExternalId(externalId) {
  const direct = await getProduct({ externalId });
  if (direct) return direct;

  const products = await listProducts({ externalId });
  return products.find((product) => product.externalId === externalId) || null;
}

async function confirmProduct(product) {
  const direct = await getProduct({ id: product.id });
  if (direct) return direct;

  const products = await listProducts({ id: product.id });
  return products.find((candidate) => candidate.id === product.id) || null;
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
  if ((product.cycle || null) !== (expected.cycle || null)) {
    throw new Error(`Produto ${expected.externalId} esta com ciclo diferente de ${expected.cycle}`);
  }
  return product;
}

export async function findOrCreateProduct(plan) {
  const existing = await getProductByExternalId(plan.externalId);
  if (existing) {
    const confirmed = await confirmProduct(existing);
    if (!confirmed) {
      throw new Error(`Produto ${plan.externalId} existe, mas nao pode ser consultado pelo id ${existing.id}`);
    }
    return validateCatalogProduct(confirmed, plan);
  }

  const created = await getData("/products/create", {
    method: "POST",
    body: JSON.stringify({
      externalId: plan.externalId,
      name: plan.name,
      price: plan.price,
      currency: "BRL",
      description: plan.description,
      ...(plan.cycle ? { cycle: plan.cycle } : {}),
    }),
  });
  validateCatalogProduct(created, plan);

  const confirmed = await confirmProduct(created);
  if (!confirmed) {
    throw new Error(`Produto ${plan.externalId} foi criado, mas ainda nao esta disponivel para o checkout`);
  }
  return validateCatalogProduct(confirmed, plan);
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
      methods: ["CARD"],
      returnUrl,
      completionUrl,
      externalId,
      metadata,
    }),
  });

  if (!checkout?.id || !checkout?.url) {
    throw new Error("AbacatePay criou o checkout sem retornar id e url");
  }
  return checkout;
}

export async function createHostedCheckout({
  customerId,
  productId,
  returnUrl,
  completionUrl,
  externalId,
  metadata,
}) {
  const checkout = await getData("/checkouts/create", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: productId, quantity: 1 }],
      customerId,
      methods: ["PIX"],
      returnUrl,
      completionUrl,
      externalId,
      metadata,
    }),
  });

  if (!checkout?.id || !checkout?.url) {
    throw new Error("AbacatePay criou o checkout PIX sem retornar id e url");
  }
  return checkout;
}

export async function listHostedCheckouts(filters = {}) {
  const body = await request(`/checkouts/list${queryString({ limit: 100, ...filters })}`);
  return Array.isArray(body.data) ? body.data : [];
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
