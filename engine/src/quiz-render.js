/* Quiz render — DOM rendering + event wiring for the quiz engine.
   Extracted from app.js, made book-agnostic. Pure browser JS (ES module),
   framework-free.

   Reward/reader hooks stay as optional guarded calls:
     - window.BibleBowlHasPendingUnlock (typeof-guarded)
     - window.BibleBowlConsumeUnlockScroll (typeof-guarded)
   There is NO in-app scripture reader in the engine; passages link out to a
   licensed provider via passage-links.js. */
"use strict";

import { referenceFor, isCorrectAnswer, submit, next, launch } from "./quiz-core.js";
import { passageUrl, passageLabel } from "./passage-links.js";
import { exportAnki } from "./anki-export.js";

const TYPE_LABELS = {
  "multiple-choice": "Multiple choice",
  "true-false": "True / False",
  "fill-in": "Fill in",
};

// DOM helpers — look up by id / create an element.
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function show(screen) {
  ["setup", "quiz", "results"].forEach((s) => {
    const node = $(s);
    if (node) node.hidden = s !== screen;
  });
}

// Build the quiz controller bound to a specific DOM + state + storage + config.
// Returns an object with: load(questions), startQuick(), startDrill(),
// startCustom(), renderQuestion(), and an answer-form submit handler (wired
// automatically onto #answer-form).
export function createQuiz({ state, storage, config, weightedOrder }) {
  const cfg = config || {};

  // ---------- Load ----------
  async function load() {
    storage.load();
    try {
      const res = await fetch(cfg.questionsPath || "data/questions.json",
        { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.all = Array.isArray(data) ? data : data.questions;
      if (!state.all || !state.all.length) {
        throw new Error("No questions found.");
      }
      buildSetup();
      wireSubmit();
      wireNext();
    } catch (err) {
      const e = $("load-error");
      if (e) {
        e.hidden = false;
        e.textContent =
          "Could not load questions (" + err.message +
          "). If you opened this file directly, run a local server.";
      }
    }
  }

  // ---------- Setup / home screen ----------
  function buildSetup() {
    const chapters =
      [...new Set(state.all.map((q) => q.chapter))].sort((a, b) => a - b);
    const list = $("chapter-list");
    if (list) {
      list.innerHTML = "";
      chapters.forEach((ch) => {
        const label = el("label", "chip");
        const cb = el("input");
        cb.type = "checkbox";
        cb.value = String(ch);
        cb.checked = true;
        cb.className = "chapter-cb";
        label.appendChild(cb);
        label.appendChild(el("span", null, "Ch " + ch));
        list.appendChild(label);
      });
      list.addEventListener("change", updateSummary);
    }
    const typeList = $("type-list");
    if (typeList) typeList.addEventListener("change", updateSummary);
    const count = $("count");
    if (count) count.addEventListener("change", updateSummary);

    document.querySelectorAll("[data-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const want = btn.dataset.select === "all";
        document.querySelectorAll(".chapter-cb").forEach((cb) => (cb.checked = want));
        updateSummary();
      });
    });

    const qs = $("quick-start");
    if (qs) qs.addEventListener("click", startQuick);
    const dm = $("drill-missed");
    if (dm) dm.addEventListener("click", startDrill);
    const rm = $("review-mastered");
    if (rm) rm.addEventListener("click", startReview);
    const sb = $("start-btn");
    if (sb) sb.addEventListener("click", startCustom);
    const ec = $("export-csv");
    if (ec) ec.addEventListener("click", () => exportAnki(pool(),
      { config: cfg, referenceFor: (q) => referenceFor(q, cfg) }));

    refreshHome();
    updateSummary();
  }

  function selectedChapters() {
    return [...document.querySelectorAll(".chapter-cb:checked")]
      .map((cb) => Number(cb.value));
  }
  function selectedTypes() {
    const tl = $("type-list");
    if (!tl) return [];
    return [...tl.querySelectorAll("input:checked")].map((cb) => cb.value);
  }
  function pool() {
    const chs = new Set(selectedChapters());
    const types = new Set(selectedTypes());
    return state.all.filter((q) => chs.has(q.chapter) && types.has(q.type));
  }
  function updateSummary() {
    const n = pool().length;
    const ss = $("setup-summary");
    if (ss) ss.textContent = n + " question" + (n === 1 ? "" : "s") + " match your selection.";
    const sb = $("start-btn");
    if (sb) sb.disabled = n === 0;
    const exp = $("export-csv");
    if (exp) {
      exp.disabled = n === 0;
      exp.textContent = n > 0
        ? "⬇ Export " + n + " question" + (n === 1 ? "" : "s") + " to Anki (CSV)"
        : "⬇ Export to Anki (CSV)";
    }
  }

  function refreshHome() {
    const due = state.all.filter((q) => storage.isDue(q)).length;
    const mc = $("missed-cta");
    const mcount = $("missed-count");
    if (mc) mc.hidden = due === 0;
    if (mcount) mcount.textContent = due;

    const mastered = state.all.filter((q) => storage.isMastered(q)).length;
    const mcta = $("mastered-cta");
    const mccount = $("mastered-count");
    if (mcta) mcta.hidden = mastered === 0;
    if (mccount) mccount.textContent = mastered;

    const qn = $("quick-note");
    if (qn) {
      qn.textContent = mastered > 0
        ? `${state.all.length - mastered} of ${state.all.length} left to master · missed ones return first`
        : `All ${state.all.length} questions, shuffled`;
    }
  }

  // ---------- Start a quiz ----------
  function startQuick() {
    const nonMastered = state.all.filter((q) => !storage.isMastered(q));
    const pool2 = nonMastered.length ? nonMastered : state.all;
    launch(state, weightedOrder(pool2, storage), "quick");
    show("quiz");
    renderQuestion();
  }
  function startDrill() {
    const due = state.all.filter((q) => storage.isDue(q));
    if (!due.length) return;
    launch(state, weightedOrder(due, storage), "drill");
    show("quiz");
    renderQuestion();
  }
  function startReview() {
    const m = state.all.filter((q) => storage.isMastered(q));
    if (!m.length) return;
    launch(state, weightedOrder(m, storage), "review");
    show("quiz");
    renderQuestion();
  }
  function startCustom() {
    const countSel = $("count");
    const requested = countSel ? Number(countSel.value) : 0;
    let qs = weightedOrder(pool(), storage);
    if (requested > 0) qs = qs.slice(0, requested);
    if (!qs.length) return;
    launch(state, qs, "custom");
    show("quiz");
    renderQuestion();
  }

  // ---------- Render a question ----------
  function renderQuestion() {
    state.answered = false;
    state.selected = null;
    const q = state.quiz[state.index];
    if (!q) return;

    const pos = $("q-position");
    if (pos) pos.textContent = (state.index + 1) + " / " + state.quiz.length;
    const sc = $("q-score");
    if (sc) sc.textContent = "Score: " + state.score;
    const pb = $("progress-bar");
    if (pb) pb.style.width = (state.index / state.quiz.length) * 100 + "%";

    const qr = $("q-ref");
    if (qr) qr.textContent = referenceFor(q, cfg);
    const qt = $("q-topic");
    if (qt) {
      qt.textContent = q.topic || "";
      qt.hidden = !q.topic;
    }
    const qtype = $("q-type");
    if (qtype) qtype.textContent = TYPE_LABELS[q.type] || q.type;
    const qtext = $("q-text");
    if (qtext) qtext.textContent = q.question;

    const fb = $("feedback");
    if (fb) fb.hidden = true;
    const fnb = $("feedback-next-bar");
    if (fnb) fnb.hidden = true;
    const submitBtn = $("submit-btn");
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.disabled = true;
    }

    const area = $("answer-area");
    if (!area) return;
    area.innerHTML = "";

    if (q.type === "fill-in") {
      const input = el("input", "text-input");
      input.type = "text";
      input.id = "fill-input";
      input.autocomplete = "off";
      input.placeholder = "Type your answer…";
      input.addEventListener("input", () => {
        if (submitBtn) submitBtn.disabled = input.value.trim() === "";
      });
      area.appendChild(input);
      setTimeout(() => {
        try { input.focus({ preventScroll: true }); } catch (e) {}
      }, 30);
    } else {
      const opts = (q.type === "true-false"
        ? ["True", "False"]
        : (q.options || [])).slice();
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      opts.forEach((opt) => {
        const b = el("button", "option-btn", opt);
        b.type = "button";
        b.addEventListener("click", () => {
          document.querySelectorAll(".option-btn").forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          state.selected = opt;
          if (submitBtn) submitBtn.disabled = false;
        });
        area.appendChild(b);
      });
    }
  }

  // ---------- Submit handler (wired onto #answer-form) ----------
  function wireSubmit() {
    const form = $("answer-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (state.answered) return;
      const q = state.quiz[state.index];
      if (!q) return;
      let correct;
      if (q.type === "fill-in") {
        const inp = $("fill-input");
        const val = inp ? inp.value : "";
        correct = isCorrectAnswer(q, null, val);
        if (inp) inp.disabled = true;
      } else {
        correct = isCorrectAnswer(q, state.selected, null);
        document.querySelectorAll(".option-btn").forEach((b) => {
          b.disabled = true;
          const norm = (s) => String(s || "").toLowerCase()
            .replace(/['’`]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\b(the|a|an)\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (norm(b.textContent) === norm(q.answer)) b.classList.add("correct");
          else if (b.classList.contains("selected")) b.classList.add("wrong");
        });
      }
      const result = submit(state, q, correct, storage);
      showFeedback(q, correct);
    });
  }

  function showFeedback(q, correct) {
    const sb = $("submit-btn");
    if (sb) sb.hidden = true;
    const fb = $("feedback");
    if (fb) fb.hidden = false;
    const fnb = $("feedback-next-bar");
    if (fnb) fnb.hidden = false;

    const verdict = $("feedback-verdict");
    if (verdict) {
      verdict.textContent = correct ? "Correct" : "Not quite";
      verdict.className = "verdict " + (correct ? "right" : "wrong");
    }
    const qscore = $("q-score");
    if (qscore) qscore.textContent = "Score: " + state.score;

    const ans = $("feedback-answer");
    if (ans) {
      ans.innerHTML = "";
      ans.append("Answer: ");
      ans.appendChild(el("strong", null, q.answer));
    }

    const pl = $("passage-link");
    if (pl) {
      const ref = referenceFor(q, cfg);
      pl.href = passageUrl(ref, {
        provider: cfg.passageProvider,
        bibleVersion: cfg.bibleVersion,
      });
      pl.textContent = passageLabel(ref, { provider: cfg.passageProvider });
      pl.target = "_blank";
      pl.rel = "noopener";
      // No in-app reader: clicking opens the external licensed page.
      pl.onclick = null;
    }

    if (typeof window !== "undefined" &&
        typeof window.BibleBowlConsumeUnlockScroll === "function" &&
        window.BibleBowlConsumeUnlockScroll()) {
      // Reward system consumed the scroll; don't auto-scroll.
    }
  }

  // ---------- Next handler ----------
  function wireNext() {
    const nb = $("next-btn");
    if (!nb) return;
    nb.addEventListener("click", () => {
      const outcome = next(state);
      if (outcome === "results") {
        state.answered = false;
        showResults();
      } else {
        renderQuestion();
      }
    });
    const quit = $("quit-btn");
    if (quit) quit.addEventListener("click", showResults);
  }

  function showResults() {
    show("results");
    const answeredCount = state.index + (state.answered ? 1 : 0);
    const total = answeredCount || state.quiz.length;
    const pct = total ? Math.round((state.score / total) * 100) : 0;
    const rs = $("result-score");
    if (rs) {
      rs.innerHTML =
        "You scored <strong>" + state.score + " / " + total + "</strong> (" + pct + "%)";
    }
    const review = $("missed-review");
    if (!review) return;
    review.innerHTML = "";
    if (!state.missed.length) {
      review.appendChild(el("p", "muted",
        "Nothing missed — well done."));
      return;
    }
    review.appendChild(el("h3", null,
      "Review what you missed (" + state.missed.length + ")"));
    state.missed.forEach((q) => {
      const item = el("div", "missed-item");
      item.appendChild(el("p", "mq", q.question));
      const a = el("p", "ma");
      a.append("Answer: ");
      a.appendChild(el("strong", null, q.answer));
      item.appendChild(a);
      const ref = referenceFor(q, cfg);
      const passage = el("a", "passage-link",
        passageLabel(ref, { provider: cfg.passageProvider }));
      passage.href = passageUrl(ref, {
        provider: cfg.passageProvider,
        bibleVersion: cfg.bibleVersion,
      });
      passage.target = "_blank";
      passage.rel = "noopener";
      item.appendChild(passage);
      review.appendChild(item);
    });
  }

  return {
    load,
    startQuick,
    startDrill,
    startReview,
    startCustom,
    renderQuestion,
    wireSubmit,
    wireNext,
    showResults,
    refreshHome,
  };
}
