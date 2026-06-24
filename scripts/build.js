#!/usr/bin/env node
/* Merge + validate all data/raw/*.json question files into data/questions.json.
   Run: node scripts/build.js
   Exits non-zero if any question fails validation. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const CANDIDATE_DIR = path.join(ROOT, "data", "candidates");
const OUT = path.join(ROOT, "data", "questions.json");
const REVIEW_OUT = path.join(ROOT, "data", "review-candidates.json");

const TYPES = new Set(["multiple-choice", "true-false", "fill-in"]);
const AID_TYPES = new Set(["mnemonic", "teaching", "image"]);
const STRICT_REVIEW = process.env.STRICT_REVIEW === "1";

const errors = [];
const seenIds = new Set();
const all = [];

function fail(file, id, msg) {
  errors.push(`${file} [${id || "?"}]: ${msg}`);
}

function validate(q, file) {
  const id = q.id;
  if (typeof id !== "string" || !id) return fail(file, id, "missing id");
  if (seenIds.has(id)) return fail(file, id, "duplicate id");
  seenIds.add(id);

  if (typeof q.chapter !== "number") fail(file, id, "chapter must be a number");
  if (typeof q.question !== "string" || !q.question.trim()) fail(file, id, "missing question text");
  // Every question is rooted in Scripture and must cite a reference.
  if (typeof q.reference !== "string" || !/Exodus\s+\d+/i.test(q.reference)) {
    fail(file, id, "missing/invalid Scripture reference (expected e.g. 'Exodus 12:3')");
  }
  if (!TYPES.has(q.type)) fail(file, id, `invalid type: ${q.type}`);
  if (typeof q.answer !== "string" || !q.answer.trim()) fail(file, id, "missing answer");

  if (q.type === "multiple-choice") {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      fail(file, id, "multiple-choice needs an options array");
    } else if (!q.options.some((o) => norm(o) === norm(q.answer))) {
      fail(file, id, "answer not found among options");
    }
  }
  if (q.type === "true-false" && !["true", "false"].includes(q.answer.toLowerCase())) {
    fail(file, id, `true-false answer must be True/False, got "${q.answer}"`);
  }
  if (q.type === "fill-in") {
    if (q.acceptableAnswers && !Array.isArray(q.acceptableAnswers)) {
      fail(file, id, "acceptableAnswers must be an array");
    }
  }

  if (!q.memoryAid || typeof q.memoryAid !== "object") {
    fail(file, id, "missing memoryAid");
  } else {
    if (!AID_TYPES.has(q.memoryAid.type)) fail(file, id, `invalid memoryAid.type: ${q.memoryAid.type}`);
    if (typeof q.memoryAid.text !== "string" || q.memoryAid.text.trim().length < 10) {
      fail(file, id, "memoryAid.text too short or missing");
    }
    // Teaching aids make theological claims and MUST cite a source. Mnemonics
    // and images may cite a source only when they carry a factual/surprising
    // claim rather than functioning as a pure memory device.
    if (q.memoryAid.type === "teaching") {
      if (typeof q.memoryAid.source !== "string" || q.memoryAid.source.trim().length < 4) {
        fail(file, id, "teaching memoryAid must include a non-empty source citation");
      }
      if (STRICT_REVIEW) {
        if (typeof q.memoryAid.sourceUrl !== "string" || !/^https?:\/\//i.test(q.memoryAid.sourceUrl)) {
          fail(file, id, "STRICT_REVIEW teaching memoryAid must include sourceUrl");
        }
        if (typeof q.memoryAid.sourceClaim !== "string" || q.memoryAid.sourceClaim.trim().length < 10) {
          fail(file, id, "STRICT_REVIEW teaching memoryAid must include sourceClaim");
        }
      }
    } else if (q.memoryAid.source !== undefined && q.memoryAid.source !== "") {
      if (typeof q.memoryAid.sourceUrl !== "string" || !/^https?:\/\//i.test(q.memoryAid.sourceUrl)) {
        fail(file, id, `${q.memoryAid.type} sourced memoryAid must include sourceUrl`);
      }
      if (typeof q.memoryAid.sourceClaim !== "string" || q.memoryAid.sourceClaim.trim().length < 10) {
        fail(file, id, `${q.memoryAid.type} sourced memoryAid must include sourceClaim`);
      }
    } else if (q.memoryAid.sourceUrl || q.memoryAid.sourceClaim) {
      fail(file, id, `${q.memoryAid.type} memoryAid must include source when sourceUrl/sourceClaim is present`);
    }
  }
}

function norm(s) {
  return String(s).toLowerCase().trim();
}

if (!fs.existsSync(RAW_DIR)) {
  console.error("No data/raw directory found.");
  process.exit(1);
}

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json")).sort();
if (!files.length) {
  console.error("No raw JSON files in data/raw.");
  process.exit(1);
}

for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf8"));
  } catch (e) {
    fail(file, null, `invalid JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    fail(file, null, "top level must be an array");
    continue;
  }
  parsed.forEach((q) => {
    validate(q, file);
    all.push(q);
  });
}

if (errors.length) {
  console.error(`\n✗ Validation failed with ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}

// Stable sort: chapter, then id.
all.sort((a, b) => a.chapter - b.chapter || a.id.localeCompare(b.id));

fs.writeFileSync(OUT, JSON.stringify(all) + "\n");

function buildReviewCandidates() {
  if (!fs.existsSync(CANDIDATE_DIR)) return {};
  const currentById = new Map(all.map((q) => [q.id, q.memoryAid && q.memoryAid.text]));
  const review = {};
  for (const file of fs.readdirSync(CANDIDATE_DIR).filter((f) => f.endsWith(".candidates.json")).sort()) {
    let packet;
    try {
      packet = JSON.parse(fs.readFileSync(path.join(CANDIDATE_DIR, file), "utf8"));
    } catch (e) {
      console.warn(`Skipping ${file}: invalid candidate JSON (${e.message})`);
      continue;
    }
    for (const q of packet.questions || []) {
      const choices = (q.candidates || [])
        .filter((c) => c.candidateId && c.text && c.text !== currentById.get(q.id))
        .map((c) => ({
          candidateId: c.candidateId,
          type: c.type,
          text: c.text,
          source: c.source || "",
        }));
      if (choices.length) review[q.id] = choices;
    }
  }
  return review;
}

const reviewCandidates = buildReviewCandidates();
if (Object.keys(reviewCandidates).length) {
  fs.writeFileSync(
    REVIEW_OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), questions: reviewCandidates }) + "\n",
  );
  console.log(`Review candidates: ${Object.keys(reviewCandidates).length} question(s) written to data/review-candidates.json`);
}

// Report
const byType = {};
const byChapter = {};
for (const q of all) {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byChapter[q.chapter] = (byChapter[q.chapter] || 0) + 1;
}
console.log(`✓ ${all.length} questions written to data/questions.json`);
console.log("  By type:", JSON.stringify(byType));
console.log("  Chapters:", Object.keys(byChapter).map(Number).sort((a, b) => a - b).join(", "));
