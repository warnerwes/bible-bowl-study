/* Anki CSV export — config-driven deck/header/filename/tag names.
   Extracted from app.js. Pure browser JS (ES module), framework-free. */
"use strict";

const AID_LABELS = {
  mnemonic: "Mnemonic",
  teaching: "Teaching",
  image: "Memorable image",
};

function csvField(s) {
  return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
}

function ankiFront(q) {
  let f = q.question;
  if (q.type === "multiple-choice" && Array.isArray(q.options)) {
    f += "<br><br>" + q.options.join("<br>");
  } else if (q.type === "true-false") {
    f += "<br><br>True or false?";
  }
  return f;
}

function ankiBack(q, referenceFor) {
  let b = "<b>" + q.answer + "</b>";
  b += '<br><span style="color:#888">(' + referenceFor(q) + ")</span>";
  if (q.memoryAid && q.memoryAid.text) {
    const label = AID_LABELS[q.memoryAid.type] || "Memory aid";
    b += "<br><br><i>" + label + ":</i> " + q.memoryAid.text;
    if (q.memoryAid.source) b += "<br>— " + q.memoryAid.source;
  }
  return b;
}

function ankiTags(q, config) {
  const prefix = (config && config.bookName)
    ? `BibleBowl ${config.bookName}::Ch`
    : "BibleBowl::Ch";
  return `${prefix}${q.chapter} ${q.type}`;
}

// Build the Anki text-import CSV for a list of questions. `referenceFor(q)`
// resolves the reference string for each question (passed in so this module
// stays free of the quiz-core/config coupling at call sites that don't need
// it; callers pass `(q) => referenceFor(q, config)`).
export function buildAnkiCsv(qs, { config, referenceFor } = {}) {
  const cfg = config || {};
  const refFn = typeof referenceFor === "function"
    ? referenceFor
    : (q) => (q.reference || String(q.chapter));
  const deckName = cfg.bookName
    ? `Bible Bowl - ${cfg.bookName}`
    : "Bible Bowl";
  const out = [
    "#separator:Comma",
    "#html:true",
    "#notetype:Basic",
    `#deck:${deckName}`,
    "#tags column:3",
  ];
  qs.forEach((q) => {
    out.push([
      csvField(ankiFront(q)),
      csvField(ankiBack(q, refFn)),
      csvField(ankiTags(q, cfg)),
    ].join(","));
  });
  return out.join("\n") + "\n";
}

// Trigger a browser download of the CSV. Uses Blob + a transient <a> element.
// `document` is referenced via the global so this stays framework-free.
export function exportAnki(qs, { config, referenceFor } = {}) {
  if (!qs || !qs.length) return;
  if (typeof document === "undefined" || typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function") {
    return;
  }
  const cfg = config || {};
  const slug = cfg.siteSlug || "bible-bowl";
  const filename = `${slug}-anki.csv`;
  const blob = new Blob([buildAnkiCsv(qs, { config: cfg, referenceFor })],
    { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { AID_LABELS };