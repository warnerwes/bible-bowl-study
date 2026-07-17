import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readerUrl = pathToFileURL(path.join(__dirname, "..", "src", "reader.js")).href;
const readerHtml = fs.readFileSync(path.join(__dirname, "..", "src", "reader.html"), "utf8");

test("reader template does not include the old site usage meter paragraph", async () => {
  assert.equal(readerHtml.includes("reader-usage-meter"), false);
  assert.equal(readerHtml.includes("shared Bible lookups used this month"), false);
});

test("quiet line omits personal usage when user is signed out", async () => {
  const { formatQuietLine } = await import(`${readerUrl}?case=quiet-line-signed-out`);
  const line = formatQuietLine({
    deviceCount: 0,
    usage: null,
    siteCount: 1284,
  });

  assert.equal(line, "This device: 0 chapters checked out · Site total 1284 of 5,000");
});

test("quiet line includes personal usage when user is signed in", async () => {
  const { formatQuietLine } = await import(`${readerUrl}?case=quiet-line-signed-in`);
  const line = formatQuietLine({
    deviceCount: 2,
    usage: { used: 7 },
    siteCount: 1284,
  });

  assert.equal(line, "This device: 2 chapters checked out · You've used 7 of 20 · Site total 1284 of 5,000");
});
