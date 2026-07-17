import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suggestCoreUrl = pathToFileURL(path.join(__dirname, "..", "src", "suggest-core.js")).href;

function makeStorage() {
  const store = new Map();
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

test("suggestions keep a signed-in google uid and do not force anonymous sign-in", async () => {
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  let signInCalls = 0;
  const { createSuggestionSubmitter, setFirebaseLoader } = await import(`${suggestCoreUrl}?case=google-user`);
  setFirebaseLoader(async () => ([
    { getApps() { return []; }, initializeApp(config) { return { options: config }; } },
    {
      getAuth() {
        return {
          currentUser: {
            uid: "google-uid",
            providerData: [{ providerId: "google.com" }],
          },
        };
      },
      browserLocalPersistence: { mode: "local" },
      async setPersistence() {},
      async signInAnonymously() {
        signInCalls += 1;
        return { user: { uid: "anon-uid" } };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(_db, name) { return { name }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async addDoc(_collectionRef, payload) {
        return { id: payload.uid };
      },
    },
  ]));

  const submitSuggestion = createSuggestionSubmitter({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  const result = await submitSuggestion({
    authorName: "Anna",
    kind: "question_seed",
    book: "1 Corinthians",
    chapter: 5,
    reference: "1 Corinthians 5",
    text: "Ask the contrast question.",
    answerText: "Answer",
  });

  assert.equal(signInCalls, 0);
  assert.equal(result.uid, "google-uid");
});

test("anonymous suggestion submitters switch to a local anonymous session", async () => {
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  const calls = [];
  const auth = { currentUser: null };
  const { createSuggestionSubmitter, setFirebaseLoader } = await import(`${suggestCoreUrl}?case=anon-user`);
  setFirebaseLoader(async () => ([
    { getApps() { return []; }, initializeApp(config) { return { options: config }; } },
    {
      getAuth() {
        return auth;
      },
      browserLocalPersistence: { mode: "local" },
      async setPersistence(_auth, persistence) {
        calls.push(persistence.mode);
      },
      async signInAnonymously() {
        auth.currentUser = { uid: "anon-uid", isAnonymous: true, providerData: [] };
        return { user: auth.currentUser };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
      collection(_db, name) { return { name }; },
      serverTimestamp() { return "SERVER_TIME"; },
      async addDoc(_collectionRef, payload) {
        return { id: payload.uid };
      },
    },
  ]));

  const submitSuggestion = createSuggestionSubmitter({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  const result = await submitSuggestion({
    authorName: "Anna",
    kind: "memory_hook",
    book: "1 Corinthians",
    chapter: 5,
    reference: "1 Corinthians 5",
    text: "Remember the contrast.",
    answerText: "",
  });

  assert.equal(result.uid, "anon-uid");
  assert.deepEqual(calls, ["local"]);
});

test("resolveAuthorName stores the first word for signed-in google users", async () => {
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  const { resolveAuthorName, setFirebaseLoader } = await import(`${suggestCoreUrl}?case=google-prefill`);
  setFirebaseLoader(async () => ([
    { getApps() { return []; }, initializeApp(config) { return { options: config }; } },
    {
      getAuth() {
        return {
          currentUser: {
            uid: "google-uid",
            displayName: "Mary Beth Johnson",
            providerData: [{ providerId: "google.com" }],
            async authStateReady() {},
          },
        };
      },
      browserLocalPersistence: { mode: "local" },
    },
    {
      getFirestore() { return { name: "db" }; },
    },
  ]));

  const result = await resolveAuthorName({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });

  assert.equal(result, "Mary");
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), "Mary");
});

test("resolveAuthorName keeps an existing stored name instead of a google prefill", async () => {
  globalThis.localStorage = makeStorage();
  globalThis.localStorage.setItem("bbs:authorName", "Mimi");
  globalThis.window = globalThis;

  let loaderCalls = 0;
  const { resolveAuthorName, setFirebaseLoader } = await import(`${suggestCoreUrl}?case=stored-precedence`);
  setFirebaseLoader(async () => {
    loaderCalls += 1;
    return [
      { getApps() { return []; }, initializeApp(config) { return { options: config }; } },
      {
        getAuth() {
          return {
            currentUser: {
              uid: "google-uid",
              displayName: "Mary Beth Johnson",
              providerData: [{ providerId: "google.com" }],
              async authStateReady() {},
            },
          };
        },
      },
      {
        getFirestore() { return { name: "db" }; },
      },
    ];
  });

  const result = await resolveAuthorName({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });

  assert.equal(result, "Mimi");
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), "Mimi");
  assert.equal(loaderCalls, 0);
});

test("resolveAuthorName leaves anonymous users unchanged", async () => {
  globalThis.localStorage = makeStorage();
  globalThis.window = globalThis;

  const { resolveAuthorName, setFirebaseLoader } = await import(`${suggestCoreUrl}?case=anonymous-unchanged`);
  setFirebaseLoader(async () => ([
    { getApps() { return []; }, initializeApp(config) { return { options: config }; } },
    {
      getAuth() {
        return {
          currentUser: {
            uid: "anon-uid",
            isAnonymous: true,
            displayName: "Anon Child",
            providerData: [],
            async authStateReady() {},
          },
        };
      },
    },
    {
      getFirestore() { return { name: "db" }; },
    },
  ]));

  const result = await resolveAuthorName({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });

  assert.equal(result, "");
  assert.equal(globalThis.localStorage.getItem("bbs:authorName"), null);
});
