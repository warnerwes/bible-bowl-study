"use strict";

import { readStoredText, removeStoredValue, writeStoredText } from "./suggest-core.js";

function newNoteKey(routeInfo, verse) {
  return `bbs:notes:${routeInfo.bookSlug}:${routeInfo.chapter}:${verse}`;
}

function oldNoteKey(routeInfo, verse) {
  return `bbs:note:${routeInfo.bookSlug}:${routeInfo.chapter}:${verse}`;
}

function normalizeNote(entry) {
  if (!entry || typeof entry !== "object") return null;
  const text = String(entry.text || "").trim();
  if (!text) return null;
  const createdAt = String(entry.createdAt || "").trim() || new Date().toISOString();
  return { text, createdAt };
}

function writeNoteArray(key, notes) {
  try {
    writeStoredText(key, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

function migrateLegacyNote(routeInfo, verse, key) {
  const legacy = readStoredText(oldNoteKey(routeInfo, verse), "");
  const text = String(legacy || "").trim();
  if (!text) return [];
  const migrated = [{ text, createdAt: new Date().toISOString() }];
  if (writeNoteArray(key, migrated)) {
    removeStoredValue(oldNoteKey(routeInfo, verse));
  }
  return migrated;
}

export function readVerseNotes(routeInfo, verse) {
  if (!routeInfo || !verse) return [];
  const key = newNoteKey(routeInfo, verse);
  const raw = readStoredText(key, "");
  if (!raw) {
    return migrateLegacyNote(routeInfo, verse, key)
      .slice()
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeNote(entry))
      .filter(Boolean)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  } catch {
    return [];
  }
}

export function appendVerseNote(routeInfo, verse, text) {
  const trimmed = String(text || "").trim();
  if (!routeInfo || !verse || !trimmed) return [];
  const existing = readVerseNotes(routeInfo, verse)
    .slice()
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  existing.push({
    text: trimmed,
    createdAt: new Date().toISOString(),
  });
  writeNoteArray(newNoteKey(routeInfo, verse), existing);
  return existing
    .slice()
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export function readVerseNotesMap(routeInfo, verses) {
  const map = {};
  for (const verse of verses || []) {
    map[String(verse)] = readVerseNotes(routeInfo, verse);
  }
  return map;
}
