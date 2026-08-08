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
    description: "Acesso completo ao aplicativo, comunidade e loja",
    externalId: "ope_club_monthly_subscription_v1",
    benefits: [
      { text: "Leitor digital nativo no app (sem baixar PDFs)" },
      { text: "Biblioteca completa de filosofia e clássicos" },
      { text: "Rede social com feed e comentários ilimitados" },
      { text: "Acúmulo diário de XP e Créditos OPE por leitura" },
      { text: "Resgate de livros, moletons e oversizeds na Loja OPE" },
      { text: "Frete grátis em todos os resgates físicos" },
      { text: "Missões diárias, semanais e Seasons temáticas" },
      { text: "Leitura offline e sincronização total" },
    ],
  },
  annual: {
    id: "annual",
    label: "Plano Pensador",
    price: 2900,
    priceFormatted: "R$ 29",
    period: "/mês",
    description: "Experiência completa com ranking competitivo e benefícios exclusivos",
    externalId: "ope_club_annual_subscription_v1",
    monthlyEquivalent: 29,
    discountText: "Mais Escolhido",
    benefits: [
      { text: "Todos os benefícios do Plano Leitor" },
      { text: "Acesso exclusivo ao Ranking Mensal de XP", annualOnly: true },
      { text: "Selo de Pensador verificado", icon: "verified", annualOnly: true },
      { text: "Multiplicador de Créditos OPE nas missões diárias", annualOnly: true },
      { text: "Acesso antecipado aos drops da Loja OPE", annualOnly: true },
      { text: "Prioridade na adição de novos autores e livros", annualOnly: true },
      { text: "Suporte VIP prioritário direto no WhatsApp", annualOnly: true },
    ],
  },
};
