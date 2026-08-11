import crypto from "node:crypto";
import { parseCheckoutInput } from "../src/lib/api-contracts.js";
import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  claimCheckoutAttempt,
  getOpenCheckoutAttempts,
  getProfile,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  sendClientError,
  updateCheckoutAttempt,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import {
  checkoutIdempotencyKey,
  expireOpenCheckoutSessions,
  getOrCreateStripeCustomer,
  getSiteUrl,
  getStripe,
  integrationIdentifier,
  expireCheckoutSession,
  validatePriceForPlan,
} from "../server/stripe.js";
import { getBillingPlan, hasActiveSubscription } from "../server/domains/billing.js";

function publicCheckoutError(error, phase) {
  if (error?.userSafe) return error;
  const status = Number(error?.statusCode ?? error?.status);
  if (!(phase.startsWith("stripe_") || phase === "price_validation" || phase === "checkout_reservation") || !Number.isFinite(status) || status < 400 || status >= 500) {
    return error;
  }

  const safe = new Error(
    phase === "price_validation"
      ? "A Stripe recusou o Price configurado. Confirme que o STRIPE_PRICE_* e um price_ ativo, recorrente, BRL e do mesmo modo da STRIPE_SECRET_KEY."
      : phase === "stripe_customer"
        ? "A Stripe recusou o cliente da assinatura. Verifique as permissoes da chave restrita e se a chave e do mesmo modo dos Prices."
        : phase === "checkout_reservation"
          ? "A estrutura de checkout do banco ainda nao esta pronta. Execute supabase db push e publique novamente a API."
        : "A Stripe recusou a criacao do Checkout. Confirme a conta, a chave e os Prices no mesmo modo (teste ou producao)."
  );
  safe.status = 503;
  safe.userSafe = true;
  safe.cause = error;
  return safe;
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  let phase = "request";
  try {
    phase = "auth";
    const user = await getAuthenticatedUser(req);
    phase = "input";
    const { plan: planKey, paymentMethod, attemptId } = parseCheckoutInput(req.body);
    const plan = getBillingPlan(planKey);
    if (paymentMethod !== "CARD") {
      return sendClientError(req, res, 400, "Metodo de pagamento invalido");
    }
    phase = "rate_limit";
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_checkout",
      limit: 10,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    phase = "supabase_state";
    const [profile, subscriptions] = await Promise.all([
      getProfile(user.id),
      user.id ? listUserSubscriptions(user.id) : Promise.resolve([]),
    ]);
    if (hasActiveSubscription(subscriptions)) {
      return sendClientError(req, res, 409, "Voce ja possui um acesso ativo. Use a pagina de assinatura para gerenciar ou aguarde a data de termino.");
    }

    phase = "stripe_client";
    const stripe = getStripe();
    const siteUrl = getSiteUrl();
    const email = profile?.email || user?.email || "";
    phase = "stripe_customer";
    const customerId = await getOrCreateStripeCustomer({ user, email, subscriptions });
    // There can be only one open reservation per user. Load it without
    // filtering by plan first so a second click cannot bypass the database
    // guard and expose a raw unique-constraint error.
    phase = "checkout_reservation";
    const openAttempts = await getOpenCheckoutAttempts(user.id);
    const matchingOpenAttempt = openAttempts.find((attempt) =>
      attempt.plan_key === plan.key && attempt.payment_method === paymentMethod
    );
    const otherOpenAttempts = openAttempts.filter((attempt) => attempt !== matchingOpenAttempt);

    for (const previousAttempt of otherOpenAttempts) {
      const expiration = await expireCheckoutSession(previousAttempt.stripe_session_id);
      if (expiration.paid) {
        return sendClientError(req, res, 409, "Pagamento ja confirmado. Aguarde a sincronizacao da assinatura.");
      }
      await updateCheckoutAttempt(previousAttempt.attempt_id, {
        status: "expired",
        updated_at: new Date().toISOString(),
      });
    }

    let openAttempt = matchingOpenAttempt || null;
    // The attempt id is only a reservation key. Generate it on the server so
    // an older client cannot fail checkout just because it does not know this
    // internal field.
    let effectiveAttemptId = attemptId || crypto.randomUUID();

    if (openAttempt?.expires_at && Date.parse(openAttempt.expires_at) <= Date.now()) {
      await updateCheckoutAttempt(openAttempt.attempt_id, {
        status: "expired",
        updated_at: new Date().toISOString(),
      });
      openAttempt = null;
    }

    if (openAttempt) {
      effectiveAttemptId = openAttempt.attempt_id;
      if (openAttempt.stripe_session_id) {
        try {
          const existingSession = await stripe.checkout.sessions.retrieve(openAttempt.stripe_session_id);
          if (existingSession.status === "open" && existingSession.url) {
            return sendSuccess(req, res, { url: existingSession.url, planKey: plan.key, paymentMethod, reused: true });
          }
          if (existingSession.status === "complete" && existingSession.payment_status === "paid") {
            return sendClientError(req, res, 409, "Pagamento ja confirmado. Aguarde a sincronizacao da assinatura.");
          }
        } catch (error) {
          if (error?.code !== "resource_missing" && Number(error?.statusCode) !== 404) throw error;
        }

        await updateCheckoutAttempt(openAttempt.attempt_id, {
          status: "expired",
          updated_at: new Date().toISOString(),
        });
        effectiveAttemptId = crypto.randomUUID();
      }
    }

    phase = "stripe_existing_sessions";
    const reusable = await expireOpenCheckoutSessions(
      customerId,
      user.id,
      plan.key,
      paymentMethod
    );
    if (reusable) {
      const claimedReusable = await claimCheckoutAttempt({
        attemptId: effectiveAttemptId,
        userId: user.id,
        planKey: plan.key,
        paymentMethod,
      });
      if (claimedReusable.conflict && claimedReusable.attempt?.stripe_session_id) {
        const samePlan = claimedReusable.attempt.plan_key === plan.key && claimedReusable.attempt.payment_method === paymentMethod;
        if (!samePlan) {
          return sendClientError(req, res, 409, "Outro checkout esta sendo iniciado. Tente novamente em alguns segundos.");
        }
        const existingSession = await stripe.checkout.sessions.retrieve(claimedReusable.attempt.stripe_session_id);
        if (existingSession.status === "open" && existingSession.url) {
          return sendSuccess(req, res, { url: existingSession.url, planKey: plan.key, paymentMethod, reused: true });
        }
        return sendClientError(req, res, 409, "Ja existe um checkout em processamento. Aguarde a confirmacao ou sua expiracao.");
      }
      await updateCheckoutAttempt(claimedReusable.attempt.attempt_id, {
        stripe_session_id: reusable.id,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      return sendSuccess(req, res, { url: reusable.url, planKey: plan.key, paymentMethod, reused: true });
    }
    const claimed = await claimCheckoutAttempt({
      attemptId: effectiveAttemptId,
      userId: user.id,
      planKey: plan.key,
      paymentMethod,
    });
    if (claimed.conflict) {
      const samePlan = claimed.attempt?.plan_key === plan.key && claimed.attempt?.payment_method === paymentMethod;
      if (!samePlan) {
        return sendClientError(req, res, 409, "Outro checkout esta sendo iniciado. Tente novamente em alguns segundos.");
      }
      if (claimed.attempt?.stripe_session_id) {
        const existingSession = await stripe.checkout.sessions.retrieve(claimed.attempt.stripe_session_id);
        if (existingSession.status === "open" && existingSession.url) {
          return sendSuccess(req, res, { url: existingSession.url, planKey: plan.key, paymentMethod, reused: true });
        }
        if (existingSession.status === "complete" && existingSession.payment_status === "paid") {
          return sendClientError(req, res, 409, "Pagamento ja confirmado. Aguarde a sincronizacao da assinatura.");
        }
      }
      return sendClientError(req, res, 409, "Ja existe um checkout em processamento. Aguarde a confirmacao ou sua expiracao.");
    }

    phase = "price_validation";
    const metadata = {
      user_id: user.id,
      plan: plan.plan,
      plan_key: plan.key,
      payment_method: paymentMethod,
    };
    const common = {
      customer: customerId,
      client_reference_id: user.id,
      success_url: `${siteUrl}/app/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/app/planos?checkout=canceled`,
      locale: "pt-BR",
      integration_identifier: integrationIdentifier(user.id, plan.key, paymentMethod),
      metadata,
    };

    // Configure this Stripe Payment Method Configuration with only card
    // enabled. It remains server-side and cannot be changed by the browser.
    const paymentMethodConfiguration = String(
      process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID || ""
    ).trim();
    if (paymentMethodConfiguration) {
      common.payment_method_configuration = paymentMethodConfiguration;
    }

    let checkoutPayload;
    const priceId = await validatePriceForPlan(plan);
    checkoutPayload = {
      ...common,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata },
      allow_promotion_codes: true,
    };

    phase = "stripe_session_create";
    const session = await stripe.checkout.sessions.create(
      checkoutPayload,
      { idempotencyKey: checkoutIdempotencyKey(user.id, plan.key, paymentMethod, effectiveAttemptId) }
    );
    phase = "checkout_reservation_finalize";
    await updateCheckoutAttempt(effectiveAttemptId, {
      stripe_session_id: session.id,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    logAuditEvent("subscription.checkout.created", req, {
      actorId: user.id,
      outcome: "success",
      provider: "stripe",
    });
    return sendSuccess(req, res, { url: session.url, planKey: plan.key, paymentMethod, attemptId: effectiveAttemptId });
  } catch (error) {
    const publicError = publicCheckoutError(error, phase);
    logServerError(`stripe_checkout:${phase}`, error, req);
    return sendError(req, res, publicError, "Nao foi possivel iniciar a assinatura");
  }
}
