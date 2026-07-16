import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

class StubNode {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.className = "";
    this.textContent = "";
    this.href = "";
    this.target = "";
    this.rel = "";
    this.title = "";
    this.id = "";
  }
  appendChild(node) {
    this.children.push(node);
    return node;
  }
}

function makeDocument() {
  const nodes = new Map();
  const doc = {
    createElement(tag) {
      return new StubNode(tag);
    },
    getElementById(id) {
      return nodes.get(id) || null;
    },
  };
  ["plan-title", "plan-description", "plan-weeks"].forEach((id) => {
    const node = new StubNode("div");
    node.id = id;
    nodes.set(id, node);
  });
  return doc;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => pathToFileURL(path.join(__dirname, "..", "src", name)).href;
const { buildReadLink, renderPlan } = await import(src("reading-plan.js"));
const { getProvider } = await import(src("passage-links.js"));

test("reader provider returns a local route", () => {
  const provider = getProvider("reader");
  assert.equal(provider.build("1 Corinthians 3"), "reader.html?ref=1%20Corinthians%203");
  assert.equal(provider.label("1 Corinthians 3"), "Read 1 Corinthians 3 here");
});

test("reading plan render builds week links through the provider", () => {
  globalThis.document = makeDocument();
  const plan = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "generator", "pilots", "corinthians", "reading-plan.json"),
      "utf8"
    )
  );
  assert.equal(plan.weeks.length, 15);

  const config = { passageProvider: "reader", bibleVersion: "NKJV" };
  const readLink = buildReadLink({
    week: 1,
    book: "1 Corinthians",
    chapters: [1, 2],
    reference: "1 Corinthians 1-2",
  }, config);
  assert.equal(readLink.href, "reader.html?ref=1%20Corinthians%201-2");
  assert.equal(readLink.external, false);

  renderPlan(plan, null, config);
  const cards = document.getElementById("plan-weeks").children;
  assert.equal(cards.length, 15);
  const firstReadLink = cards[0].children[2].children[0];
  assert.equal(firstReadLink.href, "reader.html?ref=1%20Corinthians%201-2");
  assert.equal(firstReadLink.textContent, "Read 1 Corinthians 1-2 here");
  assert.equal(firstReadLink.target, "");
});
