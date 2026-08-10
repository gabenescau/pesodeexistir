import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  getProfile,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  sendError,
} from "../server/supabase.js";
import {
  checkoutIdempotencyKey,
  expireOpenCheckoutSessions,
  getOrCreateStripeCustomer,
  getSiteUrl,
  getStripe,
  integrationIdentifier,
  validatePriceForPlan,
} from "../server/stripe.js";
import { getPlanByKey } from "../server/plans.js";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function hasActiveSubscription(list) {
  return (list || []).some((sub) => ACTIVE_STATUSES.has(sub.status));
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    const { plan: planKey = "leitor-monthly", paymentMethod = "CARD" } = req.body || {};
    const plan = getPlanByKey(planKey);
    if (!plan) {
      return res.status(400).json({ success: false, error: "Plano invalido", requestId: req.requestId });
    }
    if (!new Set(["CARD", "PIX"]).has(paymentMethod)) {
      return res.status(400).json({ success: false, error: "Metodo de pagamento invalido", requestId: req.requestId });
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
      return res.status(409).json({
        success: false,
        error: "Voce ja possui uma assinatura ativa. Use a pagina de assinatura para gerenciar.",
        requestId: req.requestId,
      });
    }

    const stripe = getStripe();
    const siteUrl = getSiteUrl();
    const email = profile?.email || user?.email || "";
    const customerId = await getOrCreateStripeCustomer({ user, email, subscriptions });
    const reusable = await expireOpenCheckoutSessions(
      customerId,
      user.id,
      plan.key,
      paymentMethod
    );
    if (reusable) {
      return res.status(200).json({
        success: true,
        data: { url: reusable.url, planKey: plan.key, paymentMethod, reused: true },
      });
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
    if (paymentMethod === "CARD") {
      const priceId = await validatePriceForPlan(plan);
      checkoutPayload = {
        ...common,
        mode: "subscription",
        excluded_payment_method_types: ["pix"],
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: { metadata },
        allow_promotion_codes: true,
      };
    } else {
      checkoutPayload = {
        ...common,
        mode: "payment",
        excluded_payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "brl",
            unit_amount: plan.price,
            product_data: {
              name: `${plan.name} via PIX`,
              description: `${plan.durationDays} dias de acesso ao OPE Club`,
              metadata: { plan_key: plan.key },
            },
          },
          quantity: 1,
        }],
        payment_intent_data: { metadata },
      };
    }

    const session = await stripe.checkout.sessions.create(
      checkoutPayload,
      { idempotencyKey: checkoutIdempotencyKey(user.id, plan.key, paymentMethod) }
    );

    logAuditEvent("subscription.checkout.created", req, {
      actorId: user.id,
      outcome: "success",
      provider: "stripe",
    });
    return res.status(200).json({
      success: true,
      data: { url: session.url, planKey: plan.key, paymentMethod },
    });
  } catch (error) {
    logServerError("stripe_checkout", error, req);
    return sendError(req, res, error, "Nao foi possivel iniciar a assinatura");
  }
}
