#!/usr/bin/env node
/* Apply panel-reviewed memory-aid upgrades from tmp-upgrades/*.json onto the
   data/raw/*.json question files. Only the `memoryAid` is replaced; question
   text, answers, options, and references are left untouched.
   Run: node scripts/apply-upgrades.js   (then: node scripts/build.js) */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const UP_DIR = path.join(ROOT, "tmp-upgrades");
const AID_TYPES = new Set(["mnemonic", "teaching", "image"]);

if (!fs.existsSync(UP_DIR)) {
  console.error("No tmp-upgrades/ directory — run the panel-review workflow first.");
  process.exit(1);
}

// Build id -> upgraded memoryAid map, validating each upgrade.
const map = new Map();
const problems = [];
for (const f of fs.readdirSync(UP_DIR).filter((x) => x.endsWith(".json"))) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(UP_DIR, f), "utf8"));
  } catch (e) {
    problems.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  for (const u of arr) {
    const a = u.memoryAid;
    if (!u.id || !a || !AID_TYPES.has(a.type) || typeof a.text !== "string" || a.text.trim().length < 10) {
      problems.push(`${f} [${u.id}]: malformed upgrade`);
      continue;
    }
    if (a.type === "teaching" && (typeof a.source !== "string" || a.source.trim().length < 4)) {
      problems.push(`${f} [${u.id}]: teaching upgrade missing source`);
      continue;
    }
    const clean = { type: a.type, text: a.text.trim() };
    if (a.type === "teaching") clean.source = a.source.trim();
    map.set(u.id, clean);
  }
}

if (problems.length) {
  console.error(`Rejected ${problems.length} upgrade(s):`);
  problems.forEach((p) => console.error("  - " + p));
}

// Apply to raw files.
let applied = 0, unchanged = 0;
const seen = new Set();
for (const f of fs.readdirSync(RAW_DIR).filter((x) => x.endsWith(".json"))) {
  const p = path.join(RAW_DIR, f);
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  let touched = false;
  for (const q of arr) {
    if (map.has(q.id)) {
      seen.add(q.id);
      q.memoryAid = map.get(q.id);
      applied++;
      touched = true;
    } else {
      unchanged++;
    }
  }
  if (touched) fs.writeFileSync(p, JSON.stringify(arr, null, 2) + "\n");
}

const orphans = [...map.keys()].filter((id) => !seen.has(id));
console.log(`Applied ${applied} upgrades; ${unchanged} questions left unchanged.`);
if (orphans.length) console.log(`Upgrades with no matching question (ignored): ${orphans.join(", ")}`);
if (problems.length) process.exit(1);
