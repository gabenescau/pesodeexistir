import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogSource = readFileSync(join(root, "server", "catalog.js"), "utf8");

test("ordenacao de livros tem tiebreaker deterministico por id", () => {
  assert.match(catalogSource, /BOOK_ORDER = "created_at\.desc,id\.desc"/);
  assert.match(catalogSource, /order=\$\{BOOK_ORDER\}/);
});

test("ordenacao de autores tem tiebreaker deterministico por id", () => {
  assert.match(catalogSource, /AUTHOR_ORDER = "name\.asc,id\.asc"/);
  assert.match(catalogSource, /order=\$\{AUTHOR_ORDER\}/);
});
