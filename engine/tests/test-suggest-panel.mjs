import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

class StubNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.type = "";
    this.id = "";
    this.maxLength = 0;
    this.required = false;
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
  }
  appendChild(node) {
    this.children.push(node);
    if (node.id) this.ownerDocument._byId.set(node.id, node);
    return node;
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  click() {
    for (const fn of this._listeners.click || []) fn({ preventDefault() {} });
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function makeDocument() {
  const doc = {
    _byId: new Map(),
    createElement(tag) {
      return new StubNode(tag, doc);
    },
    getElementById(id) {
      return doc._byId.get(id) || null;
    },
  };
  const root = new StubNode("div", doc);
  root.id = "suggest-root";
  doc._byId.set(root.id, root);
  return { document: doc, root };
}

function makeStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suggestPanelUrl = pathToFileURL(path.join(__dirname, "..", "src", "suggest-panel.js")).href;

test("suggest panel stays hidden when config.firebase is absent", async () => {
  const { document, root } = makeDocument();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  const { mountSuggestPanel } = await import(`${suggestPanelUrl}?case=hidden`);
  const panel = mountSuggestPanel({ root, config: {} });
  panel.showForChapter({ book: "1 Corinthians", chapter: 1 });

  assert.equal(root.hidden, true);
  assert.equal(root.children.length, 0);
});

test("suggest panel renders required fields and submits through mocked firebase", async () => {
  const { document, root } = makeDocument();
  globalThis.document = document;
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  const calls = [];
  const { mountSuggestPanel, setFirebaseLoader } = await import(`${suggestPanelUrl}?case=submit`);

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
        return { id: "doc-1" };
      },
    },
  ]));

  const panel = mountSuggestPanel({
    root,
    config: {
      firebase: {
        projectId: "bible-bowl-study",
        appId: "1:67985258231:web:4440b917054deb2829c5f2",
        apiKey: "test-key",
        authDomain: "bible-bowl-study.firebaseapp.com",
      },
    },
  });

  panel.showForChapter({ book: "1 Corinthians", chapter: 13 });
  assert.equal(root.hidden, false);

  const shell = root.children[0];
  shell.children[0].children[0].click();

  const kind = document.getElementById("suggest-kind");
  const reference = document.getElementById("suggest-reference");
  const name = document.getElementById("suggest-name");
  const text = document.getElementById("suggest-text");
  const answer = document.getElementById("suggest-answer");

  assert.ok(kind);
  assert.ok(reference);
  assert.ok(name);
  assert.equal(reference.value, "1 Corinthians 13");

  kind.value = "question_seed";
  reference.value = "1 Corinthians 13:4-7";
  name.value = "Anna";
  text.value = "Ask about the chapter's main contrast.";
  answer.value = "Love";

  const form = shell.children[1].children[0];
  for (const fn of form._listeners.submit || []) {
    await fn({ preventDefault() {} });
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].collectionRef.name, "suggestions");
  assert.equal(calls[0].payload.authorName, "Anna");
  assert.equal(calls[0].payload.reference, "1 Corinthians 13:4-7");
  assert.equal(calls[0].payload.chapter, 13);
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), "Anna");
  assert.equal(document.getElementById("suggest-success-copy").textContent, "Thanks Anna — Wes reviews these");
});
