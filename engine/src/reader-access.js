"use strict";

import { ensureFirebase } from "./firebase-client.js";

function isGoogleUser(user) {
  return !!(user && Array.isArray(user.providerData)
    && user.providerData.some((entry) => entry && entry.providerId === "google.com"));
}

function getDisplayName(user) {
  const name = String(user && user.displayName ? user.displayName : "").trim();
  return name || "Google reader";
}

function buildState(user) {
  if (isGoogleUser(user)) {
    return {
      kind: "google",
      name: getDisplayName(user),
      user,
    };
  }
  if (user && user.isAnonymous) {
    return {
      kind: "anonymous",
      name: "",
      user,
    };
  }
  return {
    kind: "signed_out",
    name: "",
    user: null,
  };
}

function signInErrorMessage() {
  return "Google sign-in did not complete. You can keep reading on Bible Gateway.";
}

export function createReaderAccess({ config, onChange = () => {} }) {
  let firebasePromise = null;
  let unsubscribe = () => {};

  async function loadFirebase() {
    firebasePromise ||= ensureFirebase(config && config.firebase);
    return firebasePromise;
  }

  async function init() {
    const firebase = await loadFirebase();
    if (typeof firebase.auth.authStateReady === "function") {
      try {
        await firebase.auth.authStateReady();
      } catch {}
    }
    const state = buildState(firebase.auth.currentUser);
    onChange(state);
    if (typeof firebase.onAuthStateChanged === "function") {
      unsubscribe = firebase.onAuthStateChanged(firebase.auth, (user) => {
        onChange(buildState(user));
      });
    }
    return state;
  }

  async function signIn() {
    const firebase = await loadFirebase();
    const priorAnonymous = !!firebase.auth.currentUser?.isAnonymous;
    await firebase.setPersistence(firebase.auth, firebase.browserSessionPersistence);
    try {
      const provider = new firebase.GoogleAuthProvider();
      const credential = await firebase.signInWithPopup(firebase.auth, provider);
      const state = buildState((credential && credential.user) || firebase.auth.currentUser);
      onChange(state);
      return state;
    } catch (error) {
      if (priorAnonymous || firebase.auth.currentUser?.isAnonymous) {
        try {
          await firebase.setPersistence(firebase.auth, firebase.browserLocalPersistence);
        } catch {}
      }
      throw new Error(signInErrorMessage(error));
    }
  }

  async function signOutUser() {
    const firebase = await loadFirebase();
    await firebase.signOut(firebase.auth);
    try {
      await firebase.setPersistence(firebase.auth, firebase.browserLocalPersistence);
    } catch {}
    const state = buildState(firebase.auth.currentUser);
    onChange(state);
    return state;
  }

  async function getIdToken() {
    const firebase = await loadFirebase();
    const user = firebase.auth.currentUser;
    if (!isGoogleUser(user) || typeof user.getIdToken !== "function") {
      return "";
    }
    return user.getIdToken();
  }

  return {
    dispose() {
      unsubscribe();
    },
    getIdToken,
    init,
    signIn,
    signOut: signOutUser,
  };
}
