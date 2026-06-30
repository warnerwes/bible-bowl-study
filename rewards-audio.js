/* Bible Bowl Study - reward sound synthesizer */

(() => {
  "use strict";

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

  function setMuted(value) {
    isMuted = !!value;
  }

  function resume() {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  window.BibleBowlRewardsAudio = { playSound, setMuted, resume };
  window.BibleBowlPlaySound = playSound;
})();
