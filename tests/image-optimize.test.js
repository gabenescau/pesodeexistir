import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_OPTIMIZE_PRESETS,
  buildOptimizedFileName,
  shouldOptimizeImage,
} from "../src/lib/image-optimize.js";

test("avatar preset limita em 512px com qualidade webp 0.82", () => {
  assert.equal(IMAGE_OPTIMIZE_PRESETS.avatar.maxDimension, 512);
  assert.equal(IMAGE_OPTIMIZE_PRESETS.avatar.quality, 0.82);
});

test("capa de livro e foto de autor usam 1024px; post usa 1600px", () => {
  assert.equal(IMAGE_OPTIMIZE_PRESETS["book-cover"].maxDimension, 1024);
  assert.equal(IMAGE_OPTIMIZE_PRESETS["author-photo"].maxDimension, 1024);
  assert.equal(IMAGE_OPTIMIZE_PRESETS["post-image"].maxDimension, 1600);
});

test("shouldOptimizeImage pula pdf, gif animado e webp pequeno (antigos intactos)", () => {
  assert.equal(
    shouldOptimizeImage({ type: "application/pdf", size: 1024, kind: "book-pdf" }),
    false,
  );
  assert.equal(
    shouldOptimizeImage({ type: "image/gif", size: 500_000, kind: "post-image" }),
    false,
  );
  assert.equal(
    shouldOptimizeImage({ type: "image/webp", size: 50_000, kind: "avatar" }),
    false,
  );
});

test("shouldOptimizeImage otimiza jpg/png grandes de avatar e capa", () => {
  assert.equal(
    shouldOptimizeImage({ type: "image/jpeg", size: 800_000, kind: "avatar" }),
    true,
  );
  assert.equal(
    shouldOptimizeImage({ type: "image/png", size: 2_000_000, kind: "book-cover" }),
    true,
  );
});

test("buildOptimizedFileName troca extensao para .webp e sanitiza", () => {
  assert.equal(buildOptimizedFileName("Minha Foto.JPG"), "minha-foto.webp");
  assert.equal(buildOptimizedFileName("../capa#.PNG"), "capa.webp");
});
