/* Bible Bowl Study — Interactive Exodus Wonders & Rewards System
   Tracks mastery percentage, awards trophies on a shelf, and shows
   immersive HTML5 Canvas animations for major milestones in Exodus. */

(() => {
  "use strict";

  const STORAGE_KEY = "bbs:stats:v1";
  const UNLOCKED_KEY = "bbs:unlocked-rewards:v1";

  // The 8 milestones representing the journey of Exodus
  const WONDERS = [
    {
      id: "red_sea",
      emoji: "🌊",
      label: "Red Sea",
      chapter: "Ch 14",
      pct: 10,
      ref: "Exodus 14:21-22",
      quote: "And the Lord caused the sea to go back by a strong east wind all that night, and made the sea dry land, and the waters were divided.",
      desc: "Escape from Egypt. God parts the Red Sea, forming towering walls of water so Israel can pass through on dry ground.",
      tip: "Waters cover the path at first. Tap each sea wall five times to part them, then walk through.",
      color: "#3498db"
    },
    {
      id: "marah",
      emoji: "💧",
      label: "Marah",
      chapter: "Ch 15",
      pct: 20,
      ref: "Exodus 15:23,25",
      quote: "They could not drink the waters of Marah, for they were bitter... and the Lord showed him a tree; which when he cast into the waters, the waters were made sweet.",
      desc: "Bitter water made sweet. Moses casts a wood branch into the bitter spring of Marah, purifying it for the thirsty Israelites.",
      tip: "Drag the branch into the bitter pool and sweep it through the water until it is cast in.",
      color: "#2ecc71"
    },
    {
      id: "elim",
      emoji: "🌴",
      label: "Elim",
      chapter: "Ch 15",
      pct: 30,
      ref: "Exodus 15:27",
      quote: "And they came to Elim, where were twelve wells of water, and threescore and ten palm trees: and they encamped there by the waters.",
      desc: "Rest at the Oasis. Elim provides twelve springs of fresh water and seventy palm trees to shelter the encampment.",
      tip: "Hold at each numbered well until you drink from all twelve.",
      color: "#27ae60"
    },
    {
      id: "manna",
      emoji: "🍞",
      label: "Manna",
      chapter: "Ch 16",
      pct: 40,
      ref: "Exodus 16:4,13",
      quote: "Then said the Lord unto Moses, Behold, I will rain bread from heaven for you... and in the morning the dew lay round about the host.",
      desc: "Bread from Heaven. Manna falls each morning like hoarfrost, and quails cover the camp in the evening to feed the people.",
      tip: "Move close to each flake of manna and gather every one before dawn.",
      color: "#f1c40f"
    },
    {
      id: "rephidim",
      emoji: "🪨",
      label: "Rephidim",
      chapter: "Ch 17",
      pct: 50,
      ref: "Exodus 17:6",
      quote: "Behold, I will stand before thee there upon the rock in Horeb; and thou shalt smite the rock, and there shall come water out of it.",
      desc: "Water from the Rock. Moses strikes the rock at Horeb with his staff, and fresh water gushes forth to quench the people's thirst.",
      tip: "Touch the rock once with the staff — Moses smote it but once.",
      color: "#e67e22"
    },
    {
      id: "sinai",
      emoji: "⛰️",
      label: "Sinai",
      chapter: "Ch 19",
      pct: 60,
      ref: "Exodus 19:18",
      quote: "And mount Sinai was altogether on a smoke, because the Lord descended upon it in fire... and the whole mount quaked greatly.",
      desc: "The Covenant & Commandments. God descends upon Mount Sinai in fire and thick cloud, giving the Ten Commandments.",
      tip: "Tap the mountain to call lightning. Toggle cloud or fire above.",
      color: "#9b59b6"
    },
    {
      id: "golden_calf",
      emoji: "🐂",
      label: "Golden Calf",
      chapter: "Ch 32",
      pct: 80,
      ref: "Exodus 32:20",
      quote: "And he took the calf which they had made, and burnt it in the fire, and ground it to powder, and strawed it upon the water.",
      desc: "Israel's Great Failure & Repentance. The people construct a golden calf, which Moses breaks and grinds into ash.",
      tip: "Tap the golden calf to shatter it. Sweep the glitter away.",
      color: "#e74c3c"
    },
    {
      id: "glory",
      emoji: "✨",
      label: "Glory",
      chapter: "Ch 40",
      pct: 100,
      ref: "Exodus 40:34",
      quote: "Then a cloud covered the tent of the congregation, and the glory of the Lord filled the tabernacle.",
      desc: "The Shekinah Glory. The Tabernacle is finished, and God's glory descends, filling it with a radiant, cloud-like divine light.",
      tip: "Tap the scene to send rings of covenant light. Move to turn the rays.",
      color: "#f39c12"
    }
  ];

  let unlockedList = [];
  let currentActiveWonder = null;
  let canvas, ctx, animationFrameId;
  let mouse = { x: 0, y: 0, px: 0, py: 0, down: false };
  let canvasTime = 0;
  let particles = [];
  let customWonderState = {}; // for extra custom toggles (like Sinai Day/Night)
  let totalQuestions = 0;    // filled in by bbs:stats-updated event detail

  // Web Audio Synthesizer State
  let audioCtx = null;
  let audioBus = null;
  let isMuted = false;
  let soundLast = {};
  let chimeIdx = 0;
  let waterVariant = 0;

  const SOUND_GAPS = {
    chime: 220,
    water: 320,
    smite: 900,
    thunder: 650,
    shatter: 900,
    glory: 500,
    unlock: 0,
    parting: 400,
    parted: 0,
    sweeten: 0,
    drink: 350,
    gather: 140,
  };

  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1174.66];

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 10;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      audioBus = audioCtx.createGain();
      audioBus.gain.value = 0.38;
      comp.connect(audioBus);
      audioBus.connect(audioCtx.destination);
      audioCtx._bbsComp = comp;
    }
  }

  function bus() {
    return audioCtx._bbsComp;
  }

  function canPlay(type) {
    const gap = SOUND_GAPS[type] ?? 120;
    if (!gap) return true;
    const now = performance.now();
    if (soundLast[type] && now - soundLast[type] < gap) return false;
    soundLast[type] = now;
    return true;
  }

  function tone(freq, opts = {}) {
    const {
      type = "sine",
      attack = 0.015,
      decay = 0.45,
      volume = 0.07,
      detune = 0,
      delay = 0,
      sweepTo = null,
    } = opts;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + decay * 0.7);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    osc.connect(gain);
    gain.connect(bus());
    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.08);
  }

  function noiseBurst(opts = {}) {
    const {
      duration = 0.35,
      volume = 0.05,
      filterType = "bandpass",
      freq = 700,
      q = 1.1,
      freqEnd = null,
      delay = 0,
    } = opts;
    const t0 = audioCtx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus());
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  function playUnlock() {
    const base = 261.63;
    const chord = [0, 4, 7, 12, 16, 19];
    chord.forEach((semi, i) => {
      const f = base * Math.pow(2, semi / 12);
      tone(f, { volume: 0.055, decay: 1.1, attack: 0.03, delay: i * 0.1, type: "triangle" });
      tone(f * 2, { volume: 0.018, decay: 0.7, attack: 0.04, delay: i * 0.1 + 0.02, type: "sine" });
    });
    noiseBurst({ duration: 0.5, volume: 0.012, filterType: "highpass", freq: 1200, freqEnd: 800, delay: 0.35 });
  }

  function playWater() {
    waterVariant = (waterVariant + 1) % 3;
    if (waterVariant === 0) {
      noiseBurst({ duration: 0.55, volume: 0.018, filterType: "bandpass", freq: 420, freqEnd: 160, q: 0.7 });
      tone(196, { volume: 0.022, decay: 0.55, attack: 0.02, type: "sine", sweepTo: 130 });
    } else if (waterVariant === 1) {
      tone(392, { volume: 0.016, decay: 0.4, attack: 0.015, type: "sine" });
      tone(523, { volume: 0.012, decay: 0.35, delay: 0.06, type: "triangle" });
    } else {
      noiseBurst({ duration: 0.35, volume: 0.014, filterType: "highpass", freq: 700, freqEnd: 350, q: 0.6 });
      tone(330, { volume: 0.014, decay: 0.45, attack: 0.02, type: "sine" });
    }
  }

  function playParting() {
    noiseBurst({ duration: 0.5, volume: 0.016, filterType: "bandpass", freq: 280, freqEnd: 120, q: 0.5 });
    tone(220, { volume: 0.018, decay: 0.6, attack: 0.04, type: "sine", sweepTo: 165 });
    tone(330, { volume: 0.01, decay: 0.45, delay: 0.08, type: "triangle" });
  }

  function playParted() {
    [220, 277.18, 329.63].forEach((f, i) => {
      tone(f, { volume: 0.02, decay: 1.2, attack: 0.06, delay: i * 0.12, type: "sine" });
    });
    noiseBurst({ duration: 0.4, volume: 0.01, filterType: "highpass", freq: 500, freqEnd: 900, delay: 0.2 });
  }

  function playSweeten() {
    tone(392, { volume: 0.018, decay: 0.9, attack: 0.05, type: "sine" });
    tone(523.25, { volume: 0.012, decay: 0.75, attack: 0.06, delay: 0.1, type: "triangle" });
    noiseBurst({ duration: 0.35, volume: 0.012, filterType: "bandpass", freq: 600, freqEnd: 300, q: 0.5 });
  }

  function playDrink() {
    tone(440, { volume: 0.014, decay: 0.35, attack: 0.02, type: "sine" });
    tone(554.37, { volume: 0.01, decay: 0.28, delay: 0.05, type: "triangle" });
  }

  function playGather() {
    const freq = PENTATONIC[chimeIdx % PENTATONIC.length];
    chimeIdx += 1;
    tone(freq, { volume: 0.016, decay: 0.55, attack: 0.02, type: "sine" });
    tone(freq * 1.5, { volume: 0.008, decay: 0.35, attack: 0.03, type: "triangle", delay: 0.04 });
  }

  function playChime() {
    const freq = PENTATONIC[chimeIdx % PENTATONIC.length];
    chimeIdx += 1 + Math.floor(Math.random() * 2);
    tone(freq, { volume: 0.018, decay: 0.85, attack: 0.02, type: "sine" });
    tone(freq * 2.01, { volume: 0.008, decay: 0.55, attack: 0.025, type: "triangle", detune: 3 });
  }

  function playSmite() {
    tone(110, { volume: 0.045, decay: 0.4, attack: 0.008, type: "sine", sweepTo: 82 });
    noiseBurst({ duration: 0.2, volume: 0.015, filterType: "lowpass", freq: 320, freqEnd: 140, q: 0.6 });
    tone(392, { volume: 0.012, decay: 0.7, attack: 0.04, delay: 0.12, type: "sine" });
    tone(523, { volume: 0.01, decay: 0.55, attack: 0.05, delay: 0.18, type: "triangle" });
  }

  function playThunder() {
    noiseBurst({ duration: 1.0, volume: 0.035, filterType: "lowpass", freq: 140, freqEnd: 50, q: 0.4 });
    tone(55, { volume: 0.028, decay: 1.0, attack: 0.06, type: "sine", sweepTo: 42 });
    tone(98, { volume: 0.012, decay: 0.5, attack: 0.08, delay: 0.2, type: "triangle" });
  }

  function playShatter() {
    [659.25, 783.99, 987.77].forEach((f, i) => {
      tone(f, { volume: 0.012, decay: 0.2 + i * 0.04, attack: 0.008, type: "sine", delay: i * 0.04 });
    });
    noiseBurst({ duration: 0.22, volume: 0.018, filterType: "highpass", freq: 900, freqEnd: 450, delay: 0.06 });
  }

  function playGlory() {
    [174.61, 220, 261.63].forEach((f, i) => {
      tone(f, { volume: 0.018, decay: 1.6, attack: 0.1, delay: i * 0.09, type: "sine" });
      tone(f * 1.5, { volume: 0.009, decay: 1.2, attack: 0.12, delay: i * 0.09 + 0.05, type: "triangle" });
    });
    noiseBurst({ duration: 0.6, volume: 0.008, filterType: "highpass", freq: 700, freqEnd: 1200, delay: 0.25 });
  }

  function playSound(type) {
    initAudio();
    if (isMuted || !audioCtx) return;
    if (!canPlay(type)) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    try {
      if (type === "unlock") playUnlock();
      else if (type === "water") playWater();
      else if (type === "chime") playChime();
      else if (type === "smite") playSmite();
      else if (type === "thunder") playThunder();
      else if (type === "shatter") playShatter();
      else if (type === "glory") playGlory();
      else if (type === "parting") playParting();
      else if (type === "parted") playParted();
      else if (type === "sweeten") playSweeten();
      else if (type === "drink") playDrink();
      else if (type === "gather") playGather();
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  }

  // Export sound triggers globally for scene files
  window.BibleBowlPlaySound = playSound;

  // Load unlocked rewards from localStorage
  function loadUnlocked() {
    try {
      unlockedList = JSON.parse(localStorage.getItem(UNLOCKED_KEY)) || [];
    } catch (e) {
      unlockedList = [];
    }
    isMuted = localStorage.getItem("bbs:muted") === "true";
  }

  // Save unlocked rewards
  function saveUnlocked() {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlockedList));
    } catch (e) {}
  }

  // Calculate current mastery percentage
  function getMasteryPct() {
    try {
      const stats = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      const mastered = Object.values(stats).filter(s => s && s.streak >= 3).length;
      const total = totalQuestions || 1;
      return total > 0 ? (mastered / total) * 100 : 0;
    } catch (e) {
      return 0;
    }
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
  }

  // Locked shelf copy — no spoilers for wonders not yet earned
  function lockedTrophyMarkup(w) {
    return `
      <span class="trophy-icon">🔒</span>
      <span class="trophy-label trophy-label-mystery">???</span>
      <span class="trophy-chapter">${w.pct}%</span>
      <span class="trophy-tooltip">🔒 Master ${w.pct}% to reveal the next wonder</span>
    `;
  }

  function unlockedTrophyMarkup(w) {
    return `
      <span class="trophy-icon">${w.emoji}</span>
      <span class="trophy-label">${w.label}</span>
      <span class="trophy-chapter">${w.chapter}</span>
      <span class="trophy-tooltip">${w.emoji} ${w.label} (${w.chapter} — Unlocked at ${w.pct}%) — Click to open</span>
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

    const currentPct = getMasteryPct();
    const newlyUnlocked = [];

    grid.innerHTML = "";

    WONDERS.forEach(w => {
      const isUnlocked = currentPct >= w.pct;
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

    if (newlyUnlocked.length > 0) {
      saveUnlocked();
      // Play major unlock chime arpeggio
      playSound("unlock");
      
      const highestNew = newlyUnlocked.sort((a, b) => b.pct - a.pct)[0];
      
      // Let the newly unlocked icon flash at the bottom of the page
      const items = grid.querySelectorAll(".trophy-item");
      WONDERS.forEach((w, idx) => {
        if (w.id === highestNew.id && items[idx]) {
          items[idx].classList.add("newly-unlocked");
          setTimeout(() => items[idx].classList.remove("newly-unlocked"), 12000);
        }
      });
    }
  }

  // Open overlay modal and start animation
  function openModal(wonder, isNew) {
    currentActiveWonder = wonder;
    customWonderState = {}; 
    particles = [];
    canvasTime = 0;

    const modal = document.getElementById("rewards-modal");
    document.getElementById("rewards-hud-badge").textContent = wonder.emoji;
    document.getElementById("rewards-hud-milestone").textContent = isNew 
      ? `Milestone Unlocked (${wonder.pct}%)` 
      : `${wonder.chapter} Landmark (${wonder.pct}%)`;
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
      btnMute.textContent = isMuted ? "🔇 Muted" : "🔊 Sound On";
      btnMute.className = `rewards-control-btn ${isMuted ? "active" : ""}`;
      initAudio();
      if (!isMuted && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
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
        grad.addColorStop(0, "#2c3e50"); 
        grad.addColorStop(0.6, "#1a252f");
        grad.addColorStop(1, "#0d1318");
      } else {
        grad.addColorStop(0, "#100c17"); 
        grad.addColorStop(0.7, "#0c060d");
        grad.addColorStop(1, "#050005");
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

})();
