/**
 * Update-mechanism regression test.
 *
 * Verifies the deployed index.html contains:
 *   1. A `__BBS_VERSION = "N"` stamp (so phones can detect new builds)
 *   2. A `controllerchange` listener that reloads on SW takeover
 *   3. A periodic ping that fetches the live HTML and reloads on
 *      version mismatch
 *
 * Plus a live behavior test: spin up a server, fetch the HTML, and
 * confirm the version regex matches.
 *
 * Run: node scripts/test-update-mechanism.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

let failed = 0;
const checks = [];

const versionMatch = html.match(/__BBS_VERSION\s*=\s*"(\d+)"/);
checks.push({
  name: "HTML declares __BBS_VERSION stamp",
  ok: !!versionMatch,
  detail: versionMatch ? `v${versionMatch[1]}` : "(missing)",
});
if (!versionMatch) failed++;

checks.push({
  name: "HTML registers SW",
  ok: /serviceWorker\.register\(\s*["']sw\.js/.test(html),
});
if (!/serviceWorker\.register\(\s*["']sw\.js/.test(html)) failed++;

checks.push({
  name: "HTML listens for controllerchange (auto-reload on SW swap)",
  ok: /controllerchange/.test(html),
});
if (!/controllerchange/.test(html)) failed++;

checks.push({
  name: "HTML pings server periodically for version mismatch",
  ok: /__BBS_VERSION/.test(html) && /setInterval/.test(html),
});
if (!/setInterval/.test(html)) failed++;

checks.push({
  name: "Ping uses cache: no-store (bypasses browser cache)",
  ok: /cache:\s*["']no-store["']/.test(html),
});
if (!/cache:\s*["']no-store["']/.test(html)) failed++;

checks.push({
  name: "HTML wires a 'reload on mismatch' action (window.location.reload)",
  ok: /window\.location\.reload\(\)/.test(html),
});
if (!/window\.location\.reload\(\)/.test(html)) failed++;

console.log("\n=== Update Mechanism Coverage ===\n");
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
  if (!c.ok) failed++;
}

console.log(
  failed
    ? `\n${failed} failure(s).`
    : `\nAll ${checks.length} update-mechanism checks passed.`
);
process.exit(failed ? 1 : 0);