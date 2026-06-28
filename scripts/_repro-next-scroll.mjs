// Reproduce the "Next button leaves page scrolled to bottom" bug.
// Strategy: open app, start a quiz, click the FIRST option (wrong is fine
// for this bug — we only care about scroll behavior), submit, simulate
// scrolling down to read feedback, click Next, measure Q2's position.

import { chromium } from "playwright";

const URL = "http://localhost:8765/index.html";
const VIEWPORT = { width: 900, height: 700 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE.ERR:", m.text());
});

await page.goto(URL, { waitUntil: "networkidle" });

// Start the quiz (the home screen has a Start button)
await page.locator("button:has-text('Start')").first().click();
await page.waitForSelector("#quiz:not([hidden])");
await page.waitForTimeout(150);

async function snap(label) {
  const data = await page.evaluate(() => {
    const q = document.getElementById("q-text");
    const rect = q ? q.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      innerH: window.innerHeight,
      qTop: rect ? rect.top : null,
      qText: q ? q.textContent.slice(0, 70) : null,
    };
  });
  console.log(
    `[${label}] scrollY=${data.scrollY.toFixed(0)}  innerH=${data.innerH}  qText.top=${data.qTop?.toFixed(0)}  q="${data.qText}…"`
  );
}

await snap("Q1 first render");

// Pick whichever answer type Q1 is
const isFillIn = (await page.locator("#fill-input").count()) > 0;
if (isFillIn) {
  console.log("Q1 type: fill-in → typing dummy text 'xxx'");
  await page.locator("#fill-input").fill("xxx");
} else {
  const optCount = await page.locator("button.option-btn").count();
  console.log(`Q1 type: MC with ${optCount} options → clicking first`);
  await page.locator("button.option-btn").first().click();
}

await page.locator("#submit-btn").click();
await page.waitForSelector("#feedback:not([hidden])");
await page.waitForTimeout(300);

// Open study guide if available so memory aid takes up vertical space
await page.evaluate(() => {
  const t = document.getElementById("study-guide-toggle");
  if (t && !t.hidden) t.click();
});
await page.waitForTimeout(200);

await snap("after submit (feedback + memory aid)");

// Simulate the user scrolling DOWN to read everything
await page.evaluate(() => {
  // Scroll to the bottom of the quiz screen
  const quiz = document.getElementById("quiz");
  window.scrollTo({ top: quiz.scrollHeight + 200, behavior: "instant" });
});
await page.waitForTimeout(150);
await snap("after scrolling down (user reading memory aid)");

// === Click Next and measure Q2's position ===
const before = await page.evaluate(() => ({ scrollY: window.scrollY }));
await page.locator("#next-btn").click();
await page.waitForTimeout(700); // let any scroll animation settle

const after = await page.evaluate(() => {
  const q = document.getElementById("q-text");
  const rect = q ? q.getBoundingClientRect() : null;
  return {
    scrollY: window.scrollY,
    innerH: window.innerHeight,
    qTop: rect ? rect.top : null,
    qText: q ? q.textContent.slice(0, 70) : null,
  };
});

console.log("\n=== BEFORE vs AFTER ===");
console.log(`scrollY:    ${before.scrollY}  →  ${after.scrollY.toFixed(0)}`);
console.log(`qText.top:  ${after.qTop?.toFixed(0)}  (Q2: "${after.qText}…")`);

const innerH = after.innerH;
const t = after.qTop;
const verdict = (t < 0)
  ? `✗ BUG REPRODUCED — Q2 is ${Math.abs(t).toFixed(0)}px ABOVE the viewport top. User must scroll UP to see the question.`
  : (t < innerH * 0.25)
    ? `✓ Question text is near the top of the viewport.`
    : `⚠ Question is on-screen but in the middle/lower portion (top=${t.toFixed(0)}px / innerH=${innerH}).`;

console.log(`\nVERDICT: ${verdict}`);

await page.screenshot({ path: "/tmp/bbs-after-next.png", fullPage: false });
console.log("\nScreenshot: /tmp/bbs-after-next.png");

await browser.close();
process.exit(t < 0 ? 1 : 0);