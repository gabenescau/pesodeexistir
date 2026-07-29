const API_BASE = "https://api.abacatepay.com/v2";

function getApiKey() {
  const key = process.env.ABACATEPAY_API_KEY;
  if (!key) throw new Error("ABACATEPAY_API_KEY não configurada");
  return key;
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

  if (!res.ok) {
    const msg = body?.error || `AbacatePay erro ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

export async function findOrCreateCustomer({ email, name, taxId }) {
  const customers = await abacateFetch("/customers/list?limit=100");

  const existing = (customers || []).find(
    (c) => c.email?.toLowerCase() === email?.toLowerCase()
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
  const products = await abacateFetch(
    `/products/list?limit=100&externalId=${encodeURIComponent(externalId)}`
  );

  const existing = (products || []).find((p) => p.externalId === externalId);
  if (existing) return existing;

  return abacateFetch("/products/create", {
    method: "POST",
    body: JSON.stringify({
      externalId,
      name,
      price,
      description: description || "",
      currency: "BRL",
    }),
  });
}

export async function createCheckout({ customerId, items, returnUrl, completionUrl, methods, externalId, metadata }) {
  return abacateFetch("/checkouts/create", {
    method: "POST",
    body: JSON.stringify({
      items,
      customerId,
      methods: methods || ["PIX", "CARD"],
      returnUrl: returnUrl || "",
      completionUrl: completionUrl || "",
      externalId: externalId || "",
      metadata: metadata || {},
    }),
  });
}
