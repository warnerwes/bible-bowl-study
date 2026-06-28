// Regression test: run 3 scenarios and verify each behaves correctly.
//
// Scenario A: SUBMIT path — answer Q1, then verify the Next button is
// visible after the existing scrollToNextButton() runs (don't click Next).
//
// Scenario B: NEXT path (the bug we just fixed) — answer Q1, scroll down
// to read memory aid, click Next, verify Q2's question text is at the top.
//
// Scenario C: NEXT without scrolling — answer Q1, do NOT scroll, click
// Next, verify Q2's question text is at the top.
//
// For each scenario we exit the script if the behavior is wrong.

import { chromium } from "playwright";

const URL = "http://localhost:8765/index.html";
const VIEWPORT = { width: 900, height: 700 };
const pad = 14;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

const fail = [];
function check(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fail.push(name);
}

async function answerQ1() {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("button:has-text('Start')").first().click();
  await page.waitForSelector("#quiz:not([hidden])");
  await page.waitForTimeout(150);

  const isFillIn = (await page.locator("#fill-input").count()) > 0;
  if (isFillIn) await page.locator("#fill-input").fill("xxx");
  else await page.locator("button.option-btn").first().click();
  await page.locator("#submit-btn").click();
  await page.waitForSelector("#feedback:not([hidden])");
  await page.waitForTimeout(300);

  // open study guide
  await page.evaluate(() => {
    const t = document.getElementById("study-guide-toggle");
    if (t && !t.hidden) t.click();
  });
  await page.waitForTimeout(200);
}

// ---------- Scenario A: SUBMIT path ----------
console.log("\n=== Scenario A: SUBMIT path — Next button should be visible after submit ===");
await answerQ1();
const submitY = await page.evaluate(() => document.getElementById("next-btn").getBoundingClientRect().top);
const submitBottom = await page.evaluate(() => document.getElementById("next-btn").getBoundingClientRect().bottom);
const innerH = await page.evaluate(() => window.innerHeight);
check(
  "A1: Next button is fully visible in viewport after submit",
  submitY >= 0 && submitBottom <= innerH,
  `nextBtn.top=${submitY.toFixed(0)}  bottom=${submitBottom.toFixed(0)}  innerH=${innerH}`
);

// ---------- Scenario B: NEXT path (the bug) ----------
console.log("\n=== Scenario B: NEXT path — Q2 text should be at top of viewport after Next ===");
await answerQ1();
// Scroll way down (deep into memory aid)
await page.evaluate(() => {
  const quiz = document.getElementById("quiz");
  window.scrollTo({ top: quiz.scrollHeight + 200, behavior: "instant" });
});
await page.waitForTimeout(200);
await page.locator("#next-btn").click();
// Wait for smooth scroll to settle: poll scrollY until it stops changing.
await page.waitForTimeout(200); // give the smooth scroll time to start
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(80);
}
await page.waitForTimeout(80);
const B_top = await page.evaluate(() => document.querySelector("#q-text").getBoundingClientRect().top);
const B_q = await page.evaluate(() => document.querySelector("#q-text").textContent.slice(0, 60));
check(
  "B1: Q2 question text is at the top of viewport (within pad=14)",
  B_top >= 0 && B_top <= pad + 5,
  `qText.top=${B_top.toFixed(0)}  (expect 0..${pad + 5})  q="${B_q}…"`
);

// ---------- Scenario C: NEXT without scrolling ----------
console.log("\n=== Scenario C: NEXT without scrolling — Q2 text should still be at top ===");
await answerQ1();
// Don't scroll — Next button is already visible from the submit scroll
const nextVisible = await page.evaluate(() => {
  const r = document.getElementById("next-btn").getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
});
check("C0: Next button visible without manual scroll (sanity)", nextVisible);
await page.locator("#next-btn").click();
await page.waitForTimeout(200);
let lastY2 = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY2) break;
  lastY2 = y;
  await page.waitForTimeout(80);
}
await page.waitForTimeout(80);
const C_top = await page.evaluate(() => document.querySelector("#q-text").getBoundingClientRect().top);
const C_q = await page.evaluate(() => document.querySelector("#q-text").textContent.slice(0, 60));
check(
  "C1: Q2 question text is at the top of viewport (within pad=14)",
  C_top >= 0 && C_top <= pad + 5,
  `qText.top=${C_top.toFixed(0)}  (expect 0..${pad + 5})  q="${C_q}…"`
);

// ---------- Done ----------
console.log("\n=== SUMMARY ===");
if (fail.length) {
  console.log(`FAILED (${fail.length}): ${fail.join(", ")}`);
  process.exit(1);
} else {
  console.log("All scenarios pass ✓");
  process.exit(0);
}

await browser.close();