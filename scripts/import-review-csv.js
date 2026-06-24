#!/usr/bin/env node
/* Import completed Pro-review CSV rows into data/candidates and data/reviews.
   Run: node scripts/import-review-csv.js <review-export.csv>

   This preserves the model's recommendation as candidate data. It does not
   mark OSB answer verification true, and it does not auto-select a final aid.
*/

const fs = require("fs");
const path = require("path");
const {
  candidateFile,
  loadQuestions,
  normalizeCandidate,
  readJson,
  reviewFile,
  writeJson,
} = require("./factory-utils");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-review-csv.js <review-export.csv>");
  process.exit(1);
}

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
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])));
}

function ensurePacket(group) {
  if (fs.existsSync(candidateFile(group)) && fs.existsSync(reviewFile(group))) return;
  const questions = loadQuestions(group);
  const packet = {
    group,
    generatedAt: new Date().toISOString(),
    status: "draft",
    questions: questions.map((q) => ({
      id: q.id,
      chapter: q.chapter,
      reference: q.reference,
      topic: q.topic || "",
      type: q.type,
      question: q.question,
      answer: q.answer,
      options: q.options || [],
      acceptableAnswers: q.acceptableAnswers || [],
      candidates: [
        normalizeCandidate(q, {
          candidateId: `${q.id}-a`,
          type: q.memoryAid && q.memoryAid.type,
          text: q.memoryAid && q.memoryAid.text,
          source: q.memoryAid && q.memoryAid.source,
          sourceStatus: q.memoryAid && q.memoryAid.source ? "needs-url" : "not-needed",
          styleNotes: "current aid",
        }, 0),
      ],
    })),
  };
  const review = {
    group,
    updatedAt: new Date().toISOString(),
    reviews: questions.map((q) => ({
      id: q.id,
      osbAnswerVerified: false,
      selectedCandidateId: "",
      reviewers: [],
      notes: "",
    })),
  };
  writeJson(candidateFile(group), packet);
  writeJson(reviewFile(group), review);
}

function normalizeSourceStatus(status) {
  if (status === "verified" || status === "supported") return "found";
  return status;
}

const rows = objectRows(fs.readFileSync(path.resolve(file), "utf8"));
const groups = [...new Set(rows.map((r) => r.group).filter(Boolean))];
if (!groups.length) {
  console.error("No group values found in CSV.");
  process.exit(1);
}

let imported = 0;
let annotated = 0;

for (const group of groups) {
  ensurePacket(group);
  const packet = readJson(candidateFile(group));
  const review = readJson(reviewFile(group));
  const questionById = new Map(packet.questions.map((q) => [q.id, q]));
  const reviewById = new Map((review.reviews || []).map((r) => [r.id, r]));

  for (const r of rows.filter((row) => row.group === group)) {
    const q = questionById.get(r.id);
    if (!q) continue;

    if (r.agentVerdict || r.agentReason) {
      const rr = reviewById.get(r.id);
      if (rr) {
        const note = `[agent:${r.agentVerdict || "reviewed"}] ${r.agentReason || ""}`.trim();
        const notes = rr.notes ? rr.notes.split("\n") : [];
        if (!notes.includes(note)) rr.notes = notes.length ? `${rr.notes}\n${note}` : note;
        annotated++;
      }
    }

    if (!r.replacementText) continue;
    const base = `${r.id}-agent`;
    let n = 1;
    let candidateId = `${base}-${n}`;
    const existingIds = new Set(q.candidates.map((c) => c.candidateId));
    const existingText = new Set(q.candidates.map((c) => c.text));
    while (existingIds.has(candidateId)) {
      n++;
      candidateId = `${base}-${n}`;
    }
    if (existingText.has(r.replacementText)) continue;

    q.candidates.push(normalizeCandidate(q, {
      candidateId,
      type: r.replacementType,
      text: r.replacementText,
      claimKind: r.replacementClaimKind,
      source: r.replacementSource,
      sourceUrl: r.replacementSourceUrl,
      sourceClaim: r.replacementSourceClaim,
      sourceStatus: normalizeSourceStatus(r.replacementSourceStatus),
      styleNotes: `agentVerdict=${r.agentVerdict}; ${r.agentReason}`,
    }, q.candidates.length));
    imported++;
  }

  packet.updatedAt = new Date().toISOString();
  review.updatedAt = new Date().toISOString();
  writeJson(candidateFile(group), packet);
  writeJson(reviewFile(group), review);
}

console.log(`Imported ${imported} replacement candidate(s); annotated ${annotated} review row(s).`);
