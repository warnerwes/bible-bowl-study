# Task
Implement Step 5: scaffold the pilot **1 & 2 Corinthians combined site** and a build script that assembles a servable static `_site/` from the config-driven engine (built in step 4, under `engine/src/`). This produces the first VIEWABLE product — a running Corinthians quiz + reading-plan page.

# Context
- The config-driven quiz engine exists at `engine/src/*.js` (config.js, storage.js, quiz-core.js, quiz-render.js, passage-links.js, anki-export.js). It loads `data/site-config.json` and `data/questions.json`, and runs the quiz standalone (no rewards/labs/mastery — those are absent by design in this pilot).
- The existing base stylesheet is `styles.css` at repo root (book-agnostic quiz styling) — copy it into the site as `styles.css`; do not modify the original.
- This is a COMBINED site: one site covering TWO books (1 Corinthians, 2 Corinthians). site-config holds an ARRAY of books. Question IDs prefix by actual book (`1cor-…`, `2cor-…`).
- The site never displays scripture text; reading access is external links via passage-links.

# Deliverables (all under generator/pilots/corinthians/)
1. `site-config.json`:
   - `siteSlug: "corinthians"`, `siteTitle: "Bible Bowl Study — 1 & 2 Corinthians"`, `defaultBookLabel: "Corinthians"`
   - `books: [ {"name":"1 Corinthians","slug":"1cor","chapters":16}, {"name":"2 Corinthians","slug":"2cor","chapters":13} ]`
   - `questionsPath: "data/questions.json"`, `formConfigPath: "data/form-config.json"`
2. `source-manifest.json` — NKJV publisher block (quotedVerseLimit 500, maxRatioOfWork 0.25, maxRatioOfBook 0.5, the verified NKJV notice string) + per-book `canonicalVerseCount` (1 Corinthians 437, 2 Corinthians 257) + empty `quotedUses` + `internalPolicy {selfImposed:true, rationale:"reference-first; verbatim quoting minimized", ...}`. Must validate against generator/schemas/source-manifest.schema.json.
3. `reading-plan.json` — a simple ~8-week plan across both epistles (week, book, chapter range, an external Bible Gateway NKJV link per assignment, and a "submit seed" form-link placeholder). Validate against generator/schemas/reading-plan.schema.json.
4. `form-config.json` — placeholder Google Form base URL + entry-id map (book, chapter, kind, note) so reading-plan.js can build prefilled links. Mark values as PLACEHOLDER.
5. `questions.seed.json` — **8–10 PLACEHOLDER demo questions** (clearly `"placeholder": true` and `"reviewStatus": "draft"` on each) spanning both books, conforming to generator/schemas/question-candidate.schema.json. Write REFERENCE-BASED questions that test well-known facts WITHOUT quoting NKJV text (e.g. "In which chapter of 1 Corinthians does Paul describe love?" → "1 Corinthians 13"; "What does Paul call the collection for the saints in 2 Corinthians 9?" etc.). Mix multiple-choice and true-false. Each carries book, bookSlug, chapter, reference, topic, difficulty. Accuracy matters — these will be spot-checked.
6. `index.html` — quiz shell that loads styles.css then the engine modules in order (config → storage → quiz-core → quiz-render) and boots the quiz. Header shows the site title. Include a link to reading.html and an external "Read on Bible Gateway" link (no inline scripture).
7. `reading.html` + `reading-plan.js` — renders reading-plan.json as a week-by-week list, each row with the external NKJV link and the prefilled seed-form link.
8. `build-site.mjs` — pure-Node assembler: creates `generator/pilots/corinthians/_site/`, copies `engine/src/*.js` → `_site/`, copies root `styles.css` → `_site/styles.css`, copies index.html + reading.html + reading-plan.js → `_site/`, and copies this dir's `*.json` → `_site/data/` (renaming questions.seed.json → questions.json, site-config.json → site-config.json). Windows-safe (fs.cp/path only). `--check` mode verifies _site has index.html, data/questions.json, data/site-config.json, and all engine js files.
9. `README.md` — one paragraph: this is the pilot scaffold; questions are placeholders pending student seeds + review; how to build (`node build-site.mjs`) and serve.

# CRITICAL FOR THE PLANNER — FILES list (exact, all new)
- generator/pilots/corinthians/site-config.json
- generator/pilots/corinthians/source-manifest.json
- generator/pilots/corinthians/reading-plan.json
- generator/pilots/corinthians/form-config.json
- generator/pilots/corinthians/questions.seed.json
- generator/pilots/corinthians/index.html
- generator/pilots/corinthians/reading.html
- generator/pilots/corinthians/reading-plan.js
- generator/pilots/corinthians/build-site.mjs
- generator/pilots/corinthians/README.md

# Constraints
- Pure Node stdlib for build-site.mjs; framework-free browser JS/HTML for the site. No new deps. UTF-8, no mojibake. Files < 800 lines.
- Do NOT modify engine/src or any existing repo file — only create files under generator/pilots/corinthians/.
- Windows-safe.

# Acceptance criteria
- `node generator/pilots/corinthians/build-site.mjs` assembles `_site/` with all engine js, styles.css, index.html, reading.html, and data/*.json.
- `node generator/pilots/corinthians/build-site.mjs --check` → exit 0.
- `node generator/toolchain/scripts/validate-schemas.mjs` (or a direct node check) confirms site-config, source-manifest, reading-plan, and each question validate against their schemas.
- questions.seed.json has ≥8 questions, each `placeholder:true`, spanning both 1cor and 2cor.
- EVIDENCE: raw output + exit codes; plus `find generator/pilots/corinthians/_site -type f | sort`.

# Report format
End with:
SUMMARY: <≤6 lines>
FILES CHANGED: <list>
EVIDENCE: <commands → raw output>
RISKS: <or NONE>
