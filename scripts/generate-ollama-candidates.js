#!/usr/bin/env node
/* Add cheap local Ollama memory-aid candidates to a review packet.
   Requires Ollama running locally.
   Run: node scripts/generate-ollama-candidates.js groupA llama3.1
*/

const {
  candidateFile,
  normalizeCandidate,
  readJson,
  writeJson,
} = require("./factory-utils");

const group = process.argv[2];
const model = process.argv[3] || process.env.OLLAMA_MODEL || "llama3.1";
const limit = Number(process.env.LIMIT || "0");

if (!group) {
  console.error("Usage: node scripts/generate-ollama-candidates.js <groupA> [model]");
  process.exit(1);
}

function prompt(q) {
  return `You write Bible Bowl memory aids for kids and teens.

Rules:
- Orthodox Study Bible answer is already fixed; do not change it.
- Write 3 candidates that are memorable, vivid, almost clickbait, but reverent and accurate.
- Use one mnemonic, one image, and one teaching only if a credible source would be needed.
- Do not invent sources. Leave source fields empty unless the source is obvious from the provided Scripture reference.
- Return JSON only.

Question: ${q.question}
Answer: ${q.answer}
Reference: ${q.reference}
Current aid candidates:
${q.candidates.map((c) => `- ${c.type}: ${c.text}`).join("\n")}

Return:
[
  {"type":"mnemonic|image|teaching","text":"...","claimKind":"none|source-backed","source":"","sourceUrl":"","sourceClaim":""}
]`;
}

async function generate(q) {
  const res = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: prompt(q),
      stream: false,
      options: { temperature: 0.85 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.response.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(text);
}

(async () => {
  const packet = readJson(candidateFile(group));
  const items = limit ? packet.questions.slice(0, limit) : packet.questions;
  let added = 0;

  for (const q of items) {
    const existing = new Set(q.candidates.map((c) => c.text));
    const nextIndex = q.candidates.length;
    try {
      const generated = await generate(q);
      generated.forEach((c, i) => {
        const candidate = normalizeCandidate(q, {
          ...c,
          candidateId: `${q.id}-${String.fromCharCode(97 + nextIndex + i)}`,
          sourceStatus: c.claimKind === "source-backed" ? "needs-url" : "not-needed",
          styleNotes: `ollama:${model}`,
        }, nextIndex + i);
        if (!existing.has(candidate.text)) {
          q.candidates.push(candidate);
          added++;
        }
      });
      console.log(`${q.id}: added candidates`);
    } catch (e) {
      console.error(`${q.id}: ${e.message}`);
    }
  }

  packet.updatedAt = new Date().toISOString();
  writeJson(candidateFile(group), packet);
  console.log(`Added ${added} candidate(s) with ${model}.`);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
