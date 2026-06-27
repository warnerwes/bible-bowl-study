/* Bible Bowl Study — Wonders of the Exodus (Scenes 1-4)
   Contains particle setup and rendering for Red Sea, Marah, Elim, and Manna. */

(() => {
  "use strict";

  window.BibleBowlScenes = window.BibleBowlScenes || {};

  const WONDER_RULES = window.BibleBowlScenes.WONDER_RULES || {
    red_sea: {
      captionParting: "Lift the rod",
      captionCrossing: "Dry land through the sea",
      progressParting: "The Lord drives back the sea",
      progressCrossing: "Israel passes through"
    },
    marah: {
      healCaption: "The Lord who heals you",
      healFrames: 60
    },
    elim: {
      caption: "Find the twelve springs",
      palmsLine: "70 palm trees shade the oasis",
      campLabel: "CAMP",
      campCaption: "They camped by the waters"
    },
    manna: {
      quailCaption: "Evening · quail come",
      quailProgress: "Hold or tap Continue",
      dewCaption: "Dew round the camp",
      meltMessage: "Manna melted in the sun",
      hoardMessage: "Too much — worms!",
      sabbathCaption: "Day 7: Sabbath rest",
      sabbathProgress: "Tap tent to eat saved manna"
    }
  };

  function sceneScale(w, h) {
    return Math.min(w / 390, h / 260, 1.35);
  }

  window.BibleBowlScenes.uiScale = (w) => Math.max(1, Math.min(1.75, w / 320));

  window.BibleBowlScenes.drawHeaderBand = (ctx, w) => {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(0, 0, w, 98);
    ctx.restore();
  };

  window.BibleBowlScenes.drawCaption = (ctx, w, text) => {
    window.BibleBowlScenes.drawHeaderBand(ctx, w);
    const scale = window.BibleBowlScenes.uiScale(w);
    const size = Math.round(18 * scale);
    ctx.save();
    ctx.fillStyle = "rgba(236, 230, 216, 0.96)";
    ctx.font = `700 ${size}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 28);
    ctx.restore();
  };

  window.BibleBowlScenes.drawProgress = (ctx, w, text) => {
    const scale = window.BibleBowlScenes.uiScale(w);
    const size = Math.round(14 * scale);
    ctx.save();
    ctx.fillStyle = "rgba(212, 160, 78, 0.95)";
    ctx.font = `600 ${size}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 48);
    ctx.restore();
  };

  window.BibleBowlScenes.drawTapRing = (ctx, x, y, rx, ry, canvasTime) => {
    ctx.save();
    ctx.strokeStyle = `rgba(212, 160, 78, ${0.22 + Math.sin(canvasTime * 0.08) * 0.14})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  function fillRoundRect(ctx, x, y, rw, rh, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, r);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, rw, rh, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, rw, rh, r);
      ctx.stroke();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
  }

  window.BibleBowlScenes.drawProgressBar = (ctx, w, y, pct, label) => {
    const scale = window.BibleBowlScenes.uiScale(w);
    const barW = Math.min(w * 0.88, 360);
    const barX = (w - barW) / 2;
    const barH = Math.round(20 * scale);
    const fill = Math.max(0, Math.min(1, pct));
    ctx.save();
    if (label) {
      ctx.fillStyle = "rgba(236, 230, 216, 0.95)";
      ctx.font = `700 ${Math.round(13 * scale)}px Spectral, Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, y - 8);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    fillRoundRect(ctx, barX, y, barW, barH, 8);
    if (fill > 0) {
      const grad = ctx.createLinearGradient(barX, y, barX + barW, y);
      grad.addColorStop(0, "rgba(212, 160, 78, 0.85)");
      grad.addColorStop(1, "rgba(255, 220, 150, 0.95)");
      ctx.fillStyle = grad;
      fillRoundRect(ctx, barX, y, barW * fill, barH, 8);
    }
    ctx.strokeStyle = "rgba(212, 160, 78, 0.55)";
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, barX, y, barW, barH, 8);
    ctx.restore();
  };

  window.BibleBowlScenes.drawTouchButton = (ctx, x, y, bw, bh, label, opts = {}) => {
    const { active, pulse, disabled, sublabel } = opts;
    ctx.save();
    const pulseScale = pulse ? 1 + Math.sin(pulse) * 0.04 : 1;
    ctx.translate(x, y);
    ctx.scale(pulseScale, pulseScale);
    ctx.fillStyle = disabled
      ? "rgba(60, 55, 48, 0.5)"
      : active
        ? "rgba(212, 160, 78, 0.32)"
        : "rgba(212, 160, 78, 0.14)";
    ctx.strokeStyle = disabled
      ? "rgba(120, 110, 95, 0.35)"
      : active
        ? "rgba(255, 220, 160, 0.95)"
        : "rgba(212, 160, 78, 0.55)";
    ctx.lineWidth = active ? 2.5 : 2;
    fillRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, 14);
    strokeRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, 14);
    ctx.fillStyle = disabled ? "rgba(180, 170, 155, 0.6)" : "rgba(236, 230, 216, 0.95)";
    const uiScale = window.BibleBowlScenes.uiScale(bw * 2);
    ctx.font = `700 ${Math.round(15 * uiScale)}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, 0, sublabel ? -4 : 4);
    if (sublabel) {
      ctx.font = `600 ${Math.round(11 * uiScale)}px Spectral, Georgia, serif`;
      ctx.fillStyle = "rgba(236, 230, 216, 0.7)";
      ctx.fillText(sublabel, 0, 16);
    }
    ctx.restore();
  };

  window.BibleBowlScenes.hitRect = (mx, my, cx, cy, bw, bh) =>
    mx >= cx - bw / 2 && mx <= cx + bw / 2 && my >= cy - bh / 2 && my <= cy + bh / 2;

  // Setup initial particles for the active scene
  window.BibleBowlScenes.setupParticles = (id, w, h, particles, customWonderState) => {
    if (id === "red_sea") {
      customWonderState.parting = 0;
      customWonderState.windStrength = 0;
      customWonderState.handExtended = false;
      customWonderState.phase = "parting";
      customWonderState.crossingProgress = 0;
      for (let i = 0; i < 160; i++) {
        particles.push({
          x: Math.random() * (w * 0.25),
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 2,
          r: Math.random() * 8 + 3,
          alpha: Math.random() * 0.5 + 0.3,
          side: "left"
        });
        particles.push({
          x: w - Math.random() * (w * 0.25),
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 2,
          r: Math.random() * 8 + 3,
          alpha: Math.random() * 0.5 + 0.3,
          side: "right"
        });
      }
    } else if (id === "marah") {
      const poolY = h * 0.56;
      customWonderState.poolY = poolY;
      for (let i = 0; i < 120; i++) {
        particles.push({
          x: Math.random() * w,
          y: poolY + Math.random() * (h - poolY - 8),
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 5 + 2,
          type: "bitter",
          baseColor: { h: Math.random() * 35 + 72, s: 38, l: 28 }
        });
      }
      customWonderState.sweetened = false;
      customWonderState.rippleRadius = 0;
      customWonderState.treeCast = false;
      customWonderState.treeFixed = null;
      customWonderState.treeY = h * 0.22;
    } else if (id === "elim") {
      customWonderState.springs = [];
      customWonderState.palms = [];
      const numSprings = 12;
      const pad = Math.max(12, w * 0.04);
      const span = w - pad * 2;
      for (let i = 0; i < numSprings; i++) {
        customWonderState.springs.push({
          x: pad + (span * i) / (numSprings - 1),
          y: h - 50,
          strength: 1,
          found: false,
          findProgress: 0
        });
      }
      const palmCount = 9;
      for (let i = 0; i < palmCount; i++) {
        const t = i / (palmCount - 1);
        customWonderState.palms.push({
          x: pad * 0.4 + span * t,
          baseY: h - 48,
          scale: 0.55 + (1 - Math.abs(t - 0.5) * 1.4) * 0.45,
          phase: Math.random() * Math.PI * 2
        });
      }
    } else if (id === "manna") {
      if (!customWonderState.weekDay) customWonderState.weekDay = 1;
      customWonderState.jarFill = 0;
      customWonderState.jarsStored = 0;
      customWonderState.jarsCarried = 0;
      customWonderState.jarLimit = customWonderState.weekDay === 6 ? 2 : 1;
      customWonderState.rotten = false;
      customWonderState.complete = false;
      customWonderState.mannaPhase = "quail";
      customWonderState.quailTimer = 0;
      customWonderState.quailHold = 0;
      customWonderState.dewProgress = 0;
      customWonderState.meltDeadline = 0;
      customWonderState.meltFlash = 0;
      customWonderState.tentX = w * 0.84;
      customWonderState.tentY = h * 0.78;
    }
  };

  // ---------------- WONDER 1: RED SEA ----------------
  window.BibleBowlScenes.red_sea = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const rules = WONDER_RULES.red_sea;
    const parting = customWonderState.parting || 0;
    if (parting >= 1) customWonderState.phase = "crossing";
    const phase = customWonderState.phase || "parting";
    const leftEdge = w * (0.48 - 0.22 * parting);
    const rightEdge = w * (0.52 + 0.22 * parting);
    const overSea = mouse.x > w * 0.15 && mouse.x < w * 0.85 && mouse.y > h * 0.08 && mouse.y < h * 0.88;
    const onDryPath = mouse.x > leftEdge && mouse.x < rightEdge && mouse.y > h * 0.08 && mouse.y < h * 0.92;

    if (phase === "parting") {
      window.BibleBowlScenes.drawCaption(ctx, w, rules.captionParting);
      window.BibleBowlScenes.drawProgress(ctx, w,
        `${rules.progressParting} ${Math.round(parting * 100)}%`);
    } else {
      const cross = customWonderState.crossingProgress || 0;
      window.BibleBowlScenes.drawCaption(ctx, w, rules.captionCrossing);
      window.BibleBowlScenes.drawProgress(ctx, w,
        `${rules.progressCrossing} ${Math.round(cross * 100)}%`);
    }

    if (phase === "parting" && parting < 1 && overSea && mouse.down) {
      customWonderState.handExtended = true;
      const prevPart = customWonderState.parting || 0;
      customWonderState.windStrength = (customWonderState.windStrength || 0) + 0.009;
      customWonderState.parting = Math.min(1, customWonderState.windStrength);
      if (Math.floor(prevPart * 5) < Math.floor(customWonderState.parting * 5) &&
          typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound(customWonderState.parting >= 1 ? "parted" : "parting");
      }
    } else if (phase === "parting") {
      customWonderState.handExtended = false;
    }

    if (phase === "crossing" && onDryPath) {
      const moved = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      if (moved > 1.2) {
        customWonderState.crossingProgress = Math.min(1,
          (customWonderState.crossingProgress || 0) + moved / (h * 0.85));
      }
    }

    if (phase === "parting" && customWonderState.handExtended && canvasTime % 3 === 0) {
      particles.push({
        x: mouse.x + (Math.random() - 0.5) * 30,
        y: mouse.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.3) * 2.5,
        vy: (Math.random() - 0.5) * 1.2,
        r: Math.random() * 2 + 1,
        alpha: 0.55,
        type: "wind",
        life: 40
      });
    }

    ctx.fillStyle = "rgba(52, 152, 219, 0.15)";
    ctx.fillRect(0, 0, leftEdge, h);
    ctx.fillRect(rightEdge, 0, w - rightEdge, h);

    if (parting < 1) {
      ctx.fillStyle = "rgba(41, 128, 185, 0.55)";
      ctx.fillRect(leftEdge, 0, rightEdge - leftEdge, h);
    } else {
      ctx.fillStyle = "rgba(212, 160, 78, 0.22)";
      ctx.fillRect(leftEdge, 0, rightEdge - leftEdge, h);
      ctx.strokeStyle = "rgba(236, 230, 216, 0.12)";
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 8);
      ctx.lineTo(w * 0.5, h - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === "wind") {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        p.alpha -= 0.012;
        if (p.life <= 0 || p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(200, 230, 255, ${p.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 2);
        ctx.stroke();
        continue;
      }
      if (p.type === "dust") {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(226, 192, 116, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const wallX = p.side === "left" ? leftEdge : rightEdge;
      if (p.side === "left") {
        if (p.x > wallX) { p.x = wallX; p.vx = -Math.abs(p.vx) - 0.15; }
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      } else {
        if (p.x < wallX) { p.x = wallX; p.vx = Math.abs(p.vx) + 0.15; }
        if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
      }
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx + Math.sin(canvasTime * 0.02 + p.y * 0.01) * 0.15;
      p.y += p.vy + Math.cos(canvasTime * 0.01 + p.x * 0.01) * 0.12;
      ctx.fillStyle = p.side === "left" ? `rgba(52, 152, 219, ${p.alpha})` : `rgba(41, 128, 185, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (parting >= 1 && onDryPath) {
      if (Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py) > 1.5) {
        particles.push({
          x: mouse.x + (Math.random() - 0.5) * 10,
          y: mouse.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -Math.random() * 0.35,
          r: Math.random() * 2 + 1,
          alpha: 1,
          type: "dust"
        });
      }
    }

    if (customWonderState.handExtended || (phase === "parting" && parting < 1)) {
      const handX = overSea ? mouse.x : w * 0.5;
      const handY = overSea ? Math.min(mouse.y, h * 0.45) : h * 0.28;
      ctx.save();
      ctx.strokeStyle = "rgba(236, 230, 216, 0.85)";
      ctx.fillStyle = "rgba(236, 230, 216, 0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(handX, handY + 28);
      ctx.lineTo(handX, handY - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(handX, handY - 12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a6d3b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(handX + 6, handY - 4);
      ctx.lineTo(handX + 6, handY + 42);
      ctx.stroke();
      ctx.restore();
    }

    if ((customWonderState.crossingProgress || 0) >= 1) customWonderState.complete = true;

    ctx.strokeStyle = "rgba(100, 200, 255, 0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= h + 20; y += 18) {
      const x = leftEdge + Math.sin(canvasTime * 0.03 + y * 0.02) * 6;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let y = 0; y <= h + 20; y += 18) {
      const x = rightEdge + Math.cos(canvasTime * 0.03 + y * 0.02) * 6;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ---------------- WONDER 2: MARAH ----------------
  window.BibleBowlScenes.marah = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const poolY = customWonderState.poolY || h * 0.56;
    const poolCX = w / 2;
    const poolCY = poolY + (h - poolY) * 0.42;
    const treeCast = customWonderState.treeCast;
    let treeX = treeCast && customWonderState.treeFixed
      ? customWonderState.treeFixed.x : (customWonderState.treeDragging ? mouse.x : w * 0.5);
    let treeY = treeCast && customWonderState.treeFixed
      ? customWonderState.treeFixed.y : (customWonderState.treeDragging ? mouse.y : customWonderState.treeY || h * 0.22);

    window.BibleBowlScenes.drawCaption(ctx, w,
      customWonderState.sweetened
        ? WONDER_RULES.marah.healCaption
        : "Cast tree into Marah");
    window.BibleBowlScenes.drawProgress(ctx, w,
      customWonderState.sweetened ? "Waters made sweet" : "Drag tree into pool");

    if (!treeCast && mouse.down && Math.hypot(mouse.x - treeX, mouse.y - treeY) < 40) {
      customWonderState.treeDragging = true;
    }

    if (!treeCast && customWonderState.treeDragging) {
      if (mouse.down) {
        treeX = mouse.x;
        treeY = mouse.y;
      } else {
        const releaseInPool = treeY > poolY + 8 && treeX > w * 0.08 && treeX < w * 0.92;
        if (releaseInPool) {
          customWonderState.treeCast = true;
          customWonderState.treeFixed = { x: treeX, y: treeY };
          customWonderState.sweetened = true;
          customWonderState.rippleRadius = 10;
          customWonderState.rippleX = treeX;
          customWonderState.rippleY = treeY;
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("sweeten");
        }
        customWonderState.treeDragging = false;
      }
    }
    if (customWonderState.sweetened) {
      customWonderState.healCaptionTimer = (customWonderState.healCaptionTimer || 0) + 1;
      if (customWonderState.healCaptionTimer >= WONDER_RULES.marah.healFrames) {
        customWonderState.complete = true;
      }
    }

    ctx.fillStyle = "#121810";
    ctx.fillRect(0, 0, w, poolY);
    ctx.fillStyle = customWonderState.sweetened ? "#153040" : "#243018";
    ctx.fillRect(0, poolY, w, h - poolY);
    ctx.fillStyle = customWonderState.sweetened ? "rgba(52, 152, 219, 0.35)" : "rgba(90, 110, 45, 0.45)";
    ctx.beginPath();
    ctx.ellipse(poolCX, poolCY, w * 0.38, (h - poolY) * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!treeCast && !customWonderState.sweetened) {
      window.BibleBowlScenes.drawTapRing(ctx, poolCX, poolCY, w * 0.2, (h - poolY) * 0.16, canvasTime);
    }

    if (customWonderState.sweetened && customWonderState.rippleRadius < w * 1.5) {
      customWonderState.rippleRadius += 15;
      particles.forEach(p => {
        if (p.type === "bitter") {
          const d = Math.hypot(p.x - customWonderState.rippleX, p.y - customWonderState.rippleY);
          if (d < customWonderState.rippleRadius) {
            p.type = "sweet";
            p.baseColor = { h: Math.random() * 30 + 190, s: 70, l: 50 };
            p.vy = -Math.random() * 2 - 0.5;
          }
        }
      });
    }

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === "sweet") {
        p.vy -= 0.02;
        p.vx += (Math.random() - 0.5) * 0.1;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
          p.vy = -Math.random() * 1.5 - 0.5;
        }
      } else {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      ctx.fillStyle = `hsl(${p.baseColor.h}, ${p.baseColor.s}%, ${p.baseColor.l}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      if (p.type === "sweet" && Math.random() > 0.98) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    });

    if (customWonderState.sweetened && customWonderState.rippleRadius < w * 1.5) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(customWonderState.rippleX, customWonderState.rippleY, customWonderState.rippleRadius, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(treeX, treeY);
    ctx.rotate(treeCast ? 0.8 : 0.35);
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(-26, -3, 52, 8);
    ctx.fillStyle = "#27ae60";
    ctx.beginPath();
    ctx.arc(14, -6, 8, 0, Math.PI * 2);
    ctx.arc(-14, -6, 7, 0, Math.PI * 2);
    ctx.arc(0, 6, 8, 0, Math.PI * 2);
    ctx.fill();
    if (!treeCast) {
      ctx.fillStyle = "rgba(236, 230, 216, 0.7)";
      ctx.font = "600 8px Spectral, Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("Tree", 20, -10);
    }
    ctx.restore();
  };

  function drawElimPalm(ctx, x, baseY, scale, sway) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#5c3d1e";
    ctx.fillRect(-5, -62, 10, 62);
    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI * 0.92 + (i / 7) * Math.PI * 0.84 + sway;
      ctx.beginPath();
      ctx.moveTo(0, -62);
      ctx.quadraticCurveTo(
        Math.cos(angle) * 18, -62 + Math.sin(angle) * 10,
        Math.cos(angle) * 46, -62 + Math.sin(angle) * 34
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawElimSpring(ctx, x, y, active, idx, found, w) {
    const scale = window.BibleBowlScenes.uiScale ? window.BibleBowlScenes.uiScale(w || 390) : 1;
    ctx.fillStyle = "#7a6a52";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = found ? "#9ae6ff" : active ? "#7fd4ff" : "#2f6ea8";
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (found) {
      ctx.fillStyle = "rgba(154, 230, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(x, y - 14, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (active) {
      ctx.strokeStyle = "rgba(127, 212, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = found ? "rgba(212, 160, 78, 0.9)" : "rgba(236, 230, 216, 0.55)";
    ctx.font = `700 ${Math.round(11 * scale)}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(found ? "✓" : String(idx + 1), x, y + 18);
  }

  // ---------------- WONDER 3: ELIM ----------------
  window.BibleBowlScenes.elim = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const rules = WONDER_RULES.elim;
    const springs = customWonderState.springs || [];
    const palms = customWonderState.palms || [];
    const groundY = h - 44;
    const uiScale = window.BibleBowlScenes.uiScale(w);
    const foundCount = springs.filter((s) => s.found).length;
    const allFound = foundCount >= 12;
    const campY = h - Math.round(36 * uiScale);
    const campW = Math.round(120 * uiScale);
    const campH = Math.round(44 * uiScale);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, "#0f1812");
    skyGrad.addColorStop(1, "#1a2b1f");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, groundY);

    palms.forEach((palm) => {
      const sway = Math.sin(canvasTime * 0.03 + palm.phase) * 0.06;
      drawElimPalm(ctx, palm.x, palm.baseY, palm.scale, sway);
    });

    const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
    groundGrad.addColorStop(0, "#3d5a34");
    groundGrad.addColorStop(1, "#243222");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    ctx.save();
    ctx.fillStyle = "rgba(212, 160, 78, 0.5)";
    ctx.font = `italic ${Math.round(11 * uiScale)}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(rules.palmsLine, w / 2, h - 10);
    ctx.restore();

    window.BibleBowlScenes.drawCaption(ctx, w,
      customWonderState.camped ? rules.campCaption : rules.caption);
    window.BibleBowlScenes.drawProgress(ctx, w,
      `Springs ${foundCount}/12 · tap each pool`);

    springs.forEach((sp, idx) => {
      const nearSpring = Math.hypot(mouse.x - sp.x, mouse.y - sp.y) <
        Math.max(36, 32 * uiScale);

      if (!sp.found && nearSpring && mouse.down) {
        sp.findProgress = (sp.findProgress || 0) + 1;
        if (sp.findProgress > 25) {
          sp.found = true;
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("drink");
        }
      } else if (!nearSpring && !sp.found) {
        sp.findProgress = Math.max(0, (sp.findProgress || 0) - 2);
      }

      drawElimSpring(ctx, sp.x, sp.y, nearSpring && !sp.found, idx, sp.found, w);

      if (nearSpring && !sp.found && sp.findProgress > 8 && Math.random() < 0.08) {
        particles.push({
          x: sp.x + (Math.random() - 0.5) * 6,
          y: sp.y - 2,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(Math.random() * 1.5 + 0.5),
          r: Math.random() * 1.5 + 1,
          alpha: 0.7,
          type: "spring_drop"
        });
      }
    });

    if (allFound) {
      const campPulse = canvasTime * 0.08;
      window.BibleBowlScenes.drawTouchButton(
        ctx, w / 2, campY, campW, campH, rules.campLabel,
        { active: customWonderState.campPressed, pulse: campPulse }
      );
      const onCamp = window.BibleBowlScenes.hitRect(mouse.x, mouse.y, w / 2, campY, campW, campH);
      if (onCamp && mouse.down && !customWonderState.campPressed) {
        customWonderState.campPressed = true;
        customWonderState.camped = true;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
      }
      if (!mouse.down) customWonderState.campPressed = false;
      if (customWonderState.camped) {
        customWonderState.campTimer = (customWonderState.campTimer || 0) + 1;
        if (customWonderState.campTimer > 45) customWonderState.complete = true;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "spring_drop") {
        p.vy += 0.12;
        p.x += p.vx;
        p.y += p.vy;

        if (p.y > groundY - 6) {
          p.alpha -= 0.08;
        }

        if (p.alpha <= 0 || p.y > groundY) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(127, 212, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (p.type === "leaf") {
        p.x += p.vx + Math.sin(canvasTime * 0.02 + p.y) * 0.15;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        if (p.y > groundY - 4) {
          p.vy = 0;
          p.vx *= 0.9;
          p.rotSpeed *= 0.9;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = "rgba(46, 125, 50, 0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.y > groundY - 4) {
          p.r -= 0.012;
          if (p.r <= 0) particles.splice(i, 1);
        }
      }
    }
  };

  function spawnMannaFlakes(w, h, particles, opts = {}) {
    const sparse = opts.sparse === true;
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].type === "manna") particles.splice(i, 1);
    }
    const count = sparse
      ? Math.min(75, Math.max(35, Math.floor(w * h / 1100)))
      : Math.min(280, Math.max(160, Math.floor(w * h / 380)));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: sparse ? w * 0.38 + Math.random() * w * 0.58 : Math.random() * w,
        y: 108 + Math.random() * (h * 0.62),
        r: sparse ? Math.random() * 1.8 + 1 : Math.random() * 2.4 + 1.4,
        type: "manna",
        taken: false
      });
    }
  }

  function spawnQuail(w, h, particles) {
    particles.push({
      x: -24 - Math.random() * 40,
      y: 100 + Math.random() * (h * 0.55),
      vx: 2.2 + Math.random() * 1.8,
      vy: (Math.random() - 0.5) * 0.6,
      wing: Math.random() * Math.PI * 2,
      type: "quail",
      life: 160
    });
  }

  function drawQuail(ctx, p, canvasTime) {
    const wing = Math.sin(canvasTime * 0.25 + p.wing) * 5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(90, 70, 50, 0.9)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(120, 95, 70, 0.85)";
    ctx.beginPath();
    ctx.ellipse(-8, -wing * 0.3, 7, 3, -0.4, 0, Math.PI * 2);
    ctx.ellipse(8, wing * 0.3, 7, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function mannaDayCaption(weekDay) {
    if (weekDay === 7) return WONDER_RULES.manna.sabbathCaption;
    if (weekDay === 6) return "Day 6: Gather double";
    return `Day ${weekDay}: Gather one`;
  }

  function clearMannaParticles(particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const t = particles[i].type;
      if (t === "manna" || t === "quail") particles.splice(i, 1);
    }
  }

  function advanceMannaToDew(customWonderState, particles) {
    customWonderState.mannaPhase = "dew";
    customWonderState.dewProgress = 0;
    customWonderState.quailHold = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].type === "quail") particles.splice(i, 1);
    }
  }

  const MANNA_JAR_FULL = 0.95;

  function beginMannaGather(customWonderState, w, h, particles, canvasTime, sparse) {
    customWonderState.mannaPhase = "gather";
    customWonderState.jarFill = 0;
    customWonderState.jarsCarried = 0;
    customWonderState.rotten = false;
    customWonderState.meltDeadline = canvasTime + 600;
    customWonderState.meltFlash = 0;
    customWonderState.meltTriggered = false;
    customWonderState.tentPressed = false;
    spawnMannaFlakes(w, h, particles, { sparse: sparse === true });
  }

  function resetMannaDay(customWonderState, w, h, particles) {
    const weekDay = customWonderState.weekDay;
    customWonderState.jarFill = 0;
    customWonderState.jarsStored = 0;
    customWonderState.jarsCarried = 0;
    customWonderState.jarLimit = weekDay === 6 ? 2 : weekDay === 7 ? 0 : 1;
    customWonderState.rotten = false;
    customWonderState.mannaPhase = weekDay === 7 ? "sabbath" : "quail";
    customWonderState.quailTimer = 0;
    customWonderState.quailHold = 0;
    customWonderState.dewProgress = 0;
    customWonderState.meltDeadline = 0;
    customWonderState.meltFlash = 0;
    customWonderState.meltTriggered = false;
    customWonderState.tentPressed = false;
    if (weekDay === 7) customWonderState.sabbathFed = false;
    if (particles) clearMannaParticles(particles);
  }

  function advanceMannaDay(customWonderState, w, h, particles) {
    if (customWonderState.weekDay >= 7) return;
    customWonderState.weekDay += 1;
    resetMannaDay(customWonderState, w, h, particles);
    if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
  }

  function drawMannaJar(ctx, x, y, fill, rotten, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = rotten ? "#4a3520" : "#a67c52";
    ctx.strokeStyle = rotten ? "#6b4423" : "#d4a04e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 10);
    ctx.lineTo(-13, -12);
    ctx.lineTo(13, -12);
    ctx.lineTo(18, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (fill > 0) {
      ctx.fillStyle = rotten ? "#3d5c34" : "rgba(255,255,255,0.92)";
      ctx.fillRect(-12, 10 - fill * 18, 24, fill * 18);
    }
    ctx.restore();
  }

  function drawMannaTentTarget(ctx, w, x, y, jarsStored, jarsCarried, ready, canvasTime) {
    const scale = window.BibleBowlScenes.uiScale(w);
    ctx.save();
    ctx.translate(x, y);
    if (ready) {
      ctx.shadowColor = "rgba(212, 160, 78, 0.9)";
      ctx.shadowBlur = 14 + Math.sin(canvasTime * 0.1) * 8;
    }
    ctx.fillStyle = ready ? "rgba(212, 160, 78, 0.22)" : "rgba(0,0,0,0.25)";
    ctx.strokeStyle = ready ? "rgba(255, 220, 160, 0.95)" : "rgba(212, 160, 78, 0.5)";
    ctx.lineWidth = ready ? 3 : 2;
    fillRoundRect(ctx, -52, -38, 104, 76, 14);
    strokeRoundRect(ctx, -52, -38, 104, 76, 14);
    ctx.fillStyle = "#c9a86c";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-22, 8);
    ctx.lineTo(22, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(236,230,216,0.95)";
    ctx.font = `800 ${Math.round(16 * scale)}px Spectral, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText("TENT", 0, 32);
    ctx.font = `600 ${Math.round(12 * scale)}px Spectral, Georgia, serif`;
    const carryNote = jarsCarried > 0 ? `+${jarsCarried}` : "";
    ctx.fillText(`${jarsStored}${carryNote}${ready ? " · tap" : ""}`, 0, 50);
    ctx.restore();
  }

  // ---------------- WONDER 4: MANNA ----------------
  window.BibleBowlScenes.manna = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const rules = WONDER_RULES.manna;
    const weekDay = customWonderState.weekDay || 1;
    const phase = customWonderState.mannaPhase || (weekDay === 7 ? "sabbath" : "quail");
    const jarLimit = customWonderState.jarLimit ?? (weekDay === 6 ? 2 : 1);
    let jarFill = customWonderState.jarFill || 0;
    const jarsStored = customWonderState.jarsStored || 0;
    let jarsCarried = customWonderState.jarsCarried || 0;
    const dailyNeed = Math.max(0, jarLimit - jarsStored);
    const rotten = customWonderState.rotten;
    const tentX = customWonderState.tentX || w * 0.84;
    const tentY = customWonderState.tentY || h * 0.78;
    const uiScale = window.BibleBowlScenes.uiScale(w);
    const fingerX = mouse.x;
    const fingerY = mouse.y;
    const jarX = fingerX;
    const jarY = Math.max(120, Math.min(h - 24, fingerY - 48));
    const jarDrawY = Math.max(120, Math.min(h - 24, fingerY - 16));
    const jarRadius = 36;
    const btnY = h - Math.round(40 * uiScale);
    const btnW = Math.round(140 * uiScale);
    const btnH = Math.round(42 * uiScale);

    if (weekDay === 7 || phase === "sabbath") {
      window.BibleBowlScenes.drawCaption(ctx, w, rules.sabbathCaption);
      window.BibleBowlScenes.drawProgress(ctx, w,
        customWonderState.sabbathFed ? "Rest" : rules.sabbathProgress);
      drawMannaTentTarget(ctx, w, w * 0.5, h * 0.52, jarsStored || 2, 0, !customWonderState.sabbathFed, canvasTime);
      const onTent = window.BibleBowlScenes.hitRect(fingerX, fingerY, w * 0.5, h * 0.52, 120, 90);
      if (!customWonderState.sabbathFed && onTent && mouse.down) {
        customWonderState.sabbathFed = true;
        customWonderState.complete = true;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
      }
      return;
    }

    if (phase === "quail") {
      customWonderState.quailTimer = (customWonderState.quailTimer || 0) + 1;
      window.BibleBowlScenes.drawCaption(ctx, w, rules.quailCaption);
      window.BibleBowlScenes.drawProgress(ctx, w, rules.quailProgress);
      ctx.fillStyle = "rgba(8, 12, 28, 0.38)";
      ctx.fillRect(0, 98, w, h - 98);

      if (customWonderState.quailTimer % 16 === 0) spawnQuail(w, h, particles);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.type !== "quail") continue;
        p.x += p.vx;
        p.y += p.vy + Math.sin(canvasTime * 0.08 + p.wing) * 0.3;
        p.life -= 1;
        drawQuail(ctx, p, canvasTime);
        if (p.life <= 0 || p.x > w + 40) particles.splice(i, 1);
      }

      if (mouse.down) customWonderState.quailHold = (customWonderState.quailHold || 0) + 1;
      else customWonderState.quailHold = Math.max(0, (customWonderState.quailHold || 0) - 1);

      window.BibleBowlScenes.drawTouchButton(
        ctx, w / 2, btnY, btnW, btnH, "Continue",
        { pulse: canvasTime * 0.08, active: customWonderState.contPressed }
      );
      const onContinue = window.BibleBowlScenes.hitRect(fingerX, fingerY, w / 2, btnY, btnW, btnH);
      if (onContinue && mouse.down) customWonderState.contPressed = true;
      if (!mouse.down) customWonderState.contPressed = false;

      if ((customWonderState.quailHold || 0) >= 90 || (onContinue && mouse.down)) {
        advanceMannaToDew(customWonderState, particles);
      }
      return;
    }

    if (phase === "dew") {
      const dewRate = mouse.down ? 0.012 : 0.005;
      customWonderState.dewProgress = Math.min(1, (customWonderState.dewProgress || 0) + dewRate);
      window.BibleBowlScenes.drawCaption(ctx, w, rules.dewCaption);
      window.BibleBowlScenes.drawProgress(ctx, w, "Morning dew");
      window.BibleBowlScenes.drawProgressBar(ctx, w, 68, customWonderState.dewProgress, "Dew settling");
      ctx.fillStyle = `rgba(180, 210, 255, ${0.12 + customWonderState.dewProgress * 0.42})`;
      ctx.fillRect(0, 98, w, h * 0.58);

      if (customWonderState.dewProgress >= 1) {
        beginMannaGather(customWonderState, w, h, particles, canvasTime, false);
      }
      return;
    }

    // gather phase
    const dayProgress = jarLimit > 0
      ? (jarsStored + jarsCarried + Math.min(jarFill / MANNA_JAR_FULL, 1)) / jarLimit
      : 0;
    let hint = rotten
      ? rules.hoardMessage
      : (customWonderState.meltFlash || 0) > 0
        ? rules.meltMessage
        : jarsCarried >= dailyNeed && dailyNeed > 0
          ? `Tap TENT · ${jarsCarried} jar${jarsCarried > 1 ? "s" : ""}`
          : weekDay === 6 && jarsCarried === 1 && jarsStored === 0
            ? "Fill second jar · same manna"
            : jarsCarried > 0
              ? "Scoop next jar or tap TENT"
              : "Scoop manna with your jar";
    window.BibleBowlScenes.drawCaption(ctx, w, mannaDayCaption(weekDay));
    window.BibleBowlScenes.drawProgress(ctx, w, hint);
    const barLabel = `${jarsStored}/${jarLimit} in tent` +
      (jarsCarried ? ` · ${jarsCarried} carried` : jarFill > 0 ? ` · ${Math.round(jarFill * 100)}%` : "");
    window.BibleBowlScenes.drawProgressBar(
      ctx, w, 68, dayProgress,
      barLabel
    );

    if ((customWonderState.meltFlash || 0) > 0) customWonderState.meltFlash -= 1;

    if (!rotten && jarFill < MANNA_JAR_FULL &&
        customWonderState.meltDeadline && canvasTime >= customWonderState.meltDeadline &&
        !customWonderState.meltTriggered) {
      customWonderState.meltTriggered = true;
      customWonderState.meltFlash = 90;
      customWonderState.meltDeadline = 0;
      customWonderState.jarFill = 0;
      jarFill = 0;
      if (!(weekDay === 6 && jarsStored >= 1)) {
        spawnMannaFlakes(w, h, particles, { sparse: true });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type !== "manna" || p.taken) continue;
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!rotten) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.type !== "manna" || p.taken) continue;
        if (Math.hypot(p.x - jarX, p.y - jarY) < jarRadius) {
          if (jarsCarried >= dailyNeed) {
            customWonderState.rotten = true;
            break;
          }
          if (jarFill < MANNA_JAR_FULL) {
            p.taken = true;
            jarFill = Math.min(1, jarFill + 0.014);
            customWonderState.jarFill = jarFill;
          }
        }
      }
    }

    if (!rotten && jarFill >= MANNA_JAR_FULL && jarsCarried < dailyNeed) {
      jarsCarried += 1;
      customWonderState.jarsCarried = jarsCarried;
      jarFill = 0;
      customWonderState.jarFill = 0;
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
    }

    const onTent = window.BibleBowlScenes.hitRect(fingerX, fingerY, tentX, tentY, 110, 88);
    if (jarsCarried > 0 && !rotten && onTent && mouse.down && !customWonderState.tentPressed) {
      customWonderState.tentPressed = true;
      customWonderState.jarsStored = jarsStored + jarsCarried;
      customWonderState.jarsCarried = 0;
      jarsCarried = 0;
      customWonderState.jarFill = 0;
      jarFill = 0;
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("drink");

      if (customWonderState.jarsStored >= jarLimit) {
        advanceMannaDay(customWonderState, w, h, particles);
      } else if (weekDay === 6) {
        customWonderState.meltTriggered = false;
        customWonderState.meltDeadline = canvasTime + 600;
        customWonderState.meltFlash = 0;
      }
    }
    if (!mouse.down) customWonderState.tentPressed = false;

    drawMannaTentTarget(ctx, w, tentX, tentY, jarsStored, jarsCarried, jarsCarried > 0, canvasTime);
    drawMannaJar(ctx, jarX, jarDrawY, jarFill, rotten, 1.35);

    if (mouse.down || mouse.x > 0) {
      ctx.fillStyle = "rgba(212, 160, 78, 0.35)";
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

})();
