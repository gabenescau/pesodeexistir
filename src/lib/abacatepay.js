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
    label: "Plano Leitor",
    price: 1900,
    priceFormatted: "R$ 19",
    period: "/mês",
    description: "Tudo para iniciar sua jornada de leitura",
    externalId: "ope_club_monthly_subscription_v1",
    benefits: [
      { text: "Biblioteca completa de filosofia" },
      { text: "Leitor digital nativo no aplicativo" },
      { text: "Feed ativo para discussões" },
      { text: "Adquira créditos diariamente" },
      { text: "Troque créditos por livros e itens na loja" },
    ],
  },
  annual: {
    id: "annual",
    label: "Plano Pensador",
    price: 2900,
    priceFormatted: "R$ 29",
    period: "/mês",
    description: "Experiência completa com vantagens exclusivas",
    externalId: "ope_club_annual_subscription_v1",
    monthlyEquivalent: 29,
    discountText: "Mais Popular",
    benefits: [
      { text: "Todos os benefícios do plano leitor" },
      { text: "Selo de verificado", icon: "verified", annualOnly: true },
      { text: "Acesso ao ranking mensal", annualOnly: true },
      { text: "Acesso às seasons", annualOnly: true },
      { text: "Suporte exclusivo WhatsApp", annualOnly: true },
      { text: "Acesso antecipado a novos livros", annualOnly: true },
    ],
  },
};
