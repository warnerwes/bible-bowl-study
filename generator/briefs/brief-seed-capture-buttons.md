# Task
Add a book-agnostic **"Suggest a question" seed-capture** affordance to the config-driven quiz engine (`engine/src/`). It shows a prefilled Google-Form link on each quiz question and on the results screen — but ONLY when a real form-config is present (so it stays inert until a form is wired). This is a COPY-and-generalize style engine feature; do NOT touch the live Exodus app (app.js/index.html/rewards.js) or the pilot files under generator/pilots/.

# Keep context small
Add to your editing context only the files in the FILES list below. The engine files you'll edit are small (config.js ~85 lines, quiz-render.js ~425, passage-links.js ~40) — read them as needed. Model the new `seed-link.js` on the existing `engine/src/passage-links.js`.

# How the engine works (verified)
- `engine/src/config.js` exports `loadConfig(path="data/site-config.json")` which fetches + resolves config and caches it. The resolved config already includes a `formConfigPath` field (default `null`) and a `books` array; each book is `{name, slug, chapters}`.
- `engine/src/quiz-render.js` exports `createQuiz({state, storage, config, weightedOrder})`. Its `renderQuestion()` fills DOM by id (`$("q-ref")`, `$("passage-link")`, etc.) and is fully guarded (`if (el) ...`). It already sets `#passage-link` (an external Bible Gateway link) from the current question's `reference`. The results screen is shown by its results renderer (fills `#result-score`).
- The current question object has: `{ id, chapter, book, reference, topic, type, question, answer, options?, ... }`.
- Reward/reader hooks are optional/typeof-guarded — follow the same defensive style.

# Deliverables
1. **`engine/src/seed-link.js`** (new) — pure browser ES module, book-agnostic:
   - `formReady(formConfig)` → boolean. True only if `formConfig` is an object with a `formBaseUrl` string that does NOT contain `"PLACEHOLDER"` and a non-empty `fields` array. False for null/undefined/placeholder.
   - `buildSeedUrl(formConfig, { book, chapter, reference, kind })` → a prefilled Google-Form URL string, or `null` when `!formReady`. Build from `formConfig.formBaseUrl` (use its path as-is; if it ends in `/viewform` keep it) + query `entry.<id>=<value>` params. Map by each field's `name`: `book`→book, `chapter`→(reference || String(chapter)), `kind`→(kind || "question_seed"), `note`→"" (empty; the student fills it). Look up each field's `entryId` from `formConfig.fields` (array of `{name, entryId, ...}`). URL-encode values.
   - Optional `SEED_LABEL = "Suggest a question about this passage"` export for reuse.
2. **`engine/src/config.js`** (modify) — in `loadConfig(path)`, AFTER resolving the config, if `cfg.formConfigPath` is a non-empty string, `fetch(cfg.formConfigPath, {cache:"no-cache"})` and set `cfg.formConfig` to the parsed JSON on success, or `null` on any failure (never throw — config stays optional). Leave `cfg.formConfig` `null`/absent when `formConfigPath` is not set. Keep book-agnostic.
3. **`engine/src/quiz-render.js`** (modify) — import `formReady`, `buildSeedUrl`, `SEED_LABEL` from `./seed-link.js`:
   - In `renderQuestion()`: when `formReady(cfg.formConfig)`, build a seed URL from the current question (`{book:q.book, chapter:q.chapter, reference:q.reference, kind:"question_seed"}`) and show a link with text `SEED_LABEL` (target `_blank`, `rel="noopener"`). Put it near the passage link. If a `#suggest-seed` element exists use it; otherwise CREATE the element dynamically and insert it next to `#passage-link` (or into the feedback/answer area) — so no HTML file needs editing. When `!formReady`, ensure the link is hidden/absent (don't render it).
   - On the results screen: when `formReady`, show ONE general seed link (kind `"question_seed"`; use `config.defaultBookLabel`/first book for context, or omit book/chapter) — create the element dynamically if needed.
   - Fully guarded; must not throw when elements or `cfg.formConfig` are absent.
   - NO literal "Exodus"/"Corinthians"/book names — book text comes from config/question only.
4. **`engine/tests/fixtures/form-config.json`** (new) — a REAL (non-placeholder) fixture: a `formBaseUrl` like `https://docs.google.com/forms/d/e/TESTFORMID/viewform` + a `fields` array with `entryId`s for `book`, `chapter`, `kind`, `note` (mirror the shape in generator/pilots/corinthians/form-config.json but with test IDs).
5. **`engine/tests/test-config-driven-runtime.mjs`** (modify) — extend the existing harness/stub (it serves fixtures via a stubbed fetch and drives the engine). Keep ALL existing checks passing, and ADD:
   - `formReady` returns true for the fixture, false for `{formBaseUrl:"...PLACEHOLDER..."}` and for `null`.
   - `buildSeedUrl(fixture, {book:"1 Corinthians", chapter:15, reference:"1 Corinthians 15", kind:"question_seed"})` returns a URL containing each fixture entry id and the prefilled book/reference (assert substrings).
   - With the engine loaded using a site-config whose `formConfigPath` points at the fixture form-config (serve it from the stub fetch), after `renderQuestion()` a seed link/element is present with a non-empty href.
   - With NO form-config (or a placeholder one), the seed link is absent/hidden.

# CRITICAL FOR THE PLANNER — FILES list (exact)
- engine/src/seed-link.js            (new)
- engine/src/config.js               (modify)
- engine/src/quiz-render.js          (modify)
- engine/tests/test-config-driven-runtime.mjs   (modify)
- engine/tests/fixtures/form-config.json         (new)

# Constraints
- Pure browser JS (ES modules) for engine/src; Node stdlib for the test. No new deps. UTF-8, no mojibake. Every file < 800 lines (if quiz-render.js would exceed, extract a small helper instead of inflating it).
- Book-agnostic: NO literal book names in engine/src. `grep -ri exodus engine/src` must stay empty.
- Do NOT modify app.js, index.html, rewards.js, or anything under generator/pilots/.
- Windows-safe.

# Acceptance criteria
- `node engine/tests/test-config-driven-runtime.mjs` → exit 0, one line per check (existing + new).
- `grep -ri exodus engine/src` → no matches.
- `find engine/src -name '*.js'` each < 800 lines (print none over).

# Report format
End with:
SUMMARY: <=6 lines
FILES CHANGED: <list>
EVIDENCE: <commands -> raw output + exit codes>
RISKS: <or NONE>
