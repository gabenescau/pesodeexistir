import { authenticatedApiRequest } from "./authenticated-api";

export function loadRetrospective() {
  return authenticatedApiRequest("/api/auth?action=retrospective");
}
