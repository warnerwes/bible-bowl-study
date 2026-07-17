import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { makeDocument } from "./headless-dom.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readerUrl = pathToFileURL(path.join(__dirname, "..", "src", "reader-verses.js")).href;

test("segmentVerses preserves headings and indentation when markers are valid", async () => {
  const { segmentVerses } = await import(`${readerUrl}?case=headings`);
  const source = "SYNTHETIC HEADING\n\n     [1] SYNTHETIC ALPHA.\n       [2] SYNTHETIC BETA.";
  const segment = segmentVerses(source, 2);

  assert.ok(segment);
  assert.equal(segment.headText, "SYNTHETIC HEADING\n\n");
  assert.equal(segment.verses[0].prefixText, "     ");
  assert.equal(segment.verses[0].verseText, " SYNTHETIC ALPHA.\n");
  assert.equal(segment.verses[1].prefixText, "       ");
  assert.equal(segment.verses[1].verseText, " SYNTHETIC BETA.");
});

test("segmentVerses supports a first-line verse marker", async () => {
  const { segmentVerses } = await import(`${readerUrl}?case=first-line`);
  const source = "[1] SYNTHETIC ALPHA.\n[2] SYNTHETIC BETA.";
  const segment = segmentVerses(source, 2);

  assert.ok(segment);
  assert.equal(segment.headText, "");
  assert.equal(segment.verses.length, 2);
  assert.equal(segment.verses[0].verseText, " SYNTHETIC ALPHA.\n");
});

test("segmentVerses splits markers that appear mid-line and reconstructs the source exactly", async () => {
  const { segmentVerses } = await import(`${readerUrl}?case=multi-verse-line`);
  const source = "SYNTHETIC HEADING\n     [1] ALPHA one;  [2] BETA two.\n     [3] GAMMA three.";
  const segment = segmentVerses(source, 3);

  assert.ok(segment);
  assert.equal(segment.headText, "SYNTHETIC HEADING\n");
  assert.equal(segment.verses.length, 3);
  assert.equal(segment.verses[0].prefixText, "     ");
  assert.equal(segment.verses[0].verseText, " ALPHA one;  ");
  assert.equal(segment.verses[1].prefixText, "");
  assert.equal(segment.verses[1].verseText, " BETA two.\n");
  assert.equal(segment.verses[2].prefixText, "     ");
  assert.equal(
    `${segment.headText}${segment.verses.map((verse) => `${verse.prefixText}${verse.markerText}${verse.verseText}`).join("")}`,
    source
  );
});

test("segmentVerses returns null for duplicate, gap, zero-marker, or count-mismatch chapters", async () => {
  const { segmentVerses } = await import(`${readerUrl}?case=bad-segments`);

  assert.equal(segmentVerses("[1] SYNTHETIC ALPHA.\n[1] SYNTHETIC BETA.", 2), null);
  assert.equal(segmentVerses("[1] SYNTHETIC ALPHA.\n[3] SYNTHETIC BETA.", 2), null);
  assert.equal(segmentVerses("SYNTHETIC HEADING ONLY", 0), null);
  assert.equal(segmentVerses("[1] SYNTHETIC ALPHA.\n[2] SYNTHETIC BETA.", 3), null);
  assert.equal(segmentVerses("[1] SYNTHETIC ALPHA [4] literal number.\n[2] SYNTHETIC BETA.", 2), null);
});

test("expectedVerseCount accepts display and API book keys", async () => {
  const { expectedVerseCount } = await import(`${readerUrl}?case=verse-count-keys`);

  assert.equal(expectedVerseCount("1 Corinthians", 15), 58);
  assert.equal(expectedVerseCount("1CO", 15), 58);
});

test("rendered verse content reconstructs the original source text exactly", async () => {
  const document = makeDocument();
  globalThis.document = document;
  const { renderSegmentedVerseContent, segmentVerses, serializeScripture } = await import(`${readerUrl}?case=reconstruct`);
  const source = "SYNTHETIC HEADING\n     [1] SYNTHETIC ALPHA.\n     [2] SYNTHETIC BETA.";
  const segment = segmentVerses(source, 2);
  const container = document.createElement("pre");

  renderSegmentedVerseContent(container, segment);
  const elementNodes = container.children.filter((node) => node.tagName);
  elementNodes[1].textContent = "•2 ⭐1";
  elementNodes[3].textContent = "Your note: Synthetic note";

  assert.equal(serializeScripture(container), source);
  assert.equal(elementNodes[0].tagName, "BUTTON");
  assert.equal(elementNodes[0].textContent, "[1]");
  assert.equal(elementNodes[1].getAttribute("data-reader-adornment"), "");
  assert.equal(elementNodes[3].getAttribute("data-reader-adornment"), "");
});

test("reader validation never falls back to raw text when segmentation fails", async () => {
  const document = makeDocument();
  globalThis.document = document;
  const readerModuleUrl = pathToFileURL(path.join(__dirname, "..", "src", "reader.js")).href;
  const { renderChapterText } = await import(`${readerModuleUrl}?case=no-raw-fallback`);
  const container = document.createElement("pre");
  document._byId.set("reader-content", container);

  const rendered = renderChapterText({ book: "1 Corinthians", chapter: 1 }, "SYNTHETIC RAW WITHOUT MARKERS");
  assert.equal(rendered, false);
  assert.equal(container.textContent, "");
});
