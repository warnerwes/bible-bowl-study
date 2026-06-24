#!/usr/bin/env node
/* Import JSON source lookup results into data/candidates.
   Run: node scripts/import-source-export.js data/source-exports/groupA.sources.json
*/

const path = require("path");
const {
  candidateFile,
  normalizeCandidate,
  readJson,
  writeJson,
} = require("./factory-utils");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-source-export.js <sources.json>");
  process.exit(1);
}

const updates = readJson(path.resolve(file));
if (!Array.isArray(updates)) {
  console.error("Source export must be a JSON array.");
  process.exit(1);
}

const byGroup = new Map();
for (const u of updates) {
  const match = String(u.id || "").match(/^ex(\d{2})-/);
  if (!match) continue;
  const chapter = Number(match[1]);
  const group = chapter <= 4 ? "groupA"
    : chapter <= 8 ? "groupB"
    : chapter <= 12 ? "groupC"
    : chapter <= 16 ? "groupD"
    : chapter <= 20 ? "groupE"
    : "groupF";
  if (!byGroup.has(group)) byGroup.set(group, []);
  byGroup.get(group).push(u);
}

let applied = 0;
for (const [group, groupUpdates] of byGroup) {
  const packet = readJson(candidateFile(group));
  const questionById = new Map(packet.questions.map((q) => [q.id, q]));
  for (const u of groupUpdates) {
    const q = questionById.get(u.id);
    if (!q) continue;
    const c = q.candidates.find((candidate) => candidate.candidateId === u.candidateId);
    if (!c) continue;
    Object.assign(c, normalizeCandidate(q, { ...c, ...u }, 0));
    applied++;
  }
  packet.updatedAt = new Date().toISOString();
  writeJson(candidateFile(group), packet);
}

console.log(`Imported ${applied} source update(s).`);
