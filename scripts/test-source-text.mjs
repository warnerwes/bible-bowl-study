/**
 * Source text regression checks for cleaned Bible reader data.
 *
 * Run: node scripts/test-source-text.mjs
 */
import assert from "assert/strict";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "data", "source-text", "exodus");

const verseData = JSON.parse(readFileSync(join(sourceDir, "exodus-verses.json"), "utf8"));
const selectedData = JSON.parse(readFileSync(join(sourceDir, "exodus-selected.json"), "utf8"));

const chapter15 = Array.from({ length: 27 }, (_, i) => {
  const verse = i + 1;
  const text = verseData.verses[`15:${verse}`];
  assert.ok(text, `Missing Exodus 15:${verse}`);
  return { verse, text };
});

const chapter15Text = chapter15.map((row) => row.text).join(" ");
const knownOcrSplits = [
  "salv ation",
  "cov ered",
  "adv ersaries",
  "wav es",
  "ov ertake",
  "div ide",
  "hav e",
  "Marv elous",
  "dismay ed",
  "ov er",
  "forev er",
  "ev er",
];

const remainingSplits = knownOcrSplits.filter((token) => chapter15Text.includes(token));
assert.deepEqual(remainingSplits, [], `Exodus 15 still has OCR word splits: ${remainingSplits.join(", ")}`);
assert.equal(/\s+[,;:.!?]/.test(chapter15Text), false, "Exodus 15 has spaces before punctuation");
assert.match(verseData.verses["15:2"], /shield of my salvation;/);
assert.match(verseData.verses["15:18"], /forever and ever and ever/);

const normalizeLines = (text) => text.replace(/\r\n/g, "\n").trim();
const chapterTextExpected = ["EXODUS 15", "", ...chapter15.map((row) => `${row.verse}  ${row.text}`)].join("\n");
const chapterTextActual = readFileSync(join(sourceDir, "exodus-15.txt"), "utf8");
assert.equal(normalizeLines(chapterTextActual), chapterTextExpected);

const selectedChapterExpected = chapter15.map((row) => `${row.verse} ${row.text}`).join(" ");
assert.equal(selectedData.chapters["15"], selectedChapterExpected);

const selectedText = readFileSync(join(sourceDir, "exodus-selected.txt"), "utf8").replace(/\r\n/g, "\n");
const selectedBlock = selectedText.match(/===== EXODUS 15 =====\n([\s\S]*?)\n===== EXODUS 16 =====/);
assert.ok(selectedBlock, "Missing Exodus 15 block in exodus-selected.txt");
assert.equal(
  normalizeLines(selectedBlock[1]),
  chapter15.map((row) => `${row.verse}  ${row.text}`).join("\n")
);

console.log("Source text OK: Exodus 15 has no known OCR word splits.");
