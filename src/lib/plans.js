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
      { text: "Leitor digital nativo no app", feature: "library" },
      { text: "Biblioteca completa de filosofia e cl\u00e1ssicos", feature: "library" },
      { text: "Feed da comunidade, curtidas e coment\u00e1rios", feature: "community" },
      { text: "Cr\u00e9ditos OPE por leitura e participa\u00e7\u00e3o", feature: "reading_rewards" },
      { text: "Resgate de livros e roupas na Loja OPE", feature: "store" },
      { text: "Sincroniza\u00e7\u00e3o do progresso de leitura", feature: "reading_sync" },
      { text: "Lan\u00e7amentos semanais e cat\u00e1logo atualizado", feature: "weekly_releases" },
      { text: "Miss\u00f5es di\u00e1rias e semanais", feature: "missions" },
      { text: "Retrospectiva mensal e anual da sua jornada", feature: "retrospective" },
    ],
  },
  pensador: {
    id: "pensador",
    label: "Plano Pensador",
    description: "Experi\u00eancia completa e benef\u00edcios exclusivos",
    monthlyPrice: 2900,
    annualPrice: 22800,
    annualDiscountPercent: 34,
    planCodes: {
      monthly: "ope_club_pensador_monthly",
      annual: "ope_club_pensador_annual",
    },
    benefits: [
      { text: "Leitor digital nativo no app", feature: "library" },
      { text: "Biblioteca completa de filosofia e cl\u00e1ssicos", feature: "library" },
      { text: "Feed da comunidade, curtidas e coment\u00e1rios", feature: "community" },
      { text: "Cr\u00e9ditos OPE por leitura e participa\u00e7\u00e3o", feature: "reading_rewards" },
      { text: "Resgate de livros e roupas na Loja OPE", feature: "store" },
      { text: "Sincroniza\u00e7\u00e3o do progresso de leitura", feature: "reading_sync" },
      { text: "Lan\u00e7amentos semanais e cat\u00e1logo atualizado", feature: "weekly_releases" },
      { text: "Selo de Pensador verificado", feature: "verified_badge", icon: "verified", exclusive: true },
      { text: "Ranking mensal de cr\u00e9ditos", feature: "ranking", exclusive: true },
      { text: "Acesso a cole\u00e7\u00f5es exclusivas das Seasons", feature: "seasons", exclusive: true },
      { text: "Multiplicador 2x nas recompensas de atividade", feature: "credit_multiplier", exclusive: true },
      { text: "Atendimento priorit\u00e1rio pelo WhatsApp", feature: "vip_support", exclusive: true },
      { text: "Acesso antecipado aos drops", feature: "early_drops", exclusive: true },
      { text: "Retrospectiva mensal e anual da sua jornada", feature: "retrospective" },
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
