import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => pathToFileURL(path.join(__dirname, "..", "src", name)).href;

const {
  buildReaderUrl,
  chapterReference,
  getReaderWeek,
  nextChapter,
  parseReaderSearch,
  parseReference,
  previousChapter,
} = await import(src("reader-route.js"));

test("parseReference accepts named references, ranges, and api ids", () => {
  assert.deepEqual(parseReference("1 Corinthians 3"), {
    book: "1 Corinthians",
    bookApi: "1CO",
    chapter: 3,
  });
  assert.deepEqual(parseReference("2 Corinthians 5:1-10"), {
    book: "2 Corinthians",
    bookApi: "2CO",
    chapter: 5,
  });
  assert.deepEqual(parseReference("1CO.3"), {
    book: "1 Corinthians",
    bookApi: "1CO",
    chapter: 3,
  });
  assert.deepEqual(parseReference("1 Corinthians 1-2"), {
    book: "1 Corinthians",
    bookApi: "1CO",
    chapter: 1,
  });
});

test("parseReference rejects garbage and out-of-range chapters", () => {
  assert.equal(parseReference(""), null);
  assert.equal(parseReference("Romans 8"), null);
  assert.equal(parseReference("1 Corinthians 17"), null);
  assert.equal(parseReference("2CO.14"), null);
  assert.equal(parseReference("1 Corinthians nope"), null);
});

test("parseReaderSearch reads the ref query param", () => {
  assert.deepEqual(parseReaderSearch("?ref=2%20Corinthians%206"), {
    book: "2 Corinthians",
    bookApi: "2CO",
    chapter: 6,
  });
});

test("adjacent chapter navigation handles boundaries across both books", () => {
  assert.equal(previousChapter({ book: "1 Corinthians", bookApi: "1CO", chapter: 1 }), null);
  assert.deepEqual(nextChapter({ book: "1 Corinthians", bookApi: "1CO", chapter: 16 }), {
    book: "2 Corinthians",
    bookApi: "2CO",
    chapter: 1,
  });
  assert.deepEqual(previousChapter({ book: "2 Corinthians", bookApi: "2CO", chapter: 1 }), {
    book: "1 Corinthians",
    bookApi: "1CO",
    chapter: 16,
  });
  assert.equal(nextChapter({ book: "2 Corinthians", bookApi: "2CO", chapter: 13 }), null);
});

test("buildReaderUrl and chapterReference stay stable", () => {
  assert.equal(chapterReference("1 Corinthians", 7), "1 Corinthians 7");
  assert.equal(buildReaderUrl("1 Corinthians 7"), "reader.html?ref=1%20Corinthians%207");
});

test("getReaderWeek maps a chapter to the checkout week", () => {
  assert.deepEqual(getReaderWeek({ book: "1 Corinthians", bookApi: "1CO", chapter: 2 }), {
    bookApi: "1CO",
    chapters: [1, 2],
  });
  assert.deepEqual(getReaderWeek({ book: "2 Corinthians", bookApi: "2CO", chapter: 13 }), {
    bookApi: "2CO",
    chapters: [13],
  });
});
