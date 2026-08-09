import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlanByKey,
} from "../server/plans.js";

test("catalogo decide preco e ciclo no servidor", () => {
  const monthly = getPlanByKey("monthly");
  assert.equal(monthly.price, 1900);
  assert.equal(monthly.cycle, "MONTHLY");
  const annual = getPlanByKey("annual");
  assert.equal(annual.price, 34800);
  assert.equal(annual.cycle, "ANNUALLY");
  assert.equal(getPlanByKey("ope_club_monthly")?.key, "monthly");
  assert.equal(getPlanByKey("ope_club_annual")?.key, "annual");
  assert.equal(getPlanByKey("plano-inventado"), null);
});
