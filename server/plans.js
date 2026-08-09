// Fonte unica de preco: o catalogo do servidor e a verdade da cobranca.
// Valores alinhados a landing page — Plano Leitor R$ 19/mes e Plano Pensador
// R$ 29/mes. O anual e cobrado uma vez por ano (R$ 29 x 12 = R$ 348 = 34800).
export const PLAN_CATALOG = {
  monthly: {
    key: "monthly",
    plan: "ope_club_monthly",
    externalId: "ope_club_monthly_subscription_v1",
    name: "OPE Club Mensal",
    price: 1900,
    durationDays: 30,
    description: "Assinatura mensal OPE Club",
    cycle: "MONTHLY",
  },
  annual: {
    key: "annual",
    plan: "ope_club_annual",
    externalId: "ope_club_annual_subscription_v1",
    name: "OPE Club Anual",
    price: 34800,
    durationDays: 365,
    description: "Assinatura anual OPE Club",
    cycle: "ANNUALLY",
  },
};

export function getPlanByKey(key) {
  if (!key) return null;
  if (PLAN_CATALOG[key]) return PLAN_CATALOG[key];
  return getPlanByCode(key);
}

export function getPlanByCode(code) {
  return Object.values(PLAN_CATALOG).find((plan) => plan.plan === code) || null;
}
