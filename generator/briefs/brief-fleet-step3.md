# Task
Implement Step 3 of the approved Bible Bowl generator design: a characterization (regression) test for the CURRENT Exodus app's core quiz flow, to protect the upcoming engine extraction. This test captures existing behavior — it must NOT modify any app code.

# Deliverables
1. `scripts/test-headless-quiz-flow.mjs`: a Node test that loads the current app.js in a stubbed browser environment and characterizes: (a) question load from data/questions.json, (b) answering correct/incorrect with feedback state, (c) progress/stats persistence to the localStorage stub (key bbs:stats:v1), (d) rewards-unlock triggering (--include-rewards flag runs this part). Exit 0 all captured behaviors hold / exit 1 with named failures.
2. `scripts/lib/headless-dom.mjs`: the minimal DOM/localStorage/fetch stub used by the test.

# How
STUDY THE EXISTING TEST HARNESS FIRST: scripts/test-memory-labs.mjs, scripts/test-refiner-trial.mjs, scripts/test-bible-reader-routes.mjs already run app modules headlessly in Node — reuse their stubbing idiom rather than inventing a new one. app.js is a browser IIFE (1255 lines) reading DOM elements from index.html and fetching data/questions.json; the stub must provide the elements it queries. Characterize what the code DOES today, not what it should do.

# CRITICAL FOR THE PLANNER — FILES list
The criteria FILES list MUST contain exactly these paths (all new):
- scripts/test-headless-quiz-flow.mjs
- scripts/lib/headless-dom.mjs

# Constraints
Pure Node stdlib. UTF-8. Files ≤800 lines. MUST NOT modify app.js, index.html, or any existing file — this is a read-only characterization of current behavior.

# Acceptance criteria
- `node scripts/test-headless-quiz-flow.mjs` → exit 0, prints one line per characterized behavior
- `node scripts/test-headless-quiz-flow.mjs --include-rewards` → exit 0
- Sabotage check: the test genuinely exercises app.js (e.g., temporarily pointing it at an empty questions fixture makes it fail) — demonstrate this in EVIDENCE, then restore
- EVIDENCE: raw output + exit codes of both commands plus the sabotage demonstration.
