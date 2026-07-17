"use strict";

const BOOKS = {
  "1corinthians": { book: "1 Corinthians", bookApi: "1CO", chapters: 16 },
  "2corinthians": { book: "2 Corinthians", bookApi: "2CO", chapters: 13 },
};

const API_BOOKS = {
  "1CO": BOOKS["1corinthians"],
  "2CO": BOOKS["2corinthians"],
};
const WEEKS = [
  { bookApi: "1CO", chapters: [1, 2] },
  { bookApi: "1CO", chapters: [3, 4] },
  { bookApi: "1CO", chapters: [5, 6] },
  { bookApi: "1CO", chapters: [7, 8] },
  { bookApi: "1CO", chapters: [9, 10] },
  { bookApi: "1CO", chapters: [11, 12] },
  { bookApi: "1CO", chapters: [13, 14] },
  { bookApi: "1CO", chapters: [15, 16] },
  { bookApi: "2CO", chapters: [1, 2] },
  { bookApi: "2CO", chapters: [3, 4] },
  { bookApi: "2CO", chapters: [5, 6] },
  { bookApi: "2CO", chapters: [7, 8] },
  { bookApi: "2CO", chapters: [9, 10] },
  { bookApi: "2CO", chapters: [11, 12] },
  { bookApi: "2CO", chapters: [13] },
];

function cleanRef(ref) {
  return String(ref || "").trim().replace(/\s+/g, " ");
}

function inRange(bookInfo, chapter) {
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= bookInfo.chapters;
}

function parseNamedReference(ref) {
  const match = ref.match(/^(1|2)\s*cor(?:inthians)?\s+(\d+)(?:[:.]\d+(?:-\d+)?)?(?:-\d+)?$/i);
  if (!match) return null;
  const info = BOOKS[`${match[1]}corinthians`];
  const chapter = Number(match[2]);
  if (!inRange(info, chapter)) return null;
  return { book: info.book, bookApi: info.bookApi, chapter };
}

function parseApiReference(ref) {
  const match = ref.match(/^([12]CO)\.(\d+)(?:\.\d+(?:-\d+)?)?$/i);
  if (!match) return null;
  const info = API_BOOKS[match[1].toUpperCase()];
  const chapter = Number(match[2]);
  if (!info || !inRange(info, chapter)) return null;
  return { book: info.book, bookApi: info.bookApi, chapter };
}

export function parseReference(ref) {
  const value = cleanRef(ref);
  if (!value) return null;
  return parseApiReference(value) || parseNamedReference(value);
}

export function parseReaderSearch(search) {
  const params = new URLSearchParams(String(search || ""));
  return parseReference(params.get("ref"));
}

export function chapterReference(book, chapter) {
  return `${book} ${chapter}`;
}

export function buildReaderUrl(ref) {
  return `reader.html?ref=${encodeURIComponent(String(ref || ""))}`;
}

export function previousChapter(route) {
  if (!route) return null;
  if (route.chapter > 1) {
    return { ...route, chapter: route.chapter - 1 };
  }
  if (route.bookApi === "2CO") {
    return { book: "1 Corinthians", bookApi: "1CO", chapter: 16 };
  }
  return null;
}

export function nextChapter(route) {
  if (!route) return null;
  const info = API_BOOKS[route.bookApi];
  if (!info) return null;
  if (route.chapter < info.chapters) {
    return { ...route, chapter: route.chapter + 1 };
  }
  if (route.bookApi === "1CO") {
    return { book: "2 Corinthians", bookApi: "2CO", chapter: 1 };
  }
  return null;
}

export function getReaderWeek(route) {
  if (!route) return null;
  return WEEKS.find((week) => week.bookApi === route.bookApi && week.chapters.includes(route.chapter)) || null;
}
