import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  join(root, "supabase", "migrations", "20260821010000_restrict_engagement_reads.sql"),
  "utf8",
);

// O app le 100% desses dados via server (service_role, que bypassa RLS):
// nenhum `.from()` direto existe em src/. Fechar o SELECT direto impede que
// qualquer conta autenticada raspe quem curtiu/votou/segiu o que.
for (const table of ["post_likes", "post_poll_votes", "follows", "reactions"]) {
  test(`${table}: leitura direta restrita ao proprio usuario`, () => {
    assert.match(migration, new RegExp(`ON public\\.${table}`));
    assert.match(migration, /FOR SELECT TO authenticated/);
  });
}

test("migration nao concede SELECT a anon nas tabelas de engajamento", () => {
  assert.doesNotMatch(migration, /TO authenticated, anon/);
  assert.doesNotMatch(migration, /USING \(true\)/);
});
