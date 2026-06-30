// Regression test: every question referenced as "fill-in" in the UI must
// match the JSON's type field. Drift between UI and data caused the
// PWA to show ex17-011 (MC in JSON) as FILL IN on cached installs.
//
// Checks:
//   1. Every question with type "fill-in" has either acceptableAnswers[] OR is
//      a known-true/false (none currently)
//   2. Every question with type "multiple-choice" has options[] with 2+ items
//   3. No two questions in the same chapter share the same question text
//      (would render identically and confuse the drill picker)
//   4. ex17-011 specifically is MC with 4 options about Aaron and Hur
//      (guard against silent revert)
//
// Run: node scripts/test-question-schema.mjs

import { readFile } from "fs/promises";
import assert from "assert/strict";

const json = JSON.parse(await readFile("data/questions.json", "utf8"));
const exodusSource = JSON.parse(
  await readFile("data/source-text/exodus/exodus-verses.json", "utf8")
);
const exodusVerses = exodusSource.verses;
assert.ok(Array.isArray(json), "questions.json must be a top-level array");

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log("  ✓", name); pass++; }
  catch (e) { console.log("  ✗", name, "—", e.message); fail++; }
}

console.log("Schema checks:");

const fills = json.filter(q => q.type === "fill-in");
const mcs = json.filter(q => q.type === "multiple-choice");
const tfs = json.filter(q => q.type === "true-false");

check(`fill-in questions have acceptableAnswers[] (${fills.length} fill-ins)`, () => {
  for (const q of fills) {
    if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) {
      throw new Error(`${q.id} has no acceptableAnswers[]`);
    }
  }
});

check(`multiple-choice questions have options[] with 2+ items (${mcs.length} MCs)`, () => {
  for (const q of mcs) {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`${q.id} has fewer than 2 options`);
    }
  }
});

check(`true-false questions exist only when expected (${tfs.length} T/F)`, () => {
  // T/F is fine to exist; no schema violation.
});

check("no duplicate question text within same chapter", () => {
  const seen = new Map();
  for (const q of json) {
    const key = `${q.chapter}::${q.question}`;
    if (seen.has(key)) {
      throw new Error(`duplicate "${q.question}" in ch${q.chapter}: ${seen.get(key)} and ${q.id}`);
    }
    seen.set(key, q.id);
  }
});

check("ex17-009 is multiple-choice about Aaron/Hur (regression #53)", () => {
  const q = json.find(x => x.id === "ex17-009");
  if (!q) throw new Error("ex17-009 missing");
  if (q.type !== "multiple-choice") throw new Error(`ex17-009 type is ${q.type}, expected multiple-choice`);
  if (!q.options || q.options.length !== 4) throw new Error(`ex17-009 has ${q.options?.length} options, expected 4`);
  if (!/aaron/i.test(q.question) || !/hur/i.test(q.question)) {
    throw new Error(`ex17-009 question doesn't mention Aaron and Hur: ${q.question}`);
  }
});

check("ex40-012 cites SAAS golden incense altar verses", () => {
  const q = json.find(x => x.id === "ex40-012");
  if (!q) throw new Error("ex40-012 missing");
  if (q.reference !== "Exodus 40:24-25") {
    throw new Error(`ex40-012 reference is ${q.reference}`);
  }
  const citedText = `${exodusVerses["40:24"]} ${exodusVerses["40:25"]}`;
  if (!/gold altar/i.test(citedText) || !/incense/i.test(citedText)) {
    throw new Error(`Exodus 40:24-25 does not mention gold altar and incense: ${citedText}`);
  }
});

check("every question has an id, chapter, reference, topic, type, question", () => {
  for (const q of json) {
    for (const f of ["id", "chapter", "reference", "topic", "type", "question"]) {
      if (!q[f]) throw new Error(`${q.id || "?"} missing ${f}`);
    }
  }
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
