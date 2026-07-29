import { supabase } from "@/app/data/supabase";

const API_BASE = "/api";

export async function createCheckout({ plan, paymentMethod }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error("Sua sessao expirou. Entre novamente para assinar.");
  }

  const res = await fetch(`${API_BASE}/create-checkout`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, paymentMethod }),
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
    period: "/mes",
    description: "Acesso completo a biblioteca e comunidade",
    externalId: "ope_club_monthly_subscription_v1",
  },
  annual: {
    id: "annual",
    label: "Anual",
    price: 14400,
    priceFormatted: "R$ 144",
    period: "/ano",
    description: "O melhor custo-beneficio",
    externalId: "ope_club_annual_subscription_v1",
    monthlyEquivalent: 12,
    discountText: "Mais de 50% de desconto",
  },
};
