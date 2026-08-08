import test from "node:test";
import assert from "node:assert/strict";
import {
  storagePathFromPublicUrl,
  validateAvatarFile,
  validateProfileInput,
} from "../src/lib/profile.js";

test("normaliza somente campos publicos permitidos do perfil", () => {
  assert.deepEqual(
    validateProfileInput({ name: "  Raynan  ", handle: "Ray_Nan", bio: "  Leitor  " }),
    { name: "Raynan", handle: "ray_nan", bio: "Leitor" }
  );
});

test("rejeita handle e avatar inseguros", () => {
  assert.throws(
    () => validateProfileInput({ name: "Nome", handle: "admin!", bio: "" }),
    /O @ precisa/
  );
  assert.throws(
    () => validateAvatarFile({ size: 100, type: "image/svg+xml" }),
    /JPG, PNG ou WebP/
  );
});

test("extrai apenas caminho de URL publica do bucket esperado", () => {
  const url = "https://project.supabase.co/storage/v1/object/public/avatars/user/avatar.webp";
  assert.equal(storagePathFromPublicUrl(url, "avatars"), "user/avatar.webp");
  assert.equal(storagePathFromPublicUrl(url, "covers"), null);
});
