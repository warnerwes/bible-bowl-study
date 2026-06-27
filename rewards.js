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
      tip: "Drag on the left or right to disturb the water walls; drag in the center to leave footsteps of light on the dry path.",
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
      tip: "Drag the green branch (mouse cursor) down into the murky green water to sweeten it and turn it crystal blue.",
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
      tip: "Hover near the ground to make the 12 springs burst higher; hover near the tree crowns to shake down falling palm leaves.",
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
      tip: "Move the cursor to create a gentle wind pulling the manna. Click to create a burst of light that gathers them into stardust.",
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
      tip: "Use Moses' staff (mouse cursor) and click on the rock to strike it, releasing a cascading waterfall of sparkling water.",
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
      tip: "Hover/drag to summon silent lightning bolts that arc from the sky to the mount. Toggle between Day (Cloud) and Night (Fire).",
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
      tip: "Move the cursor to sweep away the chaotic gold glitter of revelry. Click on the golden calf to shatter it into falling gray ashes.",
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
      tip: "Move the cursor to rotate the golden rays of divine light. Click to emit expanding rings of rainbow covenant promise.",
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
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      isMuted = localStorage.getItem("bbs:muted") !== "false"; // Unmuted by default
    }
  }

  function playSound(type) {
    initAudio();
    if (isMuted || !audioCtx) return;
    
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    try {
      const now = audioCtx.currentTime;

      if (type === "unlock") {
        // Harmonious major arpeggio chime (C4 - E4 - G4 - C5)
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.12 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.65);
        });
      } else if (type === "water") {
        // Water splash noise synth
        const bufferSize = audioCtx.sampleRate * 0.35;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(700, now);
        filter.Q.setValueAtTime(1.5, now);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        noise.start(now);
        noise.stop(now + 0.35);
      } else if (type === "chime") {
        // Gentle manna collect chime
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200 + Math.random() * 400, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "smite") {
        // Low frequency staff strike
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "thunder") {
        // Deep thunder rumble modulation
        const bufferSize = audioCtx.sampleRate * 0.7;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(90, now);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        
        noise.start(now);
        noise.stop(now + 0.7);
      } else if (type === "shatter") {
        // Idol break sound
        const freqs = [600, 900, 1300];
        freqs.forEach(f => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.03, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        });
      } else if (type === "glory") {
        // Transcendent sine sweep
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.5);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      }
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
        <canvas id="rewards-canvas" class="rewards-canvas"></canvas>
        <div id="rewards-hud" class="rewards-hud">
          <div id="rewards-hud-badge" class="rewards-hud-badge">🏆</div>
          <div id="rewards-hud-milestone" class="rewards-hud-milestone">Milestone Unlocked</div>
          <h2 id="rewards-hud-title" class="rewards-hud-title">Wonder Name</h2>
          <p id="rewards-hud-quote" class="rewards-hud-quote">"Scripture quote..."</p>
          <p id="rewards-hud-desc" class="rewards-hud-desc">Description of the event.</p>
          <div id="rewards-hud-controls" class="rewards-hud-controls"></div>
          <div id="rewards-hud-tip" class="rewards-hud-tip">Interaction tip.</div>
          <button id="rewards-hud-close" class="primary-btn rewards-hud-close">Return to Study</button>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("rewards-hud-close").addEventListener("click", closeModal);
      
      canvas = document.getElementById("rewards-canvas");
      ctx = canvas.getContext("2d");

      window.addEventListener("resize", resizeCanvas);

      canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      });

      canvas.addEventListener("mousedown", () => mouse.down = true);
      canvas.addEventListener("mouseup", () => mouse.down = false);
      canvas.addEventListener("mouseleave", () => mouse.down = false);

      canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0) {
          const rect = canvas.getBoundingClientRect();
          mouse.px = mouse.x;
          mouse.py = mouse.y;
          mouse.x = e.touches[0].clientX - rect.left;
          mouse.y = e.touches[0].clientY - rect.top;
        }
      });
      canvas.addEventListener("touchstart", (e) => {
        mouse.down = true;
        if (e.touches.length > 0) {
          const rect = canvas.getBoundingClientRect();
          mouse.x = e.touches[0].clientX - rect.left;
          mouse.y = e.touches[0].clientY - rect.top;
          mouse.px = mouse.x;
          mouse.py = mouse.y;
        }
      });
      canvas.addEventListener("touchend", () => mouse.down = false);
    }

    // Trophy shelf is built; trophies render once app.js fires bbs:stats-updated.
    // Render locked placeholders now so the shelf isn't empty while loading.
    renderLockedShelf();
  }

  // Render all trophies as locked while waiting for the real total to arrive
  function renderLockedShelf() {
    const grid = document.getElementById("trophy-grid");
    if (!grid) return;
    grid.innerHTML = "";
    WONDERS.forEach(w => {
      const item = document.createElement("div");
      item.className = "trophy-item locked";
      item.innerHTML = `
        <span class="trophy-icon">🔒</span>
        <span class="trophy-label">${w.label}</span>
        <span class="trophy-chapter">${w.chapter}</span>
        <span class="trophy-tooltip">🔒 Locked: Master ${w.pct}% to witness the ${w.label}</span>
      `;
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
      
      const tooltipText = isUnlocked 
        ? `${w.emoji} ${w.label} (${w.chapter} — Unlocked at ${w.pct}%) - Click to open`
        : `🔒 Locked: Master ${w.pct}% to witness the ${w.label}`;

      item.innerHTML = `
        <span class="trophy-icon">${isUnlocked ? w.emoji : "🔒"}</span>
        <span class="trophy-label">${w.label}</span>
        <span class="trophy-chapter">${w.chapter}</span>
        <span class="trophy-tooltip">${tooltipText}</span>
      `;

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

    resizeCanvas();
    modal.classList.add("active");

    if (window.BibleBowlScenes && typeof window.BibleBowlScenes.setupParticles === "function") {
      window.BibleBowlScenes.setupParticles(wonder.id, canvas.width, canvas.height, particles, customWonderState);
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    tick();
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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
