import test from "node:test";
import assert from "node:assert/strict";

import { assertQuestionIdReuseAllowed, projectArtifacts } from "../lib/export.mjs";

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

test("question id guard refuses answer-changing id reuse", () => {
  let error;
  try {
    assertQuestionIdReuseAllowed(
      [{ id: "1cor13-001", answer: "Alpha" }],
      { id: "1cor13-001", answer: "Beta" }
    );
  } catch (caught) {
    error = caught;
  }
  assert.ok(error);
  assert.equal(error.code, "ID_REUSE_REQUIRES_NEW_ID");
});

test("question id guard allows same-answer reuse checks", () => {
  assert.doesNotThrow(() => assertQuestionIdReuseAllowed(
    [{ id: "1cor13-001", answer: "Alpha" }],
    { id: "1cor13-001", answer: "alpha" }
  ));
});

test("export projection refuses answer-changing id reuse from approved docs", () => {
  let error;
  try {
    projectArtifacts({
      currentQuestions: [
        {
          id: "1cor13-001",
          queueItemIds: [],
          book: "1 Corinthians",
          bookSlug: "1cor",
          chapter: 13,
          reference: "1 Corinthians 13",
          topic: "Synthetic",
          type: "multiple-choice",
          question: "Synthetic prompt",
          answer: "Alpha",
          options: ["Alpha", "Beta"],
          difficulty: "easy",
          roundFormat: "standard",
          reviewStatus: "approved",
        },
      ],
      currentMemoryHooks: { schemaVersion: 1, books: {} },
      currentManifest: baseManifest(),
      reviewDocs: [
        {
          id: "s-1",
          status: "approved",
          createdAt: "2026-07-16T04:00:00.000Z",
          payloadId: "1cor13-001",
          quoteDecision: { mode: "no-scripture-quote", verseKeys: [], references: [] },
          finalQuestion: {
            id: "1cor13-001",
            queueItemIds: [],
            book: "1 Corinthians",
            bookSlug: "1cor",
            chapter: 13,
            reference: "1 Corinthians 13",
            topic: "Synthetic",
            type: "multiple-choice",
            question: "Synthetic prompt revised",
            answer: "Beta",
            options: ["Beta", "Alpha"],
            difficulty: "easy",
            roundFormat: "standard",
            reviewStatus: "approved",
          },
        },
      ],
    });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error);
  assert.equal(error.code, "ID_REUSE_REQUIRES_NEW_ID");
});
