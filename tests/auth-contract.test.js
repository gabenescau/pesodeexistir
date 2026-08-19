import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProfileUpdateBody,
  parseSignupBody,
  readProviderResponse,
} from "../server/auth.js";

async function rejectsWithMessage(response, message) {
  await assert.rejects(
    () => readProviderResponse(response),
    (error) => error?.message === message && error?.userSafe === true,
  );
}

test("profile updates accept only profile fields", () => {
  const payload = parseProfileUpdateBody({
    name: "Ray",
    username: "ray_01",
    bio: "Leitura e comunidade",
    role: "admin",
    credits: 999999,
    xp: 999999,
    updated_at: "forged",
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    "bio",
    "name",
    "updated_at",
    "username",
  ]);
  assert.equal(payload.role, undefined);
  assert.equal(payload.credits, undefined);
  assert.notEqual(payload.updated_at, "forged");
});

test("profile updates reject an invalid username", () => {
  assert.throws(
    () => parseProfileUpdateBody({ username: "Ray Name!" }),
    /Nome de usuario invalido/,
  );
});

test("signup input is bounded and normalized", () => {
  const payload = parseSignupBody({
    name: "  Ray  ",
    email: "RAY@EXAMPLE.COM",
    password: "a-secure-password-123",
    referralCode: "  invite_01  ",
    marketingOptIn: true,
    role: "admin",
  });

  assert.deepEqual(payload, {
    name: "Ray",
    email: "ray@example.com",
    password: "a-secure-password-123",
    referralCode: "invite_01",
    marketingOptIn: true,
  });
});

test("login errors expose a safe invalid-credentials message", async () => {
  await rejectsWithMessage(
    new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }),
    "Email ou senha incorretos.",
  );
});

test("unconfirmed accounts receive the confirmation guidance", async () => {
  await rejectsWithMessage(
    new Response(JSON.stringify({ error: "email_not_confirmed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }),
    "Confirme seu email antes de entrar.",
  );
});

test("unknown login rejection remains actionable without exposing provider data", async () => {
  await assert.rejects(
    () => readProviderResponse(
      new Response(JSON.stringify({ error: "unexpected_auth_error", details: "internal provider detail" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      { operation: "login" },
    ),
    (error) => {
      assert.equal(error.message, "Confira seu email e senha. Se a conta foi criada agora, confirme o email recebido antes de entrar.");
      assert.equal(error.publicCode, "AUTH_LOGIN_REJECTED");
      assert.equal(error.message.includes("internal provider detail"), false);
      return true;
    },
  );
});
