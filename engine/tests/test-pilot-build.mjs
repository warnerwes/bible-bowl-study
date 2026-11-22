import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const buildScript = path.join(root, "generator", "pilots", "corinthians", "build-site.mjs");
const siteDir = path.join(root, "generator", "pilots", "corinthians", "_site");

test("pilot build includes the parish home, data notice, and a complete reading plan", async () => {
  await execFileAsync("node", [buildScript], { cwd: root });
  const indexHtml = readFileSync(path.join(siteDir, "index.html"), "utf8");
  assert.match(indexHtml, /<script type="module" src="parish-app\.js">/);
  assert.match(indexHtml, /href="privacy\.html"/);
  assert.match(indexHtml, /href="reading\.html"/);
  assert.match(readFileSync(path.join(siteDir, "privacy.html"), "utf8"), /session storage/);

  const readData = name => JSON.parse(readFileSync(path.join(siteDir, "data", name), "utf8"));
  const config = readData("site-config.json");
  const lesson = readData("lesson.json");
  const plan = readData("reading-plan.json");
  const { visibleQuestions, sessionQuestions, safeSourceUrl } =
    await import(pathToFileURL(path.join(siteDir, "content-policy.js")).href);
  const cards = visibleQuestions(readData("questions.json"), config, "bible-bowl-study.web.app");

  assert.equal(config.bibleVersion, "NKJV");
  assert.equal(plan.weeks.length, 15);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const week of plan.weeks) {
    const round = sessionQuestions(cards, week.week === lesson.week ? lesson : week);
    assert.equal(round.length, 5, `Week ${week.week} should offer five questions`);
    assert.deepEqual([...new Set(round.map(card => card.chapter))], week.chapters);
  }
  for (const card of cards) {
    assert.ok(card.options.includes(card.answer), card.id);
    assert.equal(card.memoryAid?.type, "teaching", card.id);
    assert.ok(safeSourceUrl(card.memoryAid.sourceUrl), card.id);
  }
});
