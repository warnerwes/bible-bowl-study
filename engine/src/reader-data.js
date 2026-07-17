"use strict";

import { loadOwnChapterSuggestions } from "./suggest-core.js";

function normalizeCreatedAt(entry) {
  return String(entry && entry.createdAt ? entry.createdAt : "");
}

function compareEntries(left, right) {
  return normalizeCreatedAt(right).localeCompare(normalizeCreatedAt(left)) || String(right.id || "").localeCompare(String(left.id || ""));
}

export function parseReferenceVerse(reference, chapter) {
  const match = String(reference || "").match(/:(\d+)/);
  if (!match) return 0;
  const verse = Number(match[1]);
  if (!Number.isInteger(verse) || verse < 1) return 0;
  if (String(reference || "").includes(` ${chapter}:`) || String(reference || "").includes(`${chapter}:`)) {
    return verse;
  }
  return 0;
}

export function mapOwnEntriesByVerse(entries, chapter) {
  const byVerse = {};
  for (const entry of entries || []) {
    const verse = parseReferenceVerse(entry.reference, chapter);
    if (!verse) continue;
    byVerse[String(verse)] ??= [];
    byVerse[String(verse)].push(entry);
  }
  for (const verse of Object.keys(byVerse)) {
    byVerse[verse].sort(compareEntries);
  }
  return byVerse;
}

export async function loadOwnEntriesByVerse({ config, routeInfo }) {
  const entries = await loadOwnChapterSuggestions({
    config,
    book: routeInfo.book,
    chapter: routeInfo.chapter,
  });
  return mapOwnEntriesByVerse(entries, routeInfo.chapter);
}
