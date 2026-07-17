"use strict";

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

function textNode(value) {
  return document.createTextNode(value);
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
