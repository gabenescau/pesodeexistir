import test from "node:test";
import assert from "node:assert/strict";
import { validateUploadMetadata } from "../server/upload.js";

test("upload metadata accepts a bounded avatar image policy", () => {
  const result = validateUploadMetadata({
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

test("upload metadata accepts product images in the shop media bucket", () => {
  const result = validateUploadMetadata({
    bucket: "shop-media",
    kind: "product-image",
    fileName: "camisa.webp",
    fileType: "image/webp",
    fileSize: 1024,
  });

  assert.equal(result.bucket, "shop-media");
  assert.equal(result.kind, "product-image");
});

test("upload metadata normalizes unsafe file names and rejects oversized files", () => {
  const result = validateUploadMetadata({
    bucket: "post-media",
    kind: "post-image",
    fileName: "../payload.png",
    fileType: "image/png",
    fileSize: 1024,
  });
  assert.match(result.fileName, /^payload\.png$/);

  assert.throws(
    () => validateUploadMetadata({
      bucket: "avatars",
      kind: "avatar",
      fileName: "perfil.png",
      fileType: "image/png",
      fileSize: 3 * 1024 * 1024,
    }),
    /tamanho de arquivo nao permitido/i,
  );
});

test("upload metadata does not allow a client to choose an unrelated bucket kind", () => {
  assert.throws(
    () => validateUploadMetadata({
      bucket: "pdfs",
      kind: "avatar",
      fileName: "arquivo.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    }),
    /tipo de upload nao permitido/i,
  );
});
