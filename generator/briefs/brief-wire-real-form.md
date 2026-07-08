# Task
Wire the REAL Google Form into the Corinthians pilot so the "Suggest a question" links become live + prefilled, and make the "kind" dropdown pre-select correctly. Three small, precise edits. Do NOT touch app.js/index.html/rewards.js.

# Keep context small
Edit only the three files in the FILES list. They're small. No new deps.

# The real form (verified, live, no sign-in required)
- Responder URL: `https://docs.google.com/forms/d/e/1FAIpQLSdGhsUWaLUcjfJs9KOlbfMx9ja0jTCp1FGx7ANrbcbuURN2mQ/viewform`
- Prefill entry IDs (confirmed against the form's embedded data):
  - book  → `777521353`
  - chapter → `266107568`
  - kind  → `2141299893`
  - note  → `1123445537`
- The "Seed kind" field is a Google Forms **dropdown** whose option TEXT is exactly: `Question seed`, `Memory hook`, `Suggested correction`. Google Forms prefill only pre-selects a dropdown when the prefilled value EXACTLY equals the option text. The app currently sends the code `question_seed`, which will NOT pre-select. Fix: prefill the kind field with the matching option LABEL.

# Edit 1 — generator/pilots/corinthians/form-config.json
Replace the placeholder values with the real ones above:
- `formBaseUrl` → the responder URL above.
- Each field's `entryId` → the real numeric IDs above (as strings).
- Update `description` to drop the word PLACEHOLDER (say the form is live).
- KEEP the `kind` field's `options` array as `[{value,label}]` pairs, with values `question_seed|memory_hook|correction` and labels EXACTLY `Question seed|Memory hook|Suggested correction` (these labels must match the Google Form dropdown option text).

# Edit 2 — engine/src/seed-link.js (buildSeedUrl)
Make the "kind" param send the LABEL, resolved from the form-config's kind-field options (config-driven, book-agnostic). Add a small helper, e.g.:
```js
function labelForKind(formConfig, value) {
  const f = (formConfig.fields || []).find((x) => x && x.name === "kind");
  const opt = f && Array.isArray(f.options)
    ? f.options.find((o) => o && o.value === value) : null;
  return opt && opt.label ? opt.label : value; // fall back to the raw value
}
```
Then where buildSeedUrl adds the `kind` param, use `labelForKind(formConfig, c.kind || "question_seed")` as the value (instead of the raw code). All other fields (book/chapter/note) unchanged.

# Edit 3 — generator/pilots/corinthians/reading-plan.js (seedFormUrl)
Same idea: when setting the `kind` param, map the code (`"question_seed"`) to the matching option label from `form.fields` (the kind field's `options`), falling back to the raw value. So reading-plan seed links also pre-select the dropdown.

# Test — engine/tests/test-config-driven-runtime.mjs + fixture
- Ensure engine/tests/fixtures/form-config.json's `kind` field has `options:[{value,label}]` (values question_seed/memory_hook/correction, labels "Question seed"/etc.).
- Add/extend an assertion: `buildSeedUrl(fixture, {kind:"question_seed", ...})` emits the LABEL ("Question seed") for the kind entry, NOT the raw code. Keep ALL existing checks green.

# CRITICAL FOR THE PLANNER — FILES list (exact)
- generator/pilots/corinthians/form-config.json (modify)
- engine/src/seed-link.js (modify)
- generator/pilots/corinthians/reading-plan.js (modify)
- engine/tests/test-config-driven-runtime.mjs (modify)
- engine/tests/fixtures/form-config.json (modify — ensure kind options have value+label)

# Constraints
- Pure browser JS (engine/site) + Node stdlib (test). No new deps. UTF-8. Files < 800 lines. Book-agnostic (no literal book names in engine/src; `grep -ri exodus engine/src` stays empty).
- Do not modify app.js, index.html, or rewards.js.

# Acceptance
- `node engine/tests/test-config-driven-runtime.mjs` → exit 0 (existing + the new kind-label assertion).
- form-config.json validates as JSON and has the real formBaseUrl + entry IDs.
- grep -ri exodus engine/src → none.

# Report format
End with:
SUMMARY / FILES CHANGED / EVIDENCE (commands -> raw output + exit codes) / RISKS
