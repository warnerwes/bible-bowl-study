// Verify the showResults denominator fix
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`[ERR] ${e.message}`));

// Seed stats: only 1 question is "due" (in drill pool)
const seed = {};
// Pick a real question from the bank
const questions = await (await fetch("http://localhost:8765/data/questions.json")).json();
const target = questions[0].id;
seed[target] = { streak: 0, right: 0, wrong: 1, seen: 1 };

await page.goto("http://localhost:8765/index.html");
await page.waitForLoadState("networkidle");
await page.evaluate((s) => {
  localStorage.setItem("bbs:stats:v1", JSON.stringify(s));
}, seed);
await page.reload();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);

// Check what's due
const dueCount = await page.evaluate(() => {
  const stats = JSON.parse(localStorage.getItem("bbs:stats:v1") || "{}");
  return {
    statsKeys: Object.keys(stats).slice(0, 5),
    statsForTarget: stats["ex01-001"],
    dueQuestionsExist: typeof window.state !== "undefined",
    missedCtaHidden: document.querySelector("#missed-cta")?.hidden,
    missedCount: document.querySelector("#missed-count")?.textContent,
    drillBtnVisible: document.querySelector("#drill-missed")?.offsetParent !== null,
  };
});
console.log("Setup state:", dueCount);

// Click "Drill my missed questions" — should launch a 1-question quiz
await page.locator("#drill-missed").click({ force: true });
await page.waitForTimeout(800);

const position1 = await page.locator("#q-position").textContent();
console.log("Drill started, position:", position1);

// Answer wrong
await page.evaluate(() => {
  const opts = document.querySelectorAll(".option-btn");
  const input = document.querySelector("#fill-input");
  if (input) {
    input.value = "wrong answer xyz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (opts.length) {
    opts[0].click();
  }
});
await page.waitForTimeout(200);
await page.evaluate(() => {
  const form = document.querySelector("#answer-form");
  if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
});
await page.waitForTimeout(500);

// Click Next → should go to results
const nextBtnVisible = await page.locator("#next-btn").isVisible().catch(() => false);
console.log("Next btn visible:", nextBtnVisible);
await page.evaluate(() => document.querySelector("#next-btn")?.click());
await page.waitForTimeout(800);

const result = await page.evaluate(() => ({
  score: document.querySelector("#result-score")?.textContent?.trim(),
  onResults: !document.querySelector("#results")?.hidden,
}));
console.log("Results screen:", result);

await page.screenshot({ path: "/tmp/quiz-verify/drill-1q-result.png", fullPage: true });
await browser.close();