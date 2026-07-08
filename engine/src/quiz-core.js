/* Quiz core — quiz state machine, question selection, and answer checking.
   Extracted from app.js and made book-agnostic. Pure browser JS (ES module),
   framework-free. Has no DOM dependency; rendering lives in quiz-render.js. */
"use strict";

// ---------- Answer normalization (fill-in) ----------
// Matches app.js's normalize exactly so quiz behavior is preserved.
function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/['’`]/g, "")            // drop apostrophes: "lord's" -> "lords"
    .replace(/[^a-z0-9]+/g, " ")     // any other punctuation -> a separator space
    .replace(/\b(the|a|an)\b/g, " ") // ignore articles
    .replace(/\s+/g, " ")
    .trim();
}

// Order-independent key: significant words, sorted. Connectors like "and"
// are dropped so "Ithamar Eleazar" matches "Eleazar and Ithamar".
function answerKey(s) {
  return normalize(s)
    .split(" ")
    .filter((w) => w && w !== "and")
    .sort()
    .join(" ");
}

export function fillInIsCorrect(input, q) {
  const guess = normalize(input);
  if (!guess) return false;
  const accepted = (q.acceptableAnswers && q.acceptableAnswers.length)
    ? q.acceptableAnswers
    : [q.answer];
  const guessKey = answerKey(input);
  return accepted.some((a) => {
    const na = normalize(a);
    if (na === guess) return true;
    if (na.length > 3 && (na.includes(guess) || guess.includes(na))) return true;
    return guessKey.length > 0 && answerKey(a) === guessKey;
  });
}

export function isCorrectAnswer(q, selected, typed) {
  if (q.type === "fill-in") {
    return fillInIsCorrect(typed != null ? typed : "", q);
  }
  // multiple-choice / true-false
  return normalize(selected) === normalize(q.answer);
}

// ---------- Reference resolution (config-driven) ----------
// Use q.reference when present; otherwise fall back to
// config.defaultBookLabel + " " + q.chapter.
export function referenceFor(q, config) {
  if (q.reference) return q.reference;
  const label = (config && config.defaultBookLabel) || "";
  return label ? `${label} ${q.chapter}` : String(q.chapter);
}

// ---------- Weighted selection ----------
// Higher weight => tends to appear earlier in a shuffle.
// weightFor depends on the storage layer's stats + mastery state.
function weightFor(q, storage) {
  const s = storage ? storage.get(q.id) : null;
  const masteryStreak = storage ? storage.masteryStreak : 3;
  if (!s) return 1.5;                              // unseen: slight edge over mastered
  if ((s.streak || 0) >= masteryStreak) return 0.35; // mastered: show rarely
  let w = 1;
  if (storage.isDue(q)) w += 3;                   // currently due for review
  w += Math.min(s.wrong || 0, 3);                  // missed a lot => more often
  return w;
}

// Weighted shuffle (Efraimidis–Spirakis): key = U^(1/weight), sort desc.
export function weightedOrder(arr, storage) {
  return arr
    .map((q) => ({
      q,
      k: Math.pow(Math.random(), 1 / Math.max(weightFor(q, storage), 0.01)),
    }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.q);
}

export function dueQuestions(all, storage) {
  return all.filter((q) => storage.isDue(q));
}

export function masteredQuestions(all, storage) {
  return all.filter((q) => storage.isMastered(q));
}

// ---------- Quiz state machine ----------
export function createState() {
  return {
    all: [],          // every question loaded
    quiz: [],         // current quiz subset (ordered)
    index: 0,
    score: 0,
    missed: [],       // questions answered wrong this session
    answered: false,  // whether current question has been checked
    selected: null,   // selected option for MC/TF
    mode: "quick",    // "quick" | "drill" | "review" | "custom"
  };
}

// Build the pool filtered by chapters + types (for custom mode). When no
// filters are supplied, returns all questions.
export function filterPool(all, chapters, types) {
  const chs = chapters && chapters.length ? new Set(chapters) : null;
  const typesSet = types && types.length ? new Set(types) : null;
  return all.filter((q) =>
    (!chs || chs.has(q.chapter)) && (!typesSet || typesSet.has(q.type)));
}

// Launch a quiz: set the ordered subset, reset counters, set mode.
export function launch(state, questions, mode) {
  state.quiz = questions;
  state.index = 0;
  state.score = 0;
  state.missed = [];
  state.mode = mode;
  state.answered = false;
  state.selected = null;
}

// Record an answer against state + storage. Returns { correct, newlyMastered,
// streakReset }.
export function submit(state, q, correct, storage) {
  state.answered = true;
  if (correct) state.score++;
  else state.missed.push(q);
  let newlyMastered = false;
  let streakReset = false;
  if (state.mode !== "review" && storage) {
    const prevStreak = storage.get(q.id) ? (storage.get(q.id).streak || 0) : 0;
    const s = storage.recordResult(q, correct);
    const masteryStreak = storage.masteryStreak;
    newlyMastered = correct && (s.streak || 0) === masteryStreak;
    streakReset = !correct && prevStreak > 0;
  }
  return { correct, newlyMastered, streakReset };
}

// Advance to the next question. Returns "results" when the quiz is finished,
// or "quiz" when another question remains.
export function next(state) {
  state.index++;
  return state.index >= state.quiz.length ? "results" : "quiz";
}

export { normalize };