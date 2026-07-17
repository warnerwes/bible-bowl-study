"use strict";

import {
  createSuggestionSubmitter,
  normalizeOptionalHttpUrl,
  persistAuthorName,
  readAuthorName,
  resolveAuthorName,
  setFirebaseLoader,
} from "./suggest-core.js";
import { applyVerseAdornments } from "./verse-adornments.js";
import { appendVerseNote, readVerseNotesMap } from "./verse-notes.js";

const MEMORY_KINDS = new Set(["memory_hook", "surprising_fact", "link"]);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function compareEntries(left, right) {
  return String(right.createdAt || "").localeCompare(String(left.createdAt || "")) ||
    String(right.id || "").localeCompare(String(left.id || ""));
}

function entryIcon(entry) {
  if (entry.kind === "question_seed") return "?";
  return "↗";
}

function isAccepted(entry) {
  return entry && (entry.status === "approved" || entry.status === "exported");
}

function firstLine(text) {
  return String(text || "").trim().split(/\r?\n/, 1)[0] || "";
}

function normalizeEntriesMap(entriesByVerse) {
  const next = {};
  for (const [verse, entries] of Object.entries(entriesByVerse || {})) {
    next[String(verse)] = [...entries].sort(compareEntries);
  }
  return next;
}

function createButton(label, cls = "link-btn") {
  const button = el("button", cls, label);
  button.type = "button";
  return button;
}

function createTextInput(id, multiline = false) {
  const input = multiline ? document.createElement("textarea") : el("input", "text-input");
  input.className = "text-input";
  input.id = id;
  if (!multiline) input.type = "text";
  return input;
}

function field(labelText, input) {
  const label = el("label", "suggest-field");
  label.appendChild(el("span", "field-label", labelText));
  label.appendChild(input);
  return label;
}

function historyEntryText(entry) {
  return firstLine(entry.text || entry.url || "");
}

function entryMatchesPanel(entry, panelKind) {
  if (panelKind === "question_seed") return entry.kind === "question_seed";
  if (panelKind === "memory_hook") return MEMORY_KINDS.has(entry.kind);
  return false;
}

export { setFirebaseLoader };

export function mountVerseMenu({ root, content, config }) {
  if (!root || !content) {
    return { close() {}, bindRoute() {}, setOwnedEntries() {} };
  }

  let routeInfo = null;
  let currentVerse = 0;
  let currentMarker = null;
  let lastFocused = null;
  let activeTrap = null;
  let panelKind = null;
  let ownEntriesByVerse = {};
  let notesByVerse = {};
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
  const closeBtn = createButton("Close");
  head.appendChild(title);
  head.appendChild(closeBtn);

  const body = el("div", "verse-menu-body");
  const status = el("p", "muted suggest-status");
  status.id = "verse-menu-status";
  status.setAttribute("aria-live", "polite");
  body.appendChild(status);

  dialog.appendChild(head);
  dialog.appendChild(body);
  root.textContent = "";
  root.appendChild(overlay);
  root.appendChild(dialog);

  function setStatus(message, isError = false) {
    status.textContent = message || "";
    status.className = isError ? "suggest-status error" : "muted suggest-status";
  }

  function refreshNotes() {
    const verses = Object.keys(ownEntriesByVerse)
      .concat(collectVisibleVerses())
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    notesByVerse = routeInfo ? readVerseNotesMap(routeInfo, verses) : {};
  }

  function refreshAdornments() {
    if (!routeInfo) return;
    refreshNotes();
    applyVerseAdornments({
      content,
      notesByVerse,
      entriesByVerse: ownEntriesByVerse,
    });
  }

  function collectVisibleVerses() {
    const verses = [];
    const nodes = content.childNodes && typeof content.childNodes.length === "number"
      ? Array.from(content.childNodes)
      : (content.children && typeof content.children.length === "number" ? Array.from(content.children) : []);
    for (const node of nodes) {
      if (!node || typeof node.getAttribute !== "function") continue;
      if (!String(node.className || "").split(/\s+/).includes("verse-marker")) continue;
      const verse = Number(node.getAttribute("data-verse"));
      if (Number.isInteger(verse) && verse > 0) verses.push(verse);
    }
    return verses;
  }

  function currentEntries() {
    return [...(ownEntriesByVerse[String(currentVerse)] || [])].sort(compareEntries);
  }

  function currentNotes() {
    return [...(notesByVerse[String(currentVerse)] || [])];
  }

  function verseReference(verse) {
    return `${routeInfo.book} ${routeInfo.chapter}:${verse}`;
  }

  function focusables() {
    const nodes = [];
    const stack = [dialog];
    while (stack.length) {
      const node = stack.shift();
      if (!node || !node.children) continue;
      for (const child of node.children) {
        stack.push(child);
        if (child.tagName === "BUTTON" || child.tagName === "INPUT" || child.tagName === "TEXTAREA") {
          if (!child.hidden && !child.disabled) nodes.push(child);
        }
      }
    }
    return nodes;
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || dialog.hidden) return;
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
      if (panelKind) {
        panelKind = null;
        render();
        return;
      }
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

  function pushOptimisticEntry(entry) {
    const verseKey = String(currentVerse);
    ownEntriesByVerse[verseKey] = [entry, ...(ownEntriesByVerse[verseKey] || [])].sort(compareEntries);
    refreshAdornments();
  }

  function compactHistoryList() {
    const wrap = el("div", "verse-menu-history");
    const entries = currentEntries();
    const notes = currentNotes();
    if (entries.length) {
      wrap.appendChild(el("p", "muted verse-menu-section-title", "Your submissions"));
      const list = el("div", "verse-menu-history-list");
      for (const entry of entries) {
        const item = el("div", "verse-menu-history-item");
        const icon = el("span", "verse-menu-kind-icon", `${entryIcon(entry)} `);
        const text = el("span", "verse-menu-history-text", historyEntryText(entry));
        item.appendChild(icon);
        item.appendChild(text);
        if (isAccepted(entry)) item.appendChild(el("span", "verse-menu-history-star", " ⭐"));
        list.appendChild(item);
      }
      wrap.appendChild(list);
    }
    if (notes.length) {
      wrap.appendChild(el("p", "muted verse-menu-section-title", "Your notes"));
      const list = el("div", "verse-menu-history-list");
      for (const note of notes) {
        list.appendChild(el("div", "verse-menu-history-item", `✎ ${firstLine(note.text)}`));
      }
      wrap.appendChild(list);
    }
    return wrap;
  }

  function renderBubble() {
    const shell = el("div", "verse-menu-panel");
    const actions = el("div", "verse-menu-actions");
    const noteButton = createButton("Private note", "primary-btn");
    const questionButton = createButton("Submit question", "primary-btn");
    const memoryButton = createButton("Submit memory aid", "primary-btn");
    noteButton.addEventListener("click", () => {
      panelKind = "private_note";
      render();
    });
    questionButton.addEventListener("click", () => {
      panelKind = "question_seed";
      render();
    });
    memoryButton.addEventListener("click", () => {
      panelKind = "memory_hook";
      render();
    });
    actions.appendChild(noteButton);
    actions.appendChild(questionButton);
    actions.appendChild(memoryButton);
    shell.appendChild(actions);
    shell.appendChild(compactHistoryList());
    return shell;
  }

  function renderSubmissionHistory(kind) {
    const entries = currentEntries().filter((entry) => entryMatchesPanel(entry, kind));
    const shell = el("div", "verse-menu-history");
    shell.appendChild(el("p", "muted verse-menu-section-title",
      kind === "question_seed" ? "Your previous questions" : "Your previous memory aids"));
    const list = el("div", "verse-menu-history-list");
    for (const entry of entries) {
      const item = el("div", "verse-menu-history-card");
      item.appendChild(el("p", "verse-menu-history-line", historyEntryText(entry)));
      if (entry.answerText) item.appendChild(el("p", "muted verse-menu-history-line", `Answer: ${firstLine(entry.answerText)}`));
      if (entry.url) item.appendChild(el("p", "muted verse-menu-history-line", `↗ ${entry.url}`));
      if (isAccepted(entry)) item.appendChild(el("p", "verse-menu-history-line", "⭐ Accepted"));
      list.appendChild(item);
    }
    if (!entries.length) {
      list.appendChild(el("p", "muted verse-menu-history-empty", "No previous entries yet."));
    }
    shell.appendChild(list);
    return shell;
  }

  function renderNoteHistory() {
    const notes = currentNotes();
    const shell = el("div", "verse-menu-history");
    shell.appendChild(el("p", "muted verse-menu-section-title", "Your previous notes"));
    const list = el("div", "verse-menu-history-list");
    for (const note of notes) {
      list.appendChild(el("div", "verse-menu-history-card", note.text));
    }
    if (!notes.length) {
      list.appendChild(el("p", "muted verse-menu-history-empty", "No notes yet."));
    }
    shell.appendChild(list);
    return shell;
  }

  function renderExpanded(kind) {
    const shell = el("div", "verse-menu-panel");
    const back = createButton("Back");
    back.addEventListener("click", () => {
      panelKind = null;
      render();
    });
    shell.appendChild(back);

    const form = el("form", "verse-menu-form");
    const authorName = readAuthorName().trim();
    let nameInput = null;
    if (kind !== "private_note") {
      nameInput = createTextInput("verse-menu-name");
      nameInput.maxLength = 40;
      nameInput.required = true;
      nameInput.value = authorName;
      nameInput.addEventListener("input", () => {
        persistAuthorName(nameInput.value.trim());
      });
      form.appendChild(field("First name", nameInput));
      void resolveAuthorName({ config }).then((resolvedName) => {
        if (!resolvedName || nameInput.value.trim()) return;
        nameInput.value = resolvedName;
      });
    }

    let primaryInput = null;
    let secondaryInput = null;
    let tertiaryInput = null;
    let submitLabel = "";

    if (kind === "question_seed") {
      primaryInput = createTextInput("verse-menu-question", true);
      primaryInput.maxLength = 1000;
      secondaryInput = createTextInput("verse-menu-answer");
      secondaryInput.maxLength = 500;
      form.appendChild(field("Question", primaryInput));
      form.appendChild(field("Answer", secondaryInput));
      submitLabel = "Submit question";
    } else if (kind === "memory_hook") {
      primaryInput = createTextInput("verse-menu-fact", true);
      primaryInput.maxLength = 1000;
      secondaryInput = createTextInput("verse-menu-url");
      secondaryInput.maxLength = 500;
      secondaryInput.type = "url";
      secondaryInput.inputMode = "url";
      form.appendChild(field("Fact", primaryInput));
      form.appendChild(field("Source URL (optional)", secondaryInput));
      submitLabel = "Submit memory aid";
    } else {
      primaryInput = createTextInput("verse-menu-note", true);
      primaryInput.maxLength = 2000;
      form.appendChild(field("Private note", primaryInput));
      submitLabel = "Save note";
    }

    const actions = el("div", "suggest-actions");
    const submit = el("button", "primary-btn", submitLabel);
    submit.type = "submit";
    actions.appendChild(submit);
    form.appendChild(actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("");
      if (!routeInfo || !currentVerse) return;
      if (kind === "private_note") {
        if (!primaryInput.value.trim()) {
          setStatus("Please write a note before saving.", true);
          return;
        }
        appendVerseNote(routeInfo, currentVerse, primaryInput.value);
        primaryInput.value = "";
        panelKind = null;
        refreshAdornments();
        setStatus("Note saved.");
        render();
        return;
      }

      const resolvedName = (nameInput ? nameInput.value : authorName).trim();
      if (!resolvedName) {
        setStatus("Please enter your first name.", true);
        return;
      }
      if (!primaryInput.value.trim()) {
        setStatus(kind === "question_seed" ? "Please enter a question." : "Please enter a memory aid.", true);
        return;
      }

      let url = "";
      if (kind === "memory_hook" && secondaryInput.value.trim()) {
        try {
          url = normalizeOptionalHttpUrl(secondaryInput.value);
        } catch (error) {
          setStatus((error && error.message) || "Links must start with http:// or https:// and stay under 500 characters.", true);
          return;
        }
      }

      submit.disabled = true;
      closeBtn.disabled = true;
      try {
        persistAuthorName(resolvedName);
        const response = await submitSuggestion({
          authorName: resolvedName,
          kind,
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference: verseReference(currentVerse),
          text: primaryInput.value.trim(),
          answerText: kind === "question_seed" ? secondaryInput.value.trim() : "",
          ...(url ? { url } : {}),
        });
        pushOptimisticEntry({
          id: response.id || `${kind}-${Date.now()}`,
          uid: response.uid || "",
          kind,
          book: routeInfo.book,
          chapter: routeInfo.chapter,
          reference: verseReference(currentVerse),
          text: primaryInput.value.trim(),
          answerText: kind === "question_seed" ? secondaryInput.value.trim() : "",
          ...(url ? { url } : {}),
          status: "new",
          createdAt: new Date().toISOString(),
        });
        panelKind = null;
        setStatus(kind === "question_seed" ? "Question submitted." : "Memory aid submitted.");
        render();
      } catch (error) {
        setStatus((error && error.message) || "Could not send that suggestion. Please try again.", true);
      } finally {
        submit.disabled = false;
        closeBtn.disabled = false;
      }
    });

    shell.appendChild(form);
    shell.appendChild(kind === "private_note" ? renderNoteHistory() : renderSubmissionHistory(kind));
    return shell;
  }

  function render() {
    title.textContent = routeInfo && currentVerse ? verseReference(currentVerse) : "Verse options";
    body.textContent = "";
    body.appendChild(status);
    body.appendChild(panelKind ? renderExpanded(panelKind) : renderBubble());
    setStatus(status.textContent, String(status.className || "").includes("error"));
  }

  function openForMarker(marker, verse) {
    if (!routeInfo) return;
    currentVerse = verse;
    currentMarker = marker;
    lastFocused = document.activeElement || marker;
    panelKind = null;
    overlay.hidden = false;
    dialog.hidden = false;
    positionNearMarker(marker);
    render();
    if (activeTrap) document.removeEventListener("keydown", activeTrap);
    activeTrap = onKeydown;
    document.addEventListener("keydown", activeTrap);
    const first = focusables()[0];
    if (first) first.focus();
  }

  overlay.addEventListener("click", () => api.close());
  closeBtn.addEventListener("click", () => api.close());
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
      panelKind = null;
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
      ownEntriesByVerse = {};
      notesByVerse = {};
      api.close();
      refreshAdornments();
    },
    setOwnedEntries(entriesByVerse) {
      ownEntriesByVerse = normalizeEntriesMap(entriesByVerse);
      refreshAdornments();
      if (!dialog.hidden) render();
    },
  };

  return api;
}
