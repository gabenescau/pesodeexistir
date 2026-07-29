export const PLAN_CATALOG = {
  monthly: {
    key: "monthly",
    plan: "ope_club_monthly",
    externalId: "ope_club_monthly_subscription_v1",
    name: "OPE Club Mensal",
    price: 2400,
    durationDays: 30,
    description: "Assinatura mensal OPE Club",
    cycle: "MONTHLY",
  },
  annual: {
    key: "annual",
    plan: "ope_club_annual",
    externalId: "ope_club_annual_subscription_v1",
    name: "OPE Club Anual",
    price: 14400,
    durationDays: 365,
    description: "Assinatura anual OPE Club",
    cycle: "ANNUALLY",
  },
};

export function getPlanByKey(key) {
  return PLAN_CATALOG[key] || null;
}

export function getPlanByCode(code) {
  return Object.values(PLAN_CATALOG).find((plan) => plan.plan === code) || null;
}

export function getPlanByProductId(productId, products = []) {
  const product = products.find((item) => item.id === productId);
  return product ? getPlanByExternalId(product.externalId) : null;
}

export function getPlanByExternalId(externalId) {
  return Object.values(PLAN_CATALOG).find((plan) => plan.externalId === externalId) || null;
}
