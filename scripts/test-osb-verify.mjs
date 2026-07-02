import assert from "assert/strict";
import { readJson } from "./lib/osb-audit-core.mjs";
import {
  buildDroppedNullEntry,
  buildVerifyReport,
  classifyVerificationResult,
  normalizeVerifyVerdict,
  parseVerifyArgs,
  reconcileVerifierVerdict,
  selectMismatchCandidates,
} from "./lib/osb-verify-core.mjs";

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

console.log("OSB verify harness checks:");

check("parseVerifyArgs applies verifier defaults", () => {
  const args = parseVerifyArgs([]);
  assert.equal(args.model, "mistralai/mixtral-8x7b-instruct-v0.1");
  assert.equal(args.sleepMs, 0);
  assert.equal(args.rpm, 40);
  assert.equal(args.maxRetries, 4);
  assert.equal(args.resume, true);
});

check("selectMismatchCandidates filters to mismatches and respects only ids", () => {
  const selected = selectMismatchCandidates({
    questions,
    auditLedger: {
      "ex01-002": { status: "mismatch" },
      "ex17-004": { status: "mismatch" },
      "ex17-005": { status: "match" },
    },
    only: ["ex17-004", "ex17-005"],
  });
  assert.deepEqual(selected.map((question) => question.id), ["ex17-004"]);
});

check("buildDroppedNullEntry marks the candidate for flag-only handling", () => {
  const question = structuredClone(questions.find((item) => item.id === "ex01-002"));
  const entry = buildDroppedNullEntry({
    question,
    auditEntry: {
      model: "audit-model",
      verdict: {
        confidence: 0.9,
        suggested: {
          answer: "Joseph",
        },
      },
    },
    model: "verify-model",
    timestamp: "2026-07-02T00:00:00.000Z",
  });
  assert.equal(entry.status, "flag");
  assert.equal(entry.dropped, "null-change");
  assert.match(entry.verifier.reason, /no effective change/i);
});

check("classifyVerificationResult uses correctedSuggested for APPLY", () => {
  const question = {
    id: "ex17-004",
    reference: "Exodus 17:7",
    question: "What two names did Moses give the place where the people tested the Lord?",
    answer: "Massah and Meribah",
    acceptableAnswers: ["massah and meribah"],
    options: [],
    memoryAid: {
      text: "Massah and Meribah",
    },
  };
  const entry = classifyVerificationResult({
    question,
    auditEntry: {
      model: "audit-model",
      verdict: {
        confidence: 0.98,
        suggested: {
          answer: "Temptation and Abuse",
        },
      },
    },
    model: "verify-model",
    timestamp: "2026-07-02T00:00:00.000Z",
    normalizedVerdict: normalizeVerifyVerdict({
      realMismatch: true,
      fixCorrect: true,
      confidence: 0.88,
      reason: "OSB wording differs.",
      correctedSuggested: {
        answer: "Temptation and Abuse",
        acceptableAnswers: ["temptation and abuse", "abuse and temptation"],
      },
    }),
  });
  assert.equal(entry.status, "apply");
  assert.deepEqual(entry.finalSuggested.acceptableAnswers, ["temptation and abuse", "abuse and temptation"]);
});

check("classifyVerificationResult flags verifier-approved no-op patches", () => {
  const question = structuredClone(questions.find((item) => item.id === "ex01-002"));
  const entry = classifyVerificationResult({
    question,
    auditEntry: {
      model: "audit-model",
      verdict: {
        confidence: 0.9,
        suggested: {
          answer: "Joseph",
        },
      },
    },
    model: "verify-model",
    timestamp: "2026-07-02T00:00:00.000Z",
    normalizedVerdict: normalizeVerifyVerdict({
      realMismatch: true,
      fixCorrect: true,
      confidence: 0.77,
      reason: "Looks wrong.",
    }),
  });
  assert.equal(entry.status, "flag");
  assert.match(entry.verifier.reason, /no effective change/i);
});

check("reconcileVerifierVerdict repairs contradictory exact-term refusals", () => {
  const question = {
    id: "ex17-004",
    reference: "Exodus 17:7",
    question: "What two names did Moses give the place where the people tested the Lord?",
    answer: "Massah and Meribah",
    acceptableAnswers: ["massah and meribah"],
    options: [],
    memoryAid: {
      text: "Massah and Meribah",
    },
  };
  const reconciled = reconcileVerifierVerdict({
    question,
    auditEntry: {
      verdict: {
        osbTerms: "Temptation and Abuse",
        suggested: {
          answer: "Temptation and Abuse",
          acceptableAnswers: ["temptation and abuse"],
        },
      },
    },
    normalizedVerdict: normalizeVerifyVerdict({
      realMismatch: false,
      fixCorrect: false,
      confidence: 0,
      reason: "The current answer and options do not match the OSB wording, but the proposed fix is also incorrect.",
      correctedSuggested: {
        answer: "Temptation",
      },
    }),
    osbSnippet: "17:7 Thus he called the name of that place Temptation and Abuse.",
  });
  assert.equal(reconciled.realMismatch, true);
  assert.equal(reconciled.fixCorrect, true);
  assert.deepEqual(reconciled.correctedSuggested, {});
  assert.match(reconciled.reason, /Deterministic guard/);
});

check("buildVerifyReport emits APPLY and FLAG sections", () => {
  const applyQuestion = structuredClone(questions.find((item) => item.id === "ex17-004"));
  const flagQuestion = structuredClone(questions.find((item) => item.id === "ex01-002"));
  const report = buildVerifyReport({
    questions: [applyQuestion, flagQuestion],
    auditLedger: {
      [applyQuestion.id]: {
        verdict: { confidence: 0.98 },
      },
      [flagQuestion.id]: {
        verdict: { confidence: 0.9 },
      },
    },
    verifyLedger: {
      [applyQuestion.id]: {
        status: "apply",
        dropped: null,
        finalSuggested: {
          answer: "Temptation and Abuse",
        },
        auditConfidence: 0.98,
        verifier: {
          confidence: 0.86,
          reason: "Real mismatch.",
        },
      },
      [flagQuestion.id]: {
        status: "flag",
        dropped: "null-change",
        finalSuggested: {
          answer: "Joseph",
        },
        auditConfidence: 0.9,
        verifier: {
          confidence: null,
          reason: "Dropped before verification.",
        },
      },
    },
    contexts: {
      [applyQuestion.id]: { osbSnippet: "17:7 Thus he called the name of that place Temptation and Abuse..." },
      [flagQuestion.id]: { osbSnippet: "1:1-4 These are the names..." },
    },
  });
  assert.match(report, /## APPLY/);
  assert.match(report, /## FLAG/);
  assert.match(report, /Temptation and Abuse/);
  assert.match(report, /null-change/i);
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
