#!/usr/bin/env node
/* Export source-review CSV for ChatGPT/Gemini/Google Pro workflows.
   Run: node scripts/export-review-csv.js [groupA]

   If data/candidates/<group>.candidates.json exists, exports each candidate.
   Otherwise exports the current memoryAid from data/raw as one candidate row.
*/

const fs = require("fs");
const path = require("path");
const {
  EXPORT_DIR,
  candidateFile,
  ensureDir,
  loadQuestions,
  readJson,
} = require("./factory-utils");

const groupArg = process.argv[2];
const chunkSize = Number(process.env.CHUNK_SIZE || "0");
const questions = loadQuestions(groupArg);
const groups = new Map();

for (const q of questions) {
  if (!groups.has(q._group)) groups.set(q._group, []);
  groups.get(q._group).push(q);
}

const columns = [
  "group",
  "id",
  "chapter",
  "reference",
  "topic",
  "questionType",
  "question",
  "answer",
  "options",
  "acceptableAnswers",
  "candidateId",
  "memoryAidType",
  "memoryAidText",
  "claimKind",
  "source",
  "sourceUrl",
  "sourceClaim",
  "sourceStatus",
  "styleNotes",
  "agentVerdict",
  "agentReason",
  "replacementType",
  "replacementText",
  "replacementClaimKind",
  "replacementSource",
  "replacementSourceUrl",
  "replacementSourceClaim",
  "replacementSourceStatus",
];

function csvCell(value) {
  if (Array.isArray(value)) return csvCell(value.join(" | "));
  const s = value === undefined || value === null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function row(values) {
  return columns.map((key) => csvCell(values[key])).join(",");
}

function rawCandidate(q) {
  const aid = q.memoryAid || {};
  return {
    candidateId: `${q.id}-a`,
    type: aid.type || "",
    text: aid.text || "",
    claimKind: aid.source || aid.sourceUrl || aid.sourceClaim || aid.type === "teaching" ? "source-backed" : "none",
    source: aid.source || "",
    sourceUrl: aid.sourceUrl || "",
    sourceClaim: aid.sourceClaim || "",
    sourceStatus: aid.sourceUrl && aid.sourceClaim ? "found" : (aid.source ? "needs-url" : "not-needed"),
    styleNotes: "current aid",
  };
}

ensureDir(EXPORT_DIR);

for (const [group, items] of groups) {
  let candidateById = new Map();
  if (fs.existsSync(candidateFile(group))) {
    const packet = readJson(candidateFile(group));
    candidateById = new Map(packet.questions.map((q) => [q.id, q.candidates || []]));
  }

  const rows = [];
  for (const q of items) {
    const candidates = candidateById.get(q.id);
    const list = candidates && candidates.length ? candidates : [rawCandidate(q)];
    for (const c of list) {
      rows.push(row({
        group,
        id: q.id,
        chapter: q.chapter,
        reference: q.reference,
        topic: q.topic || "",
        questionType: q.type,
        question: q.question,
        answer: q.answer,
        options: q.options || [],
        acceptableAnswers: q.acceptableAnswers || [],
        candidateId: c.candidateId,
        memoryAidType: c.type,
        memoryAidText: c.text,
        claimKind: c.claimKind || "none",
        source: c.source || "",
        sourceUrl: c.sourceUrl || "",
        sourceClaim: c.sourceClaim || "",
        sourceStatus: c.sourceStatus || "",
        styleNotes: c.styleNotes || "",
      }));
    }
  }

  const header = columns.map(csvCell).join(",");
  if (chunkSize > 0) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));
    if (chunks.length > 1 && chunks[chunks.length - 1].length < 5) {
      chunks[chunks.length - 2].push(...chunks.pop());
    }
    chunks.forEach((chunk, index) => {
      const n = String(index + 1).padStart(2, "0");
      const out = path.join(EXPORT_DIR, `${group}.review-export.part-${n}.csv`);
      fs.writeFileSync(out, [header, ...chunk].join("\n") + "\n");
      console.log(`Wrote ${out} (${chunk.length} row(s))`);
    });
  } else {
    const out = path.join(EXPORT_DIR, `${group}.review-export.csv`);
    fs.writeFileSync(out, [header, ...rows].join("\n") + "\n");
    console.log(`Wrote ${out} (${rows.length} row(s))`);
  }
}
