/* Bible Bowl Study — Exodus quiz engine (framework-free).
   Loads data/questions.json and runs a configurable quiz with memory aids.

   Three ways to start:
     - Quick   : every question, shuffled (the main path).
     - Drill   : only questions you've previously missed.
     - Custom  : pick chapters / types / count (advanced).

   Per-device progress is saved in localStorage: questions you miss are
   weighted to resurface sooner, and a question leaves the "due" pool once
   you answer it correctly twice in a row. No account or server required. */

(() => {
  "use strict";

  const REPO = "warnerwes/bible-bowl-study";
  const STORAGE_KEY = "bbs:stats:v1";
  const VOTE_STORAGE_KEY = "bbs:aid-votes:v1";

  const TYPE_LABELS = {
    "multiple-choice": "Multiple choice",
    "true-false": "True / False",
    "fill-in": "Fill in",
  };
  const AID_LABELS = {
    mnemonic: "Mnemonic",
    teaching: "Teaching",
    image: "Memorable image",
  };

  const state = {
    all: [],          // every question loaded
    quiz: [],         // current quiz subset (ordered)
    index: 0,
    score: 0,
    missed: [],       // questions answered wrong this session
    reviewCandidates: {},
    voteSink: null,
    pendingAidVote: null,
    answered: false,  // whether current question has been checked
    selected: null,   // selected option for MC/TF
    mode: "quick",
  };

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  function show(screen) {
    ["setup", "quiz", "results"].forEach((s) => ($(s).hidden = s !== screen));
  }

  // ---------- Celebration effects (dependency-free confetti) ----------
  const PREFERS_REDUCED_MOTION =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CONFETTI_COLORS = ["#d4a04e", "#e6c074", "#5fae86", "#6aa9e0", "#b48ad6", "#e08a5a", "#f2ead8"];

  function popVerdict() {
    if (PREFERS_REDUCED_MOTION) return;
    const v = $("feedback-verdict");
    v.classList.remove("pop");
    void v.offsetWidth; // reflow so the animation can restart
    v.classList.add("pop");
  }
  function makeConfettiLayer(lifespanMs) {
    const layer = el("div", "confetti-layer");
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), lifespanMs);
    return layer;
  }
  function addPiece(layer, x, y) {
    const p = el("div", "confetti-piece");
    p.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const w = 6 + Math.random() * 6;
    p.style.width = w + "px";
    p.style.height = w * 0.45 + "px";
    p.style.left = x + "px";
    p.style.top = y + "px";
    layer.appendChild(p);
    return p;
  }
  // Mastery progress toward MASTERY_STREAK correct-in-a-row — shown after each
  // answer in place of a per-correct celebration. `reset` = a streak was just
  // broken by a wrong answer (so we show "Streak reset" rather than "0 of 3").
  function renderMasteryProgress(q, reset) {
    const wrap = $("mastery-progress");
    if (state.mode === "review") { wrap.hidden = true; return; }
    const total = MASTERY_STREAK;
    const s = stats[q.id] || { streak: 0 };
    const streak = Math.min(s.streak || 0, total);
    const mastered = (s.streak || 0) >= total;

    const track = $("mp-track");
    track.innerHTML = "";
    const segs = [];
    for (let i = 0; i < total; i++) {
      const seg = el("span", "mp-seg");
      track.appendChild(seg);
      segs.push(seg);
    }

    const label = $("mp-label");
    if (mastered) {
      wrap.className = "mastery-progress mastered";
      label.textContent = "✦ Mastered";
    } else if (reset) {
      wrap.className = "mastery-progress reset";
      label.textContent = "Streak reset · 0 of " + total + " in a row";
    } else {
      wrap.className = "mastery-progress";
      label.textContent = streak + " of " + total + " correct in a row";
    }
    wrap.setAttribute("aria-valuenow", String(streak));
    wrap.hidden = false;

    // Fill the segments (newest one pulses). Under reduced-motion, paint at once.
    const paint = () => {
      segs.forEach((seg, i) => { if (i < streak) seg.classList.add("filled"); });
      if (!PREFERS_REDUCED_MOTION && streak > 0 && !reset) segs[streak - 1].classList.add("pump");
    };
    if (PREFERS_REDUCED_MOTION) paint();
    else requestAnimationFrame(() => requestAnimationFrame(paint));
  }
  // Full-screen drop from the top + a "Mastered!" flourish — fires at 3 in a row.
  function celebrateMastery() {
    popVerdict();
    flashMastered();
    if (PREFERS_REDUCED_MOTION) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const layer = makeConfettiLayer(4200);
    for (let i = 0; i < 140; i++) {
      const p = addPiece(layer, Math.random() * W, -16);
      const dx = (Math.random() - 0.5) * 180;
      const rot = Math.random() * 1080 - 540;
      const delay = Math.random() * 450;
      const dur = 2000 + Math.random() * 1300;
      p.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx * 0.4}px, ${H * 0.55}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${dx}px, ${H + 40}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: dur, delay: delay, easing: "cubic-bezier(.25,.6,.4,1)" }
      ).onfinish = () => p.remove();
    }
  }
  function flashMastered() {
    const b = el("div", "mastered-flash");
    // Inline SVG star renders crisply and on-theme (a glyph rendered as a clunky
    // black diamond in the display serif).
    b.innerHTML =
      '<svg class="mf-star" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 1.7l2.3 7.1 7.5.1-6 4.5 2.2 7.2-6-4.4-6 4.4 2.2-7.2-6-4.5 7.5-.1z"/>' +
      "</svg>" +
      '<span class="mf-title">Mastered</span>' +
      '<span class="mf-sub">' + MASTERY_STREAK + " correct in a row</span>";
    document.body.appendChild(b);
    requestAnimationFrame(() => b.classList.add("show"));
    setTimeout(() => {
      b.classList.remove("show");
      setTimeout(() => b.remove(), 450);
    }, 2200);
  }

  // ---------- Progress tracking (localStorage) ----------
  // stats[id] = { wrong, right, streak, seen } — streak = consecutive corrects.
  let stats = {};
  let aidVotes = [];
  function loadStats() {
    try { stats = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { stats = {}; }
    try { aidVotes = JSON.parse(localStorage.getItem(VOTE_STORAGE_KEY)) || []; }
    catch (e) { aidVotes = []; }
  }
  function saveStats() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); }
    catch (e) { /* private mode / storage disabled — tracking just won't persist */ }
  }
  function saveAidVotes() {
    try { localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(aidVotes)); }
    catch (e) { /* private mode / storage disabled */ }
  }
  function recordResult(q, correct) {
    const s = stats[q.id] || { wrong: 0, right: 0, streak: 0, seen: 0 };
    s.seen += 1;
    if (correct) { s.right += 1; s.streak += 1; }
    else { s.wrong += 1; s.streak = 0; }
    stats[q.id] = s;
    saveStats();
  }
  const MASTERY_STREAK = 3; // correct answers in a row to "master" a question

  // Mastered once answered correctly MASTERY_STREAK times in a row.
  function isMastered(q) {
    const s = stats[q.id];
    return !!s && s.streak >= MASTERY_STREAK;
  }
  function masteredQuestions() {
    return state.all.filter(isMastered);
  }
  // "Due" = missed at least once and not yet mastered (stays in the drill pool).
  function isDue(q) {
    const s = stats[q.id];
    return !!s && s.wrong > 0 && s.streak < MASTERY_STREAK;
  }
  function dueQuestions() {
    return state.all.filter(isDue);
  }
  // Higher weight => tends to appear earlier in a shuffle.
  function weightFor(q) {
    const s = stats[q.id];
    if (!s) return 1.5;                          // unseen: slight edge over mastered
    if (s.streak >= MASTERY_STREAK) return 0.35; // mastered: show rarely
    let w = 1;
    if (isDue(q)) w += 3;                        // currently due for review
    w += Math.min(s.wrong, 3);                   // missed a lot => more often
    return w;
  }
  // Weighted shuffle (Efraimidis–Spirakis): key = U^(1/weight), sort desc.
  function weightedOrder(arr) {
    return arr
      .map((q) => ({ q, k: Math.pow(Math.random(), 1 / Math.max(weightFor(q), 0.01)) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.q);
  }

  // ---------- Suggest-a-correction link (pre-filled GitHub issue) ----------
  function suggestUrl(q) {
    const title = `[Revision] ${q.id} — ${scriptureRef(q)}`;
    const body = [
      `**Question ID:** ${q.id}`,
      `**Reference:** ${q.reference || "(none)"}`,
      `**Topic:** ${q.topic || "(none)"}`,
      `**Type:** ${q.type}`,
      "",
      `**Question:** ${q.question}`,
      `**Answer:** ${q.answer}`,
    ];
    if (q.type === "multiple-choice" && Array.isArray(q.options)) {
      body.push(`**Options:** ${q.options.join(" · ")}`);
    }
    if (q.type === "fill-in" && Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length) {
      body.push(`**Also accepted:** ${q.acceptableAnswers.join(" · ")}`);
    }
    if (q.memoryAid && q.memoryAid.text) {
      body.push("");
      body.push(`**Memory aid (${q.memoryAid.type || "mnemonic"}):** ${q.memoryAid.text}`);
      if (q.memoryAid.source) body.push(`**Source:** ${q.memoryAid.source}`);
    }
    body.push("", "---", "**Suggested change / issue:**", "_Describe the correction here._");
    return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.join("\n"))}`;
  }

  // ---------- Scripture passage link (Septuagint, in context) ----------
  function scriptureRef(q) {
    return q.reference || ("Exodus " + q.chapter);
  }
  // The OSB's Old Testament follows the Septuagint; link to Brenton's LXX
  // chapter on BibleHub so the verse is read in its surrounding context.
  function septuagintUrl(q) {
    const book = (q.book || "Exodus").toLowerCase().replace(/\s+/g, "_");
    return `https://biblehub.com/sep/${book}/${q.chapter}.htm`;
  }

  // ---------- Anki CSV export ----------
  function csvField(s) {
    return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  }
  function ankiFront(q) {
    let f = q.question;
    if (q.type === "multiple-choice" && Array.isArray(q.options)) {
      f += "<br><br>" + q.options.join("<br>");
    } else if (q.type === "true-false") {
      f += "<br><br>True or false?";
    }
    return f;
  }
  function ankiBack(q) {
    let b = "<b>" + q.answer + "</b>";
    b += '<br><span style="color:#888">(' + scriptureRef(q) + ")</span>";
    if (q.memoryAid && q.memoryAid.text) {
      const label = AID_LABELS[q.memoryAid.type] || "Memory aid";
      b += "<br><br><i>" + label + ":</i> " + q.memoryAid.text;
      if (q.memoryAid.source) b += "<br>— " + q.memoryAid.source;
    }
    return b;
  }
  function ankiTags(q) {
    return "BibleBowl Exodus::Ch" + q.chapter + " " + q.type;
  }
  // Anki text-import format: leading #-directives set the note type, deck,
  // separator, HTML handling, and tags column; one note per row after.
  function buildAnkiCsv(qs) {
    const out = [
      "#separator:Comma",
      "#html:true",
      "#notetype:Basic",
      "#deck:Bible Bowl - Exodus",
      "#tags column:3",
    ];
    qs.forEach((q) => {
      out.push([csvField(ankiFront(q)), csvField(ankiBack(q)), csvField(ankiTags(q))].join(","));
    });
    return out.join("\n") + "\n";
  }
  function exportAnki() {
    const qs = pool();
    if (!qs.length) return;
    const blob = new Blob([buildAnkiCsv(qs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url;
    a.download = "bible-bowl-exodus-anki.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportAidVotes() {
    if (!aidVotes.length) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      votes: aidVotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url;
    a.download = "bible-bowl-memory-aid-votes.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Answer normalization (fill-in) ----------
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[.,!;:'"’”“()]/g, "")
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function fillInIsCorrect(input, q) {
    const guess = normalize(input);
    if (!guess) return false;
    const accepted = (q.acceptableAnswers && q.acceptableAnswers.length)
      ? q.acceptableAnswers
      : [q.answer];
    return accepted.some((a) => {
      const na = normalize(a);
      return na === guess || (na.length > 3 && (na.includes(guess) || guess.includes(na)));
    });
  }

  // ---------- Load data ----------
  async function load() {
    loadStats();
    try {
      const res = await fetch("data/questions.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.all = Array.isArray(data) ? data : data.questions;
      if (!state.all || !state.all.length) throw new Error("No questions found.");
      await loadReviewCandidates();
      await loadVoteSink();
      buildSetup();
    } catch (err) {
      const e = $("load-error");
      e.hidden = false;
      e.textContent =
        "Could not load questions (" + err.message +
        "). If you opened this file directly, run a local server: `python3 -m http.server` then visit the localhost URL.";
    }
  }

  async function loadReviewCandidates() {
    try {
      const res = await fetch("data/review-candidates.json", { cache: "no-cache" });
      if (!res.ok) return;
      const data = await res.json();
      state.reviewCandidates = (data && data.questions) || {};
    } catch (e) {
      state.reviewCandidates = {};
    }
  }
  async function loadVoteSink() {
    try {
      const res = await fetch("data/vote-sink.json", { cache: "no-cache" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.enabled && data.action && data.fields) state.voteSink = data;
    } catch (e) {
      state.voteSink = null;
    }
  }

  // ---------- Setup / home screen ----------
  function buildSetup() {

    const chapters = [...new Set(state.all.map((q) => q.chapter))].sort((a, b) => a - b);
    const list = $("chapter-list");
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
    $("type-list").addEventListener("change", updateSummary);
    $("count").addEventListener("change", updateSummary);

    document.querySelectorAll("[data-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const want = btn.dataset.select === "all";
        document.querySelectorAll(".chapter-cb").forEach((cb) => (cb.checked = want));
        updateSummary();
      });
    });

    // Mode launchers
    $("quick-start").addEventListener("click", startQuick);
    $("drill-missed").addEventListener("click", startDrill);
    $("review-mastered").addEventListener("click", startReview);
    $("start-btn").addEventListener("click", startCustom);
    $("export-csv").addEventListener("click", exportAnki);
    $("export-votes").addEventListener("click", exportAidVotes);

    // Advanced toggle
    $("toggle-advanced").addEventListener("click", () => openAdvanced(true));
    $("close-advanced").addEventListener("click", () => openAdvanced(false));

    refreshHome();
    updateSummary();
  }

  function openAdvanced(open) {
    $("home").hidden = open;
    $("advanced").hidden = !open;
    $("toggle-advanced").setAttribute("aria-expanded", String(open));
  }

  // Refresh the home-screen tracking UI (missed CTA + progress line).
  function refreshHome() {
    const due = dueQuestions().length;
    $("export-votes").hidden = aidVotes.length === 0;
    $("missed-cta").hidden = due === 0;
    $("missed-count").textContent = due;

    const mastered = masteredQuestions().length;
    $("mastered-cta").hidden = mastered === 0;
    $("mastered-count").textContent = mastered;

    const remaining = state.all.length - mastered;
    $("quick-note").textContent = mastered > 0
      ? `${remaining} of ${state.all.length} left to master (${mastered} set aside), shuffled. Missed ones come back first.`
      : `All ${state.all.length} questions, shuffled. Ones you miss come back more often.`;

    const seen = Object.keys(stats).length;
    const line = $("progress-line");
    line.innerHTML = "";
    if (seen === 0) { line.hidden = true; return; }
    line.hidden = false;
    line.append(`Seen ${seen} of ${state.all.length}  ·  ${due} to review  ·  ${mastered} mastered`);
    if (mastered > 0) {
      line.append("  ·  ");
      const rm = el("button", "link-btn", "Reset mastered");
      rm.type = "button";
      rm.addEventListener("click", resetMastered);
      line.appendChild(rm);
    }
    line.append("  ·  ");
    const rp = el("button", "link-btn", "Reset all");
    rp.type = "button";
    rp.addEventListener("click", resetProgress);
    line.appendChild(rp);
  }

  function resetProgress() {
    if (!window.confirm("Reset all saved progress on this device? This can't be undone.")) return;
    stats = {};
    saveStats();
    refreshHome();
  }
  function resetMastered() {
    const ids = masteredQuestions().map((q) => q.id);
    if (!ids.length) return;
    if (!window.confirm("Reset " + ids.length + " mastered question" + (ids.length === 1 ? "" : "s") + " back into study?")) return;
    ids.forEach((id) => { delete stats[id]; });
    saveStats();
    refreshHome();
  }

  function selectedChapters() {
    return [...document.querySelectorAll(".chapter-cb:checked")].map((cb) => Number(cb.value));
  }
  function selectedTypes() {
    return [...document.querySelectorAll("#type-list input:checked")].map((cb) => cb.value);
  }
  function pool() {
    const chs = new Set(selectedChapters());
    const types = new Set(selectedTypes());
    return state.all.filter((q) => chs.has(q.chapter) && types.has(q.type));
  }
  function updateSummary() {
    const n = pool().length;
    $("setup-summary").textContent = n + " question" + (n === 1 ? "" : "s") + " match your selection.";
    $("start-btn").disabled = n === 0;
    const exp = $("export-csv");
    exp.disabled = n === 0;
    exp.textContent = n > 0
      ? "⬇ Export " + n + " question" + (n === 1 ? "" : "s") + " to Anki (CSV)"
      : "⬇ Export to Anki (CSV)";
  }

  // ---------- Start a quiz ----------
  function launch(questions, mode) {
    state.quiz = questions;
    state.index = 0;
    state.score = 0;
    state.missed = [];
    state.mode = mode;
    show("quiz");
    renderQuestion();
  }
  function startQuick() {
    // Set mastered questions aside; fall back to everything once all are mastered.
    const pool = state.all.filter((q) => !isMastered(q));
    launch(weightedOrder(pool.length ? pool : state.all), "quick");
  }
  function startDrill() {
    const due = dueQuestions();
    if (!due.length) return;
    launch(weightedOrder(due), "drill");
  }
  // Revisit mastered questions — "review" mode does not record results, so a
  // miss here won't knock a question out of the mastered bucket.
  function startReview() {
    const m = masteredQuestions();
    if (!m.length) return;
    launch(weightedOrder(m), "review");
  }
  function startCustom() {
    const requested = Number($("count").value);
    let qs = weightedOrder(pool());
    if (requested > 0) qs = qs.slice(0, requested);
    if (!qs.length) return;
    launch(qs, "custom");
  }

  // ---------- Render a question ----------
  function renderQuestion() {
    state.answered = false;
    state.selected = null;
    const q = state.quiz[state.index];

    $("q-position").textContent = (state.index + 1) + " / " + state.quiz.length;
    $("q-score").textContent = "Score: " + state.score;
    $("progress-bar").style.width = (state.index / state.quiz.length) * 100 + "%";

    $("q-ref").textContent = q.reference || ("Exodus " + q.chapter);
    $("q-topic").textContent = q.topic || "";
    $("q-topic").hidden = !q.topic;
    $("q-type").textContent = TYPE_LABELS[q.type] || q.type;
    $("q-text").textContent = q.question;

    $("feedback").hidden = true;
    $("memory-aid").hidden = true;
    $("aid-review").hidden = true;
    $("aid-review-saved").hidden = true;
    $("custom-aid-box").hidden = true;
    $("custom-aid-text").value = "";
    $("study-guide-toggle").hidden = true;
    state.pendingAidVote = null;
    const submit = $("submit-btn");
    submit.hidden = false;
    submit.disabled = true;

    const area = $("answer-area");
    area.innerHTML = "";

    if (q.type === "fill-in") {
      const input = el("input", "text-input");
      input.type = "text";
      input.id = "fill-input";
      input.autocomplete = "off";
      input.placeholder = "Type your answer…";
      input.addEventListener("input", () => (submit.disabled = input.value.trim() === ""));
      area.appendChild(input);
      setTimeout(() => input.focus(), 30);
    } else {
      const opts = (q.type === "true-false" ? ["True", "False"] : (q.options || [])).slice();
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
          submit.disabled = false;
        });
        area.appendChild(b);
      });
    }
  }

  // ---------- Submit ----------
  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.answered) return;
    const q = state.quiz[state.index];
    let correct;

    if (q.type === "fill-in") {
      const val = $("fill-input").value;
      correct = fillInIsCorrect(val, q);
      $("fill-input").disabled = true;
    } else {
      correct = normalize(state.selected) === normalize(q.answer);
      document.querySelectorAll(".option-btn").forEach((b) => {
        b.disabled = true;
        if (normalize(b.textContent) === normalize(q.answer)) b.classList.add("correct");
        else if (b.classList.contains("selected")) b.classList.add("wrong");
      });
    }

    state.answered = true;
    if (correct) state.score++;
    else state.missed.push(q);
    let newlyMastered = false;
    let streakReset = false;
    if (state.mode !== "review") {
      const prevStreak = stats[q.id] ? (stats[q.id].streak || 0) : 0;
      recordResult(q, correct);
      newlyMastered = correct && !!stats[q.id] && stats[q.id].streak === MASTERY_STREAK;
      streakReset = !correct && prevStreak > 0;
    }
    showFeedback(q, correct);
    renderMasteryProgress(q, streakReset);
    if (correct && newlyMastered) celebrateMastery();
  });

  function showFeedback(q, correct) {
    $("submit-btn").hidden = true;
    const fb = $("feedback");
    fb.hidden = false;

    const verdict = $("feedback-verdict");
    verdict.textContent = correct ? "Correct" : "Not quite";
    verdict.className = "verdict " + (correct ? "right" : "wrong");

    $("q-score").textContent = "Score: " + state.score;

    const ans = $("feedback-answer");
    ans.innerHTML = "";
    ans.append("Answer: ");
    ans.appendChild(el("strong", null, q.answer));

    const pl = $("passage-link");
    pl.href = septuagintUrl(q);
    pl.textContent = "Read " + scriptureRef(q) + " in context ↗";

    const studyToggle = $("study-guide-toggle");
    if (q.memoryAid && q.memoryAid.text) {
      studyToggle.hidden = false;
      setStudyGuideVisible(q, !correct);
    } else {
      setStudyGuideVisible(q, false);
      studyToggle.hidden = true;
    }

    $("suggest-link").href = suggestUrl(q);

    $("next-btn").focus();
  }

  function setStudyGuideVisible(q, visible) {
    const aid = $("memory-aid");
    const review = $("aid-review");
    const toggle = $("study-guide-toggle");
    aid.hidden = !visible;
    toggle.textContent = visible ? "Hide study guide" : "Show study guide";
    toggle.setAttribute("aria-expanded", String(visible));
    if (!q.memoryAid || !q.memoryAid.text) {
      review.hidden = true;
      return;
    }
    renderMemoryAid(q);
    visible ? renderAidReview(q) : (review.hidden = true);
  }

  function renderMemoryAid(q) {
    const aid = $("memory-aid");
    const type = q.memoryAid.type || "mnemonic";
    aid.className = "memory-aid " + type;
    $("aid-badge").textContent = AID_LABELS[type] || type;
    $("aid-badge").className = "aid-badge " + type;
    $("aid-text").textContent = q.memoryAid.text;
    const src = $("aid-source");
    src.textContent = q.memoryAid.source ? "— " + q.memoryAid.source : "";
    src.hidden = !q.memoryAid.source;
  }

  function latestReviewCandidate(q) {
    const list = state.reviewCandidates[q.id] || [];
    return list.length ? list[list.length - 1] : null;
  }
  function aidVoteFor(questionId) {
    return aidVotes.find((v) => v.questionId === questionId);
  }
  function saveAidVote(vote) {
    const i = aidVotes.findIndex((v) => v.questionId === vote.questionId);
    if (i >= 0) aidVotes[i] = vote;
    else aidVotes.push(vote);
    saveAidVotes();
    submitAidVote(vote);
    $("export-votes").hidden = false;
  }
  function commitPendingAidVote() {
    if (!state.pendingAidVote) return;
    saveAidVote(state.pendingAidVote);
    state.pendingAidVote = null;
  }
  function submitAidVote(vote) {
    const sink = state.voteSink;
    if (!sink || !sink.action || !sink.fields) return;
    const values = {
      questionId: vote.questionId,
      reference: vote.reference,
      choiceId: vote.choiceId,
      currentCandidateId: vote.currentCandidateId,
      alternateCandidateId: vote.alternateCandidateId,
      chosenText: vote.chosenText,
      mode: vote.mode,
      answeredCorrectly: String(vote.answeredCorrectly),
      votedAt: vote.votedAt,
    };
    const frameName = "aid-vote-sink-" + Date.now();
    const iframe = el("iframe");
    iframe.name = frameName;
    iframe.hidden = true;
    const form = el("form");
    form.method = "POST";
    form.action = sink.action;
    form.target = frameName;
    form.hidden = true;
    Object.keys(values).forEach((key) => {
      const field = sink.fields[key];
      if (!field) return;
      const input = el("input");
      input.name = field;
      input.value = values[key] || "";
      form.appendChild(input);
    });
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
      form.remove();
      iframe.remove();
    }, 3000);
  }
  function renderAidReview(q) {
    const alt = latestReviewCandidate(q);
    if (!q.memoryAid || !q.memoryAid.text) return;

    const box = $("aid-review");
    const opts = $("aid-review-options");
    const saved = $("aid-review-saved");
    opts.innerHTML = "";
    saved.hidden = true;

    const choices = alt ? [
      { id: "current", type: q.memoryAid.type, text: q.memoryAid.text, source: q.memoryAid.source || "" },
      { id: alt.candidateId, type: alt.type, text: alt.text, source: alt.source || "" },
    ] : [{ id: "current", type: q.memoryAid.type, text: q.memoryAid.text, source: q.memoryAid.source || "" }];
    const prior = aidVoteFor(q.id);

    choices.forEach((choice) => {
      const b = el("button", "aid-choice", "");
      b.type = "button";
      if (prior && prior.choiceId === choice.id) b.classList.add("selected");
      const label = el("span", "aid-choice-label", AID_LABELS[choice.type] || "Memory aid");
      const stateLabel = el("span", "aid-choice-state", "Selected");
      const text = el("span", "aid-choice-text", choice.text);
      b.appendChild(label);
      b.appendChild(stateLabel);
      b.appendChild(text);
      if (choice.source) b.appendChild(el("span", "aid-choice-source", choice.source));
      b.addEventListener("click", () => {
        document.querySelectorAll(".aid-choice").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        state.pendingAidVote = {
          questionId: q.id,
          reference: q.reference || "",
          choiceId: choice.id,
          currentCandidateId: "current",
          alternateCandidateId: alt ? alt.candidateId : "",
          chosenText: choice.text,
          mode: state.mode,
          answeredCorrectly: !state.missed.includes(q),
          votedAt: new Date().toISOString(),
        };
        saved.textContent = "Will save on Next.";
        saved.hidden = false;
      });
      opts.appendChild(b);
    });

    box.hidden = false;
  }

  function saveCustomAid() {
    const q = state.quiz[state.index];
    if (!q) return;
    const text = $("custom-aid-text").value.trim();
    if (!text) return;
    const alt = latestReviewCandidate(q);
    state.pendingAidVote = {
      questionId: q.id,
      reference: q.reference || "",
      choiceId: "custom",
      currentCandidateId: "current",
      alternateCandidateId: alt ? alt.candidateId : "",
      chosenText: text,
      mode: state.mode,
      answeredCorrectly: !state.missed.includes(q),
      votedAt: new Date().toISOString(),
    };
    document.querySelectorAll(".aid-choice").forEach((x) => x.classList.remove("selected"));
    $("aid-review-saved").textContent = "Will save your suggestion on Next.";
    $("aid-review-saved").hidden = false;
  }

  // ---------- Next ----------
  $("study-guide-toggle").addEventListener("click", () => {
    const q = state.quiz[state.index];
    if (!q) return;
    setStudyGuideVisible(q, $("memory-aid").hidden);
  });
  $("custom-aid-toggle").addEventListener("click", () => {
    const box = $("custom-aid-box");
    box.hidden = !box.hidden;
    if (!box.hidden) $("custom-aid-text").focus();
  });
  $("custom-aid-save").addEventListener("click", saveCustomAid);

  $("next-btn").addEventListener("click", () => {
    commitPendingAidVote();
    state.index++;
    if (state.index >= state.quiz.length) showResults();
    else renderQuestion();
  });

  $("quit-btn").addEventListener("click", showResults);
  $("restart-btn").addEventListener("click", () => {
    openAdvanced(false);
    refreshHome();
    show("setup");
  });

  // ---------- Results ----------
  function showResults() {
    show("results");
    const answeredCount = state.index + (state.answered ? 1 : 0);
    const total = answeredCount || state.quiz.length;
    const pct = total ? Math.round((state.score / total) * 100) : 0;
    $("result-score").innerHTML =
      "You scored <strong>" + state.score + " / " + total + "</strong> (" + pct + "%)";

    const review = $("missed-review");
    review.innerHTML = "";
    if (!state.missed.length) {
      review.appendChild(el("p", "muted", "Nothing missed — well done. Every one of these is worth re-reading anyway."));
      return;
    }
    review.appendChild(el("h3", null, "Review what you missed (" + state.missed.length + ")"));
    state.missed.forEach((q) => {
      const item = el("div", "missed-item");
      item.appendChild(el("p", "mq", q.question));
      const a = el("p", "ma");
      a.append("Answer: ");
      a.appendChild(el("strong", null, q.answer));
      item.appendChild(a);
      if (q.memoryAid) {
        const type = q.memoryAid.type || "mnemonic";
        const badge = el("span", "aid-badge " + type, AID_LABELS[type] || type);
        item.appendChild(badge);
        item.appendChild(el("p", "aid-body", q.memoryAid.text));
        if (q.memoryAid.source) item.appendChild(el("cite", "aid-source", "— " + q.memoryAid.source));
      }
      const passage = el("a", "passage-link", "Read " + scriptureRef(q) + " in context ↗");
      passage.href = septuagintUrl(q);
      passage.target = "_blank";
      passage.rel = "noopener";
      item.appendChild(passage);
      const suggest = el("a", "suggest-link", "⚐ Suggest a correction");
      suggest.href = suggestUrl(q);
      suggest.target = "_blank";
      suggest.rel = "noopener";
      item.appendChild(suggest);
      review.appendChild(item);
    });
  }

  load();
})();
