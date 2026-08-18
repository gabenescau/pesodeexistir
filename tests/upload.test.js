import test from "node:test";
import assert from "node:assert/strict";
import { parseUploadInput } from "../server/upload.js";

test("upload ticket accepts a bounded image policy", () => {
  const result = parseUploadInput({
    bucket: "avatars",
    kind: "avatar",
    fileName: "perfil.png",
    fileType: "image/png",
    fileSize: 1024,
  });

  assert.equal(result.bucket, "avatars");
  assert.equal(result.fileType, "image/png");
  assert.equal(result.fileSize, 1024);
});

test("upload ticket accepts product images in the shop media bucket", () => {
  const result = parseUploadInput({
    bucket: "shop-media",
    kind: "product-image",
    fileName: "camisa.webp",
    fileType: "image/webp",
    fileSize: 1024,
  });

  assert.equal(result.bucket, "shop-media");
  assert.equal(result.kind, "product-image");
});

test("upload ticket rejects path traversal and oversized files", () => {
  assert.throws(
    () => parseUploadInput({
      bucket: "post-media",
      kind: "post-image",
      fileName: "../payload.png",
      fileType: "image/png",
      fileSize: 1024,
    }),
    /nome de arquivo invalido/i,
  );

  assert.throws(
    () => parseUploadInput({
      bucket: "avatars",
      kind: "avatar",
      fileName: "perfil.png",
      fileType: "image/png",
      fileSize: 3 * 1024 * 1024,
    }),
    /tamanho de arquivo nao permitido/i,
  );
});

test("upload ticket does not allow a client to choose an unrelated bucket kind", () => {
  assert.throws(
    () => parseUploadInput({
      bucket: "pdfs",
      kind: "avatar",
      fileName: "arquivo.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    }),
    /tipo de upload nao permitido/i,
  );
});
