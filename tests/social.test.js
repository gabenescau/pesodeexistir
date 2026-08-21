import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedProfile } from "../src/lib/social.js";

test("only explicit backend verification renders the badge", () => {
  assert.equal(isVerifiedProfile({ verified: true }), true);
  assert.equal(isVerifiedProfile({ is_verified: "true" }), true);
  assert.equal(isVerifiedProfile({ verified: "false" }), false);
  assert.equal(isVerifiedProfile({ is_verified: false }), false);
  assert.equal(isVerifiedProfile({ role: "user" }), false);
  assert.equal(isVerifiedProfile({ role: "admin" }), true);
});
