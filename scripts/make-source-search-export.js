#!/usr/bin/env node
/* Create one large prompt for ChatGPT Pro / Google / Gemini source hunting.
   Run: node scripts/make-source-search-export.js [groupA]
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
const questions = loadQuestions(groupArg);
const groups = new Map();

for (const q of questions) {
  if (!groups.has(q._group)) groups.set(q._group, []);
  groups.get(q._group).push(q);
}

ensureDir(EXPORT_DIR);

for (const [group, items] of groups) {
  let candidatePacket = null;
  if (fs.existsSync(candidateFile(group))) candidatePacket = readJson(candidateFile(group));
  const candidateById = new Map((candidatePacket && candidatePacket.questions || []).map((q) => [q.id, q]));

  const lines = [
    "# Source Lookup Batch",
    "",
    "Find credible public source URLs for the memory aids below.",
    "",
    "Rules:",
    "- Orthodox Study Bible verifies the question answers separately; do not verify answers here.",
    "- For teaching, typology, historical context, or surprising-fact claims, provide sourceUrl and sourceClaim.",
    "- Prefer primary/near-primary sources: Scripture, New Advent/CCEL/Fordham for Fathers, Ancient Faith pages/transcripts when available.",
    "- If a claim is only a memory image or mnemonic, mark claimKind as none.",
    "- Do not invent citations. If no credible source is found, set sourceUrl and sourceClaim to empty strings and sourceStatus to no-source-found.",
    "",
    "Return valid JSON only:",
    "[",
    "  {",
    "    \"id\": \"ex00-000\",",
    "    \"candidateId\": \"ex00-000-a\",",
    "    \"claimKind\": \"source-backed|none\",",
    "    \"source\": \"short source label\",",
    "    \"sourceUrl\": \"https://...\",",
    "    \"sourceClaim\": \"what the linked source actually supports\",",
    "    \"sourceStatus\": \"found|no-source-found\"",
    "  }",
    "]",
    "",
    "Questions:",
  ];

  for (const q of items) {
    const cq = candidateById.get(q.id);
    const candidates = cq ? cq.candidates : [{
      candidateId: `${q.id}-a`,
      type: q.memoryAid.type,
      text: q.memoryAid.text,
      source: q.memoryAid.source || "",
    }];
    lines.push("");
    lines.push(`## ${q.id} (${q.reference})`);
    lines.push(`Question: ${q.question}`);
    lines.push(`Answer: ${q.answer}`);
    for (const c of candidates) {
      lines.push(`- candidateId: ${c.candidateId}`);
      lines.push(`  type: ${c.type}`);
      lines.push(`  text: ${c.text}`);
      if (c.source) lines.push(`  source label: ${c.source}`);
    }
  }

  const out = path.join(EXPORT_DIR, `${group}.source-search-prompt.md`);
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(`Wrote ${out}`);
}
