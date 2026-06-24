#!/usr/bin/env node
/* Merge + validate all data/raw/*.json question files into data/questions.json.
   Run: node scripts/build.js
   Exits non-zero if any question fails validation. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "questions.json");

const TYPES = new Set(["multiple-choice", "true-false", "fill-in"]);
const AID_TYPES = new Set(["mnemonic", "teaching", "image"]);

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
    // Teaching aids make theological claims and MUST cite a source.
    if (q.memoryAid.type === "teaching") {
      if (typeof q.memoryAid.source !== "string" || q.memoryAid.source.trim().length < 4) {
        fail(file, id, "teaching memoryAid must include a non-empty source citation");
      }
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

fs.writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");

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
