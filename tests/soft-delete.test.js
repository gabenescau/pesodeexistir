import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  join(root, "supabase", "migrations", "20260821000000_soft_delete_books_authors.sql"),
  "utf8",
);
const adminSource = readFileSync(join(root, "server", "admin.js"), "utf8");
const catalogSource = readFileSync(join(root, "server", "catalog.js"), "utf8");

test("migration cria deleted_at em books e authors com indices", () => {
  assert.match(migration, /ALTER TABLE public\.books\s+ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.match(migration, /ALTER TABLE public\.authors\s+ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_books_deleted_at/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_authors_deleted_at/);
});

test("migration restringe leitura publica a nao-deletados", () => {
  assert.match(migration, /"books_read"/);
  assert.match(migration, /"authors_read"/);
  assert.match(migration, /deleted_at IS NULL/);
});

test("book-delete e author-delete usam soft-delete (UPDATE deleted_at)", () => {
  const bookDelete = adminSource.match(/case "book-delete": \{[\s\S]*?return \{[^}]*\};\s*\}/);
  assert.ok(bookDelete, "bloco book-delete nao encontrado");
  assert.match(bookDelete[0], /deleted_at/);
  assert.doesNotMatch(bookDelete[0], /method: "DELETE"/);

  const authorDelete = adminSource.match(/case "author-delete": \{[\s\S]*?return \{[^}]*\};\s*\}/);
  assert.ok(authorDelete, "bloco author-delete nao encontrado");
  assert.match(authorDelete[0], /deleted_at/);
  assert.doesNotMatch(authorDelete[0], /method: "DELETE"/);
});

test("existem operacoes de restore para livros e autores", () => {
  assert.match(adminSource, /"book-restore"/);
  assert.match(adminSource, /"author-restore"/);
});

test("catalogo publico filtra soft-deletados no servidor", () => {
  assert.match(catalogSource, /deleted_at=is\.null/);
});
