/**
 * Mobile + desktop QA for all 8 wonder mini-games.
 * Run: npm run test:wonders
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

async function canvasBox(page) {
  const el = page.locator("#rewards-canvas");
  await el.waitFor({ state: "visible", timeout: 8000 });
  return el.boundingBox();
}

async function drag(page, x1, y1, x2, y2, steps = 12) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
}

async function hold(page, x, y, ms = 600) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

function wonderTests() {
  return {
    red_sea: async (page, box) => {
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.42;
      const holdMs = box.width > 500 ? 2000 : 1400;
      await hold(page, cx, cy, holdMs);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      if ((s.custom.parting || 0) < 0.35) {
        return { issues: ["parting did not advance"], note: `parting=${s.custom.parting}` };
      }
      return { note: `parting=${s.custom.parting?.toFixed(2)}` };
    },
    marah: async (page, box) => {
      const x1 = box.x + box.width * 0.5;
      const y1 = box.y + box.height * 0.2;
      const x2 = box.x + box.width * 0.5;
      const y2 = box.y + box.height * 0.72;
      await drag(page, x1, y1, x2, y2);
      await page.waitForTimeout(300);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      if (!s.custom.sweetened) return { issues: ["tree cast / sweeten failed"] };
      return { note: "sweetened" };
    },
    elim: async (page, box) => {
      const coords = await page.evaluate(() => {
        const sp = (window.BibleBowlQA.state().custom.springs || [])[0];
        return sp ? { x: sp.x, y: sp.y } : null;
      });
      const x = box.x + (coords?.x ?? box.width * 0.08);
      const y = box.y + (coords?.y ?? box.height * 0.88);
      const holdMs = box.width > 500 ? 1800 : 1200;
      await hold(page, x, y, holdMs);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      const drunk = (s.custom.springs || []).filter((sp) => sp.drunk).length;
      if (drunk < 1) return { issues: ["well drink did not register"] };
      return { note: `wells drunk ${drunk}/12` };
    },
    manna: async (page, box) => {
      const jx = box.x + box.width * 0.45;
      const jy = box.y + box.height * 0.55;
      await hold(page, jx, jy, 100);
      for (let i = 0; i < 8; i++) {
        const x = box.x + box.width * (0.2 + i * 0.08);
        const y = box.y + box.height * 0.5;
        await drag(page, x, y + 40, x, y, 6);
        await page.waitForTimeout(80);
      }
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      const fill = s.custom.jarFill || 0;
      const pending = s.custom.pendingJar;
      if (fill < 0.15 && !pending) {
        return { issues: ["jar scoop / progress did not move"], note: `fill=${fill}` };
      }
      return { note: pending ? "jar full" : `fill=${fill.toFixed(2)}` };
    },
    rephidim: async (page, box) => {
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.62;
      await hold(page, x, y, 250);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      if (!s.custom.rock?.struck) return { issues: ["rock strike failed"] };
      return { note: "rock struck" };
    },
    sinai: async (page, box) => {
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.68;
      await hold(page, x, y, 200);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      const zapped = (s.custom.zapFlash || 0) > 0 ||
        (s.custom.lightningTime || 0) > 0 ||
        (s.custom.touchCount || 0) > 0;
      if (!zapped) return { issues: ["mountain touch lightning failed"] };
      return { note: `touchCount=${s.custom.touchCount}` };
    },
    golden_calf: async (page, box) => {
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.58;
      await hold(page, x, y, 300);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      if (s.custom.calfPhase !== "grind" && !s.custom.calf?.broken) {
        return { issues: ["calf break failed"] };
      }
      return { note: `phase=${s.custom.calfPhase}` };
    },
    glory: async (page, box) => {
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.88;
      await hold(page, x, y, 1800);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      if (!s.custom.complete && (s.custom.witnessHold || 0) < 15) {
        return { issues: ["glory witness hold failed"] };
      }
      return { note: `witnessHold=${s.custom.witnessHold}, complete=${s.custom.complete}` };
    },
  };
}

async function testWonder(page, id, run, viewportName) {
  await page.evaluate((wid) => window.BibleBowlQA.open(wid), id);
  await page.waitForTimeout(400);
  const box = await canvasBox(page);
  const meta = await page.evaluate(() => window.BibleBowlQA.state());
  const issues = [];

  if (!meta.canvas || meta.canvas.h < 160) {
    issues.push(`canvas too short (${meta.canvas?.h ?? 0}px)`);
  }
  if (meta.uiScale < 1) {
    issues.push(`uiScale too small (${meta.uiScale})`);
  }

  const interaction = await run(page, box, meta);
  if (interaction.issues?.length) issues.push(...interaction.issues);

  await page.screenshot({
    path: join(root, "captures", `qa-${id}-${viewportName}.png`),
    fullPage: false,
  });

  await page.evaluate(() => window.BibleBowlQA.close());
  await page.waitForTimeout(200);
  return { id, ok: issues.length === 0, issues, note: interaction.note || "" };
}

async function runViewport(browser, viewport, errors) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("pageerror", (e) => errors.push(`[${viewport.name}] ${String(e)}`));

  await page.goto("http://127.0.0.1:9876/index.html?qa=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.BibleBowlQA && window.BibleBowlScenes);

  const tests = wonderTests();
  const results = [];
  for (const id of Object.keys(tests)) {
    results.push(await testWonder(page, id, tests[id], viewport.name));
  }
  await page.close();
  return results;
}

async function main() {
  const server = await startServer(9876);
  const browser = await chromium.launch();
  const errors = [];
  let failed = 0;

  for (const viewport of VIEWPORTS) {
    const results = await runViewport(browser, viewport, errors);
    console.log(`\n=== Wonder QA — ${viewport.name} (${viewport.width}×${viewport.height}) ===\n`);
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

  const total = VIEWPORTS.length * 8;
  console.log(
    failed
      ? `\n${failed} failure(s) across mobile + desktop QA.`
      : `\nAll ${total} wonder checks passed (8 scenes × ${VIEWPORTS.length} viewports).`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
