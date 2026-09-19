import { authenticatedApiPost } from "./authenticated-api";

export function accountWrite(operation, payload = {}) {
  return authenticatedApiPost("/api/auth?action=account-write", { operation, ...payload });
}
