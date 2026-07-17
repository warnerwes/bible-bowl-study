import test from "node:test";
import assert from "node:assert/strict";

import { projectArtifacts } from "../lib/export.mjs";

function baseManifest() {
  return {
    book: "1 & 2 Corinthians",
    bookSlug: "corinthians",
    testament: "NT",
    canonicalVerseCount: 694,
    translations: [
      {
        translation: "NKJV",
        rightsHolder: "Rights",
        quotedVerseLimit: 500,
        maxRatioOfWork: 0.25,
        maxRatioOfBook: 0.5,
        excludedUse: "Reference work",
        notice: "Notice",
        internalPolicy: {
          selfImposed: true,
          rationale: "reference-first",
          consecutiveVerseCap: 8,
        },
        quotedUses: [],
      },
    ],
  };
}

test("export projection is deterministic and removes the explicit placeholder it replaces", () => {
  const currentQuestions = [
    {
      id: "placeholder-1",
      queueItemIds: [],
      book: "1 Corinthians",
      bookSlug: "1cor",
      chapter: 13,
      reference: "1 Corinthians 13",
      topic: "Placeholder",
      type: "multiple-choice",
      question: "Synthetic placeholder",
      answer: "Synthetic answer",
      options: ["Synthetic answer", "Alt"],
      difficulty: "easy",
      roundFormat: "standard",
      reviewStatus: "draft",
      placeholder: true,
    },
  ];

  const reviewDocs = [
    {
      id: "s-1",
      status: "approved",
      createdAt: "2026-07-16T01:00:00.000Z",
      approvedAt: "2026-07-16T01:00:00.000Z",
      reviewedBy: "reviewer",
      payloadId: "1cor13-sug-abc123def456",
      replacesPlaceholderId: "placeholder-1",
      quoteDecision: { mode: "no-scripture-quote", verseKeys: [], references: [] },
      finalQuestion: {
        id: "1cor13-sug-abc123def456",
        queueItemIds: [],
        book: "1 Corinthians",
        bookSlug: "1cor",
        chapter: 13,
        reference: "1 Corinthians 13",
        topic: "Love",
        type: "multiple-choice",
        question: "Synthetic approved question",
        answer: "Synthetic answer",
        options: ["Synthetic answer", "Alt A", "Alt B", "Alt C"],
        difficulty: "medium",
        roundFormat: "standard",
        reviewStatus: "approved",
      },
    },
    {
      id: "s-2",
      status: "approved",
      createdAt: "2026-07-16T01:05:00.000Z",
      approvedAt: "2026-07-16T01:05:00.000Z",
      reviewedBy: "reviewer",
      payloadId: "mh-1cor13-fff111222333",
      quoteDecision: {
        mode: "quotes-verses",
        references: ["1 Corinthians 13:4-7"],
        verseKeys: ["1cor:13:4", "1cor:13:5", "1cor:13:6", "1cor:13:7"],
      },
      finalMemoryHook: {
        id: "mh-1cor13-fff111222333",
        book: "1 Corinthians",
        chapter: 13,
        reference: "1 Corinthians 13:4-7",
        text: "Synthetic hook",
        url: "https://example.com/hook",
      },
    },
  ];

  const first = projectArtifacts({
    currentQuestions,
    currentMemoryHooks: { schemaVersion: 1, books: {} },
    currentManifest: baseManifest(),
    reviewDocs,
  });
  const second = projectArtifacts({
    currentQuestions,
    currentMemoryHooks: { schemaVersion: 1, books: {} },
    currentManifest: baseManifest(),
    reviewDocs: [...reviewDocs].reverse(),
  });

  assert.deepEqual(first.questions, second.questions);
  assert.equal(first.questions.length, 1);
  assert.equal(first.questions[0].id, "1cor13-sug-abc123def456");
  assert.deepEqual(first.memoryHooks.books["1 Corinthians"]["13"][0], {
    id: "mh-1cor13-fff111222333",
    reference: "1 Corinthians 13:4-7",
    text: "Synthetic hook",
    url: "https://example.com/hook",
  });
  assert.deepEqual(first.exportableIds, ["s-1", "s-2"]);
});

test("export projection rejects conflicting duplicate payload ids", () => {
  const reviewDocs = [
    {
      id: "s-1",
      status: "approved",
      createdAt: "2026-07-16T01:00:00.000Z",
      payloadId: "1cor13-sug-conflict",
      quoteDecision: { mode: "no-scripture-quote", verseKeys: [], references: [] },
      finalQuestion: {
        id: "1cor13-sug-conflict",
        queueItemIds: [],
        book: "1 Corinthians",
        bookSlug: "1cor",
        chapter: 13,
        reference: "1 Corinthians 13",
        topic: "Love",
        type: "multiple-choice",
        question: "Synthetic one",
        answer: "A",
        options: ["A", "B"],
        difficulty: "easy",
        roundFormat: "standard",
        reviewStatus: "approved",
      },
    },
    {
      id: "s-2",
      status: "approved",
      createdAt: "2026-07-16T02:00:00.000Z",
      payloadId: "1cor13-sug-conflict",
      quoteDecision: { mode: "no-scripture-quote", verseKeys: [], references: [] },
      finalQuestion: {
        id: "1cor13-sug-conflict",
        queueItemIds: [],
        book: "1 Corinthians",
        bookSlug: "1cor",
        chapter: 13,
        reference: "1 Corinthians 13",
        topic: "Love",
        type: "multiple-choice",
        question: "Synthetic two",
        answer: "A",
        options: ["A", "B"],
        difficulty: "easy",
        roundFormat: "standard",
        reviewStatus: "approved",
      },
    },
  ];

  assert.throws(
    () =>
      projectArtifacts({
        currentQuestions: [],
        currentMemoryHooks: { schemaVersion: 1, books: {} },
        currentManifest: baseManifest(),
        reviewDocs,
      }),
    /conflicting content/
  );
});

test("export projection keeps surprising facts in memory hooks with a kind tag", () => {
  const reviewDocs = [
    {
      id: "sf-1",
      status: "approved",
      createdAt: "2026-07-16T03:00:00.000Z",
      approvedAt: "2026-07-16T03:00:00.000Z",
      reviewedBy: "reviewer",
      kind: "surprising_fact",
      payloadId: "mh-1cor13-sfact000001",
      quoteDecision: { mode: "no-scripture-quote", verseKeys: [], references: [] },
      finalMemoryHook: {
        id: "mh-1cor13-sfact000001",
        book: "1 Corinthians",
        chapter: 13,
        reference: "1 Corinthians 13:4",
        text: "Synthetic surprising fact",
        kindTag: "surprising_fact",
      },
    },
  ];

  const projected = projectArtifacts({
    currentQuestions: [],
    currentMemoryHooks: { schemaVersion: 1, books: {} },
    currentManifest: baseManifest(),
    reviewDocs,
  });

  assert.deepEqual(projected.memoryHooks.books["1 Corinthians"]["13"][0], {
    id: "mh-1cor13-sfact000001",
    reference: "1 Corinthians 13:4",
    text: "Synthetic surprising fact",
    kindTag: "surprising_fact",
  });
});
