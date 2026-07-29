const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase server env vars nao configuradas");
  }
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export async function getAuthenticatedUser(req) {
  requireConfig();
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Sessao obrigatoria");
    error.status = 401;
    throw error;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY,
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
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
  return true;
}
