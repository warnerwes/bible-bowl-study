/**
 * Bible reader route regression test.
 *
 * The quiz uses history.pushState() routes such as /quiz/12. The OSB reader
 * must still fetch data/source-text/exodus/exodus-verses.json from the app
 * root, not from /quiz/data/source-text/... .
 *
 * Run: node scripts/test-bible-reader-routes.mjs
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = 9881;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const cleanUrl = (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html";
      const path = join(root, cleanUrl);
      if (!existsSync(path)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
      res.end(readFileSync(path));
    });
    server.listen(PORT, () => resolve(server));
  });
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/sw.js", (route) => route.abort());

  await page.goto(`http://127.0.0.1:${PORT}/index.html?qa=1`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.BibleReader && window.BibleBowlQA);
  const homeBadge = await page.evaluate(() => ({
    text: document.querySelector("#read-exodus .new-badge")?.textContent || "",
    visible: !!document.querySelector("#read-exodus .new-badge")?.offsetParent,
  }));

  await page.evaluate(() => {
    history.pushState({ screen: "quiz", index: 0 }, "", "/quiz/12");
  });
  await page.evaluate(() => window.BibleReader.open(12));
  await page.waitForSelector("#reader-modal.active", { timeout: 8000 });

  await page.evaluate(() => window.BibleReader.openRef("Exodus 12:29"));
  await page.waitForSelector('#reader-modal .verse-highlight[data-verse="29"]', { timeout: 8000 });

  const result = await page.evaluate(() => ({
    title: document.querySelector("#reader-title")?.textContent || "",
    error: document.querySelector(".reader-error")?.textContent || "",
    message: document.querySelector(".reader-message")?.textContent || "",
    verseCount: document.querySelectorAll(".reader-verse").length,
    highlighted: [...document.querySelectorAll("#reader-modal .verse-highlight")]
      .map((row) => Number(row.dataset.verse)),
    verse29: document.querySelector('#reader-modal .verse-highlight[data-verse="29"]')?.textContent || "",
  }));
  const footerPlacement = await page.evaluate(() => {
    const body = document.querySelector(".reader-body");
    const footer = document.querySelector(".reader-footer");
    const fixedFooter = document.querySelector("#reader-modal .reader-card > .reader-footer");
    const bodyBox = body?.getBoundingClientRect();
    const initialBox = footer?.getBoundingClientRect();
    const initiallyVisible = !!(bodyBox && initialBox && initialBox.top < bodyBox.bottom && initialBox.bottom > bodyBox.top);
    if (body) body.scrollTop = body.scrollHeight;
    const bottomBox = footer?.getBoundingClientRect();
    const bottomVisible = !!(bodyBox && bottomBox && bottomBox.top < bodyBox.bottom && bottomBox.bottom > bodyBox.top);
    return {
      fixed: !!fixedFooter,
      parentClass: footer?.parentElement?.className || "",
      initiallyVisible,
      bottomVisible,
      text: footer?.textContent || "",
    };
  });

  await page.locator("#reader-modal .reader-close-btn").click();
  await page.waitForFunction(() => !document.querySelector("#reader-modal")?.classList.contains("active"));
  await page.evaluate(() => window.BibleBowlQA.open("red_sea"));
  await page.waitForSelector("#rewards-modal.active", { timeout: 8000 });
  await page.evaluate(() => {
    const passage = document.querySelector(".rewards-passage");
    if (passage) passage.open = true;
  });
  const rewardPassageButton = await page.evaluate(() => {
    const btn = document.querySelector("#rewards-hud-passage");
    return {
      text: btn?.textContent || "",
      ref: btn?.dataset.ref || "",
      hidden: !!btn?.hidden,
    };
  });
  await page.locator("#rewards-hud-passage").click();
  await page.waitForSelector("#reader-modal.active", { timeout: 8000 });
  await page.waitForSelector('#reader-modal .verse-highlight[data-verse="16"]', { timeout: 8000 });
  const rewardReader = await page.evaluate(() => ({
    title: document.querySelector("#reader-title")?.textContent || "",
    highlighted: [...document.querySelectorAll("#reader-modal .verse-highlight")]
      .map((row) => Number(row.dataset.verse)),
  }));
  await page.locator("#reader-modal .reader-close-btn").click();
  await page.waitForFunction(() => !document.querySelector("#reader-modal")?.classList.contains("active"));
  await page.evaluate(() => window.BibleBowlQA.close());

  await page.evaluate(() => window.BibleReader.startGame(12));
  await page.waitForSelector("#reader-modal .reader-game", { timeout: 8000 });
  const gameInitial = await page.evaluate(() => ({
    title: document.querySelector("#reader-title")?.textContent || "",
    headerBox: (() => {
      const box = document.querySelector("#reader-modal .reader-header")?.getBoundingClientRect();
      return box ? { width: box.width, height: box.height } : null;
    })(),
    titleBox: (() => {
      const box = document.querySelector("#reader-title")?.getBoundingClientRect();
      return box ? { width: box.width, height: box.height } : null;
    })(),
    blankCount: document.querySelectorAll(".reader-blank").length,
    choiceCount: document.querySelectorAll(".reader-choice").length,
    state: window.BibleReader.gameState(),
  }));
  await page.locator(".reader-blank").first().click();
  await page.waitForFunction(() => document.querySelectorAll(".reader-choice-tray .reader-choice").length >= 4);
  const gameStageOne = await page.evaluate(() => {
    const tray = document.querySelector(".reader-choice-tray");
    const box = tray?.getBoundingClientRect();
    return {
      title: document.querySelector("#reader-title")?.textContent || "",
      blankCount: document.querySelectorAll(".reader-blank").length,
      choiceCount: document.querySelectorAll(".reader-choice").length,
      tray: box ? {
        position: getComputedStyle(tray).position,
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        viewportHeight: window.innerHeight,
      } : null,
      state: window.BibleReader.gameState(),
    };
  });
  for (let i = 0; i < gameStageOne.blankCount; i++) {
    await page.evaluate(() => window.BibleReader.answerGameCorrect());
  }
  await page.waitForSelector(".reader-game-done", { timeout: 8000 });
  await page.evaluate(() => window.BibleReader.nextGameStage());
  await page.waitForFunction(() => window.BibleReader.gameState()?.stageIndex === 1);
  const gameStageTwoInitial = await page.evaluate(() => ({
    blankCount: document.querySelectorAll(".reader-blank").length,
    choiceCount: document.querySelectorAll(".reader-choice").length,
    state: window.BibleReader.gameState(),
  }));
  await page.locator(".reader-blank").first().click();
  await page.waitForFunction(() => document.querySelectorAll(".reader-choice-tray .reader-choice").length >= 4);
  const gameStageTwo = await page.evaluate(() => ({
    blankCount: document.querySelectorAll(".reader-blank").length,
    choiceCount: document.querySelectorAll(".reader-choice").length,
    state: window.BibleReader.gameState(),
  }));
  await page.evaluate(() => window.BibleReader.startGame(1, 2));
  await page.waitForFunction(() => window.BibleReader.gameState()?.stageIndex === 2);
  const gameStageThreeChapterOne = await page.evaluate(() => {
    const state = window.BibleReader.gameState();
    return {
      blankCount: document.querySelectorAll(".reader-blank").length,
      answers: state?.blanks?.map((blank) => blank.answer) || [],
      state,
    };
  });
  await page.evaluate(() => window.BibleReader.startGame(3, 2));
  await page.waitForFunction(() => window.BibleReader.gameState()?.stageIndex === 2);
  const gameStageThreeChapterThree = await page.evaluate(() => {
    const state = window.BibleReader.gameState();
    return {
      blankCount: document.querySelectorAll(".reader-blank").length,
      answers: state?.blanks?.map((blank) => blank.answer) || [],
      state,
    };
  });

  const checks = [
    {
      name: "home reader button shows New badge",
      ok: homeBadge.text.trim() === "New" && homeBadge.visible,
      detail: JSON.stringify(homeBadge),
    },
    {
      name: "reader opens Exodus 12 while location is /quiz/12",
      ok: result.title === "Exodus 12",
      detail: result.title,
    },
    {
      name: "reader renders verses from source text",
      ok: result.verseCount > 0,
      detail: `verses=${result.verseCount}`,
    },
    {
      name: "reader does not show HTTP 404",
      ok: !/404/.test(`${result.error} ${result.message}`),
      detail: JSON.stringify(result),
    },
    {
      name: "reader opens Exodus 12:29 and highlights verse 29",
      ok: result.highlighted.includes(29) && /firstborn/i.test(result.verse29),
      detail: JSON.stringify({ highlighted: result.highlighted, verse29: result.verse29 }),
    },
    {
      name: "reader source attribution lives at scroll bottom, not fixed footer",
      ok: !footerPlacement.fixed &&
        footerPlacement.parentClass === "reader-body" &&
        !footerPlacement.initiallyVisible &&
        footerPlacement.bottomVisible &&
        /Orthodox Study Bible/.test(footerPlacement.text),
      detail: JSON.stringify(footerPlacement),
    },
    {
      name: "reward passage button opens highlighted Bible reader passage",
      ok: !rewardPassageButton.hidden &&
        rewardPassageButton.ref === "Exodus 14:16-22" &&
        /Read Exodus 14:16-22/.test(rewardPassageButton.text) &&
        rewardReader.title === "Exodus 14" &&
        rewardReader.highlighted.includes(16) &&
        rewardReader.highlighted.includes(22),
      detail: JSON.stringify({ button: rewardPassageButton, reader: rewardReader }),
    },
    {
      name: "reader word game starts with four unselected chapter blanks",
      ok: /Word Game/.test(gameInitial.title) &&
        gameInitial.headerBox?.height < 82 &&
        gameInitial.titleBox?.width > 200 &&
        gameInitial.titleBox?.height < 60 &&
        gameInitial.blankCount === 4 &&
        gameInitial.choiceCount === 0 &&
        gameInitial.state?.activeIndex === -1 &&
        gameInitial.state?.blanks?.every((blank) => blank.options.length >= 4),
      detail: JSON.stringify(gameInitial),
    },
    {
      name: "reader word game loads choices into sticky bottom tray after blank click",
      ok: gameStageOne.blankCount === 4 &&
        gameStageOne.choiceCount >= 4 &&
        gameStageOne.tray?.position === "sticky" &&
        gameStageOne.tray.top > gameStageOne.tray.viewportHeight * 0.55 &&
        gameStageOne.state?.activeIndex === 0,
      detail: JSON.stringify(gameStageOne),
    },
    {
      name: "reader word game stage two increases missing words",
      ok: gameStageTwo.state?.stageIndex === 1 &&
        gameStageTwoInitial.blankCount === 8 &&
        gameStageTwoInitial.choiceCount === 0 &&
        gameStageTwo.blankCount === 8 &&
        gameStageTwo.choiceCount >= 4,
      detail: JSON.stringify({ initial: gameStageTwoInitial, selected: gameStageTwo }),
    },
    {
      name: "reader word game stage three emphasizes harder names and big words",
      ok: gameStageThreeChapterOne.blankCount === 12 &&
        ["multiplied", "Pithom", "Raamses", "Shiphrah", "Puah"].every((word) =>
          gameStageThreeChapterOne.answers.includes(word)
        ),
      detail: JSON.stringify(gameStageThreeChapterOne),
    },
    {
      name: "reader word game stage three includes larger content words",
      ok: gameStageThreeChapterThree.blankCount === 12 &&
        gameStageThreeChapterThree.answers.includes("affliction"),
      detail: JSON.stringify(gameStageThreeChapterThree),
    },
  ];

  let failed = errors.length;
  console.log("\n=== Bible Reader Route QA ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " - " + c.detail : ""}`);
    if (!c.ok) failed++;
  }
  if (errors.length) {
    console.log("\nPage/console errors:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log(failed ? `\n${failed} failure(s).` : `\nAll ${checks.length} reader checks passed.`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
  server.close();
}
