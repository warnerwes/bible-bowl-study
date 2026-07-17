"use strict";

import { loadConfig } from "./config.js";
import { getProvider } from "./passage-links.js";
import {
  buildReaderUrl,
  chapterReference,
  nextChapter,
  parseReaderSearch,
  previousChapter,
} from "./reader-route.js";
import { loadOwnEntriesByVerse } from "./reader-data.js";
import { mountSuggestPanel } from "./suggest-panel.js";
import { mountVerseMenu } from "./verse-menu.js";

const REQUEST_TIMEOUT_MS = 10000;
const FALLBACK_COPYRIGHT = "NKJV © 1982 Thomas Nelson. All rights reserved.";
const CHAPTER_VERSE_COUNTS = {
  "1 Corinthians": [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  "2 Corinthians": [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
};
const CHAPTER_VERSE_COUNT_KEYS = {
  "1CORINTHIANS": "1 Corinthians",
  "1CO": "1 Corinthians",
  "2CORINTHIANS": "2 Corinthians",
  "2CO": "2 Corinthians",
};

const requestedRef = typeof window === "object"
  ? new URLSearchParams(window.location.search).get("ref")
  : null;
const route = typeof window === "object"
  ? parseReaderSearch(window.location.search)
  : null;
const fallbackProvider = getProvider("biblegateway");

function textNode(value) {
  return document.createTextNode(value);
}

function getRefs() {
  if (typeof document !== "object") {
    return {};
  }
  return {
    attribution: document.getElementById("reader-attribution"),
    attributionCopy: document.getElementById("reader-attribution-copy"),
    attributionLink: document.getElementById("reader-attribution-link"),
    content: document.getElementById("reader-content"),
    fallback: document.getElementById("reader-fallback"),
    next: document.getElementById("reader-next"),
    prev: document.getElementById("reader-prev"),
    reference: document.getElementById("reader-reference"),
    retry: document.getElementById("reader-retry"),
    status: document.getElementById("reader-status"),
    suggestRoot: document.getElementById("suggest-panel-root"),
    verseMenuRoot: document.getElementById("verse-menu-root"),
  };
}

export function expectedVerseCount(book, chapter) {
  const key = CHAPTER_VERSE_COUNT_KEYS[String(book || "").replace(/\s+/g, "").toUpperCase()] || book;
  const chapters = CHAPTER_VERSE_COUNTS[key];
  const count = chapters && chapters[chapter - 1];
  return Number.isInteger(count) ? count : 0;
}

export function segmentVerses(text, expectedCount = 0) {
  const source = String(text || "");
  const markerRe = /\[(\d+)\]\s?/g;
  const matches = [];
  for (const match of source.matchAll(markerRe)) {
    let prefixText = "";
    let sliceIndex = match.index;
    let prefixStart = match.index;
    while (prefixStart > 0 && source[prefixStart - 1] !== "\n" && source[prefixStart - 1] !== "\r") {
      prefixStart -= 1;
    }
    if (prefixStart < match.index) {
      const candidatePrefix = source.slice(prefixStart, match.index);
      if (/^[ \t]+$/.test(candidatePrefix)) {
        prefixText = candidatePrefix;
        sliceIndex = prefixStart;
      }
    }
    matches.push({
      full: match[0],
      number: Number(match[1]),
      index: match.index,
      prefixText,
      sliceIndex,
    });
  }
  if (!matches.length) return null;

  const verses = [];
  const head = source.slice(0, matches[0].sliceIndex);
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const markerText = `[${match.number}]`;
    const start = match.index + markerText.length;
    const end = next ? next.sliceIndex : source.length;
    verses.push({
      number: match.number,
      prefixText: match.prefixText,
      markerText,
      verseText: source.slice(start, end),
    });
  }

  for (let index = 0; index < verses.length; index += 1) {
    if (verses[index].number !== index + 1) {
      return null;
    }
  }
  if (expectedCount && verses.length !== expectedCount) {
    return null;
  }

  return { headText: head, verses };
}

let refs = getRefs();
let activeController = null;
let activeRequest = 0;
let trackedKey = "";
let suggestPanel = { hide() {}, showForChapter() {} };
let verseMenu = { bindRoute() {}, close() {}, setOwnedEntries() {} };
let readerConfig = null;

function setStatus(message) {
  if (refs.status) refs.status.textContent = message || "";
}

function normalizeRequestedRef() {
  return String(requestedRef || "").trim().replace(/\s+/g, " ") || "Reader";
}

function setReferenceText(text) {
  if (refs.reference) refs.reference.textContent = text || "Reader";
}

function setReference(routeInfo) {
  if (routeInfo) {
    setReferenceText(chapterReference(routeInfo.book, routeInfo.chapter));
    return;
  }
  setReferenceText(normalizeRequestedRef());
}

function setNavLink(node, routeInfo, label) {
  if (!node) return;
  if (!routeInfo) {
    node.hidden = true;
    node.removeAttribute("href");
    node.setAttribute("aria-disabled", "true");
    return;
  }
  node.hidden = false;
  node.href = buildReaderUrl(chapterReference(routeInfo.book, routeInfo.chapter));
  node.textContent = label;
  node.removeAttribute("aria-disabled");
}

function updateNavigation(routeInfo) {
  setNavLink(refs.prev, previousChapter(routeInfo), "← Previous chapter");
  setNavLink(refs.next, nextChapter(routeInfo), "Next chapter →");
}

function fallbackReference(routeInfo) {
  return routeInfo ? chapterReference(routeInfo.book, routeInfo.chapter) : "1 Corinthians 1";
}

function updateFallback(routeInfo) {
  if (!refs.fallback) return;
  refs.fallback.href = fallbackProvider.build(fallbackReference(routeInfo), "NKJV");
}

function clearDisplay() {
  if (refs.content) refs.content.textContent = "";
  if (refs.attribution) refs.attribution.hidden = true;
  verseMenu.close();
}

function showFailure(message, routeInfo) {
  setReference(routeInfo);
  clearDisplay();
  updateFallback(routeInfo);
  if (refs.retry) refs.retry.hidden = false;
  if (refs.fallback) refs.fallback.hidden = false;
  suggestPanel.hide();
  setStatus(message);
}

function showLoading() {
  clearDisplay();
  if (refs.retry) refs.retry.hidden = true;
  if (refs.fallback) refs.fallback.hidden = true;
  suggestPanel.hide();
  setStatus("Loading chapter...");
}

function readChapterText(payload) {
  const candidates = [
    payload && payload.text,
    payload && payload.content,
    payload && payload.chapter && payload.chapter.text,
    payload && payload.data && payload.data.text,
    payload && payload.data && payload.data.content,
  ];
  const text = candidates.find((value) => typeof value === "string");
  if (!text) throw new Error("Chapter text missing from response.");
  return text;
}

function renderAttribution(payload) {
  if (!refs.attribution || !refs.attributionCopy || !refs.attributionLink) return;
  refs.attributionCopy.textContent = payload.copyright || FALLBACK_COPYRIGHT;
  refs.attributionLink.href = payload.attributionUrl || "https://api.bible";
  refs.attribution.hidden = false;
}

function trackView(payload, routeInfo, requestId) {
  if (requestId !== activeRequest) return;
  if (typeof window.fums !== "function") return;
  const token = payload && payload.fumsToken;
  if (!token) return;
  const key = `${routeInfo.bookApi}:${routeInfo.chapter}:${token}`;
  if (trackedKey === key) return;
  trackedKey = key;
  window.fums("trackView", token);
}

export function renderSegmentedVerseContent(container, segment) {
  if (!container) return;
  container.textContent = "";
  if (segment.headText) {
    container.appendChild(textNode(segment.headText));
  }
  for (const verse of segment.verses) {
    if (verse.prefixText) {
      container.appendChild(textNode(verse.prefixText));
    }
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "verse-marker";
    marker.dataset.verse = String(verse.number);
    marker.setAttribute("aria-label", `Verse ${verse.number} options`);
    marker.appendChild(textNode(verse.markerText));
    const clue = document.createElement("span");
    clue.className = "verse-submission-clue";
    clue.hidden = true;
    clue.setAttribute("data-reader-adornment", "");
    const span = document.createElement("span");
    span.className = "verse-text";
    span.appendChild(textNode(verse.verseText));
    const preview = document.createElement("span");
    preview.className = "verse-note-preview";
    preview.hidden = true;
    preview.setAttribute("data-reader-adornment", "");
    container.appendChild(marker);
    container.appendChild(clue);
    container.appendChild(span);
    container.appendChild(preview);
  }
}

function childNodesOf(node) {
  if (!node) return [];
  if (node.childNodes && typeof node.childNodes.length === "number") {
    return Array.from(node.childNodes);
  }
  if (node.children && typeof node.children.length === "number") {
    return Array.from(node.children);
  }
  return [];
}

function serializeNode(node) {
  if (!node) return "";
  if (node.nodeType === 3) return node.textContent || "";
  if (typeof node.getAttribute === "function" && node.getAttribute("data-reader-adornment") != null) {
    return "";
  }
  return childNodesOf(node).map((child) => serializeNode(child)).join("");
}

export function serializeScripture(container) {
  return childNodesOf(container).map((node) => serializeNode(node)).join("");
}

function renderChapterText(routeInfo, chapterText) {
  if (!refs.content) return false;
  const segment = segmentVerses(chapterText, expectedVerseCount(routeInfo.book, routeInfo.chapter));
  if (!segment) {
    refs.content.textContent = chapterText;
    return false;
  }
  renderSegmentedVerseContent(refs.content, segment);
  return true;
}

async function fetchChapter(routeInfo, requestId, controller) {
  const { signal } = controller;
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `/api/chapter?book=${encodeURIComponent(routeInfo.bookApi)}&ch=${routeInfo.chapter}`;
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "Reader unavailable right now (HTTP 429)."
          : `Reader unavailable (HTTP ${response.status}).`
      );
    }
    const payload = await response.json();
    if (signal.aborted || requestId !== activeRequest) return;

    const chapterText = readChapterText(payload);
    renderChapterText(routeInfo, chapterText);
    renderAttribution(payload);
    if (refs.retry) refs.retry.hidden = true;
    if (refs.fallback) refs.fallback.hidden = true;
    suggestPanel.showForChapter(routeInfo);
    const menuRouteInfo = { ...routeInfo, bookSlug: routeInfo.bookApi === "1CO" ? "1cor" : "2cor" };
    verseMenu.bindRoute(menuRouteInfo);
    void loadOwnEntriesByVerse({ config: readerConfig, routeInfo: menuRouteInfo })
      .then((entriesByVerse) => {
        if (requestId !== activeRequest) return;
        verseMenu.setOwnedEntries(entriesByVerse);
      })
      .catch(() => {});
    setStatus(`Showing ${chapterReference(routeInfo.book, routeInfo.chapter)}.`);
    trackView(payload, routeInfo, requestId);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadChapter(routeInfo) {
  if (!routeInfo) {
    updateFallback(null);
    updateNavigation(null);
    showFailure("This reader link is invalid. Use the fallback link below.", null);
    return;
  }

  if (activeController) activeController.abort();
  activeController = new AbortController();
  activeRequest += 1;
  const requestId = activeRequest;

  setReference(routeInfo);
  updateNavigation(routeInfo);
  updateFallback(routeInfo);
  showLoading();

  try {
    await fetchChapter(routeInfo, requestId, activeController);
  } catch (error) {
    if (activeController.signal.aborted || requestId !== activeRequest) return;
    const message = error && error.name === "AbortError"
      ? "Loading was interrupted. Try again."
      : (error && error.message) || "Could not load this chapter.";
    showFailure(message, routeInfo);
  }
}

async function initReader() {
  if (typeof document !== "object") return;
  refs = getRefs();
  const config = await loadConfig("data/site-config.json");
  readerConfig = config;
  suggestPanel = mountSuggestPanel({
    root: refs.suggestRoot,
    config,
  });
  verseMenu = mountVerseMenu({
    root: refs.verseMenuRoot,
    content: refs.content,
    config,
  });
  if (refs.retry) {
    refs.retry.addEventListener("click", () => {
      void loadChapter(route);
    });
  }
  void loadChapter(route);
}

if (typeof window === "object" && typeof document === "object") {
  setReference(route);
  void initReader();
}
