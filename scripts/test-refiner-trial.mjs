/**
 * Refiner Trial regression test.
 *
 * Verifies the post-mastery mode unlocks only after every question is
 * mastered, prioritizes weak questions, records timed-trial stats, and
 * writes a best result.
 *
 * Run: node scripts/test-refiner-trial.mjs
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = 9882;
const errors = [];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const cleanUrl = (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html";
      const path = join(root, cleanUrl);
      if (!existsSync(path)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
      res.end(readFileSync(path));
    });
    server.listen(PORT, () => resolve(server));
  });
}

function masteredStats(questions) {
  return Object.fromEntries(
    questions.map((q) => [q.id, { right: 3, wrong: 0, streak: 3, seen: 3 }])
  );
}

async function openSeededPage(browser, seed) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.route("**/sw.js", (route) => route.abort());
  await page.addInitScript((data) => {
    localStorage.clear();
    localStorage.setItem("bbs:stats:v1", JSON.stringify(data.stats));
    if (data.trialStats) {
      localStorage.setItem("bbs:refiner-stats:v1", JSON.stringify(data.trialStats));
    }
  }, seed);
  await page.goto(`http://127.0.0.1:${PORT}/index.html?qa=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.BibleBowlRefinerQA, null, { timeout: 8000 });
  return page;
}

const questions = JSON.parse(readFileSync(join(root, "data/questions.json"), "utf8"));
const weakQuestion = questions[0];
const secondWeakQuestion = questions[1];
const server = await startServer();
const browser = await chromium.launch();

try {
  const lockedPage = await openSeededPage(browser, { stats: {} });
  await lockedPage.waitForSelector("#refiner-trial-cta", { timeout: 8000 });
  const locked = await lockedPage.evaluate(() => ({
    unlocked: window.BibleBowlRefinerQA.isUnlocked(),
    hidden: document.getElementById("refiner-trial-cta").hidden,
  }));
  await lockedPage.close();

  const stats = masteredStats(questions);
  stats[weakQuestion.id] = { right: 3, wrong: 8, streak: 3, seen: 11 };
  stats[secondWeakQuestion.id] = { right: 3, wrong: 5, streak: 3, seen: 8 };
  const trialStats = { [weakQuestion.id]: { right: 0, wrong: 2, timeout: 1 } };
  const page = await openSeededPage(browser, { stats, trialStats });
  await page.waitForSelector("#refiner-trial-cta:not([hidden])", { timeout: 8000 });

  await page.evaluate(() => window.BibleBowlRefinerQA.start());
  await page.waitForSelector("#refiner-modal.active", { timeout: 8000 });
  const started = await page.evaluate(() => window.BibleBowlRefinerQA.state());

  await page.evaluate(() => window.BibleBowlRefinerQA.answerWrong());
  await page.waitForSelector(".refiner-feedback.wrong", { timeout: 8000 });
  const afterWrong = await page.evaluate(() => window.BibleBowlRefinerQA.state());

  for (let i = 0; i < 8; i++) {
    const showingQuestion = await page.evaluate(
      () => !!document.querySelector("#refiner-modal.active .refiner-question")
    );
    if (!showingQuestion) break;
    const state = await page.evaluate(() => window.BibleBowlRefinerQA.state());
    if (!state.answered) {
      await page.evaluate(() => window.BibleBowlRefinerQA.answerCorrect());
      await page.waitForSelector(".refiner-feedback", { timeout: 8000 });
    }
    const buttonText = await page.evaluate(
      () => document.querySelector(".refiner-feedback button")?.textContent || ""
    );
    await page.evaluate(() => window.BibleBowlRefinerQA.next());
    if (/result/i.test(buttonText)) break;
  }

  await page.waitForSelector(".refiner-result", { timeout: 8000 });
  const finished = await page.evaluate((firstId) => ({
    result: document.querySelector(".refiner-result")?.textContent || "",
    best: JSON.parse(localStorage.getItem("bbs:refiner-best:v1") || "null"),
    weakTrialStats: JSON.parse(localStorage.getItem("bbs:refiner-stats:v1") || "{}")[firstId],
  }), weakQuestion.id);
  await page.close();

  const checks = [
    {
      name: "Refiner Trial stays locked before full mastery",
      ok: locked.hidden && !locked.unlocked,
      detail: JSON.stringify(locked),
    },
    {
      name: "Refiner Trial unlocks after full mastery",
      ok: started.ids?.length === 5,
      detail: `deck=${started.ids?.join(",")}`,
    },
    {
      name: "weakest question is first in the trial deck",
      ok: started.ids?.[0] === weakQuestion.id,
      detail: `expected=${weakQuestion.id} actual=${started.ids?.[0]}`,
    },
    {
      name: "wrong answer costs one life",
      ok: afterWrong.lives === 2 && afterWrong.answered,
      detail: JSON.stringify(afterWrong),
    },
    {
      name: "trial records best result",
      ok: finished.best?.total === 5 && finished.best?.correct >= 4,
      detail: JSON.stringify(finished.best),
    },
    {
      name: "trial records additional weak-question miss",
      ok: (finished.weakTrialStats?.wrong || 0) >= 3,
      detail: JSON.stringify(finished.weakTrialStats),
    },
    {
      name: "result screen renders",
      ok: /Refiner/.test(finished.result),
      detail: finished.result.trim(),
    },
  ];

  let failed = errors.length;
  console.log("\n=== Refiner Trial QA ===\n");
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}${check.detail ? " - " + check.detail : ""}`);
    if (!check.ok) failed++;
  }
  if (errors.length) {
    console.log("\nPage/console errors:");
    errors.forEach((error) => console.log(`  - ${error}`));
  }
  console.log(failed ? `\n${failed} failure(s).` : `\nAll ${checks.length} refiner checks passed.`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
  server.close();
}
