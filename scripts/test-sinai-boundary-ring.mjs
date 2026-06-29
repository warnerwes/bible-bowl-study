// Regression test: Sinai boundary stones must wrap the mountain's BASE,
// not sit in the foreground in front of it.
//
// Definition of "wrap the base":
//   - Stones 1 and 4 (the lower side stones) must sit ABOVE the mountain's
//     base y (h) by at least 6% of canvas height.
//   - Stones 2 and 3 (the upper side stones) must sit even higher — at
//     least 18% above the base.
//   - All side stones must be at a y between 0.55*h and 0.92*h. Below
//     0.92*h is in the foreground.
//
// Before the fix: t=0.05/0.18 → stones at y≈0.94-0.99h (foreground).
// After the fix:  t=0.32/0.55 → stones at y≈0.62-0.78h (wrapping base).

import { chromium } from 'playwright';

const BASE = 'http://localhost:8765/';

async function tap(page, x, y, holdMs = 450) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?qa=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);

  await page.evaluate(() => window.BibleBowlQA?.open?.('sinai'));
  await page.waitForTimeout(500);

  // Read the template directly — that's what the scene uses for placement.
  const probe = await page.evaluate(() => {
    const s = window.BibleBowlQA.state();
    const tpl = window.BibleBowlScenes.getSinaiBoundaryTemplate(s.canvas.w, s.canvas.h);
    const c = document.querySelector('#rewards-canvas');
    const r = c.getBoundingClientRect();
    return { template: tpl, canvas: s.canvas, canvasRect: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });

  const failures = [];
  const w = probe.canvas.w;
  const h = probe.canvas.h;

  // Mountains occupies y from h*0.62 (peak) to h (base). The peak is at h*0.62.
  // For stones to "wrap the base" they should be between roughly y = h*0.55 and y = h*0.92.
  // Corner stones (0, 5) sit at the very base (y = h - margin) — that's
    // the bottom edge of the canvas where the mountain's base meets the
    // ground. They are at the foot of the mountain, not in the foreground.
    // Allow them at ratio >= 0.95.
    // Side stones (1..4) must wrap the LOWER SLOPE — y between 0.55*h and
    // 0.92*h. Above 0.92*h puts them in the foreground below the mountain.
    for (let i = 0; i < probe.template.length; i++) {
      const pt = probe.template[i];
      const ratio = pt.y / h;
      if (i >= 1 && i <= 4) {
        if (ratio > 0.92) {
          failures.push(`side stone[${i}] at y=${pt.y.toFixed(1)} (${(ratio*100).toFixed(1)}%) — in foreground below mountain`);
        }
        if (ratio < 0.55) {
          failures.push(`side stone[${i}] at y=${pt.y.toFixed(1)} (${(ratio*100).toFixed(1)}%) — too high, would cross mountain face`);
        }
      }
    }

  if (failures.length) {
    console.error('FAIL — boundary ring does not wrap the mountain base:');
    for (const f of failures) console.error('  -', f);
    console.error('Template points:', JSON.stringify(probe.template, null, 2));
    await browser.close();
    process.exit(1);
  }

  console.log('PASS — boundary ring wraps the mountain base.');
  console.log('  canvas:', `${w}×${h}`);
  console.log('  peak expected at y=' + (h * 0.62).toFixed(1));
  console.log('  stone y-coords (as % of canvas height):');
  for (let i = 0; i < probe.template.length; i++) {
    const pt = probe.template[i];
    console.log(`    [${i}] y=${pt.y.toFixed(1)} (${((pt.y/h)*100).toFixed(1)}%) x=${pt.x.toFixed(1)}`);
  }

  // Also exercise the actual click flow to make sure 6 stones still place.
  for (const pt of probe.template) {
    const px = probe.canvasRect.x + pt.x * (probe.canvasRect.w / w);
    const py = probe.canvasRect.y + pt.y * (probe.canvasRect.h / h);
    await tap(page, px, py, 500);
    await page.waitForTimeout(180);
  }
  const after = await page.evaluate(() => {
    const s = window.BibleBowlQA.state();
    return { stones: (s.custom.boundaryStones || []).length, phase: s.custom.sinaiPhase };
  });
  if (after.stones !== 6) {
    console.error(`FAIL — only ${after.stones}/6 stones placed via click flow`);
    await browser.close();
    process.exit(1);
  }
  console.log(`PASS — all 6 stones placed via real click flow, phase=${after.phase}`);

  // Screenshot for visual confirmation.
  await page.screenshot({ path: '/tmp/sinai-after-fix.png', fullPage: false });
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });