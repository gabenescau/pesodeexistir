import test from "node:test";
import assert from "node:assert/strict";
import {
  getCheckoutProduct,
  getPlanByExternalId,
  getPlanByKey,
} from "../server/plans.js";
import { isFreshCheckoutReservation } from "../api/create-checkout.js";

test("catalogo decide preco e ciclo no servidor", () => {
  const monthly = getPlanByKey("monthly");
  assert.equal(monthly.price, 1900);
  assert.equal(monthly.cycle, "MONTHLY");
  const annual = getPlanByKey("annual");
  assert.equal(annual.price, 34800);
  assert.equal(annual.cycle, "ANNUALLY");
  assert.equal(getPlanByKey("plano-inventado"), null);
});

test("PIX usa produto avulso e cartao preserva recorrencia", () => {
  const annual = getPlanByKey("annual");
  const pix = getCheckoutProduct(annual, "PIX");
  const card = getCheckoutProduct(annual, "CARD");

  assert.equal(pix.cycle, null);
  assert.match(pix.externalId, /_pix_one_time$/);
  assert.equal(card.cycle, "ANNUALLY");
  assert.equal(getPlanByExternalId(pix.externalId)?.plan, annual.plan);
});

test("metodo desconhecido e rejeitado", () => {
  assert.throws(
    () => getCheckoutProduct(getPlanByKey("monthly"), "BOLETO"),
    /Metodo de pagamento invalido/
  );
});

test("reserva de checkout bloqueia requisicoes simultaneas e expira", () => {
  const now = Date.now();
  const reservation = {
    status: "pending",
    updated_at: new Date(now - 10_000).toISOString(),
    metadata: { checkout_creation_status: "creating" },
  };

  assert.equal(isFreshCheckoutReservation(reservation, now), true);
  assert.equal(
    isFreshCheckoutReservation({
      ...reservation,
      updated_at: new Date(now - 3 * 60_000).toISOString(),
    }, now),
    false
  );
});
