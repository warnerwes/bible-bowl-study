/* Seed link — builds a prefilled Google-Form URL for the "Suggest a question"
   seed-capture affordance. Book-agnostic: all values come from the caller
   (the current question / config), never hardcoded here.

   The link only renders when a real form-config is present, so the engine
   stays inert until a form is wired. Pure browser JS (ES module),
   framework-free. */
"use strict";

export const SEED_LABEL = "Suggest a question about this passage";

// True only when formConfig is an object with a non-placeholder formBaseUrl
// and a non-empty fields array. False for null/undefined/placeholder.
export function formReady(formConfig) {
  if (!formConfig || typeof formConfig !== "object") return false;
  const base = formConfig.formBaseUrl;
  if (typeof base !== "string" || !base) return false;
  if (base.indexOf("PLACEHOLDER") !== -1) return false;
  const fields = formConfig.fields;
  if (!Array.isArray(fields) || fields.length === 0) return false;
  return true;
}

// Find a field's entryId by name. Returns "" when not found.
function entryIdFor(formConfig, name) {
  const f = (formConfig.fields || []).find((x) => x && x.name === name);
  return f && f.entryId != null ? String(f.entryId) : "";
}

// Resolve the LABEL for a kind code from the form-config's kind-field
// options (config-driven, book-agnostic). Google Forms dropdown prefill
// only pre-selects when the prefilled value EXACTLY equals the option
// text, so we send the label rather than the internal code. Falls back
// to the raw value when no matching option is found.
function labelForKind(formConfig, value) {
  const f = (formConfig.fields || []).find((x) => x && x.name === "kind");
  const opt = f && Array.isArray(f.options)
    ? f.options.find((o) => o && o.value === value) : null;
  return opt && opt.label ? opt.label : value;
}

// Derive the CHAPTER-field value without repeating the book name. When the
// reference begins with the book (e.g. book="1 Corinthians", reference=
// "1 Corinthians 15:1"), strip that prefix → "15:1". Otherwise fall back to the
// chapter number, then the raw reference. Book-agnostic: `book` comes from the
// caller, never hardcoded here.
function chapterField(book, reference, chapter) {
  const ref = reference != null ? String(reference).trim() : "";
  const bk = book != null ? String(book).trim() : "";
  if (ref && bk && ref.toLowerCase().startsWith(bk.toLowerCase())) {
    const rest = ref.slice(bk.length).trim();
    if (rest) return rest;
  }
  if (chapter != null && String(chapter) !== "") return String(chapter);
  return ref;
}

// Build a prefilled Google-Form URL, or null when !formReady.
// `ctx` is { book, chapter, reference, kind } — all optional.
//  - book    → the "book" field
//  - chapter → the "chapter" field: the chapter portion only (book prefix
//              stripped from `reference`), falling back to `chapter`.
//  - kind    → the "kind" field, defaulting to "question_seed"
//  - note    → the "note" field, always "" (the student fills it)
export function buildSeedUrl(formConfig, ctx) {
  if (!formReady(formConfig)) return null;
  const c = ctx || {};
  const base = formConfig.formBaseUrl;
  const params = [];
  const add = (name, value) => {
    const id = entryIdFor(formConfig, name);
    if (id) params.push(`entry.${id}=${encodeURIComponent(String(value))}`);
  };
  add("book", c.book || "");
  add("chapter", chapterField(c.book, c.reference, c.chapter));
  add("kind", labelForKind(formConfig, c.kind || "question_seed"));
  add("note", "");
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return params.length ? `${base}${sep}${params.join("&")}` : base;
}
