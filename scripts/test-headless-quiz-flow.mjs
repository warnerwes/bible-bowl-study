/**
 * Characterization (regression) test for the current Bible Bowl quiz app's
 * core flow. Captures existing behavior; MUST NOT modify any existing file.
 *
 * Run modes:
 *   node scripts/test-headless-quiz-flow.mjs              — core flow checks
 *   node scripts/test-headless-quiz-flow.mjs --include-rewards  — + reward unlock
 *   node scripts/test-headless-quiz-flow.mjs --sabotage   — empty bank, MUST fail
 *
 * Node stdlib + playwright only.
 */
import assert from "assert/strict";
import { withQuizPage } from "./lib/headless-dom.mjs";

const args = new Set(process.argv.slice(2));
const INCLUDE_REWARDS = args.has("--include-rewards");
const SABOTAGE = args.has("--sabotage");

// A tiny fixture whose answers are known so the test can drive the app
// deterministically instead of relying on the real question bank.
const FIXTURE = [
  {
    id: "t-mc-1", chapter: 1, book: "Test", reference: "Test 1:1", topic: "t",
    type: "multiple-choice", question: "Characterization MC — pick Alpha",
    answer: "Alpha", options: ["Alpha", "Bravo", "Charlie", "Delta"],
  },
  {
    id: "t-fill-1", chapter: 1, book: "Test", reference: "Test 1:2", topic: "t",
    type: "fill-in", question: "Characterization fill — type yes",
    answer: "yes", acceptableAnswers: ["yes"],
  },
];

// When sabotage is requested the bank loads empty; the (a) check must then fail.
const ROUTED_FIXTURE = SABOTAGE ? [] : FIXTURE;

const failures = [];
let passes = 0;
function check(name, cond, detail = "") {
  if (cond) {
    passes += 1;
    console.log(`PASS  ${name}`);
  } else {
    const msg = `FAIL  ${name}${detail ? " — " + detail : ""}`;
    console.log(msg);
    failures.push(name);
  }
}

async function readStats(page) {
  const raw = await page.evaluate(() => localStorage.getItem("bbs:stats:v1"));
  if (!raw) return {};
  return JSON.parse(raw);
}

async function currentQuestionInfo(page) {
  return page.evaluate(() => {
    const ref = document.getElementById("q-ref")?.textContent || "";
    const qtext =
      document.querySelector("#q-text, #question")?.textContent?.trim() || "";
    const options = [...document.querySelectorAll(".option-btn")].map((b) =>
      b.textContent.trim()
    );
    const hasTextInput = !!document.querySelector(
      "#answer-area input[type=text]"
    );
    return { ref, qtext, options, hasTextInput };
  });
}

function fixtureFor(info) {
  return (
    FIXTURE.find((f) => f.reference === info.ref) ||
    FIXTURE.find((f) => info.qtext.includes(f.question.slice(-15))) ||
    null
  );
}

// Answer the currently-rendered question correctly (true) or incorrectly (false).
async function answerCurrent(page, wantCorrect) {
  // Wait until a question is actually rendered (q-ref populated) so we don't
  // race the render after #quick-start / #next-btn.
  await page
    .waitForFunction(
      () => (document.getElementById("q-ref")?.textContent || "").length > 0,
      { timeout: 5000 }
    )
    .catch(() => {});
  const info = await currentQuestionInfo(page);
  const entry = fixtureFor(info);
  if (!entry) throw new Error("no fixture entry for rendered question: " + JSON.stringify(info));

  if (info.options.length > 0) {
    const choice = wantCorrect
      ? entry.answer
      : info.options.find((o) => o !== entry.answer) || info.options[0];
    await page.locator(".option-btn", { hasText: choice }).first().click();
  } else {
    const value = wantCorrect ? entry.answer : "definitely-wrong-answer";
    await page.fill("#answer-area input", value);
  }
  await page.waitForTimeout(150);
  await page.click("#submit-btn");
  await page.waitForTimeout(400);
  return entry;
}

async function feedbackState(page) {
  return page.evaluate(() => {
    const verdict = document.getElementById("feedback-verdict");
    if (!verdict) return { present: false, kind: null, text: null };
    return {
      present: !document.getElementById("feedback").hidden,
      kind: verdict.className, // "verdict right" | "verdict wrong"
      text: verdict.textContent.trim(),
    };
  });
}

function fail(reason) {
  console.log(`\nABORT — ${reason}`);
  failures.push(reason);
}

try {
  await withQuizPage(
    async ({ page, pageErrors }) => {
      // (a) bank loads with the routed fixture total.
      const total = await page.evaluate(
        () => window.BibleBowlQA.rewardThresholds().total
      );
      check(
        "bank loads (total === fixture length)",
        total === FIXTURE.length,
        `got total=${total}`
      );

      // If the bank is empty (sabotage), no quiz to drive — stop here so the
      // (a) failure is the named one and we don't time out on #quick-start.
      if (total === 0) {
        check("pageErrors empty", pageErrors.length === 0, pageErrors.join("; "));
        return;
      }

      // Wait for the question bank to finish loading into the UI.
      await page.waitForFunction(() => {
        const n = document.getElementById("quick-note");
        return n && !n.textContent.includes("Loading questions");
      });

      // --- (b) correct answer → feedback + stats ---
      await page.click("#quick-start");
      await page.waitForTimeout(400);

      const correctEntry = await answerCurrent(page, true);
      const correctFB = await feedbackState(page);
      const statsAfterCorrect = await readStats(page);
      const correctStats = statsAfterCorrect[correctEntry.id] || {};
      check(
        "correct answer shows correct feedback",
        correctFB.present && correctFB.kind?.includes("right"),
        `feedback=${JSON.stringify(correctFB)}`
      );
      check(
        "correct answer records stats (seen>=1, right>=1)",
        correctStats.seen >= 1 && correctStats.right >= 1,
        `stats=${JSON.stringify(correctStats)}`
      );

      // --- (c) incorrect answer → feedback + stats ---
      // Advance to the next question (the fixture has exactly two).
      const nextVisible = await page.evaluate(
        () => document.getElementById("next-btn")?.offsetParent !== null
      );
      check("next-btn visible after correct answer", nextVisible);
      if (!nextVisible) {
        fail("next-btn not visible; cannot proceed to incorrect-answer check");
        check("pageErrors empty", pageErrors.length === 0, pageErrors.join("; "));
        return;
      }
      await page.click("#next-btn");
      await page.waitForTimeout(400);

      const wrongEntry = await answerCurrent(page, false);
      const wrongFB = await feedbackState(page);
      const statsAfterWrong = await readStats(page);
      const wrongStats = statsAfterWrong[wrongEntry.id] || {};
      check(
        "incorrect answer shows incorrect feedback",
        wrongFB.present && wrongFB.kind?.includes("wrong"),
        `feedback=${JSON.stringify(wrongFB)}`
      );
      check(
        "incorrect answer records stats (wrong>=1)",
        wrongStats.wrong >= 1,
        `stats=${JSON.stringify(wrongStats)}`
      );

      // --- (d) persistence: stats key is valid JSON reflecting the answers ---
      const rawStats = await page.evaluate(() =>
        localStorage.getItem("bbs:stats:v1")
      );
      let parsed = null;
      let parseOk = false;
      try {
        parsed = JSON.parse(rawStats || "");
        parseOk = true;
      } catch {
        parseOk = false;
      }
      check(
        "bbs:stats:v1 is valid JSON",
        parseOk,
        `raw=${rawStats?.slice(0, 120)}`
      );
      const hasCorrectId =
        parseOk && Object.prototype.hasOwnProperty.call(parsed, correctEntry.id);
      const hasWrongId =
        parseOk && Object.prototype.hasOwnProperty.call(parsed, wrongEntry.id);
      check(
        "bbs:stats:v1 reflects both answered questions",
        hasCorrectId && hasWrongId,
        `ids=${parseOk ? Object.keys(parsed).join(",") : "<unparsed>"}`
      );

      // --- (e) reward unlock (only under --include-rewards) ---
      if (INCLUDE_REWARDS) {
        const bankTotal = await page.evaluate(
          () => window.BibleBowlQA.rewardThresholds().total
        );
        // Inject stats that cross the FIRST reward threshold (one question
        // mastered at streak 3), mirroring the reward-thresholds template.
        await page.evaluate((bt) => {
          localStorage.removeItem("bbs:unlocked-rewards:v1");
          localStorage.setItem(
            "bbs:stats:v1",
            JSON.stringify({
              first_mastered: { right: 3, wrong: 0, streak: 3, seen: 3 },
            })
          );
          window.dispatchEvent(
            new CustomEvent("bbs:stats-updated", { detail: { total: bt } })
          );
        }, bankTotal);

        // After the first reward unlocks, next progress should advance past
        // the first threshold (red_sea) to the next one.
        await page
          .waitForFunction(
            () => window.BibleBowlQA.nextProgress().id !== "red_sea",
            { timeout: 5000 }
          )
          .catch(() => {});
        const nextProg = await page.evaluate(() =>
          window.BibleBowlQA.nextProgress()
        );
        const unlocked = await page.evaluate(() =>
          localStorage.getItem("bbs:unlocked-rewards:v1")
        );
        check(
          "reward unlock advances nextProgress past first threshold",
          nextProg.id !== "red_sea",
          `nextProgress.id=${nextProg.id}`
        );
        check(
          "reward unlock recorded in bbs:unlocked-rewards:v1",
          unlocked !== null,
          `unlocked=${unlocked}`
        );
      }

      check(
        "pageErrors empty",
        pageErrors.length === 0,
        pageErrors.join("; ")
      );
    },
    { fixture: ROUTED_FIXTURE }
  );
} catch (err) {
  fail(`uncaught: ${err && err.stack ? err.stack : err}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${passes} characterization checks passed (exit=0).`);
process.exit(0);