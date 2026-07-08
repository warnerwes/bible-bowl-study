/* Config-driven runtime test for the engine.
   Loads the engine's ES modules in a minimal DOM stub (no external deps),
   drives a tiny fixture site-config + 2 fixture questions, and asserts:
     - questions load
     - correct/incorrect answer feedback
     - stats persist to the stub's localStorage
     - NO hard dependency on rewards/labs/reader (engine runs with them absent)
     - no remaining literal "Exodus" in engine/src

   Run: node engine/tests/test-config-driven-runtime.mjs
   Exit 0 on all-pass, 1 on any failure. */
import assert from "assert/strict";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ENGINE_SRC = join(__dirname, "..", "src");
const FIXTURES = join(__dirname, "fixtures");

const failures = [];
let passes = 0;
function check(name, cond, detail = "") {
  if (cond) {
    passes += 1;
    console.log(`PASS  ${name}`);
  } else {
    const msg = `FAIL  ${name}${detail ? " — " + detail : ""}`;
    console.log(msg);
    failures.push(name);
  }
}

// ---------------------------------------------------------------------------
// Minimal DOM + browser-globals stub (no external dependencies).
// Supports exactly the surface area the engine uses: getElementById,
// createElement, querySelectorAll, addEventListener, fetch, localStorage,
// Blob, URL.createObjectURL, CustomEvent, window.
// ---------------------------------------------------------------------------
class StubNode {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = [];
    this.attributes = {};
    this._listeners = {};
    this.hidden = false;
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.value = "";
    this.type = "";
    this.checked = false;
    this.disabled = false;
    this.href = "";
    this.target = "";
    this.rel = "";
    this.download = "";
    this.placeholder = "";
    this.autocomplete = "";
    this.id = "";
    this.style = {};
    this.dataset = {};
    this.parent = null;
    this.classList = makeClassList(this);
  }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parent = null;
    return c;
  }
  remove() {
    if (this.parent) this.parent.removeChild(this);
  }
  append(...nodes) {
    nodes.forEach((n) => {
      if (typeof n === "string" || typeof n === "number") {
        this.textContent += String(n);
      } else {
        this.appendChild(n);
      }
    });
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] != null ? this.attributes[k] : null; }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener() {}
  dispatchEvent() { return true; }
  querySelectorAll(sel) {
    // Minimal: support ".class", "#id", "tag". Only used for ".chapter-cb",
    // ".chapter-cb:checked", "#type-list input:checked", ".option-btn",
    // "[data-select]". We walk children breadth-first.
    return walk(this, sel);
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }
  focus() {}
  click() {
    (this._listeners["click"] || []).forEach((fn) => fn({ preventDefault() {} }));
  }
}
function walk(root, sel) {
  const out = [];
  const stack = [...root.children];
  while (stack.length) {
    const n = stack.shift();
    if (matches(n, sel)) out.push(n);
    stack.push(...n.children);
  }
  return out;
}
function matches(node, sel) {
  // Very small selector matcher: supports ".cls", ".cls:checked",
  // "#id", "tag", "[attr]", "parent sel" (descendant). Good enough for
  // the engine's querySelectorAll calls.
  const sels = sel.split(",").map((s) => s.trim());
  return sels.some((s) => matchOne(node, s));
}
function matchOne(node, sel) {
  // descendant "a b": match b if an ancestor matches a.
  const parts = sel.split(/\s+/);
  let target = node;
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (!matchOne(node, last)) return false;
    let p = node.parent;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (p && !matchOne(p, parts[i])) p = p.parent;
      if (!p) return false;
      p = p.parent;
    }
    return true;
  }
  // single selector, possibly with :checked
  let s = sel;
  let checked = false;
  if (s.endsWith(":checked")) { checked = true; s = s.slice(0, -":checked".length); }
  if (checked && !node.checked) return false;
  if (s.startsWith(".") && node.className.split(/\s+/).includes(s.slice(1))) return true;
  if (s.startsWith("#") && node.id === s.slice(1)) return true;
  if (s.startsWith("[") && s.endsWith("]")) {
    const attr = s.slice(1, -1);
    return node.attributes[attr] != null || Object.prototype.hasOwnProperty.call(node.dataset, attr);
  }
  if (node.tagName && node.tagName.toLowerCase() === s.toLowerCase()) return true;
  return false;
}

function makeClassList(node) {
  const set = new Set();
  return {
    add(c) { set.add(c); node.className = [...set].join(" "); },
    remove(c) { set.delete(c); node.className = [...set].join(" "); },
    contains(c) { return set.has(c); },
    toggle(c) { set.has(c) ? set.delete(c) : set.add(c); node.className = [...set].join(" "); },
  };
}
function makeDocument() {
  const body = new StubNode("body");
  const head = new StubNode("head");
  // Pre-create the ids the engine references, so getElementById works.
  const ids = [
    "app", "setup", "quiz", "results", "home",
    "chapter-list", "type-list", "count", "setup-summary", "start-btn",
    "export-csv", "quick-start", "drill-missed", "review-mastered",
    "quick-note", "missed-cta", "missed-count", "mastered-cta",
    "mastered-count", "load-error",
    "q-position", "q-score", "progress-bar", "q-ref", "q-topic", "q-type",
    "q-text", "answer-area", "submit-btn", "answer-form",
    "feedback", "feedback-verdict", "feedback-answer", "feedback-next-bar",
    "next-btn", "quit-btn", "passage-link",
    "result-score", "missed-review",
    "fill-input",
  ];
  const byId = {};
  ids.forEach((id) => {
    const n = new StubNode("div");
    n.id = id;
    byId[id] = n;
    body.appendChild(n);
  });
  const doc = {
    body,
    head,
    getElementById(id) {
      if (byId[id]) return byId[id];
      // Fall back to walking for dynamically created + appended nodes
      // (real browsers find these by id; the stub's byId map is static).
      const found = body.querySelector(`#${id}`);
      return found || null;
    },
    createElement(tag) { return new StubNode(tag); },
    querySelectorAll(sel) { return body.querySelectorAll(sel); },
    querySelector(sel) { return body.querySelector(sel); },
    addEventListener(type, fn) {
      (doc._listeners = doc._listeners || {})[type] =
        (doc._listeners[type] || []).concat(fn);
    },
  };
  return { doc, body, byId };
}

function makeLocalStorage() {
  const store = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    _raw: store,
  };
}

function makeFetch(fixtureConfig, fixtureQuestions, extraRoutes = {}) {
  // Map of path → body. Routes known engine fetches to fixture content.
  const routes = {
    "data/site-config.json": JSON.stringify(fixtureConfig),
    "data/questions.json": JSON.stringify(fixtureQuestions),
    ...extraRoutes,
  };
  return async function fetch(url, _opts) {
    const path = String(url).split("?")[0];
    const body = routes[path];
    if (body != null) {
      return {
        ok: true,
        status: 200,
        async json() { return JSON.parse(body); },
        async text() { return body; },
      };
    }
    return { ok: false, status: 404, async json() { return {}; }, async text() { return ""; } };
  };
}

class StubBlob {
  constructor(parts) { this._text = parts.map(String).join(""); }
}
class StubURL {
  static createObjectURL() { return "blob:stub"; }
  static revokeObjectURL() {}
}

class StubCustomEvent {
  constructor(type, init) { this.type = type; this.detail = (init && init.detail) || {}; }
}

// ---------------------------------------------------------------------------
// Wire globals BEFORE importing the engine modules, because ES modules
// capture their globals at evaluation time (top-level). The engine reads
// `document`, `fetch`, `localStorage`, `window`, `URL`, `Blob`,
// `CustomEvent` as free variables — Node resolves free variables to
// properties on the global object.
// ---------------------------------------------------------------------------
const { doc, body, byId } = makeDocument();
const localStorage = makeLocalStorage();
const fixtureConfig = JSON.parse(readFileSync(join(FIXTURES, "site-config.json"), "utf8"));
const fixtureQuestions = JSON.parse(readFileSync(join(FIXTURES, "questions.json"), "utf8"));
const fixtureFormConfig =
  JSON.parse(readFileSync(join(FIXTURES, "form-config.json"), "utf8"));
const fetch = makeFetch(fixtureConfig, fixtureQuestions, {
  "data/form-config.json": JSON.stringify(fixtureFormConfig),
});

globalThis.document = doc;
globalThis.localStorage = localStorage;
globalThis.fetch = fetch;
globalThis.window = globalThis;
globalThis.Blob = StubBlob;
globalThis.URL = StubURL;
globalThis.CustomEvent = StubCustomEvent;
globalThis.history = { pushState() {}, replaceState() {}, };
// Intentionally DO NOT define window.BibleReader, window.BibleBowlHasPendingUnlock,
// or window.BibleBowlConsumeUnlockScroll — the test asserts the engine runs
// without them.

// ---------------------------------------------------------------------------
// Import the engine modules (ES modules, file:// URLs on Windows).
// ---------------------------------------------------------------------------
const srcUrl = (rel) => pathToFileURL(join(ENGINE_SRC, rel)).href;
const { loadConfig, getConfig, resolveConfig, setConfig } =
  await import(srcUrl("config.js"));
const { createStorage } = await import(srcUrl("storage.js"));
const { createState, launch, submit, next, weightedOrder, filterPool,
        referenceFor, isCorrectAnswer, fillInIsCorrect } =
  await import(srcUrl("quiz-core.js"));
const { createQuiz } = await import(srcUrl("quiz-render.js"));
const { passageUrl, passageLabel, getProvider } =
  await import(srcUrl("passage-links.js"));
const { formReady, buildSeedUrl, SEED_LABEL } =
  await import(srcUrl("seed-link.js"));
const { buildAnkiCsv, exportAnki } = await import(srcUrl("anki-export.js"));

// ---------------------------------------------------------------------------
// Drive the engine.
// ---------------------------------------------------------------------------
try {
  // 1. Config loads from the fixture.
  const cfg = await loadConfig("data/site-config.json");
  check("config loads from fixture site-config.json",
    cfg.bookName === "Testament" && cfg.siteSlug === "test-bowl",
    `bookName=${cfg.bookName} siteSlug=${cfg.siteSlug}`);

  // 2. Storage layer round-trips stats.
  const storage = createStorage(cfg);
  storage.load();
  const sq = { id: "te01-001" };
  storage.recordResult(sq, true);
  check("storage records a correct result",
    storage.get("te01-001").right === 1 && storage.get("te01-001").streak === 1,
    JSON.stringify(storage.get("te01-001")));
  storage.recordResult(sq, false);
  check("storage resets streak on a miss",
    storage.get("te01-001").wrong === 1 && storage.get("te01-001").streak === 0,
    JSON.stringify(storage.get("te01-001")));

  // 3. Quiz state machine: launch + weightedOrder on the fixture.
  const state = createState();
  state.all = fixtureQuestions.slice();
  const ordered = weightedOrder(state.all, storage);
  check("weightedOrder returns all questions",
    ordered.length === fixtureQuestions.length,
    `len=${ordered.length}`);
  launch(state, ordered, "quick");
  check("launch sets mode + index",
    state.mode === "quick" && state.index === 0 && state.quiz.length === 2,
    `mode=${state.mode} index=${state.index} len=${state.quiz.length}`);

  // 4. Answer checking (config-driven reference + correctness).
  const mc = fixtureQuestions[0]; // multiple-choice, answer "Alpha"
  check("MC correct answer recognized",
    isCorrectAnswer(mc, "Alpha", null) === true);
  check("MC wrong answer recognized",
    isCorrectAnswer(mc, "Bravo", null) === false);
  const fi = fixtureQuestions[1]; // fill-in, answer "yes"
  check("fill-in correct answer recognized",
    fillInIsCorrect("yes", fi) === true);
  check("fill-in wrong answer rejected",
    fillInIsCorrect("definitely-wrong", fi) === false);

  // 5. referenceFor uses q.reference, falls back to config.defaultBookLabel.
  check("referenceFor uses q.reference when present",
    referenceFor(mc, cfg) === "Testament 1:1-5");
  const noRef = { chapter: 5 };
  check("referenceFor falls back to defaultBookLabel + chapter",
    referenceFor(noRef, cfg) === "Testament 5");

  // 6. Passage links: external URL, no scripture text.
  const url = passageUrl("Testament 1:1-5", {
    provider: cfg.passageProvider, bibleVersion: cfg.bibleVersion });
  check("passageUrl builds an external Bible Gateway URL",
    url.startsWith("https://www.biblegateway.com/passage/") &&
      url.includes("Testament") && url.includes("NKJV"),
    `url=${url}`);
  check("passageLabel is human-readable",
    passageLabel("Testament 1:1-5", { provider: cfg.passageProvider })
      .includes("Testament 1:1-5"));

  // 6b. Seed link: formReady + buildSeedUrl (book-agnostic).
  check("formReady returns true for the fixture form-config",
    formReady(fixtureFormConfig) === true);
  check("formReady returns false for a PLACEHOLDER formBaseUrl",
    formReady({ formBaseUrl: "https://docs.google.com/forms/d/PLACEHOLDER/x/viewform", fields: [{ name: "book", entryId: "1" }] }) === false);
  check("formReady returns false for null",
    formReady(null) === false);
  check("SEED_LABEL is a non-empty string",
    typeof SEED_LABEL === "string" && SEED_LABEL.length > 0);
  const seedUrl = buildSeedUrl(fixtureFormConfig, {
    book: "1 Corinthians", chapter: 15, reference: "1 Corinthians 15", kind: "question_seed",
  });
  check("buildSeedUrl returns a non-null URL for the fixture",
    typeof seedUrl === "string" && seedUrl.length > 0, `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL contains the form base path",
    seedUrl && seedUrl.indexOf("TESTFORMID") !== -1, `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL contains each fixture entry id",
    seedUrl && seedUrl.indexOf("entry.2000001=") !== -1 &&
      seedUrl.indexOf("entry.2000002=") !== -1 &&
      seedUrl.indexOf("entry.2000003=") !== -1 &&
      seedUrl.indexOf("entry.2000004=") !== -1,
    `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL prefills the book value",
    seedUrl && seedUrl.indexOf(encodeURIComponent("1 Corinthians")) !== -1,
    `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL prefills the chapter/reference value",
    seedUrl && seedUrl.indexOf(encodeURIComponent("1 Corinthians 15")) !== -1,
    `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL prefills the kind LABEL (not the raw code)",
    seedUrl && seedUrl.indexOf(encodeURIComponent("Question seed")) !== -1,
    `seedUrl=${seedUrl}`);
  check("buildSeedUrl URL does NOT emit the raw kind code",
    seedUrl && seedUrl.indexOf(encodeURIComponent("question_seed")) === -1,
    `seedUrl=${seedUrl}`);
  check("buildSeedUrl returns null for a placeholder form-config",
    buildSeedUrl({ formBaseUrl: "...PLACEHOLDER...", fields: [] },
      { book: "x", chapter: 1, reference: "x 1", kind: "question_seed" }) === null);
  check("buildSeedUrl returns null for null form-config",
    buildSeedUrl(null, { book: "x", chapter: 1 }) === null);

  // 7. Anki export is config-driven (deck name, filename, tag prefix).
  const csv = buildAnkiCsv(fixtureQuestions,
    { config: cfg, referenceFor: (q) => referenceFor(q, cfg) });
  check("Anki CSV deck name is config-driven",
    csv.includes("#deck:Bible Bowl - Testament"),
    `csv snippet=${csv.split("\n").slice(0,6).join("|")}`);
  check("Anki CSV tag prefix uses config.bookName",
    csv.includes("BibleBowl Testament::Ch1"),
    `csv snippet=${csv.split("\n").slice(0,8).join("|")}`);
  check("Anki CSV has NO literal Exodus deck name",
    !csv.includes("Bible Bowl - Exodus") && !csv.includes("Exodus::"));

  // 8. Render: wire the quiz onto the DOM stub, drive a full flow.
  const quiz = createQuiz({ state, storage, config: cfg, weightedOrder });
  await quiz.load();
  check("quiz.load() populates state.all from the fixture",
    state.all.length === fixtureQuestions.length,
    `len=${state.all.length}`);
  // refreshHome / buildSetup run during load; the home CTAs should exist.
  check("quiz.load() builds setup without rewards/reader present",
    byId["setup"] != null && byId["quick-start"] != null);

  // Start a quiz and answer the first (MC) question correctly.
  quiz.startQuick();
  check("startQuick shows the quiz screen",
    byId["quiz"].hidden === false && byId["setup"].hidden === true);
  // The first rendered question should be one of the two fixtures.
  const refText = byId["q-ref"].textContent;
  check("renderQuestion populates q-ref with the fixture reference",
    refText === "Testament 1:1-5" || refText === "Testament 2:3",
    `q-ref=${refText}`);

  // Select the correct option (whichever fixture is showing) and submit.
  const showingMc = refText === "Testament 1:1-5";
  const currentQ = showingMc ? mc : fi;
  if (showingMc) {
    const opts = body.querySelectorAll(".option-btn");
    check("MC question renders option buttons",
      opts.length === 4, `opts=${opts.length}`);
    // Pick the button whose text matches the answer.
    const correctBtn = opts.find((b) => b.textContent === currentQ.answer);
    const wrongBtn = opts.find((b) => b.textContent !== currentQ.answer);
    check("MC question has a correct + a wrong option button",
      !!correctBtn && !!wrongBtn);
    // Answer WRONG first to exercise the incorrect-feedback path, then
    // we'll restart is not needed — we can just check the verdict.
    wrongBtn.click();
    byId["submit-btn"].click && (function () {
      // Dispatch the form submit via its listener. The engine added a
      // submit listener on #answer-form; call it directly.
      const form = byId["answer-form"];
      const submitListeners = form._listeners["submit"] || [];
      const evt = { preventDefault() {}, type: "submit" };
      submitListeners.forEach((fn) => fn(evt));
    })();
    check("incorrect MC answer shows wrong verdict",
      byId["feedback-verdict"].textContent === "Not quite" &&
        byId["feedback-verdict"].className.includes("wrong"),
      `verdict=${byId["feedback-verdict"].textContent}`);
    check("incorrect MC answer records stats (wrong >= 1)",
      (storage.get(currentQ.id) && storage.get(currentQ.id).wrong >= 1),
      JSON.stringify(storage.get(currentQ.id)));
  } else {
    // Fill-in showing first: type the correct answer.
    const input = byId["fill-input"];
    input.value = currentQ.answer;
    const form = byId["answer-form"];
    (form._listeners["submit"] || []).forEach((fn) =>
      fn({ preventDefault() {}, type: "submit" }));
    check("correct fill-in answer shows right verdict",
      byId["feedback-verdict"].textContent === "Correct" &&
        byId["feedback-verdict"].className.includes("right"),
      `verdict=${byId["feedback-verdict"].textContent}`);
  }

  // Advance to the next question and answer it correctly.
  byId["next-btn"].click && (function () {
    const nbListeners = byId["next-btn"]._listeners["click"] || [];
    nbListeners.forEach((fn) => fn({ preventDefault() {} }));
  })();
  check("next() advances to the second question",
    state.index === 1, `index=${state.index}`);

  // Answer the second question correctly.
  const secondRef = byId["q-ref"].textContent;
  const secondQ = secondRef === "Testament 1:1-5" ? mc : fi;
  if (secondQ.type === "fill-in") {
    const input = byId["fill-input"];
    input.value = secondQ.answer;
    (byId["answer-form"]._listeners["submit"] || []).forEach((fn) =>
      fn({ preventDefault() {}, type: "submit" }));
  } else {
    const opts = body.querySelectorAll(".option-btn");
    const correctBtn = opts.find((b) => b.textContent === secondQ.answer);
    if (correctBtn) correctBtn.click();
    (byId["answer-form"]._listeners["submit"] || []).forEach((fn) =>
      fn({ preventDefault() {}, type: "submit" }));
  }
  check("second question correct answer shows right verdict",
    byId["feedback-verdict"].textContent === "Correct" &&
      byId["feedback-verdict"].className.includes("right"),
    `verdict=${byId["feedback-verdict"].textContent}`);

  // Advance past the last question → results.
  (byId["next-btn"]._listeners["click"] || []).forEach((fn) =>
    fn({ preventDefault() {} }));
  check("after the last question, results screen shows",
    byId["results"].hidden === false && byId["quiz"].hidden === true,
    `results.hidden=${byId["results"].hidden} quiz.hidden=${byId["quiz"].hidden}`);

  // 9. Stats persisted to the stub localStorage as valid JSON.
  const rawStats = localStorage.getItem("bbs:stats:v1");
  let parsed = null;
  try { parsed = JSON.parse(rawStats || ""); } catch (e) {}
  check("bbs:stats:v1 persisted as valid JSON",
    parsed != null && typeof parsed === "object",
    `raw=${(rawStats || "").slice(0, 80)}`);
  check("bbs:stats:v1 reflects answered questions",
    Object.prototype.hasOwnProperty.call(parsed || {}, mc.id) ||
      Object.prototype.hasOwnProperty.call(parsed || {}, fi.id),
    `keys=${parsed ? Object.keys(parsed).join(",") : "<none>"}`);

  // 10. Engine runs with NO rewards/labs/reader present (no globals defined).
  check("no window.BibleReader required (undefined is fine)",
    typeof globalThis.BibleReader === "undefined");
  check("no window.BibleBowlHasPendingUnlock required",
    typeof globalThis.BibleBowlHasPendingUnlock === "undefined");
  check("no window.BibleBowlConsumeUnlockScroll required",
    typeof globalThis.BibleBowlConsumeUnlockScroll === "undefined");

  // 10b. Seed link renders in the engine only when a real form-config is
  // wired. Drive a second quiz instance with a site-config whose
  // formConfigPath points at the fixture form-config (served by the stub
  // fetch). Then assert the seed link is present after renderQuestion();
  // and absent when no form-config (or a placeholder one) is used.
  const cfgWithForm = resolveConfig({
    ...fixtureConfig,
    formConfigPath: "data/form-config.json",
  });
  const cfgLoaded = await loadConfig("data/site-config.json");
  // Re-load with the form-config path so loadConfig fetches form-config.
  const cfgForm = resolveConfig({ ...fixtureConfig, formConfigPath: "data/form-config.json" });
  setConfig(cfgForm);
  const cfgAfter = getConfig();
  // Manually drive loadConfig's form-config fetch path by calling it.
  // loadConfig uses the global fetch which serves the fixture.
  const cfgFormLoaded = await loadConfig("data/site-config.json");
  // The site-config fixture has no formConfigPath, so formConfig is null.
  check("loadConfig leaves formConfig null when formConfigPath absent",
    cfgFormLoaded.formConfig === null || cfgFormLoaded.formConfig === undefined);

  // Now drive a fresh loadConfig with a config that has formConfigPath set.
  // We can't change the served site-config, so test the form-config fetch
  // path directly: simulate by fetching the fixture form-config the same
  // way loadConfig does, and set it on a config.
  let resolvedFormConfig = null;
  try {
    const fcRes = await fetch("data/form-config.json", { cache: "no-cache" });
    if (fcRes.ok) resolvedFormConfig = await fcRes.json();
  } catch (e) {}
  check("stub fetch serves the fixture form-config",
    resolvedFormConfig != null && resolvedFormConfig.formBaseUrl === fixtureFormConfig.formBaseUrl);

  const cfgFormReady = resolveConfig({ ...fixtureConfig, formConfigPath: "data/form-config.json" });
  cfgFormReady.formConfig = resolvedFormConfig;
  check("formReady(cfg.formConfig) is true after attaching the fixture",
    formReady(cfgFormReady.formConfig) === true);

  // Build a fresh quiz instance with the form-ready config and render a
  // question; assert a seed-link element exists with a non-empty href.
  const state2 = createState();
  state2.all = fixtureQuestions.slice();
  const storage2 = createStorage(cfgFormReady);
  storage2.load();
  const quiz2 = createQuiz({
    state: state2, storage: storage2, config: cfgFormReady, weightedOrder,
  });
  await quiz2.load();
  quiz2.startQuick();
  const seedNodeQ = document.getElementById("suggest-seed");
  check("seed link present after renderQuestion() when form-config is wired",
    !!seedNodeQ && typeof seedNodeQ.href === "string" && seedNodeQ.href.length > 0,
    `href=${seedNodeQ ? seedNodeQ.href : "<none>"}`);
  check("seed link href contains a fixture entry id",
    !!seedNodeQ && seedNodeQ.href.indexOf("entry.2000001") !== -1,
    `href=${seedNodeQ ? seedNodeQ.href : "<none>"}`);

  // With NO form-config (or a placeholder one), the seed link is absent.
  const cfgNoForm = resolveConfig({ ...fixtureConfig });
  cfgNoForm.formConfig = null;
  const state3 = createState();
  state3.all = fixtureQuestions.slice();
  const storage3 = createStorage(cfgNoForm);
  storage3.load();
  const quiz3 = createQuiz({
    state: state3, storage: storage3, config: cfgNoForm, weightedOrder,
  });
  await quiz3.load();
  quiz3.startQuick();
  const seedNodeNone = document.getElementById("suggest-seed");
  check("seed link absent/hidden when form-config is null",
    !seedNodeNone || seedNodeNone.hidden === true,
    `present=${!!seedNodeNone} hidden=${seedNodeNone ? seedNodeNone.hidden : "n/a"}`);

  // Placeholder form-config also stays inert.
  const cfgPlaceholder = resolveConfig({ ...fixtureConfig });
  cfgPlaceholder.formConfig = {
    formBaseUrl: "https://docs.google.com/forms/d/PLACEHOLDER/viewform",
    fields: [{ name: "book", entryId: "9" }],
  };
  const state4 = createState();
  state4.all = fixtureQuestions.slice();
  const storage4 = createStorage(cfgPlaceholder);
  storage4.load();
  const quiz4 = createQuiz({
    state: state4, storage: storage4, config: cfgPlaceholder, weightedOrder,
  });
  await quiz4.load();
  quiz4.startQuick();
  const seedNodePlaceholder = document.getElementById("suggest-seed");
  check("seed link absent/hidden when form-config is a placeholder",
    !seedNodePlaceholder || seedNodePlaceholder.hidden === true,
    `present=${!!seedNodePlaceholder} hidden=${seedNodePlaceholder ? seedNodePlaceholder.hidden : "n/a"}`);

  // 11. No literal "Exodus" anywhere in engine/src.
  let exodusHits = [];
  readdirSync(ENGINE_SRC).forEach((f) => {
    if (extname(f) !== ".js") return;
    const text = readFileSync(join(ENGINE_SRC, f), "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (/exodus/i.test(line)) exodusHits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  });
  check("no literal 'Exodus' in engine/src",
    exodusHits.length === 0,
    exodusHits.join(" | ") || "(none)");

  // 12. Every engine/src file is under 800 lines (hard limit).
  let over = [];
  readdirSync(ENGINE_SRC).forEach((f) => {
    if (extname(f) !== ".js") return;
    const n = readFileSync(join(ENGINE_SRC, f), "utf8").split("\n").length;
    if (n >= 800) over.push(`${f} (${n})`);
  });
  check("every engine/src file is < 800 lines",
    over.length === 0, over.join(", ") || "(all under)");
} catch (err) {
  console.log(`\nABORT — ${err && err.stack ? err.stack : err}`);
  failures.push("uncaught");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${passes} engine runtime checks passed (exit=0).`);
process.exit(0);