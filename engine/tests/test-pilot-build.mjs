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

test("pilot build includes the homepage note text exactly once", async () => {
  await execFileAsync("node", [buildScript], { cwd: root });
  const indexHtml = readFileSync(path.join(siteDir, "index.html"), "utf8");
  const count = (indexHtml.match(/shared monthly allotment/g) || []).length;
  assert.equal(count, 1);
});
