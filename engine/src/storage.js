/* Storage layer — the localStorage stats layer extracted from app.js.
   Book-agnostic: the stats key comes from config (default "bbs:stats:v1").
   Pure browser JS (ES module), framework-free.

   Per-question stat shape: { wrong, right, streak, seen }
     - streak = consecutive correct answers; resets to 0 on a miss. */
"use strict";

const MASTERY_STREAK = 3; // correct answers in a row to "master" a question
export { MASTERY_STREAK };

export function createStorage(config) {
  const key = (config && config.statsKey) || "bbs:stats:v1";

  // Per-instance stats cache.
  let stats = {};

  function load() {
    try {
      stats = JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
      stats = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(stats));
      if (typeof window !== "undefined" && typeof CustomEvent === "function" &&
          typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("bbs:stats-updated",
          { detail: { total: stats._total || 0 } }));
      }
    } catch (e) {}
  }

  function all() {
    return stats;
  }

  function get(id) {
    return stats[id];
  }

  function recordResult(q, correct) {
    const s = stats[q.id] || { wrong: 0, right: 0, streak: 0, seen: 0 };
    s.seen += 1;
    if (correct) { s.right += 1; s.streak += 1; }
    else { s.wrong += 1; s.streak = 0; }
    stats[q.id] = s;
    save();
    return s;
  }

  function isMastered(q) {
    const s = stats[q.id];
    return !!s && (s.streak || 0) >= MASTERY_STREAK;
  }

  function isDue(q) {
    const s = stats[q.id];
    return !!s && (s.wrong || 0) > 0 && (s.streak || 0) < MASTERY_STREAK;
  }

  function resetAll() {
    stats = {};
    save();
  }

  function resetMastered(questionList) {
    (questionList || []).forEach((q) => { delete stats[q.id]; });
    save();
  }

  return {
    key,
    masteryStreak: MASTERY_STREAK,
    load,
    save,
    all,
    get,
    recordResult,
    isMastered,
    isDue,
    resetAll,
    resetMastered,
  };
}