import crypto from "node:crypto";
import { parseAsaasAttemptInput, parseAsaasPixInput } from "../src/lib/api-contracts.js";
import {
  allowPost,
  claimCheckoutAttempt,
  enforceRateLimit,
  getAuthenticatedUser,
  getOpenCheckoutAttempts,
  listUserSubscriptions,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
  updateCheckoutAttempt,
} from "../server/supabase.js";
import { getBillingPlan, hasActiveSubscription } from "../server/domains/billing.js";
import { cancelAsaasCheckout, createAsaasPixPayment, deleteAsaasPayment, getAsaasPixQrCode } from "../server/asaas.js";
import { syncAsaasCheckout, syncAsaasPayment } from "../server/asaas-sync.js";

function safeCreateError(error) {
  if (error?.userSafe) return error;
  const providerStatus = Number(error?.status);
  const safe = new Error(
    error?.provider && [400, 422].includes(providerStatus)
      ? "Os dados do Pix foram recusados pela Asaas. Confira o nome, email e CPF/CNPJ e tente novamente."
      : "Nao foi possivel gerar o Pix. Tente novamente em alguns instantes."
  );
  safe.status = error?.provider && [400, 422].includes(providerStatus) ? 400 : 503;
  safe.userSafe = true;
  safe.cause = error;
  return safe;
}

async function createCheckout(req, res, user) {
  const { plan: planKey, attemptId, name, email: submittedEmail, cpfCnpj } = parseAsaasPixInput(req.body);
  const plan = getBillingPlan(planKey);
  if (!await enforceRateLimit(req, res, { scope: "asaas_pix_create", limit: 5, windowSeconds: 300, userId: user.id })) return;
  const subscriptions = await listUserSubscriptions(user.id);
  if (hasActiveSubscription(subscriptions)) return sendClientError(req, res, 409, "Voce ja possui um acesso ativo. Gerencie seu plano na pagina de assinatura.");
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || email !== submittedEmail) {
    return sendClientError(req, res, 400, "Use o mesmo email da sua conta para gerar o Pix.");
  }

  for (const current of await getOpenCheckoutAttempts(user.id)) {
    if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
      if (current.provider === "asaas" && current.provider_checkout_id) {
        if (current.payment_method === "PIX") {
          await deleteAsaasPayment(current.provider_checkout_id).catch(() => {});
        } else {
          await cancelAsaasCheckout(current.provider_checkout_id).catch(() => {});
        }
      }
      await updateCheckoutAttempt(current.attempt_id, { status: "expired" });
      continue;
    }
    if (current.provider === "asaas" && current.provider_checkout_id) {
      if (current.plan_key === plan.key && current.payment_method === "PIX") {
        const qrCode = await getAsaasPixQrCode(current.provider_checkout_id);
        return sendSuccess(req, res, {
          attemptId: current.attempt_id,
          planKey: current.plan_key,
          provider: "asaas",
          paymentMethod: "PIX",
          qrCode,
          reused: true,
        });
      }
      try {
        if (current.payment_method === "PIX") {
          await deleteAsaasPayment(current.provider_checkout_id);
        } else {
          await cancelAsaasCheckout(current.provider_checkout_id);
        }
      } catch (error) {
        if (![404, 409].includes(Number(error?.status))) throw error;
      }
      await updateCheckoutAttempt(current.attempt_id, { status: "canceled" });
    } else {
      return sendClientError(req, res, 409, "Finalize o checkout anterior antes de iniciar um novo pagamento.");
    }
  }

  const effectiveAttemptId = attemptId || crypto.randomUUID();
  const externalReference = `ope-checkout:${effectiveAttemptId}`;
  const claimed = await claimCheckoutAttempt({
    attemptId: effectiveAttemptId,
    userId: user.id,
    planKey: plan.key,
    paymentMethod: "PIX",
    provider: "asaas",
    externalReference,
    customerEmail: email,
    customerName: name,
  });
  if (claimed.conflict) return sendClientError(req, res, 409, "Outro checkout esta sendo iniciado. Tente novamente em alguns segundos.");
  if (claimed.attempt?.provider && claimed.attempt.provider !== "asaas") return sendClientError(req, res, 409, "Finalize o checkout anterior antes de iniciar um pagamento Asaas.");

  try {
    const payment = await createAsaasPixPayment({
      plan,
      userId: user.id,
      email,
      name,
      cpfCnpj,
      attemptId: claimed.attempt.attempt_id,
    });
    try {
      await updateCheckoutAttempt(claimed.attempt.attempt_id, {
        provider: "asaas",
        provider_checkout_id: payment.id,
        provider_customer_id: payment.customerId,
        external_reference: payment.externalReference,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      await deleteAsaasPayment(payment.id).catch(() => {});
      throw error;
    }
    return sendSuccess(req, res, {
      attemptId: claimed.attempt.attempt_id,
      planKey: plan.key,
      provider: "asaas",
      paymentMethod: "PIX",
      qrCode: payment.qrCode,
      status: payment.status,
    });
  } catch (error) {
    await updateCheckoutAttempt(claimed.attempt.attempt_id, { status: "expired" }).catch(() => {});
    throw safeCreateError(error);
  }
}

async function getOwnedAttempt(userId, attemptId) {
  const rows = await supabaseRequest(`billing_checkout_attempts?attempt_id=eq.${encodeURIComponent(attemptId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1&select=attempt_id,status,provider,provider_checkout_id,payment_method,plan_key`);
  return rows?.[0] || null;
}

async function checkoutStatus(req, res, user) {
  if (!await enforceRateLimit(req, res, { scope: "asaas_checkout_status", limit: 30, windowSeconds: 60, userId: user.id })) return;
  const { attemptId } = parseAsaasAttemptInput(req.body);
  const attempt = await getOwnedAttempt(user.id, attemptId);
  if (!attempt) return sendClientError(req, res, 404, "Checkout nao encontrado");
  if (attempt.provider !== "asaas" || !attempt.provider_checkout_id) return sendSuccess(req, res, { status: attempt.status, paid: attempt.status === "completed" });
  const result = attempt.payment_method === "PIX"
    ? await syncAsaasPayment(attempt.provider_checkout_id)
    : await syncAsaasCheckout(attempt.provider_checkout_id);
  return sendSuccess(req, res, { status: result.status, paid: result.status === "completed", planKey: result.attempt?.plan_key || attempt.plan_key });
}

async function cancelCheckout(req, res, user) {
  if (!await enforceRateLimit(req, res, { scope: "asaas_cancel_checkout", limit: 5, windowSeconds: 300, userId: user.id })) return;
  const { attemptId } = parseAsaasAttemptInput(req.body);
  const attempt = await getOwnedAttempt(user.id, attemptId);
  if (!attempt) return sendClientError(req, res, 404, "Checkout nao encontrado");
  if (attempt.status !== "open") return sendSuccess(req, res, { status: attempt.status });
  if (attempt.provider !== "asaas" || !attempt.provider_checkout_id) return sendClientError(req, res, 409, "Este checkout nao pertence ao Asaas");
  if (attempt.payment_method === "PIX") {
    await deleteAsaasPayment(attempt.provider_checkout_id);
  } else {
    await cancelAsaasCheckout(attempt.provider_checkout_id);
  }
  const updated = await updateCheckoutAttempt(attempt.attempt_id, { status: "canceled" });
  return sendSuccess(req, res, { status: updated?.status || "canceled" });
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;
  try {
    const user = await getAuthenticatedUser(req, res);
    const action = String(req.body?.action || "create").toLowerCase();
    if (action === "create") return await createCheckout(req, res, user);
    if (action === "status") return await checkoutStatus(req, res, user);
    if (action === "cancel") return await cancelCheckout(req, res, user);
    return sendClientError(req, res, 400, "Acao Asaas invalida");
  } catch (error) {
    return sendError(req, res, error, "Nao foi possivel concluir a operacao Asaas.");
  }
}
