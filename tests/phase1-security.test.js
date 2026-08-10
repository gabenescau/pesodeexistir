import test from "node:test";
import assert from "node:assert/strict";
import {
  checkoutIdempotencyKey,
  getCheckoutAttemptConflict,
} from "../server/stripe.js";
import { clearPendingPlanMetadata } from "../server/stripe-sync.js";
import { runSupabaseQueryAll } from "../src/lib/supabase-query.js";

test("checkout idempotency is stable for the same attempt and distinct across attempts", () => {
  const first = checkoutIdempotencyKey("user-1", "leitor-monthly", "CARD", "attempt-aaaaaaaaaaaa");
  const same = checkoutIdempotencyKey("user-1", "leitor-monthly", "CARD", "attempt-aaaaaaaaaaaa");
  const second = checkoutIdempotencyKey("user-1", "leitor-monthly", "CARD", "attempt-bbbbbbbbbbbb");

  assert.equal(first, same);
  assert.notEqual(first, second);
  assert.match(first, /^ope-checkout-user-1-leitor-monthly-CARD-/);
});

test("checkout attempt conflict rejects another user and a different plan", () => {
  const attempt = {
    user_id: "user-a",
    plan_key: "leitor-monthly",
    payment_method: "CARD",
  };

  assert.equal(
    getCheckoutAttemptConflict(attempt, {
      userId: "user-b",
      planKey: "leitor-monthly",
      paymentMethod: "CARD",
    }),
    "forbidden"
  );
  assert.equal(
    getCheckoutAttemptConflict(attempt, {
      userId: "user-a",
      planKey: "pensador-monthly",
      paymentMethod: "CARD",
    }),
    "pending_conflict"
  );
  assert.equal(
    getCheckoutAttemptConflict(attempt, {
      userId: "user-a",
      planKey: "leitor-monthly",
      paymentMethod: "CARD",
    }),
    null
  );
});

test("pending plan metadata is cleared after an applied or expired update", () => {
  assert.deepEqual(
    clearPendingPlanMetadata({
      requested_plan: "pensador-annual",
      change_mode: "upgrade",
      changed_at: "2026-08-10T00:00:00.000Z",
      previous_plan: "leitor-monthly",
      changed_by: "user-a",
    }),
    { previous_plan: "leitor-monthly", changed_by: "user-a" }
  );
});

test("bounded Supabase pagination does not load unlimited rows", async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ id: `row-${index}` }));
  let requests = 0;
  const result = await runSupabaseQueryAll(
    () => ({
      range(from, to) {
        requests += 1;
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      },
    }),
    "bounded test",
    { pageSize: 3, maxRows: 5, maxPages: 10, retries: 0 }
  );

  assert.equal(result.data.length, 5);
  assert.equal(result.truncated, true);
  assert.equal(requests, 2);
});
