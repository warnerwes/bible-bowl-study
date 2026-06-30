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
  await page.waitForFunction(() => window.BibleReader);

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

  await page.evaluate(() => window.BibleReader.startGame(12));
  await page.waitForSelector("#reader-modal .reader-game", { timeout: 8000 });
  const gameStageOne = await page.evaluate(() => ({
    title: document.querySelector("#reader-title")?.textContent || "",
    blankCount: document.querySelectorAll(".reader-blank").length,
    choiceCount: document.querySelectorAll(".reader-choice").length,
    state: window.BibleReader.gameState(),
  }));
  for (let i = 0; i < gameStageOne.blankCount; i++) {
    await page.evaluate(() => window.BibleReader.answerGameCorrect());
  }
  await page.waitForSelector(".reader-game-done", { timeout: 8000 });
  await page.evaluate(() => window.BibleReader.nextGameStage());
  await page.waitForFunction(() => window.BibleReader.gameState()?.stageIndex === 1);
  const gameStageTwo = await page.evaluate(() => ({
    blankCount: document.querySelectorAll(".reader-blank").length,
    choiceCount: document.querySelectorAll(".reader-choice").length,
    state: window.BibleReader.gameState(),
  }));

  const checks = [
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
      name: "reader word game starts with four chapter blanks",
      ok: /Word Game/.test(gameStageOne.title) &&
        gameStageOne.blankCount === 4 &&
        gameStageOne.choiceCount >= 4 &&
        gameStageOne.state?.blanks?.every((blank) => blank.options.length >= 4),
      detail: JSON.stringify(gameStageOne),
    },
    {
      name: "reader word game stage two increases missing words",
      ok: gameStageTwo.state?.stageIndex === 1 &&
        gameStageTwo.blankCount === 8 &&
        gameStageTwo.choiceCount >= 4,
      detail: JSON.stringify(gameStageTwo),
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
