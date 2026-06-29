// Regression test: title and subtitle must use scale-aware y-positions
// so that as uiScale grows from 1 to 1.75, the vertical gap between them
// stays at least 4px.
//
// We assert source-level properties of the helper functions:
//   - drawCaption's titleY depends on the font size (which scales with uiScale)
//   - drawProgress's subtitleY depends on the font size
//   - drawProgressBar's label offset depends on the label font size
// At canvas width 598 (desktop), uiScale = 1.75, so title font is ~31px
// and subtitle font is ~24px. Without scaling, the gap between the title
// (baseline 28) and subtitle (baseline 48) is 20px, but with the scaled
// font sizes the title's descender reaches y ≈ 34 and the subtitle's
// cap-height starts at y ≈ 31, producing a 3px overlap.
//
// This is a SOURCE test — it parses rewards-scenes-1.js and asserts
// the formulas. It's reliable because it doesn't depend on rendering.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/staff/Projects/bible-bowl-study';
const SRC = fs.readFileSync(path.join(ROOT, 'rewards-scenes-1.js'), 'utf8');

const failures = [];

// 1. drawCaption must compute titleY from the font size, not use a fixed 28.
const captionMatch = SRC.match(/window\.BibleBowlScenes\.drawCaption\s*=\s*\(ctx,\s*w,\s*text\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
if (!captionMatch) {
  failures.push('Could not locate drawCaption function in rewards-scenes-1.js');
} else {
  const body = captionMatch[1];
  // The body must reference the size variable when computing y, OR define a titleY variable.
  const usesTitleY = /titleY/.test(body);
  const usesSizeForY = /size\s*\*\s*0\.\d+/.test(body) || /size\s*\+\s*\d+/.test(body);
  if (!usesTitleY && !usesSizeForY) {
    failures.push('drawCaption uses a fixed y position (28) — title overlaps subtitle at uiScale > 1.2');
  }
}

// 2. drawProgress must compute subtitleY from the font size, not use a fixed 48.
const progressMatch = SRC.match(/window\.BibleBowlScenes\.drawProgress\s*=\s*\(ctx,\s*w,\s*text\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
if (!progressMatch) {
  failures.push('Could not locate drawProgress function in rewards-scenes-1.js');
} else {
  const body = progressMatch[1];
  const usesSubtitleY = /subtitleY/.test(body);
  const usesSizeForY = /size\s*\*\s*\d+\.\d+/.test(body) || /size\s*\+\s*\d+/.test(body);
  if (!usesSubtitleY && !usesSizeForY) {
    failures.push('drawProgress uses a fixed y position (48) — subtitle overlaps title at uiScale > 1.2');
  }
}

// 3. drawProgressBar must scale the label offset with the label font size.
const barMatch = SRC.match(/window\.BibleBowlScenes\.drawProgressBar\s*=\s*\(ctx,\s*w,\s*y,\s*pct,\s*label\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
if (!barMatch) {
  failures.push('Could not locate drawProgressBar function in rewards-scenes-1.js');
} else {
  const body = barMatch[1];
  // The label offset must reference a size variable, not a hard-coded -8.
  // After the fix, the body computes labelOffset from labelSize.
  const usesScaleAwareOffset = /labelOffset\s*=\s*Math\.round/.test(body) || /labelSize\s*\*\s*0\.\d+/.test(body);
  const hasFixedOffset = /fillText\(label,\s*w\s*\/\s*2,\s*y\s*-\s*8\)/.test(body);
  if (hasFixedOffset && !usesScaleAwareOffset) {
    failures.push('drawProgressBar uses a fixed label offset (y - 8) — label collides with bar at uiScale > 1.2');
  }
}

// 4. Geometry check: simulate the worst case (uiScale = 1.75) and assert
// the title descender bottom is at least 4px above the subtitle cap top,
// AND the subtitle ends at least 4px above any bar drawn below it.
//
// We parse the actual formulas from the source so this stays accurate
// when the formulas change.
const sizeAtMax = { title: 18 * 1.75, subtitle: 14 * 1.75, label: 13 * 1.75 };
const captionBody = captionMatch[1];
const progressBody = progressMatch[1];
const titleFormula = captionBody.match(/titleY\s*=\s*Math\.round\(([^)]+)\)/);
const subtitleFormula = progressBody.match(/subtitleY\s*=\s*Math\.round\(([^)]+)\)/);
if (!titleFormula || !subtitleFormula) {
  failures.push('Could not parse titleY/subtitleY formulas — test cannot verify geometry');
} else {
  const evalInScale = (formula, sizeVar) => {
    return Math.round(eval(formula
      .replace(/size/g, String(sizeVar))
      .replace(/scale/g, '1.75')));
  };
  const titleY = evalInScale(titleFormula[1], sizeAtMax.title);
  const subtitleY = evalInScale(subtitleFormula[1], sizeAtMax.subtitle);
  const titleDescender = titleY + sizeAtMax.title * 0.2;
  const subtitleCapTop = subtitleY - sizeAtMax.subtitle * 0.7;
  const titleToSubtitleGap = subtitleCapTop - titleDescender;
  if (titleToSubtitleGap < 4) {
    failures.push(`At uiScale=1.75: title descender y=${titleDescender.toFixed(1)}, subtitle cap y=${subtitleCapTop.toFixed(1)}, gap=${titleToSubtitleGap.toFixed(1)}px (need ≥ 4)`);
  }
  console.log(`Title→subtitle gap at scale=1.75: ${titleToSubtitleGap.toFixed(1)}px (titleY=${titleY}, subtitleY=${subtitleY})`);
}

// 5. Bar label geometry: drawProgressBar's label sits above the bar by
// `labelOffset` which scales with the label font. The label baseline must
// be at least 4px below the subtitle's descender bottom, OR the label
// must be drawn ABOVE the subtitle (when bar is above subtitle) — but in
// practice the bar is always below subtitle, so label baseline must be
// below subtitleDescender + 4.
const barBody = barMatch[1];
const labelFormula = barBody.match(/labelOffset\s*=\s*Math\.round\(([^)]+)\)/);
if (labelFormula) {
  const labelOffset = Math.round(eval(labelFormula[1]
    .replace(/labelSize/g, String(sizeAtMax.label))
    .replace(/scale/g, '1.75')));
  // At sinai call site, barY = h*0.22. For canvas h=558, barY = 122.7.
  // Label baseline = barY - labelOffset = 122 - labelOffset.
  // Subtitle ends at subtitleY + subtitleSize*0.2.
  const subtitleFormula = progressMatch[1].match(/subtitleY\s*=\s*Math\.round\(([^)]+)\)/);
  if (subtitleFormula) {
    const subtitleY = Math.round(eval(subtitleFormula[1]
      .replace(/size/g, String(sizeAtMax.subtitle))
      .replace(/scale/g, '1.75')));
    const subtitleBottom = subtitleY + sizeAtMax.subtitle * 0.2;
    // Worst case call site for the bar: y=h*0.22 (sinai) on canvas h=558.
    const sinaiBarY = 558 * 0.22;
    const labelBaseline = sinaiBarY - labelOffset;
    const labelToSubtitleGap = labelBaseline - subtitleBottom;
    if (labelToSubtitleGap < 4) {
      failures.push(`Bar label baseline y=${labelBaseline.toFixed(1)}, subtitle bottom y=${subtitleBottom.toFixed(1)}, gap=${labelToSubtitleGap.toFixed(1)}px (need ≥ 4)`);
    }
    console.log(`Bar label→subtitle gap at scale=1.75 sinai: ${labelToSubtitleGap.toFixed(1)}px`);
  }
}

if (failures.length) {
  console.error('FAIL — title/subtitle geometry:');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}
console.log('PASS — title/subtitle geometry is scale-aware and produces ≥ 4px gap at uiScale=1.75.');