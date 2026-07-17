"use strict";

function listChildNodes(node) {
  if (!node) return [];
  if (node.childNodes && typeof node.childNodes.length === "number") {
    return Array.from(node.childNodes);
  }
  if (node.children && typeof node.children.length === "number") {
    return Array.from(node.children);
  }
  return [];
}

function isElement(node) {
  return Boolean(node) && node.nodeType !== 3;
}

function hasClass(node, className) {
  return isElement(node) && String(node.className || "").split(/\s+/).includes(className);
}

function acceptedCount(entries) {
  return (entries || []).filter((entry) => entry.status === "approved" || entry.status === "exported").length;
}

function firstLine(text) {
  return String(text || "").trim().split(/\r?\n/, 1)[0] || "";
}

function describeMarker(verse, entryCount, accepted, noteCount) {
  const parts = [`Verse ${verse} options`];
  if (entryCount) {
    parts.push(`${entryCount} submission${entryCount === 1 ? "" : "s"}`);
  }
  if (accepted) {
    parts.push(`${accepted} accepted`);
  }
  if (noteCount) {
    parts.push(`${noteCount} private note${noteCount === 1 ? "" : "s"}`);
  }
  return parts.join(". ");
}

export function applyVerseAdornments({ content, notesByVerse = {}, entriesByVerse = {} }) {
  for (const node of listChildNodes(content)) {
    if (!hasClass(node, "verse-marker")) continue;
    const verse = Number(node.getAttribute("data-verse"));
    const entries = entriesByVerse[String(verse)] || [];
    const notes = notesByVerse[String(verse)] || [];
    const accepted = acceptedCount(entries);
    const siblings = listChildNodes(content);
    const start = siblings.indexOf(node);
    const clue = siblings[start + 1];
    const preview = siblings[start + 3];

    node.setAttribute("aria-label", describeMarker(verse, entries.length, accepted, notes.length));
    if (clue && clue.getAttribute && clue.getAttribute("data-reader-adornment") != null) {
      clue.textContent = entries.length ? `•${entries.length}${accepted ? ` ⭐${accepted}` : ""}` : "";
      clue.hidden = !entries.length;
    }
    if (preview && preview.getAttribute && preview.getAttribute("data-reader-adornment") != null) {
      const newest = notes[0];
      preview.textContent = newest ? `Your note: ${firstLine(newest.text)}` : "";
      preview.hidden = !newest;
    }
  }
}
