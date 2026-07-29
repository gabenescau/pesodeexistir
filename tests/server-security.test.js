import test from "node:test";
import assert from "node:assert/strict";
import { allowPost, requireUuid, sendError } from "../server/supabase.js";

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("IDs de recursos precisam ser UUIDs validos", () => {
  assert.equal(
    requireUuid("589c9303-e4bf-4c91-8897-ba5cbc6854e6"),
    "589c9303-e4bf-4c91-8897-ba5cbc6854e6"
  );
  assert.throws(() => requireUuid("../admin", "userId"), /userId invalido/);
});

test("API rejeita metodo e payload acima do limite", () => {
  const methodResponse = responseMock();
  assert.equal(allowPost({ method: "GET", headers: {} }, methodResponse), false);
  assert.equal(methodResponse.statusCode, 405);

  const largeResponse = responseMock();
  assert.equal(
    allowPost({
      method: "POST",
      headers: { "content-length": String(40 * 1024) },
    }, largeResponse),
    false
  );
  assert.equal(largeResponse.statusCode, 413);
});

test("CORS aceita somente origens confiaveis e nunca devolve wildcard", () => {
  const trustedResponse = responseMock();
  assert.equal(
    allowPost({
      method: "OPTIONS",
      headers: { origin: "https://pesodeexistir.online" },
    }, trustedResponse),
    false
  );
  assert.equal(trustedResponse.statusCode, 204);
  assert.equal(
    trustedResponse.headers["Access-Control-Allow-Origin"],
    "https://pesodeexistir.online"
  );
  assert.notEqual(trustedResponse.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(trustedResponse.headers.Vary, "Origin");

  const hostileResponse = responseMock();
  assert.equal(
    allowPost({
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }, hostileResponse),
    false
  );
  assert.equal(hostileResponse.statusCode, 403);
  assert.equal(hostileResponse.headers["Access-Control-Allow-Origin"], undefined);
});

test("API bloqueia POST cross-site mesmo quando chamado diretamente", () => {
  const response = responseMock();
  assert.equal(
    allowPost({
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-length": "2",
      },
    }, response),
    false
  );
  assert.equal(response.statusCode, 403);
});

test("erro interno nao e devolvido ao navegador", () => {
  const response = responseMock();
  sendError(
    { requestId: "request-test" },
    response,
    new Error("Supabase: token=segredo tabela=privada"),
    "Erro interno"
  );

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error, "Erro interno");
  assert.equal(response.body.requestId, "request-test");
});
