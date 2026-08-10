// Contratos compartilhados entre browser e Functions.
// Eles limitam forma/tamanho do input; autorizacao, preco e entitlement
// continuam sendo decididos exclusivamente no servidor.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN_KEY_PATTERN = /^(?:leitor|pensador)-(?:monthly|annual)$/;
const ATTEMPT_ID_PATTERN = /^[a-zA-Z0-9_-]{16,100}$/;
const SUGGESTION_STATUSES = new Set(["ideas", "reading", "building", "released"]);
const ADMIN_SUBSCRIPTION_ACTIONS = new Set(["grant", "set_duration"]);

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
    this.status = 400;
    this.userSafe = true;
  }
}

function objectInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ContractError("Corpo da requisicao invalido");
  }
  return input;
}

function requiredString(value, field, maxLength = 120) {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    throw new ContractError(`${field} invalido`);
  }
  return value.trim();
}

function uuid(value, field) {
  const normalized = requiredString(value, field, 64);
  if (!UUID_PATTERN.test(normalized)) throw new ContractError(`${field} invalido`);
  return normalized;
}

function planKey(value) {
  const normalized = requiredString(value, "Plano", 40);
  if (!PLAN_KEY_PATTERN.test(normalized)) throw new ContractError("Plano invalido");
  return normalized;
}

export function parseCheckoutInput(input) {
  const body = objectInput(input);
  const plan = planKey(body.plan || "leitor-monthly");
  const paymentMethod = body.paymentMethod || "CARD";
  if (paymentMethod !== "CARD" && paymentMethod !== "PIX") {
    throw new ContractError("Metodo de pagamento invalido");
  }
  const attemptId = requiredString(body.attemptId, "Tentativa de checkout", 100);
  if (!ATTEMPT_ID_PATTERN.test(attemptId)) throw new ContractError("Tentativa de checkout invalida");
  return { plan, paymentMethod, attemptId };
}

export function parseSubscriptionInput(input) {
  const body = objectInput(input);
  return {
    subscriptionId: uuid(body.subscriptionId, "Assinatura"),
    plan: planKey(body.plan),
  };
}

export function parseSubscriptionIdInput(input) {
  const body = objectInput(input);
  return {
    subscriptionId: uuid(body.subscriptionId, "Assinatura"),
    immediate: body.immediate === true,
  };
}

export function parseStripeSessionInput(input) {
  const body = objectInput(input);
  const sessionId = requiredString(body.sessionId, "Checkout", 255);
  if (!/^cs_(?:test|live)_[A-Za-z0-9_]{8,240}$/.test(sessionId)) {
    throw new ContractError("Checkout invalido");
  }
  return { sessionId };
}

export function parseDeleteAccountInput(input) {
  const body = objectInput(input);
  if (body.confirmation !== "DELETE_ACCOUNT") {
    throw new ContractError("Confirmacao de exclusao invalida");
  }
  return { confirmation: "DELETE_ACCOUNT" };
}

export function parseAdminSubscriptionInput(input) {
  const body = objectInput(input);
  const action = requiredString(body.action, "Acao", 32);
  if (!ADMIN_SUBSCRIPTION_ACTIONS.has(action)) throw new ContractError("Acao invalida");
  const durationDays = Number(body.durationDays ?? 30);
  if (![7, 30, 90, 180, 365].includes(durationDays)) {
    throw new ContractError("Duracao invalida");
  }
  return {
    action,
    userId: uuid(body.userId, "Usuario"),
    email: typeof body.email === "string" ? body.email.trim().slice(0, 320) : "",
    plan: typeof body.plan === "string" ? body.plan.trim().slice(0, 80) : "leitor",
    durationDays,
  };
}

export function parseAdminSuggestionInput(input) {
  const body = objectInput(input);
  const action = requiredString(body.action, "Acao", 16);
  if (action !== "move" && action !== "delete") throw new ContractError("Acao invalida");
  const result = {
    action,
    suggestionId: uuid(body.suggestionId, "Sugestao"),
  };
  if (action === "move") {
    const status = requiredString(body.status, "Coluna", 16);
    if (!SUGGESTION_STATUSES.has(status)) throw new ContractError("Sugestao ou coluna invalida");
    result.status = status;
  }
  return result;
}

export function parseSuggestionLikeInput(input) {
  const body = objectInput(input);
  return { suggestionId: uuid(body.suggestionId, "Sugestao") };
}
