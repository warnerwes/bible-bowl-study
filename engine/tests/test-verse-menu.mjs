import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { makeDocument, makeStorage } from "./headless-dom.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verseMenuUrl = pathToFileURL(path.join(__dirname, "..", "src", "verse-menu.js")).href;
const suggestCoreUrl = pathToFileURL(path.join(__dirname, "..", "src", "suggest-core.js")).href;

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
  content.appendChild(marker);
  return { document, root, content, marker };
}

function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

test("verse menu opens from a verse marker click and renders its fields", async () => {
  const { document, root, content, marker } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  const { mountVerseMenu } = await import(`${verseMenuUrl}?case=open`);
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  content.dispatch("click", { target: marker });

  assert.equal(document.getElementById("verse-menu-title").textContent, "1 Corinthians 13:2");
  assert.ok(document.getElementById("verse-menu-question"));
  assert.ok(document.getElementById("verse-menu-fact"));
  assert.ok(document.getElementById("verse-menu-link"));
  assert.ok(document.getElementById("verse-menu-note"));
});

test("verse menu private notes and memorization toggle round-trip through localStorage", async () => {
  const { document, root, content, marker } = setupDom();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;
  globalThis.innerWidth = 1200;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({ matches: false });
  setNavigator({ clipboard: { async writeText() {} } });

  const { mountVerseMenu } = await import(`${verseMenuUrl}?case=roundtrip`);
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  content.dispatch("click", { target: marker });

  const note = document.getElementById("verse-menu-note");
  const memorize = document.getElementById("verse-menu-memorize");
  note.value = "Synthetic device note";
  note.dispatch("input");
  memorize.checked = true;
  memorize.dispatch("change");
  menu.close();
  content.dispatch("click", { target: marker });

  assert.equal(document.getElementById("verse-menu-note").value, "Synthetic device note");
  assert.equal(document.getElementById("verse-menu-memorize").checked, true);
  const memorizeList = JSON.parse(globalThis.localStorage.getItem("bbs:memorize"));
  assert.equal(memorizeList.length, 1);
  assert.equal(memorizeList[0].ref, "1 Corinthians 13:2");
  assert.ok(memorizeList[0].addedAt);
});

test("verse menu blocks client-side invalid links before submission", async () => {
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
  const { setFirebaseLoader } = await import(`${suggestCoreUrl}?case=loader`);
  setFirebaseLoader(async () => ([
    { initializeApp(config) { return { config }; } },
    {
      getAuth() { return { currentUser: { uid: "anon-1" } }; },
      async signInAnonymously(auth) { return { user: auth.currentUser }; },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(db, name) { return { db, name }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async addDoc(collectionRef, payload) {
        calls.push({ collectionRef, payload });
      },
    },
  ]));

  const { mountVerseMenu } = await import(`${verseMenuUrl}?case=invalid-link`);
  const menu = mountVerseMenu({
    root,
    content,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  menu.bindRoute({ book: "1 Corinthians", bookSlug: "1cor", chapter: 13 });
  content.dispatch("click", { target: marker });

  document.getElementById("verse-menu-name").value = "Anna";
  document.getElementById("verse-menu-link").value = "javascript:alert(1)";
  const form = root.children[1].children[1];
  await form._listeners.submit[0]({ preventDefault() {} });

  assert.equal(calls.length, 0);
  assert.equal(document.getElementById("verse-menu-status").textContent, "Links must start with http:// or https:// and stay under 500 characters.");
});
