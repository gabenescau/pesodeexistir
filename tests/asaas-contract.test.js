import test from "node:test";
import assert from "node:assert/strict";
import { parseAsaasPixInput } from "../src/lib/api-contracts.js";

test("Pix checkout accepts a valid CPF and bounded plan input", () => {
  const result = parseAsaasPixInput({
    plan: "leitor-monthly",
    attemptId: "checkout-1234567890",
    name: "Pessoa Leitora",
    email: "PESSOA@EXAMPLE.COM",
    cpfCnpj: "529.982.247-25",
  });

  assert.deepEqual(result, {
    plan: "leitor-monthly",
    attemptId: "checkout-1234567890",
    name: "Pessoa Leitora",
    email: "pessoa@example.com",
    cpfCnpj: "52998224725",
  });
});

test("Pix checkout rejects an invalid document and unknown plan", () => {
  assert.throws(
    () => parseAsaasPixInput({
      plan: "leitor-monthly",
      name: "Pessoa Leitora",
      email: "pessoa@example.com",
      cpfCnpj: "111.111.111-11",
    }),
    /CPF ou CNPJ invalido/i,
  );
  assert.throws(
    () => parseAsaasPixInput({
      plan: "pensador-weekly",
      name: "Pessoa Leitora",
      email: "pessoa@example.com",
      cpfCnpj: "52998224725",
    }),
    /Plano invalido/i,
  );
});
