/* Bible Bowl Study — Wonders of the Exodus (Scenes 1-4)
   Contains particle setup and rendering for Red Sea, Marah, Elim, and Manna. */

(() => {
  "use strict";

  window.BibleBowlScenes = window.BibleBowlScenes || {};

  function sceneScale(w, h) {
    return Math.min(w / 390, h / 260, 1.35);
  }

  window.BibleBowlScenes.drawCaption = (ctx, w, text) => {
    ctx.save();
    ctx.fillStyle = "rgba(236, 230, 216, 0.82)";
    ctx.font = "600 11px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 20);
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

  window.BibleBowlScenes.drawProgress = (ctx, w, text) => {
    ctx.save();
    ctx.fillStyle = "rgba(212, 160, 78, 0.75)";
    ctx.font = "500 10px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, 36);
    ctx.restore();
  };

  // Setup initial particles for the active scene
  window.BibleBowlScenes.setupParticles = (id, w, h, particles, customWonderState) => {
    if (id === "red_sea") {
      customWonderState.parting = 0;
      customWonderState.strikes = 0;
      customWonderState.strikesNeeded = 5;
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
      customWonderState.branchCast = false;
      customWonderState.poolDrag = 0;
      customWonderState.branchFixed = null;
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
          drunk: false,
          drinkProgress: 0
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
      const count = Math.min(55, Math.max(36, Math.floor(w * h / 1800)));
      customWonderState.mannaTotal = count;
      customWonderState.mannaCollected = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.85 + 10,
          vx: (Math.random() - 0.5) * 0.3,
          vy: Math.random() * 0.4 + 0.2,
          r: Math.random() * 3.5 + 2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.015 + 0.004,
          type: "manna"
        });
      }
    }
  };

  // ---------------- WONDER 1: RED SEA ----------------
  window.BibleBowlScenes.red_sea = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const parting = customWonderState.parting || 0;
    const strikes = customWonderState.strikes || 0;
    const needed = customWonderState.strikesNeeded || 5;
    const leftEdge = w * (0.48 - 0.22 * parting);
    const rightEdge = w * (0.52 + 0.22 * parting);

    window.BibleBowlScenes.drawCaption(ctx, w, parting >= 1 ? "The sea is parted — walk through" : "Strike the waters to part the sea");
    window.BibleBowlScenes.drawProgress(ctx, w, parting >= 1 ? "Dry land revealed" : `Wind upon the waters ${strikes} / ${needed}`);

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

    if (parting < 1 && mouse.down && !customWonderState.wallHit) {
      const onLeft = mouse.x < leftEdge + 20;
      const onRight = mouse.x > rightEdge - 20;
      if (onLeft || onRight) {
        customWonderState.wallHit = true;
        customWonderState.strikes = strikes + 1;
        customWonderState.parting = Math.min(1, customWonderState.strikes / needed);
        if (typeof window.BibleBowlPlaySound === "function") {
          window.BibleBowlPlaySound(customWonderState.parting >= 1 ? "parted" : "parting");
        }
      }
    }
    if (!mouse.down) customWonderState.wallHit = false;

    if (parting >= 1 && mouse.x > leftEdge && mouse.x < rightEdge) {
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

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
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
    const branchCast = customWonderState.branchCast;
    const branchX = branchCast && customWonderState.branchFixed
      ? customWonderState.branchFixed.x : mouse.x;
    const branchY = branchCast && customWonderState.branchFixed
      ? customWonderState.branchFixed.y : mouse.y;
    const inPool = branchY > poolY + 8 && branchX > w * 0.08 && branchX < w * 0.92;

    window.BibleBowlScenes.drawCaption(ctx, w, "Cast the branch into bitter Marah");
    window.BibleBowlScenes.drawProgress(ctx, w,
      customWonderState.sweetened ? "Waters made sweet" : "Sweep the branch through the pool");

    ctx.fillStyle = "#121810";
    ctx.fillRect(0, 0, w, poolY);
    ctx.fillStyle = customWonderState.sweetened ? "#153040" : "#243018";
    ctx.fillRect(0, poolY, w, h - poolY);
    ctx.fillStyle = customWonderState.sweetened ? "rgba(52, 152, 219, 0.35)" : "rgba(90, 110, 45, 0.45)";
    ctx.beginPath();
    ctx.ellipse(poolCX, poolCY, w * 0.38, (h - poolY) * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!branchCast && inPool && mouse.down) {
      customWonderState.poolDrag = (customWonderState.poolDrag || 0) +
        Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      if (customWonderState.poolDrag > 120) {
        customWonderState.branchCast = true;
        customWonderState.branchFixed = { x: branchX, y: branchY };
        customWonderState.sweetened = true;
        customWonderState.rippleRadius = 10;
        customWonderState.rippleX = branchX;
        customWonderState.rippleY = branchY;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("sweeten");
      }
    }
    if (!mouse.down && !branchCast) customWonderState.poolDrag = 0;

    if (!branchCast && !customWonderState.sweetened) {
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
    ctx.translate(branchX, branchY);
    ctx.rotate(branchCast ? 0.8 : 0.35);
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(-22, -3, 44, 7);
    ctx.fillStyle = "#27ae60";
    ctx.beginPath();
    ctx.arc(12, -5, 7, 0, Math.PI * 2);
    ctx.arc(-12, -5, 6, 0, Math.PI * 2);
    ctx.arc(0, 5, 7, 0, Math.PI * 2);
    ctx.fill();
    if (!branchCast) {
      ctx.fillStyle = "rgba(236, 230, 216, 0.7)";
      ctx.font = "600 8px Spectral, Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("Branch", 18, -10);
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

  function drawElimWell(ctx, x, y, active, idx, drunk) {
    ctx.fillStyle = "#7a6a52";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = drunk ? "#9ae6ff" : active ? "#7fd4ff" : "#2f6ea8";
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (drunk) {
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
    ctx.fillStyle = drunk ? "rgba(212, 160, 78, 0.9)" : "rgba(236, 230, 216, 0.55)";
    ctx.font = "600 9px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(drunk ? "✓" : String(idx + 1), x, y + 18);
  }

  // ---------------- WONDER 3: ELIM ----------------
  window.BibleBowlScenes.elim = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const springs = customWonderState.springs || [];
    const palms = customWonderState.palms || [];
    const groundY = h - 44;

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

    const drunkCount = springs.filter((s) => s.drunk).length;
    window.BibleBowlScenes.drawCaption(ctx, w, "Twelve wells at Elim");
    window.BibleBowlScenes.drawProgress(ctx, w,
      drunkCount >= 12 ? "All twelve wells visited" : `Drink from each well ${drunkCount} / 12`);

    springs.forEach((sp, idx) => {
      const nearWell = Math.hypot(mouse.x - sp.x, mouse.y - sp.y) < 32;

      if (!sp.drunk && nearWell && mouse.down) {
        sp.drinkProgress = (sp.drinkProgress || 0) + 1;
        if (sp.drinkProgress > 45) {
          sp.drunk = true;
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("drink");
        }
      } else if (!nearWell && !sp.drunk) {
        sp.drinkProgress = Math.max(0, (sp.drinkProgress || 0) - 2);
      }

      drawElimWell(ctx, sp.x, sp.y, nearWell && !sp.drunk, idx, sp.drunk);

      if (nearWell && !sp.drunk && sp.drinkProgress > 10 && Math.random() < 0.08) {
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

  // ---------------- WONDER 4: MANNA ----------------
  window.BibleBowlScenes.manna = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const total = customWonderState.mannaTotal || 0;
    const collected = customWonderState.mannaCollected || 0;
    const remaining = particles.filter((p) => p.type === "manna").length;

    window.BibleBowlScenes.drawCaption(ctx, w, "Gather the bread from heaven");
    window.BibleBowlScenes.drawProgress(ctx, w,
      remaining === 0 ? "All manna gathered" : `Gathered ${collected} / ${total}`);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "manna") {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 40) {
          const angle = Math.atan2(dy, dx);
          const pull = (40 - dist) / 40;
          p.vx += Math.cos(angle) * pull * 0.25;
          p.vy += Math.sin(angle) * pull * 0.25;
        }

        if (dist < 16) {
          for (let s = 0; s < 4; s++) {
            particles.push({
              x: p.x, y: p.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              r: Math.random() * 1.5 + 0.5,
              alpha: 1,
              type: "sparkle"
            });
          }
          customWonderState.mannaCollected = collected + 1;
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
          particles.splice(i, 1);
          continue;
        }

        p.vx *= 0.96;
        p.x += p.vx + Math.sin(p.phase + canvasTime * p.speed) * 0.2;
        p.y += p.vy + 0.08;

        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (p.type === "sparkle") {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.03;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(241, 196, 15, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

})();
