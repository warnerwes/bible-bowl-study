"use strict";

import {
  createSuggestionSubmitter,
  persistAuthorName,
  readAuthorName,
  readStoredJson,
  resolveAuthorName,
  setFirebaseLoader,
  writeStoredJson,
} from "./suggest-core.js";

const DRAFT_KEY = "bbs:suggest-panel:draft";
const KIND_OPTIONS = [
  { value: "question_seed", label: "Quiz question idea" },
  {
    value: "memory_hook",
    label: "Memory hook — story, explanation, or teaching that makes it stick",
  },
  { value: "correction", label: "Correction" },
];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function readDraft() {
  const draft = readStoredJson(DRAFT_KEY, {});
  return draft && typeof draft === "object" ? draft : {};
}

function writeDraft(nextDraft) {
  writeStoredJson(DRAFT_KEY, nextDraft);
}

export { setFirebaseLoader };

export function mountSuggestPanel({ root, config }) {
  if (!root || !config || !config.firebase) {
    if (root) {
      root.hidden = true;
      root.textContent = "";
    }
    return { hide() {}, showForChapter() {} };
  }

  let routeInfo = null;
  const submitSuggestion = createSuggestionSubmitter({ config });

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
  nameInput.value = readAuthorName();
  nameField.appendChild(nameInput);

  void resolveAuthorName({ config }).then((authorName) => {
    if (!authorName || nameInput.value.trim()) return;
    nameInput.value = authorName;
  });

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

  function saveDraft() {
    writeDraft({
      kind: kindSelect.value,
      reference: referenceInput.value,
      text: textInput.value,
      answerText: answerInput.value,
      authorName: nameInput.value,
    });
  }

  function restoreDraft() {
    const draft = readDraft();
    kindSelect.value = draft.kind || "question_seed";
    referenceInput.value = draft.reference || "";
    textInput.value = draft.text || "";
    answerInput.value = draft.answerText || "";
    nameInput.value = draft.authorName || readAuthorName();
    syncReference();
    syncAnswerField();
  }

  affordance.addEventListener("click", () => {
    card.hidden = false;
    success.hidden = true;
    form.hidden = false;
    restoreDraft();
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
    saveDraft();
    setStatus("");
  });

  [kindSelect, referenceInput, textInput, answerInput, nameInput].forEach((node) => {
    node.addEventListener("input", () => {
      if (node === nameInput) persistAuthorName(nameInput.value.trim());
      saveDraft();
    });
  });
  kindSelect.addEventListener("change", () => {
    syncAnswerField();
    saveDraft();
  });

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

    submit.disabled = true;
    cancel.disabled = true;
    setStatus("Sending...");
    try {
      await submitSuggestion({
        authorName,
        kind: kindSelect.value,
        book: routeInfo.book,
        chapter: routeInfo.chapter,
        reference,
        text,
        answerText: kindSelect.value === "question_seed" ? answerText : "",
      });
      form.hidden = true;
      success.hidden = false;
      successCopy.textContent = `Thanks ${authorName} — Wes reviews these`;
      textInput.value = "";
      answerInput.value = "";
      saveDraft();
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
