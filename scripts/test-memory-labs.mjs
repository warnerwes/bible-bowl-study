/**
 * Mobile + desktop QA for all 6 Memory Labs.
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

const LAB_IDS = ["plagues", "tribes", "commandments", "priest_line", "consecration", "tabernacle_place"];
const DRAG_LAB_IDS = new Set(["plagues", "tribes", "commandments", "consecration"]);
const TREE_LAB_IDS = new Set(["priest_line"]);

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

function placementSnapshot(state) {
  if (state.drag) return { slots: state.drag.slots, pool: state.drag.pool };
  if (state.tree) return { filled: state.tree.filled, tray: state.tree.tray };
  if (state.tabernacle) {
    return { placed: state.tabernacle.placed, tray: state.tabernacle.tray };
  }
  return null;
}

function hintCountFromState(state) {
  return (
    state.drag?.hintsUsed ??
    state.tree?.hintsUsed ??
    state.tabernacle?.hintsUsed ??
    0
  );
}

async function assertSolvedLabLocked(page, id, solvedState, issues) {
  if (id === "tabernacle_place") return;
  const before = placementSnapshot(solvedState);
  await page.evaluate(() => {
    document.querySelector(".lab-chip")?.click();
    document.querySelector(".lab-drag-slot, .lab-tree-slot")?.click();
  });
  await page.waitForTimeout(80);
  const afterState = await page.evaluate(() => window.BibleBowlLabQA.state());
  const after = placementSnapshot(afterState);
  const complete =
    afterState.drag?.complete ||
    afterState.tree?.complete ||
    afterState.completed.includes(id);
  if (!complete) {
    issues.push("solved lab became incomplete after a post-completion click");
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    issues.push(`solved lab mutated after post-completion click: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
}

async function assertLabReferenceReader(page, id, issues) {
  const baseRef = await page.locator("#labs-ref").evaluate((node) => node.childNodes[0]?.textContent || "");
  if (!/^Exodus\b/i.test(baseRef.trim())) {
    issues.push(`${id} lab reference should stay in Exodus scope, got "${baseRef.trim()}"`);
  }
  if (/\bGenesis\b|\bExodus\s+29\b|\bEx\s+29\b/i.test(baseRef)) {
    issues.push(`${id} lab reference includes out-of-scope text: "${baseRef.trim()}"`);
  }
  const refs = await page.locator('button[data-lab-reader-ref="1"]:visible').evaluateAll((buttons) =>
    buttons.map((btn) => ({
      text: btn.textContent || "",
      ref: btn.dataset.ref || "",
    }))
  );
  const uniqueRefs = [...new Map(refs.map((item) => [item.ref, item])).values()];
  if (!uniqueRefs.length) {
    issues.push(`${id} missing Exodus reader button`);
    return;
  }

  for (const item of uniqueRefs) {
    const chapter = Number((item.ref.match(/^Exodus\s+(\d+)/i) || [])[1]);
    if (!Number.isFinite(chapter)) {
      issues.push(`${id} reader button has non-Exodus ref: ${JSON.stringify(item)}`);
      continue;
    }
    await page.locator(`button[data-lab-reader-ref="1"][data-ref="${item.ref}"]:visible`).first().click();
    await page.waitForSelector("#reader-modal.active", { timeout: 8000 });
    const opened = await page.evaluate(() => ({
      title: document.querySelector("#reader-title")?.textContent || "",
      highlighted: [...document.querySelectorAll("#reader-modal .verse-highlight")]
        .map((row) => Number(row.dataset.verse)),
      error: document.querySelector("#reader-modal .reader-error")?.textContent || "",
      message: document.querySelector("#reader-modal .reader-message")?.textContent || "",
    }));

    if (opened.title !== `Exodus ${chapter}`) {
      issues.push(`${id} reader opened wrong title for ${item.ref}: ${JSON.stringify(opened)}`);
    }
    if (item.ref.includes(":") && opened.highlighted.length < 1) {
      issues.push(`${id} reader did not highlight verse range for ${item.ref}: ${JSON.stringify(opened)}`);
    }
    if (opened.error) {
      issues.push(`${id} reader showed error for ${item.ref}: ${opened.error}`);
    }
    if (/not available|unable to load|404/i.test(opened.message)) {
      issues.push(`${id} reader did not load available OSB text for ${item.ref}: ${opened.message}`);
    }
    await page.locator("#reader-modal .reader-close-btn").click();
    await page.waitForFunction(() => !document.getElementById("reader-modal")?.classList.contains("active"));
  }
}

async function assertLabSuggestionLink(page, id, issues) {
  const link = await page.evaluate(() => {
    const a = document.querySelector("#labs-suggest-link");
    return a ? {
      text: a.textContent || "",
      href: a.href || "",
      target: a.target || "",
      rel: a.rel || "",
      title: document.querySelector("#labs-title")?.textContent || "",
      ref: document.querySelector("#labs-ref")?.childNodes[0]?.textContent?.trim() || "",
    } : null;
  });
  if (!link) {
    issues.push(`${id} missing GitHub suggestion link`);
    return;
  }
  let url;
  try {
    url = new URL(link.href);
  } catch (e) {
    issues.push(`${id} suggestion link is not a valid URL: ${link.href}`);
    return;
  }
  if (url.origin !== "https://github.com" || url.pathname !== "/warnerwes/bible-bowl-study/issues/new") {
    issues.push(`${id} suggestion link targets wrong endpoint: ${link.href}`);
  }
  if (link.target !== "_blank" || !link.rel.includes("noopener")) {
    issues.push(`${id} suggestion link should open safely in a new tab: ${JSON.stringify(link)}`);
  }
  const title = url.searchParams.get("title") || "";
  const body = url.searchParams.get("body") || "";
  if (!/Suggest a correction/i.test(link.text) || !title.includes(id)) {
    issues.push(`${id} suggestion link has weak visible/title copy: ${JSON.stringify({ text: link.text, title })}`);
  }
  [`**Memory Lab ID:** ${id}`, `**Lab:** ${link.title}`, `**Reference:** ${link.ref}`, "**Suggested change / issue:**"].forEach((needle) => {
    if (!body.includes(needle)) issues.push(`${id} suggestion body missing ${needle}`);
  });
}

async function assertConsecrationAnointingCopy(page, id, issues) {
  if (id !== "consecration") return;
  const copy = await page.evaluate(() => {
    const lab = window.BibleBowlLabs?.labs?.find((item) => item.id === "consecration");
    return {
      step: lab?.ordered_items?.find((item) => /Anoint/i.test(item)) || "",
      description: lab?.description || "",
      tip: lab?.tip || "",
      teaching: [
        lab?.unlock_teaching?.body || "",
        lab?.completion_teaching?.memory_sentence || "",
      ].join(" "),
    };
  });
  if (!/Tabernacle/i.test(copy.step) || !/Everything In It/i.test(copy.step)) {
    issues.push(`consecration anointing step is ambiguous: "${copy.step}"`);
  }
  const teachingCopy = `${copy.description} ${copy.tip} ${copy.teaching}`;
  if (!/tabernacle and everything in it/i.test(teachingCopy)) {
    issues.push("consecration teaching should clarify the tabernacle and everything in it are anointed");
  }
}

async function exerciseDragDispenser(page, id, issues) {
  const before = await page.evaluate(() => ({
    dispenserCount: document.querySelectorAll(".lab-drag-dispenser").length,
    poolChipCount: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
    current: document.querySelector(".lab-drag-dispenser .lab-chip")?.dataset.label || "",
    copy: document.querySelector(".lab-drag-dispenser")?.textContent || "",
    sticky: getComputedStyle(document.querySelector(".lab-drag-dispenser")).position,
    filledSlots: document.querySelectorAll(".lab-drag-slot.filled").length,
    remaining: window.BibleBowlLabQA.state().drag?.pool.length ?? -1,
  }));

  if (before.dispenserCount !== 1) {
    issues.push(`${id} dispenser missing: ${JSON.stringify(before)}`);
    return;
  }
  if (before.poolChipCount !== 1 || !before.current) {
    issues.push(`${id} dispenser should show exactly one current card: ${JSON.stringify(before)}`);
  }
  if (before.sticky !== "sticky") {
    issues.push(`${id} dispenser should be sticky, got ${before.sticky}`);
  }
  if (id !== "plagues" && /plague/i.test(before.copy)) {
    issues.push(`${id} dispenser copy should not mention plagues: "${before.copy}"`);
  }

  await page.locator("#labs-workspace").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(80);
  const scrolled = await page.evaluate(() => {
    const ws = document.getElementById("labs-workspace");
    const disp = document.querySelector(".lab-drag-dispenser");
    if (!ws || !disp) return null;
    const wr = ws.getBoundingClientRect();
    const dr = disp.getBoundingClientRect();
    return {
      visible: dr.bottom <= wr.bottom + 2 && dr.top >= wr.top - 2,
      workspaceBottom: wr.bottom,
      dispenserTop: dr.top,
      dispenserBottom: dr.bottom,
    };
  });
  if (!scrolled?.visible) {
    issues.push(`${id} sticky dispenser not visible after workspace scroll: ${JSON.stringify(scrolled)}`);
  }

  await page.locator('.lab-drag-slot[data-index="0"]').click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    poolChipCount: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
    current: document.querySelector(".lab-drag-dispenser .lab-chip")?.dataset.label || "",
    copy: document.querySelector(".lab-drag-dispenser")?.textContent || "",
    filledSlots: document.querySelectorAll(".lab-drag-slot.filled").length,
    remaining: window.BibleBowlLabQA.state().drag?.pool.length ?? -1,
  }));

  if (after.filledSlots !== before.filledSlots + 1) {
    issues.push(`tap slot did not place current ${id} card: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (after.remaining !== before.remaining - 1) {
    issues.push(`dispenser did not reduce remaining count: before=${before.remaining} after=${after.remaining}`);
  }
  if (after.remaining > 0 && after.poolChipCount !== 1) {
    issues.push(`dispenser should keep exactly one next card visible: ${JSON.stringify(after)}`);
  }
  if (after.remaining > 0 && after.current === before.current) {
    issues.push(`dispenser did not advance to a new current card: before=${before.current} after=${after.current}`);
  }
  if (id !== "plagues" && /plague/i.test(after.copy)) {
    issues.push(`${id} dispenser copy should not mention plagues after placement: "${after.copy}"`);
  }

  await page.locator("#labs-workspace").evaluate((el) => {
    el.scrollTop = 0;
  });
}

async function exerciseDragSlotSwap(page, id, issues) {
  await page.locator('.lab-drag-slot[data-index="1"]').click();
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => {
    const drag = window.BibleBowlLabQA.state().drag;
    return {
      slots: drag?.slots.slice(0, 2) || [],
      pool: drag?.pool.slice() || [],
      filledSlots: document.querySelectorAll(".lab-drag-slot.filled").length,
      visibleDispenserCards: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
    };
  });

  if (before.filledSlots !== 2 || !before.slots[0] || !before.slots[1]) {
    issues.push(`${id} swap setup did not place two cards: ${JSON.stringify(before)}`);
    return;
  }

  const fromBox = await page.locator('.lab-drag-slot[data-index="0"] .lab-chip').boundingBox();
  const toBox = await page.locator('.lab-drag-slot[data-index="1"]').boundingBox();
  if (!fromBox || !toBox) {
    issues.push(`${id} swap boxes missing: from=${JSON.stringify(fromBox)} to=${JSON.stringify(toBox)}`);
    return;
  }

  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(160);

  const after = await page.evaluate(() => {
    const drag = window.BibleBowlLabQA.state().drag;
    return {
      slots: drag?.slots.slice(0, 2) || [],
      pool: drag?.pool.slice() || [],
      filledSlots: document.querySelectorAll(".lab-drag-slot.filled").length,
      visibleDispenserCards: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
    };
  });

  if (after.slots[0] !== before.slots[1] || after.slots[1] !== before.slots[0]) {
    issues.push(`${id} slot drag should swap occupied slots: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (after.pool.length !== before.pool.length || after.pool[0] !== before.pool[0]) {
    issues.push(`${id} slot swap should not return displaced card to dispenser: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (after.visibleDispenserCards !== 1) {
    issues.push(`${id} dispenser should still show exactly one card after swap: ${JSON.stringify(after)}`);
  }
}

async function exerciseTreeDispenser(page, issues) {
  const sonLabels = await page.evaluate(() => {
    const ids = ["nadab", "abihu", "eleazar", "ithamar", "gershom", "eliezer"];
    return Object.fromEntries(
      ids.map((id) => {
        const slot = document.querySelector(`.lab-tree-slot[data-slot-id="${id}"]`);
        const caption = slot?.closest(".lab-tree-cell")?.querySelector(".lab-tree-caption");
        return [id, caption?.textContent || ""];
      })
    );
  });
  const expectedLabels = {
    nadab: /1st son of Aaron/i,
    abihu: /2nd son of Aaron/i,
    eleazar: /3rd son of Aaron/i,
    ithamar: /4th son of Aaron/i,
    gershom: /1st son of Moses/i,
    eliezer: /2nd son of Moses/i,
  };
  for (const [id, pattern] of Object.entries(expectedLabels)) {
    if (!pattern.test(sonLabels[id] || "")) {
      issues.push(`priest_line ${id} label should clarify birth order: ${JSON.stringify(sonLabels)}`);
      break;
    }
  }

  const before = await page.evaluate(() => {
    const disp = document.querySelector(".lab-drag-dispenser");
    return {
      dispenserCount: document.querySelectorAll(".lab-drag-dispenser").length,
      chipCount: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
      current: document.querySelector(".lab-drag-dispenser .lab-chip")?.dataset.name || "",
      copy: disp?.textContent || "",
      sticky: disp ? getComputedStyle(disp).position : "",
      remaining: window.BibleBowlLabQA.state().tree?.tray.length ?? -1,
      filledCount: Object.keys(window.BibleBowlLabQA.state().tree?.filled || {}).length,
      slotIds: [...document.querySelectorAll(".lab-tree-slot")].slice(0, 2).map((slot) => slot.dataset.slotId),
    };
  });

  if (before.dispenserCount !== 1) {
    issues.push(`priest_line dispenser missing: ${JSON.stringify(before)}`);
    return;
  }
  if (before.chipCount !== 1 || !before.current) {
    issues.push(`priest_line dispenser should show exactly one current name: ${JSON.stringify(before)}`);
  }
  if (before.sticky !== "sticky") {
    issues.push(`priest_line dispenser should be sticky, got ${before.sticky}`);
  }
  if (/plague/i.test(before.copy)) {
    issues.push(`priest_line dispenser copy should not mention plagues: "${before.copy}"`);
  }
  if (before.slotIds.length < 2 || before.slotIds.some((id) => !id)) {
    issues.push(`priest_line needs two tree slots for swap coverage: ${JSON.stringify(before)}`);
    return;
  }

  await page.locator("#labs-workspace").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(80);
  const scrolled = await page.evaluate(() => {
    const ws = document.getElementById("labs-workspace");
    const disp = document.querySelector(".lab-drag-dispenser");
    if (!ws || !disp) return null;
    const wr = ws.getBoundingClientRect();
    const dr = disp.getBoundingClientRect();
    return {
      visible: dr.bottom <= wr.bottom + 2 && dr.top >= wr.top - 2,
      workspaceBottom: wr.bottom,
      dispenserTop: dr.top,
      dispenserBottom: dr.bottom,
    };
  });
  if (!scrolled?.visible) {
    issues.push(`priest_line sticky dispenser not visible after workspace scroll: ${JSON.stringify(scrolled)}`);
  }

  await page.locator(`.lab-tree-slot[data-slot-id="${before.slotIds[0]}"]`).click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    chipCount: document.querySelectorAll(".lab-drag-dispenser .lab-chip").length,
    current: document.querySelector(".lab-drag-dispenser .lab-chip")?.dataset.name || "",
    filledCount: Object.keys(window.BibleBowlLabQA.state().tree?.filled || {}).length,
    remaining: window.BibleBowlLabQA.state().tree?.tray.length ?? -1,
  }));

  if (after.filledCount !== before.filledCount + 1) {
    issues.push(`tap slot did not place current priest_line name: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (after.remaining !== before.remaining - 1) {
    issues.push(`priest_line dispenser did not reduce remaining count: before=${before.remaining} after=${after.remaining}`);
  }
  if (after.remaining > 0 && after.chipCount !== 1) {
    issues.push(`priest_line dispenser should keep exactly one next name visible: ${JSON.stringify(after)}`);
  }
  if (after.remaining > 0 && after.current === before.current) {
    issues.push(`priest_line dispenser did not advance: before=${before.current} after=${after.current}`);
  }

  await page.locator("#labs-workspace").evaluate((el) => {
    el.scrollTop = 0;
  });
}

async function exerciseTreeSlotSwap(page, issues) {
  const slotIds = await page.evaluate(() =>
    [...document.querySelectorAll(".lab-tree-slot")].slice(0, 2).map((slot) => slot.dataset.slotId)
  );
  if (slotIds.length < 2 || slotIds.some((id) => !id)) {
    issues.push(`priest_line swap needs two tree slots, got ${JSON.stringify(slotIds)}`);
    return;
  }

  await page.locator(`.lab-tree-slot[data-slot-id="${slotIds[1]}"]`).click();
  await page.waitForTimeout(120);
  const before = await page.evaluate((ids) => {
    const tree = window.BibleBowlLabQA.state().tree;
    return {
      filled: { ...tree.filled },
      tray: tree.tray.slice(),
      first: tree.filled[ids[0]],
      second: tree.filled[ids[1]],
    };
  }, slotIds);

  if (!before.first || !before.second) {
    issues.push(`priest_line swap setup did not place two names: ${JSON.stringify(before)}`);
    return;
  }

  await page.locator(`.lab-tree-slot[data-slot-id="${slotIds[0]}"] .lab-chip`).click();
  await page.waitForTimeout(80);
  await page.locator(`.lab-tree-slot[data-slot-id="${slotIds[1]}"] .lab-chip`).click();
  await page.waitForTimeout(120);
  const after = await page.evaluate((ids) => {
    const tree = window.BibleBowlLabQA.state().tree;
    return {
      filled: { ...tree.filled },
      tray: tree.tray.slice(),
      first: tree.filled[ids[0]],
      second: tree.filled[ids[1]],
    };
  }, slotIds);

  if (after.first !== before.second || after.second !== before.first) {
    issues.push(`priest_line occupied slots should swap names: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (JSON.stringify(after.tray) !== JSON.stringify(before.tray)) {
    issues.push(`priest_line swap should not return a displaced name to dispenser: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
}

async function exerciseAaronSonOrderMessage(page, issues) {
  await page.evaluate(() => {
    const tree = window.BibleBowlLabTree.getActive();
    tree.fillCorrect();
    tree.forcePlaceForTest("abihu", "Eleazar");
    tree.forcePlaceForTest("eleazar", "Abihu");
  });
  await page.waitForTimeout(120);
  await page.locator(".lab-check-btn").click();
  await page.waitForTimeout(120);
  const status = await page.locator(".lab-drag-status").textContent();
  if (!/Nadab,\s*Abihu,\s*Eleazar,\s*Ithamar/i.test(status || "")) {
    issues.push(`Aaron son order error should explain the sequence, got "${status}"`);
  }
  await page.locator(".lab-reset-btn").click();
  await page.waitForTimeout(120);
}

async function exerciseResetClearsHints(page, id, issues) {
  if (id === "tabernacle_place") return;
  const resetButton = page.locator(".lab-reset-btn");
  const resetCount = await resetButton.count();
  if (resetCount !== 1) {
    issues.push(`expected one reset button, got ${resetCount}`);
    return;
  }
  await resetButton.click();
  await page.waitForTimeout(120);
  const afterReset = await page.evaluate(() => ({
    state: window.BibleBowlLabQA.state(),
    counter: document.querySelector(".lab-tabernacle-hint-counter")?.textContent || "",
    pulses: document.querySelectorAll(".lab-hint-reveal").length,
  }));
  if (hintCountFromState(afterReset.state) !== 0) {
    issues.push(`reset did not clear hint count: ${JSON.stringify(afterReset.state)}`);
  }
  if (!/Hints:\s*0/.test(afterReset.counter)) {
    issues.push(`reset did not restore hint counter text: "${afterReset.counter}"`);
  }
  if (afterReset.pulses !== 0) {
    issues.push(`reset left ${afterReset.pulses} hint pulse element(s)`);
  }
  const drag = afterReset.state.drag;
  const tree = afterReset.state.tree;
  if (drag) {
    if (!drag.slots.every((slot) => slot === null) || drag.pool.length !== drag.slots.length) {
      issues.push(`reset left unexpected drag state: ${JSON.stringify(drag)}`);
    }
  }
  if (tree) {
    if (Object.keys(tree.filled).length !== 0 || tree.tray.length === 0) {
      issues.push(`reset left unexpected tree state: ${JSON.stringify(tree)}`);
    }
  }
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

  const issues = [];
  await assertLabReferenceReader(page, id, issues);
  await assertLabSuggestionLink(page, id, issues);
  await assertConsecrationAnointingCopy(page, id, issues);
  const dispenserCount = await page.locator(".lab-drag-dispenser").count();
  if (dispenserCount !== 1) {
    issues.push(`${id} should render one dispenser, got ${dispenserCount}`);
  }

  if (DRAG_LAB_IDS.has(id)) {
    await exerciseDragDispenser(page, id, issues);
    await exerciseDragSlotSwap(page, id, issues);
  } else if (TREE_LAB_IDS.has(id)) {
    await exerciseTreeDispenser(page, issues);
    await exerciseTreeSlotSwap(page, issues);
    await exerciseAaronSonOrderMessage(page, issues);
  }

  const before = await page.evaluate(() => window.BibleBowlLabQA.state());
  const beforePlacement = placementSnapshot(before);

  const hintButtonCount = await page.locator(".lab-hint-btn").count();
  if (hintButtonCount !== 1) {
    return {
      id,
      ok: false,
      issues: [`expected one hint button, got ${hintButtonCount}`],
      note: "missing hint control",
    };
  }
  await page.locator(".lab-hint-btn").click();
  await page.waitForTimeout(120);
  const afterHint = await page.evaluate(() => ({
    state: window.BibleBowlLabQA.state(),
    pulseCount: document.querySelectorAll(".lab-hint-reveal").length,
    counter: document.querySelector(".lab-tabernacle-hint-counter")?.textContent || "",
  }));

  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => window.BibleBowlLabQA.state());
  const afterHintPlacement = placementSnapshot(afterHint.state);

  if (hintCountFromState(afterHint.state) !== 1) {
    issues.push(`hint count did not increment to 1: ${JSON.stringify(afterHint.state)}`);
  }
  if (!/Hints:\s*1/.test(afterHint.counter)) {
    issues.push(`hint counter text did not update: "${afterHint.counter}"`);
  }
  if (afterHint.pulseCount < 1) {
    issues.push("hint did not pulse any source or target");
  }
  if (afterHint.pulseCount < 2) {
    issues.push(`hint should pulse both source and target, got ${afterHint.pulseCount}`);
  }
  if (JSON.stringify(beforePlacement) !== JSON.stringify(afterHintPlacement)) {
    issues.push("hint changed placement state instead of only revealing it");
  }

  const complete =
    after.drag?.complete ||
    after.tree?.complete ||
    after.tabernacle?.complete ||
    after.completed.includes(id);

  if (!complete) {
    issues.push("lab did not complete after solve()");
  }

  await assertSolvedLabLocked(page, id, after, issues);

  await exerciseResetClearsHints(page, id, issues);

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

async function testPriestLineMedalShelfRefresh(browser, viewport, errors) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("pageerror", (e) => errors.push(`[${viewport.name}] ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${viewport.name}] console: ${m.text()}`);
  });
  await page.addInitScript(() => {
    localStorage.removeItem("bbs:labs-completed:v1");
    localStorage.removeItem("bbs:labs-seen-unlock:v1");
    localStorage.removeItem("bbs-medal:priest_line");
  });
  await page.goto("http://127.0.0.1:9877/index.html?qa=1", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.BibleBowlLabQA && document.querySelector('#memory-labs-grid [data-lab-id="priest_line"]')
  );

  async function openPriestLine() {
    await page.evaluate(() => window.BibleBowlLabQA.open("priest_line"));
    await page.waitForSelector("#labs-modal.active", { timeout: 8000 });
    const hasBegin = await page.locator("#labs-begin-btn:visible").count();
    if (hasBegin > 0) await page.click("#labs-begin-btn");
    await page.waitForFunction(() => {
      const ws = document.getElementById("labs-workspace");
      return ws && !ws.hidden && window.BibleBowlLabTree?.getActive();
    });
    await page.waitForTimeout(200);
  }

  async function shelfTier() {
    return page.evaluate(() => {
      const item = document.querySelector('#memory-labs-grid [data-lab-id="priest_line"]');
      return {
        classes: item ? [...item.classList] : [],
        badge: item?.querySelector(".lab-medal-badge")?.textContent || "",
        tooltip: item?.querySelector(".trophy-tooltip")?.textContent || "",
      };
    });
  }

  const issues = [];

  await openPriestLine();
  await page.locator(".lab-hint-btn").click();
  await page.waitForTimeout(120);
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(250);
  let tier = await shelfTier();
  if (!tier.classes.includes("medal-silver")) {
    issues.push(`first priest_line completion should show silver on shelf: ${JSON.stringify(tier)}`);
  }
  await page.evaluate(() => window.BibleBowlLabQA.close());
  await page.waitForTimeout(120);

  await openPriestLine();
  await page.evaluate(() => window.BibleBowlLabQA.solve());
  await page.waitForTimeout(250);
  tier = await shelfTier();
  if (!tier.classes.includes("medal-gold")) {
    issues.push(`better priest_line replay should refresh shelf to gold before page reload: ${JSON.stringify(tier)}`);
  }
  await page.evaluate(() => window.BibleBowlLabQA.close());
  await page.close();

  return {
    id: "priest_line_medal_refresh",
    ok: issues.length === 0,
    issues,
    note: issues.length ? "shelf medal stale" : "silver replay upgraded to gold without reload",
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
  if (shelf < 6) {
    errors.push(`[${viewport.name}] expected 6 unlocked labs, got ${shelf}`);
  }

  const results = [];
  for (const id of LAB_IDS) {
    results.push(await testLab(page, id, viewport.name));
  }
  await page.close();
  results.push(await testPriestLineMedalShelfRefresh(browser, viewport, errors));
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
