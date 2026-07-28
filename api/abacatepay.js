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

  const body = await res.json();

  if (!res.ok) {
    const msg = body?.error || `AbacatePay erro ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return body?.data ?? body;
}

export async function findOrCreateCustomer({ email, name, taxId }) {
  const customers = await abacateFetch("/customer/list");

  const existing = (customers || []).find(
    (c) => c.email?.toLowerCase() === email?.toLowerCase()
  );
  if (existing) return existing;

  return abacateFetch("/customer/create", {
    method: "POST",
    body: JSON.stringify({
      email,
      name: name || "",
      taxId: taxId || "",
    }),
  });
}

export async function findOrCreateProduct({ externalId, name, price, description }) {
  const products = await abacateFetch("/product/list");

  const existing = (products || []).find((p) => p.externalId === externalId);
  if (existing) return existing;

  return abacateFetch("/product/create", {
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

export async function createCheckout({ customerId, items, returnUrl, completionUrl, methods }) {
  return abacateFetch("/checkout/create", {
    method: "POST",
    body: JSON.stringify({
      customerId,
      items,
      returnUrl: returnUrl || "",
      completionUrl: completionUrl || "",
      methods: methods || ["PIX", "CARD"],
    }),
  });
}