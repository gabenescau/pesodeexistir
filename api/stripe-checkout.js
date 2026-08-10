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

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { plan: planKey, paymentMethod, attemptId } = parseCheckoutInput(req.body);
    const plan = getBillingPlan(planKey);
    if (paymentMethod !== "CARD") {
      return sendClientError(req, res, 400, "Metodo de pagamento invalido");
    }
    if (!await enforceRateLimit(req, res, {
      scope: "stripe_checkout",
      limit: 10,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const [profile, subscriptions] = await Promise.all([
      getProfile(user.id),
      user.id ? listUserSubscriptions(user.id) : Promise.resolve([]),
    ]);
    if (hasActiveSubscription(subscriptions)) {
      return sendClientError(req, res, 409, "Voce ja possui um acesso ativo. Use a pagina de assinatura para gerenciar ou aguarde a data de termino.");
    }

    const stripe = getStripe();
    const siteUrl = getSiteUrl();
    const email = profile?.email || user?.email || "";
    const customerId = await getOrCreateStripeCustomer({ user, email, subscriptions });
    // There can be only one open reservation per user. Load it without
    // filtering by plan first so a second click cannot bypass the database
    // guard and expose a raw unique-constraint error.
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
    let effectiveAttemptId = attemptId;

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

    let checkoutPayload;
    const priceId = await validatePriceForPlan(plan);
    checkoutPayload = {
      ...common,
      mode: "subscription",
      excluded_payment_method_types: ["pix"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata },
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(
      checkoutPayload,
      { idempotencyKey: checkoutIdempotencyKey(user.id, plan.key, paymentMethod, effectiveAttemptId) }
    );
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
    logServerError("stripe_checkout", error, req);
    return sendError(req, res, error, "Nao foi possivel iniciar a assinatura");
  }
}
