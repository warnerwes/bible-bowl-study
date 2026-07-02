import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const { CHANGELOG } = require("../updates.js");
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = 9882;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const cleanUrl = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\//, "") || "index.html";
      const path = join(root, cleanUrl);
      if (!existsSync(path)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
      res.end(readFileSync(path));
    });
    server.listen(PORT, () => resolve(server));
  });
}

const html = readFileSync(join(root, "index.html"), "utf8");
const sw = readFileSync(join(root, "sw.js"), "utf8");

assert.equal(Array.isArray(CHANGELOG), true, "CHANGELOG should be an array");
assert.equal(CHANGELOG.length, 1, "Expected one dated changelog group");
assert.equal(CHANGELOG[0].items.length, 9, "Expected nine changelog items");
assert.match(html, /id="open-updates"/, "Missing Updates trigger");
assert.match(html, /href="updates\.css\?v=60"/, "Missing updates.css include");
assert.match(html, /src="updates\.js\?v=60"\s+defer/, "Missing updates.js include");
assert.match(sw, /"\.\/updates\.css"/, "sw.js should precache updates.css");
assert.match(sw, /"\.\/updates\.js"/, "sw.js should precache updates.js");

let browser;

try {
  browser = await chromium.launch();
} catch (error) {
  if (/Executable doesn't exist/i.test(String(error))) {
    console.log("Updates modal static checks passed. UI smoke skipped: Playwright browser not installed.");
    process.exit(0);
  }
  throw error;
}

const server = await startServer();
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/sw.js", (route) => route.abort());

  await page.goto(`http://127.0.0.1:${PORT}/index.html?qa=updates`, {
    waitUntil: "networkidle",
  });

  await page.click("#open-updates");
  await page.waitForSelector("#updates-modal.active");

  const opened = await page.evaluate(() => ({
    ariaHidden: document.getElementById("updates-modal")?.getAttribute("aria-hidden"),
    activeElement: document.activeElement?.getAttribute("aria-label") || document.activeElement?.id || "",
    itemCount: document.querySelectorAll(".updates-list li").length,
    title: document.getElementById("updates-title")?.textContent || "",
  }));

  assert.equal(opened.ariaHidden, "false", "Modal should be visible when opened");
  assert.equal(opened.activeElement, "Close updates", "Close button should receive focus");
  assert.equal(opened.itemCount, 9, "Modal should render all nine changelog items");
  assert.equal(opened.title, "What's New", "Modal should have the expected title");

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("updates-modal")?.classList.contains("active"));

  const escaped = await page.evaluate(() => ({
    ariaHidden: document.getElementById("updates-modal")?.getAttribute("aria-hidden"),
    activeElement: document.activeElement?.id || "",
  }));

  assert.equal(escaped.ariaHidden, "true", "Modal should hide on Escape");
  assert.equal(escaped.activeElement, "open-updates", "Focus should return to the trigger after Escape");

  await page.click("#open-updates");
  await page.waitForSelector("#updates-modal.active");
  await page.click("#updates-modal", { position: { x: 8, y: 8 } });
  await page.waitForFunction(() => !document.getElementById("updates-modal")?.classList.contains("active"));

  const backdrop = await page.evaluate(() => ({
    ariaHidden: document.getElementById("updates-modal")?.getAttribute("aria-hidden"),
    activeElement: document.activeElement?.id || "",
  }));

  assert.equal(backdrop.ariaHidden, "true", "Modal should hide on backdrop click");
  assert.equal(backdrop.activeElement, "open-updates", "Focus should return to the trigger after backdrop close");
  assert.deepEqual(errors, [], "Unexpected browser errors: " + errors.join(" | "));

  console.log("Updates modal checks passed.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
