import assert from "assert/strict";
import { readFile } from "fs/promises";
import {
  buildReport,
  extractJsonObject,
  normalizeJudgeVerdict,
  parseArgs,
  parseReference,
  readJson,
} from "./lib/osb-audit-core.mjs";
import { applySuggestedChanges } from "./osb-audit.mjs";

const questions = await readJson("data/questions.json");

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    console.log("  PASS", name);
    pass += 1;
  } catch (error) {
    console.log("  FAIL", name, "-", error.message);
    fail += 1;
  }
}

console.log("OSB audit harness checks:");

check("parseReference handles simple verse", () => {
  const result = parseReference("Exodus 17:7");
  assert.equal(result.ok, true);
  assert.equal(result.raw, "Exodus 17:7");
  assert.equal(result.book, "Exodus");
  assert.equal(result.chapter, 17);
  assert.equal(result.startVerse, 7);
  assert.equal(result.endVerse, 7);
  assert.deepEqual(result.segments, [
    {
      startChapter: 17,
      startVerse: 7,
      endChapter: 17,
      endVerse: 7,
      wholeChapter: false,
    },
  ]);
});

check("parseReference handles multi-reference clauses", () => {
  const result = parseReference("Exodus 2:18; 3:1");
  assert.equal(result.ok, true);
  assert.equal(result.chapter, 2);
  assert.equal(result.startVerse, 18);
  assert.equal(result.endVerse, 18);
  assert.deepEqual(result.segments, [
    {
      startChapter: 2,
      startVerse: 18,
      endChapter: 2,
      endVerse: 18,
      wholeChapter: false,
    },
    {
      startChapter: 3,
      startVerse: 1,
      endChapter: 3,
      endVerse: 1,
      wholeChapter: false,
    },
  ]);
});

check("extractJsonObject strips fences and trailing prose", () => {
  const json = extractJsonObject("```json\n{\"match\":false,\"fixType\":\"wording\"}\n```\nextra");
  assert.equal(json, "{\"match\":false,\"fixType\":\"wording\"}");
});

check("normalizeJudgeVerdict keeps supported suggested keys only", () => {
  const verdict = normalizeJudgeVerdict({
    match: false,
    confidence: 0.91,
    issues: ["Mismatch"],
    fixType: "wording",
    suggested: {
      answer: "Temptation and Abuse",
      ignored: "x",
    },
    osbTerms: "Temptation and Abuse",
  });
  assert.deepEqual(verdict, {
    match: false,
    confidence: 0.91,
    issues: ["Mismatch"],
    fixType: "wording",
    suggested: {
      answer: "Temptation and Abuse",
    },
    osbTerms: "Temptation and Abuse",
  });
});

check("normalizeJudgeVerdict preserves unknown confidence as null", () => {
  const verdict = normalizeJudgeVerdict({
    match: false,
    confidence: "not-a-number",
    issues: ["Missing confidence"],
  });
  assert.equal(verdict.confidence, null);
});

check("parseArgs applies audit retry defaults", () => {
  const args = parseArgs([]);
  assert.equal(args.sleepMs, 0);
  assert.equal(args.rpm, 40);
  assert.equal(args.maxRetries, 4);
  assert.equal(args.retryErrors, false);
});

check("applySuggestedChanges updates question fields and memory aid text", () => {
  const original = structuredClone(questions.find((question) => question.id === "ex17-004"));
  const working = structuredClone(original);
  const changes = applySuggestedChanges(working, {
    question: "What name did Moses give the place?",
    answer: "Temptation and Abuse",
    acceptableAnswers: ["temptation and abuse"],
    memoryAidText: "The OSB wording is Temptation and Abuse.",
  });
  assert.equal(changes.length, 3);
  assert.equal(working.question, "What name did Moses give the place?");
  assert.equal(working.answer, "Temptation and Abuse");
  assert.deepEqual(working.acceptableAnswers, ["temptation and abuse"]);
  assert.equal(working.memoryAid.text, "The OSB wording is Temptation and Abuse.");
});

check("buildReport includes mismatch section and suggested changes", () => {
  const question = structuredClone(questions.find((item) => item.id === "ex17-004"));
  const report = buildReport({
    questions: [question],
    ledger: {
      [question.id]: {
        status: "mismatch",
        verdict: {
          confidence: 0.98,
          issues: ["Translation mismatch"],
          fixType: "wording",
          suggested: {
            answer: "Temptation and Abuse",
          },
          osbTerms: "Temptation and Abuse",
        },
      },
    },
  });
  assert.match(report, /## wording/);
  assert.match(report, /Temptation and Abuse/);
  assert.match(report, /suggested changes/i);
});

check("buildReport prints unknown confidence when verdict confidence is null", () => {
  const question = structuredClone(questions.find((item) => item.id === "ex17-004"));
  const report = buildReport({
    questions: [question],
    ledger: {
      [question.id]: {
        status: "mismatch",
        verdict: {
          confidence: null,
          issues: ["Missing confidence"],
          fixType: "wording",
          suggested: {},
          osbTerms: "Temptation and Abuse",
        },
      },
    },
  });
  assert.match(report, /Confidence: unknown/);
});

const harnessSource = await readFile("scripts/osb-audit.mjs", "utf8");
check("harness remains under the repo's file budget intent", () => {
  assert.ok(harnessSource.split(/\r?\n/).length < 800);
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
