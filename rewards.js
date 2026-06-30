/* Bible Bowl Study — Interactive Exodus Wonders & Rewards System
   Tracks mastery percentage, awards trophies on a shelf, and shows
   immersive HTML5 Canvas animations for major milestones in Exodus. */

(() => {
  "use strict";

  const STORAGE_KEY = "bbs:stats:v1";
  const UNLOCKED_KEY = "bbs:unlocked-rewards:v1";
  const MASTERY_STREAK = 3;

  // The 8 milestones representing the journey of Exodus
  // Starts with concrete early wins, then widens by bank percentage.
  // OSB/LXX-aligned copy — verify exact OSB wording before final publication pass.
  const WONDERS = [
    {
      id: "red_sea",
      emoji: "🌊",
      label: "Red Sea",
      chapter: "Ch 14",
      threshold: { type: "masteries", value: 1 },
      ref: "Exodus 14:16, 21-22",
      quote: "Lift up your rod, and stretch forth your hand over the sea… and the Lord drove back the sea with a strong south wind all that night, and made the sea dry land.",
      desc: "Moses obeys by lifting the rod and stretching out his hand, but the Lord Himself opens the way through the sea. Saint Paul teaches that Israel was baptized into Moses in the cloud and in the sea, so the crossing becomes a pattern of deliverance through water.",
      tip: "Lift the rod and hold your hand over the sea until the south wind opens a dry path.",
      color: "#3498db"
    },
    {
      id: "marah",
      emoji: "💧",
      label: "Marah",
      chapter: "Ch 15",
      threshold: { type: "masteries", value: 6 },
      ref: "Exodus 15:23, 25-26",
      quote: "They could not drink the water, for it was bitter… and the Lord showed him a tree, and he cast it into the water, and the water was sweetened… 'I am the Lord your God who heals you.'",
      desc: "At Marah the bitter waters are healed by obedience to what God shows Moses. The Fathers read the wood cast into the water as a figure of the Cross: what is bitter becomes drinkable, and what is deadly becomes medicine.",
      tip: "Drag the tree into the bitter water and release it there.",
      color: "#2ecc71"
    },
    {
      id: "elim",
      emoji: "🌴",
      label: "Elim",
      chapter: "Ch 15",
      threshold: { type: "pct", value: 5 },
      ref: "Exodus 15:27",
      quote: "Then they came to Elim, where there were twelve springs of water and seventy palm trees, and they encamped there by the waters.",
      desc: "Elim is the oasis after bitterness: the Lord not only heals, He gives rest. The twelve springs and seventy palms teach ordered abundance for the whole people.",
      tip: "Find the twelve springs and camp under the seventy palms.",
      color: "#27ae60"
    },
    {
      id: "manna",
      emoji: "🍞",
      label: "Manna",
      chapter: "Ch 16",
      threshold: { type: "pct", value: 12 },
      ref: "Exodus 16:4-5, 13-21, 31-33",
      quote: "I will rain bread from heaven for you… on the sixth day it shall be double… in the evening quails came up and covered the camp; in the morning, when the dew ceased, the manna appeared.",
      desc: "The wilderness feeding has a holy rhythm: evening quail, morning dew, daily bread, no hoarding, double on the sixth day, rest on the seventh. Christ reveals the fullness: He is the true Bread from heaven and the Bread of Life.",
      tip: "Wait for the dew to lift, gather one day's portion, and on day six gather double.",
      color: "#f1c40f"
    },
    {
      id: "rephidim",
      emoji: "🪨",
      label: "Rephidim",
      chapter: "Ch 17",
      threshold: { type: "pct", value: 22 },
      ref: "Exodus 17:5-7",
      quote: "Take the rod… behold, I stand before you there on the rock in Horeb; and you shall strike the rock, and water will come out of it… and he called the place Massah and Meribah.",
      desc: "Rephidim is not only a miracle of water; it is also a story of quarreling and testing the Lord. The rock is struck once, and Saint Paul says plainly, 'that Rock was Christ.'",
      tip: "Strike the rock once with the rod, then watch the water flow.",
      color: "#e67e22"
    },
    {
      id: "sinai",
      emoji: "⛰️",
      label: "Sinai",
      chapter: "Ch 19",
      threshold: { type: "pct", value: 38 },
      ref: "Exodus 19:10-13, 16-18",
      quote: "Set bounds around the mountain… do not go up into the mountain, nor touch any part of it… there were voices, lightnings, a dark cloud, and a loud trumpet… because God descended upon it in fire.",
      desc: "Sinai teaches holy distance before it teaches ascent. The people are sanctified, the mountain is bounded, the trumpet grows louder, and Moses ascends only when God calls.",
      tip: "Set the bounds, stand back, and wait until God calls.",
      color: "#9b59b6"
    },
    {
      id: "golden_calf",
      emoji: "🐂",
      label: "Golden Calf",
      chapter: "Ch 32",
      threshold: { type: "pct", value: 60 },
      ref: "Exodus 32:19-20, 28",
      quote: "Moses saw the calf and the dancing… he broke the tablets beneath the mountain. Then he took the calf they made, burned it with fire, ground it very small, scattered it on the water, and made the children of Israel drink it.",
      desc: "While Moses was with God on the mountain, Israel fell into idolatry below, and Aaron was implicated in the making of the calf. Moses destroys the idol — burn, grind, scatter — and Israel faces the bitterness of false worship.",
      tip: "Burn the idol, grind it to dust, scatter it on the water, and remember the cost of idolatry.",
      color: "#e74c3c"
    },
    {
      id: "glory",
      emoji: "✨",
      label: "Glory",
      chapter: "Ch 40",
      threshold: { type: "pct", value: 100 },
      ref: "Exodus 40:34-38",
      quote: "The cloud covered the tabernacle of testimony, and the tabernacle was filled with the glory of the Lord. And Moses was not able to enter the tabernacle, because the cloud overshadowed it.",
      desc: "Exodus reaches its goal when the Lord fills His dwelling among His people. Moses can set up the tabernacle, but when the glory fills it, even he cannot enter. Saint John reveals the fulfillment: the Word became flesh and dwelt among us.",
      tip: "Wait outside and behold; when the glory fills the tent, even Moses does not enter.",
      color: "#f39c12"
    }
  ];

  window.BibleBowlScenes = window.BibleBowlScenes || {};
  window.BibleBowlScenes.WONDER_RULES = {
    red_sea: { captionStart: "Lift the rod", progress: "The Lord drives back the sea", captionDone: "Dry land through the sea" },
    marah: { captionStart: "Cast the tree", progress: "The bitter water is healed", captionDone: "The Lord who heals you" },
    elim: { captionStart: "Find the twelve springs", progress: "12 springs", captionDone: "They camped by the waters" },
    manna: { captionStart: "Wait for the dew to lift", progress: "Gather today's portion", captionDay6: "Day 6: gather double", captionSabbath: "Sabbath: no manna today", captionDone: "Bread from heaven" },
    rephidim: { captionStart: "Massah · Meribah", progress: "Strike the rock once", captionDone: "Water from the rock" },
    sinai: { captionStart: "Set bounds around Sinai", progress: "Stand back and wait", captionDone: "The Lord descends in fire" },
    golden_calf: { captionStart: "False worship below Sinai", progressBurn: "Burn the idol", progressGrind: "Grind it to dust", progressWater: "Scatter it on the water", captionDone: "The people face their sin" },
    glory: { captionStart: "Glory fills the tabernacle", progress: "Wait outside and behold", captionDone: "Moses could not enter" }
  };

  let unlockedList = [];
  let currentActiveWonder = null;
  let canvas, ctx, animationFrameId;
  let mouse = { x: 0, y: 0, px: 0, py: 0, down: false };
  let canvasTime = 0;
  let particles = [];
  let customWonderState = {}; // for extra custom toggles (like Sinai Day/Night)
  let totalQuestions = 0;    // filled in by bbs:stats-updated event detail
  let pendingUnlockItem = null;
  let pendingUnlockWonder = null;

  let isMuted = false;
  function rewardAudio() {
    return window.BibleBowlRewardsAudio || null;
  }

  function syncAudioMuted() {
    const audio = rewardAudio();
    if (audio) audio.setMuted(isMuted);
  }

  function resumeAudio() {
    const audio = rewardAudio();
    if (audio) audio.resume();
  }

  function playSound(type) {
    const audio = rewardAudio();
    if (audio) audio.playSound(type);
  }

  // Load unlocked rewards from localStorage
  function loadUnlocked() {
    try {
      unlockedList = JSON.parse(localStorage.getItem(UNLOCKED_KEY)) || [];
    } catch (e) {
      unlockedList = [];
    }
    isMuted = localStorage.getItem("bbs:muted") === "true";
    syncAudioMuted();
  }

  // Save unlocked rewards
  function saveUnlocked() {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlockedList));
    } catch (e) {}
  }

  function getSavedStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function getMasteredCount(stats = getSavedStats()) {
    return Object.values(stats).filter((s) => s && s.streak >= MASTERY_STREAK).length;
  }

  function getClosestStreak(stats = getSavedStats()) {
    return Object.values(stats).reduce((best, s) => {
      const streak = Math.max(0, Math.min(MASTERY_STREAK, s?.streak || 0));
      return Math.max(best, streak);
    }, 0);
  }

  function resolveWonderTarget(w, total = totalQuestions) {
    if (w.threshold.type === "masteries") return Math.max(1, w.threshold.value);
    if (!total || total < 1) return null;
    return Math.max(1, Math.min(total, Math.ceil((w.threshold.value / 100) * total)));
  }

  function wonderThresholdShort(w) {
    if (w.threshold.type === "masteries") return String(w.threshold.value);
    return `${w.threshold.value}%`;
  }

  function wonderThresholdText(w) {
    if (w.threshold.type === "masteries") {
      return w.threshold.value === 1 ? "1 mastered question" : `${w.threshold.value} mastered questions`;
    }
    const target = resolveWonderTarget(w);
    if (target) return `${target} mastered questions (${w.threshold.value}% of the bank)`;
    return `${w.threshold.value}% of the question bank mastered`;
  }

  function isWonderUnlocked(w, masteredCount) {
    const target = resolveWonderTarget(w);
    return target !== null && masteredCount >= target;
  }

  function getNextLockedWonder() {
    const masteredCount = getMasteredCount();
    for (let i = 0; i < WONDERS.length; i++) {
      if (!isWonderUnlocked(WONDERS[i], masteredCount)) return WONDERS[i];
    }
    return null;
  }

  function getWonderProgress(w) {
    const stats = getSavedStats();
    const masteredCount = getMasteredCount(stats);
    const idx = WONDERS.indexOf(w);
    const target = resolveWonderTarget(w);

    if (w.id === "red_sea" && masteredCount < 1) {
      const closest = getClosestStreak(stats);
      return {
        fraction: Math.min(1, closest / MASTERY_STREAK),
        countLabel: `${closest} / ${MASTERY_STREAK} toward first mastery`,
        remainingLabel: `Closest question: ${closest} of ${MASTERY_STREAK}`,
      };
    }

    if (target === null) {
      return {
        fraction: 0,
        countLabel: wonderThresholdShort(w),
        remainingLabel: "Loading question bank",
      };
    }

    if (w.threshold.type === "masteries") {
      const remaining = Math.max(0, target - masteredCount);
      return {
        fraction: Math.min(1, masteredCount / target),
        countLabel: `${masteredCount} / ${target} mastered`,
        remainingLabel: remaining <= 0 ? "Ready to unlock" : remaining === 1 ? "1 more to master" : `${remaining} more to master`,
      };
    }

    let floor = 0;
    if (idx > 0) floor = resolveWonderTarget(WONDERS[idx - 1]) || 0;
    const span = Math.max(1, target - floor);
    const current = Math.max(0, masteredCount - floor);
    const remaining = Math.max(0, target - masteredCount);
    return {
      fraction: Math.min(1, current / span),
      countLabel: `${masteredCount} / ${target} mastered`,
      remainingLabel: remaining <= 0 ? "Ready to unlock" : remaining === 1 ? "1 more to master" : `${remaining} more to master`,
    };
  }

  function updateNextProgressBar() {
    const bar = document.getElementById("rewards-next-bar");
    if (!bar) return;

    const fill = document.getElementById("rewards-next-fill");
    const label = document.getElementById("rewards-next-label");
    const count = document.getElementById("rewards-next-count");
    const next = getNextLockedWonder();

    if (!next) {
      label.textContent = "All Exodus wonders unlocked";
      count.textContent = "✨ Complete";
      fill.style.width = "100%";
      fill.style.backgroundColor = "var(--accent)";
      bar.setAttribute("aria-valuenow", "100");
      bar.setAttribute("aria-label", "All Exodus wonders unlocked");
      return;
    }

    const prog = getWonderProgress(next);
    const pct = Math.round(prog.fraction * 100);
    label.textContent = `Next wonder: ${next.emoji} ${next.label}`;
    count.textContent = prog.remainingLabel;
    fill.style.width = `${pct}%`;
    fill.style.backgroundColor = next.color;
    bar.setAttribute("aria-valuenow", String(pct));
    bar.setAttribute("aria-label", `${prog.remainingLabel} until ${next.label} unlocks`);
  }

  // Initialize UI elements and append shelf
  function init() {
    loadUnlocked();

    let shelf = document.getElementById("rewards-trophy-shelf");
    if (!shelf) {
      shelf = document.createElement("div");
      shelf.id = "rewards-trophy-shelf";
      shelf.className = "trophy-shelf";

      const footer = document.querySelector(".site-footer");
      if (footer) {
        footer.parentNode.insertBefore(shelf, footer);
      } else {
        document.body.appendChild(shelf);
      }
    }

    shelf.innerHTML = `
      <div class="trophy-shelf-title">Wonders of the Exodus</div>
      <div class="trophy-grid" id="trophy-grid"></div>
    `;

    if (!document.getElementById("rewards-next-bar")) {
      const nextBar = document.createElement("div");
      nextBar.id = "rewards-next-bar";
      nextBar.className = "rewards-next-bar";
      nextBar.setAttribute("role", "progressbar");
      nextBar.setAttribute("aria-valuemin", "0");
      nextBar.setAttribute("aria-valuemax", "100");
      nextBar.innerHTML = `
        <div class="rewards-next-bar-inner">
          <div class="rewards-next-bar-labels">
            <span id="rewards-next-label" class="rewards-next-label">Next wonder</span>
            <span id="rewards-next-count" class="rewards-next-count">—</span>
          </div>
          <div class="rewards-next-track" aria-hidden="true">
            <div id="rewards-next-fill" class="rewards-next-fill"></div>
          </div>
        </div>
      `;
      document.body.appendChild(nextBar);
    }

    if (!document.getElementById("rewards-modal")) {
      const modal = document.createElement("div");
      modal.id = "rewards-modal";
      modal.className = "rewards-modal";
      modal.innerHTML = `
        <div class="rewards-card">
          <div id="rewards-scene" class="rewards-scene">
            <canvas id="rewards-canvas" class="rewards-canvas"></canvas>
            <p id="rewards-scene-hint" class="rewards-scene-hint">Tap or drag to interact</p>
          </div>
          <div id="rewards-hud" class="rewards-panel">
            <header class="rewards-panel-head">
              <span id="rewards-hud-badge" class="rewards-hud-badge">🏆</span>
              <div class="rewards-panel-titles">
                <div id="rewards-hud-milestone" class="rewards-hud-milestone">Milestone Unlocked</div>
                <h2 id="rewards-hud-title" class="rewards-hud-title">Wonder Name</h2>
              </div>
            </header>
            <details class="rewards-passage">
              <summary>Scripture &amp; story</summary>
              <blockquote id="rewards-hud-quote" class="rewards-hud-quote"></blockquote>
              <p id="rewards-hud-desc" class="rewards-hud-desc"></p>
            </details>
            <p id="rewards-hud-tip" class="rewards-hud-tip"></p>
            <div id="rewards-hud-controls" class="rewards-hud-controls"></div>
            <button id="rewards-hud-close" type="button" class="primary-btn rewards-hud-close">Return to Study</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("rewards-hud-close").addEventListener("click", closeModal);

      canvas = document.getElementById("rewards-canvas");
      ctx = canvas.getContext("2d");
      const scene = document.getElementById("rewards-scene");
      const hint = document.getElementById("rewards-scene-hint");

      function hideSceneHint() {
        if (hint) hint.classList.add("hidden");
      }

      function updatePointer(e) {
        const rect = canvas.getBoundingClientRect();
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      }

      scene.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        scene.setPointerCapture(e.pointerId);
        mouse.down = true;
        updatePointer(e);
        hideSceneHint();
      });
      scene.addEventListener("pointermove", (e) => {
        if (e.pointerType === "mouse" || mouse.down) updatePointer(e);
      });
      scene.addEventListener("pointerup", () => { mouse.down = false; });
      scene.addEventListener("pointercancel", () => { mouse.down = false; });

      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
          if (!currentActiveWonder) return;
          const prevW = canvas.width;
          const prevH = canvas.height;
          resizeCanvas();
          if (canvas.width !== prevW || canvas.height !== prevH) {
            particles = [];
            const sinaiMode = customWonderState.mode;
            customWonderState = {};
            if (currentActiveWonder.id === "sinai" && sinaiMode) {
              customWonderState.mode = sinaiMode;
            }
            if (window.BibleBowlScenes && typeof window.BibleBowlScenes.setupParticles === "function") {
              window.BibleBowlScenes.setupParticles(
                currentActiveWonder.id, canvas.width, canvas.height, particles, customWonderState
              );
            }
          }
        }).observe(scene);
      } else {
        window.addEventListener("resize", resizeCanvas);
      }
    }

    // Trophy shelf is built; trophies render once app.js fires bbs:stats-updated.
    // Render locked placeholders now so the shelf isn't empty while loading.
    renderLockedShelf();
    updateNextProgressBar();
  }

  // Locked shelf copy — no spoilers for wonders not yet earned
  function lockedTrophyMarkup(w) {
    const req = wonderThresholdShort(w);
    return `
      <span class="trophy-icon">🔒</span>
      <span class="trophy-label trophy-label-mystery">???</span>
      <span class="trophy-chapter">${req}</span>
      <span class="trophy-tooltip">🔒 ${wonderThresholdText(w)} to reveal</span>
    `;
  }

  function unlockedTrophyMarkup(w) {
    return `
      <span class="trophy-icon">${w.emoji}</span>
      <span class="trophy-label">${w.label}</span>
      <span class="trophy-chapter">${w.chapter}</span>
      <span class="trophy-tooltip">${w.emoji} ${w.label} (${w.chapter} — ${wonderThresholdText(w)}) — Click to open</span>
    `;
  }

  // Render all trophies as locked while waiting for the real total to arrive
  function renderLockedShelf() {
    const grid = document.getElementById("trophy-grid");
    if (!grid) return;
    grid.innerHTML = "";
    WONDERS.forEach(w => {
      const item = document.createElement("div");
      item.className = "trophy-item locked";
      item.innerHTML = lockedTrophyMarkup(w);
      grid.appendChild(item);
    });
  }

  // Update trophies on the shelf based on stats
  function updateTrophies() {
    const grid = document.getElementById("trophy-grid");
    if (!grid) return;

    const masteredCount = getMasteredCount();
    const newlyUnlocked = [];

    grid.innerHTML = "";

    WONDERS.forEach(w => {
      const isUnlocked = isWonderUnlocked(w, masteredCount);
      const isAlreadySaved = unlockedList.includes(w.id);

      if (isUnlocked && !isAlreadySaved) {
        unlockedList.push(w.id);
        newlyUnlocked.push(w);
      }

      const item = document.createElement("div");
      item.className = `trophy-item ${isUnlocked ? "unlocked" : "locked"}`;
      item.innerHTML = isUnlocked ? unlockedTrophyMarkup(w) : lockedTrophyMarkup(w);

      if (isUnlocked) {
        item.addEventListener("click", () => {
          openModal(w, false);
        });
      }

      grid.appendChild(item);
    });

    updateNextProgressBar();

    if (newlyUnlocked.length > 0) {
      saveUnlocked();
      playSound("unlock");

      const highestNew = newlyUnlocked.sort(
        (a, b) => WONDERS.findIndex((w) => w.id === b.id) - WONDERS.findIndex((w) => w.id === a.id)
      )[0];
      const items = grid.querySelectorAll(".trophy-item");
      WONDERS.forEach((w, idx) => {
        if (w.id === highestNew.id && items[idx]) {
          items[idx].classList.add("newly-unlocked");
          pendingUnlockItem = items[idx];
          pendingUnlockWonder = highestNew;
          setTimeout(() => items[idx].classList.remove("newly-unlocked"), 10000);
        }
      });
    }
  }

  function scrollToUnlockedTrophy(itemEl, wonder) {
    if (!itemEl) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const shelf = document.getElementById("rewards-trophy-shelf");
    if (shelf) {
      shelf.classList.add("shelf-unlock-moment");
      setTimeout(() => shelf.classList.remove("shelf-unlock-moment"), 3200);
    }

    itemEl.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
      inline: "center",
    });

    if (wonder && shelf) {
      shelf.setAttribute("aria-label", `${wonder.label} unlocked — ${wonderThresholdText(wonder)}`);
    }
  }

  window.BibleBowlHasPendingUnlock = () => !!pendingUnlockItem;

  window.BibleBowlConsumeUnlockScroll = () => {
    if (!pendingUnlockItem) return false;
    const itemEl = pendingUnlockItem;
    const wonder = pendingUnlockWonder;
    pendingUnlockItem = null;
    pendingUnlockWonder = null;
    requestAnimationFrame(() => scrollToUnlockedTrophy(itemEl, wonder));
    return true;
  };

  // Open overlay modal and start animation
  function openModal(wonder, isNew) {
    currentActiveWonder = wonder;
    customWonderState = {}; 
    particles = [];
    canvasTime = 0;

    const modal = document.getElementById("rewards-modal");
    document.getElementById("rewards-hud-badge").textContent = wonder.emoji;
    document.getElementById("rewards-hud-milestone").textContent = isNew
      ? `Milestone Unlocked (${wonderThresholdShort(wonder)})`
      : `${wonder.chapter} Landmark (${wonderThresholdShort(wonder)})`;
    document.getElementById("rewards-hud-title").textContent = wonder.label;
    document.getElementById("rewards-hud-quote").textContent = wonder.quote;
    document.getElementById("rewards-hud-desc").textContent = wonder.desc;
    document.getElementById("rewards-hud-tip").textContent = wonder.tip;

    const controls = document.getElementById("rewards-hud-controls");
    controls.innerHTML = "";

    // Toggle Sound Button
    const btnMute = document.createElement("button");
    btnMute.className = `rewards-control-btn ${isMuted ? "active" : ""}`;
    btnMute.textContent = isMuted ? "🔇 Muted" : "🔊 Sound On";
    btnMute.addEventListener("click", () => {
      isMuted = !isMuted;
      localStorage.setItem("bbs:muted", String(isMuted));
      syncAudioMuted();
      btnMute.textContent = isMuted ? "🔇 Muted" : "🔊 Sound On";
      btnMute.className = `rewards-control-btn ${isMuted ? "active" : ""}`;
      if (!isMuted) resumeAudio();
    });

    if (wonder.id === "sinai") {
      customWonderState.mode = "night";
      const btnDay = document.createElement("button");
      btnDay.className = "rewards-control-btn";
      btnDay.textContent = "☀️ Pillar of Cloud";
      const btnNight = document.createElement("button");
      btnNight.className = "rewards-control-btn active";
      btnNight.textContent = "🔥 Pillar of Fire";

      btnDay.addEventListener("click", () => {
        customWonderState.mode = "day";
        btnDay.classList.add("active");
        btnNight.classList.remove("active");
      });
      btnNight.addEventListener("click", () => {
        customWonderState.mode = "night";
        btnNight.classList.add("active");
        btnDay.classList.remove("active");
      });
      controls.appendChild(btnDay);
      controls.appendChild(btnNight);
    }
    
    controls.appendChild(btnMute);

    const passage = modal.querySelector(".rewards-passage");
    const hint = document.getElementById("rewards-scene-hint");
    if (passage) passage.open = window.matchMedia("(min-width: 720px)").matches;
    if (hint) hint.classList.remove("hidden");

    modal.classList.add("active");

    requestAnimationFrame(() => {
      resizeCanvas();
      if (window.BibleBowlScenes && typeof window.BibleBowlScenes.setupParticles === "function") {
        window.BibleBowlScenes.setupParticles(wonder.id, canvas.width, canvas.height, particles, customWonderState);
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      tick();
    });
  }

  function closeModal() {
    const modal = document.getElementById("rewards-modal");
    modal.classList.remove("active");
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    currentActiveWonder = null;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const scene = document.getElementById("rewards-scene");
    const box = scene ? scene.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight * 0.45 };
    canvas.width = Math.max(1, Math.floor(box.width));
    canvas.height = Math.max(1, Math.floor(box.height));
  }

  // Animation Loop
  function tick() {
    if (!currentActiveWonder) return;
    canvasTime++;

    const w = canvas.width;
    const h = canvas.height;

    drawBackground(currentActiveWonder.id, w, h);

    if (window.BibleBowlScenes && typeof window.BibleBowlScenes[currentActiveWonder.id] === "function") {
      window.BibleBowlScenes[currentActiveWonder.id](w, h, ctx, canvasTime, mouse, particles, customWonderState);
    }

    if (particles.length > 450) particles.splice(0, particles.length - 450);

    animationFrameId = requestAnimationFrame(tick);
  }

  function drawBackground(id, w, h) {
    ctx.clearRect(0, 0, w, h);
    let grad;

    if (id === "red_sea") {
      grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w*0.8);
      grad.addColorStop(0, "#1a1612"); 
      grad.addColorStop(1, "#07131a"); 
    } else if (id === "marah") {
      grad = ctx.createLinearGradient(0, 0, 0, h);
      if (customWonderState.sweetened) {
        grad.addColorStop(0, "#08101a");
        grad.addColorStop(1, "#0f2f3d");
      } else {
        grad.addColorStop(0, "#0b0c09");
        grad.addColorStop(1, "#171c14");
      }
    } else if (id === "elim") {
      grad = ctx.createRadialGradient(w/2, h*0.4, 50, w/2, h*0.5, w);
      grad.addColorStop(0, "#19241d"); 
      grad.addColorStop(1, "#080c09");
    } else if (id === "manna") {
      grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#060912"); 
      grad.addColorStop(0.7, "#141624");
      grad.addColorStop(1, "#0a0a0f");
    } else if (id === "rephidim") {
      grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w);
      grad.addColorStop(0, "#1c1712"); 
      grad.addColorStop(1, "#090807");
    } else if (id === "sinai") {
      grad = ctx.createLinearGradient(0, 0, 0, h);
      if (customWonderState.mode === "day") {
        grad.addColorStop(0, "#5a6a7a");
        grad.addColorStop(0.45, "#3d4a58");
        grad.addColorStop(1, "#252d38");
      } else {
        grad.addColorStop(0, "#1a1020");
        grad.addColorStop(0.55, "#120a14");
        grad.addColorStop(1, "#08040a");
      }
    } else if (id === "golden_calf") {
      grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w);
      grad.addColorStop(0, "#140e0c"); 
      grad.addColorStop(1, "#070505");
    } else if (id === "glory") {
      grad = ctx.createRadialGradient(w/2, h*0.4, 10, w/2, h*0.4, w*0.8);
      grad.addColorStop(0, "#2c1c08"); 
      grad.addColorStop(0.6, "#0a0705");
      grad.addColorStop(1, "#030202");
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Event listener for progress changes
  window.addEventListener("bbs:stats-updated", (e) => {
    if (e.detail && e.detail.total) totalQuestions = e.detail.total;
    updateTrophies();
  });

  // init() sets up the shelf & modal but does NOT call updateTrophies() —
  // that fires only after app.js dispatches bbs:stats-updated with the real total.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (new URLSearchParams(location.search).get("qa") === "1") {
    window.BibleBowlQA = {
      wonders: WONDERS.map((w) => w.id),
      open(id) {
        const w = WONDERS.find((x) => x.id === id);
        if (w) openModal(w, false);
      },
      close() {
        closeModal();
      },
      rewardThresholds(total = totalQuestions) {
        return {
          total,
          thresholds: WONDERS.map((w) => ({
            id: w.id,
            type: w.threshold.type,
            value: w.threshold.value,
            target: resolveWonderTarget(w, total),
          })),
        };
      },
      nextProgress() {
        const next = getNextLockedWonder();
        return next ? { id: next.id, ...getWonderProgress(next) } : { id: null, fraction: 1 };
      },
      state() {
        return {
          wonder: currentActiveWonder ? currentActiveWonder.id : null,
          custom: JSON.parse(JSON.stringify(customWonderState)),
          canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
          uiScale: window.BibleBowlScenes && window.BibleBowlScenes.uiScale
            ? window.BibleBowlScenes.uiScale(canvas ? canvas.width : 390)
            : 1
        };
      }
    };
  }

})();
