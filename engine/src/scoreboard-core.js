"use strict";

import { ensureFirebase } from "./firebase-client.js";
import {
  persistAuthorName,
  readAuthorName,
  ensureSignedInUser,
  resolveAuthorName,
  waitForExistingSession,
} from "./suggest-core.js";

export const SCOREBOARD_OPT_IN_KEY = "bbs:scoreboardOptIn:v1";
export const SCOREBOARD_LIMIT = 20;

function readStoredFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStoredFlag(key, enabled) {
  try {
    if (enabled) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {}
}

function clampCount(value, max) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.min(Math.floor(count), max);
}

function trimName(value) {
  return String(value || "").trim().slice(0, 40);
}

function questionIdsForBank(questions) {
  const ids = new Set();
  for (const question of questions || []) {
    const id = String(question && question.id ? question.id : "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function statStreak(stats, id) {
  const entry = stats && typeof stats === "object" ? stats[id] : null;
  if (!entry || typeof entry !== "object") return 0;
  return clampCount(entry.streak, 500);
}

export function computeMasterySnapshot({ questions, stats, masteryStreak = 3 }) {
  const ids = questionIdsForBank(questions);
  let mastered = 0;
  for (const id of ids) {
    if (statStreak(stats, id) >= masteryStreak) mastered += 1;
  }
  return {
    mastered,
    total: ids.size,
  };
}

export function readScoreboardOptIn() {
  return readStoredFlag(SCOREBOARD_OPT_IN_KEY);
}

export function writeScoreboardOptIn(enabled) {
  writeStoredFlag(SCOREBOARD_OPT_IN_KEY, enabled);
}

function sortRows(rows) {
  return [...rows].sort((left, right) =>
    clampCount(right.mastered, 500) - clampCount(left.mastered, 500) ||
    String(left.updatedAt || "").localeCompare(String(right.updatedAt || "")) ||
    String(left.uid || "").localeCompare(String(right.uid || ""))
  );
}

function asIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value || "");
}

function normalizeScoreboardRow(snapshot) {
  const data = typeof snapshot.data === "function" ? snapshot.data() : {};
  return {
    uid: snapshot.id,
    authorName: trimName(data.authorName),
    mastered: clampCount(data.mastered, 500),
    total: clampCount(data.total, 500),
    updatedAt: asIsoString(data.updatedAt),
  };
}

function clearNode(node) {
  if (typeof node.replaceChildren === "function") {
    node.replaceChildren();
    return;
  }
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function syncStatusCopy(status) {
  if (status === "joined") return "Joined the scoreboard.";
  if (status === "saved") return "Scoreboard synced.";
  if (status === "error") return "Scoreboard unavailable right now.";
  return "";
}

export function renderScoreboard(root, model) {
  clearNode(root);

  const section = el("section", "scoreboard-panel");
  section.appendChild(el("h3", "scoreboard-title", "Scoreboard"));
  section.appendChild(el("p", "scoreboard-mastered", `Mastered: ${model.snapshot.mastered}`));

  const statusText = syncStatusCopy(model.syncStatus);
  if (statusText) {
    section.appendChild(el("p", "scoreboard-sync muted", statusText));
  }

  if (model.showPrompt) {
    const prompt = el("form", "scoreboard-join");
    const label = el("label", "field-label", "Join the scoreboard");
    label.setAttribute("for", "scoreboard-name");
    const help = el(
      "p",
      "muted scoreboard-help",
      "Master 3-in-a-row on a question to join. Your name shows on the results scoreboard."
    );
    const input = el("input", "text-input");
    input.id = "scoreboard-name";
    input.name = "authorName";
    input.type = "text";
    input.maxLength = 40;
    input.required = true;
    input.autocomplete = "name";
    input.value = model.authorName;
    const button = el("button", "primary-btn", "Join the scoreboard");
    button.type = "submit";
    prompt.appendChild(label);
    prompt.appendChild(help);
    prompt.appendChild(input);
    prompt.appendChild(button);
    prompt.addEventListener("submit", (event) => {
      event.preventDefault();
      if (typeof model.onJoin === "function") {
        model.onJoin(input.value);
      }
    });
    section.appendChild(prompt);
  }

  if (!model.rows.length && !model.showPrompt) {
    section.appendChild(el(
      "p",
      "muted scoreboard-empty",
      "No one on the scoreboard yet — master 3-in-a-row on a question to join."
    ));
    root.appendChild(section);
    return;
  }

  const list = el("ol", "scoreboard-list");
  model.rows.forEach((row, index) => {
    const item = el("li", `scoreboard-row${row.uid === model.ownUid ? " is-self" : ""}`);
    item.appendChild(el("span", "scoreboard-rank", `#${index + 1}`));
    item.appendChild(el("span", "scoreboard-name", row.authorName || "Anonymous"));
    item.appendChild(el("span", "scoreboard-count", `${row.mastered}`));
    list.appendChild(item);
  });
  section.appendChild(list);
  root.appendChild(section);
}

async function ensureScoreboardUser(config) {
  const firebase = await ensureFirebase(config && config.firebase);
  const existing = await waitForExistingSession(firebase);
  const user = existing || await ensureSignedInUser(firebase);
  return { firebase, user };
}

async function syncOwnMastery({ firebase, user, snapshot, authorName }) {
  if (!user || !user.uid || snapshot.mastered < 1) return false;
  await firebase.setDoc(firebase.doc(firebase.db, `mastery/${user.uid}`), {
    authorName: trimName(authorName),
    mastered: snapshot.mastered,
    total: snapshot.total,
    updatedAt: firebase.serverTimestamp(),
  });
  return true;
}

async function fetchTopRows(firebase) {
  const results = await firebase.getDocs(
    firebase.query(
      firebase.collection(firebase.db, "mastery"),
      firebase.orderBy("mastered", "desc"),
      firebase.orderBy("updatedAt", "asc"),
      firebase.limit(SCOREBOARD_LIMIT)
    )
  );
  return sortRows(results.docs.map((doc) => normalizeScoreboardRow(doc))).slice(0, SCOREBOARD_LIMIT);
}

export function mountResultsScoreboard({ root, config, storage, questions }) {
  async function load(syncStatus = "") {
    if (!root) return null;

    const snapshot = computeMasterySnapshot({
      questions,
      stats: storage && typeof storage.all === "function" ? storage.all() : {},
      masteryStreak: storage && storage.masteryStreak ? storage.masteryStreak : 3,
    });
    const optedIn = readScoreboardOptIn();
    const authorName = trimName(await resolveAuthorName({ config }));
    const model = {
      authorName,
      onJoin: null,
      ownUid: "",
      rows: [],
      showPrompt: !optedIn && snapshot.mastered >= 1,
      snapshot,
      syncStatus,
    };

    if (!config || !config.firebase) {
      renderScoreboard(root, model);
      return model;
    }

    try {
      const { firebase, user } = await ensureScoreboardUser(config);
      model.ownUid = user && user.uid ? user.uid : "";
      if (optedIn && snapshot.mastered >= 1) {
        const didSync = await syncOwnMastery({
          firebase,
          user,
          snapshot,
          authorName: model.authorName,
        });
        model.syncStatus = didSync ? "saved" : "";
      }
      model.rows = await fetchTopRows(firebase);
      model.onJoin = async (value) => {
        const nextName = trimName(value);
        if (!nextName) return;
        persistAuthorName(nextName);
        writeScoreboardOptIn(true);
        await load("joined");
      };
      renderScoreboard(root, model);
      return model;
    } catch {
      model.syncStatus = "error";
      renderScoreboard(root, model);
      return model;
    }
  }

  return { load };
}
