import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlanByKey,
} from "../server/plans.js";

test("catalogo decide preco e ciclo no servidor", () => {
  assert.equal(getPlanByKey("leitor-monthly")?.price, 1900);
  assert.equal(getPlanByKey("leitor-annual")?.price, 19000);
  assert.equal(getPlanByKey("pensador-monthly")?.price, 2900);
  assert.equal(getPlanByKey("pensador-annual")?.price, 22800);
  assert.equal(getPlanByKey("leitor-monthly")?.cycle, "MONTHLY");
  assert.equal(getPlanByKey("pensador-annual")?.cycle, "ANNUALLY");
  assert.equal(getPlanByKey("monthly")?.key, "leitor-monthly");
  assert.equal(getPlanByKey("ope_club_annual")?.key, "leitor-annual");
  assert.equal(getPlanByKey("plano-inventado"), null);
});
