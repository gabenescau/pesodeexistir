import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_JSON_BODY_BYTES = 32 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase server env vars nao configuradas");
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  return fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(timeoutMs),
  });
}

function getServiceHeaders() {
  const headers = { apikey: SUPABASE_SERVICE_KEY };
  if (!SUPABASE_SERVICE_KEY?.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_KEY}`;
  }
  return headers;
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function requireUuid(value, fieldName = "id") {
  if (!isUuid(value)) {
    const error = new Error(`${fieldName} invalido`);
    error.status = 400;
    throw error;
  }
  return value;
}

export function getRequestId(req) {
  const provided = String(req.headers["x-request-id"] || "");
  if (/^[a-zA-Z0-9._-]{8,80}$/.test(provided)) return provided;
  return crypto.randomUUID();
}

export function prepareResponse(req, res) {
  const requestId = getRequestId(req);
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  return requestId;
}

export function logServerError(context, error, req) {
  const redactedMessage = String(error?.message || "Erro desconhecido")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9._-]+\b/g, "[TOKEN]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]");
  console.error(JSON.stringify({
    level: "error",
    context,
    requestId: req?.requestId || null,
    errorName: error?.name || "Error",
    status: Number(error?.status) || 500,
    message: redactedMessage.slice(0, 500),
  }));
}

export function sendError(req, res, error, fallback = "Erro interno") {
  const status = Number(error?.status);
  const safeStatus = status >= 400 && status < 500 ? status : 500;
  const isProviderError =
    error?.name === "AbacatePayError" ||
    String(error?.message || "").startsWith("Supabase:");
  const message = safeStatus < 500 && !isProviderError
    ? String(error?.message || fallback)
    : fallback;

  return res.status(safeStatus).json({
    success: false,
    error: message,
    requestId: req?.requestId || null,
  });
}

export async function getAuthenticatedUser(req) {
  requireConfig();
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Sessao obrigatoria");
    error.status = 401;
    throw error;
  }

  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_PUBLIC_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error("Sessao invalida ou expirada");
    error.status = 401;
    throw error;
  }

  return response.json();
}

export async function supabaseRequest(path, options = {}) {
  requireConfig();
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getServiceHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = new Error(`Supabase: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getClientAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

export async function enforceRateLimit(req, res, {
  scope,
  limit,
  windowSeconds,
  userId,
}) {
  const rawIdentifier = userId ? `user:${userId}` : `ip:${getClientAddress(req)}`;
  const secret = process.env.RATE_LIMIT_SECRET || SUPABASE_SERVICE_KEY;
  const keyHash = crypto
    .createHmac("sha256", secret)
    .update(rawIdentifier)
    .digest("hex");

  try {
    const result = await supabaseRequest("rpc/check_api_rate_limit", {
      method: "POST",
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_scope: scope,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
    });

    const resetAt = Number(result?.reset_at) || Math.ceil(Date.now() / 1000) + windowSeconds;
    const remaining = Math.max(0, Number(result?.remaining) || 0);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetAt));
    res.setHeader("RateLimit-Policy", `${limit};w=${windowSeconds}`);

    if (result?.allowed === false) {
      const retryAfter = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: "Muitas tentativas. Aguarde um pouco e tente novamente.",
        retryAfter,
        requestId: req.requestId,
      });
      return false;
    }
  } catch (error) {
    // Evita derrubar pagamentos durante a janela entre deploy e migration.
    // Em producao, RATE_LIMIT_FAIL_CLOSED=true torna a falha bloqueante.
    console.warn(JSON.stringify({
      level: "warn",
      context: "rate_limit_unavailable",
      requestId: req.requestId || null,
      scope,
      message: String(error?.message || "indisponivel").slice(0, 300),
    }));
    if (process.env.RATE_LIMIT_FAIL_CLOSED === "true") {
      res.status(503).json({
        success: false,
        error: "Servico temporariamente indisponivel.",
        requestId: req.requestId,
      });
      return false;
    }
  }

  return true;
}

export async function getProfile(userId) {
  const rows = await supabaseRequest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role`
  );
  return rows?.[0] || null;
}

export async function requireAdmin(user) {
  const profile = await getProfile(user.id);
  const isAdmin = profile?.role === "admin" || user?.app_metadata?.role === "admin";
  if (!isAdmin) {
    const error = new Error("Acesso restrito a administradores");
    error.status = 403;
    throw error;
  }
  return profile;
}

export async function getSubscription(subscriptionId) {
  const rows = await supabaseRequest(
    `subscriptions?id=eq.${encodeURIComponent(subscriptionId)}&select=*`
  );
  return rows?.[0] || null;
}

export async function listUserSubscriptions(userId) {
  return supabaseRequest(
    `subscriptions?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=*`
  );
}

export async function updateSubscription(subscriptionId, payload) {
  const rows = await supabaseRequest(
    `subscriptions?id=eq.${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    }
  );
  return rows?.[0] || null;
}

export async function insertSubscription(payload) {
  const rows = await supabaseRequest("subscriptions", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

export function allowPost(req, res) {
  prepareResponse(req, res);
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.status(204).end();
    return false;
  }
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Metodo nao permitido" });
    return false;
  }
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    res.status(413).json({ success: false, error: "Payload muito grande", requestId: req.requestId });
    return false;
  }
  return true;
}
