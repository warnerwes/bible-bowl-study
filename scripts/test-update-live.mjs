/**
 * Live behavior test: simulate the scenario where the user's phone is
 * running an OLD build, then a new deploy happens. The HTML on the
 * server gets bumped to a new version. Within 6 seconds of the page
 * being open, the ping detects the mismatch and triggers a reload.
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// Build a synthetic "old" index.html that contains version "1" but
// otherwise is identical. Simulates the user's phone running yesterday's
// build.
const liveHtml = readFileSync(join(root, "index.html"), "utf8");
const oldHtml = liveHtml.replace(/__BBS_VERSION\s*=\s*"\d+"/, '__BBS_VERSION = "1"');

let currentHtml = oldHtml; // starts as old

function startServer(port) {
  const MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
  };
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath;
    if (url === "/" || url === "/index.html") {
      // Serve the simulated HTML — toggled below.
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(currentHtml);
      return;
    }
    filePath = join(root, url);
    if (!existsSync(filePath) || !filePath.startsWith(root)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const data = readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "text/plain",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const server = await startServer(9910);

await page.goto("http://127.0.0.1:9910/index.html", { waitUntil: "domcontentloaded" });

// Confirm we are on the OLD version.
const before = await page.evaluate(() => ({
  stamp: window.__BBS_VERSION,
  // Don't await anything heavy here; just check the stamp exists.
}));
console.log("before deploy:", JSON.stringify(before));

if (before.stamp !== "1") {
  console.log("FAIL: initial stamp should be '1' to simulate old phone");
  await browser.close();
  server.close();
  process.exit(1);
}

// Now simulate a new deploy — switch the served HTML to the LIVE version.
currentHtml = liveHtml;

// Set up a navigation listener so we know when the auto-reload fires.
const reloaded = page.waitForNavigation({ timeout: 8000 }).then(() => true).catch(() => false);

// Wait up to 8s for the periodic ping (5s initial + small overhead) to
// detect the mismatch and reload.
const did = await reloaded;
await page.waitForTimeout(500);

const after = await page.evaluate(() => ({
  stamp: window.__BBS_VERSION,
}));

console.log("after deploy + auto-reload:", JSON.stringify(after));

const ok = after.stamp !== "1";
console.log(ok ? "\nPASS: page auto-reloaded when server had a newer version" : "\nFAIL: did not reload within timeout");

await browser.close();
server.close();
process.exit(ok ? 0 : 1);