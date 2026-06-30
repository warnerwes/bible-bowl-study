/**
 * Refiner Trial regression test.
 *
 * Verifies the post-Glory mode unlocks only after 100% mastery, weights
 * weak questions without making every deck identical, records timed-trial
 * stats, writes a best result, and unlocks faster levels after gold.
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

function allButOneMasteredStats(questions) {
  const rows = masteredStats(questions);
  delete rows[questions[questions.length - 1].id];
  return rows;
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
    if (data.level != null) {
      localStorage.setItem("bbs:refiner-level:v1", String(data.level));
    }
  }, seed);
  await page.goto(`http://127.0.0.1:${PORT}/index.html?qa=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.BibleBowlRefinerQA, null, { timeout: 8000 });
  return page;
}

async function answerRemainingCorrect(page) {
  for (let i = 0; i < 12; i++) {
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
}

const questions = JSON.parse(readFileSync(join(root, "data/questions.json"), "utf8"));
const weakQuestion = questions[0];
const secondWeakQuestion = questions[1];
const normalQuestion = questions[10];
const server = await startServer();
const browser = await chromium.launch();

try {
  const lockedPage = await openSeededPage(browser, { stats: {} });
  await lockedPage.waitForSelector("#refiner-trial-cta", { state: "attached", timeout: 8000 });
  const locked = await lockedPage.evaluate(() => ({
    unlocked: window.BibleBowlRefinerQA.isUnlocked(),
    hidden: document.getElementById("refiner-trial-cta").hidden,
    visible: !!document.getElementById("refiner-trial-cta")?.checkVisibility?.(),
  }));
  await lockedPage.close();

  const almostPage = await openSeededPage(browser, { stats: allButOneMasteredStats(questions) });
  await almostPage.waitForSelector("#refiner-trial-cta", { state: "attached", timeout: 8000 });
  const almost = await almostPage.evaluate(() => ({
    unlocked: window.BibleBowlRefinerQA.isUnlocked(),
    hidden: document.getElementById("refiner-trial-cta").hidden,
    visible: !!document.getElementById("refiner-trial-cta")?.checkVisibility?.(),
  }));
  await almostPage.close();

  const stats = masteredStats(questions);
  stats[weakQuestion.id] = { right: 3, wrong: 50, streak: 3, seen: 53 };
  stats[secondWeakQuestion.id] = { right: 3, wrong: 20, streak: 3, seen: 23 };
  const trialStats = { [weakQuestion.id]: { right: 0, wrong: 6, timeout: 3 } };
  const page = await openSeededPage(browser, { stats, trialStats });
  await page.waitForSelector("#refiner-trial-cta:not([hidden])", { timeout: 8000 });
  const unlockedCta = await page.evaluate(() => ({
    unlocked: window.BibleBowlRefinerQA.isUnlocked(),
    hidden: document.getElementById("refiner-trial-cta").hidden,
    glowing: document.getElementById("refiner-trial-cta").classList.contains("glory-ready"),
    copy: document.getElementById("refiner-trial-cta").textContent,
    levelInfo: window.BibleBowlRefinerQA.levelInfo(),
  }));
  const samples = await page.evaluate(() => window.BibleBowlRefinerQA.sampleDeckIds(12));
  const weights = await page.evaluate(() => window.BibleBowlRefinerQA.questionWeights());
  const weakAppearances = samples.filter((deck) => deck.includes(weakQuestion.id)).length;
  const variedDecks = new Set(samples.map((deck) => deck.join("|"))).size;

  await page.evaluate(() => window.BibleBowlRefinerQA.start());
  await page.waitForSelector("#refiner-modal.active", { timeout: 8000 });
  const started = await page.evaluate(() => window.BibleBowlRefinerQA.state());

  await page.evaluate(() => window.BibleBowlRefinerQA.answerWrong());
  await page.waitForSelector(".refiner-feedback.wrong", { timeout: 8000 });
  const afterWrong = await page.evaluate(() => window.BibleBowlRefinerQA.state());

  await answerRemainingCorrect(page);

  await page.waitForSelector(".refiner-result", { timeout: 8000 });
  const missedQuestionId = started.ids[0];
  const finished = await page.evaluate((firstId) => ({
    result: document.querySelector(".refiner-result")?.textContent || "",
    best: JSON.parse(localStorage.getItem("bbs:refiner-best:v1") || "null"),
    weakTrialStats: JSON.parse(localStorage.getItem("bbs:refiner-stats:v1") || "{}")[firstId],
  }), missedQuestionId);

  await page.evaluate(() => window.BibleBowlRefinerQA.start());
  await page.waitForSelector("#refiner-modal.active .refiner-question", { timeout: 8000 });
  await answerRemainingCorrect(page);
  await page.waitForSelector(".refiner-result", { timeout: 8000 });
  const goldFinished = await page.evaluate(() => ({
    result: document.querySelector(".refiner-result")?.textContent || "",
    best: JSON.parse(localStorage.getItem("bbs:refiner-best:v1") || "null"),
    level: localStorage.getItem("bbs:refiner-level:v1"),
    levelInfo: window.BibleBowlRefinerQA.levelInfo(),
    ctaCopy: document.getElementById("refiner-trial-cta").textContent,
  }));
  await page.close();

  const checks = [
    {
      name: "Refiner Trial stays locked before full mastery",
      ok: locked.hidden && !locked.visible && !locked.unlocked,
      detail: JSON.stringify(locked),
    },
    {
      name: "Refiner Trial stays hidden at 277/278 mastery",
      ok: almost.hidden && !almost.visible && !almost.unlocked,
      detail: JSON.stringify(almost),
    },
    {
      name: "Refiner Trial unlocks after Glory / 100% mastery",
      ok: unlockedCta.unlocked && !unlockedCta.hidden && unlockedCta.glowing && started.ids?.length === 5,
      detail: JSON.stringify({ cta: unlockedCta.copy, deck: started.ids }),
    },
    {
      name: "level timers ramp 15, 10, 7, 5, 4 seconds",
      ok: unlockedCta.levelInfo.levels.map((item) => item.seconds).join(",") === "15,10,7,5,4",
      detail: JSON.stringify(unlockedCta.levelInfo.levels),
    },
    {
      name: "weakest question has the highest sampling weight",
      ok: weights[weakQuestion.id] > weights[secondWeakQuestion.id] && weights[secondWeakQuestion.id] > weights[normalQuestion.id],
      detail: JSON.stringify({
        weak: weights[weakQuestion.id],
        second: weights[secondWeakQuestion.id],
        normal: weights[normalQuestion.id],
      }),
    },
    {
      name: "weighted decks vary across runs",
      ok: variedDecks > 1,
      detail: `unique=${variedDecks} samples=${samples.map((deck) => deck.join(",")).join(" | ")}`,
    },
    {
      name: "most-missed question appears in most sampled decks",
      ok: weakAppearances >= 8,
      detail: `${weakAppearances}/12 decks included ${weakQuestion.id}`,
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
      name: "trial records the intentional miss",
      ok: (finished.weakTrialStats?.wrong || 0) >= 1,
      detail: JSON.stringify(finished.weakTrialStats),
    },
    {
      name: "result screen renders",
      ok: /Refiner/.test(finished.result),
      detail: finished.result.trim(),
    },
    {
      name: "gold unlocks the next faster Refiner level",
      ok: goldFinished.level === "1" &&
        goldFinished.best?.tier === "gold" &&
        goldFinished.best?.level === 0 &&
        goldFinished.levelInfo.currentSeconds === 10 &&
        /Run next level|Level 2 unlocked/.test(goldFinished.result),
      detail: JSON.stringify(goldFinished),
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
