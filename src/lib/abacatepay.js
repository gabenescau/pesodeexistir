const API_BASE = "/api";

export async function createCheckout({ plan, userId, email, name }) {
  const res = await fetch(`${API_BASE}/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, userId, email, name }),
  });

  const body = await res.json();

  if (!body.success) {
    throw new Error(body.error || "Erro ao criar checkout");
  }

  return body.data;
}

export const PLANS = {
  monthly: {
    id: "monthly",
    label: "Mensal",
    price: 2400,
    priceFormatted: "R$ 24",
    period: "/mês",
    description: "Acesso completo à biblioteca e comunidade",
    externalId: "ope_club_monthly",
  },
  annual: {
    id: "annual",
    label: "Anual",
    price: 14400,
    priceFormatted: "R$ 144",
    period: "/ano",
    description: "O melhor custo-benefício",
    externalId: "ope_club_annual",
    monthlyEquivalent: 12,
    discountText: "Mais de 50% de desconto",
  },
};