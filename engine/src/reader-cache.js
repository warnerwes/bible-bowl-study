"use strict";

export const READER_CACHE_KEY = "bbs:reader-cache:v1";
export const READER_USAGE_KEY = "bbs:reader-usage:v1";
export const READER_CACHE_VERSION = 1;
export const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function safeParse(json) {
  try {
    return JSON.parse(String(json || ""));
  } catch {
    return null;
  }
}

function createEmptyCache() {
  return {
    version: READER_CACHE_VERSION,
    chapters: {},
  };
}

function isValidChapterEntry(entry, now) {
  return !!entry
    && typeof entry.content === "string"
    && typeof entry.reference === "string"
    && typeof entry.copyright === "string"
    && typeof entry.fumsToken === "string"
    && Number.isFinite(entry.fetchedAt)
    && Number.isFinite(entry.expiresAt)
    && entry.expiresAt > now
    && entry.fetchedAt <= entry.expiresAt
    && entry.fetchedAt <= now
    && entry.expiresAt - entry.fetchedAt <= CACHE_TTL_MS;
}

function normalizeCacheEnvelope(raw, now) {
  const parsed = raw && raw.version === READER_CACHE_VERSION && raw.chapters && typeof raw.chapters === "object"
    ? raw
    : createEmptyCache();
  const chapters = {};
  for (const [key, value] of Object.entries(parsed.chapters || {})) {
    if (isValidChapterEntry(value, now)) {
      chapters[key] = value;
    }
  }
  return { version: READER_CACHE_VERSION, chapters };
}

function chapterKey(book, chapter) {
  return `${book}.${chapter}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createReaderCache({
  storage = globalThis.localStorage,
  now = () => Date.now(),
} = {}) {
  function readEnvelope() {
    return normalizeCacheEnvelope(safeParse(storage?.getItem(READER_CACHE_KEY)), now());
  }

  function writeEnvelope(nextEnvelope) {
    storage?.setItem(READER_CACHE_KEY, JSON.stringify(nextEnvelope));
  }

  function purge() {
    const normalized = readEnvelope();
    writeEnvelope(normalized);
    const usage = safeParse(storage?.getItem(READER_USAGE_KEY));
    if (!usage || typeof usage !== "object") {
      storage?.removeItem(READER_USAGE_KEY);
    }
    return normalized;
  }

  function readChapter(book, chapter) {
    const envelope = readEnvelope();
    const entry = envelope.chapters[chapterKey(book, chapter)];
    return entry ? clone(entry) : null;
  }

  function writeWeek(payload) {
    const envelope = readEnvelope();
    const chapters = { ...envelope.chapters };
    const fetchedAt = Number(payload?.fetchedAt);
    const expiresAt = Number(payload?.expiresAt);
    const fumsToken = String(payload?.fumsToken || "");
    if (!Number.isFinite(fetchedAt) || !Number.isFinite(expiresAt) || !fumsToken) {
      return false;
    }
    const nextEntries = {};
    for (const chapter of payload?.chapters || []) {
      if (!chapter || !chapter.book || !Number.isInteger(chapter.chapter) || typeof chapter.content !== "string") {
        return false;
      }
      nextEntries[chapterKey(chapter.book, chapter.chapter)] = {
        content: chapter.content,
        copyright: String(chapter.copyright || ""),
        reference: String(chapter.reference || ""),
        fumsToken,
        fetchedAt,
        expiresAt,
      };
    }
    if (!Object.keys(nextEntries).length) return false;
    Object.assign(chapters, nextEntries);
    writeEnvelope({ version: READER_CACHE_VERSION, chapters });
    return true;
  }

  function clearAll() {
    storage?.removeItem(READER_CACHE_KEY);
    storage?.removeItem(READER_USAGE_KEY);
  }

  function getDeviceChapterCount() {
    return Object.keys(readEnvelope().chapters).length;
  }

  function writeUsageSnapshot(uid, usage, ownedWeeks = []) {
    const month = String(usage?.month || "");
    if (!uid || !month) return false;
    storage?.setItem(READER_USAGE_KEY, JSON.stringify({
      uid,
      month,
      used: Number(usage?.used) || 0,
      limit: Number(usage?.limit) || 20,
      remaining: Number(usage?.remaining) || 0,
      ownedWeeks: Array.isArray(ownedWeeks) ? ownedWeeks : [],
      updatedAt: now(),
    }));
    return true;
  }

  function readUsageSnapshot(uid, month) {
    const parsed = safeParse(storage?.getItem(READER_USAGE_KEY));
    if (!parsed || parsed.uid !== uid || (month && parsed.month !== month)) {
      return null;
    }
    return clone(parsed);
  }

  return {
    chapterKey,
    clearAll,
    getDeviceChapterCount,
    purge,
    readChapter,
    readUsageSnapshot,
    writeUsageSnapshot,
    writeWeek,
  };
}
