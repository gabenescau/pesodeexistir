import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const phase3Path = new URL("../supabase/migrations/20260810300000_phase3_billing_concurrency.sql", import.meta.url);
const compatibilityPath = new URL("../supabase/migrations/20260810400000_phase4_schema_compatibility.sql", import.meta.url);
const suggestionLikesPath = new URL("../supabase/migrations/20260810500000_phase5_suggestion_likes.sql", import.meta.url);
const rewardsPath = new URL("../supabase/migrations/20260810600000_rewards_referrals_stock.sql", import.meta.url);

test("phase 3 migration prepares last_error before compiling webhook RPCs", async () => {
  const sql = await readFile(phase3Path, "utf8");
  const columnPosition = sql.indexOf("add column if not exists last_error");
  const functionPosition = sql.indexOf("create or replace function public.claim_stripe_webhook_event");
  assert.notEqual(columnPosition, -1);
  assert.ok(columnPosition < functionPosition);
  assert.match(sql, /create unique index if not exists stripe_webhook_events_event_id_uidx/);
});

test("compatibility migration is additive and supports the legacy error column", async () => {
  const sql = await readFile(compatibilityPath, "utf8");
  assert.match(sql, /add column if not exists last_error text/);
  assert.match(sql, /add column if not exists error_message text/);
  assert.match(sql, /where last_error is null/);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /truncate /i);
});

test("suggestion likes migration enforces one like per user and RLS ownership", async () => {
  const sql = await readFile(suggestionLikesPath, "utf8");
  assert.match(sql, /primary key \(suggestion_id, user_id\)/i);
  assert.match(sql, /suggestion_likes_insert_own/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /suggestion_like_counts/i);
});

test("rewards migration keeps wallet RPCs server-authoritative and stock transactional", async () => {
  const sql = await readFile(rewardsPath, "utf8");
  assert.match(sql, /alter function public\.wallet_state\(\) security definer/i);
  assert.match(sql, /shop_products_stock_nonnegative/i);
  assert.match(sql, /trg_reserve_shop_product_stock/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /trg_reward_referral_after_subscription/i);
  assert.match(sql, /s\.status = 'active'/i);
  assert.doesNotMatch(sql, /30 days/i);
});
