#!/usr/bin/env node
/* Prepare data/reviews selections from imported candidates.
   Run: node scripts/prepare-review-selections.js [groupA]

   By default this selects the latest agent candidate when present, otherwise
   keeps the current candidate. It does not mark OSB answers or sources verified.
*/

const {
  candidateFile,
  loadQuestions,
  readJson,
  reviewFile,
  writeJson,
} = require("./factory-utils");

const groupArg = process.argv[2];
const groups = [...new Set(loadQuestions(groupArg).map((q) => q._group))];

let selected = 0;
let keptCurrent = 0;

for (const group of groups) {
  const packet = readJson(candidateFile(group));
  const review = readJson(reviewFile(group));
  const questionById = new Map(packet.questions.map((q) => [q.id, q]));

  for (const r of review.reviews || []) {
    if (r.selectedCandidateId) continue;
    const q = questionById.get(r.id);
    if (!q) continue;
    const agent = [...q.candidates].reverse().find((c) => c.candidateId.includes("-agent-"));
    const current = q.candidates.find((c) => c.candidateId.endsWith("-a"));
    if (agent) {
      r.selectedCandidateId = agent.candidateId;
      selected++;
    } else if (current) {
      r.selectedCandidateId = current.candidateId;
      keptCurrent++;
    }
  }

  review.updatedAt = new Date().toISOString();
  writeJson(reviewFile(group), review);
}

console.log(`Prepared ${selected} agent selection(s); kept ${keptCurrent} current aid(s).`);
