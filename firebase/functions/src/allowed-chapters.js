"use strict";

const ALLOWED_BOOKS = {
  "1CO": createChapterSet(16),
  "2CO": createChapterSet(13)
};

function createChapterSet(lastChapter) {
  return new Set(Array.from({ length: lastChapter }, (_, index) => index + 1));
}

function getAllowedBooks() {
  return Object.keys(ALLOWED_BOOKS);
}

function isAllowedBook(book) {
  return Object.hasOwn(ALLOWED_BOOKS, book);
}

function isAllowedChapter(book, chapter) {
  return isAllowedBook(book) && ALLOWED_BOOKS[book].has(chapter);
}

function getAllowedChapterIds() {
  return getAllowedBooks().flatMap((book) =>
    Array.from(ALLOWED_BOOKS[book], (chapter) => `${book}.${chapter}`)
  );
}

module.exports = {
  getAllowedBooks,
  getAllowedChapterIds,
  isAllowedBook,
  isAllowedChapter
};
