(() => {
  "use strict";

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const DATA_URL = new URL(
    "data/source-text/exodus/exodus-verses.json",
    SCRIPT_URL || window.location.href
  ).href;

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
  let closeBtn;
  let attributionEl;
  let translationEl;
  let activeChapter = null;

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

    closeBtn = el("button", "reader-close-btn", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close reader");

    selectWrap.append(selectLabel, chapterSelect);
    header.append(title, selectWrap, prevBtn, nextBtn, closeBtn);

    modalBody = el("div", "reader-body");
    const footer = el("footer", "reader-footer");
    attributionEl = el("p", "reader-attribution");
    translationEl = el("p", "reader-translation");
    footer.append(attributionEl, translationEl);

    card.append(header, modalBody, footer);
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
      attributionEl.textContent = "";
      translationEl.textContent = "";
      return;
    }

    if (!Number.isFinite(chapterMax) || chapterMax < 1) {
      modalBody.appendChild(el("p", "reader-message", "This chapter isn't available offline yet."));
      attributionEl.textContent = dataCache.attribution || "";
      translationEl.textContent = dataCache.translation || "";
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

    attributionEl.textContent = dataCache.attribution || "";
    translationEl.textContent = dataCache.translation || "";
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
      attributionEl.textContent = "";
      translationEl.textContent = "";
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    const maxVerse = maxVerseFor(normalizedChapter);
    const f = Number(fromVerse);
    const t = Number(toVerse);
    const from = Number.isFinite(f) ? f : null;
    const to = Number.isFinite(t) ? t : null;
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
  };
})();
