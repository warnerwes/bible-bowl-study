import test from "node:test";
import assert from "node:assert/strict";

import { assertManifestBudget, reconcileQuotedUses } from "../lib/manifest.mjs";

function manifestWithUses(counts) {
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
        quotedUses: counts.map((count, index) => ({
          id: `q-${index}`,
          file: "generator/pilots/corinthians/questions.seed.json",
          fieldPath: "payload",
          reference: `1 Corinthians 13:${index + 1}`,
          verseKeys: Array.from({ length: count }, (_, offset) => `1cor:13:${index + offset + 1}`),
          quotedChars: 12,
          inclusionReason: "review-approved-scripture-quote",
          reviewer: "reviewer",
          reviewedAt: "2026-07-16T00:00:00.000Z",
        })),
      },
    ],
  };
}

test("manifest accepts exactly 500 quoted verse occurrences", () => {
  const result = assertManifestBudget(manifestWithUses([250, 250]));
  assert.equal(result.totalOccurrences, 500);
});

test("manifest rejects 501 quoted verse occurrences", () => {
  assert.throws(() => assertManifestBudget(manifestWithUses([250, 251])), /budget exceeded/);
});

test("manifest reconcile replaces entries by id deterministically", () => {
  const manifest = manifestWithUses([3]);
  const reconciled = reconcileQuotedUses(manifest, [
    {
      id: "q-0",
      file: "generator/pilots/corinthians/questions.seed.json",
      fieldPath: "payload",
      reference: "1 Corinthians 13:4-7",
      verseKeys: ["1cor:13:4", "1cor:13:5", "1cor:13:6", "1cor:13:7"],
      quotedChars: 20,
      inclusionReason: "review-approved-scripture-quote",
      reviewer: "reviewer-2",
      reviewedAt: "2026-07-16T01:00:00.000Z",
    },
  ]);

  assert.deepEqual(reconciled.translations[0].quotedUses.map((entry) => entry.id), ["q-0"]);
  assert.equal(reconciled.translations[0].quotedUses[0].verseKeys.length, 4);
});
