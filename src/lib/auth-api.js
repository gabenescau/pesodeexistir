export class AuthApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.payload = payload;
    this.code = payload?.code || null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "OPE-Auth",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method,
    credentials: "include",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new AuthApiError(
      payload?.error || "Nao foi possivel concluir a autenticacao.",
      response.status,
      payload
    );
  }
  return payload?.data ?? payload;
}

export const authApi = {
  async session() {
    try {
      return await request("/api/auth?action=session");
    } catch (error) {
      if (error?.status === 401) {
        return null;
      }
      throw error;
    }
  },

  async login(email, password) {
    return request("/api/auth?action=login", {
      method: "POST",
      body: { email, password },
    });
  },

  async profile() {
    return request("/api/auth?action=profile");
  },

  async signup(input) {
    return request("/api/auth?action=signup", {
      method: "POST",
      body: input,
    });
  },

  async resendConfirmation(email) {
    return request("/api/auth?action=resend", {
      method: "POST",
      body: { email },
    });
  },

  async updateUser(payload) {
    return request("/api/auth?action=update-user", {
      method: "POST",
      body: payload,
    });
  },

  async updateProfile(payload) {
    return request("/api/auth?action=update-profile", {
      method: "POST",
      body: payload,
    });
  },

  async signOutOthers() {
    return request("/api/auth?action=logout-others", { method: "POST" });
  },

  async logout() {
    await request("/api/auth?action=logout", { method: "POST" });
  },
};
