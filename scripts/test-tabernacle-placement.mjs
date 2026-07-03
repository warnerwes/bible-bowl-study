/** Run: npm run test:tabernacle */
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
  
  await page.route("**/sw.js", (route) => route.abort());

  await page.goto("http://127.0.0.1:9878/index.html?qa=1", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () =>
      window.BibleBowlLabQA &&
      window.BibleBowlLabs &&
      document.querySelector("#memory-labs-grid .trophy-item")
  );

  const tileCount = await page.locator("#memory-labs-grid .trophy-item.unlocked").count();
  checks.push({ name: `${viewport.name}: 6 unlocked labs on shelf`, ok: tileCount === 6 });
  const tabTile = await page
    .locator('#memory-labs-grid .trophy-item[data-lab-id="tabernacle_place"]')
    .count();
  checks.push({
    name: `${viewport.name}: tabernacle_place tile present`,
    ok: tabTile === 1,
  });
  const goldenAltarRef = await page.evaluate(() => {
    const lab = window.BibleBowlLabs.labs.find((l) => l.id === "tabernacle_place");
    return lab?.tabernacle_cards?.find((c) => c.id === "golden_altar")?.osb_ref;
  });
  checks.push({
    name: `${viewport.name}: golden altar uses SAAS Ex 40:24-25 reference`,
    ok: goldenAltarRef === "Ex 40:24-25",
    detail: `ref=${goldenAltarRef}`,
  });
  const veilRefs = await page.evaluate(() => {
    const lab = window.BibleBowlLabs.labs.find((l) => l.id === "tabernacle_place");
    return {
      inner: lab?.tabernacle_cards?.find((c) => c.id === "veil"),
      door: lab?.tabernacle_cards?.find((c) => c.id === "door_veil"),
      doorZone: lab?.tabernacle_zones?.find((z) => z.id === "door_veil_zone"),
    };
  });
  checks.push({
    name: `${viewport.name}: inner veil and door veil are separate cards`,
    ok:
      veilRefs.inner?.osb_ref === "Ex 40:21" &&
      veilRefs.door?.osb_ref === "Ex 40:5" &&
      veilRefs.doorZone?.accept?.includes("door_veil"),
    detail: JSON.stringify(veilRefs),
  });

  await openTabernacleLab(page);

  const zoneCount = await page.locator("[data-zone-id]").count();
  checks.push({
    name: `${viewport.name}: 11 zones rendered`,
    ok: zoneCount === 11,
    detail: `actual=${zoneCount}`,
  });

  const leakCheck = await page.evaluate(() => {
    const labels = Array.from(
      document.querySelectorAll(".lab-tabernacle-zone-caption")
    ).map((el) => el.textContent.trim());
    const reveals = Array.from(
      document.querySelectorAll('[data-role="reveal"]')
    ).map((el) => ({
      text: el.textContent.trim(),
      hidden: !!el.hidden,
    }));
    const allRevealsHidden = reveals.length > 0 && reveals.every((r) => r.hidden);
    return { labels, reveals, allRevealsHidden };
  });
  const BANNED_LEAK_PATTERNS = [
    /Table of Showbread/i,
    /^Lampstand$/i,
    /Golden Altar of Incense/i,
    /^Veil\s*\(Parochet\)/i,
    /Door Veil|Entrance Screen/i,
    /Bronze Altar of Burnt Offering/i,
    /Laver\s*\(Washing Basin\)/i,
    /^Court Gate$/i,
    /Ark of the Covenant/i,
  ];
  const leakedLabels = leakCheck.labels.filter((lbl) =>
    BANNED_LEAK_PATTERNS.some((re) => re.test(lbl))
  );
  checks.push({
    name: `${viewport.name}: no answer-name appears in initial zone captions`,
    ok: leakedLabels.length === 0,
    detail:
      leakedLabels.length === 0
        ? `captions=${JSON.stringify(leakCheck.labels)}`
        : `LEAKED: ${JSON.stringify(leakedLabels)}`,
  });
  checks.push({
    name: `${viewport.name}: all reveal slots are hidden on initial mount`,
    ok:
      leakCheck.reveals.length >= 9 &&
      leakCheck.allRevealsHidden,
    detail: `reveals=${JSON.stringify(
      leakCheck.reveals.map((r) => ({ text: r.text, hidden: r.hidden }))
    )}`,
  });

  const veilBox = await page.evaluate(() => {
    const el = document.querySelector('[data-zone-id="veil_zone"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  checks.push({
    name: `${viewport.name}: veil_zone rendered with visible area`,
    ok:
      veilBox &&
      veilBox.w > 60 &&
      veilBox.h >= 30,
    detail: JSON.stringify(veilBox),
  });
  const veilBetweenCheck = await page.evaluate(() => {
    const veil = document.querySelector('[data-zone-id="veil_zone"]');
    const mhp = document.querySelector('[data-zone-id="most_holy"]');
    const hp = document.querySelector('[data-zone-id="holy_place"]');
    if (!veil || !mhp || !hp) return null;
    const v = veil.getBoundingClientRect();
    const m = mhp.getBoundingClientRect();
    const h = hp.getBoundingClientRect();
    return {
      veilTop: v.top,
      veilBottom: v.bottom,
      mhpBottom: m.bottom,
      hpTop: h.top,
      isBetween:
        v.top >= m.bottom - 1 && v.bottom <= h.top + 1,
    };
  });
  checks.push({
    name: `${viewport.name}: veil_zone sits between Most Holy and Holy Place`,
    ok:
      veilBetweenCheck &&
      veilBetweenCheck.isBetween,
    detail: JSON.stringify(veilBetweenCheck),
  });
  const doorVeilCheck = await page.evaluate(() => {
    const doorVeil = document.querySelector('[data-zone-id="door_veil_zone"]');
    const building = document.querySelector(".lab-tabernacle-building");
    const court = document.querySelector('[data-zone-id="tabernacle_exterior"]');
    if (!doorVeil || !building || !court) return null;
    const d = doorVeil.getBoundingClientRect();
    const b = building.getBoundingClientRect();
    const c = court.getBoundingClientRect();
    return {
      doorVeilTop: d.top,
      doorVeilBottom: d.bottom,
      buildingBottom: b.bottom,
      courtTop: c.top,
      w: d.width,
      h: d.height,
      isBetween: d.top >= b.bottom - 1 && d.bottom <= c.top + 1,
    };
  });
  checks.push({
    name: `${viewport.name}: door_veil_zone sits between Holy Place and Courtyard`,
    ok:
      doorVeilCheck &&
      doorVeilCheck.w > 60 &&
      doorVeilCheck.h >= 26 &&
      doorVeilCheck.isBetween,
    detail: JSON.stringify(doorVeilCheck),
  });

  const layoutCheck = await page.evaluate(() => {
    const board = document.querySelector(".lab-tabernacle-board");
    const sidebar = document.querySelector(".lab-tabernacle-sidebar");
    if (!board || !sidebar) return null;
    const b = board.getBoundingClientRect();
    const s = sidebar.getBoundingClientRect();
    const sbStyle = window.getComputedStyle(sidebar);
    return {
      viewportW: window.innerWidth,
      board: { x: b.x, y: b.y, w: b.width, h: b.height },
      sidebar: { x: s.x, y: s.y, w: s.width, h: s.height },
      sidebarDisplay: sbStyle.display,
      sidebarHidden: sbStyle.display === "none",
      isSideBySide: s.x >= b.right - 1,
      isStacked: s.y >= b.bottom - 1,
    };
  });
  const isDesktop = layoutCheck && layoutCheck.viewportW >= 720;
  checks.push({
    name: `${viewport.name}: sidebar layout matches viewport`,
    ok: layoutCheck && (isDesktop ? (!layoutCheck.sidebarHidden && layoutCheck.isSideBySide) : layoutCheck.sidebarHidden),
    detail: JSON.stringify(layoutCheck),
  });

  if (viewport.name === "mobile" && layoutCheck) {
    const fitCheck = await page.evaluate(() => {
      const card = document.querySelector("#labs-modal .labs-card");
      const ws = document.getElementById("labs-workspace");
      if (!card || !ws) return null;
      return {
        cardH: Math.round(card.getBoundingClientRect().height),
        wsScrollH: ws.scrollHeight,
        wsClientH: ws.clientHeight,
        overflow: ws.scrollHeight - Math.round(card.getBoundingClientRect().height),
      };
    });
    checks.push({
      name: `${viewport.name}: map+pool fit inside the card (no scroll past card)`,
      ok: fitCheck && fitCheck.overflow <= 40,
      detail: JSON.stringify(fitCheck),
    });
  }

  const correctDrop = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    const result = Tab.assignForTest("most_holy", "ark");
    const state = window.BibleBowlLabQA.state().tabernacle;
    return {
      result,
      placedArk: state.placed.most_holy === "ark",
      trayArk: state.tray.includes("ark"),
    };
  });
  checks.push({
    name: `${viewport.name}: correct drop is accepted`,
    ok:
      correctDrop.result === true &&
      correctDrop.placedArk &&
      !correctDrop.trayArk,
    detail: JSON.stringify(correctDrop),
  });
  const softSnapDrop = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    const result = Tab.assignForTest("tabernacle_exterior", "bronze_altar");
    const state = window.BibleBowlLabQA.state().tabernacle;
    return {
      result,
      placedBronzeAltar: state.placed.bronze_altar_zone === "bronze_altar",
      parentNotCorrupted: !state.placed.tabernacle_exterior,
    };
  });
  checks.push({
    name: `${viewport.name}: parent drop with matching child soft-snaps`,
    ok:
      softSnapDrop.result === true &&
      softSnapDrop.placedBronzeAltar &&
      softSnapDrop.parentNotCorrupted,
    detail: JSON.stringify(softSnapDrop),
  });
  const refuseDrop = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    const result = Tab.assignForTest("tabernacle_exterior", "golden_altar");
    const state = window.BibleBowlLabQA.state().tabernacle;
    return {
      result,
      placedBefore: {},
      placedAfter: state.placed,
      trayContainsCard: state.tray.includes("golden_altar"),
      parentNotCorrupted: !state.placed.tabernacle_exterior,
    };
  });
  checks.push({
    name: `${viewport.name}: parent drop with no matching child is REFUSED`,
    ok:
      refuseDrop.result === false &&
      refuseDrop.parentNotCorrupted &&
      refuseDrop.trayContainsCard,
    detail: JSON.stringify(refuseDrop),
  });
  const incenseDrop = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    const result = Tab.assignForTest("incense_zone", "golden_altar");
    const state = window.BibleBowlLabQA.state().tabernacle;
    return {
      result,
      placedGoldenAltar: state.placed.incense_zone === "golden_altar",
    };
  });
  checks.push({
    name: `${viewport.name}: correct drop on incense_zone is accepted`,
    ok:
      incenseDrop.result === true && incenseDrop.placedGoldenAltar,
    detail: JSON.stringify(incenseDrop),
  });
  const doorVeilDrop = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    const result = Tab.assignForTest("door_veil_zone", "door_veil");
    const state = window.BibleBowlLabQA.state().tabernacle;
    return {
      result,
      placedDoorVeil: state.placed.door_veil_zone === "door_veil",
    };
  });
  checks.push({
    name: `${viewport.name}: Ex 40:5 door veil has its own accepted drop zone`,
    ok:
      doorVeilDrop.result === true && doorVeilDrop.placedDoorVeil,
    detail: JSON.stringify(doorVeilDrop),
  });
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(150);

  const initialState = await page.evaluate(() => window.BibleBowlLabQA.state());
  checks.push({
    name: `${viewport.name}: 9 chips in tray at start`,
    ok: initialState.tabernacle?.tray?.length === 9,
    detail: `tray=${JSON.stringify(initialState.tabernacle?.tray)}`,
  });

  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    Tab.fillCorrect();
    Tab.forcePlaceForTest("east_entrance", "ark");
    Tab.forcePlaceForTest("most_holy", "east_entrance");
  });
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
    name: `${viewport.name}: status surfaces misplacement count`,
    ok:
      statusText &&
      /2 misplacement|swap|Red zones/i.test(statusText),
    detail: `status="${(statusText || "").slice(0, 90)}..."`,
  });
  const wrongZoneCount = await page.evaluate(() => {
    return document.querySelectorAll(
      ".lab-tabernacle-zone.wrong"
    ).length;
  });
  checks.push({
    name: `${viewport.name}: wrong zones visually marked (red)`,
    ok: wrongZoneCount >= 2,
    detail: `wrong-classed zones=${wrongZoneCount}`,
  });
  const placedDraggable = await page.evaluate(() => {
    const el = document.querySelector(".lab-tabernacle-placed");
    if (!el) return false;
    return !!el.dataset.cardId;
  });
  checks.push({
    name: `${viewport.name}: placed chip has dataset.cardId for re-drag`,
    ok: placedDraggable,
  });
  const placedHasPointerDown = await page.evaluate(() => {
    const el = document.querySelector(".lab-tabernacle-placed");
    if (!el) return false;
    const before = document.querySelectorAll(".lab-chip.dragging-floating")
      .length;
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
        pointerId: 1,
        button: 0,
      })
    );
    const after = document.querySelectorAll(".lab-chip.dragging-floating")
      .length;
    el.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
      })
    );
    return after > before;
  });
  checks.push({
    name: `${viewport.name}: placed chip pointerdown starts a drag (user can drag it back out)`,
    ok: placedHasPointerDown,
  });
  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-wrong-${viewport.name}.png`),
    fullPage: true,
  });

  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    Tab.fillCorrect();
    const state = window.BibleBowlLabQA.state();
    const placedZone = Object.keys(state.tabernacle.placed)[0];
    if (placedZone) {
      Tab.unplaceForTest(state.tabernacle.placed[placedZone]);
    }
  });
  await page.waitForTimeout(150);
  await page.locator(".lab-check-btn").click();
  await page.waitForTimeout(200);
  const missingCount = await page.evaluate(
    () => document.querySelectorAll(".lab-tabernacle-zone.missing").length
  );
  checks.push({
    name: `${viewport.name}: empty required zone gets .missing feedback`,
    ok: missingCount >= 1,
    detail: `missing-classed zones=${missingCount}`,
  });
  const correctCount = await page.evaluate(
    () => document.querySelectorAll(".lab-tabernacle-zone.right").length
  );
  checks.push({
    name: `${viewport.name}: correct placements get .right feedback (green)`,
    ok: correctCount >= 8,
    detail: `right-classed zones=${correctCount}`,
  });

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

  checks.push({
    name: `${viewport.name}: tray empty after solve`,
    ok: afterSolve.tabernacle?.tray?.length === 0,
    detail: `tray=${JSON.stringify(afterSolve.tabernacle?.tray)}`,
  });

  const revealsAfterSolve = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('[data-role="reveal"]')
    ).map((el) => ({
      text: el.textContent.trim(),
      hidden: !!el.hidden,
    }));
  });
  const allRevealed = revealsAfterSolve.every((r) => !r.hidden);
  checks.push({
    name: `${viewport.name}: answer-name reveals after solve`,
    ok: revealsAfterSolve.length >= 9 && allRevealed,
    detail: JSON.stringify(revealsAfterSolve),
  });

  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-solved-${viewport.name}.png`),
    fullPage: true,
  });

  const tierCheck = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    return {
      zero: Tab.tierFor(0),
      one: Tab.tierFor(1),
      two: Tab.tierFor(2),
      three: Tab.tierFor(3),
      ten: Tab.tierFor(10),
    };
  });
  checks.push({
    name: `${viewport.name}: tier mapping 0â†’gold, 1-2â†’silver, 3+â†’bronze`,
    ok:
      tierCheck.zero === "gold" &&
      tierCheck.one === "silver" &&
      tierCheck.two === "silver" &&
      tierCheck.three === "bronze" &&
      tierCheck.ten === "bronze",
    detail: JSON.stringify(tierCheck),
  });

  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    Tab.clearMedalForTest(); // ensure medal starts fresh on this device
  });
  const beforeHint = await page.evaluate(() =>
    window.BibleBowlLabQA.state().tabernacle
  );
  await page.locator(".lab-hint-btn").click();
  await page.waitForTimeout(150);
  const hintAfterFirst = await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    return {
      count: Tab.hintCount(),
      pillText: document.querySelector(".lab-tabernacle-hint-counter")?.textContent || "",
      placementPulsing: !!document.querySelector(".lab-hint-reveal"),
      stateHints: window.BibleBowlLabQA.state().tabernacle?.hintsUsed,
    };
  });
  const afterHint = await page.evaluate(() =>
    window.BibleBowlLabQA.state().tabernacle
  );
  checks.push({
    name: `${viewport.name}: Hint click #1 increments counter to 1`,
    ok:
      hintAfterFirst.count === 1 &&
      hintAfterFirst.stateHints === 1 &&
      /Hints:\s*1/.test(hintAfterFirst.pillText),
    detail: JSON.stringify(hintAfterFirst),
  });
  checks.push({
    name: `${viewport.name}: Hint reveals pulse class on chip or zone`,
    ok: hintAfterFirst.placementPulsing,
  });
  checks.push({
    name: `${viewport.name}: Hint does NOT auto-place any card`,
    ok:
      JSON.stringify(beforeHint.placed) ===
        JSON.stringify(afterHint.placed) &&
      afterHint.tray.length === 9,
    detail: `before=${JSON.stringify(beforeHint.placed)} after=${JSON.stringify(afterHint.placed)} tray=${afterHint.tray.length}`,
  });

  await page.locator(".lab-hint-btn").click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(300);
  const silverState = await page.evaluate(() => {
    const medal = document.querySelector(".lab-tabernacle-medal-badge");
    const headline = medal?.querySelector(".lab-tabernacle-medal-headline")?.textContent || "";
    const tierClass =
      ["lab-tabernacle-medal-gold", "lab-tabernacle-medal-silver", "lab-tabernacle-medal-bronze"]
        .find((c) => medal?.classList.contains(c)) || "";
    return {
      visible: !document.querySelector(".lab-tabernacle-medal")?.hidden,
      tierClass,
      headline,
      best: window.BibleBowlLabTabernacle.getActive().readBestMedal(),
      hintsUsed: window.BibleBowlLabTabernacle.getActive().hintCount(),
    };
  });
  checks.push({
    name: `${viewport.name}: 2 hints â†’ SILVER medal rendered`,
    ok:
      silverState.visible &&
      /SILVER/i.test(silverState.headline) &&
      silverState.tierClass === "lab-tabernacle-medal-silver",
    detail: JSON.stringify(silverState),
  });
  checks.push({
    name: `${viewport.name}: SILVER medal persisted to localStorage`,
    ok:
      silverState.best?.tier === "silver" &&
      silverState.best?.hints === 2,
    detail: JSON.stringify(silverState.best),
  });

  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  const afterReset = await page.evaluate(
    () =>
      document.querySelector(".lab-tabernacle-hint-counter")?.textContent || ""
  );
  checks.push({
    name: `${viewport.name}: reset clears hint counter back to 0`,
    ok: /Hints:\s*0/.test(afterReset),
    detail: `pill="${afterReset}"`,
  });
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(300);
  const goldState = await page.evaluate(() => {
    const medal = document.querySelector(".lab-tabernacle-medal-badge");
    const headline = medal?.querySelector(".lab-tabernacle-medal-headline")?.textContent || "";
    const tierClass =
      ["lab-tabernacle-medal-gold", "lab-tabernacle-medal-silver", "lab-tabernacle-medal-bronze"]
        .find((c) => medal?.classList.contains(c)) || "";
    return {
      tierClass,
      headline,
      best: window.BibleBowlLabTabernacle.getActive().readBestMedal(),
    };
  });
  checks.push({
    name: `${viewport.name}: 0 hints â†’ GOLD medal + persists as new best`,
    ok:
      /GOLD/i.test(goldState.headline) &&
      goldState.tierClass === "lab-tabernacle-medal-gold" &&
      goldState.best?.tier === "gold",
    detail: JSON.stringify(goldState),
  });

  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-medal-${viewport.name}.png`),
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

  try {
    for (const viewport of VIEWPORTS) {
      await runViewport(browser, viewport, errors, checks);
    }
  } catch (e) {
    console.error("Test execution aborted due to error:", e);
  }

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

  console.log("\n=== Tabernacle Placement Lab QA ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " â€” " + c.detail : ""}`);
    if (!c.ok) failed++;
  }
  if (errors.length) {
    failed++;
    console.log("\nPage/console errors:");
    errors.forEach((e) => console.log(`  Â· ${e}`));
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
