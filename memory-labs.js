/* Bible Bowl Study — Memory Labs shelf, unlock, and modal */

(() => {
  "use strict";

  const STATS_KEY = "bbs:stats:v1";
  const COMPLETED_KEY = "bbs:labs-completed:v1";
  const SEEN_KEY = "bbs:labs-seen-unlock:v1";
  const QA_MODE = new URLSearchParams(location.search).get("qa") === "1";
  const MASTERY_STREAK = 3;

  const LABS = (window.BibleBowlLabs && window.BibleBowlLabs.labs) || [];
  let questionBank = [];
  let completedLabs = [];
  let seenUnlock = [];
  let currentLab = null;
  let labSession = null;

  function loadFlags() {
    try {
      completedLabs = JSON.parse(localStorage.getItem(COMPLETED_KEY)) || [];
    } catch (e) {
      completedLabs = [];
    }
    try {
      seenUnlock = JSON.parse(localStorage.getItem(SEEN_KEY)) || [];
    } catch (e) {
      seenUnlock = [];
    }
  }

  function saveCompleted() {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(completedLabs));
    } catch (e) {}
  }

  function saveSeenUnlock() {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seenUnlock));
    } catch (e) {}
  }

  async function loadQuestions() {
    if (questionBank.length) return;
    try {
      const res = await fetch("data/questions.json");
      questionBank = await res.json();
    } catch (e) {
      questionBank = [];
    }
  }

  function getStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function countChapterMasteries(chapters) {
    const stats = getStats();
    const set = new Set(chapters);
    let n = 0;
    questionBank.forEach((q) => {
      if (!set.has(q.chapter)) return;
      const s = stats[q.id];
      if (s && (s.streak || 0) >= MASTERY_STREAK) n++;
    });
    return n;
  }

  function unlockText(lab) {
    const u = lab.unlock;
    if (!u) return "";
    return `${u.min} mastered in ch. ${u.chapters.join(", ")}`;
  }

  function isLabUnlocked(lab) {
    if (QA_MODE) return true;
    if (!lab.unlock) return true;
    return countChapterMasteries(lab.unlock.chapters) >= lab.unlock.min;
  }

  function labProgress(lab) {
    if (!lab.unlock) return { fraction: 1, label: "Ready" };
    const have = countChapterMasteries(lab.unlock.chapters);
    const need = lab.unlock.min;
    return {
      fraction: Math.min(1, have / need),
      label: `${have} / ${need} in target chapters`,
      remaining: Math.max(0, need - have),
    };
  }

  function initShelf() {
    let shelf = document.getElementById("memory-labs-shelf");
    if (!shelf) {
      shelf = document.createElement("div");
      shelf.id = "memory-labs-shelf";
      shelf.className = "trophy-shelf memory-labs-shelf";
      const wonders = document.getElementById("rewards-trophy-shelf");
      if (wonders && wonders.parentNode) {
        wonders.parentNode.insertBefore(shelf, wonders.nextSibling);
      } else {
        const footer = document.querySelector(".site-footer");
        if (footer) footer.parentNode.insertBefore(shelf, footer);
        else document.body.appendChild(shelf);
      }
    }

    shelf.innerHTML = `
      <div class="trophy-shelf-title">Memory Labs</div>
      <p class="memory-labs-intro">${window.BibleBowlLabs.intro || ""}</p>
      <div class="trophy-grid memory-labs-grid" id="memory-labs-grid"></div>
    `;

    if (!document.getElementById("labs-modal")) {
      const modal = document.createElement("div");
      modal.id = "labs-modal";
      modal.className = "labs-modal";
      modal.innerHTML = `
        <div class="labs-card">
          <div id="labs-workspace" class="labs-workspace"></div>
          <div class="labs-panel">
            <header class="labs-panel-head">
              <span id="labs-badge" class="labs-badge">📜</span>
              <div class="labs-panel-titles">
                <div id="labs-milestone" class="labs-milestone">Memory Lab</div>
                <h2 id="labs-title" class="labs-title">Lab</h2>
                <p id="labs-ref" class="labs-ref"></p>
              </div>
            </header>
            <div id="labs-teaching" class="labs-teaching" hidden></div>
            <details class="labs-passage">
              <summary>About this lab</summary>
              <p id="labs-desc" class="labs-desc"></p>
              <p id="labs-tip" class="labs-tip"></p>
            </details>
            <p id="labs-status" class="labs-status-line"></p>
            <div class="labs-actions">
              <button id="labs-replay" type="button" class="primary-btn ghost-btn labs-replay-btn" hidden>Play Again</button>
              <button id="labs-close" type="button" class="primary-btn labs-close-btn">Return to Study</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById("labs-close").addEventListener("click", closeLabModal);
      document.getElementById("labs-replay").addEventListener("click", () => {
        if (currentLab) mountLabPlay(currentLab);
        document.getElementById("labs-replay").hidden = true;
        document.getElementById("labs-milestone").textContent = "Memory Lab";
      });
    }
  }

  function renderShelf() {
    const grid = document.getElementById("memory-labs-grid");
    if (!grid) return;
    grid.innerHTML = "";

    LABS.forEach((lab) => {
      const unlocked = isLabUnlocked(lab);
      const done = completedLabs.includes(lab.id);
      const item = document.createElement("div");
      const bestMedal = unlocked && window.BibleBowlLabMedals && window.BibleBowlLabMedals.readBest(lab.id);
      const tierClass = bestMedal ? ` medal-${bestMedal.tier}` : "";
      let doneMark = "";
      let tooltipTail = done ? "Completed" : "Click to practice";
      if (bestMedal) {
        const emoji = window.BibleBowlLabMedals.TIER_EMOJI[bestMedal.tier];
        const label = window.BibleBowlLabMedals.TIER_LABEL[bestMedal.tier];
        const hints = bestMedal.hints || 0;
        doneMark = `<span class="lab-done-mark lab-medal-badge medal-${bestMedal.tier}" aria-label="${label}">${emoji}</span>`;
        tooltipTail = `${label} — ${hints === 0 ? "mastered with no hints" : `${hints} hint${hints === 1 ? "" : "s"}`}`;
      } else if (done) {
        doneMark = '<span class="lab-done-mark">✓</span>';
      }
      item.className = `trophy-item memory-lab-item ${unlocked ? "unlocked" : "locked"}${done ? " completed" : ""}${tierClass}`;
      item.dataset.labId = lab.id;

      if (unlocked) {
        item.innerHTML = `
          <span class="trophy-icon">${lab.emoji}${doneMark}</span>
          <span class="trophy-label">${lab.label}</span>
          <span class="trophy-chapter">${lab.ref}</span>
          <span class="trophy-tooltip">${lab.emoji} ${lab.label} — ${tooltipTail}</span>
        `;
        item.addEventListener("click", () => openLabModal(lab));
      } else {
        const prog = labProgress(lab);
        item.innerHTML = `
          <span class="trophy-icon">🔒</span>
          <span class="trophy-label trophy-label-mystery">???</span>
          <span class="trophy-chapter">${prog.remaining} to go</span>
          <span class="trophy-tooltip">🔒 ${unlockText(lab)}</span>
        `;
      }
      grid.appendChild(item);
    });
  }

  function showUnlockTeaching(lab) {
    const box = document.getElementById("labs-teaching");
    const ws = document.getElementById("labs-workspace");
    box.hidden = false;
    ws.hidden = true;
    const t = lab.unlock_teaching;
    box.innerHTML = `
      <h3 class="labs-teaching-head">${t.headline}</h3>
      <p class="labs-teaching-body">${t.body}</p>
      <button type="button" class="primary-btn" id="labs-begin-btn">Begin lab</button>
    `;
    document.getElementById("labs-begin-btn").addEventListener("click", () => {
      if (!seenUnlock.includes(lab.id)) {
        seenUnlock.push(lab.id);
        saveSeenUnlock();
      }
      box.hidden = true;
      ws.hidden = false;
      mountLabPlay(lab);
    });
  }

  function mountLabPlay(lab) {
    const ws = document.getElementById("labs-workspace");
    ws.innerHTML = "";
    ws.classList.remove("labs-workspace--tabernacle");
    if (window.BibleBowlLabDrag) window.BibleBowlLabDrag.unmount();
    if (window.BibleBowlLabTree) window.BibleBowlLabTree.unmount();
    if (window.BibleBowlLabTabernacle) window.BibleBowlLabTabernacle.unmount();

    const onComplete = () => {
      if (!completedLabs.includes(lab.id)) {
        completedLabs.push(lab.id);
        saveCompleted();
        renderShelf();
      }
      document.getElementById("labs-status").textContent = lab.completion_teaching.memory_sentence;
      document.getElementById("labs-milestone").textContent = "Memory Lab · completed";
      const replayBtn = document.getElementById("labs-replay");
      if (replayBtn) replayBtn.hidden = false;
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("unlock");
    };

    if (lab.interaction.type === "tabernacle_place" && window.BibleBowlLabTabernacle) {
      ws.classList.add("labs-workspace--tabernacle");
      labSession = window.BibleBowlLabTabernacle.mount(ws, lab, { onComplete });
    } else if (lab.interaction.type === "tree_place" && window.BibleBowlLabTree) {
      labSession = window.BibleBowlLabTree.mount(ws, lab, { onComplete });
    } else if (window.BibleBowlLabDrag) {
      labSession = window.BibleBowlLabDrag.mount(ws, lab, { onComplete });
    }
  }

  function openLabModal(lab) {
    currentLab = lab;
    const modal = document.getElementById("labs-modal");
    document.getElementById("labs-badge").textContent = lab.emoji;
    // Opening any lab — even an already-completed one — drops the player
    // into a fresh, playable board. So the panel always reads as active
    // gameplay ("Memory Lab"), never "· completed". The completed state
    // belongs on the shelf and on the post-finish screen (onComplete),
    // not over a live dispenser. The "Play Again" button likewise stays
    // hidden until the player actually finishes this run.
    document.getElementById("labs-milestone").textContent = "Memory Lab";
    const replayBtn = document.getElementById("labs-replay");
    if (replayBtn) replayBtn.hidden = true;
    document.getElementById("labs-title").textContent = lab.label;
    document.getElementById("labs-ref").textContent = lab.ref;
    document.getElementById("labs-desc").textContent = lab.description || "";
    document.getElementById("labs-tip").textContent = lab.tip ? `Tip: ${lab.tip}` : "";
    document.getElementById("labs-status").textContent = lab.subtitle || "";

    const ws = document.getElementById("labs-workspace");
    ws.innerHTML = "";
    ws.hidden = false;
    document.getElementById("labs-teaching").hidden = true;

    modal.classList.add("active");

    const needIntro = !seenUnlock.includes(lab.id) && lab.unlock_teaching;
    if (needIntro) {
      showUnlockTeaching(lab);
    } else {
      mountLabPlay(lab);
    }
  }

  function closeLabModal() {
    document.getElementById("labs-modal").classList.remove("active");
    document.getElementById("labs-workspace").classList.remove("labs-workspace--tabernacle");
    if (window.BibleBowlLabDrag) window.BibleBowlLabDrag.unmount();
    if (window.BibleBowlLabTree) window.BibleBowlLabTree.unmount();
    if (window.BibleBowlLabTabernacle) window.BibleBowlLabTabernacle.unmount();
    labSession = null;
    currentLab = null;
  }

  async function init() {
    loadFlags();
    initShelf();
    await loadQuestions();
    renderShelf();
  }

  window.addEventListener("bbs:stats-updated", async () => {
    await loadQuestions();
    renderShelf();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (QA_MODE) {
    window.BibleBowlLabQA = {
      labs: LABS.map((l) => l.id),
      unlockAll() {
        localStorage.setItem(
          STATS_KEY,
          JSON.stringify(
            Object.fromEntries(
              questionBank.map((q) => [q.id, { streak: 3, right: 3, wrong: 0, seen: 3 }])
            )
          )
        );
        renderShelf();
      },
      open(id) {
        const lab = LABS.find((l) => l.id === id);
        if (lab) openLabModal(lab);
      },
      close() {
        closeLabModal();
      },
      beginPlay() {
        const btn = document.getElementById("labs-begin-btn");
        if (btn) btn.click();
        else if (currentLab) mountLabPlay(currentLab);
      },
      solve() {
        if (!currentLab) return false;
        if (currentLab.interaction.type === "tabernacle_place" && window.BibleBowlLabTabernacle) {
          const a = window.BibleBowlLabTabernacle.getActive();
          if (a) {
            a.fillCorrect();
            a.check();
          }
        } else if (currentLab.interaction.type === "tree_place" && window.BibleBowlLabTree) {
          const a = window.BibleBowlLabTree.getActive();
          if (a) {
            a.fillCorrect();
            a.check();
          }
        } else if (window.BibleBowlLabDrag) {
          const a = window.BibleBowlLabDrag.getActive();
          if (a) {
            a.setOrder(currentLab.ordered_items.slice());
            a.check();
          }
        }
        return true;
      },
      state() {
        const drag = window.BibleBowlLabDrag && window.BibleBowlLabDrag.getActive();
        const tree = window.BibleBowlLabTree && window.BibleBowlLabTree.getActive();
        const tab = window.BibleBowlLabTabernacle && window.BibleBowlLabTabernacle.getActive();
        return {
          lab: currentLab ? currentLab.id : null,
          drag: drag ? drag.state : null,
          tree: tree ? tree.state : null,
          tabernacle: tab ? tab.state : null,
          completed: completedLabs.slice(),
        };
      },
    };
  }
})();
