import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProfileUpdateBody,
  parseSignupBody,
} from "../server/auth.js";

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
