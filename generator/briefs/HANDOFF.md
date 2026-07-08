# Bible Bowl Generator — Session Handoff

_Written 2026-07-07 after a planned computer restart. Supersedes nothing in
`docs/generator-design.md` (the authoritative design) or
`docs/bible-bowl-generator-vision.md` (the authoritative requirements); this is
the "where we are and how to resume" note._

---

## TL;DR

We are building a **book-agnostic generator** that produces a new Bible Bowl
study site for any book of the Bible, following the pattern of the existing
Exodus app. The design is fully battled-out and approved. **Phase-1 steps 1 and
2 are committed and re-verified passing after the restart** (not pushed). Step 3
(the characterization test that must land before the engine is split) was
in-flight when the machine restarted and is orphaned — **re-run it first.**
Steps 4–12 remain. The real-book pilot is deliberately last and waits until Wes
names the target New Testament book.

---

## What this project is

The Exodus site is a content factory wrapped in a small static web app. The
generator generalizes that factory so each new book gets its own site (its own
repo, its own GitHub Pages deploy, its own verse-budget manifest) while sharing
a **versioned engine copied in at deploy time**. The Exodus app itself stays
frozen and untouched — the engine is extracted _as a copy_.

The defining principle: **the game builds itself while students read.** Students
read their own Orthodox Study Bibles, submit "seeds" (memory points, question
ideas, sequences, confusing details, reward ideas, patristic threads) through a
Google Form, and those seeds flow through a moderation → research → drafting →
review → publish pipeline. AI proposes/organizes; a human gate approves.

## Locked decisions (see memory `generator-decisions` + vision doc)

- **Readers = students** (minors). Public site never displays scripture book
  text; it links out to a licensed platform (Bible Gateway) and ships a
  reading-plan page.
- **Seed transport = Google Form → Google Sheet**, ingested via the Sheets API
  (not published CSV — PII protection), PII stripped on ingest.
- **Next book = a New Testament book (TBD)**, but the generator handles any book.
  Book identity is always a runtime parameter.
- **Per-translation quotation policy, not a flat budget.** NKJV (OSB NT): 500
  verses, <25% of the work, <50% of a book, not a "Biblical reference work."
  SAAS (OSB OT): 1,000 verses, <50% book, <50% work. Study notes/footnotes are
  never quoted (summarize + cite). Patristics quotable (prefer public-domain).
  Verified attribution lines are in the vision doc. **An HCCP permission email is
  out** asking whether a quiz site counts as a reference work / a website counts
  as a digital product.
- **N separate sites**, shared engine copied per book, engine version bumps
  manual now / bot later.
- **Wes is the only human review gate for now**; bot pre-filter lanes only at
  scale.
- **Research runs through ChatGPT deep research** (export briefs, import
  results as candidates) to conserve build tokens.
- **Rejection memory:** rejected seeds keep a permanent reason and are never
  re-proposed.

## Architecture (battle outcome)

Design was fought out: **gpt-5.5 architect (xhigh) vs kimi counter-critic**, 9
cruxes raised, 7 accepted + 2 accepted-with-modification, converged to APPROVE.
`design.sh` recorded 2-family convergence. Key rulings baked into
`docs/generator-design.md`:

1. Engine + generator both live in **this repo** (`engine/`, `generator/`); book
   repos carry a tiny `.bbs-engine.json` pin.
2. **No committed build artifacts** — `engine/dist` is CI-built from tagged
   source, never in git.
3. **Characterization tests before any engine split**; split stays **coarse**
   (~config-state / storage / quiz-render-events / passage-links), every file
   <800 lines.
4. `bible-reader.js` is **excluded** from the NT engine; replaced by
   `passage-links.js` (external licensed links only).
5. **Sheets API via `googleapis` as a generator devDependency only** — runtime
   stays dependency-free. (No hand-rolled JWT signer.)
6. Source manifest separates **verified publisher terms** from an
   `internalPolicy` block (`selfImposed: true` + rationale) so self-imposed caps
   never masquerade as publisher rules.
7. Untracked-excerpt defense = schema-enforced content model + n-gram overlap
   check + reviewer attestation artifact.
8. **Six** deploy-blocking gates (added a 6th: walk built `_site`, fail if any
   `data/source-text/**` leaks into output).
9. **Phase-1 validates on a FIXTURE book**; the real-book pilot is step 12, only
   after Wes names the book.

## What's committed (verified passing 2026-07-07 post-restart)

Both are **local only — NOT pushed** (pushing deploys to Pages; that's Wes's
call). 2 commits ahead of `origin/main`.

- **`01f24ba` — step 1**
  - `docs/generator-design.md` (the approved design)
  - `docs/bible-bowl-generator-vision.md` (vision v2)
  - `generator/toolchain/scripts/inventory-exodus-factory.mjs`
    (+ `lib/inventory-helpers.mjs`) — maps all 8 Exodus factory scripts
    book-specific vs book-agnostic with file:line refs; `--check` gate
  - generated `generator/docs/exodus-factory-inventory.{json,md}`
  - Re-verified: `inventory-exodus-factory.mjs --check` → exit 0.

- **`d961155` — step 2**
  - 9 JSON schemas under `generator/schemas/` (queue-item with full state
    machine, question/memory-tool candidates, research artifact, source manifest
    with publisher/internalPolicy split, site-config, reading-plan, form-config,
    reviewer-attestation)
  - `generator/toolchain/scripts/lib/schema-utils.mjs` (dependency-free
    validator)
  - `validate-schemas.mjs --self-test`, `test-queue-state-machine.mjs`,
    `test-source-manifest-policy.mjs`
  - Re-verified: all three → exit 0.

## Remaining work — the ordered plan (from `docs/generator-design.md` §9)

- **Step 3 (DO FIRST — orphaned):** characterization/regression test for the
  current Exodus quiz flow (`scripts/test-headless-quiz-flow.mjs` +
  `scripts/lib/headless-dom.mjs`). Protects the engine split. Read-only wrt
  app.js. **Brief saved at `generator/briefs/brief-fleet-step3.md`.**
- **Step 4:** coarse engine split + config-driven runtime + `passage-links.js`.
  BLOCKED until step 3 passes — do not split before the characterization net exists.
- **Step 5:** fixture-book scaffold + reading-plan page + Google Form deep links.
- **Step 6:** generalize the question factory from the step-1 inventory (support
  all 3 existing types: multiple-choice, true-false, fill-in) + Exodus adapter.
- **Step 7:** implement the six deploy-blocking gates + `verify-all.mjs`, wired
  into local build and CI.
- **Step 8:** Sheets API ingestion (`googleapis` devDependency), PII strip,
  dedup/merge, coverage report.
- **Step 9:** reusable engine GitHub Actions workflow; book-repo deploy via one
  pinned `uses:`; dist as CI artifact only.
- **Step 10:** full Phase-1 slice validated end-to-end on a fixture book.
- **Step 11 (Phase 2):** data-driven memory labs + rewards; research
  export/import pipeline.
- **Step 12:** real-book pilot — **only when Wes names the book.**

## How to resume (exact next actions)

1. Register + re-verify fleet:
   ```bash
   ~/.claude/skills/eng-team/scripts/coord.sh register --goal "bible-bowl generator: resume phase-1 step 3+"
   ```
2. Re-run the orphaned step 3:
   ```bash
   fleet run generator/briefs/brief-fleet-step3.md
   ```
3. Judge the fleet packet, then land + verify (see gotchas below), then commit
   through the gates.
4. Proceed to step 4 only after step 3's characterization test is green.

## Operational gotchas (learned the hard way this session)

- **Fleet briefs MUST enumerate the exact FILES list** the builder will create.
  The planner (glm) omits create-files otherwise, the aider builder gets no write
  scope, and you get 3 rounds of guaranteed empty patches. Every step brief here
  includes a `# CRITICAL FOR THE PLANNER — FILES list` block — keep that pattern.
- **`proof.sh` expects `result.patch`** beside the fleet verdict, but fleet
  writes **`final.patch`**. Bridge before running proof:
  `cp <run>/final.patch <run>/result.patch`.
- **Landing a fleet patch:** `eng-apply` only accepts `.eng-team-jobs` dirs, not
  fleet run dirs. Use `git apply <run>/final.patch` directly.
- **Write-dispatch worktrees can't see untracked files.** The vision-doc rewrite
  failed round 1 because the target file was untracked → arrived empty in the
  worktree. Either commit first or embed the file content in the brief.
- **Commit gate:** requires a battled design (`design.allow.session`, may need
  re-recording after restart — re-run `design.sh` with the two saved packets:
  architect `.../20260706-175102-40020-generator-design-final/output.md`, counter
  `.../20260706-175324-43615-generator-design-converge/output.md`) **and** proof.
- **Registry Redis auth** that was throwing tracebacks all last session is
  **FIXED and pushed** (`claude-setup` `4cdc42e`, per memory
  `claude-setup-registry-fix-resume`). Open env issue: NAS codex-secrets share
  unreadable.
- This machine's `coord.sh` last session predated claim/ask/board subcommands —
  check `coord.sh -h` before relying on `claim`.

## Open questions / decisions still pending

- **Which NT book is first** (drives reading plan, structure scan, real pilot).
- **HCCP permission email** response (reference-work classification; website vs
  digital product) — outstanding.
- **SAAS copyright-page wording** to verify against a print OSB.
- **Google Form** final field list + PII policy detail.
- **API.Bible dynamic reading view** — launch or defer?

## Push decision

`bible-bowl-study` is 2 commits ahead of `origin/main` and **unpushed on
purpose** — pushing triggers the Pages deploy workflow. These two commits are
generator tooling only (no runtime/site changes), so pushing is low-risk, but
it's Wes's call. The SessionStart banner will keep nudging until pushed.
