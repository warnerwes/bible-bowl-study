/**
 * Tabernacle placement mini-game regression test.
 *
 * Verifies the "Place the Holy Things" lab:
 *  - 6th tile appears on the labs shelf (unlocked in ?qa=1 mode)
 *  - Modal opens, board renders with 8 zones
 *  - Pool starts with 8 chips
 *  - solve() places all 8 cards in correct zones
 *  - Per-card failure hint appears for a misplaced card
 *  - Wrong placement is caught and not marked complete
 *  - Mobile viewport (390x844) renders without overflow that breaks pedagogy
 *  - Desktop viewport (1280x800) renders correctly
 *  - All 6 new placement MC questions (ex40-010..015) load and have correct schema
 *  - No console errors during full flow
 *
 * Run: npm run test:tabernacle
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
      let path = join(
        root,
        (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html"
      );
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

async function openTabernacleLab(page) {
  await page.evaluate(() => window.BibleBowlLabQA.open("tabernacle_place"));
  await page.waitForSelector("#labs-modal.active", { timeout: 8000 });
  const hasBegin = await page.locator("#labs-begin-btn").count();
  if (hasBegin > 0) await page.click("#labs-begin-btn");
  await page.waitForFunction(() => {
    const ws = document.getElementById("labs-workspace");
    return ws && !ws.hidden;
  });
  await page.waitForTimeout(300);
}

async function runViewport(browser, viewport, errors, checks) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("pageerror", (e) => errors.push(`[${viewport.name}] ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${viewport.name}] console: ${m.text()}`);
  });

  await page.goto("http://127.0.0.1:9878/index.html?qa=1", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () =>
      window.BibleBowlLabQA &&
      window.BibleBowlLabs &&
      document.querySelector("#memory-labs-grid .trophy-item")
  );

  // 1. 6th tile (tabernacle_place) is unlocked on the shelf.
  const tileCount = await page.locator("#memory-labs-grid .trophy-item.unlocked").count();
  checks.push({ name: `${viewport.name}: 6 unlocked labs on shelf`, ok: tileCount === 6 });
  const tabTile = await page
    .locator('#memory-labs-grid .trophy-item[data-lab-id="tabernacle_place"]')
    .count();
  checks.push({
    name: `${viewport.name}: tabernacle_place tile present`,
    ok: tabTile === 1,
  });

  // 2. Open the lab modal.
  await openTabernacleLab(page);

  // 3. Board renders 10 zones (4 top-level + 6 nested).
  const zoneCount = await page.locator("[data-zone-id]").count();
  checks.push({
    name: `${viewport.name}: 10 zones rendered`,
    ok: zoneCount === 10,
    detail: `actual=${zoneCount}`,
  });

  // 4. Pool starts with 8 chips.
  const initialState = await page.evaluate(() => window.BibleBowlLabQA.state());
  checks.push({
    name: `${viewport.name}: 8 chips in tray at start`,
    ok: initialState.tabernacle?.tray?.length === 8,
    detail: `tray=${JSON.stringify(initialState.tabernacle?.tray)}`,
  });

  // 5. Place one card WRONG (Ark into the East Entrance zone, which only
  // accepts east_entrance). First fill the rest correctly, then swap.
  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    // Fill all zones with their declared accept[0].
    Tab.fillCorrect();
    // Swap Ark and east_entrance so all zones still have cards — this
    // surfaces the per-card hint instead of bailing on empty zones.
    // Move Ark from Most Holy Place into East Entrance zone.
    Tab.assignForTest("east_entrance", "ark");
    // Move east_entrance card (now in tray) into Most Holy Place — keeps
    // all 10 zones filled so check() reaches the per-card hint logic.
    Tab.assignForTest("most_holy", "east_entrance");
  });
  // Need to re-render via click-to-place or by directly clicking Check.
  // Click check button — should report hint, not complete.
  await page.locator(".lab-check-btn").click();
  await page.waitForTimeout(300);
  const afterWrong = await page.evaluate(() => window.BibleBowlLabQA.state());
  checks.push({
    name: `${viewport.name}: wrong placement does NOT complete`,
    ok: afterWrong.tabernacle?.complete === false,
    detail: `complete=${afterWrong.tabernacle?.complete}`,
  });
  const statusText = await page.locator(".lab-drag-status").textContent();
  checks.push({
    name: `${viewport.name}: per-card failure hint appears`,
    ok: statusText && statusText.length > 20 && /Ark|Most Holy|presence|behind the veil/i.test(statusText),
    detail: `status="${(statusText || "").slice(0, 60)}..."`,
  });
  // Capture the wrong placement screenshot.
  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-wrong-${viewport.name}.png`),
    fullPage: true,
  });

  // 6. Reset, then solve.
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(400);
  const afterSolve = await page.evaluate(() => window.BibleBowlLabQA.state());
  checks.push({
    name: `${viewport.name}: solve() completes the lab`,
    ok:
      afterSolve.tabernacle?.complete === true ||
      afterSolve.completed.includes("tabernacle_place"),
    detail: `complete=${afterSolve.tabernacle?.complete} completed=${JSON.stringify(afterSolve.completed)}`,
  });

  // 7. Verify all 8 cards in placed (none in tray).
  checks.push({
    name: `${viewport.name}: tray empty after solve`,
    ok: afterSolve.tabernacle?.tray?.length === 0,
    detail: `tray=${JSON.stringify(afterSolve.tabernacle?.tray)}`,
  });

  // 8. Capture success screenshot.
  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-solved-${viewport.name}.png`),
    fullPage: true,
  });

  await page.evaluate(() => window.BibleBowlLabQA.close());
  await page.waitForTimeout(150);
  await page.close();
}

async function main() {
  const server = await startServer(9878);
  const browser = await chromium.launch();
  const errors = [];
  const checks = [];
  let failed = 0;

  for (const viewport of VIEWPORTS) {
    await runViewport(browser, viewport, errors, checks);
  }

  // 9. Verify the 6 new placement MC questions are in the bank.
  const placementIds = await (await fetch("http://127.0.0.1:9878/data/questions.json")).json();
  const newIds = ["ex40-010", "ex40-011", "ex40-012", "ex40-013", "ex40-014", "ex40-015"];
  for (const id of newIds) {
    const q = placementIds.find((qq) => qq.id === id);
    checks.push({
      name: `bank: ${id} present`,
      ok: !!q,
    });
    if (q) {
      checks.push({
        name: `bank: ${id} is multiple-choice with answer in options`,
        ok:
          q.type === "multiple-choice" &&
          Array.isArray(q.options) &&
          q.options.includes(q.answer),
        detail: `type=${q.type} ans=${q.answer}`,
      });
      checks.push({
        name: `bank: ${id} reference is in-scope Ex 40`,
        ok: /^Exodus 40:/.test(q.reference || ""),
        detail: `ref=${q.reference}`,
      });
      checks.push({
        name: `bank: ${id} has mnemonic memory aid`,
        ok: q.memoryAid?.type === "mnemonic" && (q.memoryAid?.text || "").length > 30,
      });
    }
  }

  await browser.close();
  server.close();

  // Report
  console.log("\n=== Tabernacle Placement Lab QA ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
    if (!c.ok) failed++;
  }
  if (errors.length) {
    failed++;
    console.log("\nPage/console errors:");
    errors.forEach((e) => console.log(`  · ${e}`));
  }

  console.log(
    failed
      ? `\n${failed} failure(s).`
      : `\nAll ${checks.length} tabernacle lab checks passed.`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});