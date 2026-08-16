import { authenticatedApiRequest, authenticatedApiPost } from "./authenticated-api";

export async function loadAdminBootstrap() {
  return authenticatedApiRequest("/api/admin-data", { method: "GET" });
}

export async function adminWrite(operation, payload = {}) {
  return authenticatedApiPost("/api/admin-data", { operation, payload });
}
