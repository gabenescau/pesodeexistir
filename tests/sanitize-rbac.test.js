import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  sanitizePlainText,
  sanitizeSingleLine,
  validateStrongPassword,
} from "../src/lib/sanitize.js";
import {
  hasPermission,
  normalizeRole,
  PERMISSIONS,
  ROLES,
} from "../src/lib/rbac.js";

test("sanitizacao remove markup, controles e quebra indevida", () => {
  assert.equal(
    sanitizePlainText("  <script>\u0000alert(1)</script>\nTexto  ", 100),
    "scriptalert(1)/script\nTexto"
  );
  assert.equal(sanitizeSingleLine("  Titulo\n malicioso  ", 100), "Titulo malicioso");
  assert.equal(normalizeEmail("  Pessoa@EXAMPLE.COM\n"), "pessoa@example.com");
});

test("senha forte exige comprimento e diversidade", () => {
  assert.equal(validateStrongPassword("Senha-Forte-2026!"), "Senha-Forte-2026!");
  assert.throws(() => validateStrongPassword("123456"), /entre 12 e 128/);
  assert.throws(() => validateStrongPassword("senhasemnumero!"), /maiuscula/);
});

test("RBAC separa conteudo de cobranca e usuarios", () => {
  assert.equal(normalizeRole("desconhecido"), ROLES.USER);
  assert.equal(hasPermission(ROLES.EDITOR, PERMISSIONS.MANAGE_CONTENT), true);
  assert.equal(hasPermission(ROLES.EDITOR, PERMISSIONS.MANAGE_BILLING), false);
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_USERS), true);
});
