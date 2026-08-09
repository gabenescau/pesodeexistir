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
      { text: "Biblioteca de filosofia e literatura" },
      { text: "Leitor digital nativo no aplicativo" },
      { text: "Comunidade ativa com feed e discussões" },
      { text: "Ganhe XP e Créditos lendo todos os dias" },
      { text: "Resgate livros e itens na Loja OPE" },
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
    discountText: "Recomendado",
    benefits: [
      { text: "Todos os benefícios do Plano Leitor" },
      { text: "Selo exclusivo de Pensador Verificado", icon: "verified", annualOnly: true },
      { text: "Ranking mensal e bônus de Créditos", annualOnly: true },
      { text: "Acesso antecipado aos lançamentos da loja", annualOnly: true },
      { text: "Suporte prioritário no WhatsApp", annualOnly: true },
    ],
  },
};
