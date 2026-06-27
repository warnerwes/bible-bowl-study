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
      customWonderState.windStrength = 0;
      customWonderState.handExtended = false;
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
      if (!customWonderState.weekDay) {
        customWonderState.weekDay = 1 + Math.floor(Math.random() * 7);
      }
      const weekDay = customWonderState.weekDay;
      customWonderState.jarFill = 0;
      customWonderState.jarsStored = weekDay === 7 ? 1 : 0;
      customWonderState.jarLimit = weekDay === 6 ? 2 : weekDay === 7 ? 0 : 1;
      customWonderState.rotten = false;
      customWonderState.complete = weekDay === 7;
      customWonderState.sabbathFed = false;
      customWonderState.tentX = w * 0.82;
      customWonderState.tentY = h * 0.72;
      particles.length = 0;
      if (weekDay !== 7) {
        const count = Math.min(420, Math.max(260, Math.floor(w * h / 280)));
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * w,
            y: h * 0.08 + Math.random() * h * 0.88,
            r: Math.random() * 1.8 + 0.9,
            type: "manna",
            taken: false
          });
        }
      }
    }
  };

  // ---------------- WONDER 1: RED SEA ----------------
  window.BibleBowlScenes.red_sea = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const parting = customWonderState.parting || 0;
    const leftEdge = w * (0.48 - 0.22 * parting);
    const rightEdge = w * (0.52 + 0.22 * parting);
    const overSea = mouse.x > w * 0.15 && mouse.x < w * 0.85 && mouse.y > h * 0.08 && mouse.y < h * 0.88;

    window.BibleBowlScenes.drawCaption(ctx, w,
      parting >= 1 ? "Dry land — Israel passes through" : "Stretch out your hand over the sea");
    window.BibleBowlScenes.drawProgress(ctx, w,
      parting >= 1 ? "The south wind has parted the waters" : `Strong south wind… ${Math.round(parting * 100)}%`);

    if (parting < 1 && overSea && mouse.down) {
      customWonderState.handExtended = true;
      const prevPart = customWonderState.parting || 0;
      customWonderState.windStrength = (customWonderState.windStrength || 0) + 0.0045;
      customWonderState.parting = Math.min(1, customWonderState.windStrength);
      if (Math.floor(prevPart * 5) < Math.floor(customWonderState.parting * 5) &&
          typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound(customWonderState.parting >= 1 ? "parted" : "parting");
      }
    } else {
      customWonderState.handExtended = false;
    }

    if (parting < 1 && customWonderState.handExtended && canvasTime % 3 === 0) {
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

    if (customWonderState.handExtended || parting < 1) {
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

    if (parting >= 1) customWonderState.complete = true;

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

    window.BibleBowlScenes.drawCaption(ctx, w, "Cast the tree into bitter Marah");
    window.BibleBowlScenes.drawProgress(ctx, w,
      customWonderState.sweetened ? "The Lord showed him a tree — waters made sweet" : "Drag the tree into the pool and cast it in");

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
    if (customWonderState.sweetened) customWonderState.complete = true;

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

    if (drunkCount >= 12) customWonderState.complete = true;

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

  function drawMannaJar(ctx, x, y, fill, rotten) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = rotten ? "#4a3520" : "#a67c52";
    ctx.strokeStyle = rotten ? "#6b4423" : "#8a6d3b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(-12, -10);
    ctx.lineTo(12, -10);
    ctx.lineTo(16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (fill > 0) {
      ctx.fillStyle = rotten ? "#3d5c34" : "rgba(255,255,255,0.88)";
      ctx.fillRect(-11, 8 - fill * 16, 22, fill * 16);
    }
    if (rotten) {
      ctx.fillStyle = "#2ecc71";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("~", 0, 0);
    }
    ctx.restore();
  }

  function drawMannaTent(ctx, x, y, jars) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#c9a86c";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-24, 10);
    ctx.lineTo(24, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6d3b";
    ctx.fillRect(-18, 10, 36, 14);
    ctx.fillStyle = "rgba(236,230,216,0.8)";
    ctx.font = "600 8px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(jars > 0 ? `Tent · ${jars} jar${jars > 1 ? "s" : ""}` : "Tent", 0, 32);
    ctx.restore();
  }

  // ---------------- WONDER 4: MANNA ----------------
  window.BibleBowlScenes.manna = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const weekDay = customWonderState.weekDay || 1;
    const dayLabel = weekDay === 7 ? "Day 7 — Sabbath" : `Day ${weekDay} of the week`;
    const jarLimit = customWonderState.jarLimit ?? (weekDay === 6 ? 2 : weekDay === 7 ? 0 : 1);
    let jarFill = customWonderState.jarFill || 0;
    let jarsStored = customWonderState.jarsStored || 0;
    const rotten = customWonderState.rotten;
    const tentX = customWonderState.tentX || w * 0.82;
    const tentY = customWonderState.tentY || h * 0.72;
    const jarX = mouse.x;
    const jarY = Math.min(h - 24, mouse.y);

    window.BibleBowlScenes.drawCaption(ctx, w, dayLabel);

    if (weekDay === 7) {
      window.BibleBowlScenes.drawProgress(ctx, w,
        customWonderState.sabbathFed ? "Sabbath rest — no manna falls today" : "Eat the manna at your tent and rest");
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, 0, w, h);
      drawMannaTent(ctx, w * 0.5, h * 0.45, customWonderState.jarsStored || 1);
      if (!customWonderState.sabbathFed && mouse.down &&
          Math.hypot(mouse.x - w * 0.5, mouse.y - h * 0.45) < 50) {
        customWonderState.sabbathFed = true;
        customWonderState.complete = true;
      }
      return;
    }

    const progressText = rotten
      ? "Worms bred — gather only what you need each day"
      : jarsStored >= jarLimit
        ? (jarLimit === 2
          ? "Two jars for today — tap your tent to store them"
          : "One jar for today — tap your tent to store it")
        : `Collect into your jar · ${jarLimit} jar${jarLimit > 1 ? "s" : ""} allowed today`;
    window.BibleBowlScenes.drawProgress(ctx, w, progressText);

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let gy = 12; gy < h; gy += 14) {
      for (let gx = 8; gx < w; gx += 16) {
        if ((gx + gy) % 23 === 0) {
          ctx.fillRect(gx, gy, 2, 2);
        }
      }
    }

    if (!rotten && jarsStored < jarLimit && jarFill < 1) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.type !== "manna" || p.taken) continue;
        if (Math.hypot(p.x - jarX, p.y - jarY) < 22) {
          p.taken = true;
          jarFill = Math.min(1.15, jarFill + 0.018);
          customWonderState.jarFill = jarFill;
        }
      }
    }

    if (jarFill >= 1 && !rotten) {
      if (jarsStored < jarLimit) {
        jarsStored += 1;
        customWonderState.jarsStored = jarsStored;
        customWonderState.jarFill = 0;
        jarFill = 0;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("gather");
      } else {
        customWonderState.rotten = true;
      }
    }
    if (jarFill > 1 || (jarsStored >= jarLimit && jarFill > 0.05)) {
      customWonderState.rotten = true;
    }

    if (rotten && canvasTime % 8 === 0) {
      particles.push({
        x: jarX + (Math.random() - 0.5) * 20,
        y: jarY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.8,
        r: 2,
        alpha: 0.8,
        type: "worm",
        life: 50
      });
    }

    if (jarsStored >= jarLimit && !rotten && mouse.down &&
        Math.hypot(mouse.x - tentX, mouse.y - tentY) < 44) {
      customWonderState.complete = true;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === "manna" && !p.taken) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (p.type === "worm") {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        p.alpha -= 0.015;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(80,120,60,${p.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawMannaTent(ctx, tentX, tentY, jarsStored);
    drawMannaJar(ctx, jarX, jarY, Math.min(1, jarFill), rotten);
  };

})();
