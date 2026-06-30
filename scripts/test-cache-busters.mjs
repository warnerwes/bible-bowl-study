/**
 * Cache-buster regression test.
 *
 * Verifies that EVERY memory-labs asset referenced in index.html has a
 * ?v=N cache-buster that is in sync with the local file MD5. This is
 * the safeguard against the "I deployed v2 of memory-labs-tabernacle.js
 * but the phone still serves v1 because the HTML cached the old script
 * tag" bug.
 *
 * Rule: the URL query string must change whenever the file content
 * changes. We approximate by requiring a ?v= query string on every
 * memory-labs asset (a missing cache-buster is automatically a fail).
 *
 * Run: node scripts/test-cache-busters.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

const expectedAssets = [
  "bible-reader.css",
  "bible-reader.js",
  "memory-labs.css",
  "memory-labs-dispenser.css",
  "memory-labs-data.js",
  "memory-labs-drag.js",
  "memory-labs-tree.js",
  "memory-labs-tabernacle.js",
  "memory-labs.js",
  "mastery-trial.css",
  "mastery-trial.js",
];

let failed = 0;
const checks = [];

for (const asset of expectedAssets) {
  // Find the script/link tag referencing this asset.
  const escaped = asset.replace(/\./g, "\\.");
  const re = new RegExp(`(?:href|src)="(${escaped}\\?v=\\d+)"`, "i");
  const match = html.match(re);
  if (!match) {
    checks.push({ name: `${asset} has ?v=N cache-buster`, ok: false });
    failed++;
    continue;
  }
  const ref = match[1];
  checks.push({ name: `${asset} has ?v=N cache-buster`, ok: true, detail: ref });

  // Local file must exist (sanity).
  const exists = readFileSync(join(root, asset), "utf8").length > 0;
  checks.push({ name: `${asset} local file readable`, ok: exists });
  if (!exists) failed++;
}

// SW cache version must also be present and bumpable.
const sw = readFileSync(join(root, "sw.js"), "utf8");
const swCacheMatch = sw.match(/const CACHE = "bbs-cache-v(\d+)"/);
checks.push({
  name: "sw.js declares a CACHE version",
  ok: !!swCacheMatch,
  detail: swCacheMatch ? `v${swCacheMatch[1]}` : "(none)",
});
if (!swCacheMatch) failed++;

console.log("\n=== Cache-Buster Coverage ===\n");
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
  if (!c.ok) failed++;
}

console.log(
  failed
    ? `\n${failed} failure(s).`
    : `\nAll ${checks.length} cache-buster checks passed.`
);
process.exit(failed ? 1 : 0);
