// Regression test: every JS file at the repo root must be referenced in
// the deploy workflow's "cp" line, otherwise it will 404 on GitHub Pages.
//
// Previously: memory-labs-tabernacle.js shipped to main but was missing
// from the workflow's cp list, so the lab card rendered empty on the
// deployed site while everything looked fine locally.
//
// Run: node scripts/test-deploy-includes-all-js.mjs

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { readFile } from "fs/promises";
import assert from "assert/strict";

const ROOT = process.cwd();

// 1. Read all top-level .js files (excluding scripts/, tests, node_modules)
const topLevel = readdirSync(ROOT).filter((f) => {
  if (!f.endsWith(".js")) return false;
  if (f.startsWith("scripts/")) return false;
  return statSync(f).isFile();
});

const deployYml = await readFile(".github/workflows/deploy.yml", "utf8");

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log("  ✓", name); pass++; }
  catch (e) { console.log("  ✗", name, "—", e.message); fail++; }
}

console.log("Deploy-coverage checks:");
console.log(`  Found ${topLevel.length} top-level .js files: ${topLevel.join(", ")}`);

for (const js of topLevel) {
  check(`${js} is in the deploy.yml cp list`, () => {
    if (!deployYml.includes(js)) {
      throw new Error(`${js} missing from .github/workflows/deploy.yml cp line`);
    }
  });
}

check("deploy.yml includes data/questions.json copy step", () => {
  if (!deployYml.includes("data/questions.json")) {
    throw new Error("deploy.yml does not copy data/questions.json");
  }
});

check("deploy.yml triggers on push to main", () => {
  if (!/branches:\s*\[main\]/.test(deployYml)) {
    throw new Error("deploy.yml does not trigger on main push");
  }
});

check("every <script src=\"...\"> in index.html resolves to a repo-root file", () => {
  const html = readFileSync(`${ROOT}/index.html`, "utf8");
  const refs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    // Strip ?v=N query and relative prefix
    const clean = ref.replace(/\?.*$/, "").replace(/^\.\//, "");
    if (clean.startsWith("http")) continue;
    if (!existsSync(`${ROOT}/${clean}`)) {
      throw new Error(`index.html references missing file: ${ref}`);
    }
  }
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);