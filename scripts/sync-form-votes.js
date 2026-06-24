#!/usr/bin/env node
/* Fetch Google Forms response Sheet CSV, aggregate memory-aid votes, and
   optionally prepare clear alternate winners in data/reviews.
   Run: node scripts/sync-form-votes.js [--prepare]
*/

const { readJson, reviewFile, writeJson } = require("./factory-utils");

const prepare = process.argv.includes("--prepare");
const MIN_VOTES = Number(process.env.MIN_VOTES || "3");
const WIN_RATE = Number(process.env.WIN_RATE || "0.65");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v !== ""));
}

function objectRows(text) {
  const rows = parseCsv(text);
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])));
}

function groupFor(questionId) {
  const chapter = Number(String(questionId).slice(2, 4));
  if (chapter <= 4) return "groupA";
  if (chapter <= 8) return "groupB";
  if (chapter <= 12) return "groupC";
  if (chapter <= 16) return "groupD";
  if (chapter <= 20) return "groupE";
  return "groupF";
}

function voteChoice(row) {
  if (row.choiceId === "current") return "current";
  return row.alternateCandidateId || row.choiceId;
}

async function main() {
  const config = readJson("data/vote-source.json");
  if (!config.sheetCsvUrl) throw new Error("data/vote-source.json missing sheetCsvUrl");

  const res = await fetch(config.sheetCsvUrl);
  if (!res.ok) throw new Error(`Failed to fetch vote CSV: HTTP ${res.status}`);
  const rows = objectRows(await res.text()).filter((r) => r.questionId);

  const tallies = new Map();
  for (const row of rows) {
    const key = row.questionId;
    const t = tallies.get(key) || {
      questionId: key,
      reference: row.reference || "",
      alternateCandidateId: row.alternateCandidateId || "",
      current: 0,
      alternate: 0,
    };
    const choice = voteChoice(row);
    if (choice === "current") t.current++;
    else {
      t.alternate++;
      t.alternateCandidateId = choice;
    }
    tallies.set(key, t);
  }

  const report = [...tallies.values()].map((t) => {
    const total = t.current + t.alternate;
    const winnerVotes = Math.max(t.current, t.alternate);
    const winner = t.alternate > t.current ? t.alternateCandidateId : "current";
    return {
      ...t,
      total,
      winner,
      winRate: total ? Number((winnerVotes / total).toFixed(3)) : 0,
      clear: total >= MIN_VOTES && winnerVotes / total >= WIN_RATE,
    };
  }).sort((a, b) => a.questionId.localeCompare(b.questionId));

  console.log(JSON.stringify({
    fetchedRows: rows.length,
    questions: report.length,
    minVotes: MIN_VOTES,
    winRate: WIN_RATE,
    clearWinners: report.filter((r) => r.clear).length,
    report,
  }, null, 2));

  if (!prepare) return;

  const byGroup = new Map();
  for (const row of report.filter((r) => r.clear && r.winner !== "current")) {
    const group = groupFor(row.questionId);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(row);
  }

  for (const [group, rowsForGroup] of byGroup) {
    const review = readJson(reviewFile(group));
    let changed = 0;
    for (const row of rowsForGroup) {
      const reviewRow = review.reviews.find((r) => r.id === row.questionId);
      if (!reviewRow) continue;
      reviewRow.selectedCandidateId = row.winner;
      const note = `[form-votes] ${row.alternate}/${row.total} chose ${row.winner}`;
      const notes = reviewRow.notes ? reviewRow.notes.split("\n") : [];
      if (!notes.includes(note)) reviewRow.notes = notes.length ? `${reviewRow.notes}\n${note}` : note;
      changed++;
    }
    review.updatedAt = new Date().toISOString();
    writeJson(reviewFile(group), review);
    console.error(`${group}: prepared ${changed} form-vote winner(s)`);
  }
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
