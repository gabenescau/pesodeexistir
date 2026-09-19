import { authenticatedApiRequest } from "./authenticated-api";

export async function loadMySubscriptions() {
  const data = await authenticatedApiRequest("/api/auth?action=subscription");
  return Array.isArray(data?.subscriptions) ? data.subscriptions : [];
}
