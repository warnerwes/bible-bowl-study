/**
 * Regression coverage for Exodus Wonder unlock thresholds and the first
 * mastery progress bar.
 *
 * Run: node scripts/test-reward-thresholds.mjs
 */
import assert from "assert/strict";
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const questions = JSON.parse(readFileSync(join(root, "data/questions.json"), "utf8"));
const total = questions.length;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = url === "/" ? "index.html" : url.replace(/^\//, "");
      const file = join(root, rel);
      if (!existsSync(file) || !file.startsWith(root)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "text/plain" });
      res.end(readFileSync(file));
    });
    server.listen(0, () => resolve(server));
  });
}

const expectedTargets = {
  red_sea: 1,
  marah: 6,
  elim: Math.ceil(total * 0.05),
  manna: Math.ceil(total * 0.12),
  rephidim: Math.ceil(total * 0.22),
  sinai: Math.ceil(total * 0.38),
  golden_calf: Math.ceil(total * 0.60),
  glory: total,
};

const server = await startServer();
const port = server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

try {
  await page.goto(`http://127.0.0.1:${port}/index.html?qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BibleBowlQA?.rewardThresholds?.().total > 0);

  const resolved = await page.evaluate(() => window.BibleBowlQA.rewardThresholds());
  const actualTargets = Object.fromEntries(resolved.thresholds.map((item) => [item.id, item.target]));
  assert.equal(resolved.total, total, "QA hook should use the loaded question-bank total");
  assert.deepEqual(actualTargets, expectedTargets, "reward thresholds should resolve to the ramping mastery curve");

  await page.evaluate((bankTotal) => {
    localStorage.removeItem("bbs:unlocked-rewards:v1");
    localStorage.setItem("bbs:stats:v1", JSON.stringify({
      close_question: { right: 2, wrong: 0, streak: 2, seen: 2 },
      started_question: { right: 1, wrong: 0, streak: 1, seen: 1 },
    }));
    window.dispatchEvent(new CustomEvent("bbs:stats-updated", { detail: { total: bankTotal } }));
  }, total);

  await page.waitForFunction(() => window.BibleBowlQA.nextProgress().id === "red_sea");
  const firstProgress = await page.evaluate(() => ({
    next: window.BibleBowlQA.nextProgress(),
    count: document.getElementById("rewards-next-count")?.textContent || "",
    ariaNow: document.getElementById("rewards-next-bar")?.getAttribute("aria-valuenow") || "",
    fillWidth: document.getElementById("rewards-next-fill")?.style.width || "",
  }));
  assert.equal(firstProgress.next.id, "red_sea");
  assert.match(firstProgress.count, /2 of 3/, "first reward should show closest streak toward mastery");
  assert.equal(firstProgress.ariaNow, "67");
  assert.equal(firstProgress.fillWidth, "67%");

  await page.evaluate((bankTotal) => {
    localStorage.removeItem("bbs:unlocked-rewards:v1");
    localStorage.setItem("bbs:stats:v1", JSON.stringify({
      first_mastered: { right: 3, wrong: 0, streak: 3, seen: 3 },
    }));
    window.dispatchEvent(new CustomEvent("bbs:stats-updated", { detail: { total: bankTotal } }));
  }, total);

  await page.waitForFunction(() => window.BibleBowlQA.nextProgress().id === "marah");
  const afterFirstMastery = await page.evaluate(() => ({
    next: window.BibleBowlQA.nextProgress(),
    count: document.getElementById("rewards-next-count")?.textContent || "",
  }));
  assert.equal(afterFirstMastery.next.id, "marah");
  assert.match(afterFirstMastery.count, /5 more to master/);

  assert.deepEqual(pageErrors, [], "page should not throw while evaluating reward thresholds");
  console.log("Reward threshold checks passed:");
  console.log(`  total questions: ${total}`);
  console.log(`  targets: ${JSON.stringify(expectedTargets)}`);
  console.log("  first reward progress: closest streak displays 2 of 3");
} finally {
  await browser.close();
  server.close();
}
