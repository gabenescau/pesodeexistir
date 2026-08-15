import { getGrantPlan, getPlanByCode } from "../server/plans.js";
import { parseAdminSubscriptionInput } from "../src/lib/api-contracts.js";
import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  insertSubscription,
  listUserSubscriptions,
  logAuditEvent,
  logServerError,
  requireAdmin,
  sendClientError,
  sendError,
  sendSuccess,
  updateSubscription,
} from "../server/supabase.js";

const ALLOWED_DURATIONS = new Set([7, 30, 90, 180, 365]);

function activeSubscription(list) {
  return list.find((subscription) =>
    ["pending", "active", "past_due", "trialing"].includes(subscription.status)
  );
}

function validateDuration(value) {
  const days = Number(value);
  if (!ALLOWED_DURATIONS.has(days)) {
    const error = new Error("Duracao invalida");
    error.status = 400;
    throw error;
  }
  return days;
}

async function grantManual({ admin, userId, email, plan, durationDays }) {
  const days = validateDuration(durationDays);
  const planRecord = getPlanByCode(plan) || getGrantPlan(plan, days);
  if (!planRecord) throw new Error("Plano invalido");
  const subscriptions = await listUserSubscriptions(userId);
  const current = activeSubscription(subscriptions);

  if (current?.provider === "stripe") {
    const error = new Error("Use upgrade/downgrade ou cancelamento oficial para esta assinatura Stripe");
    error.status = 409;
    throw error;
  }

  const now = new Date();
  const base = current?.current_period_end && new Date(current.current_period_end) > now
    ? new Date(current.current_period_end)
    : now;
  const end = new Date(base);
  end.setDate(end.getDate() + days);
  const payload = {
    user_id: userId,
    customer_email: email || current?.customer_email || "",
    plan: planRecord.plan,
    status: "active",
    current_period_start: current?.current_period_start || now.toISOString(),
    current_period_end: end.toISOString(),
    canceled_at: null,
    cancel_at_period_end: false,
    provider: "manual_admin",
    provider_customer_id: null,
    provider_subscription_id: null,
    metadata: {
      ...current?.metadata,
      source: "admin_panel",
      duration_days_added: days,
      granted_by: admin.id,
      granted_at: now.toISOString(),
    },
    updated_at: now.toISOString(),
  };

  return current
    ? updateSubscription(current.id, payload)
    : insertSubscription({ ...payload, created_at: now.toISOString() });
}

async function setManualDuration({ admin, userId, durationDays }) {
  const days = validateDuration(durationDays);
  const current = activeSubscription(await listUserSubscriptions(userId));
  if (!current) throw new Error("Usuario nao possui assinatura ativa");
  if (current.provider !== "manual_admin") {
    const error = new Error("Dias manuais nao alteram uma assinatura cobrada por provedor de pagamento");
    error.status = 409;
    throw error;
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return updateSubscription(current.id, {
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    metadata: {
      ...current.metadata,
      duration_days: days,
      duration_changed_by: admin.id,
      duration_changed_at: now.toISOString(),
    },
  });
}

export default async function handler(req, res) {
  if (!allowPost(req, res)) return;

  try {
    const user = await getAuthenticatedUser(req);
    await requireAdmin(user);
    if (!await enforceRateLimit(req, res, {
      scope: "admin_subscription",
      limit: 60,
      windowSeconds: 300,
      userId: user.id,
    })) return;
    const { action, userId, email, plan, durationDays } = parseAdminSubscriptionInput(req.body);

    let updated;
    if (action === "grant") {
      updated = await grantManual({
        admin: user,
        userId,
        email,
        plan,
        durationDays,
      });
    } else if (action === "set_duration") {
      updated = await setManualDuration({ admin: user, userId, durationDays });
    } else {
      return sendClientError(req, res, 400, "Acao invalida");
    }

    logAuditEvent(`admin.subscription.${action}`, req, {
      actorId: user.id,
      targetId: updated?.id || userId,
      outcome: "success",
      provider: updated?.provider,
    });
    return sendSuccess(req, res, updated);
  } catch (error) {
    logServerError("admin_subscription", error, req);
    return sendError(req, res, error, "Erro interno na gestao de assinatura");
  }
}
