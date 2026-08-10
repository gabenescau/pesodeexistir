export const CYCLES = {
  monthly: { id: "monthly", label: "Mensal" },
  annual: { id: "annual", label: "Anual" },
};

export const TIERS = {
  leitor: {
    id: "leitor",
    label: "Plano Leitor",
    description: "Acesso completo ao aplicativo, comunidade e loja",
    monthlyPrice: 1900,
    annualPrice: 19000,
    annualDiscountPercent: 17,
    planCodes: {
      monthly: "ope_club_leitor_monthly",
      annual: "ope_club_leitor_annual",
    },
    benefits: [
      { text: "Leitor digital nativo no app" },
      { text: "Biblioteca completa de filosofia e classicos" },
      { text: "Rede social com feed e comentarios ilimitados" },
      { text: "XP e Creditos OPE por leitura" },
      { text: "Resgate de livros e roupas na Loja OPE" },
      { text: "Frete gratis nos resgates fisicos" },
      { text: "Missoes diarias, semanais e Seasons" },
      { text: "Leitura offline e sincronizacao" },
    ],
  },
  pensador: {
    id: "pensador",
    label: "Plano Pensador",
    description: "Ranking competitivo e beneficios exclusivos",
    monthlyPrice: 2900,
    annualPrice: 22800,
    annualDiscountPercent: 34,
    planCodes: {
      monthly: "ope_club_pensador_monthly",
      annual: "ope_club_pensador_annual",
    },
    benefits: [
      { text: "Todos os beneficios do Plano Leitor" },
      { text: "Acesso ao Ranking Mensal de XP", exclusive: true },
      { text: "Selo de Pensador verificado", icon: "verified", exclusive: true },
      { text: "Multiplicador de Creditos OPE", exclusive: true },
      { text: "Acesso antecipado aos drops", exclusive: true },
      { text: "Prioridade para novos autores e livros", exclusive: true },
      { text: "Suporte VIP direto no WhatsApp", exclusive: true },
    ],
  },
};

const LEGACY_CODE_ALIASES = {
  ope_club_monthly: "ope_club_leitor_monthly",
  ope_club_annual: "ope_club_leitor_annual",
  monthly: "ope_club_leitor_monthly",
  annual: "ope_club_leitor_annual",
  leitor: "ope_club_leitor_monthly",
  pensador: "ope_club_pensador_monthly",
};

export function getTierPlanKey(tierId, cycle) {
  return `${tierId}-${cycle}`;
}

export function formatBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planInfoFromCode(planCode) {
  if (!planCode) return null;
  const normalized = LEGACY_CODE_ALIASES[planCode] || planCode;
  for (const tier of Object.values(TIERS)) {
    for (const cycle of Object.keys(tier.planCodes)) {
      if (tier.planCodes[cycle] === normalized) {
        return { tier: tier.id, tierLabel: tier.label, cycle, tierConfig: tier };
      }
    }
  }
  return null;
}

export function planPriceLabel(planCode) {
  const info = planInfoFromCode(planCode);
  if (!info) return "-";
  return info.cycle === "annual"
    ? `${formatBRL(info.tierConfig.annualPrice)} / ano`
    : `${formatBRL(info.tierConfig.monthlyPrice)} / mes`;
}
