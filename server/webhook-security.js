import crypto from "node:crypto";

// Chave publica HMAC publicada na documentacao oficial da AbacatePay v2.
// Pode ser sobrescrita por env se a AbacatePay fizer rotacao.
export const DEFAULT_ABACATEPAY_WEBHOOK_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

export function safeCompare(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue));
  const right = Buffer.from(String(rightValue));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createAbacateSignature(rawBody, publicKey = DEFAULT_ABACATEPAY_WEBHOOK_PUBLIC_KEY) {
  return crypto
    .createHmac("sha256", publicKey)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
}

export function verifyAbacateSignature(
  rawBody,
  signature,
  publicKey = DEFAULT_ABACATEPAY_WEBHOOK_PUBLIC_KEY
) {
  if (!signature) return false;
  return safeCompare(signature, createAbacateSignature(rawBody, publicKey));
}
