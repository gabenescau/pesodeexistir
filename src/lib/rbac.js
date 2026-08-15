export const ROLES = Object.freeze({
  ADMIN: "admin",
  EDITOR: "editor",
  USER: "user",
});

export const PERMISSIONS = Object.freeze({
  MANAGE_BILLING: "billing:manage",
  MANAGE_USERS: "users:manage",
  MANAGE_CONTENT: "content:manage",
  MANAGE_SUGGESTIONS: "suggestions:manage",
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: new Set(Object.values(PERMISSIONS)),
  [ROLES.EDITOR]: new Set([
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.MANAGE_SUGGESTIONS,
  ]),
  [ROLES.USER]: new Set(),
});

export function normalizeRole(value) {
  return Object.values(ROLES).includes(value) ? value : ROLES.USER;
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[normalizeRole(role)].has(permission);
}
