"use strict";

import { mountAccountBubble } from "./account-bubble.js";
import { fetchWeekCheckout } from "./checkout-client.js";
import { loadConfig } from "./config.js";
import { ensureFirebase } from "./firebase-client.js";
import { getProvider } from "./passage-links.js";
import { createReaderAccess } from "./reader-access.js";
import { createReaderCache } from "./reader-cache.js";
import { loadOwnEntriesByVerse } from "./reader-data.js";
import {
  buildReaderUrl,
  chapterReference,
  getReaderWeek,
  nextChapter,
  parseReaderSearch,
  previousChapter,
} from "./reader-route.js";
import {
  expectedVerseCount,
  renderSegmentedVerseContent,
  segmentVerses,
  serializeScripture,
} from "./reader-verses.js";
import { mountSuggestPanel } from "./suggest-panel.js";
import { readSiteUsageCount } from "./usage-meter.js";
import { mountVerseMenu } from "./verse-menu.js";

const REQUEST_TIMEOUT_MS = 10000;
const requestedRef = typeof window === "object"
  ? new URLSearchParams(window.location.search).get("ref")
  : null;
const route = typeof window === "object"
  ? parseReaderSearch(window.location.search)
  : null;
const fallbackProvider = getProvider("biblegateway");

function getRefs() {
  if (typeof document !== "object") return {};
  return {
    account: document.getElementById("reader-account"),
    attribution: document.getElementById("reader-attribution"),
    attributionCopy: document.getElementById("reader-attribution-copy"),
    attributionLink: document.getElementById("reader-attribution-link"),
    content: document.getElementById("reader-content"),
    fallback: document.getElementById("reader-fallback"),
    load: document.getElementById("reader-load"),
    next: document.getElementById("reader-next"),
    prev: document.getElementById("reader-prev"),
    prompt: document.getElementById("reader-prompt"),
    quietLine: document.getElementById("reader-quiet-line"),
    reference: document.getElementById("reader-reference"),
    signIn: document.getElementById("reader-sign-in"),
    status: document.getElementById("reader-status"),
    suggestRoot: document.getElementById("suggest-panel-root"),
    verseMenuRoot: document.getElementById("verse-menu-root"),
  };
}

let refs = getRefs();
let activeController = null;
let readerConfig = null;
let authState = { kind: "checking", name: "", uid: "", user: null };
let access = null;
let cache = null;
let suggestPanel = { hide() {}, showForChapter() {} };
let verseMenu = { bindRoute() {}, close() {}, setOwnedEntries() {} };
let accountBubble = { close() {}, render() {} };
let currentSiteUsage = null;
let currentVerseTextByVerse = {};

function clearDisplay() {
  if (refs.content) refs.content.textContent = "";
  if (refs.attribution) refs.attribution.hidden = true;
  verseMenu.close();
}

function setStatus(message) {
  if (refs.status) refs.status.textContent = message || "";
}

function setReference(routeInfo) {
  const text = routeInfo ? chapterReference(routeInfo.book, routeInfo.chapter) : String(requestedRef || "Reader");
  if (refs.reference) refs.reference.textContent = text;
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

function updateFallback(routeInfo) {
  if (!refs.fallback) return;
  if (!routeInfo) {
    refs.fallback.hidden = true;
    return;
  }
  refs.fallback.hidden = false;
  refs.fallback.href = fallbackProvider.build(chapterReference(routeInfo.book, routeInfo.chapter), "NKJV");
}

function renderAttribution(chapter) {
  if (!refs.attribution || !refs.attributionCopy || !refs.attributionLink) return;
  refs.attributionCopy.textContent = chapter.copyright || "";
  refs.attributionLink.href = chapter.attributionUrl || "https://api.bible";
  refs.attribution.hidden = false;
}

function updatePrompt({ showSignIn = false, showCheckout = false, loading = false, weekLabel = "", capReached = false } = {}) {
  if (!refs.prompt || !refs.signIn || !refs.load || !refs.fallback) return;
  refs.prompt.hidden = false;
  refs.signIn.hidden = !showSignIn;
  refs.load.hidden = !showCheckout;
  refs.load.disabled = loading;
  refs.fallback.classList?.toggle?.("reader-fallback-small", showSignIn);
  refs.load.textContent = capReached
    ? "Monthly limit reached — use Bible Gateway"
    : `Check out this week (${weekLabel}) — uses 1 of your 20 monthly lookups`;
}

function hidePrompt() {
  if (refs.prompt) refs.prompt.hidden = true;
}

function formatQuietLine({ deviceCount, usage, siteCount }) {
  const segments = [`This device: ${deviceCount} chapters checked out`];
  if (usage) {
    segments.push(`You've used ${usage.used} of 20`);
  }
  const siteText = Number.isFinite(siteCount) ? `Site total ${siteCount} of 5,000` : "Site total ? of 5,000";
  segments.push(siteText);
  return segments.join(" · ");
}

function renderQuietLine({ deviceCount, usage, siteCount }) {
  if (!refs.quietLine) return;
  refs.quietLine.textContent = formatQuietLine({ deviceCount, usage, siteCount });
}

function trackView(token) {
  if (typeof window.fums !== "function" || !token) return;
  window.fums("trackView", token);
}

function renderChapterText(routeInfo, chapterText) {
  if (!refs.content) return false;
  const segment = segmentVerses(chapterText, expectedVerseCount(routeInfo.book, routeInfo.chapter));
  if (!segment) {
    currentVerseTextByVerse = {};
    clearDisplay();
    return false;
  }
  currentVerseTextByVerse = Object.fromEntries(
    segment.verses.map((verse) => [String(verse.number), verse.verseText])
  );
  renderSegmentedVerseContent(refs.content, segment);
  return serializeScripture(refs.content) === chapterText;
}

async function bindVerseData(routeInfo) {
  const menuRouteInfo = { ...routeInfo, bookSlug: routeInfo.bookApi === "1CO" ? "1cor" : "2cor" };
  verseMenu.bindRoute(menuRouteInfo, currentVerseTextByVerse);
  try {
    const entriesByVerse = await loadOwnEntriesByVerse({ config: readerConfig, routeInfo: menuRouteInfo });
    verseMenu.setOwnedEntries(entriesByVerse);
  } catch {}
}

function renderAccount(usageSnapshot) {
  accountBubble.render({
    kind: authState.kind,
    name: authState.name,
    remaining: usageSnapshot?.remaining ?? 20,
    ownedWeeks: usageSnapshot?.ownedWeeks || [],
  });
}

function showSignedOut(routeInfo) {
  clearDisplay();
  setReference(routeInfo);
  updateNavigation(routeInfo);
  updateFallback(routeInfo);
  renderQuietLine({ deviceCount: 0, usage: null, siteCount: currentSiteUsage });
  renderAccount(null);
  showSuggestPanel(routeInfo, false);
  updatePrompt({ showSignIn: authState.kind !== "checking" });
  setStatus(authState.kind === "checking" ? "Checking sign-in…" : "");
}

function showSuggestPanel(routeInfo, signedIn) {
  if (!signedIn) {
    suggestPanel.hide();
    return;
  }
  if (routeInfo) suggestPanel.showForChapter(routeInfo);
  else suggestPanel.hide();
}

function renderLoadedChapter(routeInfo, chapter, usageSnapshot, { cached = false } = {}) {
  clearDisplay();
  hidePrompt();
  const rendered = renderChapterText(routeInfo, chapter.content);
  if (!rendered) {
    showCheckoutPrompt(routeInfo, usageSnapshot, "That chapter did not validate cleanly. Use Bible Gateway below.");
    return false;
  }
  renderAttribution(chapter);
  renderQuietLine({
    deviceCount: cache.getDeviceChapterCount(),
    usage: usageSnapshot,
    siteCount: currentSiteUsage,
  });
  setStatus(cached ? "" : "");
  showSuggestPanel(routeInfo, true);
  void bindVerseData(routeInfo);
  trackView(chapter.fumsToken);
  return true;
}

function weekLabelForRoute(routeInfo) {
  const week = getReaderWeek(routeInfo);
  if (!week) return "";
  return `${routeInfo.book} ${week.chapters.join("–")}`;
}

function showCheckoutPrompt(routeInfo, usageSnapshot, statusMessage = "") {
  clearDisplay();
  setReference(routeInfo);
  updateNavigation(routeInfo);
  updateFallback(routeInfo);
  renderQuietLine({
    deviceCount: cache.getDeviceChapterCount(),
    usage: usageSnapshot,
    siteCount: currentSiteUsage,
  });
  renderAccount(usageSnapshot);
  showSuggestPanel(routeInfo, true);
  updatePrompt({
    showCheckout: true,
    weekLabel: weekLabelForRoute(routeInfo),
    capReached: usageSnapshot?.remaining === 0,
  });
  setStatus(statusMessage);
}

function snapshotForCurrentUser(month) {
  if (authState.kind !== "google") return null;
  return cache.readUsageSnapshot(authState.uid, month);
}

async function loadSiteUsage() {
  try {
    currentSiteUsage = await readSiteUsageCount(readerConfig);
  } catch {
    currentSiteUsage = null;
  }
  renderQuietLine({
    deviceCount: cache.getDeviceChapterCount(),
    usage: snapshotForCurrentUser(),
    siteCount: currentSiteUsage,
  });
}

function purgeForAuthTransition(nextState) {
  const priorUid = authState.uid;
  if (!priorUid) return;
  const accountChanged = nextState.uid && nextState.uid !== priorUid;
  const signedOut = nextState.kind !== "google";
  if (accountChanged || signedOut) {
    clearDisplay();
    cache.clearAll();
  }
}

async function renderFromCacheOrPrompt(routeInfo) {
  const cached = cache.readChapter(routeInfo.bookApi, routeInfo.chapter);
  const usageSnapshot = snapshotForCurrentUser();
  renderAccount(usageSnapshot);
  if (cached) {
    renderLoadedChapter(routeInfo, cached, usageSnapshot, { cached: true });
    return;
  }
  showCheckoutPrompt(routeInfo, usageSnapshot);
}

async function checkoutCurrentWeek() {
  if (!route || authState.kind !== "google") {
    showSignedOut(route);
    return;
  }
  if (activeController) activeController.abort();
  activeController = new AbortController();
  window.setTimeout(() => activeController?.abort(), REQUEST_TIMEOUT_MS);
  const usageSnapshot = snapshotForCurrentUser();
  updatePrompt({ showCheckout: true, loading: true, weekLabel: weekLabelForRoute(route) });
  setStatus("");

  try {
    const idToken = await access.getIdToken();
    if (!idToken) throw new Error("SIGN_IN_REQUIRED");
    const payload = await fetchWeekCheckout({
      routeInfo: route,
      idToken,
      signal: activeController.signal,
    });
    cache.writeWeek(payload);
    cache.writeUsageSnapshot(authState.uid, payload.usage, payload.ownedWeeks);
    currentSiteUsage = payload.siteUsage?.used ?? currentSiteUsage;
    const chapter = cache.readChapter(route.bookApi, route.chapter);
    renderAccount(cache.readUsageSnapshot(authState.uid, payload.usage?.month));
    if (!chapter || !renderLoadedChapter(route, chapter, cache.readUsageSnapshot(authState.uid, payload.usage?.month))) {
      showCheckoutPrompt(route, cache.readUsageSnapshot(authState.uid, payload.usage?.month), "Use Bible Gateway below.");
    }
  } catch (error) {
    if (error?.message === "SIGN_IN_REQUIRED" || error?.code === "SIGN_IN_REQUIRED") {
      authState = { kind: "signed_out", name: "", uid: "", user: null };
      showSignedOut(route);
      return;
    }
    const usage = snapshotForCurrentUser();
    showCheckoutPrompt(route, usage, error?.message || "Could not check out this week.");
  }
}

function handleAuthChange(nextState) {
  purgeForAuthTransition(nextState);
  authState = nextState || { kind: "signed_out", name: "", uid: "", user: null };
  if (!route) {
    setStatus("This reader link is invalid. Use Bible Gateway below.");
    return;
  }
  if (authState.kind !== "google") {
    showSignedOut(route);
    return;
  }
  void renderFromCacheOrPrompt(route);
}

async function initReader() {
  if (typeof document !== "object") return;
  refs = getRefs();
  setReference(route);
  updateNavigation(route);
  updateFallback(route);
  setStatus("Checking sign-in…");

  const config = await loadConfig("data/site-config.json");
  readerConfig = config;
  cache = createReaderCache();
  cache.purge();
  suggestPanel = mountSuggestPanel({ root: refs.suggestRoot, config });
  verseMenu = mountVerseMenu({ root: refs.verseMenuRoot, content: refs.content, config });
  accountBubble = mountAccountBubble({
    root: refs.account,
    onSignOut() {
      void access.signOut();
    },
  });

  access = createReaderAccess({
    config,
    beforeSignOut() {
      clearDisplay();
      cache.clearAll();
    },
    onChange: handleAuthChange,
  });

  refs.signIn?.addEventListener("click", async () => {
    setStatus("Opening Google sign-in…");
    try {
      await access.signIn();
    } catch (error) {
      setStatus((error && error.message) || "Google sign-in did not complete.");
    }
  });
  refs.load?.addEventListener("click", () => {
    void checkoutCurrentWeek();
  });

  await loadSiteUsage();
  await access.init();
}

if (typeof window === "object" && typeof document === "object") {
  window.__readerTest = {
    expectedVerseCount,
    renderChapterText,
    formatQuietLine,
    serializeScripture,
  };
  void initReader();
}

export { expectedVerseCount, renderChapterText, renderSegmentedVerseContent, formatQuietLine, segmentVerses, serializeScripture };
