import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logServerError,
  requireAdmin,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import { getStripe } from "../server/stripe.js";
import { PLAN_CATALOG } from "../server/plans.js";

// Diagnostico administrado: valida a configuracao do Stripe sem expor chaves.
// Responde (para cada Price do catalogo) se a env esta definida, se o Price
// existe na conta, se e de recorrencia, moeda e valor esperados. Tambem
// informa o modo (test/live) da chave configurada.
export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    await requireAdmin(user);
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_diagnose",
      limit: 10,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    const mode = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_") ? "test"
      : secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live"
      : "indefinido";
    const keyPrefix = secretKey.slice(0, 8);
    const keyWarning =
      mode === "indefinido"
        ? `Prefixo invalido "${keyPrefix||"(vazio)"}". A API do Stripe so aceita chaves iniciadas em sk_test_, sk_live_, rk_test_ ou rk_live_. Chaves com prefixo diferente (ex.: mk_, pk_) sao rejeitadas com 401 "Invalid API Key provided".`
        : null;
    const webhookPrefix = webhookSecret.slice(0, 6);
    const webhookWarning =
      webhookSecret && webhookPrefix !== "whsec_"
        ? `STRIPE_WEBHOOK_SECRET com prefixo "${webhookPrefix||"(vazio)"}" - o esperado e "whsec_..." (pegue em Developers > Webhooks > endpoint > Reveal).`
        : null;

    const prices = [];
    for (const plan of Object.values(PLAN_CATALOG)) {
      const envKey = plan.priceEnv;
      const priceId = process.env[envKey] || "";
      const prefixError = priceId && !priceId.startsWith("price_")
        ? `Encontrado "${priceId.slice(0, 5)}..." (parece um prod_, nao um price_) - copie o ID do PRECO em Product catalog > produto > Pricing`
        : null;
      const entry = {
        key: plan.key,
        plan: plan.plan,
        env: envKey,
        priceId: priceId ? "definido" : "AUSENTE",
        expectedAmount: plan.price,
        expectedCurrency: "brl",
        expectedRecurring: plan.cycle === "ANNUALLY" ? "year" : "month",
        exists: false,
        active: null,
        currency: null,
        unitAmount: null,
        amountMatchesCatalog: null,
        recurring: null,
        error: prefixError,
      };
      if (!priceId || prefixError) {
        prices.push(entry);
        continue;
      }

      try {
        const stripe = getStripe();
        const price = await stripe.prices.retrieve(priceId);
        entry.exists = true;
        entry.active = price.active;
        entry.currency = price.currency;
        entry.unitAmount = price.unit_amount;
        entry.amountMatchesCatalog = price.unit_amount === plan.price;
        entry.recurring = price.recurring
          ? { interval: price.recurring.interval, intervalCount: price.recurring.interval_count }
          : null;
        if (!price.active) {
          entry.error = "Price inativo";
        } else if (!price.recurring) {
          entry.error = "Price nao e de assinatura (falta recorrencia)";
        } else if (price.currency !== "brl") {
          entry.error = `Moeda esperada brl, encontrada ${price.currency}`;
        } else if (price.recurring.interval !== entry.expectedRecurring) {
          entry.error = `Ciclo esperado ${entry.expectedRecurring}, encontrado ${price.recurring.interval}`;
        } else if (!entry.amountMatchesCatalog) {
          entry.warning = `O valor atual da Stripe e ${price.unit_amount} centavos; o catalogo visual do app esta em ${plan.price} centavos.`;
        }
      } catch (error) {
        entry.error = error?.raw?.message || error?.message || "Falha ao consultar o Price";
      }
      prices.push(entry);
    }

    return sendSuccess(req, res, {
      mode,
      keyPrefix: keyPrefix ? `${keyPrefix}...` : null,
      keyWarning,
      webhookPrefix: webhookSecret ? `${webhookPrefix}...` : null,
      webhookWarning,
      secretKeyConfigured: Boolean(secretKey),
      webhookSecretConfigured: Boolean(webhookSecret),
      prices,
    });
  } catch (error) {
    logServerError("stripe_diagnose", error, req);
    return sendError(req, res, error, "Erro ao executar diagnostico do Stripe");
  }
}
