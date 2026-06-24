#!/usr/bin/env node
/* Aggregate exported in-quiz memory-aid vote JSON files.
   Run: node scripts/aggregate-aid-votes.js exports/*.json
   Add --prepare to set selectedCandidateId for clear winners in data/reviews.
*/

const fs = require("fs");
const path = require("path");
const { readJson, reviewFile, writeJson } = require("./factory-utils");

const args = process.argv.slice(2);
const prepare = args.includes("--prepare");
const files = args.filter((a) => a !== "--prepare");
const MIN_VOTES = Number(process.env.MIN_VOTES || "3");
const WIN_RATE = Number(process.env.WIN_RATE || "0.65");

if (!files.length) {
  console.error("Usage: node scripts/aggregate-aid-votes.js [--prepare] <votes.json> [...]");
  process.exit(1);
}

const tallies = new Map();

for (const file of files) {
  const payload = readJson(path.resolve(file));
  for (const v of payload.votes || []) {
    const t = tallies.get(v.questionId) || {
      questionId: v.questionId,
      reference: v.reference || "",
      alternateCandidateId: v.alternateCandidateId,
      current: 0,
      alternate: 0,
    };
    if (v.choiceId === "current") t.current++;
    else t.alternate++;
    if (v.alternateCandidateId) t.alternateCandidateId = v.alternateCandidateId;
    tallies.set(v.questionId, t);
  }
}

const rows = [...tallies.values()].map((t) => {
  const total = t.current + t.alternate;
  const winner = t.alternate > t.current ? t.alternateCandidateId : "current";
  const winnerVotes = Math.max(t.current, t.alternate);
  return {
    ...t,
    total,
    winner,
    winRate: total ? winnerVotes / total : 0,
    clear: total >= MIN_VOTES && winnerVotes / total >= WIN_RATE,
  };
}).sort((a, b) => a.questionId.localeCompare(b.questionId));

console.log(JSON.stringify(rows, null, 2));

if (prepare) {
  const byGroup = new Map();
  for (const r of rows.filter((x) => x.clear && x.winner !== "current")) {
    const chapter = Number(r.questionId.slice(2, 4));
    const group = chapter <= 4 ? "groupA"
      : chapter <= 8 ? "groupB"
      : chapter <= 12 ? "groupC"
      : chapter <= 16 ? "groupD"
      : chapter <= 20 ? "groupE"
      : "groupF";
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(r);
  }
  for (const [group, groupRows] of byGroup) {
    const review = readJson(reviewFile(group));
    let changed = 0;
    for (const r of groupRows) {
      const row = review.reviews.find((x) => x.id === r.questionId);
      if (!row) continue;
      row.selectedCandidateId = r.winner;
      const note = `[votes] ${r.alternate}/${r.total} chose ${r.winner}`;
      const notes = row.notes ? row.notes.split("\n") : [];
      if (!notes.includes(note)) row.notes = notes.length ? `${row.notes}\n${note}` : note;
      changed++;
    }
    review.updatedAt = new Date().toISOString();
    writeJson(reviewFile(group), review);
    console.error(`${group}: prepared ${changed} vote winner(s)`);
  }
}
