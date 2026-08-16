import { authenticatedApiRequest } from "./authenticated-api";

export function loadAccountState() {
  return authenticatedApiRequest("/api/auth?action=account-state");
}
