import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const uploadsSource = readFileSync(join(root, "api", "uploads.js"), "utf8");

test("uploads aplica rate-limit por usuario antes de processar o arquivo", () => {
  assert.match(uploadsSource, /enforceRateLimit/);
  assert.match(uploadsSource, /scope: "uploads"/);
  // O rate-limit precisa vir antes do formData: rejeitar antes de alocar
  // dezenas de MB em memoria.
  assert.ok(
    uploadsSource.indexOf("enforceRateLimit") < uploadsSource.indexOf("formData"),
    "rate-limit deve preceder formData",
  );
});
