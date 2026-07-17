import test from "node:test";
import assert from "node:assert/strict";

import {
  countQuotedOccurrences,
  derivePayloadId,
  normalizeQuoteDecision,
} from "../lib/verses.mjs";

test("merge adjacent quoted verse ranges and count occurrences once per merged verse", () => {
  const decision = normalizeQuoteDecision({
    book: "1 Corinthians",
    chapter: 13,
    quotedVerses: ["1 Corinthians 13:4-5", "1 Corinthians 13:6-7"],
  });

  assert.deepEqual(decision.references, ["1 Corinthians 13:4-7"]);
  assert.equal(decision.occurrenceCount, 4);
  assert.equal(countQuotedOccurrences([{ verseKeys: decision.verseKeys }]), 4);
});

test("reject quoted verse runs over eight consecutive verses", () => {
  assert.throws(
    () =>
      normalizeQuoteDecision({
        book: "1 Corinthians",
        chapter: 13,
        quotedVerses: ["1 Corinthians 13:1-9"],
      }),
    /eight consecutive verses/
  );
});

test("reject malformed or cross-chapter declarations", () => {
  assert.throws(
    () =>
      normalizeQuoteDecision({
        book: "1 Corinthians",
        chapter: 13,
        quotedVerses: ["1 Corinthians 14:1-2"],
      }),
    /does not match chapter 13/
  );
});

test("derive stable ids from the suggestion path", () => {
  const first = derivePayloadId({
    kind: "question_seed",
    book: "1 Corinthians",
    chapter: 13,
    suggestionPath: "suggestions/demo-id",
  });
  const second = derivePayloadId({
    kind: "question_seed",
    book: "1 Corinthians",
    chapter: 13,
    suggestionPath: "suggestions/demo-id",
  });
  const hook = derivePayloadId({
    kind: "memory_hook",
    book: "2 Corinthians",
    chapter: 5,
    suggestionPath: "suggestions/hook-id",
  });

  assert.equal(first, second);
  assert.match(first, /^1cor13-sug-[a-f0-9]{12}$/);
  assert.match(hook, /^mh-2cor5-[a-f0-9]{12}$/);
});
