import {
  clearAuthCookies,
  getCookieSession,
  setAuthCookies,
  supabaseAuthRequest,
  supabaseRequest,
} from "./supabase.js";

function safeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeEmail(value) {
  const email = safeText(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Digite um email valido.");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return email;
}

function safePassword(value, { requireStrong = false } = {}) {
  if (typeof value !== "string" || value.length < (requireStrong ? 12 : 1) || value.length > 256) {
    const error = new Error(requireStrong ? "Use uma senha com pelo menos 12 caracteres." : "Digite sua senha.");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return value;
}

export function parseLoginBody(body = {}) {
  return {
    email: safeEmail(body.email),
    password: safePassword(body.password),
  };
}

export function parseSignupBody(body = {}) {
  const name = safeText(body.name, 80);
  if (name.length < 1) {
    const error = new Error("Digite seu nome.");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return {
    email: safeEmail(body.email),
    password: safePassword(body.password, { requireStrong: true }),
    name,
    referralCode: safeText(body.referralCode, 40),
    marketingOptIn: body.marketingOptIn === true,
  };
}

export function parseEmailBody(body = {}) {
  return { email: safeEmail(body.email) };
}

export function parseUpdateUserBody(body = {}) {
  const payload = {};
  if (body.email !== undefined) payload.email = safeEmail(body.email);
  if (body.password !== undefined) payload.password = safePassword(body.password, { requireStrong: true });
  if (body.data?.name !== undefined) {
    const name = safeText(body.data.name, 80);
    if (!name) {
      const error = new Error("Digite um nome valido.");
      error.status = 400;
      error.userSafe = true;
      throw error;
    }
    payload.data = { name };
  }
  if (!Object.keys(payload).length) {
    const error = new Error("Nenhuma alteracao foi enviada.");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return payload;
}

function safeOptionalUrl(value, maxLength = 500) {
  if (value == null || value === "") return null;
  const url = safeText(value, maxLength);
  if (!/^https:\/\//i.test(url)) {
    const error = new Error("URL de imagem invalida.");
    error.status = 400;
    error.userSafe = true;
    throw error;
  }
  return url;
}

export function parseProfileUpdateBody(body = {}) {
  const payload = {};
  if (body.name !== undefined) {
    const name = safeText(body.name, 80);
    if (!name) throw Object.assign(new Error("Digite um nome valido."), { status: 400, userSafe: true });
    payload.name = name;
  }
  if (body.username !== undefined) {
    const username = safeText(body.username, 24).toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw Object.assign(new Error("Nome de usuario invalido."), { status: 400, userSafe: true });
    }
    payload.username = username;
  }
  if (body.bio !== undefined) payload.bio = safeText(body.bio, 500) || null;
  if (body.avatar !== undefined) payload.avatar = safeText(body.avatar, 200) || null;
  if (body.avatar_url !== undefined) payload.avatar_url = safeOptionalUrl(body.avatar_url);
  for (const key of ["private_profile", "reading_activity", "show_online_status"]) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") {
        throw Object.assign(new Error("Preferencia de perfil invalida."), { status: 400, userSafe: true });
      }
      payload[key] = body[key];
    }
  }
  if (!Object.keys(payload).length) {
    throw Object.assign(new Error("Nenhuma alteracao de perfil foi enviada."), { status: 400, userSafe: true });
  }
  payload.updated_at = new Date().toISOString();
  return payload;
}

const PROFILE_SELECT = "id,name,avatar,avatar_url,username,bio,theme,role,private_profile,reading_activity,show_online_status,xp,credits,referral_code,created_at,updated_at";

export async function getAuthenticatedProfile(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const rows = await supabaseRequest(
    `profiles?id=eq.${encodeURIComponent(session.user.id)}&select=${PROFILE_SELECT}&limit=1`,
  );
  return { profile: rows?.[0] || null };
}

export async function updateAuthenticatedProfile(req, res, payload) {
  const session = await getRequiredCookieSession(req, res);
  const rows = await supabaseRequest(
    `profiles?id=eq.${encodeURIComponent(session.user.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    },
  );
  if (!rows?.[0]) {
    const error = new Error("Perfil nao encontrado.");
    error.status = 404;
    error.userSafe = true;
    throw error;
  }
  return { profile: rows[0] };
}

export async function readProviderResponse(response, { operation = "auth" } = {}) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = String(
      payload?.msg ||
      payload?.message ||
      payload?.error_description ||
      payload?.error ||
      "",
    );
    const providerCode = String(
      payload?.error_code || payload?.code || payload?.error || "",
    ).toLowerCase();
    let safeMessage = "Nao foi possivel concluir a operacao de autenticacao.";
    let publicCode = "AUTH_PROVIDER_ERROR";
    if (
      providerCode === "invalid_grant" ||
      providerCode === "invalid_credentials" ||
      /invalid login credentials|invalid credentials/i.test(providerMessage)
    ) {
      safeMessage = "Email ou senha incorretos.";
      publicCode = "AUTH_INVALID_CREDENTIALS";
    } else if (
      providerCode === "email_not_confirmed" ||
      /email not confirmed|email.*not.*confirmed/i.test(providerMessage)
    ) {
      safeMessage = "Confirme seu email antes de entrar.";
      publicCode = "AUTH_EMAIL_NOT_CONFIRMED";
    } else if (providerCode === "user_already_exists" || /already registered|already exists/i.test(providerMessage)) {
      safeMessage = "Esse email ja tem uma conta. Faca login ou use outro email.";
      publicCode = "AUTH_USER_EXISTS";
    } else if (/invalid email|email address is invalid/i.test(providerMessage)) {
      safeMessage = "Digite um email valido.";
      publicCode = "AUTH_INVALID_EMAIL";
    } else if (/password.*(weak|short)|weak password/i.test(providerMessage)) {
      safeMessage = "Use uma senha mais forte, com pelo menos 12 caracteres.";
      publicCode = "AUTH_WEAK_PASSWORD";
    } else if (/email.*(rate|send|deliver)|smtp|mail provider/i.test(providerMessage)) {
      safeMessage = "Nao conseguimos enviar o email de confirmacao agora. Tente novamente mais tarde.";
      publicCode = "AUTH_EMAIL_DELIVERY_FAILED";
    } else if (operation === "login" && response.status === 400) {
      // Keep login failures useful without exposing whether an email exists
      // or returning the provider's raw response to the browser.
      safeMessage = "Confira seu email e senha. Se a conta foi criada agora, confirme o email recebido antes de entrar.";
      publicCode = "AUTH_LOGIN_REJECTED";
    }
    const error = new Error(safeMessage);
    error.status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
    error.userSafe = true;
    error.providerCode = providerCode || null;
    error.publicCode = publicCode;
    throw error;
  }
  return payload || {};
}

export async function getRequiredCookieSession(req, res) {
  const session = await getCookieSession(req, res);
  if (!session?.user || !session.accessToken) {
    const error = new Error("Sessao invalida ou expirada.");
    error.status = 401;
    error.userSafe = true;
    throw error;
  }
  return session;
}

export async function loginWithPassword(res, input) {
  const response = await supabaseAuthRequest("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
  const payload = await readProviderResponse(response, { operation: "login" });
  setAuthCookies(res, payload);
  return { user: payload.user || null };
}

export async function signupWithPassword(res, input) {
  const response = await supabaseAuthRequest("signup", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        name: input.name,
        lgpd_consent: true,
        lgpd_consent_at: new Date().toISOString(),
        marketing_opt_in: input.marketingOptIn,
        ...(input.referralCode ? { referral_code: input.referralCode } : {}),
      },
    }),
  });
  const payload = await readProviderResponse(response);
  if (payload.access_token && payload.refresh_token) setAuthCookies(res, payload);
  return {
    user: payload.user || null,
    requiresEmailConfirmation: !payload.access_token,
  };
}

export async function resendSignupEmail(input) {
  const response = await supabaseAuthRequest("resend", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email: input.email }),
  });
  await readProviderResponse(response);
}

export async function updateAuthenticatedUser(req, res, payload) {
  const session = await getRequiredCookieSession(req, res);
  const response = await supabaseAuthRequest("user", {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(payload),
  });
  const user = await readProviderResponse(response);
  return { user };
}

export async function logoutAuthenticatedUser(req, res, scope = "local") {
  const session = await getCookieSession(req, res);
  if (session?.accessToken) {
    await supabaseAuthRequest(`logout?scope=${encodeURIComponent(scope)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => {});
  }
  if (scope !== "others") clearAuthCookies(res);
}
