/**
 * Shared headless-DOM harness for characterizing the Bible Bowl quiz app.
 *
 * Exports a tiny static-file server + a Playwright page wrapper that loads the
 * quiz at the app's `?qa=1` entry point, optionally intercepting the
 * `data/questions.json` fetch with a caller-supplied fixture.
 *
 * Node stdlib + playwright only.
 */
import { createServer } from "http";
import { existsSync, readFileSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

export const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/**
 * Start a static file server rooted at `root` on a random port.
 * Resolves to the underlying http.Server (use `.address().port` for the URL).
 */
export function startServer(root = REPO_ROOT) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = url === "/" ? "index.html" : url.replace(/^\//, "");
      // Serve a no-op service worker so the app's sw.js never precaches the
      // real data/questions.json (which would otherwise bypass the Playwright
      // questions.json route and make the fixture non-deterministic). This
      // only affects the headless test server; no repo file is modified.
      if (rel === "sw.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end("/* headless no-op sw */");
        return;
      }
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

/**
 * Boot the app under Playwright, run `callback({ page, server, port, pageErrors })`,
 * and ALWAYS tear down the browser + server in a finally.
 *
 * Options:
 *   - fixture: array | null  — when provided, the questions.json route is
 *     intercepted and fulfilled with JSON.stringify(fixture). When null or
 *     omitted the real data/questions.json is served. When set to [] the
 *     bank loads empty (used by the sabotage self-check).
 *
 * The page is navigated to the app's `?qa=1` quiz entry point and awaited until
 * `window.BibleBowlQA.rewardThresholds().total > 0` (the QA hook reports the
 * loaded bank size).
 */
export async function withQuizPage(callback, { fixture } = {}) {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  let page;
  const pageErrors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    if (fixture !== undefined && fixture !== null) {
      await page.route("**/questions.json", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(fixture),
        }));
    }

    await page.goto(`http://127.0.0.1:${port}/index.html?qa=1`, {
      waitUntil: "domcontentloaded",
    });
    // Wait until the QA hook is wired up. We intentionally do NOT gate on
    // `total > 0` here: an empty/intercepted bank legitimately reports total 0
    // (used by the sabotage self-check), and gating on > 0 would hang there.
    await page.waitForFunction(
      () => typeof window.BibleBowlQA?.rewardThresholds === "function"
    );
    // Give the question-bank fetch a moment to settle so rewardThresholds()
    // reflects the routed fixture rather than the pre-load default.
    await page
      .waitForFunction(() => window.BibleBowlQA.rewardThresholds().total > 0, {
        timeout: 3000,
      })
      .catch(() => {});

    return await callback({ page, server, port, pageErrors });
  } finally {
    if (page) await page.context().close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
  }
}