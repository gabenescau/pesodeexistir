import test from "node:test";
import assert from "node:assert/strict";
import {
  createAbacateSignature,
  safeCompare,
  verifyAbacateSignature,
} from "../server/webhook-security.js";

test("aceita apenas a assinatura HMAC do corpo exato", () => {
  const body = JSON.stringify({
    id: "log_test",
    event: "checkout.completed",
    data: { id: "bill_test" },
  });
  const signature = createAbacateSignature(body);

  assert.equal(verifyAbacateSignature(body, signature), true);
  assert.equal(verifyAbacateSignature(`${body} `, signature), false);
  assert.equal(verifyAbacateSignature(body, ""), false);
});

test("comparacao segura rejeita valores de tamanhos diferentes", () => {
  assert.equal(safeCompare("abc", "abc"), true);
  assert.equal(safeCompare("abc", "abcd"), false);
});
