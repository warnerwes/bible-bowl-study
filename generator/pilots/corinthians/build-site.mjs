/* build-site.mjs - pure-Node static site assembler for the Corinthians pilot.
   Creates generator/pilots/corinthians/_site/ and copies in:
     - the engine JS modules + reader assets (flat, at the site root beside index.html)
     - the engine stylesheet as _site/styles.css
     - this dir's index.html, reading.html
     - this dir's *.json into _site/data/, renaming questions.seed.json -> questions.json
   Windows-safe (uses node:fs cp + path.join, no shell). No new deps.
   `--check` verifies the assembled _site has the expected files. */
"use strict";

import { cp, mkdir, rm, stat, access } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../toolchain/scripts/lib/schema-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const ENGINE_SRC = path.join(ROOT, "engine", "src");
const ENGINE_STYLES = path.join(ENGINE_SRC, "styles.css");
const PILOT = __dirname;
const OUT = path.join(PILOT, "_site");
const OUT_DATA = path.join(OUT, "data");
const QUESTION_SCHEMA_PATH = path.join(ROOT, "generator", "schemas", "question-candidate.schema.json");
const QUESTION_SEED_PATH = path.join(PILOT, "questions.seed.json");

const ENGINE_FILES = readdirSync(ENGINE_SRC)
  .filter((f) => f.endsWith(".js"))
  .sort();

const ENGINE_STATIC_FILES = ["reader.html", "reader.css"];

const COPY_JSON_RENAME = {
  "questions.seed.json": "questions.json",
  "site-config.json": "site-config.json",
  "form-config.json": "form-config.json",
  "reading-plan.json": "reading-plan.json",
  "source-manifest.json": "source-manifest.json",
  "memory-hooks.json": "memory-hooks.json",
};

const COPY_FILES = ["index.html", "reading.html"];

async function mkdirp(p) {
  await mkdir(p, { recursive: true });
}

async function safeCopy(src, dest) {
  await mkdirp(path.dirname(dest));
  await cp(src, dest);
}

async function validateQuestionSeed() {
  const [{ readFile }] = await Promise.all([import("node:fs/promises")]);
  const [schema, seed] = await Promise.all([
    readFile(QUESTION_SCHEMA_PATH, "utf8"),
    readFile(QUESTION_SEED_PATH, "utf8"),
  ]);
  const parsedSchema = JSON.parse(schema);
  const parsedSeed = JSON.parse(seed);
  const errors = [];
  for (let index = 0; index < parsedSeed.length; index += 1) {
    const result = validate(parsedSchema, parsedSeed[index]);
    if (!result.valid) {
      errors.push(`questions.seed.json[${index}]`, ...result.errors);
    }
  }
  if (errors.length) {
    throw new Error(`questions.seed.json failed schema validation:\n${errors.join("\n")}`);
  }
}

async function build() {
  await validateQuestionSeed();
  try { await rm(OUT, { recursive: true, force: true }); } catch {}
  await mkdirp(OUT);
  await mkdirp(OUT_DATA);

  for (const file of ENGINE_FILES) {
    const src = path.join(ENGINE_SRC, file);
    if (!existsSync(src)) throw new Error(`Missing engine file: ${src}`);
    await safeCopy(src, path.join(OUT, file));
  }

  for (const file of ENGINE_STATIC_FILES) {
    const src = path.join(ENGINE_SRC, file);
    if (!existsSync(src)) throw new Error(`Missing engine static file: ${src}`);
    await safeCopy(src, path.join(OUT, file));
  }

  if (!existsSync(ENGINE_STYLES)) throw new Error(`Missing engine stylesheet: ${ENGINE_STYLES}`);
  await safeCopy(ENGINE_STYLES, path.join(OUT, "styles.css"));

  for (const file of COPY_FILES) {
    const src = path.join(PILOT, file);
    if (!existsSync(src)) throw new Error(`Missing pilot file: ${src}`);
    await safeCopy(src, path.join(OUT, file));
  }

  for (const [srcName, destName] of Object.entries(COPY_JSON_RENAME)) {
    const src = path.join(PILOT, srcName);
    if (!existsSync(src)) throw new Error(`Missing pilot JSON: ${src}`);
    await safeCopy(src, path.join(OUT_DATA, destName));
  }

  console.log(
    `Built ${path.relative(ROOT, OUT)}: ${ENGINE_FILES.length} engine files + ` +
    `${ENGINE_STATIC_FILES.length} engine assets + styles.css + ${COPY_FILES.length} site files + ` +
    `${Object.keys(COPY_JSON_RENAME).length} data JSON.`
  );
}

async function check() {
  await validateQuestionSeed();
  const expected = [
    "index.html",
    "reading.html",
    "reader.html",
    "reader.css",
    "reader.js",
    "reader-route.js",
    "reading-plan.js",
    "styles.css",
    "data/questions.json",
    "data/site-config.json",
    "data/form-config.json",
    "data/reading-plan.json",
    "data/source-manifest.json",
    "data/memory-hooks.json",
    ...ENGINE_FILES,
  ];
  const missing = [];
  for (const rel of expected) {
    const target = path.join(OUT, rel);
    try {
      await access(target);
      const fileStat = await stat(target);
      if (!fileStat.isFile()) missing.push(`${rel} (not a file)`);
    } catch {
      missing.push(rel);
    }
  }
  if (missing.length) {
    console.error("CHECK FAILED - missing files in _site/:");
    for (const item of missing) console.error(`  - ${item}`);
    process.exit(1);
  }
  console.log(`CHECK OK - ${expected.length} expected files present in ${path.relative(ROOT, OUT)}.`);
}

const args = process.argv.slice(2);
if (args.includes("--check")) {
  check().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  build().then(() => check()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
