/* Engine config loader — book-agnostic, config-driven.
   Loads data/site-config.json at runtime and exposes a resolved config
   object with sane defaults. Pure browser JS (ES module), framework-free.

   Resolved config shape (all optional, defaults shown):
     {
       siteName:         "Bible Bowl Study",
       bookName:         "",            // e.g. "Genesis" — used for Anki deck/tags
       siteSlug:         "bible-bowl",  // used for Anki filename
       defaultBookLabel: "",            // fallback reference label, e.g. "Genesis"
       questionsPath:    "data/questions.json",
       statsKey:         "bbs:stats:v1",
       books:            [],            // optional list of book metadata
       passageProvider:  "biblegateway",
       bibleVersion:     "NKJV",
       repo:             "",            // "owner/repo" for suggest-a-correction links
       formConfigPath:   null,           // optional path to a form-config JSON
     }
*/
"use strict";

const DEFAULTS = {
  siteName: "Bible Bowl Study",
  bookName: "",
  siteSlug: "bible-bowl",
  defaultBookLabel: "",
  questionsPath: "data/questions.json",
  statsKey: "bbs:stats:v1",
  books: [],
  passageProvider: "biblegateway",
  bibleVersion: "NKJV",
  repo: "",
  formConfigPath: null,
};

let _config = null;

export function defaultConfig() {
  // Shallow clone so callers can't mutate the canonical defaults.
  return { ...DEFAULTS };
}

export function resolveConfig(partial) {
  const cfg = { ...DEFAULTS, ...(partial || {}) };
  // Coerce known string fields to strings (defensive against bad JSON).
  for (const k of ["siteName", "bookName", "siteSlug", "defaultBookLabel",
                   "questionsPath", "statsKey", "passageProvider",
                   "bibleVersion", "repo"]) {
    if (cfg[k] != null && typeof cfg[k] !== "string") cfg[k] = String(cfg[k]);
  }
  if (!Array.isArray(cfg.books)) cfg.books = [];
  if (cfg.formConfigPath != null && typeof cfg.formConfigPath !== "string") {
    cfg.formConfigPath = String(cfg.formConfigPath);
  }
  return cfg;
}

// Load site-config.json from `path` (defaults to "data/site-config.json").
// Uses the global `fetch`. Returns the resolved config; also caches it
// accessible via getConfig().
export async function loadConfig(path = "data/site-config.json") {
  let partial = {};
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      partial = (data && typeof data === "object") ? data : {};
    }
  } catch (e) {
    // Config is optional — fall back to defaults silently so the engine
    // still runs when no site-config.json is present.
    partial = {};
  }
  _config = resolveConfig(partial);
  return _config;
}

export function getConfig() {
  if (!_config) _config = resolveConfig({});
  return _config;
}

export function setConfig(cfg) {
  _config = resolveConfig(cfg);
  return _config;
}