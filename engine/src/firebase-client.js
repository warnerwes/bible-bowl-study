"use strict";

const FIREBASE_VERSION = "12.9.0";
const FIREBASE_URLS = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`,
];

const sharedState = globalThis.__bbsFirebaseClientState || {
  firebaseLoader: () => Promise.all(FIREBASE_URLS.map((url) => import(url))),
  firebaseState: null,
  firebaseConfigKey: "",
};
globalThis.__bbsFirebaseClientState = sharedState;

export function setFirebaseLoader(loader) {
  sharedState.firebaseLoader = typeof loader === "function"
    ? loader
    : () => Promise.all(FIREBASE_URLS.map((url) => import(url)));
  sharedState.firebaseState = null;
  sharedState.firebaseConfigKey = "";
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

export async function ensureFirebase(firebaseConfig) {
  if (!firebaseConfig) {
    throw new Error("Suggestions are unavailable right now.");
  }
  const nextKey = JSON.stringify(firebaseConfig);
  if (sharedState.firebaseState && sharedState.firebaseConfigKey === nextKey) {
    return sharedState.firebaseState;
  }

  const [appMod, authMod, storeMod] = await sharedState.firebaseLoader();
  const app = resolveFirebaseApp(appMod, firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = storeMod.getFirestore(app);
  sharedState.firebaseState = {
    addDoc: storeMod.addDoc,
    auth,
    browserLocalPersistence: authMod.browserLocalPersistence,
    browserSessionPersistence: authMod.browserSessionPersistence,
    collection: storeMod.collection,
    db,
    doc: storeMod.doc,
    getDoc: storeMod.getDoc,
    getDocs: storeMod.getDocs,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    limit: storeMod.limit,
    onAuthStateChanged: authMod.onAuthStateChanged,
    orderBy: storeMod.orderBy,
    query: storeMod.query,
    serverTimestamp: storeMod.serverTimestamp,
    setDoc: storeMod.setDoc,
    setPersistence: authMod.setPersistence,
    signInAnonymously: authMod.signInAnonymously,
    signInWithPopup: authMod.signInWithPopup,
    signOut: authMod.signOut,
    where: storeMod.where,
  };
  sharedState.firebaseConfigKey = nextKey;
  return sharedState.firebaseState;
}
