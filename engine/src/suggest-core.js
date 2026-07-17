"use strict";

export const AUTHOR_NAME_KEY = "bbs:authorName";
export const SUBMIT_TIMEOUT_MS = 6000;

const FIREBASE_VERSION = "12.9.0";
const FIREBASE_URLS = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`,
];

let firebaseLoader = () => Promise.all(FIREBASE_URLS.map((url) => import(url)));
let firebaseState = null;
let firebaseConfigKey = "";

export function setFirebaseLoader(loader) {
  firebaseLoader = typeof loader === "function"
    ? loader
    : () => Promise.all(FIREBASE_URLS.map((url) => import(url)));
  firebaseState = null;
  firebaseConfigKey = "";
}

export function readStoredText(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : String(value);
  } catch {
    return fallback;
  }
}

export function writeStoredText(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

export function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function readStoredJson(key, fallback) {
  const raw = readStoredText(key, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  writeStoredText(key, JSON.stringify(value));
}

export function readAuthorName() {
  return readStoredText(AUTHOR_NAME_KEY, "");
}

export function persistAuthorName(value) {
  writeStoredText(AUTHOR_NAME_KEY, value || "");
}

function timeout(ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Timed out. Check your connection and try again.")), ms);
  });
}

async function ensureFirebase(firebaseConfig) {
  if (!firebaseConfig) {
    throw new Error("Suggestions are unavailable right now.");
  }
  const nextKey = JSON.stringify(firebaseConfig);
  if (firebaseState && firebaseConfigKey === nextKey) {
    return firebaseState;
  }

  const [appMod, authMod, storeMod] = await firebaseLoader();
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = storeMod.getFirestore(app);
  const cred = await authMod.signInAnonymously(auth);
  firebaseState = {
    addDoc: storeMod.addDoc,
    auth,
    collection: storeMod.collection,
    db,
    serverTimestamp: storeMod.serverTimestamp,
    uid: (cred && cred.user && cred.user.uid) || (auth.currentUser && auth.currentUser.uid) || "",
  };
  firebaseConfigKey = nextKey;
  return firebaseState;
}

export function createSuggestionSubmitter({ config, timeoutMs = SUBMIT_TIMEOUT_MS }) {
  return async function submitSuggestion(payload) {
    const firebase = await Promise.race([ensureFirebase(config && config.firebase), timeout(timeoutMs)]);
    const authorName = String(payload && payload.authorName ? payload.authorName : "").trim();
    persistAuthorName(authorName);
    await Promise.race([
      firebase.addDoc(firebase.collection(firebase.db, "suggestions"), {
        ...payload,
        uid: payload.uid || firebase.uid || (firebase.auth.currentUser && firebase.auth.currentUser.uid) || "",
        status: "new",
        createdAt: firebase.serverTimestamp(),
      }),
      timeout(timeoutMs),
    ]);
    return { authorName };
  };
}
