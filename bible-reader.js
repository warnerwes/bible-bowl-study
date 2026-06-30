(() => {
  "use strict";

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const DATA_URL = new URL(
    "data/source-text/exodus/exodus-verses.json",
    SCRIPT_URL || window.location.href
  ).href;
  const GAME_BLANK_COUNTS = [4, 8, 12];
  const STOP_WORDS = new Set([
    "about", "after", "again", "against", "also", "among", "and", "are", "because", "before",
    "being", "between", "both", "but", "came", "come", "did", "does", "down", "each",
    "from", "had", "has", "have", "her", "him", "his", "into", "its", "let", "like",
    "made", "may", "not", "now", "off", "one", "only", "out", "over", "said", "same",
    "shall", "she", "should", "such", "than", "that", "the", "their", "them", "then",
    "there", "these", "they", "this", "those", "through", "thus", "unto", "upon", "was",
    "were", "when", "where", "which", "who", "will", "with", "you", "your"
  ]);

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let dataCache = null;
  let fetchPromise = null;
  let fetchError = null;
  let chapterMap = {};
  let availableChapters = [];

  let modal;
  let modalBody;
  let title;
  let chapterSelect;
  let prevBtn;
  let nextBtn;
  let gameBtn;
  let closeBtn;
  let activeChapter = null;
  let gameState = null;

  function withLocalHelpers(text) {
    return String(text == null ? "" : text)
      .trim()
      .replace(/\u00a0/g, " ")
      .replace(/\(([^)]+)\)\s*$/, "")
      .trim();
  }

  function parseReference(raw) {
    const ref = withLocalHelpers(raw);
    if (!ref) return null;

    const m = ref.match(/^\s*Exodus\s+(\d+)\s*(?::\s*(.+))?$/i);
    if (!m) return null;

    const chapter = Number(m[1]);
    const afterColon = withLocalHelpers(m[2]);
    if (!afterColon) return { chapter };

    const compact = afterColon.replace(/\s+/g, "");
    const nums = [...compact.matchAll(/(\d+)/g)].map((x) => Number(x[1]));
    if (!nums.length) return { chapter };

    const first = nums[0];
    const hasHyphen = compact.includes("-");
    const hasComma = compact.includes(",");

    if (hasHyphen) {
      if (/\-\s*\d+\s*:\s*\d+/.test(compact)) {
        return { chapter, fromVerse: first, crossChapterEnd: true };
      }

      const m2 = compact.match(/-\s*(\d+)/);
      return { chapter, fromVerse: first, toVerse: m2 ? Number(m2[1]) : first };
    }

    if (hasComma) {
      return { chapter, fromVerse: first, toVerse: nums[nums.length - 1] };
    }

    return { chapter, fromVerse: first };
  }

  function normalizeChapter(chapter) {
    const n = Number(chapter);
    return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : null;
  }

  function maxVerseFor(chapter) {
    const verses = chapterMap[chapter];
    if (!verses || !verses.length) return null;
    return verses[verses.length - 1];
  }

  function chapterEntries(chapter) {
    const max = maxVerseFor(chapter);
    if (!Number.isFinite(max)) return [];
    const rows = [];
    for (let verse = 1; verse <= max; verse++) {
      rows.push({ verse, text: dataCache.verses[chapter + ":" + verse] || "" });
    }
    return rows;
  }

  function normalizeWord(word) {
    return String(word || "").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").toLowerCase();
  }

  function chapterKeywords(chapter) {
    const rows = chapterEntries(chapter);
    const words = new Map();
    rows.forEach((row) => {
      const matches = row.text.matchAll(/\b[A-Za-z][A-Za-z'-]{2,}\b/g);
      for (const match of matches) {
        const display = match[0].replace(/'s$/i, "");
        const key = normalizeWord(display);
        if (key.length < 4 || STOP_WORDS.has(key)) continue;
        const current = words.get(key) || {
          key,
          display,
          count: 0,
          firstVerse: row.verse,
          proper: /^[A-Z]/.test(display),
          length: display.length,
        };
        current.count += 1;
        current.proper = current.proper || /^[A-Z]/.test(display);
        if (display.length > current.display.length) current.display = display;
        words.set(key, current);
      }
    });
    return [...words.values()]
      .map((item) => ({
        ...item,
        score: item.count * 4 + item.length * 0.35 + (item.proper ? 3 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.firstVerse - b.firstVerse || a.key.localeCompare(b.key));
  }

  function shuffle(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ensureReaderData() {
    if (dataCache) return Promise.resolve(dataCache);
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async function () {
      try {
        const res = await fetch(DATA_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json || typeof json !== "object") throw new Error("Invalid chapter data format");

        dataCache = json;
        fetchError = null;

        chapterMap = {};
        const keys = Object.keys(json.verses || {});
        for (let i = 0; i < keys.length; i++) {
          const m = keys[i].match(/^(\d+):(\d+)$/);
          if (!m) continue;
          const ch = Number(m[1]);
          const verse = Number(m[2]);
          if (!Number.isFinite(ch) || !Number.isFinite(verse)) continue;
          (chapterMap[ch] || (chapterMap[ch] = [])).push(verse);
        }
        Object.keys(chapterMap).forEach((ch) => {
          chapterMap[ch].sort((a, b) => a - b);
        });
        availableChapters = Object.keys(chapterMap).map((n) => Number(n)).sort((a, b) => a - b);

        return dataCache;
      } catch (err) {
        fetchError = err && err.message ? err.message : String(err);
        dataCache = null;
        return null;
      }
    })();

    return fetchPromise;
  }

  function ensureModal() {
    if (modal) return;

    modal = el("div", "reader-modal");
    modal.id = "reader-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "reader-title");
    modal.setAttribute("aria-hidden", "true");

    const card = el("div", "reader-card");

    const header = el("header", "reader-header");
    title = el("h2", "reader-title", "Exodus");
    title.id = "reader-title";

    const selectWrap = el("div", "reader-select-wrap");
    const selectLabel = el("label", "reader-select-label", "Chapter");
    selectLabel.setAttribute("for", "reader-chapter");
    chapterSelect = document.createElement("select");
    chapterSelect.id = "reader-chapter";
    chapterSelect.className = "reader-chapter-select";

    prevBtn = el("button", "reader-nav-btn reader-nav-btn-prev", "‹ Prev");
    prevBtn.type = "button";
    prevBtn.disabled = true;

    nextBtn = el("button", "reader-nav-btn reader-nav-btn-next", "Next ›");
    nextBtn.type = "button";
    nextBtn.disabled = true;

    gameBtn = el("button", "reader-game-btn", "Word game");
    gameBtn.type = "button";

    closeBtn = el("button", "reader-close-btn", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close reader");

    selectWrap.append(selectLabel, chapterSelect);
    header.append(title, selectWrap, gameBtn, prevBtn, nextBtn, closeBtn);

    modalBody = el("div", "reader-body");

    card.append(header, modalBody);
    modal.appendChild(card);
    document.body.appendChild(modal);

    modal.addEventListener("click", function (evt) {
      if (evt.target === modal) close();
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () {
      const idx = availableChapters.indexOf(activeChapter);
      if (idx <= 0) return;
      open(availableChapters[idx - 1]);
    });
    nextBtn.addEventListener("click", function () {
      const idx = availableChapters.indexOf(activeChapter);
      if (idx < 0 || idx >= availableChapters.length - 1) return;
      open(availableChapters[idx + 1]);
    });
    chapterSelect.addEventListener("change", function () {
      const ch = normalizeChapter(chapterSelect.value);
      if (ch == null) return;
      open(ch);
    });
    gameBtn.addEventListener("click", function () {
      if (gameState && gameState.chapter === activeChapter) {
        gameState = null;
        renderChapter(activeChapter);
      } else {
        startGame(activeChapter);
      }
    });
    document.addEventListener("keydown", function (evt) {
      if (!modal.classList.contains("active")) return;
      if (evt.key === "Escape") {
        evt.preventDefault();
        close();
      }
    });
  }

  function updateHeaderControls(chapter) {
    title.textContent = "Exodus " + chapter;
    chapterSelect.innerHTML = "";
    for (let i = 0; i < availableChapters.length; i++) {
      const ch = availableChapters[i];
      const option = el("option", "", String(ch));
      option.value = String(ch);
      option.textContent = "Exodus " + ch;
      chapterSelect.appendChild(option);
    }

    const idx = availableChapters.indexOf(chapter);
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx < 0 || idx >= availableChapters.length - 1;
    if (idx >= 0) chapterSelect.value = String(chapter);
    if (gameBtn) {
      const inGame = gameState && gameState.chapter === chapter;
      gameBtn.textContent = inGame ? "Read" : "Word game";
      gameBtn.setAttribute("aria-pressed", inGame ? "true" : "false");
    }
  }

  function appendReaderFooter(target) {
    const footer = el("footer", "reader-footer");
    footer.append(
      el("p", "reader-attribution", dataCache?.attribution || ""),
      el("p", "reader-translation", dataCache?.translation || "")
    );
    target.appendChild(footer);
    return footer;
  }

  function makeOptions(answer, keywords) {
    const answerKey = normalizeWord(answer);
    const distractors = shuffle(keywords.filter((item) => item.key !== answerKey))
      .slice(0, 3)
      .map((item) => item.display);
    return shuffle([answer, ...distractors]);
  }

  function buildGameStage(chapter, stageIndex) {
    const keywords = chapterKeywords(chapter);
    const target = Math.min(GAME_BLANK_COUNTS[stageIndex] || GAME_BLANK_COUNTS[0], keywords.length);
    const keywordKeys = new Set(keywords.slice(0, Math.max(target * 3, target)).map((item) => item.key));
    const rows = chapterEntries(chapter);
    const occurrences = [];
    rows.forEach((row) => {
      const usedInVerse = new Set();
      const matches = [...row.text.matchAll(/\b[A-Za-z][A-Za-z'-]{2,}\b/g)];
      matches.forEach((match) => {
        const key = normalizeWord(match[0]);
        if (!keywordKeys.has(key) || usedInVerse.has(key)) return;
        const keyword = keywords.find((item) => item.key === key);
        if (!keyword) return;
        occurrences.push({
          verse: row.verse,
          key,
          answer: keyword.display,
          index: match.index,
          length: match[0].length,
          score: keyword.score,
        });
        usedInVerse.add(key);
      });
    });

    const perVerse = {};
    const selected = [];
    occurrences
      .sort((a, b) => b.score - a.score || a.verse - b.verse)
      .forEach((item) => {
        if (selected.length >= target) return;
        if (selected.some((blank) => blank.key === item.key)) return;
        const count = perVerse[item.verse] || 0;
        if (count >= 2) return;
        perVerse[item.verse] = count + 1;
        selected.push(item);
      });

    occurrences.forEach((item) => {
      if (selected.length >= target) return;
      if (selected.some((blank) => blank.key === item.key && blank.verse === item.verse)) return;
      selected.push(item);
    });

    return selected
      .sort((a, b) => a.verse - b.verse || a.index - b.index)
      .slice(0, target)
      .map((item, idx) => ({
        ...item,
        id: "blank-" + idx,
        filled: false,
        wrong: false,
        options: makeOptions(item.answer, keywords),
      }));
  }

  function startGame(chapter, stageIndex = 0) {
    if (!dataCache) return;
    const normalizedChapter = normalizeChapter(chapter);
    if (normalizedChapter == null) return;
    const blanks = buildGameStage(normalizedChapter, stageIndex);
    gameState = {
      chapter: normalizedChapter,
      stageIndex,
      blanks,
      activeIndex: -1,
    };
    renderGame();
  }

  function activeBlank() {
    if (!gameState) return null;
    return gameState.blanks[gameState.activeIndex] || null;
  }

  function chooseGameOption(value) {
    let blank = activeBlank();
    if (!blank) {
      const next = gameState?.blanks.findIndex((item) => !item.filled) ?? -1;
      if (next >= 0) {
        gameState.activeIndex = next;
        blank = activeBlank();
      }
    }
    if (!blank) return false;
    const ok = normalizeWord(value) === normalizeWord(blank.answer);
    blank.wrong = !ok;
    if (ok) {
      blank.filled = true;
      gameState.activeIndex = -1;
    }
    renderGame();
    return ok;
  }

  function advanceGameStage() {
    if (!gameState) return;
    const next = gameState.stageIndex + 1;
    if (next >= GAME_BLANK_COUNTS.length) {
      gameState = null;
      renderChapter(activeChapter);
      return;
    }
    startGame(gameState.chapter, next);
  }

  function appendVerseGameText(row, blanks) {
    const text = row.text;
    const sorted = blanks.slice().sort((a, b) => a.index - b.index);
    let cursor = 0;
    sorted.forEach((blank) => {
      if (blank.index > cursor) row.node.append(document.createTextNode(text.slice(cursor, blank.index)));
      const btn = el("button", "reader-blank", blank.filled ? blank.answer : "_____");
      btn.type = "button";
      btn.dataset.blankId = blank.id;
      if (blank.filled) btn.classList.add("filled");
      if (blank.wrong) btn.classList.add("wrong");
      if (activeBlank()?.id === blank.id) btn.classList.add("active");
      btn.setAttribute("aria-label", blank.filled ? "Filled word: " + blank.answer : "Missing word in verse " + blank.verse);
      btn.setAttribute("aria-expanded", activeBlank()?.id === blank.id ? "true" : "false");
      if (!blank.filled) btn.setAttribute("aria-controls", "reader-choice-tray");
      btn.addEventListener("click", function () {
        gameState.activeIndex = blank.filled
          ? -1
          : gameState.blanks.findIndex((item) => item.id === blank.id);
        renderGame();
      });
      row.node.append(btn);
      cursor = blank.index + blank.length;
    });
    row.node.append(document.createTextNode(text.slice(cursor)));
  }

  function renderGame() {
    if (!gameState) return;
    const chapter = gameState.chapter;
    activeChapter = chapter;
    modalBody.innerHTML = "";
    updateHeaderControls(chapter);
    title.textContent = "Exodus " + chapter + " Word Game";

    const stageTotal = GAME_BLANK_COUNTS.length;
    const filled = gameState.blanks.filter((blank) => blank.filled).length;
    const complete = filled === gameState.blanks.length;
    const shell = el("div", "reader-game");
    const head = el("div", "reader-game-head");
    head.innerHTML = `
      <span>Stage ${gameState.stageIndex + 1}/${stageTotal}</span>
      <strong>${filled}/${gameState.blanks.length} blanks</strong>
    `;
    shell.appendChild(head);

    const verseWrap = el("div", "reader-game-verses");
    const byVerse = {};
    gameState.blanks.forEach((blank) => {
      (byVerse[blank.verse] || (byVerse[blank.verse] = [])).push(blank);
    });
    Object.keys(byVerse).map(Number).sort((a, b) => a - b).forEach((verse) => {
      const text = dataCache.verses[chapter + ":" + verse] || "";
      const row = el("div", "reader-verse reader-game-verse");
      row.dataset.verse = String(verse);
      const num = el("span", "reader-verse-number", verse);
      const txt = el("p", "reader-verse-text");
      row.append(num, txt);
      appendVerseGameText({ text, node: txt }, byVerse[verse]);
      verseWrap.appendChild(row);
    });
    shell.appendChild(verseWrap);
    appendReaderFooter(shell);

    const answer = el("div", "reader-game-options reader-choice-tray");
    answer.id = "reader-choice-tray";
    if (complete) {
      answer.classList.add("complete");
      const msg = el("p", "reader-game-done", gameState.stageIndex + 1 >= stageTotal ? "Chapter game complete." : "Stage complete.");
      const next = el("button", "primary-btn", gameState.stageIndex + 1 >= stageTotal ? "Back to reading" : "Next stage");
      next.type = "button";
      next.addEventListener("click", advanceGameStage);
      answer.append(msg, next);
      shell.appendChild(answer);
    } else {
      const blank = activeBlank();
      if (blank) {
        const prompt = el("p", "reader-game-prompt");
        prompt.append(el("span", "", "Missing word"), el("strong", "", "Verse " + blank.verse));
        answer.appendChild(prompt);
        blank.options.forEach((option) => {
          const btn = el("button", "reader-choice", option);
          btn.type = "button";
          btn.addEventListener("click", () => chooseGameOption(option));
          answer.appendChild(btn);
        });
        shell.appendChild(answer);
      }
    }
    modalBody.appendChild(shell);
    if (!complete && activeBlank()) {
      requestAnimationFrame(() => {
        modalBody.querySelector(".reader-blank.active")?.scrollIntoView({ block: "center" });
      });
    }
  }

  function highlightClassFromRange(fromVerse, toVerse, maxVerse) {
    if (!Number.isFinite(maxVerse)) return { from: null, to: null };
    if (!Number.isFinite(fromVerse)) return { from: null, to: null };
    let f = Math.max(1, Math.trunc(fromVerse));
    let t = Number.isFinite(toVerse) ? Math.trunc(toVerse) : f;
    if (f > t) [f, t] = [t, f];
    if (f < 1) f = 1;
    if (t > maxVerse) t = maxVerse;
    return { from: f, to: t };
  }

  function renderChapter(chapter, fromVerse, toVerse) {
    activeChapter = chapter;
    const isReady = dataCache && !fetchError;
    const chapterMax = isReady ? maxVerseFor(chapter) : null;

    modalBody.innerHTML = "";
    updateHeaderControls(chapter);

    if (!isReady) {
      modalBody.appendChild(el("p", "reader-message", "Unable to load the OSB text right now."));
      if (fetchError) {
        const e = el("p", "reader-message reader-error", fetchError);
        modalBody.appendChild(e);
      }
      return;
    }

    if (!Number.isFinite(chapterMax) || chapterMax < 1) {
      modalBody.appendChild(el("p", "reader-message", "This chapter isn't available offline yet."));
      appendReaderFooter(modalBody);
      return;
    }

    const range = highlightClassFromRange(fromVerse, toVerse, chapterMax);
    const first = range.from;
    const last = range.to;

    for (let verse = 1; verse <= chapterMax; verse++) {
      const rowKey = chapter + ":" + verse;
      if (dataCache.headings && dataCache.headings[rowKey]) {
        const heading = el("div", "reader-subheading", dataCache.headings[rowKey]);
        modalBody.appendChild(heading);
      }

      const text = dataCache.verses[rowKey] || "";
      const row = el("div", "reader-verse");
      row.dataset.verse = String(verse);
      if (Number.isFinite(first) && verse >= first && verse <= last) row.classList.add("verse-highlight");

      const num = el("span", "reader-verse-number", verse);
      const txt = el("p", "reader-verse-text", text);
      row.append(num, txt);
      modalBody.appendChild(row);
    }

    if (first != null) {
      const firstRow = modalBody.querySelector(".verse-highlight");
      if (firstRow) {
        firstRow.scrollIntoView({ block: "center" });
      }
    }

    appendReaderFooter(modalBody);
  }

  async function open(chapter, fromVerse, toVerse) {
    const normalizedChapter = normalizeChapter(chapter);
    if (normalizedChapter == null) return Promise.resolve();

    ensureModal();
    const data = await ensureReaderData();
    if (!data) {
      updateHeaderControls(normalizedChapter);
      modalBody.innerHTML = "";
      modalBody.appendChild(el("p", "reader-message", "Unable to load the OSB text right now."));
      if (fetchError) modalBody.appendChild(el("p", "reader-message reader-error", fetchError));
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    const maxVerse = maxVerseFor(normalizedChapter);
    const f = Number(fromVerse);
    const t = Number(toVerse);
    const from = Number.isFinite(f) ? f : null;
    const to = Number.isFinite(t) ? t : null;
    gameState = null;
    renderChapter(normalizedChapter, from, to);

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  async function openRef(refString) {
    const parsed = parseReference(refString);
    if (!parsed) return Promise.resolve();

    if (!dataCache && !fetchPromise) {
      ensureReaderData();
    }

    await ensureReaderData();

    const chapter = parsed.chapter;
    let fromVerse = parsed.fromVerse;
    let toVerse = parsed.toVerse;
    if (parsed.crossChapterEnd) {
      const maxVerse = maxVerseFor(chapter);
      if (Number.isFinite(maxVerse)) {
        toVerse = maxVerse;
      } else {
        toVerse = fromVerse;
      }
    }

    return open(chapter, fromVerse, toVerse);
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }

  window.BibleReader = {
    open,
    openRef,
    startGame,
    gameState: () => gameState && {
      chapter: gameState.chapter,
      stageIndex: gameState.stageIndex,
      activeIndex: gameState.activeIndex,
      blanks: gameState.blanks.map((blank) => ({
        id: blank.id,
        verse: blank.verse,
        answer: blank.answer,
        filled: blank.filled,
        options: blank.options,
      })),
    },
    answerGameCorrect: () => {
      const blank = activeBlank() || gameState?.blanks.find((item) => !item.filled);
      return blank ? chooseGameOption(blank.answer) : false;
    },
    nextGameStage: advanceGameStage,
  };
})();
