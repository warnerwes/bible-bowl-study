import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const buildScript = path.join(root, "generator", "pilots", "corinthians", "build-site.mjs");
const siteDir = path.join(root, "generator", "pilots", "corinthians", "_site");

test("pilot build includes the parish home, reading plan, and data notice", async () => {
  await execFileAsync("node", [buildScript], { cwd: root });
  const indexHtml = readFileSync(path.join(siteDir, "index.html"), "utf8");
  assert.match(indexHtml, /<script type="module" src="parish-app\.js">/);
  assert.match(indexHtml, /href="privacy\.html"/);
  assert.match(indexHtml, /href="reading\.html"/);
  assert.match(readFileSync(path.join(siteDir, "privacy.html"), "utf8"), /session storage/);
});
