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

async function canvasCoords(page, cx, cy) {
  const box = await canvasBox(page);
  const meta = await page.evaluate(() => window.BibleBowlQA.state());
  const cw = meta.canvas?.w || box.width;
  const ch = meta.canvas?.h || box.height;
  return {
    box,
    x: box.x + (cx / cw) * box.width,
    y: box.y + (cy / ch) * box.height,
  };
}

async function tapCanvas(page, cx, cy, ms = 400) {
  const p = await canvasCoords(page, cx, cy);
  await hold(page, p.x, p.y, ms);
}

async function hold(page, x, y, ms = 600) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function mannaContinuePoint(page) {
  return page.evaluate(() => {
    const s = window.BibleBowlQA.state();
    const w = s.canvas.w;
    const h = s.canvas.h;
    const ui = window.BibleBowlScenes.uiScale(w);
    return { x: w / 2, y: h - Math.round(40 * ui) };
  });
}

function wonderTests() {
  return {
    red_sea: async (page, box) => {
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.42;
      const holdMs = box.width > 500 ? 2200 : 1600;
      await hold(page, cx, cy, holdMs);
      let s = await page.evaluate(() => window.BibleBowlQA.state());
      if ((s.custom.parting || 0) < 0.35) {
        return { issues: ["parting did not advance"], note: `parting=${s.custom.parting}` };
      }
      if (s.custom.phase === "crossing" || (s.custom.parting || 0) >= 1) {
        const y1 = box.y + box.height * 0.55;
        const y2 = box.y + box.height * 0.35;
        for (let i = 0; i < 6; i++) {
          await drag(page, cx, y1, cx, y2, 8);
          await page.waitForTimeout(60);
        }
        s = await page.evaluate(() => window.BibleBowlQA.state());
        if ((s.custom.crossingProgress || 0) < 0.15) {
          return { issues: ["crossing phase did not advance"], note: `cross=${s.custom.crossingProgress}` };
        }
        return { note: `parting=${s.custom.parting?.toFixed(2)}, cross=${s.custom.crossingProgress?.toFixed(2)}` };
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
      const found = (s.custom.springs || []).filter((sp) => sp.found).length;
      if (found < 1) return { issues: ["spring find did not register"] };
      return { note: `springs found ${found}/12` };
    },
    manna: async (page, box) => {
      const cont = await mannaContinuePoint(page);
      await tapCanvas(page, cont.x, cont.y, 500);
      await page.waitForTimeout(300);
      let s = await page.evaluate(() => window.BibleBowlQA.state());
      if (s.custom.mannaPhase === "quail") {
        await tapCanvas(page, cont.x, cont.y, 500);
        await page.waitForTimeout(300);
        s = await page.evaluate(() => window.BibleBowlQA.state());
      }
      if (s.custom.mannaPhase === "dew") {
        await tapCanvas(page, s.canvas.w / 2, s.canvas.h * 0.55, 2800);
        s = await page.evaluate(() => window.BibleBowlQA.state());
      }
      if (s.custom.mannaPhase === "gather") {
        await tapCanvas(page, s.canvas.w * 0.45, s.canvas.h * 0.55, 100);
        for (let i = 0; i < 8; i++) {
          const x1 = s.canvas.w * (0.2 + i * 0.08);
          const y = s.canvas.h * 0.5;
          const p1 = await canvasCoords(page, x1, y + 40);
          const p2 = await canvasCoords(page, x1, y);
          await drag(page, p1.x, p1.y, p2.x, p2.y, 6);
          await page.waitForTimeout(80);
        }
        s = await page.evaluate(() => window.BibleBowlQA.state());
      }
      const fill = s.custom.jarFill || 0;
      const pending = s.custom.pendingJar;
      const phase = s.custom.mannaPhase;
      if (phase === "quail" || phase === "dew") {
        return { issues: ["manna did not reach gather phase"], note: `phase=${phase}` };
      }
      if (fill < 0.15 && !pending) {
        return { issues: ["jar scoop / progress did not move"], note: `phase=${phase}, fill=${fill}` };
      }
      return { note: `phase=${phase}, ${pending ? "jar full" : `fill=${fill.toFixed(2)}`}` };
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
      const template = await page.evaluate(() => {
        const s = window.BibleBowlQA.state();
        return window.BibleBowlScenes.getSinaiBoundaryTemplate(s.canvas.w, s.canvas.h);
      });
      for (let i = 0; i < 6; i++) {
        const pt = template[i];
        await tapCanvas(page, pt.x, pt.y, 450);
        await page.waitForTimeout(180);
      }
      const meta = await page.evaluate(() => window.BibleBowlQA.state());
      await tapCanvas(page, meta.canvas.w / 2, meta.canvas.h * 0.9, box.width > 500 ? 2800 : 2000);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      const stones = (s.custom.boundaryStones || []).length;
      const trumpet = s.custom.trumpetMeter || 0;
      if (stones < 6) return { issues: ["boundary stones not placed"], note: `stones=${stones}` };
      if (trumpet < 10 && !s.custom.complete) {
        return { issues: ["trumpet wait did not advance"], note: `trumpet=${trumpet.toFixed(1)}` };
      }
      return { note: `stones=${stones}, trumpet=${trumpet.toFixed(1)}` };
    },
    golden_calf: async (page, box) => {
      const calf = await page.evaluate(() => {
        const c = window.BibleBowlQA.state().custom.calf;
        return c ? { x: c.x, y: c.y } : null;
      });
      const x = box.x + (calf?.x ?? box.width * 0.5);
      const y = box.y + (calf?.y ?? box.height * 0.58);
      await hold(page, x, y, 350);
      await page.waitForTimeout(300);
      const fireY = box.y + box.height * 0.82;
      await hold(page, x, fireY, 1400);
      const s = await page.evaluate(() => window.BibleBowlQA.state());
      const phase = s.custom.calfPhase;
      if (phase === "witness" && !s.custom.calf?.broken) {
        return { issues: ["calf break failed"] };
      }
      if (phase !== "burn" && phase !== "grind" && phase !== "water" && phase !== "done") {
        return { issues: ["burn phase did not start"], note: `phase=${phase}` };
      }
      return { note: `phase=${phase}, burn=${(s.custom.burnProgress || 0).toFixed(0)}` };
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
