import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { hasPermission, normalizeRole, PERMISSIONS } from "../src/lib/rbac.js";
import { getCheckoutAttemptConflict } from "./stripe.js";

// Vercel/Supabase Native Integration can expose the public values with the
// NEXT_PUBLIC_ prefix. They are safe to use here; the privileged key below is
// deliberately server-only and never falls back to a public variable.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_JSON_BODY_BYTES = 32 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCTION_ORIGINS = new Set([
  "https://pesodeexistir.online",
  "https://www.pesodeexistir.online",
  "https://app.pesodeexistir.online",
]);
let serviceClient;

function allowedOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = new Set([...PRODUCTION_ORIGINS, ...configured]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }
  return origins;
}

function appendVary(res, value) {
  const current = String(res.getHeader?.("Vary") || "");
  const values = new Set(
    current.split(",").map((item) => item.trim()).filter(Boolean)
  );
  values.add(value);
  res.setHeader("Vary", [...values].join(", "));
}

export function applyCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  if (!allowedOrigins().has(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  appendVary(res, "Origin");
  return true;
}

function requireConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_PUBLIC_KEY) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SECRET_KEY");
  if (missing.length > 0) {
    const error = new Error(`Configuracao do servidor incompleta: ${missing.join(", ")}`);
    error.status = 503;
    error.userSafe = true;
    throw error;
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
  const authorization = String(req.headers.authorization || "");
  const token = authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1] || null;
  if (!token || token.length > 4096) return null;
  if ([...token].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return null;
  return token;
}

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function authCookieNames() {
  // __Host- cookies are only valid over HTTPS. Keep local development usable
  // without weakening the production cookie contract.
  return process.env.NODE_ENV === "production"
    ? { access: "__Host-ope_access", refresh: "__Host-ope_refresh" }
    : { access: "ope_access", refresh: "ope_refresh" };
}

function serializeAuthCookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value || "")}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function appendSetCookies(res, cookies) {
  if (!res || !cookies.length) return;
  const current = res.getHeader?.("Set-Cookie");
  const existing = Array.isArray(current) ? current : current ? [current] : [];
  res.setHeader("Set-Cookie", [...existing, ...cookies]);
}

export function setAuthCookies(res, session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const names = authCookieNames();
  const accessAge = Math.max(60, Math.min(3600, Number(session.expires_in) || 3600));
  appendSetCookies(res, [
    serializeAuthCookie(names.access, session.access_token, accessAge),
    serializeAuthCookie(names.refresh, session.refresh_token, AUTH_COOKIE_MAX_AGE),
  ]);
}

export function clearAuthCookies(res) {
  const names = authCookieNames();
  appendSetCookies(res, [
    serializeAuthCookie(names.access, "", 0),
    serializeAuthCookie(names.refresh, "", 0),
  ]);
}

export function getCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function supabaseAuthRequest(path, options = {}) {
  requireConfig();
  return fetchWithTimeout(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLIC_KEY,
      ...options.headers,
    },
  });
}

async function getAuthUserFromAccessToken(accessToken) {
  const response = await supabaseAuthRequest("user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id && user?.aud === "authenticated" ? user : null;
}

export async function getCookieSession(req, res) {
  const names = authCookieNames();
  const accessToken = getCookie(req, names.access);
  if (accessToken && accessToken.length <= 4096) {
    const user = await getAuthUserFromAccessToken(accessToken);
    if (user) return { user, accessToken };
  }

  const refreshToken = getCookie(req, names.refresh);
  if (!refreshToken || refreshToken.length > 4096) {
    if (res) clearAuthCookies(res);
    return null;
  }

  const response = await supabaseAuthRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    if (res) clearAuthCookies(res);
    return null;
  }

  const session = await response.json().catch(() => null);
  const user = session?.user || (session?.access_token
    ? await getAuthUserFromAccessToken(session.access_token)
    : null);
  if (!session?.access_token || !session?.refresh_token || !user) {
    if (res) clearAuthCookies(res);
    return null;
  }

  if (res) setAuthCookies(res, session);
  return { user, accessToken: session.access_token, session };
}

function getServiceClient() {
  requireConfig();
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return serviceClient;
}

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function requireUuid(value, fieldName = "id") {
  if (!isUuid(value)) {
    const error = new Error(`${fieldName} invalido`);
    error.status = 400;
    error.userSafe = true;
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
  console.info(JSON.stringify({
    level: "info",
    type: "access",
    requestId,
    method: String(req.method || "UNKNOWN").slice(0, 12),
    path: String(req.url || "/").split("?")[0].slice(0, 200),
  }));
  return requestId;
}

export function logAuditEvent(action, req, details = {}) {
  const safeDetails = {};
  for (const key of ["actorId", "targetId", "outcome", "provider"]) {
    if (details[key] != null) safeDetails[key] = String(details[key]).slice(0, 120);
  }
  console.info(JSON.stringify({
    level: "info",
    type: "audit",
    action: String(action || "unknown").slice(0, 120),
    requestId: req?.requestId || null,
    ...safeDetails,
  }));
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
    status: Number(error?.statusCode ?? error?.status) || 500,
    message: redactedMessage.slice(0, 500),
  }));
}

export function sendError(req, res, error, fallback = "Erro interno") {
  // StripeError expoe statusCode; erros internos do repo usam status.
  const status = Number(error?.statusCode ?? error?.status);
  const safeStatus = Number.isFinite(status) && status >= 400 && status < 500
    ? status
    : status === 503 && error?.userSafe
      ? 503
      : 500;
  const isProviderError =
    String(error?.message || "").startsWith("Supabase:");
  // Somente mensagens explicitamente marcadas pelo servidor podem voltar ao
  // browser. Status 4xx nao transforma uma excecao interna em texto publico.
  const message = error?.userSafe && !isProviderError
    ? String(error?.message || fallback)
    : fallback;

  return res.status(safeStatus).json({
    success: false,
    error: message,
    requestId: req?.requestId || null,
  });
}

export function sendSuccess(req, res, data = null, status = 200, extra = {}) {
  return res.status(status).json({
    success: true,
    data,
    ...extra,
    requestId: req?.requestId || null,
  });
}

export function sendClientError(req, res, status, message, extra = {}) {
  return res.status(status).json({
    success: false,
    error: message,
    ...extra,
    requestId: req?.requestId || null,
  });
}

export async function getAuthenticatedUser(req, res = null) {
  requireConfig();
  const token = getBearerToken(req);
  const cookieSession = token ? null : await getCookieSession(req, res);
  const accessToken = token || cookieSession?.accessToken;
  const user = token ? await getAuthUserFromAccessToken(token) : cookieSession?.user;

  if (!accessToken || !user || !isUuid(user.id) || user.aud !== "authenticated") {
    const error = new Error("Sessao invalida ou expirada");
    error.status = 401;
    error.userSafe = true;
    throw error;
  }
  return user;
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

export async function supabaseStorageRequest(path, options = {}) {
  requireConfig();
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const response = await fetchWithTimeout(`${SUPABASE_URL}/storage/v1/${normalizedPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getServiceHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = new Error(`Supabase Storage: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Executes a user-scoped REST/RPC request with the access token kept in the
// HttpOnly session cookie. This preserves auth.uid() in Postgres without
// exposing the token to browser JavaScript.
export async function supabaseUserRequest(accessToken, path, options = {}) {
  requireConfig();
  if (!accessToken || String(accessToken).length > 4096) {
    const error = new Error("Sessao invalida ou expirada");
    error.status = 401;
    error.userSafe = true;
    throw error;
  }
  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${accessToken}`,
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

export async function createSignedStorageUrl(bucket, objectPath, expiresIn = 3600) {
  requireConfig();
  const normalizedBucket = String(bucket || "").trim();
  const normalizedPath = String(objectPath || "").trim();
  const ttl = Number(expiresIn);
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(normalizedBucket)) {
    const error = new Error("Bucket invalido");
    error.status = 500;
    throw error;
  }
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    normalizedPath.includes("..") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("://") ||
    [...normalizedPath].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    }) ||
    normalizedPath.length > 500
  ) {
    const error = new Error("Objeto invalido");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  const safeTtl = Number.isFinite(ttl) ? Math.min(Math.max(Math.floor(ttl), 60), 3600) : 3600;
  const { data, error: storageError } = await getServiceClient()
    .storage
    .from(normalizedBucket)
    .createSignedUrl(normalizedPath, safeTtl);
  if (storageError) {
    const error = new Error(`Supabase Storage: ${storageError.message || "falha ao assinar objeto"}`);
    error.status = Number(storageError.statusCode || storageError.status) || 502;
    throw error;
  }
  const signedPath = data?.signedUrl || data?.signedURL;
  if (!signedPath) {
    const error = new Error("Storage nao retornou uma URL assinada");
    error.status = 502;
    throw error;
  }
  if (signedPath.startsWith("http")) return signedPath;
  if (signedPath.startsWith("/storage/v1/")) return `${SUPABASE_URL}${signedPath}`;
  return `${SUPABASE_URL}/storage/v1/${signedPath.replace(/^\//, "")}`;
}

export async function createSignedStorageUrlMap(bucket, objectPaths, expiresIn = 3600) {
  requireConfig();
  const normalizedBucket = String(bucket || "").trim();
  const uniquePaths = [...new Set((objectPaths || [])
    .map((path) => String(path || "").trim())
    .filter(Boolean))];
  const ttl = Number(expiresIn);
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(normalizedBucket)) {
    const error = new Error("Bucket invalido");
    error.status = 500;
    throw error;
  }
  if (uniquePaths.length === 0) return {};

  const safeTtl = Number.isFinite(ttl) ? Math.min(Math.max(Math.floor(ttl), 60), 3600) : 3600;
  const { data, error: storageError } = await getServiceClient()
    .storage
    .from(normalizedBucket)
    .createSignedUrls(uniquePaths, safeTtl);
  if (storageError) {
    const error = new Error(`Supabase Storage: ${storageError.message || "falha ao assinar objetos"}`);
    error.status = Number(storageError.statusCode || storageError.status) || 502;
    throw error;
  }
  return Object.fromEntries((data || [])
    .filter((item) => item?.path && (item.signedUrl || item.signedURL))
    .map((item) => [item.path, item.signedUrl || item.signedURL]));
}

function getClientAddress(req) {
  // Em Vercel, estes headers sao preenchidos pelo proxy da plataforma. Fora
  // dela, nao confiamos em X-Forwarded-For enviado pelo proprio cliente.
  const isTrustedProxy = process.env.VERCEL === "1" || Boolean(req.headers["x-vercel-id"]);
  if (isTrustedProxy) {
    const realIp = String(req.headers["x-real-ip"] || "").trim();
    if (realIp) return realIp;
    const forwarded = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)[0];
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || "unknown";
}

async function consumeRateLimit({ scope, limit, windowSeconds, rawIdentifier }) {
  const secret = process.env.RATE_LIMIT_SECRET || SUPABASE_SERVICE_KEY;
  const keyHash = crypto
    .createHmac("sha256", secret)
    .update(rawIdentifier)
    .digest("hex");

  try {
    return await supabaseRequest("rpc/check_api_rate_limit", {
      method: "POST",
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_scope: scope,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
    });

  } catch (error) {
    error.rateLimitScope = scope;
    throw error;
  }
}

export async function enforceRateLimit(req, res, {
  scope,
  limit,
  windowSeconds,
  userId,
}) {
  const checks = userId
    ? [
        { scope, limit, rawIdentifier: `user:${userId}` },
        {
          scope: `${scope}:ip`,
          limit: Math.max(limit * 5, 30),
          rawIdentifier: `ip:${getClientAddress(req)}`,
        },
      ]
    : [{ scope: `${scope}:ip`, limit, rawIdentifier: `ip:${getClientAddress(req)}` }];

  try {
    const results = [];
    for (const check of checks) {
      const result = await consumeRateLimit({
        ...check,
        windowSeconds,
      });
      results.push({ ...check, result });
      if (result?.allowed === false) break;
    }

    const blocked = results.find(({ result }) => result?.allowed === false);
    const strictest = blocked || results.reduce((lowest, current) => {
      if (!lowest) return current;
      return Number(current.result?.remaining) < Number(lowest.result?.remaining)
        ? current
        : lowest;
    }, null);
    const resetAt = Number(strictest?.result?.reset_at) ||
      Math.ceil(Date.now() / 1000) + windowSeconds;
    const remaining = Math.max(0, Number(strictest?.result?.remaining) || 0);
    res.setHeader("X-RateLimit-Limit", String(strictest?.limit || limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetAt));
    res.setHeader("RateLimit-Policy", `${strictest?.limit || limit};w=${windowSeconds}`);

    if (blocked) {
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
    // Fail-closed por padrao: falha de rate limit bloqueia a requisicao
    // (endpoints de pagamento nao podem abrir sem protecao). So volta a abrir
    // com RATE_LIMIT_FAIL_OPEN=true, como escape manual consciente.
    console.warn(JSON.stringify({
      level: "warn",
      context: "rate_limit_unavailable",
      requestId: req.requestId || null,
      scope,
      message: String(error?.message || "indisponivel").slice(0, 300),
    }));
    const allowFailOpenInDevelopment =
      process.env.NODE_ENV !== "production" &&
      process.env.RATE_LIMIT_FAIL_OPEN === "true";
    if (!allowFailOpenInDevelopment) {
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
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,name`
  );
  return rows?.[0] || null;
}

export async function requireAdmin(user) {
  const profile = await getProfile(user.id);
  const isAdmin = profile?.role === "admin";
  if (!isAdmin) {
    const error = new Error("Acesso restrito a administradores");
    error.status = 403;
    error.userSafe = true;
    throw error;
  }
  return profile;
}

export async function requirePermission(user, permission) {
  const profile = await getProfile(user.id);
  const role = normalizeRole(profile?.role);
  if (!hasPermission(role, permission)) {
    const error = new Error("Voce nao tem permissao para esta operacao");
    error.status = 403;
    error.userSafe = true;
    throw error;
  }
  return profile;
}

export { PERMISSIONS };

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

export async function deleteAuthUser(userId) {
  requireConfig();
  requireUuid(userId, "userId");
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: getServiceHeaders(),
    }
  );
  if (!response.ok) {
    const error = new Error(`Supabase: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
}

export async function getOpenCheckoutAttempt(userId, { planKey, paymentMethod } = {}) {
  const filters = [
    `user_id=eq.${encodeURIComponent(userId)}`,
    "status=eq.open",
  ];
  if (planKey) filters.push(`plan_key=eq.${encodeURIComponent(planKey)}`);
  if (paymentMethod) filters.push(`payment_method=eq.${encodeURIComponent(paymentMethod)}`);
  const rows = await supabaseRequest(
    `billing_checkout_attempts?${filters.join("&")}&order=created_at.desc&limit=1&select=*`
  );
  return rows?.[0] || null;
}

export async function getOpenCheckoutAttempts(userId) {
  const rows = await supabaseRequest(
    `billing_checkout_attempts?user_id=eq.${encodeURIComponent(userId)}&status=eq.open&order=created_at.desc&limit=10&select=*`
  );
  return Array.isArray(rows) ? rows : [];
}

export async function claimCheckoutAttempt({
  attemptId,
  userId,
  planKey,
  paymentMethod,
  provider = "stripe",
  externalReference = null,
  customerEmail = null,
  customerName = null,
}) {
  const existing = await supabaseRequest(
    `billing_checkout_attempts?attempt_id=eq.${encodeURIComponent(attemptId)}&limit=1&select=*`
  );
  if (existing?.[0]) {
    const conflict = getCheckoutAttemptConflict(existing[0], { userId, planKey, paymentMethod });
    if (conflict === "forbidden") {
      const error = new Error("Tentativa de checkout nao pertence a esta conta");
      error.status = 403;
      error.userSafe = true;
      throw error;
    }
    if (conflict === "pending_conflict" || existing[0].status !== "open") {
      const error = new Error("Ja existe um checkout em processamento. Aguarde a confirmacao ou sua expiracao.");
      error.status = 409;
      error.userSafe = true;
      throw error;
    }
    return { attempt: existing[0], reused: true };
  }

  try {
    const rows = await supabaseRequest("billing_checkout_attempts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        attempt_id: attemptId,
        user_id: userId,
        plan_key: planKey,
        payment_method: paymentMethod,
        provider,
        external_reference: externalReference,
        customer_email: customerEmail,
        customer_name: customerName,
      }),
    });
    return { attempt: rows?.[0] || null, reused: false };
  } catch (error) {
    if (Number(error?.status) !== 409) throw error;
    // The database protects the business rule with a partial unique index on
    // user_id. Read every open attempt after a race so a different plan does
    // not leak the raw 23505 response to the client.
    const openAttempts = await getOpenCheckoutAttempts(userId);
    const open = openAttempts.find((attempt) =>
      attempt.plan_key === planKey && attempt.payment_method === paymentMethod
    ) || openAttempts[0];
    if (open) {
      const conflict = getCheckoutAttemptConflict(open, { userId, planKey, paymentMethod });
      if (conflict === "pending_conflict") {
        const pendingError = new Error("Ja existe um checkout em processamento. Aguarde a confirmacao ou sua expiracao.");
        pendingError.status = 409;
        pendingError.userSafe = true;
        throw pendingError;
      }
      return { attempt: open, conflict: true };
    }
    const pendingError = new Error("Ja existe um checkout em processamento. Aguarde a confirmacao ou sua expiracao.");
    pendingError.status = 409;
    pendingError.userSafe = true;
    throw pendingError;
  }
}

export async function expireOpenCheckoutAttempts(userId) {
  await supabaseRequest(
    `billing_checkout_attempts?user_id=eq.${encodeURIComponent(userId)}&status=eq.open`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "expired", updated_at: new Date().toISOString() }),
    }
  );
}

export async function updateCheckoutAttempt(attemptId, payload) {
  const rows = await supabaseRequest(
    `billing_checkout_attempts?attempt_id=eq.${encodeURIComponent(attemptId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    }
  );
  return rows?.[0] || null;
}

export async function markCheckoutAttemptBySession(sessionId, status) {
  if (!sessionId) return null;
  const rows = await supabaseRequest(
    `billing_checkout_attempts?stripe_session_id=eq.${encodeURIComponent(sessionId)}&limit=1&select=attempt_id`
  );
  const attemptId = rows?.[0]?.attempt_id;
  return attemptId ? updateCheckoutAttempt(attemptId, { status }) : null;
}

export function allowAuthRequest(req, res, { method = "POST", requireHeader = true } = {}) {
  prepareResponse(req, res);
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") {
    if (!corsAllowed) {
      res.status(403).json({ success: false, error: "Origem nao permitida" });
      return false;
    }
    res.setHeader("Access-Control-Allow-Methods", `${method}, OPTIONS`);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
    return false;
  }
  if (!corsAllowed) {
    res.status(403).json({ success: false, error: "Origem nao permitida" });
    return false;
  }
  if (req.method !== method) {
    res.status(405).json({ success: false, error: "Metodo nao permitido" });
    return false;
  }
  if (requireHeader && String(req.headers["x-requested-with"] || "") !== "OPE-Auth") {
    res.status(403).json({ success: false, error: "Cabecalho de seguranca ausente" });
    return false;
  }
  return true;
}

export function allowPost(req, res) {
  prepareResponse(req, res);
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") {
    if (!corsAllowed) {
      res.status(403).json({ success: false, error: "Origem nao permitida" });
      return false;
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Client-Info, Apikey, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
    return false;
  }
  if (!corsAllowed) {
    res.status(403).json({ success: false, error: "Origem nao permitida" });
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
