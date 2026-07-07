<!-- Approved final design produced by an architect/counter-critic battle; approved 2026-07-06. -->

MODEL: gpt-5.5

PLAN:
1. **Engine extraction**
   - First add characterization coverage around current behavior: existing `scripts/test-*.mjs` stay, plus one headless quiz-flow scenario covering question load, answer feedback, progress persistence, and rewards unlock. Verify: `node scripts/test-headless-quiz-flow.mjs`.
   - Split only after tests pass, using coarse modules: `config-state`, `storage`, `quiz-render-events`, and `passage-links`; keep existing labs/rewards file separation for now. Every resulting file must stay under 800 lines. Verify: `node generator/toolchain/scripts/check-line-counts.mjs engine/src`.
   - Exclude `bible-reader.js` from the NT engine. Runtime passage access is external licensed links only. Verify: `node engine/tests/test-passage-links.mjs`.

2. **Generator/toolchain layout**
   - Keep `engine/` and `generator/` in this repo. Maintain source under `engine/src`; do not commit `engine/dist` snapshots. CI builds release artifacts from tagged source. Verify: `git ls-files engine/dist`.
   - Add a reusable GitHub Actions workflow in this repo. Book repos deploy through one pinned `uses:` reference to an engine tag. Verify: `node generator/toolchain/scripts/validate-workflow-pin.mjs --fixture generator/fixtures/book-repo`.
   - Local scaffold and packaging scripts must be pure Node using `fs.cp`, `path`, and related APIs; no shell `cp`, `rm`, or platform-specific path assumptions. Verify: `node generator/toolchain/scripts/check-windows-safe-scripts.mjs`.

3. **Data schemas**
   - Define schemas for queue items, question candidates, memory-tool candidates, research artifacts, source manifests, site config, reading plans, form config, and reviewer attestations. Verify: `node generator/toolchain/scripts/validate-schemas.mjs --self-test`.
   - Queue state machine remains explicit: `queued`, `approved`, `researched`, `drafted`, `in-review`, `published`, `rejected`, with permanent rejection reason codes and state history. Verify: `node generator/toolchain/scripts/test-queue-state-machine.mjs`.
   - Source manifest publisher blocks carry only verified publisher terms. Any internal cap moves to `internalPolicy` with `selfImposed: true` and a rationale string. Verify: `node generator/toolchain/scripts/test-source-manifest-policy.mjs`.

4. **Six build gates**
   - Gate 1: schema and state validation for all generated JSON. Verify: `node generator/toolchain/scripts/validate-schemas.mjs --fixture generator/fixtures/minimal-book`.
   - Gate 2: verse budget audit for manifest-counted scripture fields. Verify: `node generator/toolchain/scripts/audit-verse-budget.mjs --fixture generator/fixtures/minimal-book`.
   - Gate 3: untracked-excerpt defense: scripture text is legal only in manifest-counted fields, free-text fields are checked by n-gram overlap against quoted-verse fingerprints, and each release requires a reviewer attestation checklist artifact. Verify: `node generator/toolchain/scripts/detect-untracked-excerpts.mjs --fixture generator/fixtures/minimal-book`.
   - Gate 4: encoding audit for UTF-8, U+FFFD, and mojibake patterns. Verify: `node generator/toolchain/scripts/check-encoding.mjs --fixture generator/fixtures/minimal-book`.
   - Gate 5: line-count audit enforcing the 800-line ceiling. Verify: `node generator/toolchain/scripts/check-line-counts.mjs engine/src generator`.
   - Gate 6: built-site audit walking `_site` and failing on `data/source-text/**` or configured raw scripture text markers. Verify: `node generator/toolchain/scripts/check-built-site-no-source-text.mjs --site generator/fixtures/minimal-book/_site`.
   - All scaffolds run the six gates locally and in CI before deploy. Verify: `node generator/toolchain/scripts/verify-all.mjs --fixture generator/fixtures/minimal-book`.

5. **Google Sheet ingestion**
   - Use Sheets API, not published CSV. Add `googleapis` or `google-auth-library` as a devDependency of the generator toolchain only; runtime remains dependency-free. Verify: `node generator/toolchain/scripts/check-runtime-deps.mjs`.
   - `ingest-sheet.mjs` reads via service-account credentials, strips student-identifying fields, hashes source row IDs, normalizes references, dedups seeds, and writes queue JSON. Verify: `node generator/toolchain/scripts/ingest-sheet.mjs --fixture generator/fixtures/sheet-rows.json --dry-run`.
   - Duplicate seeds merge into the oldest live queue item; rejected duplicates keep permanent `reasonCode: duplicate`. Verify: `node generator/toolchain/scripts/test-sheet-dedup.mjs`.

6. **Reading plan and form links**
   - Generated sites include `reading.html`, `data/reading-plan.json`, and `data/form-config.json`; assignments show week, reference range, external licensed passage link, and prefilled seed form link. Verify: `node generator/toolchain/scripts/test-reading-plan-links.mjs --fixture generator/fixtures/minimal-book`.
   - No page displays book text. Feedback and study links route through `passage-links`. Verify: `node generator/toolchain/scripts/check-no-inline-scripture-pages.mjs --fixture generator/fixtures/minimal-book`.

7. **Question factory and Exodus inventory**
   - Before writing generic factory code, inventory existing Exodus scripts: `build.js`, `build-review-packets.js`, `apply-reviewed-choice.js`, `import-review-csv.js`, and `osb-audit/verify`; tag behavior as book-specific or book-agnostic. Verify: `node generator/toolchain/scripts/inventory-exodus-factory.mjs --check`.
   - Build the generic factory and Exodus adapter from that inventory, supporting all three existing question types: multiple-choice, true-false, and fill-in. Verify: `node generator/toolchain/scripts/build.js --fixture generator/fixtures/minimal-book`.
   - Preserve human review and defer bot lanes. Review packets, CSV import, and apply-reviewed-choice remain deterministic. Verify: `node generator/toolchain/scripts/test-review-roundtrip.mjs --fixture generator/fixtures/minimal-book`.

8. **Research, labs, and rewards boundary**
   - Phase 1 keeps rewards and labs behavior-preserved through characterization and coarse engine extraction, but does not make them fully data-driven yet. Verify: `node scripts/test-headless-quiz-flow.mjs --include-rewards`.
   - Phase 2 adds data-driven memory labs and rewards, plus research export/import. Imported citations start as `found`, never `verified`. Verify: `node generator/toolchain/scripts/import-research-artifacts.mjs --fixture generator/fixtures/research-return.md --dry-run`.

9. **Re-phased build plan**
   - Step 1: Inventory Exodus factory scripts and produce the book-specific/book-agnostic map. Verify: `node generator/toolchain/scripts/inventory-exodus-factory.mjs --check`.
   - Step 2: Add schemas, shared validators, queue state tests, source-manifest `internalPolicy`, and reviewer attestation schema. Verify: `node generator/toolchain/scripts/validate-schemas.mjs --self-test`.
   - Step 3: Add characterization tests before engine work: existing tests plus headless quiz-flow, progress, and rewards-unlock scenario. Verify: `node scripts/test-headless-quiz-flow.mjs`.
   - Step 4: Coarsely split engine modules and replace book literals with config-driven runtime and external passage links. Verify: `node engine/tests/test-config-driven-runtime.mjs`.
   - Step 5: Add fixture-book scaffold, reading plan, form links, and Windows-safe Node-only scaffold scripts. Verify: `node generator/scripts/scaffold-book-site.mjs --fixture --target tmp/scaffold-check --engine-tag bbs-engine-v0.1.0 --dry-run`.
   - Step 6: Generalize question factory from the Exodus inventory, supporting multiple-choice, true-false, and fill-in. Verify: `node generator/toolchain/scripts/build.js --fixture generator/fixtures/minimal-book`.
   - Step 7: Implement all six deploy-blocking gates and wire them into generated local and CI workflows. Verify: `node generator/toolchain/scripts/verify-all.mjs --fixture generator/fixtures/minimal-book`.
   - Step 8: Add Sheets API ingestion with `googleapis` or `google-auth-library` as generator devDependency only. Verify: `node generator/toolchain/scripts/ingest-sheet.mjs --fixture generator/fixtures/sheet-rows.json --dry-run`.
   - Step 9: Add reusable engine GitHub Actions workflow and book-repo deploy template pinned to an engine tag; dist remains a CI artifact only. Verify: `node generator/toolchain/scripts/validate-workflow-pin.mjs --fixture generator/fixtures/book-repo`.
   - Step 10: Validate the full Phase 1 slice end-to-end with a fixture book, not a real book. Verify: `node generator/toolchain/scripts/verify-all.mjs --fixture generator/fixtures/full-slice-book`.
   - Step 11: Phase 2 only after Phase 1 passes: data-driven memory labs, data-driven rewards, and research export/import. Verify: `node generator/toolchain/scripts/verify-phase2-fixture.mjs`.
   - Step 12: Real-book pilot waits until the owner names the target book. Verify: `node generator/scripts/scaffold-book-site.mjs --book <chosen-book> --target ../bible-bowl-<slug> --engine-tag <tag> --dry-run`.

RISKS:
1. Publisher terms may still classify the site as outside gratis use; keep publisher terms separate from self-imposed policy and require release attestation.
2. N-gram excerpt detection reduces risk but cannot prove absence of every scripture-like paraphrase; document residual limits honestly.
3. Engine extraction can regress implicit DOM/event behavior unless characterization tests stay ahead of module splits.
4. Generated scaffolds must never publish `data/source-text/**`; the sixth gate must inspect final `_site`, not just source inputs.
5. Sheets ingestion touches student submissions; use service-account API access, strip PII, and avoid published CSV.
6. CI-built artifacts remove source/dist drift but require disciplined tag and workflow pinning.

SUMMARY:
Final plan keeps engine and generator in this repo but never commits engine dist snapshots.
Characterization tests come before any engine split, and the split stays coarse.
Phase 1 is a fixture-book vertical slice with schemas, tests, runtime config, scaffold, reading/form links, all three question types, six gates, and Sheet ingestion.
Phase 2 gets data-driven labs/rewards and research import/export.
Book deploys use one pinned reusable workflow, with Windows-safe Node tooling locally.
A real-book pilot waits until the owner chooses the book.
