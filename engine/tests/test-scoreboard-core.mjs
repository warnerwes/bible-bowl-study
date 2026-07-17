import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scoreboardUrl = pathToFileURL(path.join(__dirname, "..", "src", "scoreboard-core.js")).href;
const firebaseUrl = pathToFileURL(path.join(__dirname, "..", "src", "firebase-client.js")).href;
const quizRenderUrl = pathToFileURL(path.join(__dirname, "..", "src", "quiz-render.js")).href;

class StubNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.hidden = false;
    this.textContent = "";
    this.innerHTML = "";
    this.value = "";
    this.type = "";
    this.id = "";
    this.name = "";
    this.maxLength = 0;
    this.required = false;
    this.autocomplete = "";
    this.attributes = {};
    this._listeners = {};
    this.style = {};
  }
  appendChild(node) {
    this.children.push(node);
    node.parentNode = this;
    if (node.id) this.ownerDocument._byId.set(node.id, node);
    return node;
  }
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  replaceChildren(...nodes) {
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  get firstChild() {
    return this.children[0] || null;
  }
}

function makeDocument(ids = []) {
  const document = {
    _byId: new Map(),
    createElement(tag) {
      return new StubNode(tag, document);
    },
    getElementById(id) {
      return document._byId.get(id) || null;
    },
  };
  const body = new StubNode("body", document);
  ids.forEach((id) => {
    const node = new StubNode("div", document);
    node.id = id;
    document._byId.set(id, node);
    body.appendChild(node);
  });
  return { document, body };
}

function makeStorage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function textTree(node) {
  return [
    node.textContent || "",
    ...node.children.flatMap((child) => textTree(child)),
  ].join(" ");
}

function findAllByClass(node, className, results = []) {
  if (String(node.className || "").split(/\s+/).includes(className)) results.push(node);
  node.children.forEach((child) => findAllByClass(child, className, results));
  return results;
}

function makeScoreDoc(id, data) {
  return {
    id,
    data() {
      return data;
    },
  };
}

test("computeMasterySnapshot ignores removed ids and malformed stats", async () => {
  const { computeMasterySnapshot } = await import(`${scoreboardUrl}?case=compute`);
  const snapshot = computeMasterySnapshot({
    questions: [{ id: "keep-1" }, { id: "keep-2" }, { id: "keep-2" }],
    stats: {
      "keep-1": { streak: 3 },
      "keep-2": { streak: 2 },
      "removed-9": { streak: 99 },
      broken: "bad",
    },
    masteryStreak: 3,
  });

  assert.deepEqual(snapshot, { mastered: 1, total: 2 });
});

test("scoreboard load does not write before opt-in and renders only the join prompt", async () => {
  const { document } = makeDocument(["results-scoreboard"]);
  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.localStorage = makeStorage({ "bbs:authorName": "Anna" });

  let setDocCalls = 0;
  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=pre-optin`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() {
        return { currentUser: { uid: "student-1" }, async authStateReady() {} };
      },
      browserLocalPersistence: { mode: "local" },
      async setPersistence() {},
      async signInAnonymously() {
        return { user: { uid: "student-1" } };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(_db, name) { return { name }; },
      query(...parts) { return parts; },
      orderBy(field, direction) { return { field, direction }; },
      limit(value) { return { limit: value }; },
      doc(_db, ref) { return { ref }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async setDoc() {
        setDocCalls += 1;
      },
      async getDocs() {
        return { docs: [] };
      },
    },
  ]));

  const { mountResultsScoreboard } = await import(`${scoreboardUrl}?case=pre-optin`);
  const root = document.getElementById("results-scoreboard");
  await mountResultsScoreboard({
    root,
    config: { firebase: { projectId: "bible-bowl-study" } },
    storage: {
      masteryStreak: 3,
      all() {
        return {
          "keep-1": { streak: 3 },
          "old-removed": { streak: 10 },
        };
      },
    },
    questions: [{ id: "keep-1" }, { id: "keep-2" }],
  }).load();

  assert.equal(setDocCalls, 0);
  assert.match(textTree(root), /Mastered: 1/);
  assert.ok(document.getElementById("scoreboard-name"));
  assert.equal(textTree(root).includes("No one on the scoreboard yet"), false);
});

test("scoreboard sync renders sorted rows and highlights the current student", async () => {
  const { document } = makeDocument(["results-scoreboard"]);
  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.localStorage = makeStorage({
    "bbs:authorName": "Beth",
    "bbs:scoreboardOptIn:v1": "1",
  });

  const writes = [];
  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=sorted-rows`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() {
        return { currentUser: { uid: "student-2" }, async authStateReady() {} };
      },
      browserLocalPersistence: { mode: "local" },
      async setPersistence() {},
      async signInAnonymously() {
        return { user: { uid: "student-2" } };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(_db, name) { return { name }; },
      query(...parts) { return parts; },
      orderBy(field, direction) { return { field, direction }; },
      limit(value) { return { limit: value }; },
      doc(_db, ref) { return { ref }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async setDoc(ref, payload) {
        writes.push({ ref, payload });
      },
      async getDocs() {
        return {
          docs: [
            makeScoreDoc("student-3", { authorName: "Cara", mastered: 4, total: 20, updatedAt: "2026-07-17T08:00:00.000Z" }),
            makeScoreDoc("student-2", { authorName: "Beth", mastered: 4, total: 20, updatedAt: "2026-07-17T07:00:00.000Z" }),
            makeScoreDoc("student-1", { authorName: "Anna", mastered: 5, total: 20, updatedAt: "2026-07-17T09:00:00.000Z" }),
          ],
        };
      },
    },
  ]));

  const { mountResultsScoreboard } = await import(`${scoreboardUrl}?case=sorted-rows`);
  const root = document.getElementById("results-scoreboard");
  await mountResultsScoreboard({
    root,
    config: { firebase: { projectId: "bible-bowl-study" } },
    storage: {
      masteryStreak: 3,
      all() {
        return { "keep-1": { streak: 3 } };
      },
    },
    questions: [{ id: "keep-1" }],
  }).load();

  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.mastered, 1);

  const rows = findAllByClass(root, "scoreboard-row");
  assert.equal(rows.length, 3);
  assert.match(textTree(rows[0]), /Anna/);
  assert.match(textTree(rows[1]), /Beth/);
  assert.match(textTree(rows[2]), /Cara/);
  assert.ok(String(rows[1].className).includes("is-self"));
});

test("scoreboard join prompt prefills a google first name and stays editable", async () => {
  const { document } = makeDocument(["results-scoreboard"]);
  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.localStorage = makeStorage();

  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=google-prefill-prompt`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() {
        return {
          currentUser: {
            uid: "student-7",
            displayName: "Mary Beth Johnson",
            providerData: [{ providerId: "google.com" }],
          },
          async authStateReady() {},
        };
      },
      browserLocalPersistence: { mode: "local" },
      async setPersistence() {},
      async signInAnonymously() {
        return { user: { uid: "student-7" } };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(_db, name) { return { name }; },
      query(...parts) { return parts; },
      orderBy(field, direction) { return { field, direction }; },
      limit(value) { return { limit: value }; },
      doc(_db, ref) { return { ref }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async setDoc() {},
      async getDocs() {
        return { docs: [] };
      },
    },
  ]));

  const { mountResultsScoreboard } = await import(`${scoreboardUrl}?case=google-prefill-prompt`);
  const root = document.getElementById("results-scoreboard");
  const api = mountResultsScoreboard({
    root,
    config: { firebase: { projectId: "bible-bowl-study" } },
    storage: {
      masteryStreak: 3,
      all() {
        return { "keep-1": { streak: 3 } };
      },
    },
    questions: [{ id: "keep-1" }],
  });

  await api.load();

  const input = document.getElementById("scoreboard-name");
  assert.ok(input);
  assert.equal(input.value, "Mary");
  assert.equal(input.required, true);
  input.value = "Mimi";
  const form = findAllByClass(root, "scoreboard-join")[0];
  await form._listeners.submit[0]({ preventDefault() {} });
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), "Mimi");
});

test("quiz render keeps firebase unloaded until results", async () => {
  const ids = [
    "setup", "quiz", "results", "result-score", "missed-review", "results-scoreboard",
  ];
  const { document } = makeDocument(ids);
  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.localStorage = makeStorage();
  let loaderCalls = 0;
  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=no-firebase-before-results`);
  setFirebaseLoader(async () => {
      loaderCalls += 1;
      return [
        {
          getApps() { return []; },
          initializeApp(config) { return { options: config }; },
        },
        {
          getAuth() {
            return { currentUser: { uid: "student-9" }, async authStateReady() {} };
          },
          browserLocalPersistence: { mode: "local" },
          async setPersistence() {},
          async signInAnonymously() {
            return { user: { uid: "student-9" } };
          },
        },
        {
          getFirestore() { return { name: "db" }; },
          collection(_db, name) { return { name }; },
          query(...parts) { return parts; },
          orderBy(field, direction) { return { field, direction }; },
          limit(value) { return { limit: value }; },
          doc(_db, ref) { return { ref }; },
          serverTimestamp() { return "SERVER_TIME"; },
          async setDoc() {},
          async getDocs() { return { docs: [] }; },
        },
      ];
    });
  const { createQuiz } = await import(`${quizRenderUrl}?case=no-firebase-before-results`);
  const quiz = createQuiz({
    state: {
      index: 0,
      answered: true,
      quiz: [{ id: "keep-1" }],
      score: 1,
      missed: [],
      all: [{ id: "keep-1" }],
    },
    storage: {
      masteryStreak: 3,
      all() {
        return {};
      },
    },
    config: { firebase: { projectId: "bible-bowl-study" } },
    weightedOrder(list) {
      return list;
    },
  });

  assert.equal(loaderCalls, 0);
  quiz.showResults();
  assert.equal(loaderCalls, 0);

  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(loaderCalls, 1);
});
