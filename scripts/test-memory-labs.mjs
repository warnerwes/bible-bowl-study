/**
 * Mobile + desktop QA for all 5 Memory Labs.
 * Run: npm run test:labs
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

const LAB_IDS = ["plagues", "tribes", "commandments", "priest_line", "consecration"];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function startServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let path = join(root, (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html");
      if (!existsSync(path)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
      res.end(readFileSync(path));
    });
    server.listen(port, () => resolve(server));
  });
}

async function testLab(page, id, viewportName) {
  await page.evaluate((lid) => window.BibleBowlLabQA.open(lid), id);
  await page.waitForSelector("#labs-modal.active", { timeout: 8000 });
  await page.waitForTimeout(200);

  const hasBegin = await page.locator("#labs-begin-btn").count();
  if (hasBegin > 0) {
    await page.click("#labs-begin-btn");
  } else {
    await page.waitForFunction(() => {
      const ws = document.getElementById("labs-workspace");
      return ws && !ws.hidden;
    });
  }
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => window.BibleBowlLabQA.state());
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => window.BibleBowlLabQA.state());
  const issues = [];

  const complete =
    after.drag?.complete ||
    after.tree?.complete ||
    after.completed.includes(id);

  if (!complete) {
    issues.push("lab did not complete after solve()");
  }

  const modal = await page.locator("#labs-modal.active").count();
  if (modal < 1) issues.push("modal not open");

  await page.screenshot({
    path: join(root, "captures", `qa-lab-${id}-${viewportName}.png`),
    fullPage: false,
  });

  await page.evaluate(() => window.BibleBowlLabQA.close());
  await page.waitForTimeout(150);

  return {
    id,
    ok: issues.length === 0,
    issues,
    note: complete ? "completed" : `drag=${JSON.stringify(after.drag?.complete)}, tree=${JSON.stringify(after.tree?.complete)}`,
  };
}

async function runViewport(browser, viewport, errors) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("pageerror", (e) => errors.push(`[${viewport.name}] ${String(e)}`));

  await page.goto("http://127.0.0.1:9877/index.html?qa=1", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.BibleBowlLabQA && window.BibleBowlLabs && document.querySelector("#memory-labs-grid .trophy-item")
  );

  const shelf = await page.locator("#memory-labs-grid .trophy-item.unlocked").count();
  if (shelf < 5) {
    errors.push(`[${viewport.name}] expected 5 unlocked labs, got ${shelf}`);
  }

  const results = [];
  for (const id of LAB_IDS) {
    results.push(await testLab(page, id, viewport.name));
  }
  await page.close();
  return results;
}

async function main() {
  const server = await startServer(9877);
  const browser = await chromium.launch();
  const errors = [];
  let failed = 0;

  for (const viewport of VIEWPORTS) {
    const results = await runViewport(browser, viewport, errors);
    console.log(`\n=== Memory Labs QA — ${viewport.name} (${viewport.width}×${viewport.height}) ===\n`);
    for (const r of results) {
      const mark = r.ok ? "PASS" : "FAIL";
      if (!r.ok) failed++;
      console.log(`${mark}  ${r.id}${r.note ? ` — ${r.note}` : ""}`);
      r.issues.forEach((i) => console.log(`       · ${i}`));
    }
  }

  await browser.close();
  server.close();

  if (errors.length) {
    failed++;
    console.log("\nPage errors:");
    errors.forEach((e) => console.log(`  · ${e}`));
  }

  const total = VIEWPORTS.length * LAB_IDS.length;
  console.log(
    failed
      ? `\n${failed} failure(s) across Memory Labs QA.`
      : `\nAll ${total} memory lab checks passed (${LAB_IDS.length} labs × ${VIEWPORTS.length} viewports).`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
