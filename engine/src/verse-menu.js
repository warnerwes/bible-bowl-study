"use strict";

import {
  createSuggestionSubmitter,
  persistAuthorName,
  readAuthorName,
  readStoredJson,
  readStoredText,
  removeStoredValue,
  writeStoredJson,
  writeStoredText,
} from "./suggest-core.js";

const MEMORIZE_KEY = "bbs:memorize";

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function noteKey(routeInfo, verse) {
  return `bbs:note:${routeInfo.bookSlug}:${routeInfo.chapter}:${verse}`;
}

function isValidLink(value) {
  return /^https?:\/\/.+/i.test(String(value || "")) && String(value || "").length <= 500;
}

function loadMemorizeList() {
  const list = readStoredJson(MEMORIZE_KEY, []);
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.ref === "string") : [];
}

function saveMemorizeList(list) {
  writeStoredJson(MEMORIZE_KEY, list);
}

export function mountVerseMenu({ root, content, config }) {
  if (!root || !content || !config || !config.firebase) {
    return { close() {}, bindRoute() {} };
  }

  let routeInfo = null;
  let currentVerse = 0;
  let currentMarker = null;
  let lastFocused = null;
  let activeTrap = null;
  const submitSuggestion = createSuggestionSubmitter({ config });

  const overlay = el("div", "verse-menu-overlay");
  overlay.hidden = true;
  const dialog = el("section", "verse-menu");
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "verse-menu-title");

  const head = el("div", "verse-menu-head");
  const title = el("h2", "verse-menu-title");
  title.id = "verse-menu-title";
  const copyRef = el("button", "link-btn", "Copy reference");
  copyRef.type = "button";
  const closeBtn = el("button", "link-btn", "Close");
  closeBtn.type = "button";
  head.appendChild(title);
  head.appendChild(copyRef);
  head.appendChild(closeBtn);

  const form = el("form", "verse-menu-form");
  const nameField = el("label", "suggest-field");
  nameField.appendChild(el("span", "field-label", "First name"));
  const nameInput = el("input", "text-input");
  nameInput.id = "verse-menu-name";
  nameInput.type = "text";
  nameInput.maxLength = 40;
  nameInput.required = true;
  nameInput.value = readAuthorName();
  nameField.appendChild(nameInput);

  const questionField = el("label", "suggest-field");
  questionField.appendChild(el("span", "field-label", "Quiz question idea"));
  const questionInput = document.createElement("textarea");
  questionInput.className = "text-input";
  questionInput.id = "verse-menu-question";
  questionInput.maxLength = 1000;
  questionField.appendChild(questionInput);

  const answerField = el("label", "suggest-field");
  answerField.appendChild(el("span", "field-label", "Suggested answer (optional)"));
  const answerInput = el("input", "text-input");
  answerInput.id = "verse-menu-answer";
  answerInput.type = "text";
  answerInput.maxLength = 500;
  answerField.appendChild(answerInput);

  const factField = el("label", "suggest-field");
  factField.appendChild(el("span", "field-label", "Surprising fact"));
  const factInput = document.createElement("textarea");
  factInput.className = "text-input";
  factInput.id = "verse-menu-fact";
  factInput.maxLength = 1000;
  factField.appendChild(factInput);

  const linkField = el("label", "suggest-field");
  linkField.appendChild(el("span", "field-label", "Link to something interesting (we'll mine it later)"));
  const linkInput = el("input", "text-input");
  linkInput.id = "verse-menu-link";
  linkInput.type = "url";
  linkInput.maxLength = 500;
  linkInput.inputMode = "url";
  linkField.appendChild(linkInput);

  const noteField = el("label", "suggest-field");
  noteField.appendChild(el("span", "field-label", "Private note (stays on this device)"));
  const noteInput = document.createElement("textarea");
  noteInput.className = "text-input";
  noteInput.id = "verse-menu-note";
  noteInput.maxLength = 2000;
  noteField.appendChild(noteInput);

  const memorizeField = el("label", "verse-menu-memorize");
  const memorizeToggle = document.createElement("input");
  memorizeToggle.id = "verse-menu-memorize";
  memorizeToggle.type = "checkbox";
  memorizeField.appendChild(memorizeToggle);
  memorizeField.appendChild(el("span", "", "⭐ Mark for memorization"));

  const status = el("p", "muted suggest-status");
  status.id = "verse-menu-status";
  status.setAttribute("aria-live", "polite");

  const actions = el("div", "suggest-actions");
  const submit = el("button", "primary-btn", "Submit filled suggestions");
  submit.type = "submit";
  actions.appendChild(submit);

  [
    nameField,
    questionField,
    answerField,
    factField,
    linkField,
    noteField,
    memorizeField,
    status,
    actions,
  ].forEach((node) => form.appendChild(node));

  dialog.appendChild(head);
  dialog.appendChild(form);
  root.textContent = "";
  root.appendChild(overlay);
  root.appendChild(dialog);

  function setStatus(message, isError = false) {
    status.textContent = message || "";
    status.className = isError ? "suggest-status error" : "muted suggest-status";
  }

  function verseReference(verse) {
    return `${routeInfo.book} ${routeInfo.chapter}:${verse}`;
  }

  function loadNote(verse) {
    return readStoredText(noteKey(routeInfo, verse), "");
  }

  function saveNote(verse, value) {
    const trimmed = String(value || "");
    if (!trimmed) {
      removeStoredValue(noteKey(routeInfo, verse));
      return;
    }
    writeStoredText(noteKey(routeInfo, verse), trimmed);
  }

  function hasMemorized(ref) {
    return loadMemorizeList().some((entry) => entry.ref === ref);
  }

  function setMemorized(ref, selected) {
    const list = loadMemorizeList().filter((entry) => entry.ref !== ref);
    if (selected) {
      list.push({ ref, addedAt: new Date().toISOString() });
    }
    saveMemorizeList(list);
  }

  function focusables() {
    return [
      copyRef,
      closeBtn,
      nameInput,
      questionInput,
      answerInput,
      factInput,
      linkInput,
      noteInput,
      memorizeToggle,
      submit,
    ].filter((node) => node && !node.disabled && !node.hidden);
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !dialog || dialog.hidden) return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      api.close();
      return;
    }
    trapFocus(event);
  }

  function positionNearMarker(marker) {
    if (!marker || typeof marker.getBoundingClientRect !== "function") return;
    const rect = marker.getBoundingClientRect();
    const narrow = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    if (narrow) {
      dialog.style.left = "";
      dialog.style.top = "";
      dialog.style.right = "";
      return;
    }
    const left = Math.max(16, Math.min(window.innerWidth - 380, rect.left + window.scrollX));
    const top = rect.bottom + window.scrollY + 12;
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
    dialog.style.right = "auto";
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(verseReference(currentVerse));
      setStatus("Reference copied.");
    } catch {
      setStatus("Could not copy the reference.", true);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!routeInfo || !currentVerse) return;

    const authorName = nameInput.value.trim();
    const questionText = questionInput.value.trim();
    const answerText = answerInput.value.trim();
    const factText = factInput.value.trim();
    const linkUrl = linkInput.value.trim();
    const reference = verseReference(currentVerse);

    if (!authorName) {
      setStatus("Please enter your first name.", true);
      return;
    }
    if (!questionText && !factText && !linkUrl) {
      setStatus("Fill at least one suggestion field before submitting.", true);
      return;
    }
    if (linkUrl && !isValidLink(linkUrl)) {
      setStatus("Links must start with http:// or https:// and stay under 500 characters.", true);
      return;
    }

    persistAuthorName(authorName);
    submit.disabled = true;
    closeBtn.disabled = true;
    copyRef.disabled = true;
    setStatus("Sending...");

    try {
      const submissions = [];
      if (questionText) {
        submissions.push(submitSuggestion({
          authorName,
          kind: "question_seed",
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference,
          text: questionText,
          answerText,
        }));
      }
      if (factText) {
        submissions.push(submitSuggestion({
          authorName,
          kind: "surprising_fact",
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference,
          text: factText,
          answerText: "",
        }));
      }
      if (linkUrl) {
        submissions.push(submitSuggestion({
          authorName,
          kind: "link",
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference,
          text: linkUrl,
          url: linkUrl,
          answerText: "",
        }));
      }
      await Promise.all(submissions);
      questionInput.value = "";
      answerInput.value = "";
      factInput.value = "";
      linkInput.value = "";
      setStatus(`Thanks ${authorName} — Wes reviews these.`);
    } catch (error) {
      setStatus((error && error.message) || "Could not send that suggestion. Please try again.", true);
    } finally {
      submit.disabled = false;
      closeBtn.disabled = false;
      copyRef.disabled = false;
    }
  }

  function openForMarker(marker, verse) {
    if (!routeInfo) return;
    currentVerse = verse;
    currentMarker = marker;
    lastFocused = document.activeElement || marker;
    title.textContent = verseReference(verse);
    noteInput.value = loadNote(verse);
    memorizeToggle.checked = hasMemorized(verseReference(verse));
    overlay.hidden = false;
    dialog.hidden = false;
    positionNearMarker(marker);
    setStatus("");
    if (activeTrap) document.removeEventListener("keydown", activeTrap);
    activeTrap = onKeydown;
    document.addEventListener("keydown", activeTrap);
    nameInput.focus();
  }

  overlay.addEventListener("click", () => api.close());
  closeBtn.addEventListener("click", () => api.close());
  copyRef.addEventListener("click", () => void copyReference());
  form.addEventListener("submit", (event) => void handleSubmit(event));
  nameInput.addEventListener("input", () => persistAuthorName(nameInput.value.trim()));
  noteInput.addEventListener("input", () => {
    if (routeInfo && currentVerse) saveNote(currentVerse, noteInput.value);
  });
  memorizeToggle.addEventListener("change", () => {
    if (routeInfo && currentVerse) setMemorized(verseReference(currentVerse), memorizeToggle.checked);
  });
  content.addEventListener("click", (event) => {
    const marker = event.target && typeof event.target.closest === "function"
      ? event.target.closest(".verse-marker")
      : null;
    if (!marker) return;
    const verse = Number(marker.getAttribute("data-verse"));
    if (!Number.isInteger(verse) || verse < 1) return;
    openForMarker(marker, verse);
  });

  const api = {
    close() {
      overlay.hidden = true;
      dialog.hidden = true;
      setStatus("");
      if (activeTrap) {
        document.removeEventListener("keydown", activeTrap);
        activeTrap = null;
      }
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      } else if (currentMarker && typeof currentMarker.focus === "function") {
        currentMarker.focus();
      }
    },
    bindRoute(nextRouteInfo) {
      routeInfo = nextRouteInfo || null;
      api.close();
    },
  };

  return api;
}
