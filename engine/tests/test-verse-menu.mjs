import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { makeDocument, makeStorage } from "./headless-dom.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verseMenuUrl = pathToFileURL(path.join(__dirname, "..", "src", "verse-menu.js")).href;

function setupDom() {
  const document = makeDocument();
  const root = document.createElement("div");
  root.id = "verse-menu-root";
  document._byId.set(root.id, root);
  const content = document.createElement("pre");
  content.id = "reader-content";
  document._byId.set(content.id, content);

  const marker = document.createElement("button");
  marker.className = "verse-marker";
  marker.dataset.verse = "2";
  marker.textContent = "[2]";
  const clue = document.createElement("span");
  clue.setAttribute("data-reader-adornment", "");
  const verseText = document.createElement("span");
  verseText.className = "verse-text";
  verseText.textContent = " Synthetic verse text.";
  const preview = document.createElement("span");
  preview.setAttribute("data-reader-adornment", "");

  content.appendChild(marker);
  content.appendChild(clue);
  content.appendChild(verseText);
  content.appendChild(preview);
  return { document, root, content, marker, clue, preview };
}

function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of node.children || []) {
    walk(child, visit);
  }
}

function nodesByTag(root, tagName) {
  const found = [];
  walk(root, (node) => {
    if (node.tagName === tagName) found.push(node);
  });
  return found;
}

function nodesByClass(root, className) {
  const found = [];
  walk(root, (node) => {
    if (String(node.className || "").split(/\s+/).includes(className)) found.push(node);
  });
  return found;
}

function buttonByText(root, text) {
  return nodesByTag(root, "BUTTON").find((node) => node.textContent === text) || null;
}

async function installFirebaseStub(calls) {
  const { setFirebaseLoader } = await import(`${verseMenuUrl}?loader=${Math.random()}`);
  setFirebaseLoader(async () => ([
    { initializeApp(config) { return { options: config }; } },
    {
      getAuth() {
        return {
          currentUser: { uid: "anon-1" },
          async authStateReady() {},
        };
      },
      async signInAnonymously(auth) {
        return { user: auth.currentUser };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(db, name) { return { db, name }; },
      query(...parts) { return parts; },
      where(...parts) { return parts; },
      async getDocs() { return { docs: [] }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async addDoc(collectionRef, payload) {
        calls.push({ collectionRef, payload });
        return { id: `doc-${calls.length}` };
      },
    },
  ]));
}

function mountMenuFactory() {
  return import(`${verseMenuUrl}?case=${Math.random()}`);
}

test("verse menu opens in bubble state, expands by type, and returns to bubble after submit", async () => {
  const { document, root, content, marker } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  globalThis.localStorage.setItem("bbs:authorName", "Anna");
  globalThis.localStorage.setItem(
    "bbs:notes:1cor:13:2",
    JSON.stringify([{ text: "Earlier device note", createdAt: "2026-07-16T00:00:00.000Z" }])
  );

  const calls = [];
  await installFirebaseStub(calls);
  const { mountVerseMenu } = await mountMenuFactory();
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  menu.setOwnedEntries({
    2: [
      {
        id: "older-q",
        kind: "question_seed",
        text: "Older question",
        answerText: "Older answer",
        status: "approved",
        createdAt: "2026-07-16T00:00:00.000Z",
      },
    ],
  });

  content.dispatch("click", { target: marker });

  assert.equal(document.getElementById("verse-menu-title").textContent, "1 Corinthians 13:2");
  assert.ok(buttonByText(root, "Private note"));
  assert.ok(buttonByText(root, "Submit question"));
  assert.ok(buttonByText(root, "Submit memory aid"));
  assert.ok(nodesByClass(root, "verse-menu-history-item").some((node) => node.textContent.includes("Older question")));
  assert.ok(nodesByClass(root, "verse-menu-history-item").some((node) => node.textContent.includes("Earlier device note")));

  buttonByText(root, "Submit question").click();
  assert.ok(document.getElementById("verse-menu-question"));
  assert.ok(document.getElementById("verse-menu-answer"));
  assert.equal(buttonByText(root, "Back").textContent, "Back");

  document.getElementById("verse-menu-question").value = "Newest question";
  document.getElementById("verse-menu-answer").value = "Newest answer";
  const form = nodesByTag(root, "FORM")[0];
  await form._listeners.submit[0]({ preventDefault() {} });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.kind, "question_seed");
  assert.ok(buttonByText(root, "Submit question"));
  const compactItems = nodesByClass(root, "verse-menu-history-item").map((node) => node.textContent);
  assert.equal(compactItems[0].includes("Newest question"), true);
});

test("verse menu keeps the first-name field visible and editable when a name already exists", async () => {
  const { document, root, content, marker } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  globalThis.localStorage.setItem("bbs:authorName", "Anna");

  const calls = [];
  await installFirebaseStub(calls);
  const { mountVerseMenu } = await mountMenuFactory();
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });

  content.dispatch("click", { target: marker });
  buttonByText(root, "Submit question").click();

  const nameInput = document.getElementById("verse-menu-name");
  assert.ok(nameInput);
  assert.equal(nameInput.value, "Anna");

  nameInput.value = "Mimi";
  nameInput.dispatch("input");
  document.getElementById("verse-menu-question").value = "Nickname question";
  document.getElementById("verse-menu-answer").value = "Nickname answer";
  const form = nodesByTag(root, "FORM")[0];
  await form._listeners.submit[0]({ preventDefault() {} });

  assert.equal(calls[0].payload.authorName, "Mimi");
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), "Mimi");
});

test("verse menu history renders newest first and stars only approved/exported entries", async () => {
  const { document, root, content, marker } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  const calls = [];
  await installFirebaseStub(calls);
  const { mountVerseMenu } = await mountMenuFactory();
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  menu.setOwnedEntries({
    2: [
      { id: "a", kind: "memory_hook", text: "Newest approved", status: "approved", createdAt: "2026-07-16T04:00:00.000Z" },
      { id: "b", kind: "surprising_fact", text: "Legacy exported", status: "exported", createdAt: "2026-07-16T03:00:00.000Z" },
      { id: "c", kind: "link", text: "Older rejected", url: "https://example.com/rejected", status: "rejected", createdAt: "2026-07-16T02:00:00.000Z" },
      { id: "d", kind: "memory_hook", text: "Oldest new", status: "new", createdAt: "2026-07-16T01:00:00.000Z" },
    ],
  });

  content.dispatch("click", { target: marker });
  buttonByText(root, "Submit memory aid").click();

  const cards = nodesByClass(root, "verse-menu-history-card").map((node) => node.textContent);
  assert.equal(cards[0].includes("Newest approved"), true);
  assert.equal(cards[1].includes("Legacy exported"), true);
  assert.equal(cards[2].includes("Older rejected"), true);
  assert.equal(cards[3].includes("Oldest new"), true);
  assert.equal(cards.filter((text) => text.includes("Accepted")).length, 2);
});

test("verse menu migrates raw-string notes to arrays and preserves multiple notes newest first", async () => {
  const { document, root, content, marker, preview } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  globalThis.localStorage.setItem("bbs:note:1cor:13:2", "Legacy raw string");

  const calls = [];
  await installFirebaseStub(calls);
  const { mountVerseMenu } = await mountMenuFactory();
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  content.dispatch("click", { target: marker });

  assert.equal(preview.textContent, "Your note: Legacy raw string");
  buttonByText(root, "Private note").click();
  document.getElementById("verse-menu-note").value = "Second saved note";
  const form = nodesByTag(root, "FORM")[0];
  await form._listeners.submit[0]({ preventDefault() {} });

  const stored = JSON.parse(globalThis.localStorage.getItem("bbs:notes:1cor:13:2"));
  assert.equal(stored.length, 2);
  assert.equal(globalThis.localStorage.getItem("bbs:note:1cor:13:2"), null);

  content.dispatch("click", { target: marker });
  buttonByText(root, "Private note").click();
  const noteCards = nodesByClass(root, "verse-menu-history-card").map((node) => node.textContent);
  assert.equal(noteCards[0], "Second saved note");
  assert.equal(noteCards[1], "Legacy raw string");
});
