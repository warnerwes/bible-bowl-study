// Reproduce + verify the Sinai boundary-line fix (issue #54).
//
// Bug: when the user places all 6 boundary stones, the dashed lines
// connecting them pass through the middle of the canvas (over the
// title "The Lord descends in fire") and across the mountain face,
// instead of wrapping around the base of the mountain.

import { chromium } from "playwright";

const URL_BASE = "http://localhost:8765/index.html";
const VIEWPORT = { width: 900, height: 700 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE.ERR:", m.text());
});

await page.goto(URL_BASE + "?qa=1", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.evaluate(() => window.BibleBowlQA.open("sinai"));
await page.waitForSelector("#rewards-modal:not([hidden])");
await page.waitForTimeout(400);

const fail = [];
function check(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fail.push(name);
}

// Compute the boundary template using the SAME math the scene uses.
// Returns array of {x,y} in canvas-internal coords.
function computeTemplate(w, h) {
  const peakX = w / 2;
  const peakY = h * 0.62;
  const baseW = w * 0.78;
  const leftBase = { x: peakX - baseW / 2, y: h };
  const rightBase = { x: peakX + baseW / 2, y: h };
  const peak = { x: peakX, y: peakY };
  const margin = Math.max(14, Math.min(w, h) * 0.028);
  function outward(base, peak, t) {
    const x = base.x + (peak.x - base.x) * t;
    const y = base.y + (peak.y - base.y) * t;
    const cx = w / 2;
    const cy = (peak.y + h * 2) / 3;
    let nx = x - cx, ny = y - cy;
    const len = Math.hypot(nx, ny) || 1;
    nx = (nx / len) * margin;
    ny = (ny / len) * margin;
    return { x: x + nx, y: y + ny };
  }
  return [
    { x: leftBase.x - margin, y: h - margin },
    outward(leftBase, peak, 0.32),
    outward(leftBase, peak, 0.58),
    outward(rightBase, peak, 0.58),
    outward(rightBase, peak, 0.32),
    { x: rightBase.x + margin, y: h - margin },
  ];
}

// Place stones programmatically by dispatching synthetic events.
async function placeStones(template) {
  return page.evaluate(async (tpl) => {
    const scene = document.getElementById("rewards-scene");
    const canvas = document.getElementById("rewards-canvas");
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    for (let i = 0; i < tpl.length; i++) {
      const pt = tpl[i];
      const cx = rect.left + pt.x * scaleX;
      const cy = rect.top + pt.y * scaleY;
      const opts = {
        clientX: cx, clientY: cy, bubbles: true, cancelable: true,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0,
      };
      scene.dispatchEvent(new PointerEvent("pointerdown", opts));
      await new Promise((r) => setTimeout(r, 50));
      scene.dispatchEvent(new PointerEvent("pointerup", { ...opts, button: 0 }));
      await new Promise((r) => setTimeout(r, 100));
    }
    return true;
  }, template);
}

const canvasInfo = await page.evaluate(() => {
  const c = document.getElementById("rewards-canvas");
  return { w: c.width, h: c.height };
});
// Use the scene's exported function so we're testing the real template,
// not a parallel implementation.
const template = await page.evaluate(() =>
  window.BibleBowlScenes.getSinaiBoundaryTemplate(
    document.getElementById("rewards-canvas").width,
    document.getElementById("rewards-canvas").height
  )
);
console.log("Canvas:", canvasInfo);
console.log("Template:");
template.forEach((p, i) => console.log(`  ${i}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`));
console.log("peakY =", (canvasInfo.h * 0.62).toFixed(0));

await placeStones(template);
await page.waitForTimeout(500);

// Verify stones actually got placed by reading customWonderState.boundaryStones
const placedCount = await page.evaluate(() => {
  // Try to find boundaryStones via the global state. Fallback: read DOM markers.
  // The scene doesn't expose customWonderState, so check the canvas pixels
  // for stone presence... or just check that the title text changed.
  const cap = document.querySelector("#rewards-modal canvas");
  return cap ? "canvas-present" : "no-canvas";
});
console.log("Post-placement check:", placedCount);

const shotPath = `/tmp/bbs-sinai-after-bounds-${Date.now()}.png`;
await page.locator("#rewards-modal").screenshot({ path: shotPath });
console.log(`Screenshot: ${shotPath}`);

// === Geometric checks on the template ===
const abovePeak = template.filter((p) => p.y < canvasInfo.h * 0.62).length;
const inTitleBand = template.filter((p) => p.y < canvasInfo.h * 0.20).length;
const minY = Math.min(...template.map((p) => p.y));
const maxY = Math.max(...template.map((p) => p.y));
const yRange = maxY - minY;

// The boundary ring should be a flat ring around the base — not span
// 30%+ of the canvas height. After the fix, all points should be in
// the bottom ~30% of the canvas (since they're near the base).
const inBottom30Pct = template.filter((p) => p.y > canvasInfo.h * 0.70).length;

check(
  "no boundary points above mountain peak",
  abovePeak === 0,
  `${abovePeak}/${template.length} above peakY (${(canvasInfo.h * 0.62).toFixed(0)})`
);
check(
  "no boundary points in title band",
  inTitleBand === 0,
  `${inTitleBand}/${template.length} in title band (y < ${(canvasInfo.h * 0.20).toFixed(0)})`
);
check(
  "all boundary points in bottom 30% of canvas",
  inBottom30Pct === template.length,
  `${inBottom30Pct}/${template.length} below y=${(canvasInfo.h * 0.70).toFixed(0)}`
);
check(
  "boundary ring is flat (y-range < 25% of canvas height)",
  yRange < canvasInfo.h * 0.25,
  `yRange=${yRange.toFixed(0)} (limit ${(canvasInfo.h * 0.25).toFixed(0)})`
);

await page.evaluate(() => window.BibleBowlQA.close());
await browser.close();

console.log("\n=== SUMMARY ===");
if (fail.length) {
  console.log(`FAILED (${fail.length}): ${fail.join(", ")}`);
  process.exit(1);
} else {
  console.log("All checks pass ✓");
  process.exit(0);
}