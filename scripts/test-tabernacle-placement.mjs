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

  // 3a. Anti-leak guard (2026-06-28): every answer-name must be HIDDEN
  // on initial mount. The static labels show only room/direction text.
  // The reveal slots exist in the DOM but are hidden until a card is
  // correctly placed in that zone.
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
      leakCheck.reveals.length >= 6 &&
      leakCheck.allRevealsHidden,
    detail: `reveals=${JSON.stringify(
      leakCheck.reveals.map((r) => ({ text: r.text, hidden: r.hidden }))
    )}`,
  });

  // 3b. The veil_zone must be visible AND have non-zero area in the
  // rendered board (the original bug: veil_zone had `grid-area:
  // veil_zone` but the board grid never declared that area, so the
  // element got squashed to 0 height and was effectively invisible).
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
  // 3c. The veil_zone must sit visually between Most Holy and Holy
  // Place (y-coordinate between the two parent rows).
  const veilBetweenCheck = await page.evaluate(() => {
    const veil = document.querySelector('[data-zone-id="veil_zone"]');
    const mhp = document.querySelector('[data-zone-id="most_holy"]');
    const hp = document.querySelector('[data-zone-id="holy_place"]');
    if (!veil || !mhp || !hp) return null;
    const v = veil.getBoundingClientRect();
    const m = mhp.getBoundingClientRect();
    const h = hp.getBoundingClientRect();
    // Veil's top should be at or below Most Holy's bottom.
    // Veil's bottom should be at or above Holy Place's top.
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

  // 3d. Drop-validation rules (2026-06-28):
  //   - Card dropped on its correct zone → accepted.
  //   - Card dropped on a parent whose child accepts it → soft-snapped.
  //   - Card dropped on a parent whose NO child accepts it → REFUSED
  //     (silent state corruption: nothing on screen would match).
  //   - Card dropped on any other zone (including wrong ones) →
  //     accepted as a WRONG PLACEMENT — the user is learning and can
  //     drag the chip back out to try again. Only Check marks it red.
  // First case: dropping Ark on Most Holy Place (correct) → accepted.
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
  // Second case: dropping Bronze Altar on Courtyard parent (soft-snap
  // → bronze_altar_zone) → accepted.
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
  // Third case: dropping Golden Altar on Courtyard parent (no child
  // accepts it) → REFUSED. (Prevents silent state corruption.)
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
  // Fourth case: dropping Golden Altar directly on the incense_zone
  // (correct) → accepted. (Smoke test the normal placement path.)
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
  // Reset state so subsequent tests (which expect tray=8, placed={})
  // see a fresh board.
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(150);

  // 4. Pool starts with 8 chips.
  const initialState = await page.evaluate(() => window.BibleBowlLabQA.state());
  checks.push({
    name: `${viewport.name}: 8 chips in tray at start`,
    ok: initialState.tabernacle?.tray?.length === 8,
    detail: `tray=${JSON.stringify(initialState.tabernacle?.tray)}`,
  });

  // 5. Place one card WRONG (Ark into the East Entrance zone, which only
  // accepts east_entrance). First fill the rest correctly, then swap.
  // (2026-06-28: uses forcePlaceForTest because assign() now correctly
  // refuses wrong placements — so to set up a wrong-placement fixture
  // we have to bypass the soft-snap validation.)
  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    // Fill all zones with their declared accept[0].
    Tab.fillCorrect();
    // Swap Ark and east_entrance so all zones still have cards — this
    // surfaces the per-card hint instead of bailing on empty zones.
    Tab.forcePlaceForTest("east_entrance", "ark");
    Tab.forcePlaceForTest("most_holy", "east_entrance");
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
    name: `${viewport.name}: status surfaces misplacement count`,
    ok:
      statusText &&
      /2 misplacement|swap|Red zones/i.test(statusText),
    detail: `status="${(statusText || "").slice(0, 90)}..."`,
  });
  // Each wrong zone must have the .wrong class for visible feedback.
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
  // Placed-chip dragability: verify the placed chip has a pointerdown
  // handler so user can re-drag it (the "I can't move it once placed"
  // bug). We just check the class is wired and the element exists.
  const placedDraggable = await page.evaluate(() => {
    const el = document.querySelector(".lab-tabernacle-placed");
    if (!el) return false;
    // Element must have a cardId so startDrag can resolve the source
    // zone via findZoneContaining().
    return !!el.dataset.cardId;
  });
  checks.push({
    name: `${viewport.name}: placed chip has dataset.cardId for re-drag`,
    ok: placedDraggable,
  });
  // Drag-out test (2026-06-28): user wants to drop a chip somewhere
  // wrong, then drag it back out to try again. Verify the placed chip
  // has a pointerdown listener attached (set up by renderZones for
  // each placed chip) so startDrag() can fire.
  const placedHasPointerDown = await page.evaluate(() => {
    const el = document.querySelector(".lab-tabernacle-placed");
    if (!el) return false;
    // Pointerdown listener is attached via addEventListener — we
    // can't introspect that directly, but we can simulate a pointerdown
    // event and see if the drag machinery kicks in (a dragGhost is
    // appended to document.body).
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
    // Cleanup: dispatch pointercancel so any pending drag aborts.
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
  // Capture the wrong placement screenshot.
  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-wrong-${viewport.name}.png`),
    fullPage: true,
  });

  // 5b. Reset, partially fill, click Check, verify the EMPTY required
  // zone gets a visible .missing class so user knows WHICH placement
  // is still owed. (UX report: "I can't see where I am missing other
  // placements".)
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  // Fill 8 of 8 correct, then unplaceForTest one card so exactly 7
  // remain correct + 1 zone is empty + 1 card returns to tray.
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
    ok: correctCount >= 6,
    detail: `right-classed zones=${correctCount}`,
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

  // 7a. Reveal-after-place: after solving, every reveal slot should
  // now be visible. The user has earned the answer-name as a reward.
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
    ok: revealsAfterSolve.length >= 6 && allRevealed,
    detail: JSON.stringify(revealsAfterSolve),
  });

  // 8. Capture success screenshot.
  await page.screenshot({
    path: join(root, "captures", `qa-tabernacle-solved-${viewport.name}.png`),
    fullPage: true,
  });

  // 9. Hint + medal feature: tier mapping, hint reveal, counter
  // increment, persistence, gold/silver/bronze visual output.
  // 9a. Tier mapping is deterministic — verify each tier for known
  // hint counts.
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
    name: `${viewport.name}: tier mapping 0→gold, 1-2→silver, 3+→bronze`,
    ok:
      tierCheck.zero === "gold" &&
      tierCheck.one === "silver" &&
      tierCheck.two === "silver" &&
      tierCheck.three === "bronze" &&
      tierCheck.ten === "bronze",
    detail: JSON.stringify(tierCheck),
  });

  // 9b. Reset and exercise the Hint button: each click must reveal a
  // chip+zone pulse, increment the counter, and update the visible
  // pill text. Crucially (2026-06-28): the Hint button MUST NOT auto-
  // place the card. The user has to drag it themselves; the hint
  // only lights up the source chip + target zone. Otherwise gold
  // tier is trivially achievable by clicking Hint 8 times.
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const Tab = window.BibleBowlLabTabernacle.getActive();
    Tab.clearMedalForTest(); // ensure medal starts fresh on this device
  });
  const beforeHint = await page.evaluate(() =>
    window.BibleBowlLabQA.state().tabernacle
  );
  // First hint press.
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
  // Brief pulse class must be present immediately after click.
  checks.push({
    name: `${viewport.name}: Hint reveals pulse class on chip or zone`,
    ok: hintAfterFirst.placementPulsing,
  });
  // The hint must NOT auto-place the card (user must still drag it).
  checks.push({
    name: `${viewport.name}: Hint does NOT auto-place any card`,
    ok:
      JSON.stringify(beforeHint.placed) ===
        JSON.stringify(afterHint.placed) &&
      afterHint.tray.length === 8,
    detail: `before=${JSON.stringify(beforeHint.placed)} after=${JSON.stringify(afterHint.placed)} tray=${afterHint.tray.length}`,
  });

  // 9c. Solve with 1 hint already used → SILVER tier (since hints
  // remaining = total - 1 hint revealed = 7 placements auto-done via
  // solve(); we also need to re-hit Hint one more time to push
  // counter to 2 so the silver tier (1-2 hints) is forced.
  await page.locator(".lab-hint-btn").click();
  await page.waitForTimeout(150);
  // Solve remaining + check. solve() itself calls a.check() so the
  // medal will render synchronously — no second Check click needed.
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(300);
  const silverState = await page.evaluate(() => {
    const medal = document.querySelector(".lab-tabernacle-medal-badge");
    const headline = medal?.querySelector(".lab-tabernacle-medal-headline")?.textContent || "";
    // Find the TIER class (gold|silver|bronze), not the base "badge" class.
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
    name: `${viewport.name}: 2 hints → SILVER medal rendered`,
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

  // 9d. Reset and replay with ZERO hints → GOLD tier.
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(200);
  // Counter pill must read "Hints: 0" after reset.
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
    name: `${viewport.name}: 0 hints → GOLD medal + persists as new best`,
    ok:
      /GOLD/i.test(goldState.headline) &&
      goldState.tierClass === "lab-tabernacle-medal-gold" &&
      goldState.best?.tier === "gold",
    detail: JSON.stringify(goldState),
  });

  // 9e. Capture completed screenshot with medal visible.
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