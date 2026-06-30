/**
 * Regression coverage for Exodus Wonder scripture excerpts and reader links.
 *
 * Run: npm run test:wonder-passages
 */
import assert from "assert/strict";
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { extname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const rewardsSource = readFileSync(join(root, "rewards.js"), "utf8");
const exodus = JSON.parse(readFileSync(join(root, "data/source-text/exodus/exodus-verses.json"), "utf8"));

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function decodeLiteral(value) {
  return JSON.parse(`"${value.replace(/\r?\n/g, "\\n")}"`);
}

function readWonders() {
  const wonders = [];
  const blockRe = /\{\s*id:\s*"([^"]+)",[\s\S]*?quote:\s*"((?:\\.|[^"\\])*)",[\s\S]*?desc:/g;
  let match;
  while ((match = blockRe.exec(rewardsSource))) {
    const block = match[0];
    const ref = block.match(/\bref:\s*"([^"]+)"/)?.[1];
    const readerRef = block.match(/\breaderRef:\s*"([^"]+)"/)?.[1] || ref;
    const label = block.match(/\blabel:\s*"([^"]+)"/)?.[1] || match[1];
    wonders.push({ id: match[1], label, ref, readerRef, quote: decodeLiteral(match[2]) });
  }
  return wonders;
}

function parseReference(ref) {
  const m = String(ref || "").match(/^Exodus\s+(\d+):(.+)$/);
  assert.ok(m, `Reference must be an Exodus chapter/verse reference: ${ref}`);
  const chapter = Number(m[1]);
  const ranges = m[2].split(",").map((part) => part.trim()).filter(Boolean);
  const keys = [];

  for (const range of ranges) {
    const rangeMatch = range.match(/^(\d+)(?:-(\d+))?$/);
    assert.ok(rangeMatch, `Unsupported reference range "${range}" in ${ref}`);
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2] || rangeMatch[1]);
    assert.ok(end >= start, `Reference range must not run backward: ${ref}`);
    for (let verse = start; verse <= end; verse++) keys.push(`${chapter}:${verse}`);
  }

  return { chapter, fromVerse: Number(keys[0].split(":")[1]), toVerse: Number(keys.at(-1).split(":")[1]), keys };
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function quoteFragments(quote) {
  return quote
    .split(/\s*(?:\u2026|\.{3})\s*/g)
    .map((fragment) => normalizeText(fragment).replace(/[.;:,!?]+$/g, ""))
    .filter((fragment) => fragment.length >= 12);
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = url === "/" ? "index.html" : url.replace(/^\//, "");
      const file = join(root, rel);
      if (!existsSync(file) || !file.startsWith(root)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "text/plain" });
      res.end(readFileSync(file));
    });
    server.listen(0, () => resolve(server));
  });
}

const wonders = readWonders();
assert.equal(wonders.length, 8, "all 8 Exodus Wonders should be discoverable in rewards.js");

for (const wonder of wonders) {
  const ref = parseReference(wonder.ref);
  for (const key of ref.keys) {
    assert.ok(exodus.verses[key], `${wonder.label} references missing SAAS verse Exodus ${key}`);
  }

  const readerRef = parseReference(wonder.readerRef);
  for (const key of readerRef.keys) {
    assert.ok(exodus.verses[key], `${wonder.label} reader link references missing SAAS verse Exodus ${key}`);
  }

  const source = normalizeText(ref.keys.map((key) => exodus.verses[key]).join(" "));
  for (const fragment of quoteFragments(wonder.quote)) {
    assert.ok(
      source.includes(fragment),
      `${wonder.label} quote fragment is not found in local SAAS text for ${wonder.ref}: "${fragment}"`
    );
  }
}

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push(msg.text());
});

try {
  await page.route("**/sw.js", (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?qa=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.BibleBowlQA && window.BibleReader);

  for (const wonder of wonders) {
    const expected = parseReference(wonder.readerRef);
    await page.evaluate((id) => window.BibleBowlQA.open(id), wonder.id);
    await page.waitForSelector("#rewards-modal.active");
    await page.evaluate(() => {
      const passage = document.querySelector(".rewards-passage");
      if (passage) passage.open = true;
    });

    const button = page.locator("#rewards-hud-passage");
    await assert.doesNotReject(() => button.waitFor({ state: "visible", timeout: 4000 }));
    const buttonText = await button.textContent();
    const buttonRef = await button.evaluate((el) => el.dataset.ref || "");
    assert.equal(buttonRef, wonder.readerRef, `${wonder.label} button should target its reader reference`);
    assert.equal(buttonText?.trim(), `Read ${wonder.readerRef}`);

    await button.click();
    await page.waitForSelector("#reader-modal.active");
    await page.waitForSelector(`#reader-modal .verse-highlight[data-verse="${expected.fromVerse}"]`, { timeout: 8000 });
    await page.waitForSelector(`#reader-modal .verse-highlight[data-verse="${expected.toVerse}"]`, { timeout: 8000 });

    const readerState = await page.evaluate(() => ({
      title: document.querySelector("#reader-title")?.textContent || "",
      highlighted: [...document.querySelectorAll("#reader-modal .verse-highlight")]
        .map((row) => Number(row.dataset.verse)),
    }));
    const expectedVerses = expected.keys.map((key) => Number(key.split(":")[1]));
    assert.equal(readerState.title, `Exodus ${expected.chapter}`, `${wonder.label} should open the correct chapter`);
    assert.deepEqual(
      readerState.highlighted,
      expectedVerses,
      `${wonder.label} should highlight exactly ${wonder.readerRef}`
    );

    await page.locator("#reader-modal .reader-close-btn").click();
    await page.waitForSelector("#reader-modal", { state: "hidden" });
    await page.evaluate(() => window.BibleBowlQA.close());
  }

  assert.deepEqual(pageErrors, [], "wonder passage test should not produce page errors");
  console.log("Wonder passage checks passed:");
  console.log(`  checked ${wonders.length} wonder references against ${exodus.translation}`);
  console.log("  each Scripture & story link opened the matching reader passage");
} finally {
  await browser.close();
  server.close();
}
