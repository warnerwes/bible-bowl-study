import assert from "assert/strict";
import {
  collectReferencedVerses,
  loadSourceForBook,
  parseReference,
} from "./lib/osb-audit-core.mjs";

const { source } = await loadSourceForBook("Exodus");

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result
        .then(() => {
          console.log("  PASS", name);
          pass += 1;
        })
        .catch((error) => {
          console.log("  FAIL", name, "-", error.message);
          fail += 1;
        });
    }
    console.log("  PASS", name);
    pass += 1;
  } catch (error) {
    console.log("  FAIL", name, "-", error.message);
    fail += 1;
  }
  return Promise.resolve();
}

function keysForChapter(chapter, lastVerse) {
  return Array.from({ length: lastVerse }, (_, index) => `${chapter}:${index + 1}`);
}

function assertReferenceKeys(reference, expectedKeys, expectedMissingKeys = []) {
  const parsed = parseReference(reference);
  assert.equal(parsed.ok, true, parsed.error);
  const collected = collectReferencedVerses(source, parsed);
  assert.equal(collected.ok, true, `expected verses for ${reference}`);
  assert.deepEqual(
    collected.verses.map(({ key }) => key),
    expectedKeys
  );
  assert.equal(collected.verses.length, expectedKeys.length);
  assert.deepEqual(collected.missingKeys, expectedMissingKeys);
}

console.log("OSB reference parser checks:");

const cases = [
  { reference: "Exodus 2:18; 3:1", expectedKeys: ["2:18", "3:1"] },
  { reference: "Exodus 3:8,17", expectedKeys: ["3:8", "3:17"] },
  { reference: "Exodus 7:27-8:2", expectedKeys: ["7:27", "7:28", "7:29", "8:1", "8:2"] },
  { reference: "Exodus 38", expectedKeys: keysForChapter(38, 27) },
  { reference: "Exodus 39 (LXX)", expectedKeys: keysForChapter(39, 23) },
  { reference: "Exodus 40:2,17", expectedKeys: ["40:2", "40:17"] },
  {
    reference: "Exodus 40:18-33",
    expectedKeys: Array.from({ length: 15 }, (_, index) => `40:${index + 18}`),
    expectedMissingKeys: ["40:33"],
  },
  { reference: "Exodus 40:3, 21", expectedKeys: ["40:3", "40:21"] },
];

for (const { reference, expectedKeys, expectedMissingKeys } of cases) {
  await check(reference, () => {
    assertReferenceKeys(reference, expectedKeys, expectedMissingKeys);
  });
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
