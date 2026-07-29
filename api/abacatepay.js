const API_BASE = "https://api.abacatepay.com/v2";

class AbacatePayError extends Error {
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

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.products)) return value.products;
  return [];
}

function getErrorMessage(body, fallback) {
  const value = body?.error || body?.message || fallback;
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function abacateFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || body?.success === false) {
    throw new AbacatePayError(getErrorMessage(body, `AbacatePay erro ${res.status}`), {
      status: res.status,
      body,
    });
  }

  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

async function findProductByExternalId(externalId) {
  const query = new URLSearchParams({ externalId });

  try {
    return await abacateFetch(`/products/get?${query.toString()}`);
  } catch (error) {
    if (error.status === 404 || String(error.message || "").toLowerCase().includes("produto nao encontrado")) {
      return null;
    }
    throw error;
  }
}

function isDuplicateExternalIdError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("externalid already exists") ||
    message.includes("externalid ja existe") ||
    message.includes("externalid já existe") ||
    message.includes("already exists")
  );
}

export async function findOrCreateCustomer({ email, name, taxId }) {
  const customers = await abacateFetch("/customers/list?limit=100");

  const existing = asArray(customers).find(
    (customer) => customer.email?.toLowerCase() === email?.toLowerCase()
  );
  if (existing) return existing;

  return abacateFetch("/customers/create", {
    method: "POST",
    body: JSON.stringify({
      email,
      name: name || "",
      taxId: taxId || "",
    }),
  });
}

export async function findOrCreateProduct({ externalId, name, price, description }) {
  const existing = await findProductByExternalId(externalId);
  if (existing) return existing;

  try {
    return await abacateFetch("/products/create", {
      method: "POST",
      body: JSON.stringify({
        externalId,
        name,
        price,
        description: description || "",
        currency: "BRL",
      }),
    });
  } catch (error) {
    if (!isDuplicateExternalIdError(error)) throw error;

    const product = await findProductByExternalId(externalId);
    if (product) return product;

    throw error;
  }
}

export async function createCheckout({ customerId, items, returnUrl, completionUrl, methods, externalId, metadata }) {
  return abacateFetch("/checkouts/create", {
    method: "POST",
    body: JSON.stringify({
      items,
      customerId,
      methods: methods || ["PIX", "CARD"],
      card: { maxInstallments: 12 },
      returnUrl: returnUrl || "",
      completionUrl: completionUrl || "",
      externalId: externalId || "",
      metadata: metadata || {},
    }),
  });
}
