# Task
Implement Step 3 of the Bible Bowl generator design: a **characterization (regression) test** for the CURRENT Exodus quiz app's core flow, using the repo's EXISTING Playwright idiom. It captures existing behavior; it MUST NOT modify any existing file.

# Keep your context tiny — this matters
Add NOTHING to your editing context beyond the two target files you create and the ONE template named below. Do not open or add any other repo file to the chat. The live app is exercised at RUNTIME through a real headless browser — you never need its source. Everything you need is written inline here.

**Template to copy the boilerplate from:** `scripts/test-reward-thresholds.mjs` (~118 lines, already in the repo). It shows the exact static-file server + `chromium.launch()` + `page.goto(".../index.html?qa=1")` + reward-stats-injection pattern. Copy that boilerplate; adapt it.

# The app contract (verified — build to exactly this)
- The app is a static site. A tiny Node http server rooted at the repo top serves the files; the page is opened at the URL the template uses (`.../index.html?qa=1`). **Reuse the template's `page.goto(...)` URL verbatim** — do not retype the page path.
- The page's quiz script fetches its question bank JSON via a request whose URL ends in `/questions.json`. Each question object:
  `{ id, chapter, book, reference, topic, type, question, answer, options?, acceptableAnswers?, memoryAid? }`
  - `type` ∈ `"multiple-choice" | "true-false" | "fill-in"`.
  - multiple-choice / true-false: `options` = array of strings; `answer` = the correct option string. Options render as `.option-btn` elements.
  - fill-in: `answer` string + `acceptableAnswers` array; the user types into a text input inside `#answer-form`.
- localStorage stats key is **`bbs:stats:v1`** → JSON `{ [questionId]: { right, wrong, streak, seen } }`. `seen` increments each answer; `right`+`streak` increment on correct; `streak` resets on wrong. Mastery = 3 correct in a row.
- The page (under `?qa=1`) exposes `window.BibleBowlQA` with `rewardThresholds()` → `{ total, thresholds:[{id,target}] }` and `nextProgress()` → `{ id, ... }`. Reward-unlock localStorage key is `bbs:unlocked-rewards:v1`. Use the SAME reward-injection pattern the template shows.
- Element IDs present on the page: `#quick-start` (starts a quick quiz), `#answer-form` (submit), `#next-btn` (advance), `#start-btn` (custom start). Feedback renders after submit; correct/incorrect state is visible in the DOM afterward.

# Determinism: intercept the question fetch with a KNOWN fixture
Do NOT rely on the real question bank. Use Playwright request interception so the app loads a tiny fixture whose answers you know. Register the route BEFORE `page.goto(...)`:
```js
await page.route("**/questions.json", (route) =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(FIXTURE) }));
```
Fixture (2 questions, answers known):
```js
const FIXTURE = [
  { id:"t-mc-1", chapter:1, book:"Test", reference:"Test 1:1", topic:"t",
    type:"multiple-choice", question:"Characterization MC — pick Alpha",
    answer:"Alpha", options:["Alpha","Bravo","Charlie","Delta"] },
  { id:"t-fill-1", chapter:1, book:"Test", reference:"Test 1:2", topic:"t",
    type:"fill-in", question:"Characterization fill — type yes",
    answer:"yes", acceptableAnswers:["yes"] }
];
```
Because you KNOW each rendered question's correct answer (match on question text), you can click the correct `.option-btn` (text === answer) for a CORRECT answer, or a different one for INCORRECT; for fill-in, type `answer` (correct) or a wrong string.

# Deliverables
1. `scripts/lib/headless-dom.mjs` — the shared headless harness helper. Export:
   - `startServer(root)` → Promise<httpServer> serving repo files on a random port (copy the server from the template).
   - `withQuizPage(callback, { fixture } = {})` — starts the server, `chromium.launch()`, opens a context+page, registers the `**/questions.json` fixture route when `fixture` is given, navigates to the template's page URL, waits until ready (`await page.waitForFunction(() => window.BibleBowlQA?.rewardThresholds?.().total > 0)`), invokes `await callback({ page, server, port, pageErrors })`, and ALWAYS tears down browser+server in a `finally`. Collect `page.on("pageerror", ...)` into `pageErrors`.
   - Node stdlib + `playwright` only (already a devDependency).
2. `scripts/test-headless-quiz-flow.mjs` — the characterization test. Using the helper + FIXTURE, characterize and PRINT one line per behavior:
   - (a) **bank loads**: with the fixture routed, `BibleBowlQA.rewardThresholds().total === FIXTURE.length` (2).
   - (b) **correct answer → feedback + stats**: `#quick-start`, answer the MC question CORRECTLY, submit `#answer-form`; assert a correct-feedback state is visible AND `localStorage["bbs:stats:v1"]` now has that id with `seen>=1` and `right>=1`.
   - (c) **incorrect answer → feedback + stats**: `#next-btn`, answer the next question INCORRECTLY; assert an incorrect-feedback state AND stats show `wrong>=1` for that id.
   - (d) **persistence**: assert `bbs:stats:v1` in localStorage is valid JSON reflecting the answers above.
   - Under `--include-rewards` ONLY: inject `bbs:stats:v1` to cross the first reward threshold and dispatch `new CustomEvent("bbs:stats-updated",{detail:{total}})` (mirror the template), then assert an unlock / `nextProgress()` transition.
   - Exit 0 if all captured behaviors hold; exit 1 with a NAMED failure otherwise. Assert `pageErrors` is empty.

# Sabotage self-check (REQUIRED in EVIDENCE)
Prove the test genuinely exercises the app: run it once fulfilling the `**/questions.json` route with `[]` (empty) — the (a) "bank loads" check MUST fail (total 0). Capture that failing output, then confirm the unmodified test passes again. Support this via a hidden `--sabotage` flag (fulfils the route with `[]`); do not leave sabotage on by default.

# CRITICAL FOR THE PLANNER — FILES list (exact, all new)
- scripts/test-headless-quiz-flow.mjs
- scripts/lib/headless-dom.mjs

# Constraints
- Node stdlib + `playwright` only. UTF-8, no mojibake. Files < 800 lines.
- MUST NOT modify any existing file — read-only characterization.
- Windows-safe (`path.join`; repo root via `fileURLToPath(new URL(".", import.meta.url))` like the template).

# Acceptance criteria
- `node scripts/test-headless-quiz-flow.mjs` → exit 0, one line per characterized behavior.
- `node scripts/test-headless-quiz-flow.mjs --include-rewards` → exit 0.
- `node scripts/test-headless-quiz-flow.mjs --sabotage` → non-zero exit with a named "bank loads" failure.

# Report format
End with:
SUMMARY: <=6 lines
FILES CHANGED: <list>
EVIDENCE: <commands -> raw output + exit codes, incl. the sabotage demo>
RISKS: <or NONE>
