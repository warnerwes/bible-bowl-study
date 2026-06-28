// Reproduce and verify the PWA back-button fix.
//
// PWA context: when a phone user hits the system back button on a PWA,
// the browser fires `popstate` if there's history, otherwise the PWA
// window closes. Our fix uses pushState + popstate so back navigates
// within the quiz instead of closing.
//
// Scenarios:
//   A. Back from Q3 → Q2 (most important — the bug)
//   B. Back from Q1 → setup screen
//   C. Next + Back sequence: Q1 → Q2 (Next) → Q1 (back) → Q2 (back? no, Next again)
//   D. Back from results → last quiz question
//   E. Reload from mid-quiz → goes to setup (option A behavior)
//
// Each scenario uses a fresh page so state doesn't leak.

import { chromium } from "playwright";

const URL = "http://localhost:8765/index.html";
const VIEWPORT = { width: 390, height: 844 }; // iPhone 13 size

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE.ERR:", m.text());
});

const fail = [];
function check(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fail.push(name);
}

async function freshPage() {
  await page.goto(URL, { waitUntil: "networkidle" });
  // Use the custom quiz builder so we can limit to 10 questions.
  // Without this, the default quick quiz pulls 273 questions and any
  // scenario that needs to reach results would take minutes.
  await page.locator("#toggle-advanced").click();
  await page.waitForSelector("#advanced:not([hidden])");
  // Deselect all chapters, then select just chapter 1 (has the most questions).
  // Actually easier: leave default chapter selection, just change count to 10.
  await page.selectOption("#count", "10");
  await page.locator("#start-btn").click();
  await page.waitForSelector("#quiz:not([hidden])");
  await page.waitForTimeout(150);
}

async function snapshot(label) {
  const s = await page.evaluate(() => {
    const visibleScreen = ["setup", "quiz", "results"].find(
      (id) => !document.getElementById(id).hidden
    );
    const q = document.querySelector("#q-text");
    return {
      visibleScreen,
      url: location.pathname + location.search + location.hash,
      qText: q ? q.textContent.slice(0, 50) : null,
      qPosition: document.getElementById("q-position")?.textContent,
    };
  });
  console.log(`  [${label}] screen=${s.visibleScreen}  url=${s.url}  q="${s.qText}…"  pos=${s.qPosition}`);
  return s;
}

async function answerCurrent() {
  const isFillIn = (await page.locator("#fill-input").count()) > 0;
  if (isFillIn) await page.locator("#fill-input").fill("xxx");
  else await page.locator("button.option-btn").first().click({ force: true });
  await page.locator("#submit-btn").click({ force: true });
  await page.waitForSelector("#feedback:not([hidden])");
  await page.waitForTimeout(150);
}

async function clickNext() {
  // Use evaluate to call .click() directly — bypasses Playwright's
  // actionability checks and any overlay z-index issues with the
  // rewards-next-bar on mobile viewports.
  await page.evaluate(() => document.getElementById("next-btn").click());
}

// ---------- Scenario A: Back from Q3 → Q2 ----------
console.log("\n=== Scenario A: Back from Q3 → Q2 ===");
await freshPage();
await answerCurrent();
await clickNext();
await page.waitForTimeout(200);
await answerCurrent();
await clickNext();
await page.waitForTimeout(200);
const A_before = await snapshot("Q3 (before back)");
check("A0: on Q3", A_before.qPosition?.includes("3 /"), `pos=${A_before.qPosition}`);

await page.goBack(); // simulate system back button
await page.waitForTimeout(300);
const A_after = await snapshot("after back");
check(
  "A1: back from Q3 lands on Q2 (same quiz, not exit, not setup)",
  A_after.visibleScreen === "quiz" &&
    A_after.qPosition?.startsWith("2 /") &&
    A_after.qText !== A_before.qText,
  `screen=${A_after.visibleScreen} pos=${A_after.qPosition}`
);

// ---------- Scenario B: Back from Q1 → setup ----------
console.log("\n=== Scenario B: Back from Q1 → setup ===");
await freshPage();
const B_before = await snapshot("Q1 (before back)");
await page.goBack();
await page.waitForTimeout(300);
const B_after = await snapshot("after back");
check(
  "B1: back from Q1 lands on setup screen (not PWA close)",
  B_after.visibleScreen === "setup",
  `screen=${B_after.visibleScreen}`
);

// ---------- Scenario C: Forward-back-forward ----------
console.log("\n=== Scenario C: Next + Back sequence ===");
await freshPage();
await answerCurrent();
await clickNext(); // → Q2
await page.waitForTimeout(200);
await answerCurrent();
await clickNext(); // → Q3
await page.waitForTimeout(200);
const C_q3 = await snapshot("Q3");
await page.goBack();
await page.waitForTimeout(300);
const C_q2 = await snapshot("after back 1 (should be Q2)");
check("C1: back from Q3 → Q2", C_q2.qPosition?.startsWith("2 /"), `pos=${C_q2.qPosition}`);
await page.goBack();
await page.waitForTimeout(300);
const C_q1 = await snapshot("after back 2 (should be Q1)");
check("C2: back from Q2 → Q1", C_q1.qPosition?.startsWith("1 /"), `pos=${C_q1.qPosition}`);

// Now go forward (Next) twice to verify forward history still works
await answerCurrent();
await clickNext();
await page.waitForTimeout(200);
const C_forward = await snapshot("after Next (should advance)");
check(
  "C3: Next from Q1 advances (forward history still works)",
  C_forward.qPosition?.startsWith("2 /") || C_forward.qPosition?.startsWith("3 /"),
  `pos=${C_forward.qPosition}`
);

// ---------- Scenario D: Back from results → last question ----------
console.log("\n=== Scenario D: Back from results → last question ===");
await freshPage();
// Push through to results by answering all questions.
let safety = 0;
let reachedResults = false;
let lastQuizPos = null;
while (!reachedResults && safety < 300) {
  safety++;
  await answerCurrent();
  lastQuizPos = await page.locator("#q-position").textContent();
  // force:true bypasses the rewards-next-bar overlay that can intercept
  // clicks in mobile-sized viewports (390x844).
  await clickNext();
  await page.waitForTimeout(250);
  const onResults = await page.evaluate(
    () => !document.getElementById("results").hidden
  );
  if (onResults) reachedResults = true;
}
const D_results = await snapshot("results");
check("D0: reached results", D_results.visibleScreen === "results", `screen=${D_results.visibleScreen} url=${D_results.url} lastQuizPos=${lastQuizPos}`);
if (D_results.visibleScreen === "results") {
  await page.goBack();
  await page.waitForTimeout(300);
  const D_back = await snapshot("after back from results");
  check(
    "D1: back from results → quiz (last question)",
    D_back.visibleScreen === "quiz",
    `screen=${D_back.visibleScreen} pos=${D_back.qPosition}`
  );
}

// ---------- Scenario E: Reload from mid-quiz → setup (option A) ----------
console.log("\n=== Scenario E: Reload from mid-quiz → setup ===");
await freshPage();
await answerCurrent();
await clickNext();
await page.waitForTimeout(200);
const E_before = await snapshot("Q2 (before reload)");
// Reload the page at the current URL
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(300);
const E_after = await snapshot("after reload");
check(
  "E1: reload from mid-quiz lands on setup (option A: fresh start on load)",
  E_after.visibleScreen === "setup",
  `screen=${E_after.visibleScreen}`
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