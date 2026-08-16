import test from "node:test";
import assert from "node:assert/strict";
import { parseProgressBody } from "../server/reading.js";

const BOOK_ID = "bbe6bc2f-7c97-4684-ab3a-943385ae514c";

test("reading progress derives the percentage on the server", () => {
  assert.deepEqual(parseProgressBody({
    bookId: BOOK_ID,
    currentPage: 25,
    totalPages: 100,
  }), {
    bookId: BOOK_ID,
    currentPage: 25,
    totalPages: 100,
    progress: 25,
  });
});

test("reading progress rejects a page outside the book", () => {
  assert.throws(
    () => parseProgressBody({
      bookId: BOOK_ID,
      currentPage: 101,
      totalPages: 100,
    }),
    /pagina atual nao pode ultrapassar/i,
  );
});

test("completion is authoritative and cannot be claimed for another id", () => {
  assert.equal(parseProgressBody({
    bookId: BOOK_ID,
    currentPage: 1,
    totalPages: 165,
    completed: true,
  }).progress, 100);
  assert.throws(
    () => parseProgressBody({
      bookId: "not-a-uuid",
      completed: true,
    }),
    /livro invalido/i,
  );
});
