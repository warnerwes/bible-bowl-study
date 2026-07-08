# Task
Implement Step 4 of the approved Bible Bowl generator design: extract the Exodus **quiz core** into a book-agnostic, config-driven engine under `engine/src/`, coarsely split so every file is < 800 lines. This is a COPY-and-generalize: do NOT modify the live Exodus files (app.js, index.html, etc. stay exactly as they are). The engine must run the quiz standalone (rewards/memory-labs/mastery are NOT part of this step — they stay optional and absent).

# Context — how the current app is coupled (already verified)
- `app.js` (1255 lines) is a browser IIFE that fetches `data/questions.json` and runs the quiz. It is the ONLY file in scope to generalize from.
- Its calls into other modules are ALREADY defensively guarded and therefore optional:
  - `window.BibleReader?.open/openRef(...)` (optional chaining)
  - `typeof window.BibleBowlHasPendingUnlock === "function" && ...` and `window.BibleBowlConsumeUnlockScroll` (reward hooks, typeof-guarded)
  So the extracted engine runs fine with those modules absent — keep the guards; do not import rewards/labs/mastery.
- Book-specific literals to replace with config (a `site-config.json` loaded at runtime):
  - reference fallback `"Exodus " + q.chapter` (appears ~4x) → use `q.reference` when present, else `config.defaultBookLabel + " " + q.chapter`
  - Anki deck name `"Bible Bowl - Exodus"`, header `"#deck:Bible Bowl - Exodus"`, filename `"bible-bowl-exodus-anki.csv"`, id prefix `"BibleBowl Exodus::Ch"` → derive from `config.bookName` / `config.siteSlug`
  - the `#read-exodus` button + `window.BibleReader` calls → REMOVE; replace reading access with `passage-links.js` (external licensed links only, per copyright rule). No in-app scripture reader in the engine.
  - keep `fetch("data/questions.json")` (standard data path) but make the path a config value defaulting to `data/questions.json`.

# Deliverables (coarse split — builder picks exact boundaries, every file < 800 lines)
- `engine/src/config.js` — loads/exposes `data/site-config.json` (bookName, siteSlug, books[], questionsPath, defaultBookLabel, formConfig ref) with sane defaults.
- `engine/src/storage.js` — the localStorage stats layer extracted from app.js (key stays `bbs:stats:v1`).
- `engine/src/quiz-core.js` — quiz state machine, question selection, answer checking (extracted).
- `engine/src/quiz-render.js` — DOM rendering + event wiring (extracted); reward/reader hooks stay as optional guarded calls.
- `engine/src/passage-links.js` — builds external licensed passage URLs (e.g. Bible Gateway) from a reference string; NO scripture text.
- `engine/src/anki-export.js` — the Anki CSV export, now config-driven names.
- `engine/tests/test-config-driven-runtime.mjs` — loads the engine in a Node/JSDOM-style stub (reuse the harness idiom from scripts/test-memory-labs.mjs / scripts/lib/headless-dom.mjs if present), drives it with a TINY fixture site-config + 2 fixture questions for a fake book, and asserts: questions load, correct/incorrect answer feedback, stats persist to the stub, and NO hard dependency on rewards/labs/reader (engine runs with them absent). Also assert no remaining literal "Exodus" in engine/src. Exit 0/1.

# CRITICAL FOR THE PLANNER — FILES list (exact, all new)
- engine/src/config.js
- engine/src/storage.js
- engine/src/quiz-core.js
- engine/src/quiz-render.js
- engine/src/passage-links.js
- engine/src/anki-export.js
- engine/tests/test-config-driven-runtime.mjs
- engine/tests/fixtures/site-config.json
- engine/tests/fixtures/questions.json

# Constraints
- Pure browser JS for engine/src (framework-free, matches the existing app style); Node stdlib for the test. No new runtime dependencies.
- Every file < 800 lines (HARD). UTF-8, no mojibake.
- DO NOT modify app.js, index.html, or any existing repo file. Engine is a clean copy under engine/.
- Windows-safe (path.join in Node; no shell).
- No literal "Exodus" anywhere in engine/src — it must be book-agnostic.

# Acceptance criteria
- `node engine/tests/test-config-driven-runtime.mjs` → exit 0, one line per asserted behavior.
- `node generator/toolchain/scripts/check-line-counts.mjs engine/src` → exit 0 (if that gate script exists from a later step, otherwise: `find engine/src -name '*.js' | while read f; do L=$(wc -l < "$f"); [ "$L" -lt 800 ] || echo "OVER: $f $L"; done` prints nothing).
- `grep -ri exodus engine/src` → no matches.
- EVIDENCE: raw output + exit codes of all three.

# Report format
End with:
SUMMARY: <≤6 lines>
FILES CHANGED: <list>
EVIDENCE: <commands → raw output>
RISKS: <or NONE>
