import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminSuggestionInput,
  parseCheckoutInput,
  parseSubscriptionIdInput,
  parseSubscriptionInput,
  parseSuggestionLikeInput,
} from "../src/lib/api-contracts.js";
import { getSubscriptionEntitlement, hasActiveSubscription } from "../server/domains/billing.js";
import { normalizeAuthors, normalizeBooks } from "../src/app/data/domains/catalog.js";
import { buildPostViewModels } from "../src/app/data/domains/community.js";

test("checkout contract accepts only bounded server-facing fields", () => {
  assert.deepEqual(
    parseCheckoutInput({
      plan: "leitor-monthly",
      paymentMethod: "PIX",
      attemptId: "attempt-123456789012",
    }),
    {
      plan: "leitor-monthly",
      paymentMethod: "PIX",
      attemptId: "attempt-123456789012",
    }
  );
  assert.throws(
    () => parseCheckoutInput({ plan: "leitor-monthly", paymentMethod: "PIX", attemptId: "x" }),
    (error) => error.status === 400 && error.userSafe === true
  );
});

test("subscription contract normalizes action input without trusting frontend extras", () => {
  assert.deepEqual(
    parseSubscriptionInput({ subscriptionId: "123e4567-e89b-12d3-a456-426614174000", plan: "pensador-annual" }),
    { subscriptionId: "123e4567-e89b-12d3-a456-426614174000", plan: "pensador-annual" }
  );
  assert.throws(() => parseSubscriptionInput({ subscriptionId: "not-an-id", plan: "pensador-annual" }));
});

test("admin suggestion contract rejects arbitrary columns and actions", () => {
  assert.deepEqual(
    parseAdminSuggestionInput({ action: "move", suggestionId: "123e4567-e89b-12d3-a456-426614174000", status: "building" }),
    { action: "move", suggestionId: "123e4567-e89b-12d3-a456-426614174000", status: "building" }
  );
  assert.throws(() => parseAdminSuggestionInput({ action: "move", suggestionId: "123e4567-e89b-12d3-a456-426614174000", status: "admin" }));
});

test("cancellation contract accepts only the explicit immediate flag", () => {
  assert.deepEqual(
    parseSubscriptionIdInput({ subscriptionId: "123e4567-e89b-12d3-a456-426614174000", immediate: "true" }),
    { subscriptionId: "123e4567-e89b-12d3-a456-426614174000", immediate: false }
  );
  assert.deepEqual(
    parseSubscriptionIdInput({ subscriptionId: "123e4567-e89b-12d3-a456-426614174000", immediate: true }),
    { subscriptionId: "123e4567-e89b-12d3-a456-426614174000", immediate: true }
  );
});

test("billing domain derives access from status and period, not client flags", () => {
  const now = Date.parse("2026-08-10T12:00:00.000Z");
  assert.equal(hasActiveSubscription([
    { status: "active", current_period_end: "2026-08-11T12:00:00.000Z" },
  ], now), true);
  assert.equal(hasActiveSubscription([
    { status: "active", current_period_end: "2026-08-10T11:59:59.000Z" },
  ], now), false);
  assert.deepEqual(
    getSubscriptionEntitlement({ plan: "pensador-annual", status: "active", current_period_end: "2026-08-11T12:00:00.000Z" }, now),
    { active: true, plan: { key: "pensador-annual", plan: "ope_club_pensador_annual", tier: "pensador", tierLabel: "Plano Pensador", externalId: "ope_club_pensador_annual_subscription_v1", name: "Plano Pensador Anual", price: 22800, durationDays: 365, description: "Assinatura anual do Plano Pensador do OPE Club", cycle: "ANNUALLY", priceEnv: "STRIPE_PRICE_PENSADOR_ANNUAL" } }
  );
});

test("catalog domain normalizes legacy assets without changing database rows", () => {
  const books = normalizeBooks([
    { id: "book-1", title: "Livro", author_id: "author-1", image_path: "covers/book-1.webp", pdf_path: "pdf/book-1.pdf" },
  ], {
    coverUrlMap: new Map([["covers/book-1.webp", "https://signed.example/book-1.webp"]]),
    localBooks: [],
  });
  assert.equal(books[0].image, "https://signed.example/book-1.webp");
  assert.equal(books[0].pdfFile, "pdf/book-1.pdf");
  assert.equal(books[0].authorId, "author-1");

  const authors = normalizeAuthors([
    { id: "author-1", name: "Autora", image: "autora.webp", image_path: null },
  ], { localAuthors: [] });
  assert.equal(authors[0].image, "/autores/autora.webp");
});

test("community domain derives post interactions without trusting client counters", () => {
  const [post] = buildPostViewModels([
    { id: "post-1", user_id: "user-1", text: "Ola", book_id: "book-1", image_paths: [], likes: 999 },
  ], {
    profiles: [{ id: "user-1", name: "Leitor", username: "leitor", role: "admin" }],
    books: [{ id: "book-1", title: "Livro", authors: { name: "Autora" } }],
    likes: [{ post_id: "post-1", user_id: "user-2" }],
    currentUserId: "user-2",
  });
  assert.equal(post.likes, 1);
  assert.equal(post.likedByMe, true);
  assert.equal(post.verified, true);
  assert.equal(post.book.author, "Autora");
});

test("suggestion like contract accepts only a UUID resource id", () => {
  assert.deepEqual(
    parseSuggestionLikeInput({ suggestionId: "123e4567-e89b-12d3-a456-426614174000", ignored: "client-data" }),
    { suggestionId: "123e4567-e89b-12d3-a456-426614174000" }
  );
  assert.throws(() => parseSuggestionLikeInput({ suggestionId: "suggestion-1" }));
});
