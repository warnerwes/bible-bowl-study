import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const accessUrl = pathToFileURL(path.join(__dirname, "..", "src", "reader-access.js")).href;
const firebaseUrl = pathToFileURL(path.join(__dirname, "..", "src", "firebase-client.js")).href;

test("reader access signs in with session persistence and exposes google identity", async () => {
  const calls = [];
  const auth = {
    currentUser: null,
    async authStateReady() {},
  };

  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=google-sign-in`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() { return auth; },
      browserLocalPersistence: { mode: "local" },
      browserSessionPersistence: { mode: "session" },
      GoogleAuthProvider: class {},
      async setPersistence(_auth, persistence) {
        calls.push(persistence.mode);
      },
      async signInWithPopup() {
        auth.currentUser = {
          displayName: "Anna",
          providerData: [{ providerId: "google.com" }],
          async getIdToken() { return "google-token"; },
        };
        return { user: auth.currentUser };
      },
      async signOut() {
        auth.currentUser = null;
      },
      onAuthStateChanged(_auth, callback) {
        callback(auth.currentUser);
        return () => {};
      },
    },
    {
      getFirestore() { return {}; },
    },
  ]));

  const states = [];
  const { createReaderAccess } = await import(`${accessUrl}?case=google-sign-in`);
  const access = createReaderAccess({
    config: { firebase: { projectId: "bible-bowl-study" } },
    onChange(state) {
      states.push(state.kind);
    },
  });

  const initial = await access.init();
  assert.equal(initial.kind, "signed_out");

  const signedIn = await access.signIn();
  assert.equal(signedIn.kind, "google");
  assert.equal(signedIn.name, "Anna");
  assert.equal(await access.getIdToken(), "google-token");
  assert.equal(calls[0], "session");
  assert.ok(states.includes("google"));
});

test("reader access restores local persistence when popup sign-in fails for an anonymous user", async () => {
  const calls = [];
  const anonymousUser = {
    isAnonymous: true,
    providerData: [],
  };
  const auth = {
    currentUser: anonymousUser,
    async authStateReady() {},
  };

  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=popup-fail`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() { return auth; },
      browserLocalPersistence: { mode: "local" },
      browserSessionPersistence: { mode: "session" },
      GoogleAuthProvider: class {},
      async setPersistence(_auth, persistence) {
        calls.push(persistence.mode);
      },
      async signInWithPopup() {
        throw new Error("popup-blocked");
      },
      async signOut() {},
      onAuthStateChanged() {
        return () => {};
      },
    },
    {
      getFirestore() { return {}; },
    },
  ]));

  const { createReaderAccess } = await import(`${accessUrl}?case=popup-fail`);
  const access = createReaderAccess({
    config: { firebase: { projectId: "bible-bowl-study" } },
  });

  await access.init();
  await assert.rejects(() => access.signIn(), /Google sign-in did not complete/);
  assert.deepEqual(calls, ["session", "local"]);
});
