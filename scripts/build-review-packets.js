#!/usr/bin/env node
/* Build human-review packets from data/raw questions.
   Run: node scripts/build-review-packets.js [groupA]

   The packet preserves the current memory aid as candidate "a". Add more
   candidates manually, from Ollama, from Gemini, or from a bulk source export.
*/

const {
  candidateFile,
  loadQuestions,
  normalizeCandidate,
  reviewFile,
  writeJson,
} = require("./factory-utils");

const groupArg = process.argv[2];
const questions = loadQuestions(groupArg);
const groups = new Map();

for (const q of questions) {
  if (!groups.has(q._group)) groups.set(q._group, []);
  groups.get(q._group).push(q);
}

for (const [group, items] of groups) {
  const packet = {
    group,
    generatedAt: new Date().toISOString(),
    status: "draft",
    questions: items.map((q) => ({
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
    reviews: items.map((q) => ({
      id: q.id,
      osbAnswerVerified: false,
      selectedCandidateId: "",
      reviewers: [],
      notes: "",
    })),
  };

  writeJson(candidateFile(group), packet);
  writeJson(reviewFile(group), review);
  console.log(`Wrote ${items.length} review packets for ${group}`);
}
