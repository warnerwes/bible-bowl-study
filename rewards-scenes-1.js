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

  // Setup initial particles for the active scene
  window.BibleBowlScenes.setupParticles = (id, w, h, particles, customWonderState) => {
    if (id === "red_sea") {
      // Wall of water particles left & right
      for (let i = 0; i < 200; i++) {
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
      customWonderState.casting = false;
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
          strength: 1
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
      // Falling flakes
      for (let i = 0; i < 150; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: Math.random() * 0.8 + 0.4,
          r: Math.random() * 4 + 1.5,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.005,
          type: "manna"
        });
      }
    }
  };

  // ---------------- WONDER 1: RED SEA ----------------
  window.BibleBowlScenes.red_sea = (w, h, ctx, canvasTime, mouse, particles) => {
    window.BibleBowlScenes.drawCaption(ctx, w, "Walls of water · dry path in the center");

    ctx.fillStyle = "rgba(52, 152, 219, 0.12)";
    ctx.fillRect(0, 0, w * 0.28, h);
    ctx.fillRect(w * 0.72, 0, w * 0.28, h);

    ctx.fillStyle = "rgba(212, 160, 78, 0.2)";
    ctx.fillRect(w * 0.28, 0, w * 0.44, h);
    ctx.strokeStyle = "rgba(236, 230, 216, 0.15)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 8);
    ctx.lineTo(w * 0.5, h - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(236, 230, 216, 0.45)";
    ctx.font = "600 9px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("DRY PATH", w / 2, h * 0.48);
    ctx.font = "500 8px Spectral, Georgia, serif";
    ctx.fillStyle = "rgba(127, 212, 255, 0.55)";
    ctx.fillText("SEA", w * 0.14, h * 0.48);
    ctx.fillText("SEA", w * 0.86, h * 0.48);

    const onWaterWall = (mouse.x < w * 0.28 || mouse.x > w * 0.72) &&
      (mouse.down || Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py) > 2);
    if (onWaterWall && canvasTime % 28 === 0 && Math.random() > 0.45) {
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("water");
    }

    if (mouse.x > w * 0.28 && mouse.x < w * 0.72) {
      if (mouse.x !== mouse.px || mouse.y !== mouse.py) {
        particles.push({
          x: mouse.x + (Math.random() - 0.5) * 12,
          y: mouse.y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -Math.random() * 0.4,
          r: Math.random() * 2 + 1,
          alpha: 1,
          type: "dust"
        });
      }
    }

    // Process particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "dust") {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(226, 192, 116, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Sea spray particles triggered by cursor on water walls
      const isNearMouse = Math.hypot(p.x - mouse.x, p.y - mouse.y) < 100;
      if (isNearMouse && mouse.down) {
        const angle = Math.atan2(p.y - mouse.y, p.x - mouse.x);
        p.vx += Math.cos(angle) * 0.4;
        p.vy += Math.sin(angle) * 0.4;
      }

      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx + Math.sin(canvasTime * 0.02 + p.y * 0.01) * 0.2;
      p.y += p.vy + Math.cos(canvasTime * 0.01 + p.x * 0.01) * 0.15;

      // Keep within water boundaries
      if (p.side === "left") {
        if (p.x > w * 0.26) { p.x = w * 0.26; p.vx = -Math.abs(p.vx) - 0.2; }
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      } else {
        if (p.x < w * 0.74) { p.x = w * 0.74; p.vx = Math.abs(p.vx) + 0.2; }
        if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
      }
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.fillStyle = p.side === "left" 
        ? `rgba(52, 152, 219, ${p.alpha})` 
        : `rgba(41, 128, 185, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      if (i % 6 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw sea walls outlines
    ctx.strokeStyle = "rgba(100, 200, 255, 0.2)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let y = 0; y <= h + 20; y += 20) {
      const x = w * 0.26 + Math.sin(canvasTime * 0.03 + y * 0.02) * 8;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let y = 0; y <= h + 20; y += 20) {
      const x = w * 0.74 + Math.cos(canvasTime * 0.03 + y * 0.02) * 8;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ---------------- WONDER 2: MARAH ----------------
  window.BibleBowlScenes.marah = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const poolY = customWonderState.poolY || h * 0.56;
    const branchX = mouse.x;
    const branchY = mouse.y;
    const inPool = branchY > poolY + 8 && branchX > w * 0.08 && branchX < w * 0.92;

    window.BibleBowlScenes.drawCaption(ctx, w, "Bitter spring of Marah");

    ctx.fillStyle = "#121810";
    ctx.fillRect(0, 0, w, poolY);
    ctx.fillStyle = customWonderState.sweetened ? "#153040" : "#243018";
    ctx.fillRect(0, poolY, w, h - poolY);
    ctx.fillStyle = customWonderState.sweetened ? "rgba(52, 152, 219, 0.35)" : "rgba(90, 110, 45, 0.45)";
    ctx.beginPath();
    ctx.ellipse(w / 2, poolY + (h - poolY) * 0.42, w * 0.38, (h - poolY) * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(236, 230, 216, 0.55)";
    ctx.font = "600 10px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(customWonderState.sweetened ? "Waters made sweet" : "Tap the bitter pool", w / 2, poolY + 18);

    if (!customWonderState.sweetened && inPool && mouse.down && !customWonderState.casting) {
      customWonderState.casting = true;
      customWonderState.sweetened = true;
      customWonderState.rippleRadius = 10;
      customWonderState.rippleX = branchX;
      customWonderState.rippleY = branchY;
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("water");
    }
    if (!mouse.down) customWonderState.casting = false;

    if (!customWonderState.sweetened && !inPool) {
      window.BibleBowlScenes.drawTapRing(ctx, w / 2, poolY + (h - poolY) * 0.42, w * 0.22, (h - poolY) * 0.18, canvasTime);
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
    ctx.rotate(0.35);
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(-22, -3, 44, 7);
    ctx.fillStyle = "#27ae60";
    ctx.beginPath();
    ctx.arc(12, -5, 7, 0, Math.PI * 2);
    ctx.arc(-12, -5, 6, 0, Math.PI * 2);
    ctx.arc(0, 5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(236, 230, 216, 0.7)";
    ctx.font = "600 8px Spectral, Georgia, serif";
    ctx.textAlign = "left";
    ctx.fillText("Branch", 18, -10);
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

  function drawElimWell(ctx, x, y, active, idx) {
    ctx.fillStyle = "#7a6a52";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = active ? "#7fd4ff" : "#2f6ea8";
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = "rgba(127, 212, 255, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(236, 230, 216, 0.55)";
    ctx.font = "600 9px Spectral, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(String(idx + 1), x, y + 18);
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

    ctx.fillStyle = "rgba(212, 160, 78, 0.12)";
    window.BibleBowlScenes.drawCaption(ctx, w, "12 wells of water · seventy palm trees");

    springs.forEach((sp, idx) => {
      const nearWell = Math.hypot(mouse.x - sp.x, mouse.y - sp.y) < 34;
      const nearTop = Math.abs(mouse.x - sp.x) < 28 && mouse.y < groundY - 20;
      sp.strength = nearWell ? 2.4 : 1;

      drawElimWell(ctx, sp.x, sp.y, nearWell, idx);

      if (nearWell && Math.random() < 0.12 * sp.strength) {
        particles.push({
          x: sp.x + (Math.random() - 0.5) * 8,
          y: sp.y - 2,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -(Math.random() * 2.2 + 0.8),
          r: Math.random() * 2 + 1,
          alpha: 0.85,
          type: "spring_drop"
        });
      }

      if (nearWell && canvasTime % 45 === 0 && Math.random() > 0.5) {
        if (typeof window.BibleBowlPlaySound === "function") {
          window.BibleBowlPlaySound("water");
        }
      }

      const palmAbove = palms.find((p) => Math.abs(p.x - sp.x) < 30);
      if (palmAbove && nearTop && Math.random() > 0.82) {
        particles.push({
          x: palmAbove.x + (Math.random() - 0.5) * 24,
          y: palmAbove.baseY - 58 * palmAbove.scale,
          vx: (Math.random() - 0.5) * 0.6,
          vy: Math.random() * 0.8 + 0.4,
          r: Math.random() * 3 + 3,
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.05,
          type: "leaf"
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
    window.BibleBowlScenes.drawCaption(ctx, w, "Bread from heaven · quails at evening");

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    if (Math.random() < 0.12) {
      particles.push({
        x: Math.random() * w,
        y: -10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 0.8 + 0.5,
        r: Math.random() * 4 + 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005,
        type: "manna"
      });
    }

    if (Math.random() < 0.005) {
      particles.push({
        x: Math.random() > 0.5 ? -30 : w + 30,
        y: Math.random() * h * 0.5 + 50,
        vx: (Math.random() * 1.5 + 0.8) * (Math.random() > 0.5 ? 1 : -1),
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 6 + 8,
        type: "quail"
      });
    }

    if (mouse.down) {
      ctx.strokeStyle = "rgba(241, 196, 15, 0.15)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 100, 0, Math.PI*2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 60, 0, Math.PI*2);
      ctx.stroke();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "manna") {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 55 || (mouse.down && dist < 120)) {
          const pull = dist < 55 ? 0.45 : (120 - dist) / 120;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * pull * 0.35;
          p.vy += Math.sin(angle) * pull * 0.35;

          if (dist < 18) {
            for (let s = 0; s < 5; s++) {
              particles.push({
                x: p.x,
                y: p.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                r: Math.random() * 2 + 1,
                alpha: 1,
                type: "sparkle"
              });
            }
            if (canvasTime % 6 === 0 && typeof window.BibleBowlPlaySound === "function") {
              window.BibleBowlPlaySound("chime");
            }
            particles.splice(i, 1);
            continue;
          }
        } else if (dist < 180) {
          p.vx += (mouse.x - mouse.px) * 0.005;
          p.vy += (mouse.y - mouse.py) * 0.005;
        }

        p.vx *= 0.95;
        p.x += p.vx + Math.sin(p.phase + canvasTime * p.speed) * 0.3;
        p.y += p.vy;

        if (p.y > h + 10) {
          p.y = -10;
          p.x = Math.random() * w;
          p.vx = (Math.random() - 0.5) * 0.5;
        }

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === "quail") {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -40 || p.x > w + 40) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = "rgba(100, 90, 80, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const swing = Math.sin(canvasTime * 0.2) * 5;
        ctx.moveTo(-p.size, swing);
        ctx.quadraticCurveTo(0, -p.size * 0.3, p.size, swing);
        ctx.stroke();
        ctx.restore();

      } else if (p.type === "sparkle") {
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
