import { supabase } from "@/app/data/supabase";

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.requestId = payload?.requestId || null;
  }
}

async function getAccessToken() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) {
    throw new ApiError("Sua sessao expirou. Entre novamente.", 401);
  }
  return accessToken;
}

export async function authenticatedApiRequest(path, {
  method = "GET",
  body,
  signal,
} = {}) {
  const accessToken = await getAccessToken();
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const request = {
    method,
    headers,
    signal,
  };
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    request.body = JSON.stringify(body);
  }

  const response = await fetch(path, request);

  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null);
  if (!response.ok || (payload && payload.success === false)) {
    throw new ApiError(
      payload?.error || "Nao foi possivel concluir a operacao.",
      response.status,
      payload
    );
  }
  return payload?.success === true ? payload.data : payload;
}

export async function authenticatedApiPost(path, payload, options = {}) {
  return authenticatedApiRequest(path, {
    ...options,
    method: "POST",
    body: payload,
  });
}
