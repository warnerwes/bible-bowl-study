#!/usr/bin/env node
/* Build data/vote-sink.json from a Google Forms pre-filled link.
   Run:
   node scripts/create-vote-sink-from-prefill.js "<prefilled URL>"

   In the prefilled link, each field value should be one of:
   questionId, reference, choiceId, currentCandidateId, alternateCandidateId,
   chosenText, mode, answeredCorrectly, votedAt
*/

const { URL } = require("url");
const path = require("path");
const { ROOT, writeJson } = require("./factory-utils");

const prefillUrl = process.argv[2];
if (!prefillUrl) {
  console.error("Usage: node scripts/create-vote-sink-from-prefill.js \"<Google Forms pre-filled URL>\"");
  process.exit(1);
}

const allowed = new Set([
  "questionId",
  "reference",
  "choiceId",
  "currentCandidateId",
  "alternateCandidateId",
  "chosenText",
  "mode",
  "answeredCorrectly",
  "votedAt",
]);

const url = new URL(prefillUrl);
const fields = {};
for (const [key, value] of url.searchParams.entries()) {
  if (key.startsWith("entry.") && allowed.has(value)) fields[value] = key;
}

const missing = [...allowed].filter((key) => !fields[key]);
if (missing.length) {
  console.error(`Missing prefilled field value(s): ${missing.join(", ")}`);
  process.exit(1);
}

const action = `${url.origin}${url.pathname.replace(/\/viewform$/, "/formResponse")}`;
writeJson(path.join(ROOT, "data", "vote-sink.json"), {
  enabled: true,
  action,
  fields,
});

console.log("Wrote data/vote-sink.json");
console.log(action);
