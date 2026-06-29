/**
 * Screenshot + measurement helper for the tabernacle lab.
 * Run: node scripts/screenshot-mobile.mjs
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function startServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = join(root, (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html");
      if (!existsSync(p)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[extname(p)] || "text/plain" });
      res.end(readFileSync(p));
    });
    server.listen(port, () => resolve(server));
  });
}

async function shoot(viewport, file) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:9878/index.html?qa=1", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.BibleBowlLabQA && document.querySelector("#memory-labs-grid .trophy-item"));
  await page.evaluate(() => window.BibleBowlLabQA.open("tabernacle_place"));
  await page.waitForSelector("#labs-modal.active", { timeout: 8000 });
  const begin = await page.locator("#labs-begin-btn").count();
  if (begin > 0) await page.click("#labs-begin-btn");
  await page.waitForFunction(() => { const ws = document.getElementById("labs-workspace"); return ws && !ws.hidden; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: false });

  const report = await page.evaluate(() => {
    const ws = document.getElementById("labs-workspace");
    const board = document.querySelector(".lab-tabernacle-board");
    const pool = document.querySelector(".lab-tabernacle-pool");
    const layout = document.querySelector(".lab-tabernacle-layout");
    const root = document.querySelector(".lab-tabernacle-root");
    const status = root ? root.querySelector(":scope > .lab-drag-status") : null;
    const footer = document.querySelector(".lab-tabernacle-tray-footer");
    const actions = document.querySelector(".lab-drag-actions");
    const card = document.querySelector("#labs-modal .labs-card");
    return {
      innerH: window.innerHeight,
      cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
      wsClientH: ws ? ws.clientHeight : null,
      wsScrollH: ws ? ws.scrollHeight : null,
      rootH: root ? Math.round(root.getBoundingClientRect().height) : null,
      rootKids: root ? [...root.children].map(c => ({ cls: c.className.slice(0, 45), h: Math.round(c.getBoundingClientRect().height) })) : null,
      statusH: status ? Math.round(status.getBoundingClientRect().height) : null,
      layoutFlex: layout ? window.getComputedStyle(layout).flex : null,
      layoutH: layout ? Math.round(layout.getBoundingClientRect().height) : null,
      footerH: footer ? Math.round(footer.getBoundingClientRect().height) : null,
      footerKids: footer ? [...footer.children].map(c => ({ cls: c.className.slice(0, 45), h: Math.round(c.getBoundingClientRect().height) })) : null,
      actionsH: actions ? Math.round(actions.getBoundingClientRect().height) : null,
      boardH: board ? Math.round(board.getBoundingClientRect().height) : null,
      poolH: pool ? Math.round(pool.getBoundingClientRect().height) : null,
    };
  });
  console.log(`\n=== ${file} ===`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

const server = await startServer(9878);
try {
  await shoot({ width: 390, height: 844 }, "shot-mobile.png");
  await shoot({ width: 360, height: 780 }, "shot-mobile-narrow.png");
  await shoot({ width: 1280, height: 800 }, "shot-desktop.png");
} finally {
  server.close();
}
console.log("\nDone. PNGs written to repo root.");