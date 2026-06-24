/* Bible Bowl Study — Exodus quiz engine (framework-free).
   Loads data/questions.json and runs a configurable quiz with memory aids. */

(() => {
  "use strict";

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
    missed: [],       // questions answered wrong
    answered: false,  // whether current question has been checked
    selected: null,   // selected option for MC/TF
    showAidAlways: false,
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
    try {
      const res = await fetch("data/questions.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.all = Array.isArray(data) ? data : data.questions;
      if (!state.all || !state.all.length) throw new Error("No questions found.");
      buildSetup();
    } catch (err) {
      const e = $("load-error");
      e.hidden = false;
      e.textContent =
        "Could not load questions (" + err.message +
        "). If you opened this file directly, run a local server: `python3 -m http.server` then visit the localhost URL.";
    }
  }

  // ---------- Setup screen ----------
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

    $("start-btn").addEventListener("click", startQuiz);
    updateSummary();
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
  }

  // ---------- Start ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startQuiz() {
    const available = shuffle(pool());
    const requested = Number($("count").value);
    state.quiz = requested > 0 ? available.slice(0, requested) : available;
    state.index = 0;
    state.score = 0;
    state.missed = [];
    state.showAidAlways = $("show-aid-always").checked;
    show("quiz");
    renderQuestion();
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
      const opts = q.type === "true-false" ? ["True", "False"] : (q.options || []);
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
    showFeedback(q, correct);
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

    // Memory aid: always on miss; on correct only if toggled.
    if (q.memoryAid && (!correct || state.showAidAlways)) {
      const aid = $("memory-aid");
      const type = q.memoryAid.type || "mnemonic";
      aid.className = "memory-aid " + type;
      $("aid-badge").textContent = AID_LABELS[type] || type;
      $("aid-badge").className = "aid-badge " + type;
      $("aid-text").textContent = q.memoryAid.text;
      const src = $("aid-source");
      if (q.memoryAid.source) {
        src.textContent = "— " + q.memoryAid.source;
        src.hidden = false;
      } else {
        src.hidden = true;
      }
      aid.hidden = false;
    }

    $("next-btn").focus();
  }

  // ---------- Next ----------
  $("next-btn").addEventListener("click", () => {
    state.index++;
    if (state.index >= state.quiz.length) showResults();
    else renderQuestion();
  });

  $("quit-btn").addEventListener("click", showResults);
  $("restart-btn").addEventListener("click", () => show("setup"));

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
      review.appendChild(item);
    });
  }

  load();
})();
