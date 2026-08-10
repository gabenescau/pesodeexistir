// Fonte unica de verdade da cobranca: dois planos (Leitor / Pensador) em
// dois ciclos (Mensal / Anual). Cada combinacao (plano x ciclo) tem o proprio
// Price no Stripe e o proprio codigo salvo em subscriptions.plan.
//
//   Leitor:   R$ 19/mes  ou R$ 190/ano (~17% de desconto)
//   Pensador: R$ 29/mes  ou R$ 228/ano (~34% de desconto)
//
// A chave publica de uma combinacao e "${tier}-${cycle}" (ex.: "pensador-annual").
//
// Compatibilidade com o catalogo legado (pre-Stripe): os registros antigos de
// subscriptions.plan usavam "ope_club_monthly" / "ope_club_annual" (e as chamadas
// internas, as chaves "monthly" / "annual"). Tudo isso mapeia para o Plano Leitor.
export const PLAN_CATALOG = {
  "leitor-monthly": {
    key: "leitor-monthly",
    plan: "ope_club_leitor_monthly",
    tier: "leitor",
    tierLabel: "Plano Leitor",
    externalId: "ope_club_leitor_monthly_subscription_v1",
    name: "Plano Leitor Mensal",
    price: 1900,
    durationDays: 30,
    description: "Assinatura mensal do Plano Leitor do OPE Club",
    cycle: "MONTHLY",
    priceEnv: "STRIPE_PRICE_LEITOR_MONTHLY",
  },
  "leitor-annual": {
    key: "leitor-annual",
    plan: "ope_club_leitor_annual",
    tier: "leitor",
    tierLabel: "Plano Leitor",
    externalId: "ope_club_leitor_annual_subscription_v1",
    name: "Plano Leitor Anual",
    price: 19000,
    durationDays: 365,
    description: "Assinatura anual do Plano Leitor do OPE Club",
    cycle: "ANNUALLY",
    priceEnv: "STRIPE_PRICE_LEITOR_ANNUAL",
  },
  "pensador-monthly": {
    key: "pensador-monthly",
    plan: "ope_club_pensador_monthly",
    tier: "pensador",
    tierLabel: "Plano Pensador",
    externalId: "ope_club_pensador_monthly_subscription_v1",
    name: "Plano Pensador Mensal",
    price: 2900,
    durationDays: 30,
    description: "Assinatura mensal do Plano Pensador do OPE Club",
    cycle: "MONTHLY",
    priceEnv: "STRIPE_PRICE_PENSADOR_MONTHLY",
  },
  "pensador-annual": {
    key: "pensador-annual",
    plan: "ope_club_pensador_annual",
    tier: "pensador",
    tierLabel: "Plano Pensador",
    externalId: "ope_club_pensador_annual_subscription_v1",
    name: "Plano Pensador Anual",
    price: 22800,
    durationDays: 365,
    description: "Assinatura anual do Plano Pensador do OPE Club",
    cycle: "ANNUALLY",
    priceEnv: "STRIPE_PRICE_PENSADOR_ANNUAL",
  },
};

const CATALOG_LIST = Object.values(PLAN_CATALOG);

// Chaves legadas (modelo antigo de 2 planos) apontando para o plano equivalente.
const LEGACY_KEY_ALIASES = {
  monthly: "leitor-monthly",
  annual: "leitor-annual",
};

// Codigos legados gravados em subscriptions.plan pelo modelo antigo.
const LEGACY_CODE_ALIASES = {
  ope_club_monthly: "ope_club_leitor_monthly",
  ope_club_annual: "ope_club_leitor_annual",
};

export function getPlanByKey(key) {
  if (!key) return null;
  if (PLAN_CATALOG[key]) return PLAN_CATALOG[key];
  if (LEGACY_KEY_ALIASES[key]) return PLAN_CATALOG[LEGACY_KEY_ALIASES[key]] || null;
  return getPlanByCode(key);
}

export function getPlanByCode(code) {
  if (!code) return null;
  if (LEGACY_CODE_ALIASES[code]) code = LEGACY_CODE_ALIASES[code];
  return CATALOG_LIST.find((plan) => plan.plan === code) || null;
}

// Concessao manual (admin): a duracao de 365 dias identifica o ciclo anual;
// qualquer outra duracao e tratada como mensal. Aceita o tier por nome
// ("leitor" / "pensador") ou a chave completa ("leitor-monthly").
export function getGrantPlan(tier, durationDays) {
  const key = String(tier || "").toLowerCase();
  const cycle = Number(durationDays) === 365 ? "annual" : "monthly";
  if (PLAN_CATALOG[key]) return PLAN_CATALOG[key];
  const tierName = key.split("-")[0] === "pensador" ? "pensador" : "leitor";
  return getPlanByKey(`${tierName}-${cycle}`);
}

export function getCheckoutProduct(plan, paymentMethod) {
  if (paymentMethod !== "CARD") throw new Error("Metodo de pagamento invalido");
  return plan;
}

export function getPlanByProductId(productId, products = []) {
  const product = products.find((item) => item.id === productId);
  return product ? getPlanByExternalId(product.externalId) : null;
}

export function getPlanByExternalId(externalId) {
  return (
    CATALOG_LIST.find((plan) => plan.externalId === externalId) ||
    null
  );
}
