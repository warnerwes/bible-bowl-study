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

function resolveFirebaseApp(appMod, firebaseConfig) {
  if (typeof appMod.getApps === "function" && typeof appMod.getApp === "function") {
    const existing = appMod.getApps().find((app) =>
      JSON.stringify(app.options || {}) === JSON.stringify(firebaseConfig || {})
    );
    return existing || appMod.initializeApp(firebaseConfig);
  }
  return appMod.initializeApp(firebaseConfig);
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
  const app = resolveFirebaseApp(appMod, firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = storeMod.getFirestore(app);
  firebaseState = {
    addDoc: storeMod.addDoc,
    auth,
    collection: storeMod.collection,
    db,
    doc: storeMod.doc,
    getDocs: storeMod.getDocs,
    orderBy: storeMod.orderBy,
    query: storeMod.query,
    serverTimestamp: storeMod.serverTimestamp,
    signInAnonymously: authMod.signInAnonymously,
    where: storeMod.where,
  };
  firebaseConfigKey = nextKey;
  return firebaseState;
}

async function ensureSignedIn(firebase) {
  if (firebase.auth.currentUser) {
    return firebase.auth.currentUser;
  }
  const cred = await firebase.signInAnonymously(firebase.auth);
  return (cred && cred.user) || firebase.auth.currentUser || null;
}

async function waitForExistingSession(firebase) {
  if (typeof firebase.auth.authStateReady === "function") {
    try {
      await firebase.auth.authStateReady();
    } catch {}
  }
  return firebase.auth.currentUser || null;
}

function normalizeDocValue(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value;
}

function normalizeSuggestionDoc(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: normalizeDocValue(data.createdAt) || "",
    reviewedAt: normalizeDocValue(data.reviewedAt) || "",
    approvedAt: normalizeDocValue(data.approvedAt) || "",
    exportedAt: normalizeDocValue(data.exportedAt) || "",
    rejectedAt: normalizeDocValue(data.rejectedAt) || "",
  };
}

function canonicalizeHttpUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Links must start with http:// or https:// and stay under 500 characters.");
  }
  if (!/^https?:$/i.test(parsed.protocol) || parsed.href.length > 500) {
    throw new Error("Links must start with http:// or https:// and stay under 500 characters.");
  }
  return parsed.href;
}

export function createSuggestionSubmitter({ config, timeoutMs = SUBMIT_TIMEOUT_MS }) {
  return async function submitSuggestion(payload) {
    const firebase = await Promise.race([ensureFirebase(config && config.firebase), timeout(timeoutMs)]);
    const authorName = String(payload && payload.authorName ? payload.authorName : "").trim();
    persistAuthorName(authorName);
    const user = await Promise.race([ensureSignedIn(firebase), timeout(timeoutMs)]);
    const url = Object.prototype.hasOwnProperty.call(payload || {}, "url")
      ? canonicalizeHttpUrl(payload.url)
      : "";
    const docPayload = {
      ...payload,
      uid: payload.uid || (user && user.uid) || (firebase.auth.currentUser && firebase.auth.currentUser.uid) || "",
      status: "new",
      createdAt: firebase.serverTimestamp(),
    };
    if (url) {
      docPayload.url = url;
    } else {
      delete docPayload.url;
    }
    const docRef = await Promise.race([
      firebase.addDoc(firebase.collection(firebase.db, "suggestions"), docPayload),
      timeout(timeoutMs),
    ]);
    return {
      authorName,
      id: docRef && docRef.id ? docRef.id : "",
      uid: docPayload.uid,
      ...(url ? { url } : {}),
    };
  };
}

export async function loadOwnChapterSuggestions({ config, book, chapter, timeoutMs = SUBMIT_TIMEOUT_MS }) {
  const firebaseConfig = config && config.firebase;
  if (!firebaseConfig) return [];
  const firebase = await Promise.race([ensureFirebase(firebaseConfig), timeout(timeoutMs)]);
  const user = await Promise.race([waitForExistingSession(firebase), timeout(timeoutMs)]);
  if (!user || !user.uid) return [];
  const snapshot = await Promise.race([
    firebase.getDocs(
      firebase.query(
        firebase.collection(firebase.db, "suggestions"),
        firebase.where("uid", "==", user.uid),
        firebase.where("book", "==", book),
        firebase.where("chapter", "==", chapter)
      )
    ),
    timeout(timeoutMs),
  ]);
  return snapshot.docs.map((doc) => normalizeSuggestionDoc(doc));
}

export function normalizeOptionalHttpUrl(value) {
  return canonicalizeHttpUrl(value);
}
