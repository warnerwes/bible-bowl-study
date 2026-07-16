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
import { mountSuggestPanel } from "./suggest-panel.js";

const REQUEST_TIMEOUT_MS = 10000;
const FALLBACK_COPYRIGHT = "NKJV © 1982 Thomas Nelson. All rights reserved.";

const requestedRef = new URLSearchParams(window.location.search).get("ref");
const route = parseReaderSearch(window.location.search);
const fallbackProvider = getProvider("biblegateway");

const refs = {
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
};

let activeController = null;
let activeRequest = 0;
let trackedKey = "";
let suggestPanel = { hide() {}, showForChapter() {} };

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
    if (refs.content) refs.content.textContent = chapterText;
    renderAttribution(payload);
    if (refs.retry) refs.retry.hidden = true;
    if (refs.fallback) refs.fallback.hidden = true;
    suggestPanel.showForChapter(routeInfo);
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
  const config = await loadConfig("data/site-config.json");
  suggestPanel = mountSuggestPanel({
    root: refs.suggestRoot,
    config,
  });
  if (refs.retry) {
    refs.retry.addEventListener("click", () => {
      void loadChapter(route);
    });
  }
  void loadChapter(route);
}

setReference(route);
void initReader();
