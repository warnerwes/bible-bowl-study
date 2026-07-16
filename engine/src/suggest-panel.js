"use strict";

const AUTHOR_NAME_KEY = "bbs:authorName";
const FIREBASE_VERSION = "12.9.0";
const FIREBASE_URLS = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`,
];
const SUBMIT_TIMEOUT_MS = 6000;
const KIND_OPTIONS = [
  { value: "question_seed", label: "Quiz question idea" },
  {
    value: "memory_hook",
    label: "Memory hook — story, explanation, or teaching that makes it stick",
  },
  { value: "correction", label: "Correction" },
];

let firebaseLoader = () => Promise.all(FIREBASE_URLS.map((url) => import(url)));

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function safeName() {
  try {
    return String(localStorage.getItem(AUTHOR_NAME_KEY) || "");
  } catch {
    return "";
  }
}

function persistName(value) {
  try {
    localStorage.setItem(AUTHOR_NAME_KEY, value);
  } catch {}
}

function timeout(ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Timed out. Check your connection and try again.")), ms);
  });
}

export function setFirebaseLoader(loader) {
  firebaseLoader = typeof loader === "function"
    ? loader
    : () => Promise.all(FIREBASE_URLS.map((url) => import(url)));
}

export function mountSuggestPanel({ root, config }) {
  if (!root || !config || !config.firebase) {
    if (root) {
      root.hidden = true;
      root.textContent = "";
    }
    return { hide() {}, showForChapter() {} };
  }

  let routeInfo = null;
  let firebaseState = null;

  const shell = el("section", "reader-suggest");
  const head = el("div", "reader-suggest-head");
  const affordance = el("button", "link-btn", "💡 Suggest something from this chapter");
  affordance.type = "button";
  const chapterNote = el("p", "muted", "Ideas, corrections, and memory hooks go straight to Wes for review.");
  head.appendChild(affordance);
  head.appendChild(chapterNote);
  shell.appendChild(head);

  const card = el("div", "suggest-card");
  card.hidden = true;
  const form = el("form");

  const kindField = el("label", "suggest-field");
  kindField.appendChild(el("span", "field-label", "Suggestion type"));
  const kindSelect = el("select", "select");
  kindSelect.id = "suggest-kind";
  KIND_OPTIONS.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    kindSelect.appendChild(node);
  });
  kindField.appendChild(kindSelect);

  const referenceField = el("label", "suggest-field");
  referenceField.appendChild(el("span", "field-label", "Reference"));
  const referenceInput = el("input", "text-input");
  referenceInput.id = "suggest-reference";
  referenceInput.type = "text";
  referenceInput.maxLength = 120;
  referenceInput.required = true;
  referenceField.appendChild(referenceInput);

  const textField = el("label", "suggest-field");
  textField.appendChild(el("span", "field-label", "Suggestion"));
  const textInput = document.createElement("textarea");
  textInput.className = "text-input";
  textInput.id = "suggest-text";
  textInput.maxLength = 1000;
  textInput.required = true;
  textField.appendChild(textInput);

  const answerField = el("label", "suggest-field");
  answerField.id = "suggest-answer-field";
  answerField.appendChild(el("span", "field-label", "Suggested answer (optional)"));
  const answerInput = document.createElement("textarea");
  answerInput.className = "text-input";
  answerInput.id = "suggest-answer";
  answerInput.maxLength = 500;
  answerField.appendChild(answerInput);

  const nameField = el("label", "suggest-field");
  nameField.appendChild(el("span", "field-label", "First name"));
  const nameInput = el("input", "text-input");
  nameInput.id = "suggest-name";
  nameInput.type = "text";
  nameInput.maxLength = 40;
  nameInput.required = true;
  nameInput.value = safeName();
  nameField.appendChild(nameInput);

  const status = el("p", "muted suggest-status");
  status.id = "suggest-status";
  status.setAttribute("aria-live", "polite");

  const actions = el("div", "suggest-actions");
  const submit = el("button", "primary-btn", "Send suggestion");
  submit.type = "submit";
  const cancel = el("button", "link-btn", "Close");
  cancel.type = "button";
  actions.appendChild(submit);
  actions.appendChild(cancel);

  [kindField, referenceField, textField, answerField, nameField, status, actions]
    .forEach((node) => form.appendChild(node));
  card.appendChild(form);

  const success = el("div", "suggest-success");
  success.hidden = true;
  const successCopy = el("p");
  successCopy.id = "suggest-success-copy";
  const again = el("button", "primary-btn", "Submit another");
  again.type = "button";
  success.appendChild(successCopy);
  success.appendChild(again);
  card.appendChild(success);

  shell.appendChild(card);
  root.textContent = "";
  root.appendChild(shell);
  root.hidden = true;

  function setStatus(message, isError = false) {
    status.textContent = message || "";
    status.className = isError ? "suggest-status error" : "muted suggest-status";
  }

  function syncReference() {
    if (!routeInfo) return;
    const defaultRef = `${routeInfo.book} ${routeInfo.chapter}`;
    if (!referenceInput.value || referenceInput.value === referenceInput.dataset.defaultRef) {
      referenceInput.value = defaultRef;
    }
    referenceInput.dataset.defaultRef = defaultRef;
  }

  function syncAnswerField() {
    const isQuestion = kindSelect.value === "question_seed";
    answerField.hidden = !isQuestion;
    if (!isQuestion) answerInput.value = "";
  }

  async function ensureFirebase() {
    if (firebaseState) return firebaseState;
    const [appMod, authMod, storeMod] = await firebaseLoader();
    const app = appMod.initializeApp(config.firebase);
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
    return firebaseState;
  }

  affordance.addEventListener("click", () => {
    card.hidden = false;
    success.hidden = true;
    form.hidden = false;
    syncReference();
    syncAnswerField();
    setStatus("");
  });

  cancel.addEventListener("click", () => {
    card.hidden = true;
    setStatus("");
  });

  again.addEventListener("click", () => {
    form.hidden = false;
    success.hidden = true;
    textInput.value = "";
    answerInput.value = "";
    kindSelect.value = "question_seed";
    syncReference();
    syncAnswerField();
    setStatus("");
  });

  kindSelect.addEventListener("change", syncAnswerField);
  nameInput.addEventListener("input", () => persistName(nameInput.value.trim()));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!routeInfo) return;
    const authorName = nameInput.value.trim();
    const reference = referenceInput.value.trim();
    const text = textInput.value.trim();
    const answerText = answerInput.value.trim();
    if (!authorName || !reference || !text) {
      setStatus("Please fill in the required fields.", true);
      return;
    }
    persistName(authorName);
    submit.disabled = true;
    cancel.disabled = true;
    setStatus("Sending...");
    try {
      const firebase = await Promise.race([ensureFirebase(), timeout(SUBMIT_TIMEOUT_MS)]);
      await Promise.race([
        firebase.addDoc(firebase.collection(firebase.db, "suggestions"), {
          uid: firebase.uid || (firebase.auth.currentUser && firebase.auth.currentUser.uid) || "",
          authorName,
          kind: kindSelect.value,
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference,
          text,
          answerText: kindSelect.value === "question_seed" ? answerText : "",
          status: "new",
          createdAt: firebase.serverTimestamp(),
        }),
        timeout(SUBMIT_TIMEOUT_MS),
      ]);
      form.hidden = true;
      success.hidden = false;
      successCopy.textContent = `Thanks ${authorName} — Wes reviews these`;
      setStatus("");
    } catch (error) {
      setStatus((error && error.message) || "Could not send that suggestion. Please try again.", true);
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });

  syncAnswerField();

  return {
    hide() {
      root.hidden = true;
      card.hidden = true;
      setStatus("");
    },
    showForChapter(nextRouteInfo) {
      routeInfo = nextRouteInfo || null;
      syncReference();
      root.hidden = !routeInfo;
    },
  };
}
