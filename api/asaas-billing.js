import crypto from "node:crypto";
import { parseAsaasAttemptInput, parseAsaasCheckoutInput } from "../src/lib/api-contracts.js";
import {
  allowPost,
  claimCheckoutAttempt,
  enforceRateLimit,
  getAuthenticatedUser,
  getOpenCheckoutAttempts,
  getProfile,
  listUserSubscriptions,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
  updateCheckoutAttempt,
} from "../server/supabase.js";
import { getBillingPlan, hasActiveSubscription } from "../server/domains/billing.js";
import { buildCheckoutLink, cancelAsaasCheckout, createAsaasCheckout } from "../server/asaas.js";
import { syncAsaasCheckout } from "../server/asaas-sync.js";
import { getSiteUrl } from "../server/site.js";

function safeCreateError(error) {
  if (error?.userSafe) return error;
  const safe = new Error("Nao foi possivel iniciar o checkout Asaas. Tente novamente em alguns instantes.");
  safe.status = 503;
  safe.userSafe = true;
  safe.cause = error;
  return safe;
}

async function createCheckout(req, res, user) {
  const { plan: planKey, attemptId } = parseAsaasCheckoutInput(req.body);
  const plan = getBillingPlan(planKey);
  if (!await enforceRateLimit(req, res, { scope: "asaas_checkout", limit: 8, windowSeconds: 300, userId: user.id })) return;
  const [profile, subscriptions] = await Promise.all([getProfile(user.id), listUserSubscriptions(user.id)]);
  if (hasActiveSubscription(subscriptions)) return sendClientError(req, res, 409, "Voce ja possui um acesso ativo. Gerencie seu plano na pagina de assinatura.");

  for (const current of await getOpenCheckoutAttempts(user.id)) {
    if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
      await updateCheckoutAttempt(current.attempt_id, { status: "expired" });
      continue;
    }
    if (current.provider === "asaas" && current.provider_checkout_id) {
      if (current.plan_key === plan.key) {
        return sendSuccess(req, res, { url: buildCheckoutLink(current.provider_checkout_id), attemptId: current.attempt_id, planKey: current.plan_key, provider: "asaas", reused: true });
      }
      try { await cancelAsaasCheckout(current.provider_checkout_id); } catch (error) {
        if (![404, 409].includes(Number(error?.status))) throw error;
      }
      await updateCheckoutAttempt(current.attempt_id, { status: "canceled" });
    } else {
      return sendClientError(req, res, 409, "Finalize o checkout anterior antes de iniciar um novo pagamento.");
    }
  }

  const effectiveAttemptId = attemptId || crypto.randomUUID();
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return sendClientError(req, res, 400, "Sua conta precisa ter um email valido para pagar.");
  const externalReference = `ope-checkout:${effectiveAttemptId}`;
  const claimed = await claimCheckoutAttempt({
    attemptId: effectiveAttemptId,
    userId: user.id,
    planKey: plan.key,
    paymentMethod: "ASAAS_CHECKOUT",
    provider: "asaas",
    externalReference,
    customerEmail: email,
    customerName: profile?.name || user.user_metadata?.name || "",
  });
  if (claimed.conflict) return sendClientError(req, res, 409, "Outro checkout esta sendo iniciado. Tente novamente em alguns segundos.");
  if (claimed.attempt?.provider && claimed.attempt.provider !== "asaas") return sendClientError(req, res, 409, "Finalize o checkout anterior antes de iniciar um pagamento Asaas.");

  try {
    const checkout = await createAsaasCheckout({ plan, userId: user.id, email, name: profile?.name || user.user_metadata?.name, attemptId: claimed.attempt.attempt_id, siteUrl: getSiteUrl() });
    try {
      await updateCheckoutAttempt(claimed.attempt.attempt_id, { provider: "asaas", provider_checkout_id: checkout.id, external_reference: checkout.externalReference, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    } catch (error) {
      await cancelAsaasCheckout(checkout.id).catch(() => {});
      throw error;
    }
    return sendSuccess(req, res, { url: checkout.url, attemptId: claimed.attempt.attempt_id, planKey: plan.key, provider: "asaas", paymentMethods: ["PIX", "CREDIT_CARD"] });
  } catch (error) {
    await updateCheckoutAttempt(claimed.attempt.attempt_id, { status: "expired" }).catch(() => {});
    throw safeCreateError(error);
  }
}

async function getOwnedAttempt(userId, attemptId) {
  const rows = await supabaseRequest(`billing_checkout_attempts?attempt_id=eq.${encodeURIComponent(attemptId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1&select=attempt_id,status,provider,provider_checkout_id,plan_key`);
  return rows?.[0] || null;
}

async function checkoutStatus(req, res, user) {
  if (!await enforceRateLimit(req, res, { scope: "asaas_checkout_status", limit: 30, windowSeconds: 60, userId: user.id })) return;
  const { attemptId } = parseAsaasAttemptInput(req.body);
  const attempt = await getOwnedAttempt(user.id, attemptId);
  if (!attempt) return sendClientError(req, res, 404, "Checkout nao encontrado");
  if (attempt.provider !== "asaas" || !attempt.provider_checkout_id) return sendSuccess(req, res, { status: attempt.status, paid: attempt.status === "completed" });
  const result = await syncAsaasCheckout(attempt.provider_checkout_id);
  return sendSuccess(req, res, { status: result.status, paid: result.status === "completed", planKey: result.attempt?.plan_key || attempt.plan_key });
}

async function cancelCheckout(req, res, user) {
  if (!await enforceRateLimit(req, res, { scope: "asaas_cancel_checkout", limit: 5, windowSeconds: 300, userId: user.id })) return;
  const { attemptId } = parseAsaasAttemptInput(req.body);
  const attempt = await getOwnedAttempt(user.id, attemptId);
  if (!attempt) return sendClientError(req, res, 404, "Checkout nao encontrado");
  if (attempt.status !== "open") return sendSuccess(req, res, { status: attempt.status });
  if (attempt.provider !== "asaas" || !attempt.provider_checkout_id) return sendClientError(req, res, 409, "Este checkout nao pertence ao Asaas");
  await cancelAsaasCheckout(attempt.provider_checkout_id);
  const updated = await updateCheckoutAttempt(attempt.attempt_id, { status: "canceled" });
  return sendSuccess(req, res, { status: updated?.status || "canceled" });
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;
  try {
    const user = await getAuthenticatedUser(req);
    const action = String(req.body?.action || "create").toLowerCase();
    if (action === "create") return await createCheckout(req, res, user);
    if (action === "status") return await checkoutStatus(req, res, user);
    if (action === "cancel") return await cancelCheckout(req, res, user);
    return sendClientError(req, res, 400, "Acao Asaas invalida");
  } catch (error) {
    return sendError(req, res, error, "Nao foi possivel concluir a operacao Asaas.");
  }
}
