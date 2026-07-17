"use strict";

const BOOKS = {
  "1CO": {
    api: "1CO",
    name: "1 Corinthians",
    chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  },
  "2CO": {
    api: "2CO",
    name: "2 Corinthians",
    chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
  },
};

const WEEKS = [
  createWeek(1, "1CO", [1, 2]),
  createWeek(2, "1CO", [3, 4]),
  createWeek(3, "1CO", [5, 6]),
  createWeek(4, "1CO", [7, 8]),
  createWeek(5, "1CO", [9, 10]),
  createWeek(6, "1CO", [11, 12]),
  createWeek(7, "1CO", [13, 14]),
  createWeek(8, "1CO", [15, 16]),
  createWeek(9, "2CO", [1, 2]),
  createWeek(10, "2CO", [3, 4]),
  createWeek(11, "2CO", [5, 6]),
  createWeek(12, "2CO", [7, 8]),
  createWeek(13, "2CO", [9, 10]),
  createWeek(14, "2CO", [11, 12]),
  createWeek(15, "2CO", [13]),
];

const WEEK_BY_KEY = new Map(WEEKS.map((week) => [week.weekKey, week]));
const WEEK_BY_CHAPTER_ID = new Map();
for (const week of WEEKS) {
  for (const chapter of week.chapters) {
    WEEK_BY_CHAPTER_ID.set(`${week.book}.${chapter}`, week);
  }
}

function createWeek(weekNumber, book, chapters) {
  const bookInfo = BOOKS[book];
  const totalVerses = chapters.reduce((sum, chapter) => sum + bookInfo.chapters[chapter - 1], 0);
  return {
    weekNumber,
    weekKey: `${book}:${chapters.join("-")}`,
    book,
    bookName: bookInfo.name,
    chapters: [...chapters],
    totalVerses,
    label: `${bookInfo.name} ${formatChapterLabel(chapters)}`,
    chapterRefs: chapters.map((chapter) => `${bookInfo.name} ${chapter}`),
  };
}

function formatChapterLabel(chapters) {
  return chapters.length === 1 ? `${chapters[0]}` : `${chapters[0]}-${chapters[chapters.length - 1]}`;
}

function isAllowedBook(book) {
  return Object.hasOwn(BOOKS, book);
}

function isAllowedChapter(book, chapter) {
  return isAllowedBook(book)
    && Number.isInteger(chapter)
    && chapter >= 1
    && chapter <= BOOKS[book].chapters.length;
}

function getAllowedBooks() {
  return Object.keys(BOOKS);
}

function getAllowedChapterIds() {
  return getAllowedBooks().flatMap((book) =>
    BOOKS[book].chapters.map((_, index) => `${book}.${index + 1}`)
  );
}

function getExpectedVerseCount(book, chapter) {
  return isAllowedChapter(book, chapter) ? BOOKS[book].chapters[chapter - 1] : 0;
}

function getWeekForChapter(book, chapter) {
  return WEEK_BY_CHAPTER_ID.get(`${book}.${chapter}`) || null;
}

function getWeekByKey(weekKey) {
  return WEEK_BY_KEY.get(String(weekKey || "")) || null;
}

function buildOwnedWeeksSummary(weekKeys, expiresAt) {
  return (Array.isArray(weekKeys) ? weekKeys : [])
    .map((weekKey) => {
      const week = getWeekByKey(weekKey);
      if (!week) return null;
      return {
        weekKey: week.weekKey,
        label: week.label,
        book: week.book,
        chapters: [...week.chapters],
        expiresAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.weekKey.localeCompare(right.weekKey));
}

module.exports = {
  BOOKS,
  WEEKS,
  buildOwnedWeeksSummary,
  getAllowedBooks,
  getAllowedChapterIds,
  getExpectedVerseCount,
  getWeekByKey,
  getWeekForChapter,
  isAllowedBook,
  isAllowedChapter,
};
