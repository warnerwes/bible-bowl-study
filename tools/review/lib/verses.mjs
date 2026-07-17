import crypto from "node:crypto";

export const BOOKS = {
  "1 Corinthians": {
    slug: "1cor",
    order: 1,
    chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  },
  "2 Corinthians": {
    slug: "2cor",
    order: 2,
    chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
  },
};

const BOOK_NAMES = new Set(Object.keys(BOOKS));
const REFERENCE_RE = /^(1 Corinthians|2 Corinthians)\s+(\d+):(\d+)(?:-(\d+))?$/;

export function domainError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function getBookInfo(book) {
  const info = BOOKS[book];
  if (!info) {
    throw domainError("UNSUPPORTED_BOOK", `Unsupported book "${book}".`, { book });
  }
  return info;
}

export function validateBookChapter(book, chapter) {
  const info = getBookInfo(book);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > info.chapters.length) {
    throw domainError("INVALID_CHAPTER", `Unsupported chapter ${chapter} for ${book}.`, {
      book,
      chapter,
    });
  }
  return info;
}

export function canonicalReference(book, chapter, startVerse, endVerse = startVerse) {
  return startVerse === endVerse
    ? `${book} ${chapter}:${startVerse}`
    : `${book} ${chapter}:${startVerse}-${endVerse}`;
}

export function verseKey(book, chapter, verse) {
  return `${getBookInfo(book).slug}:${chapter}:${verse}`;
}

export function parseVerseDeclaration(reference, expectedBook, expectedChapter) {
  const match = REFERENCE_RE.exec(reference.trim());
  if (!match) {
    throw domainError("INVALID_REFERENCE", `Invalid verse declaration "${reference}".`, {
      reference,
    });
  }

  const [, book, chapterText, startText, endText] = match;
  const chapter = Number(chapterText);
  const startVerse = Number(startText);
  const endVerse = Number(endText ?? startText);
  const info = validateBookChapter(book, chapter);
  const maxVerse = info.chapters[chapter - 1];

  if (expectedBook && book !== expectedBook) {
    throw domainError("REFERENCE_BOOK_MISMATCH", `Reference "${reference}" does not match ${expectedBook}.`, {
      reference,
      book,
      expectedBook,
    });
  }
  if (expectedChapter && chapter !== expectedChapter) {
    throw domainError("REFERENCE_CHAPTER_MISMATCH", `Reference "${reference}" does not match chapter ${expectedChapter}.`, {
      reference,
      chapter,
      expectedChapter,
    });
  }
  if (startVerse < 1 || endVerse < 1 || startVerse > maxVerse || endVerse > maxVerse || endVerse < startVerse) {
    throw domainError("INVALID_REFERENCE_RANGE", `Reference "${reference}" is out of bounds.`, {
      reference,
      maxVerse,
    });
  }

  return { book, chapter, startVerse, endVerse };
}

export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((left, right) => left.startVerse - right.startVerse);
  const merged = [];

  for (const range of sorted) {
    const current = merged[merged.length - 1];
    if (!current || range.startVerse > current.endVerse + 1) {
      merged.push({ ...range });
      continue;
    }
    current.endVerse = Math.max(current.endVerse, range.endVerse);
  }

  return merged;
}

export function expandRanges(book, chapter, ranges) {
  return ranges.flatMap(({ startVerse, endVerse }) => {
    const verses = [];
    for (let verse = startVerse; verse <= endVerse; verse += 1) {
      verses.push(verseKey(book, chapter, verse));
    }
    return verses;
  });
}

export function normalizeQuoteDecision({ book, chapter, noScriptureQuote = false, quotedVerses = [] }) {
  validateBookChapter(book, chapter);
  const refs = quotedVerses.filter(Boolean);

  if (noScriptureQuote === (refs.length > 0)) {
    throw domainError(
      "QUOTE_DECISION_REQUIRED",
      "Provide exactly one of --no-scripture-quote or --quotes-verses.",
      { noScriptureQuote, quotedVerses: refs }
    );
  }

  if (noScriptureQuote) {
    return {
      mode: "no-scripture-quote",
      references: [],
      ranges: [],
      verseKeys: [],
      occurrenceCount: 0,
    };
  }

  const parsedRanges = refs.map((reference) => parseVerseDeclaration(reference, book, chapter));
  const mergedRanges = mergeRanges(parsedRanges);
  for (const range of mergedRanges) {
    const length = range.endVerse - range.startVerse + 1;
    if (length > 8) {
      throw domainError("VERSE_RANGE_TOO_LONG", "Quoted verse ranges may not exceed eight consecutive verses.", {
        reference: canonicalReference(book, chapter, range.startVerse, range.endVerse),
        consecutiveVerses: length,
      });
    }
  }

  const verseKeys = expandRanges(book, chapter, mergedRanges);
  return {
    mode: "quotes-verses",
    references: mergedRanges.map((range) =>
      canonicalReference(book, chapter, range.startVerse, range.endVerse)
    ),
    ranges: mergedRanges.map((range) => ({
      startVerse: range.startVerse,
      endVerse: range.endVerse,
    })),
    verseKeys,
    occurrenceCount: verseKeys.length,
  };
}

export function countQuotedOccurrences(entries) {
  return entries.reduce((sum, entry) => sum + (entry.verseKeys?.length ?? 0), 0);
}

export function questionTextKey(question) {
  return String(question)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function derivePayloadId({ kind, book, chapter, suggestionPath }) {
  validateBookChapter(book, chapter);
  const digest = crypto.createHash("sha256").update(String(suggestionPath)).digest("hex").slice(0, 12);
  const slug = BOOKS[book].slug;
  return kind === "memory_hook" || kind === "surprising_fact"
    ? `mh-${slug}${chapter}-${digest}`
    : `${slug}${chapter}-sug-${digest}`;
}

export function compareQuestionOrder(left, right) {
  const leftInfo = getBookInfo(left.book);
  const rightInfo = getBookInfo(right.book);
  return (
    leftInfo.order - rightInfo.order ||
    left.chapter - right.chapter ||
    Number(Boolean(left.placeholder)) - Number(Boolean(right.placeholder)) ||
    left.id.localeCompare(right.id)
  );
}

export function compareHookOrder(left, right) {
  const leftInfo = getBookInfo(left.book);
  const rightInfo = getBookInfo(right.book);
  return leftInfo.order - rightInfo.order || left.chapter - right.chapter || left.id.localeCompare(right.id);
}
