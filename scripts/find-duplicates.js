#!/usr/bin/env node
/* Duplicate / redundancy detector for the question library — runs locally,
   no LLM tokens. Reads data/questions.json and reports three kinds of overlap:

     1. NEAR-IDENTICAL   two questions worded almost the same (char-trigram sim)
     2. SAME FACT        two questions with the same answer + similar wording
     3. ANSWER LEAK      one question's stem contains another's answer
                         (catches "circular" pairs that feel like a repeat)

   Usage:  node scripts/find-duplicates.js
   Most "hits" are benign (parallel sets like the Ten Commandments, or a
   chapter's topic word recurring as context). Use it as a review aid, not an
   auto-fixer — eyeball each flagged pair and decide. */

const fs = require("fs");
const path = require("path");

const all = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "questions.json"), "utf8"));

const STOP = new Set(
  "the a an of to in on at is are was were be been did do does what which who whom how many when where why that this these those for and or but with as by from into over upon not no your you his her its their he she it they them".split(" ")
);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter((w) => w && !STOP.has(w)));
const trig = (s) => { s = norm(s); const g = new Set(); for (let i = 0; i < s.length - 2; i++) g.add(s.slice(i, i + 3)); return g; };
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const ansKey = (s) => norm(s).replace(/\b(also called|day|th|st|nd|rd)\b/g, " ").replace(/\s+/g, " ").trim();
const byId = Object.fromEntries(all.map((q) => [q.id, q]));

// ---- 1. near-identical wording ----
const near = [];
const pre = all.map((q) => ({ q, t: trig(q.question) }));
for (let i = 0; i < pre.length; i++)
  for (let j = i + 1; j < pre.length; j++) {
    const cs = jac(pre[i].t, pre[j].t);
    if (cs >= 0.7) near.push({ a: pre[i].q.id, b: pre[j].q.id, cs: +cs.toFixed(2) });
  }

// ---- 2. same fact (same answer, similar question), excluding true/false ----
const groups = {};
for (const q of all) {
  if (q.type === "true-false") continue;
  const k = ansKey(q.answer);
  if (k && k.length >= 2) (groups[k] = groups[k] || []).push(q);
}
const sameFact = [];
for (const k in groups) {
  const g = groups[k];
  for (let i = 0; i < g.length; i++)
    for (let j = i + 1; j < g.length; j++) {
      const ws = jac(words(g[i].question), words(g[j].question));
      if (ws >= 0.35) sameFact.push({ a: g[i].id, b: g[j].id, ws: +ws.toFixed(2), ans: g[i].answer });
    }
}

// ---- 3. answer leaked into another question's stem (same chapter) ----
const SKIP = new Set(["true", "false", "yes", "no"]);
const wrap = (s) => " " + norm(s) + " ";
const leaks = [];
for (const A of all) {
  const key = ansKey(A.answer);
  if (!key || SKIP.has(key) || key.length < 4) continue;
  for (const B of all) {
    if (A.id === B.id || A.chapter !== B.chapter) continue;
    if (wrap(B.question).includes(" " + key + " ")) {
      const mutual = ansKey(B.answer).length >= 4 && wrap(A.question).includes(" " + ansKey(B.answer) + " ");
      leaks.push({ stem: B.id, reveals: A.id, answer: A.answer, mutual });
    }
  }
}

function section(title, rows, fmt) {
  console.log("\n=== " + title + " (" + rows.length + ") ===");
  rows.forEach((r) => fmt(r));
}
section("1. Near-identical wording (sim ≥ 0.70)", near.sort((x, y) => y.cs - x.cs), (r) => {
  console.log(`  [${r.cs}] ${r.a}: ${byId[r.a].question}`);
  console.log(`        ${r.b}: ${byId[r.b].question}`);
});
section("2. Same answer + similar question (sim ≥ 0.35)", sameFact.sort((x, y) => y.ws - x.ws), (r) => {
  console.log(`  [${r.ws}] ans "${r.ans}"`);
  console.log(`        ${r.a}: ${byId[r.a].question}`);
  console.log(`        ${r.b}: ${byId[r.b].question}`);
});
section("3. Answer leaked into another stem (★ = mutual/circular)", leaks.sort((a, b) => (b.mutual ? 1 : 0) - (a.mutual ? 1 : 0)), (r) => {
  console.log(`  ${r.mutual ? "★" : " "} [${r.stem}] stem contains the answer of [${r.reveals}] = "${r.answer}"`);
});

console.log(`\nScanned ${all.length} questions. Review flagged pairs by hand — many are intentional parallels or benign context.`);
