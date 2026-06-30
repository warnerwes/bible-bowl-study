/* Bible Bowl Study - post-mastery Refiner Trial */

(() => {
  "use strict";

  const STATS_KEY = "bbs:stats:v1";
  const TRIAL_STATS_KEY = "bbs:refiner-stats:v1";
  const BEST_KEY = "bbs:refiner-best:v1";
  const LEVEL_KEY = "bbs:refiner-level:v1";
  const MASTERY_STREAK = 3;
  const QA_MODE = new URLSearchParams(location.search).get("qa") === "1";
  const TRIAL_COUNT = QA_MODE ? 5 : 20;
  const BASE_SECONDS_PER_QUESTION = 15;
  const LEVEL_TIME_DROPS = [0, 5, 3, 2, 1];
  const STARTING_LIVES = 3;
  const MAX_LEVEL = LEVEL_TIME_DROPS.length - 1;

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const QUESTIONS_URL = new URL("data/questions.json", SCRIPT_URL || window.location.href).href;

  let questions = [];
  let trial = null;
  let timerId = null;
  let cta;
  let modal;

  const $ = (sel) => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function currentLevel() {
    const raw = Number(localStorage.getItem(LEVEL_KEY));
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(MAX_LEVEL, Math.floor(raw)));
  }

  function writeLevel(level) {
    try {
      localStorage.setItem(LEVEL_KEY, String(Math.max(0, Math.min(MAX_LEVEL, level))));
    } catch (_) {}
  }

  function secondsForLevel(level = currentLevel()) {
    let seconds = BASE_SECONDS_PER_QUESTION;
    for (let i = 1; i <= level; i++) seconds -= LEVEL_TIME_DROPS[i] || 0;
    return Math.max(1, seconds);
  }

  function levelName(level = currentLevel()) {
    return `Level ${level + 1}`;
  }

  function nextLevel(level = currentLevel()) {
    if (level >= MAX_LEVEL) return null;
    const next = level + 1;
    return {
      level: next,
      name: levelName(next),
      seconds: secondsForLevel(next),
      drop: LEVEL_TIME_DROPS[next],
    };
  }

  function stats() {
    return readJson(STATS_KEY, {});
  }

  function trialStats() {
    return readJson(TRIAL_STATS_KEY, {});
  }

  function masteredCount() {
    const s = stats();
    return questions.filter((q) => (s[q.id]?.streak || 0) >= MASTERY_STREAK).length;
  }

  function isFullyMastered() {
    return questions.length > 0 && masteredCount() === questions.length;
  }

  function hasReceivedGlory() {
    return isFullyMastered();
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[.,;:!?'"`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isCorrect(q, answer) {
    if (q.type === "multiple-choice" || q.type === "true-false") {
      return normalize(answer) === normalize(q.answer);
    }
    const accepted = [q.answer, ...(q.acceptableAnswers || [])];
    return accepted.some((item) => normalize(item) === normalize(answer));
  }

  function weaknessScore(q) {
    const s = stats()[q.id] || {};
    const t = trialStats()[q.id] || {};
    const right = s.right || 0;
    const wrong = s.wrong || 0;
    const attempts = Math.max(1, right + wrong);
    const accuracyPenalty = 1 - right / attempts;
    const typePressure = q.type === "fill-in" ? 1.2 : 0;
    return (
      wrong * 5 +
      accuracyPenalty * 8 +
      (t.wrong || 0) * 8 +
      (t.timeout || 0) * 10 +
      (t.right || 0) * -1 +
      typePressure
    );
  }

  function questionWeight(q) {
    return Math.max(1, 1 + weaknessScore(q));
  }

  function weightedIndex(pool, flattenWeights) {
    const total = pool.reduce((sum, item) => {
      const weight = flattenWeights ? Math.sqrt(item.weight) : item.weight;
      return sum + Math.max(1, weight);
    }, 0);
    let ticket = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      const weight = Math.max(1, flattenWeights ? Math.sqrt(pool[i].weight) : pool[i].weight);
      ticket -= weight;
      if (ticket <= 0) return i;
    }
    return pool.length - 1;
  }

  function selectQuestions() {
    const pool = questions.map((q) => ({ q, weight: questionWeight(q) }));
    const deck = [];
    const target = Math.min(TRIAL_COUNT, pool.length);
    while (deck.length < target && pool.length) {
      const surpriseSlot = deck.length > 0 && (deck.length + 1) % 4 === 0;
      const idx = weightedIndex(pool, surpriseSlot);
      deck.push(pool[idx].q);
      pool.splice(idx, 1);
    }
    return deck;
  }

  function bestRecord() {
    return readJson(BEST_KEY, null);
  }

  function medalFor(correct, total, lives) {
    if (correct === total && lives === STARTING_LIVES) return "gold";
    if (correct >= Math.ceil(total * 0.85) && lives >= 2) return "silver";
    return "bronze";
  }

  function medalLabel(tier) {
    if (tier === "gold") return "Gold";
    if (tier === "silver") return "Silver";
    return "Bronze";
  }

  function recordTrialResult() {
    const total = trial.deck.length;
    const tier = medalFor(trial.correct, total, trial.lives);
    const score = trial.level * 10000 + trial.correct * 100 + trial.lives * 25;
    const record = {
      tier,
      score,
      level: trial.level,
      levelName: levelName(trial.level),
      secondsPerQuestion: trial.secondsPerQuestion,
      correct: trial.correct,
      total,
      lives: trial.lives,
      at: new Date().toISOString(),
    };
    const prior = bestRecord();
    if (!prior || score > prior.score || (score === prior.score && trial.lives > prior.lives)) {
      writeJson(BEST_KEY, record);
      record.isNewBest = true;
    }
    if (tier === "gold") {
      const unlocked = nextLevel(trial.level);
      if (unlocked && currentLevel() <= trial.level) {
        writeLevel(unlocked.level);
        record.unlockedNext = unlocked;
      }
    }
    return record;
  }

  function updateTrialStat(qid, field) {
    const all = trialStats();
    const row = all[qid] || { right: 0, wrong: 0, timeout: 0 };
    row[field] = (row[field] || 0) + 1;
    all[qid] = row;
    writeJson(TRIAL_STATS_KEY, all);
  }

  function ensureCta() {
    if (cta) return;
    cta = el("div", "refiner-cta");
    cta.id = "refiner-trial-cta";
    cta.hidden = true;
    cta.innerHTML = `
      <div class="refiner-copy">
        <span class="refiner-kicker">Glory earned</span>
        <strong>Refiner Trial</strong>
        <span>Weighted weak spots / ${BASE_SECONDS_PER_QUESTION}s each / ${STARTING_LIVES} lives</span>
      </div>
      <button type="button" id="refiner-start" class="primary-btn ghost-btn">Start trial</button>
    `;
    const anchor = document.getElementById("mastered-cta") || document.getElementById("missed-cta");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(cta, anchor.nextSibling);
    else document.getElementById("home")?.appendChild(cta);
    cta.querySelector("#refiner-start").addEventListener("click", startTrial);
  }

  function ensureModal() {
    if (modal) return;
    modal = el("div", "refiner-modal");
    modal.id = "refiner-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="refiner-card">
        <header class="refiner-head">
          <div>
            <span class="refiner-kicker">Refiner Trial</span>
            <h2 id="refiner-title">Weak spots under pressure</h2>
          </div>
          <button type="button" class="refiner-close" aria-label="Close Refiner Trial">&times;</button>
        </header>
        <div id="refiner-body" class="refiner-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".refiner-close").addEventListener("click", closeTrial);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeTrial();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("active")) closeTrial();
    });
  }

  function refreshCta() {
    ensureCta();
    const unlocked = questions.length > 0 && hasReceivedGlory();
    cta.classList.toggle("glory-ready", unlocked);
    if (!unlocked) {
      cta.hidden = true;
      return;
    }
    cta.hidden = false;
    const level = currentLevel();
    const seconds = secondsForLevel(level);
    const best = bestRecord();
    const copy = cta.querySelector(".refiner-copy span:last-child");
    cta.querySelector("#refiner-start").textContent = `Start ${levelName(level)}`;
    copy.textContent = best
      ? `${levelName(level)} / ${seconds}s each / Best: ${medalLabel(best.tier)} ${best.correct}/${best.total}`
      : `${levelName(level)} / weighted weak spots / ${seconds}s each / ${STARTING_LIVES} lives`;
  }

  async function loadQuestions() {
    if (questions.length) return questions;
    const res = await fetch(QUESTIONS_URL, { cache: "no-cache" });
    const data = await res.json();
    questions = Array.isArray(data) ? data : data.questions || [];
    refreshCta();
    return questions;
  }

  function startTrial() {
    if (!hasReceivedGlory()) return;
    ensureModal();
    const level = currentLevel();
    trial = {
      deck: selectQuestions(),
      level,
      secondsPerQuestion: secondsForLevel(level),
      index: 0,
      lives: STARTING_LIVES,
      correct: 0,
      answered: false,
      missed: [],
      deadline: 0,
    };
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    renderQuestion();
  }

  function closeTrial() {
    clearTimer();
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    trial = null;
    refreshCta();
  }

  function clearTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    clearTimer();
    trial.deadline = Date.now() + trial.secondsPerQuestion * 1000;
    timerId = setInterval(() => {
      if (!trial || trial.answered) return;
      const remaining = Math.max(0, trial.deadline - Date.now());
      updateTimer(remaining);
      if (remaining <= 0) answerCurrent(null, true);
    }, 100);
    updateTimer(trial.secondsPerQuestion * 1000);
  }

  function updateTimer(ms) {
    const seconds = Math.ceil(ms / 1000);
    const text = $("#refiner-time");
    const bar = $("#refiner-time-fill");
    if (text) text.textContent = `${seconds}s`;
    const totalMs = (trial?.secondsPerQuestion || BASE_SECONDS_PER_QUESTION) * 1000;
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, ms / totalMs)) * 100}%`;
  }

  function renderQuestion() {
    clearTimer();
    const body = $("#refiner-body");
    const q = trial.deck[trial.index];
    trial.answered = false;
    body.innerHTML = "";

    const shell = el("div", "refiner-question");
    shell.innerHTML = `
      <div class="refiner-meta">
        <span>${trial.index + 1}/${trial.deck.length}</span>
        <span>${levelName(trial.level)}</span>
        <span>${trial.lives} lives</span>
        <span id="refiner-time">${trial.secondsPerQuestion}s</span>
      </div>
      <div class="refiner-timer"><div id="refiner-time-fill"></div></div>
      <div class="q-tags">
        <span class="tag tag-ref">${escapeHtml(q.reference)}</span>
        <span class="tag">${escapeHtml(q.topic)}</span>
        <span class="tag tag-type">${escapeHtml(q.type)}</span>
      </div>
      <h3 class="refiner-q-text">${escapeHtml(q.question)}</h3>
      <div id="refiner-answer" class="refiner-answer"></div>
      <div id="refiner-feedback" class="refiner-feedback" hidden></div>
    `;
    body.appendChild(shell);

    const answer = $("#refiner-answer");
    if (q.type === "fill-in") {
      const form = el("form", "refiner-fill");
      form.innerHTML = `
        <input id="refiner-fill-input" autocomplete="off" />
        <button type="submit" class="primary-btn">Answer</button>
      `;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        answerCurrent($("#refiner-fill-input").value);
      });
      answer.appendChild(form);
      setTimeout(() => $("#refiner-fill-input")?.focus(), 50);
    } else {
      const opts = (q.options || ["True", "False"]).slice().sort(() => Math.random() - 0.5);
      opts.forEach((option) => {
        const btn = el("button", "option-btn", option);
        btn.type = "button";
        btn.addEventListener("click", () => answerCurrent(option));
        answer.appendChild(btn);
      });
    }
    startTimer();
  }

  function answerCurrent(value, timedOut = false) {
    if (!trial || trial.answered) return;
    const q = trial.deck[trial.index];
    const correct = !timedOut && isCorrect(q, value);
    trial.answered = true;
    clearTimer();

    if (correct) {
      trial.correct++;
      updateTrialStat(q.id, "right");
    } else {
      trial.lives--;
      trial.missed.push(q);
      updateTrialStat(q.id, timedOut ? "timeout" : "wrong");
    }

    $("#refiner-answer")?.querySelectorAll("button,input").forEach((node) => {
      node.disabled = true;
    });
    showFeedback(q, correct, timedOut);
  }

  function showFeedback(q, correct, timedOut) {
    const box = $("#refiner-feedback");
    box.hidden = false;
    box.className = "refiner-feedback " + (correct ? "right" : "wrong");
    const done = trial.lives <= 0 || trial.index >= trial.deck.length - 1;
    const aid = !correct && q.memoryAid?.text ? `<p class="refiner-aid">${escapeHtml(q.memoryAid.text)}</p>` : "";
    box.innerHTML = `
      <strong>${correct ? "Correct." : timedOut ? "Time." : "Miss."}</strong>
      ${correct ? "" : `<p>Answer: <span>${escapeHtml(q.answer)}</span></p>${aid}`}
      <button type="button" class="primary-btn">${done ? "See result" : "Next"}</button>
    `;
    box.querySelector("button").addEventListener("click", () => {
      if (done) finishTrial();
      else {
        trial.index++;
        renderQuestion();
      }
    });
  }

  function finishTrial() {
    clearTimer();
    const result = recordTrialResult();
    const body = $("#refiner-body");
    const nextCopy = result.unlockedNext
      ? `<p class="refiner-next">${escapeHtml(result.unlockedNext.name)} unlocked: ${result.unlockedNext.seconds}s each.</p>`
      : result.tier === "gold" && result.level >= MAX_LEVEL
        ? `<p class="refiner-next">Final Refiner level mastered.</p>`
        : "";
    body.innerHTML = `
      <div class="refiner-result">
        <span class="refiner-kicker">${result.isNewBest ? "New best" : "Trial complete"}</span>
        <h3>${medalLabel(result.tier)} Refiner</h3>
        <p>${escapeHtml(result.levelName)} / ${result.secondsPerQuestion}s each</p>
        <p>${result.correct}/${result.total} correct / ${result.lives} lives left</p>
        ${nextCopy}
        <div class="refiner-result-actions">
          <button type="button" class="primary-btn" id="refiner-retry">${result.unlockedNext ? "Run next level" : "Run it again"}</button>
          <button type="button" class="primary-btn ghost-btn" id="refiner-done">Done</button>
        </div>
      </div>
    `;
    $("#refiner-retry").addEventListener("click", startTrial);
    $("#refiner-done").addEventListener("click", closeTrial);
    refreshCta();
  }

  function init() {
    ensureCta();
    ensureModal();
    loadQuestions().catch(() => {
      if (cta) cta.hidden = true;
    });
  }

  window.addEventListener("bbs:stats-updated", () => {
    loadQuestions().then(refreshCta).catch(() => {});
  });
  window.addEventListener("storage", refreshCta);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  if (QA_MODE) {
    window.BibleBowlRefinerQA = {
      start: startTrial,
      state: () => trial && {
        ids: trial.deck.map((q) => q.id),
        level: trial.level,
        secondsPerQuestion: trial.secondsPerQuestion,
        index: trial.index,
        lives: trial.lives,
        correct: trial.correct,
        answered: trial.answered,
      },
      answerCurrent,
      answerCorrect: () => {
        const q = trial?.deck[trial.index];
        if (q) answerCurrent(q.answer);
      },
      answerWrong: () => answerCurrent("__wrong__"),
      forceTimeout: () => answerCurrent(null, true),
      next: () => $("#refiner-feedback button")?.click(),
      isUnlocked: hasReceivedGlory,
      sampleDeckIds: (count = 5) => Array.from({ length: count }, () => selectQuestions().map((q) => q.id)),
      questionWeights: () => Object.fromEntries(questions.map((q) => [q.id, questionWeight(q)])),
      levelInfo: () => ({
        currentLevel: currentLevel(),
        currentName: levelName(),
        currentSeconds: secondsForLevel(),
        levels: LEVEL_TIME_DROPS.map((_, level) => ({
          level,
          name: levelName(level),
          seconds: secondsForLevel(level),
        })),
      }),
    };
  }
})();
