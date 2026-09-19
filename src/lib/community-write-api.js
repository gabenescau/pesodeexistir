import { authenticatedApiPost } from "./authenticated-api";

export function communityWrite(operation, payload = {}) {
  return authenticatedApiPost("/api/auth?action=community-write", {
    operation,
    ...payload,
  });
}
