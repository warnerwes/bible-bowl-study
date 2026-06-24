#!/usr/bin/env node
/* Apply only human-approved candidate choices to data/raw.
   Run: node scripts/apply-reviewed-choice.js [groupA]
*/

const {
  candidateFile,
  loadQuestions,
  memoryAidFromCandidate,
  rawFiles,
  readJson,
  reviewFile,
  validateCandidate,
  writeJson,
} = require("./factory-utils");

const groupArg = process.argv[2];
const questions = loadQuestions(groupArg);
const groups = [...new Set(questions.map((q) => q._group))];
const approved = new Map();
const problems = [];

for (const group of groups) {
  const packet = readJson(candidateFile(group));
  const review = readJson(reviewFile(group));
  const candidateById = new Map(packet.questions.map((q) => [q.id, q]));

  for (const r of review.reviews || []) {
    if (!r.selectedCandidateId) continue;
    if (!r.osbAnswerVerified) {
      problems.push(`${r.id}: selected but OSB answer not verified`);
      continue;
    }
    const q = candidateById.get(r.id);
    if (!q) {
      problems.push(`${r.id}: no candidate packet question`);
      continue;
    }
    const c = q.candidates.find((candidate) => candidate.candidateId === r.selectedCandidateId);
    if (!c) {
      problems.push(`${r.id}: selected candidate ${r.selectedCandidateId} not found`);
      continue;
    }
    const err = validateCandidate(q, c);
    if (err) {
      problems.push(err);
      continue;
    }
    if (c.claimKind === "source-backed" && c.sourceStatus !== "verified") {
      problems.push(`${r.id} ${c.candidateId}: source-backed candidate must be sourceStatus verified`);
      continue;
    }
    approved.set(r.id, memoryAidFromCandidate(c));
  }
}

if (problems.length) {
  console.error(`Cannot apply reviewed choices; ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

let applied = 0;
for (const file of rawFiles()) {
  const arr = readJson(file);
  let touched = false;
  for (const q of arr) {
    if (approved.has(q.id)) {
      q.memoryAid = approved.get(q.id);
      applied++;
      touched = true;
    }
  }
  if (touched) writeJson(file, arr);
}

console.log(`Applied ${applied} approved memory aid(s).`);
