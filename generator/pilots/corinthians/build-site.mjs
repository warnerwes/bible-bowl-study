/* build-site.mjs — pure-Node static site assembler for the Corinthians pilot.
   Creates generator/pilots/corinthians/_site/ and copies in:
     - the six engine ES modules (flat, at the site root beside index.html)
     - the repo's root styles.css (book-agnostic quiz styling)
     - this dir's index.html, reading.html, reading-plan.js
     - this dir's *.json into _site/data/, renaming questions.seed.json → questions.json
   Windows-safe (uses node:fs cp + path.join, no shell). No new deps.
   `--check` verifies the assembled _site has the expected files. */
"use strict";

import { cp, mkdir, readdir, rm, stat, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", ".."); // repo root
const ENGINE_SRC = path.join(ROOT, "engine", "src");
const ROOT_STYLES = path.join(ROOT, "styles.css");
const PILOT = __dirname;
const OUT = path.join(PILOT, "_site");
const OUT_DATA = path.join(OUT, "data");

const ENGINE_FILES = [
  "config.js",
  "storage.js",
  "quiz-core.js",
  "quiz-render.js",
  "passage-links.js",
  "anki-export.js",
];

const COPY_JSON_RENAME = {
  "questions.seed.json": "questions.json",
  "site-config.json": "site-config.json",
  "form-config.json": "form-config.json",
  "reading-plan.json": "reading-plan.json",
  "source-manifest.json": "source-manifest.json",
};

const COPY_FILES = ["index.html", "reading.html", "reading-plan.js"];

async function mkdirp(p) {
  await mkdir(p, { recursive: true });
}

async function safeCopy(src, dest) {
  await mkdirp(path.dirname(dest));
  await cp(src, dest);
}

async function build() {
  // Clean previous build (ignore errors if absent).
  try { await rm(OUT, { recursive: true, force: true }); } catch (e) {}
  await mkdirp(OUT);
  await mkdirp(OUT_DATA);

  // Engine modules → _site/ (flat).
  for (const f of ENGINE_FILES) {
    const src = path.join(ENGINE_SRC, f);
    if (!existsSync(src)) throw new Error(`Missing engine file: ${src}`);
    await safeCopy(src, path.join(OUT, f));
  }

  // Root styles.css → _site/styles.css (do NOT modify the original).
  if (!existsSync(ROOT_STYLES)) throw new Error(`Missing root styles.css: ${ROOT_STYLES}`);
  await safeCopy(ROOT_STYLES, path.join(OUT, "styles.css"));

  // index.html + reading.html + reading-plan.js → _site/
  for (const f of COPY_FILES) {
    const src = path.join(PILOT, f);
    if (!existsSync(src)) throw new Error(`Missing pilot file: ${src}`);
    await safeCopy(src, path.join(OUT, f));
  }

  // *.json (with rename map) → _site/data/
  for (const [srcName, destName] of Object.entries(COPY_JSON_RENAME)) {
    const src = path.join(PILOT, srcName);
    if (!existsSync(src)) throw new Error(`Missing pilot JSON: ${src}`);
    await safeCopy(src, path.join(OUT_DATA, destName));
  }

  console.log(`Built ${path.relative(ROOT, OUT)}: ${ENGINE_FILES.length} engine files + styles.css + ${COPY_FILES.length} site files + ${Object.keys(COPY_JSON_RENAME).length} data JSON.`);
}

async function check() {
  const expected = [
    "index.html",
    "reading.html",
    "reading-plan.js",
    "styles.css",
    "data/questions.json",
    "data/site-config.json",
    "data/form-config.json",
    "data/reading-plan.json",
    "data/source-manifest.json",
    ...ENGINE_FILES,
  ];
  const missing = [];
  for (const rel of expected) {
    const p = path.join(OUT, rel);
    try {
      await access(p);
      const s = await stat(p);
      if (!s.isFile()) missing.push(`${rel} (not a file)`);
    } catch (e) {
      missing.push(rel);
    }
  }
  if (missing.length) {
    console.error("CHECK FAILED — missing files in _site/:");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log(`CHECK OK — ${expected.length} expected files present in ${path.relative(ROOT, OUT)}.`);
}

const args = process.argv.slice(2);
if (args.includes("--check")) {
  check().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  build().then(() => check()).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}