/* Bible Bowl Study — Wonders of the Exodus (Scenes 5-8)
   Contains particle setup and rendering for Rephidim, Sinai, Golden Calf, and Glory. */

(() => {
  "use strict";

  window.BibleBowlScenes = window.BibleBowlScenes || {};

  // ---------------- WONDER 5: REPHIDIM ----------------
  window.BibleBowlScenes.rephidim = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const rock = customWonderState.rock;
    if (!rock) return;

    const staffX = mouse.x;
    const staffY = mouse.y;
    const groundY = h * 0.9;
    const rockCenterX = rock.x;
    const rockCenterY = rock.y - rock.h * 0.5;
    const staffLen = Math.min(h * 0.38, 88);
    const crackY = rock.y - rock.h;
    const onRock = Math.hypot(staffX - rockCenterX, staffY - rockCenterY) < Math.max(rock.w * 0.62, 68);

    // Swing speed = how far the staff moved since the last frame (px/frame).
    // The rock only yields to a hard, fast strike — a slow drag won't do it.
    // STRIKE_SPEED is the force threshold; tune for feel.
    const STRIKE_SPEED = 18;
    const prevX = customWonderState.prevStaffX;
    const prevY = customWonderState.prevStaffY;
    const validPrev = prevX !== null && prevX !== undefined;
    const swingSpeed = validPrev ? Math.hypot(staffX - prevX, staffY - prevY) : 0;
    // A huge jump means the pointer teleported (just appeared / refocused),
    // not a real swing — never let that count as a strike.
    const teleport = swingSpeed > 220;
    customWonderState.prevStaffX = staffX;
    customWonderState.prevStaffY = staffY;
    const recentSoft = customWonderState.softHitFlash != null &&
      canvasTime - customWonderState.softHitFlash < 40;

    window.BibleBowlScenes.drawCaption(ctx, w, "Massah · Meribah");
    window.BibleBowlScenes.drawProgress(ctx, w,
      rock.struck
        ? "Here the rock was struck once"
        : recentSoft
          ? "Strike harder! Swing the staff to break the rock"
          : canvasTime < 80
            ? "They tested the Lord"
            : "Strike the rock hard with the staff");

    if (!rock.struck && canvasTime < 80) {
      const murmurY = groundY - 28;
      ctx.fillStyle = "rgba(236, 230, 216, 0.55)";
      ctx.font = "500 10px Spectral, Georgia, serif";
      ctx.textAlign = "center";
      for (let m = 0; m < 5; m++) {
        const mx = w * (0.12 + m * 0.19) + Math.sin(canvasTime * 0.06 + m) * 6;
        ctx.fillText("…", mx, murmurY + Math.sin(canvasTime * 0.08 + m * 1.3) * 3);
      }
      ctx.fillStyle = "rgba(212, 160, 78, 0.35)";
      ctx.font = "italic 9px Spectral, Georgia, serif";
      ctx.fillText("murmuring", w / 2, murmurY + 14);
    }

    ctx.fillStyle = "#1a1510";
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = "rgba(212, 160, 78, 0.08)";
    ctx.fillRect(0, groundY - 8, w, 8);

    if (!rock.struck) {
      window.BibleBowlScenes.drawTapRing(ctx, rockCenterX, rockCenterY, rock.w * 0.36, rock.h * 0.4, canvasTime);
    }

    const hardStrike =
      mouse.down && onRock && validPrev && !teleport && swingSpeed >= STRIKE_SPEED;
    if (hardStrike && !rock.struck) {
      rock.struck = true;
      rock.cracked = true;
      if (typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound("smite");
      }
      for (let idx = 0; idx < 24; idx++) {
        particles.push({
          x: rockCenterX,
          y: crackY + 6,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 4 - 1,
          r: Math.random() * 3 + 1.5,
          alpha: 1,
          type: "dust"
        });
      }
    } else if (
      mouse.down && onRock && !rock.struck &&
      (!validPrev || (!teleport && swingSpeed < STRIKE_SPEED))
    ) {
      // Soft contact: the rock resists. Flash a "hit harder" cue and shed a
      // few chips at the contact point, but do NOT break it. Throttle so a
      // resting finger doesn't spray particles every frame.
      if (!recentSoft || canvasTime - customWonderState.softHitFlash > 6) {
        customWonderState.softHitFlash = canvasTime;
        for (let idx = 0; idx < 5; idx++) {
          particles.push({
            x: staffX + (Math.random() - 0.5) * 8,
            y: staffY + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 2.5,
            vy: -(Math.random() * 1.5 + 0.5),
            r: Math.random() * 1.6 + 0.8,
            alpha: 0.9,
            type: "dust"
          });
        }
      }
    }
    if (!mouse.down) customWonderState.striking = false;

    if (rock.struck && canvasTime % 4 === 0 && particles.filter((p) => p.type === "water_stream").length < 80) {
      particles.push({
        x: rock.x + (Math.random() - 0.5) * 10,
        y: crackY + 8,
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 1.5 + 1.5,
        r: Math.random() * 2.5 + 1.5,
        alpha: 0.85,
        type: "water_stream"
      });
    }

    if (!rock.struck) {
      ctx.strokeStyle = `rgba(212, 160, 78, ${0.25 + Math.sin(canvasTime * 0.08) * 0.12})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(rockCenterX, rockCenterY, rock.w * 0.34, rock.h * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();
    // A recent soft hit makes the rock shudder briefly (it resisted the tap).
    const rockShake = recentSoft && canvasTime - customWonderState.softHitFlash < 10
      ? Math.sin(canvasTime * 1.6) * 2.2
      : 0;
    ctx.translate(rock.x + rockShake, rock.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(8, 6, rock.w * 0.42, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7d6652";
    ctx.beginPath();
    ctx.moveTo(-rock.w / 2, 0);
    ctx.lineTo(-rock.w * 0.45, -rock.h * 0.85);
    ctx.lineTo(-rock.w * 0.15, -rock.h);
    ctx.lineTo(rock.w * 0.25, -rock.h * 0.9);
    ctx.lineTo(rock.w * 0.48, -rock.h * 0.7);
    ctx.lineTo(rock.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5c4938";
    ctx.beginPath();
    ctx.moveTo(-rock.w * 0.15, -rock.h);
    ctx.lineTo(rock.w * 0.25, -rock.h * 0.9);
    ctx.lineTo(rock.w * 0.48, -rock.h * 0.7);
    ctx.lineTo(rock.w / 2, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (rock.struck) {
      ctx.fillStyle = "rgba(52, 152, 219, 0.22)";
      ctx.beginPath();
      ctx.ellipse(rock.x, groundY - 6, rock.w * 0.7, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "dust") {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.alpha -= 0.02;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(165, 140, 115, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (p.type === "water_stream") {
        p.vy += 0.18;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > groundY - 4) {
          p.y = groundY - 4;
          p.vy *= -0.25;
          p.vx = (Math.random() - 0.5) * 2;
          p.alpha -= 0.06;
        }
        if (p.alpha <= 0 || p.x < -10 || p.x > w + 10) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(127, 212, 255, ${p.alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x - 1, p.y - 1, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (rock.cracked) {
      ctx.save();
      ctx.translate(rock.x, rock.y);
      ctx.strokeStyle = "#271d15";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -rock.h);
      ctx.lineTo(-10, -rock.h * 0.7);
      ctx.lineTo(15, -rock.h * 0.45);
      ctx.lineTo(-5, -rock.h * 0.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(174, 220, 245, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      const glow = ctx.createRadialGradient(0, -rock.h, 1, 0, -rock.h, 18);
      glow.addColorStop(0, "rgba(200, 235, 255, 0.9)");
      glow.addColorStop(1, "rgba(52, 152, 219, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -rock.h, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (rock.struck) customWonderState.complete = true;

    ctx.save();
    ctx.translate(staffX, staffY);
    ctx.rotate(-0.38);
    ctx.strokeStyle = "#8a6d3b";
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, staffLen * 0.68);
    ctx.lineTo(0, -staffLen * 0.78);
    ctx.bezierCurveTo(2, -staffLen * 0.96, 14, -staffLen, 16, -staffLen * 0.74);
    ctx.bezierCurveTo(18, -staffLen * 0.5, 10, -staffLen * 0.4, 0, -staffLen * 0.44);
    ctx.stroke();
    ctx.restore();
  };

  function pointOnMountain(x, y, w, h, peakX, peakY, baseW) {
    if (y < peakY - 12 || y > h - 4) return false;
    const t = (y - peakY) / (h - peakY);
    const halfW = (baseW / 2) * t * 1.05;
    return Math.abs(x - peakX) < halfW;
  }

  function sinaiMountainMetrics(w, h) {
    return {
      peakX: w / 2,
      peakY: h * 0.62,
      baseW: w * 0.78,
      leftBase: { x: w / 2 - (w * 0.78) / 2, y: h },
      rightBase: { x: w / 2 + (w * 0.78) / 2, y: h },
      peak: { x: w / 2, y: h * 0.62 }
    };
  }

  function outwardBoundaryPoint(base, peak, t, margin, w, h) {
    const x = base.x + (peak.x - base.x) * t;
    const y = base.y + (peak.y - base.y) * t;
    const cx = w / 2;
    const cy = (peak.y + h * 2) / 3;
    let nx = x - cx;
    let ny = y - cy;
    const len = Math.hypot(nx, ny) || 1;
    nx = (nx / len) * margin;
    ny = (ny / len) * margin;
    return { x: x + nx, y: y + ny };
  }

  function computeSinaiBoundaryRing(w, h) {
    const m = sinaiMountainMetrics(w, h);
    const margin = Math.max(14, Math.min(w, h) * 0.028);
    // The boundary ring should wrap around the BASE of the mountain,
    // hugging the lower slopes. Side stones use moderate t values (close
    // to the base, far from the peak) so they sit on the mountain's lower
    // flanks and the dashed segments between them don't cut across the
    // mountain face — but not so low that they end up in the foreground
    // in front of the mountain.
    return [
      { x: m.leftBase.x - margin, y: h - margin },
      outwardBoundaryPoint(m.leftBase, m.peak, 0.32, margin, w, h),
      outwardBoundaryPoint(m.leftBase, m.peak, 0.55, margin, w, h),
      outwardBoundaryPoint(m.rightBase, m.peak, 0.55, margin, w, h),
      outwardBoundaryPoint(m.rightBase, m.peak, 0.32, margin, w, h),
      { x: m.rightBase.x + margin, y: h - margin }
    ];
  }

  window.BibleBowlScenes.getSinaiBoundaryTemplate = computeSinaiBoundaryRing;

  function sortBoundaryRing(stones, peakX, peakY) {
    return stones.slice().sort((a, b) =>
      Math.atan2(a.y - peakY, a.x - peakX) - Math.atan2(b.y - peakY, b.x - peakX));
  }

  function pointInBoundaryRing(x, y, stones, peakX, peakY) {
    if (stones.length < 3) return false;
    const ring = sortBoundaryRing(stones, peakX, peakY);
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x;
      const yi = ring[i].y;
      const xj = ring[j].x;
      const yj = ring[j].y;
      if (((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function drawPillarOfCloud(ctx, peakX, peakY, w, h, t) {
    const topY = h * 0.06;
    const baseY = peakY + 8;
    const span = baseY - topY;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 7; i++) {
      const frac = i / 6;
      const drift = Math.sin(t * 0.025 + i * 1.4) * 10;
      const y = baseY - span * frac;
      const rx = w * (0.11 + frac * 0.04) + Math.sin(t * 0.03 + i) * 6;
      const ry = w * 0.055 + Math.cos(t * 0.02 + i * 0.9) * 4;
      const grad = ctx.createRadialGradient(peakX + drift, y, 2, peakX + drift, y, rx);
      grad.addColorStop(0, "rgba(248, 252, 255, 0.82)");
      grad.addColorStop(0.45, "rgba(210, 220, 235, 0.42)");
      grad.addColorStop(1, "rgba(180, 195, 215, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(peakX + drift, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    const veil = ctx.createLinearGradient(peakX, topY, peakX, baseY);
    veil.addColorStop(0, "rgba(220, 230, 245, 0.08)");
    veil.addColorStop(0.5, "rgba(200, 215, 235, 0.18)");
    veil.addColorStop(1, "rgba(180, 200, 220, 0.28)");
    ctx.fillStyle = veil;
    ctx.fillRect(peakX - w * 0.14, topY, w * 0.28, span);
    ctx.restore();
  }

  function drawPillarOfFire(ctx, peakX, peakY, w, h, t, layer) {
    const topY = h * 0.04;
    const baseY = peakY + 12;
    ctx.save();
    if (layer === "behind") {
      const glow = ctx.createRadialGradient(peakX, peakY + 10, 4, peakX, peakY, w * 0.42);
      glow.addColorStop(0, "rgba(255, 150, 40, 0.42)");
      glow.addColorStop(0.45, "rgba(255, 90, 20, 0.18)");
      glow.addColorStop(1, "rgba(255, 60, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(peakX - w * 0.42, peakY - h * 0.08, w * 0.84, h * 0.55);
    } else {
      const span = baseY - topY;
      for (let f = 0; f < 5; f++) {
        const phase = t * 0.06 + f * 1.7;
        const tipY = topY + span * (0.08 + f * 0.06) + Math.sin(phase) * 6;
        const tipX = peakX + Math.sin(phase * 0.8 + f) * 14;
        const grad = ctx.createLinearGradient(tipX, baseY, tipX, tipY);
        grad.addColorStop(0, "rgba(255, 90, 10, 0.9)");
        grad.addColorStop(0.45, "rgba(255, 170, 40, 0.75)");
        grad.addColorStop(0.8, "rgba(255, 230, 120, 0.35)");
        grad.addColorStop(1, "rgba(255, 255, 200, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.quadraticCurveTo(
          tipX + 16 + Math.sin(phase) * 8, baseY - span * 0.35,
          tipX + 10, baseY
        );
        ctx.quadraticCurveTo(
          tipX - 6, baseY - span * 0.2,
          tipX, tipY
        );
        ctx.fill();
      }
      ctx.shadowColor = "rgba(255, 140, 30, 0.65)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "rgba(255, 200, 80, 0.55)";
      ctx.beginPath();
      ctx.ellipse(peakX, peakY - 6, w * 0.1, w * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawSinaiMountain(ctx, w, h, peakX, peakY, baseW, isNight) {
    const mainFill = isNight ? "#3d2f52" : "#4a5568";
    const shadeFill = isNight ? "#261e35" : "#354050";
    const rimStroke = isNight
      ? "rgba(255, 170, 90, 0.5)"
      : "rgba(200, 215, 235, 0.55)";

    ctx.fillStyle = mainFill;
    ctx.beginPath();
    ctx.moveTo(peakX - baseW / 2, h);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(peakX + baseW / 2, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shadeFill;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX + baseW * 0.05, h * 0.85);
    ctx.lineTo(peakX - baseW * 0.05, h * 0.75);
    ctx.lineTo(peakX + baseW * 0.1, h);
    ctx.lineTo(peakX + baseW / 2, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rimStroke;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(peakX - baseW / 2, h);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(peakX + baseW / 2, h);
    ctx.stroke();
  }

  function boundaryRingBehindY(peakY, h) {
    return peakY + (h - peakY) * 0.62;
  }

  function drawBoundaryRingLayer(ctx, stones, peakX, peakY, h, layer, boundsSet) {
    if (!stones.length) return;
    const sorted = sortBoundaryRing(stones, peakX, peakY);
    const behindY = boundaryRingBehindY(peakY, h);
    const edgeBehind = (a, b) => (a.y + b.y) / 2 < behindY;
    const stoneBehind = (s) => s.y < behindY - 6;

    if (boundsSet && sorted.length >= 3) {
      ctx.strokeStyle = "rgba(212, 160, 78, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const b = sorted[(i + 1) % sorted.length];
        const behind = edgeBehind(a, b);
        if (layer === "behind" && !behind) continue;
        if (layer === "front" && behind) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    sorted.forEach((s) => {
      const behind = stoneBehind(s);
      if (layer === "behind" && !behind) return;
      if (layer === "front" && behind) return;
      ctx.fillStyle = "#6b5a48";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a7560";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSinaiLightning(ctx, w, h, customWonderState) {
    if (!customWonderState.lightning || customWonderState.lightningTime <= 0) return;
    customWonderState.lightningTime--;

    const flash = customWonderState.lightningTime / 14;
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.12})`;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = `rgba(220, 240, 255, ${flash * 0.95})`;
    ctx.shadowColor = "#66aaff";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    customWonderState.lightning.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    if (customWonderState.lightningTime <= 0) {
      customWonderState.lightning = null;
    }
  }

  // ---------------- WONDER 6: SINAI ----------------
  window.BibleBowlScenes.sinai = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const isNight = customWonderState.mode === "night";
    const peakX = w / 2;
    const peakY = h * 0.62;
    const baseW = w * 0.78;
    const phase = customWonderState.sinaiPhase || "bounds";
    const stones = customWonderState.boundaryStones || [];
    const template = customWonderState.boundaryTemplate ||
      computeSinaiBoundaryRing(w, h);
    customWonderState.boundaryTemplate = template;
    const boundsSet = stones.length >= 6;
    const onMountain = pointOnMountain(mouse.x, mouse.y, w, h, peakX, peakY, baseW);
    const insideBounds = boundsSet &&
      pointInBoundaryRing(mouse.x, mouse.y, stones, peakX, peakY);
    const inSafeZone = boundsSet && phase === "wait" && !insideBounds && mouse.y > h * 0.76;

    const caption = phase === "bounds"
      ? "Set bounds around Sinai"
      : isNight
        ? "The Lord descends in fire"
        : "The pillar of cloud on Sinai";
    const trumpetMeter = customWonderState.trumpetMeter || 0;
    let progressText;
    if (phase === "bounds") {
      progressText = stones.length < 6
        ? `Tap each marker around Sinai (${stones.length}/6)`
        : "Bounds set · stand back";
    } else if (trumpetMeter > 40) {
      progressText = "The trumpet grows louder";
    } else if (trumpetMeter > 20) {
      progressText = "The third day · stand back";
    } else {
      progressText = "Stand back and wait";
    }

    if (phase === "bounds" && stones.length < 6 && mouse.down && !customWonderState.placingLock) {
      const uiScale = window.BibleBowlScenes.uiScale ? window.BibleBowlScenes.uiScale(w) : 1;
      const snapR = Math.max(44, 38 * uiScale);
      let best = null;
      let bestDist = snapR;
      template.forEach((pt) => {
        const placed = stones.some((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < 10);
        if (placed) return;
        const d = Math.hypot(mouse.x - pt.x, mouse.y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          best = pt;
        }
      });
      if (best) {
        stones.push({ x: best.x, y: best.y });
        customWonderState.placingLock = true;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("thunder");
      }
    }
    if (!mouse.down) customWonderState.placingLock = false;
    if (phase === "bounds" && stones.length >= 6) {
      customWonderState.sinaiPhase = "wait";
    }

    if (phase === "wait" && boundsSet && (insideBounds || (onMountain && mouse.y < h * 0.76))) {
      customWonderState.warnCooldown = (customWonderState.warnCooldown || 0) - 1;
      if (customWonderState.warnCooldown <= 0) {
        customWonderState.warnCooldown = 50;
        customWonderState.warnFlash = 16;
        customWonderState.warnCount = (customWonderState.warnCount || 0) + 1;
        customWonderState.lightning = generateLightningPath(
          peakX, peakY - 16, mouse.x, mouse.y
        );
        customWonderState.lightningTime = 12;
        if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("thunder");
        for (let z = 0; z < 12; z++) {
          particles.push({
            x: mouse.x + (Math.random() - 0.5) * 20,
            y: mouse.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            r: Math.random() * 2.5 + 1,
            alpha: 1,
            type: "lightning_spark"
          });
        }
      }
    }
    if ((customWonderState.warnFlash || 0) > 0) customWonderState.warnFlash -= 1;

    if (phase === "wait" && inSafeZone && mouse.down) {
      customWonderState.trumpetMeter = trumpetMeter + 1.1;
    } else if (phase === "wait" && trumpetMeter > 0) {
      customWonderState.trumpetMeter = Math.max(0, trumpetMeter - 0.35);
    }
    if (phase === "wait" && (customWonderState.trumpetMeter || 0) > 80) {
      customWonderState.complete = true;
    }

    if (isNight) {
      if (Math.random() < 0.32) {
        particles.push({
          x: peakX + (Math.random() - 0.5) * 50,
          y: peakY - 6,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(Math.random() * 2.5 + 1.2),
          r: Math.random() * 3 + 1.5,
          alpha: 1,
          type: "ember"
        });
      }
    } else if (Math.random() < 0.22) {
      particles.push({
        x: peakX + (Math.random() - 0.5) * 60,
        y: peakY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(Math.random() * 0.8 + 0.3),
        r: Math.random() * 8 + 6,
        alpha: 0.55 + Math.random() * 0.25,
        type: "cloud_wisp"
      });
    }

    if (canvasTime % 140 === 0 && phase === "wait" && isNight) {
      customWonderState.lightning = generateLightningPath(
        peakX + (Math.random() - 0.5) * 50, 0, peakX, peakY - 8
      );
      customWonderState.lightningTime = 9;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "ember") {
        p.x += p.vx + Math.sin(canvasTime * 0.05 + p.y) * 0.15;
        p.y += p.vy;
        p.alpha -= 0.015;

        if (p.alpha <= 0 || p.y < 102) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 120, 30, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 240, 180, ${p.alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 1, p.r * 0.45, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === "cloud_wisp") {
        p.x += p.vx + Math.sin(canvasTime * 0.04 + p.y) * 0.2;
        p.y += p.vy;
        p.alpha -= 0.004;

        if (p.alpha <= 0 || p.y < 102) {
          particles.splice(i, 1);
          continue;
        }

        const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
        grad.addColorStop(0, `rgba(248, 252, 255, ${p.alpha})`);
        grad.addColorStop(0.55, `rgba(210, 220, 235, ${p.alpha * 0.55})`);
        grad.addColorStop(1, "rgba(200, 215, 230, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === "lightning_spark") {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(180, 220, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawBoundaryRingLayer(ctx, stones, peakX, peakY, h, "behind", boundsSet);
    if (isNight) {
      drawPillarOfFire(ctx, peakX, peakY, w, h, canvasTime, "behind");
    } else {
      drawPillarOfCloud(ctx, peakX, peakY, w, h, canvasTime);
    }
    drawSinaiMountain(ctx, w, h, peakX, peakY, baseW, isNight);
    if (isNight) {
      drawPillarOfFire(ctx, peakX, peakY, w, h, canvasTime, "front");
    }
    drawBoundaryRingLayer(ctx, stones, peakX, peakY, h, "front", boundsSet);

    if (phase === "bounds" && stones.length < 6) {
      const next = template[stones.length];
      if (next) {
        window.BibleBowlScenes.drawTapRing(ctx, next.x, next.y, 28, 20, canvasTime);
        ctx.fillStyle = "rgba(212, 160, 78, 0.75)";
        ctx.font = "700 11px Spectral, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(String(stones.length + 1), next.x, next.y - 22);
      }
      if (Math.hypot(mouse.x - (next?.x || 0), mouse.y - (next?.y || 0)) < 44) {
        window.BibleBowlScenes.drawTapRing(ctx, mouse.x, mouse.y, 22, 18, canvasTime);
      }
    } else if (phase === "wait" && inSafeZone) {
      window.BibleBowlScenes.drawTapRing(ctx, mouse.x, mouse.y, 26, 20, canvasTime);
    } else if (phase === "wait") {
      window.BibleBowlScenes.drawTapRing(ctx, w / 2, h * 0.9, w * 0.28, 14, canvasTime);
    }

    if ((customWonderState.warnFlash || 0) > 0) {
      ctx.fillStyle = `rgba(180, 40, 40, ${0.06 + customWonderState.warnFlash * 0.012})`;
      ctx.fillRect(0, 0, w, h);
    }

    drawSinaiLightning(ctx, w, h, customWonderState);

    // Caption/progress always on top — embers and lightning must not wash out the HUD
    window.BibleBowlScenes.drawCaption(ctx, w, caption);
    window.BibleBowlScenes.drawProgress(ctx, w, progressText);
    if (phase === "wait" && boundsSet) {
      // Move the Trumpet bar below the dark header band (which ends at y=98)
      // so the "Trumpet" label doesn't collide with the "Stand back and
      // wait" subtitle at y=48. h*0.22 puts the bar cleanly below the band.
      window.BibleBowlScenes.drawProgressBar(ctx, w, h * 0.22, trumpetMeter / 80, "Trumpet");
    }
  };

  function generateLightningPath(x1, y1, x2, y2) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 12;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;

    for (let i = 1; i < steps; i++) {
      const px = x1 + dx * i + (Math.random() - 0.5) * 45;
      const py = y1 + dy * i + (Math.random() - 0.5) * 15;
      pts.push({ x: px, y: py });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  // ---- Golden-calf judgment helpers: burn -> melt -> slab -> dust ----
  function drawCalfFirePit(ctx, cx, baseY, halfW, scale, t, intensity) {
    ctx.save();
    // Charred bed + crossed logs under the idol.
    ctx.fillStyle = "#1b130b";
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 5, halfW * 1.2, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2616";
    ctx.lineWidth = 4.5 * scale;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - halfW * 0.75, baseY + 3 + i * 3);
      ctx.lineTo(cx + halfW * 0.75, baseY + 3 - i * 3);
      ctx.stroke();
    }
    // Flames licking up around the idol.
    const flames = Math.round(5 + intensity * 4);
    for (let i = 0; i < flames; i++) {
      const fx = cx + (i / (flames - 1) - 0.5) * halfW * 1.8;
      const flick = Math.sin(t * 0.3 + i) * 0.5 + Math.sin(t * 0.17 + i * 2) * 0.5;
      const fh = (16 + intensity * 30 + flick * 7) * scale;
      const g = ctx.createLinearGradient(fx, baseY, fx, baseY - fh);
      g.addColorStop(0, "rgba(255, 120, 20, 0.95)");
      g.addColorStop(0.5, "rgba(255, 195, 60, 0.85)");
      g.addColorStop(1, "rgba(255, 240, 160, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx - 6 * scale, baseY);
      ctx.quadraticCurveTo(fx - 4 * scale, baseY - fh * 0.6, fx + flick * 4 * scale, baseY - fh);
      ctx.quadraticCurveTo(fx + 4 * scale, baseY - fh * 0.6, fx + 6 * scale, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMeltingCalf(ctx, cx, baseY, scale, melt, t) {
    // melt 0 -> recognizable glowing calf; melt 1 -> flat molten slab.
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);
    const sag = melt;
    const gold = ctx.createLinearGradient(0, -52, 0, 6);
    gold.addColorStop(0, "#fff1bb");
    gold.addColorStop(0.5, "#f6c733");
    gold.addColorStop(1, "#c8870c");
    ctx.shadowColor = "#ff7a18";
    ctx.shadowBlur = 12 + melt * 16;
    ctx.fillStyle = gold;
    const bodyW = 40 * (1 + sag * 0.7);
    const bodyH = 26 * (1 - sag * 0.82);
    const topY = -bodyH - 4;
    // Legs shrink into the body as it melts.
    const legH = 26 * (1 - sag);
    if (legH > 1.5) {
      [-26, -13, 13, 26].forEach((lx) => ctx.fillRect(lx - 4, -legH, 8, legH));
    }
    // Sagging body.
    ctx.beginPath();
    ctx.moveTo(-bodyW, 0);
    ctx.quadraticCurveTo(-bodyW, topY, 0, topY);
    ctx.quadraticCurveTo(bodyW, topY, bodyW, 0);
    ctx.closePath();
    ctx.fill();
    // Head + horns fade/sag as it loses shape.
    if (sag < 0.85) {
      ctx.globalAlpha = 1 - sag / 0.85;
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.82, topY * 0.7, 12, 11 * (1 - sag), -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3d2";
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.95, topY * 0.9);
      ctx.quadraticCurveTo(-bodyW * 1.12, topY * 1.35, -bodyW * 1.22, topY * 1.55);
      ctx.quadraticCurveTo(-bodyW * 1.0, topY * 1.2, -bodyW * 0.84, topY * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = gold;
    }
    // Molten pool spreading at the base.
    ctx.shadowBlur = 9;
    const pg = ctx.createLinearGradient(0, -6, 0, 7);
    pg.addColorStop(0, "#ffd05a");
    pg.addColorStop(1, "#d98a10");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 3, bodyW * (1 + sag * 0.4) + 6, 5 + sag * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Drips while actively melting.
    if (sag > 0.12 && sag < 0.96) {
      ctx.fillStyle = gold;
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * bodyW * 0.55;
        const dl = ((t * 0.6 + i * 13) % 16) * 0.4 * sag;
        ctx.beginPath();
        ctx.ellipse(dx, -1 + dl, 2.4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,${0.25 - melt * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(0, topY * 0.6, bodyW * 0.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGoldSlab(ctx, cx, baseY, scale, erode, t) {
    // The cooled slab, cracking and shrinking as it is ground (erode 0->1).
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);
    const halfW = 46 * (1 - erode * 0.55);
    const hH = 9 * (1 - erode * 0.6);
    const g = ctx.createLinearGradient(0, -hH, 0, hH);
    g.addColorStop(0, "#ffe79a");
    g.addColorStop(0.5, "#e6b32e");
    g.addColorStop(1, "#a8770c");
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-halfW, hH);
    ctx.lineTo(-halfW * 0.86, -hH);
    ctx.lineTo(halfW * 0.9, -hH * 0.8);
    ctx.lineTo(halfW, hH);
    ctx.closePath();
    ctx.fill();
    // Grinding cracks.
    if (erode > 0.1) {
      ctx.strokeStyle = `rgba(80,50,8,${0.3 + erode * 0.4})`;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const sx = -halfW * 0.7 + (i / 3) * halfW * 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, -hH);
        ctx.lineTo(sx + (Math.sin(i * 9) * 4), hH);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawDustMound(ctx, cx, baseY, scale, amount) {
    // A heap of gold dust (amount 0->1 grows the mound).
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);
    const halfW = 30 * (0.4 + amount * 0.7);
    const hH = 11 * amount;
    const g = ctx.createLinearGradient(0, -hH, 0, 2);
    g.addColorStop(0, "#f3d77a");
    g.addColorStop(1, "#b88a2a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-halfW, 2);
    ctx.quadraticCurveTo(-halfW * 0.4, -hH, 0, -hH);
    ctx.quadraticCurveTo(halfW * 0.5, -hH, halfW, 2);
    ctx.closePath();
    ctx.fill();
    // grain speckle
    ctx.fillStyle = "rgba(255,240,180,0.5)";
    for (let i = 0; i < 8; i++) {
      const gx = (i / 7 - 0.5) * halfW * 1.4;
      ctx.fillRect(gx, -hH * 0.5 - (i % 3), 1.2, 1.2);
    }
    ctx.restore();
  }

  function drawGrindStone(ctx, x, y, scale, pressing) {
    // A hand-held grinding stone the player rubs over the gold.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 9, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, -11, 0, 8);
    g.addColorStop(0, pressing ? "#b4b4b1" : "#9a9a98");
    g.addColorStop(0.5, "#6f6f6d");
    g.addColorStop(1, "#46463f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-16, 5);
    ctx.quadraticCurveTo(-17, -9, -4, -11);
    ctx.quadraticCurveTo(13, -13, 17, -2);
    ctx.quadraticCurveTo(18, 7, 6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.ellipse(-3, -5, 5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------- WONDER 7: GOLDEN CALF ----------------
  window.BibleBowlScenes.golden_calf = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const calf = customWonderState.calf;
    if (!calf) return;

    const scale = Math.min(w / 360, h / 260, 1.15);
    const phase = customWonderState.calfPhase || "witness";
    const fireCX = w / 2;
    const fireY = h * 0.84;
    const fireW = w * 0.28;
    const inFireZone = mouse.y > fireY - 28 && Math.abs(mouse.x - fireCX) < fireW;

    // ---- Staged judgment: witness -> burn -> grind -> throw -> drink ----
    const calfBaseY = calf.y + 48 * scale;          // ground line under the idol
    const waterY = h * 0.86;
    const meltAmount = Math.min(1, (customWonderState.burnProgress || 0) / 70);
    const grindAmount = Math.min(1, (customWonderState.grindProgress || 0) / 130);
    const px = mouse.px == null ? mouse.x : mouse.px;
    const py = mouse.py == null ? mouse.y : mouse.py;

    window.BibleBowlScenes.drawCaption(ctx, w, "Golden calf");
    let prompt;
    if (phase === "witness") prompt = "Tap the idol to cast it into the fire";
    else if (phase === "burn") prompt = meltAmount < 0.98 ? "Hold the fire — burn it down" : "Molten — a shapeless slab";
    else if (phase === "grind") prompt = grindAmount < 0.98 ? "Rub hard — grind it to powder" : "Drag the dust into the water";
    else if (phase === "throw") prompt = "Drag the gold dust into the water";
    else if (phase === "drink") prompt = "Communion with your god.";
    else prompt = "Communion with your god.";
    window.BibleBowlScenes.drawProgress(ctx, w, prompt);

    // Water — drawn behind the action once the dust needs a target.
    const waterShown = phase === "throw" || phase === "drink" || phase === "done" ||
      (phase === "grind" && grindAmount >= 0.98);
    if (waterShown) {
      const tint = customWonderState.dustInWater || (phase === "drink" || phase === "done" ? 1 : 0);
      const wg = ctx.createLinearGradient(0, waterY, 0, h);
      wg.addColorStop(0, `rgba(${Math.round(52 + tint * 150)}, ${Math.round(152 - tint * 40)}, ${Math.round(219 - tint * 140)}, ${0.34 + tint * 0.14})`);
      wg.addColorStop(1, `rgba(${Math.round(30 + tint * 120)}, ${Math.round(90 - tint * 20)}, ${Math.round(150 - tint * 100)}, 0.55)`);
      ctx.fillStyle = wg;
      ctx.fillRect(0, waterY, w, h - waterY);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      for (let r = 0; r < 3; r++) {
        const ry = waterY + 5 + r * 5;
        ctx.beginPath();
        ctx.moveTo(0, ry + Math.sin(canvasTime * 0.05 + r) * 1.5);
        ctx.lineTo(w, ry + Math.cos(canvasTime * 0.05 + r) * 1.5);
        ctx.stroke();
      }
    }

    // WITNESS: tap the idol to cast it into the fire (no shatter — it melts).
    const onCalf = Math.hypot(mouse.x - calf.x, mouse.y - calf.y) < Math.max(calf.w * 0.8, 64);
    if (phase === "witness" && mouse.down && !calf.broken && onCalf) {
      calf.broken = true;
      customWonderState.calfPhase = "burn";
      customWonderState.burnProgress = 0;
      if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("smite");
    }

    // BURN: a fire pit under the idol; hold to stoke; it melts down to a slab.
    if (phase === "burn") {
      const onPit = mouse.down && mouse.y > calfBaseY - 56 * scale && Math.abs(mouse.x - calf.x) < calf.w;
      customWonderState.burnProgress = (customWonderState.burnProgress || 0) + (onPit ? 1.0 : 0.2);
      // Fire bed behind the idol (the idol itself melts in the render pass below).
      drawCalfFirePit(ctx, calf.x, calfBaseY, calf.w * 0.95, scale, canvasTime, 0.4 + meltAmount * 0.6);
      window.BibleBowlScenes.drawProgressBar(ctx, w, calfBaseY - 70 * scale, meltAmount, "Burn");
      if (canvasTime % 3 === 0) {
        particles.push({ x: calf.x + (Math.random() - 0.5) * calf.w * 1.4, y: calfBaseY, vx: (Math.random() - 0.5) * 0.9, vy: -(Math.random() * 2.2 + 1), r: Math.random() * 2.5 + 1, alpha: 0.9, type: "ember" });
      }
      if (meltAmount >= 1) { customWonderState.calfPhase = "grind"; customWonderState.grindProgress = 0; }
    }

    // GRIND: rub the cooled slab roughly into a mound of gold dust.
    if (phase === "grind") {
      const onSlab = mouse.down && mouse.y > calfBaseY - 44 * scale && Math.abs(mouse.x - calf.x) < calf.w * 1.2;
      if (onSlab) {
        const d = Math.hypot(mouse.x - px, mouse.y - py);
        customWonderState.grindProgress = (customWonderState.grindProgress || 0) + Math.min(d, 14);
        if (canvasTime % 2 === 0 && d > 1) {
          particles.push({ x: mouse.x + (Math.random() - 0.5) * 18, y: calfBaseY - 2, vx: (Math.random() - 0.5) * 2.2, vy: -(Math.random() * 1.2 + 0.2), r: Math.random() * 1.6 + 0.8, alpha: 0.9, type: "golddust" });
        }
      }
      if (grindAmount < 1) drawGoldSlab(ctx, calf.x, calfBaseY, scale, grindAmount, canvasTime);
      drawDustMound(ctx, calf.x, calfBaseY, scale, grindAmount);
      // The grinding stone rides the gold — at the finger while rubbing,
      // otherwise resting on top of the slab.
      const stoneX = Math.max(calf.x - calf.w, Math.min(calf.x + calf.w, mouse.x));
      const stoneY = onSlab ? Math.min(calfBaseY - 7 * scale, mouse.y) : calfBaseY - 9 * scale;
      drawGrindStone(ctx, stoneX, stoneY, scale, onSlab);
      window.BibleBowlScenes.drawProgressBar(ctx, w, calfBaseY - 44 * scale, grindAmount, "Grind");
      if (grindAmount >= 1) customWonderState.calfPhase = "throw";
    }

    // THROW: drag the dust mound down into the water.
    if (phase === "throw") {
      // The mound shrinks as you carry it out; the water goldens as you spread.
      drawDustMound(ctx, calf.x, calfBaseY, scale, Math.max(0.15, 1 - (customWonderState.dustInWater || 0)));
      if (!customWonderState.throwing) {
        window.BibleBowlScenes.drawTapRing(ctx, calf.x, calfBaseY - 6 * scale, 26 * scale, 14 * scale, canvasTime);
      }
      const onMound = Math.abs(mouse.x - calf.x) < calf.w && Math.abs(mouse.y - calfBaseY) < 34 * scale;
      if (mouse.down && (onMound || customWonderState.throwing)) {
        customWonderState.throwing = true;
        if (mouse.y > waterY - 14) {
          // Spreading across the water: a golden bloom follows the finger and
          // the water goldens by how much surface you sweep — slow + satisfying.
          customWonderState.dustInWater = Math.min(1, (customWonderState.dustInWater || 0) + 0.012);
          for (let k = 0; k < 4; k++) {
            particles.push({ x: mouse.x + (Math.random() - 0.5) * 34, y: waterY + Math.random() * 10, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1, alpha: 0.95, type: "golddust" });
          }
          const bloom = ctx.createRadialGradient(mouse.x, waterY + 4, 1, mouse.x, waterY + 4, 34 * scale);
          bloom.addColorStop(0, "rgba(244,208,63,0.42)");
          bloom.addColorStop(1, "rgba(244,208,63,0)");
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(mouse.x, waterY + 4, 34 * scale, 0, Math.PI * 2);
          ctx.fill();
          if (customWonderState.dustInWater >= 1) customWonderState.calfPhase = "drink";
        } else if (canvasTime % 2 === 0) {
          // Carrying a trail of dust from the mound toward the water.
          particles.push({ x: mouse.x + (Math.random() - 0.5) * 12, y: mouse.y, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8 + 0.3, r: Math.random() * 2 + 1, alpha: 0.9, type: "golddust" });
        }
      }
      if (!mouse.down) customWonderState.throwing = false;
    }

    // DRINK: the bitter golden water — "drink the sin you asked for."
    if (phase === "drink") {
      ctx.fillStyle = "rgba(244,208,63,0.25)";
      for (let i = 0; i < 10; i++) {
        const dx = (i / 9) * w + Math.sin(canvasTime * 0.04 + i) * 6;
        ctx.beginPath();
        ctx.arc(dx, waterY + 8 + (i % 3) * 5, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (mouse.down && mouse.y > waterY - 14) {
        customWonderState.drinkProgress = (customWonderState.drinkProgress || 0) + 1;
        if (canvasTime % 3 === 0) {
          particles.push({ x: mouse.x, y: waterY, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.4, r: 1.5, alpha: 0.8, type: "golddust" });
        }
        if (customWonderState.drinkProgress > 30) { customWonderState.calfPhase = "done"; customWonderState.complete = true; }
      }
      window.BibleBowlScenes.drawProgressBar(ctx, w, waterY - 18, Math.min(1, (customWonderState.drinkProgress || 0) / 30), "Drink");
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "glitter") {
        if (phase === "witness" && !calf.broken) {
          p.angle += p.speed;
          const curX = calf.x + Math.cos(p.angle) * p.dist;
          const curY = calf.y + Math.sin(p.angle) * p.dist;
          const dm = Math.hypot(mouse.x - curX, mouse.y - curY);
          if (dm < 70) {
            p.dist += (dm - 70) * 0.1;
          } else {
            p.dist += ((Math.sin(canvasTime * 0.01) * 30 + 100) - p.dist) * 0.02;
          }

          const drawX = calf.x + Math.cos(p.angle) * p.dist;
          const drawY = calf.y + Math.sin(p.angle) * p.dist;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          p.type = "ash";
          p.vx = (Math.random() - 0.5) * 1.5;
          p.vy = Math.random() * 1.2 + 0.8;
          p.r = Math.random() * 3 + 1;
          p.alpha = 1;
        }
      } else if (p.type === "golden_shard") {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= 0.02;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(244, 208, 63, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === "ember") {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(255, 160, 50, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "ash") {
        p.x += p.vx + Math.sin(canvasTime * 0.02 + p.x) * 0.15;
        p.y += p.vy;
        p.alpha -= 0.006;

        if (p.alpha <= 0 || p.y > h) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(130, 130, 130, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "golddust") {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.alpha -= 0.02;
        if (p.alpha <= 0 || p.y > h) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(244, 208, 63, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (phase === "witness" || phase === "burn") {
      if (phase === "witness") {
        window.BibleBowlScenes.drawTapRing(ctx, calf.x, calf.y, 52 * scale, 38 * scale, canvasTime);
      }
      ctx.save();
      if (phase === "burn") {
        // Sink and squish the REAL idol toward the ground as it melts, so the
        // player literally watches the calf slump down into a flat slab.
        ctx.translate(calf.x, calfBaseY);
        ctx.scale(1 + meltAmount * 0.55, Math.max(0.06, 1 - meltAmount * 0.92));
        ctx.translate(-calf.x, -calfBaseY);
        ctx.globalAlpha = 1 - meltAmount * 0.15;
      }
      ctx.translate(calf.x, calf.y);
      ctx.scale(scale, scale);
      // --- Golden calf idol: side profile, facing left ---
      // A small CAST-gold bull statue on a stone pedestal, modeled with
      // light/shade so it reads as metal, not a flat cutout. Drawn in the
      // calf's local space (origin at the body center; +x right, +y down).
      // Draw order is back-to-front: far legs -> tail -> body -> near legs
      // -> dewlap -> head -> horns -> ears -> face -> highlights.
      const gold = ctx.createLinearGradient(0, -36, 0, 28);
      gold.addColorStop(0, "#fff1bb");
      gold.addColorStop(0.42, "#f6c733");
      gold.addColorStop(0.8, "#d9990f");
      gold.addColorStop(1, "#b67b07");
      const goldDark = "#9a6a0c";   // recessed / far side
      const goldDeep = "#7c5406";   // deepest shadow

      // Stone pedestal with a lit top lip and a base shadow.
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 9;
      ctx.fillStyle = "#6f421b";
      ctx.fillRect(-52, 42, 104, 14);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#8a5a28";
      ctx.fillRect(-52, 42, 104, 3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fillRect(-52, 52, 104, 4);

      // FAR pair of legs — darker and inset, sitting behind the body.
      ctx.shadowColor = "#e67e22";
      ctx.shadowBlur = 14;
      ctx.fillStyle = goldDark;
      [-19, 21].forEach((lx) => {
        ctx.beginPath();
        ctx.moveTo(lx - 4, 13);
        ctx.lineTo(lx + 4, 13);
        ctx.lineTo(lx + 3.5, 41);
        ctx.lineTo(lx - 3.5, 41);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = goldDeep;
      [-19, 21].forEach((lx) => ctx.fillRect(lx - 4, 39, 8, 3));

      // Tail draping behind the rump with a tuft.
      ctx.strokeStyle = goldDark;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(40, -6);
      ctx.quadraticCurveTo(54, 8, 47, 27);
      ctx.stroke();
      ctx.fillStyle = goldDeep;
      ctx.beginPath();
      ctx.ellipse(47, 29, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Torso: rounded back with a shoulder rise at the front and a haunch
      // at the rear (a stocky young bull, not a plain blob).
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(-30, -4);
      ctx.quadraticCurveTo(-34, -21, -13, -23);  // withers / shoulder hump
      ctx.quadraticCurveTo(13, -26, 33, -15);    // top line back to haunch
      ctx.quadraticCurveTo(47, -6, 42, 10);      // rounded rump
      ctx.quadraticCurveTo(39, 23, 21, 23);      // rear underbelly
      ctx.lineTo(-19, 23);                        // belly
      ctx.quadraticCurveTo(-35, 22, -34, 3);     // chest / brisket
      ctx.quadraticCurveTo(-33, -1, -30, -4);
      ctx.closePath();
      ctx.fill();

      // Modeling: underbelly shadow + a haunch crease so the torso has form.
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(118, 78, 8, 0.45)";
      ctx.beginPath();
      ctx.ellipse(2, 19, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(150, 100, 12, 0.30)";
      ctx.beginPath();
      ctx.ellipse(30, 4, 11, 13, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // NEAR pair of legs — brighter and wider, in front of the body.
      ctx.shadowColor = "#e67e22";
      ctx.shadowBlur = 12;
      ctx.fillStyle = gold;
      [-30, 31].forEach((lx) => {
        ctx.beginPath();
        ctx.moveTo(lx - 5, 12);
        ctx.lineTo(lx + 5, 12);
        ctx.lineTo(lx + 4, 42);
        ctx.lineTo(lx - 4, 42);
        ctx.closePath();
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9a6a12";
      [-30, 31].forEach((lx) => ctx.fillRect(lx - 4.5, 39, 9, 4));
      ctx.fillStyle = "rgba(255, 240, 180, 0.5)";
      [-30, 31].forEach((lx) => {
        ctx.beginPath();
        ctx.ellipse(lx - 1.5, 23, 1.4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Dewlap (loose throat skin) hanging under the neck.
      ctx.shadowColor = "#e67e22";
      ctx.shadowBlur = 13;
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(-30, -2);
      ctx.quadraticCurveTo(-45, 5, -47, 18);
      ctx.quadraticCurveTo(-40, 14, -33, 8);
      ctx.closePath();
      ctx.fill();

      // Neck + head (head juts down-left).
      ctx.beginPath();
      ctx.moveTo(-28, -8);
      ctx.quadraticCurveTo(-47, -16, -57, -7);   // neck up to the poll
      ctx.quadraticCurveTo(-66, 1, -64, 12);     // forehead down to muzzle
      ctx.quadraticCurveTo(-62, 22, -50, 21);    // muzzle front / chin
      ctx.quadraticCurveTo(-41, 19, -39, 8);     // jaw back up
      ctx.quadraticCurveTo(-37, -3, -28, -8);    // cheek back into neck
      ctx.closePath();
      ctx.fill();

      // Horns: two curved cones, each shading from a gold base to an ivory
      // tip. Far horn first (behind), then the brighter near horn.
      ctx.shadowBlur = 6;
      const farHorn = ctx.createLinearGradient(-55, -8, -74, -32);
      farHorn.addColorStop(0, "#b98f24");
      farHorn.addColorStop(1, "#fff3d2");
      ctx.fillStyle = farHorn;
      ctx.strokeStyle = "rgba(110, 82, 18, 0.55)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-53, -7);
      ctx.quadraticCurveTo(-66, -22, -74, -32);  // outer edge to tip
      ctx.quadraticCurveTo(-62, -22, -57, -9);   // inner edge back to head
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const nearHorn = ctx.createLinearGradient(-49, -8, -38, -37);
      nearHorn.addColorStop(0, "#caa12e");
      nearHorn.addColorStop(1, "#fff7dc");
      ctx.fillStyle = nearHorn;
      ctx.beginPath();
      ctx.moveTo(-51, -8);
      ctx.quadraticCurveTo(-50, -28, -38, -37);  // outer edge to tip
      ctx.quadraticCurveTo(-43, -24, -45, -9);   // inner edge back to head
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ears: far ear darker, near ear lit, with an inner-ear shadow.
      ctx.shadowBlur = 11;
      ctx.fillStyle = goldDark;
      ctx.beginPath();
      ctx.ellipse(-40, -14, 6, 10, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.ellipse(-50, -15, 5.5, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = goldDeep;
      ctx.beginPath();
      ctx.ellipse(-50, -14, 2.4, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Forelock: a little curl of hair between the horns.
      ctx.strokeStyle = "#e0b53a";
      ctx.lineWidth = 2.3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-55, -9);
      ctx.quadraticCurveTo(-50, -3, -56, 0);
      ctx.moveTo(-52, -10);
      ctx.quadraticCurveTo(-47, -4, -53, -1);
      ctx.stroke();

      // Muzzle: a shaded nose plane, mouth line, and nostril.
      ctx.fillStyle = "#dca31a";
      ctx.beginPath();
      ctx.ellipse(-58, 15, 7.5, 6.5, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = goldDeep;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-63, 14);
      ctx.quadraticCurveTo(-60, 20, -52, 20);
      ctx.stroke();
      ctx.fillStyle = "#3a2606";
      ctx.beginPath();
      ctx.arc(-61, 13, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye with a catchlight.
      ctx.fillStyle = "#3a2606";
      ctx.beginPath();
      ctx.arc(-49, 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.arc(-49.8, 0.2, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Sheen blob + a bright rim light running along the back line.
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.beginPath();
      ctx.ellipse(6, -12, 18, 5, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 244, 200, 0.55)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, -23);
      ctx.quadraticCurveTo(13, -26, 33, -15);
      ctx.stroke();
      ctx.restore();
      if (phase === "burn") {
        // Molten heat tint over the slumping idol.
        ctx.save();
        ctx.globalAlpha = 0.22 + meltAmount * 0.32;
        ctx.fillStyle = "#ff8a1e";
        ctx.beginPath();
        ctx.ellipse(calf.x, calfBaseY - 12 * scale * (1 - meltAmount), calf.w * (0.5 + meltAmount * 0.5), (24 * (1 - meltAmount) + 7) * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // A molten pool that spreads and becomes the cooled slab.
        const poolW = (26 + meltAmount * 28) * scale;
        const pg = ctx.createLinearGradient(0, calfBaseY - 6 * scale, 0, calfBaseY + 6 * scale);
        pg.addColorStop(0, "#ffe79a");
        pg.addColorStop(0.5, "#f3c233");
        pg.addColorStop(1, "#b9830c");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(calf.x, calfBaseY + 2 * scale, poolW, (3 + meltAmount * 5) * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        // Flames licking up in FRONT of the melting idol.
        drawCalfFirePit(ctx, calf.x, calfBaseY, calf.w * 0.6, scale, canvasTime + 11, 0.4 + meltAmount * 0.5);
      }
    }
  };

  // ---------------- WONDER 8: GLORY ----------------
  window.BibleBowlScenes.glory = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const tabernacle = customWonderState.tabernacle;
    if (!tabernacle) return;

    const tabCX = tabernacle.x;
    const tabCY = tabernacle.y - 20;
    const insideTabernacle = Math.hypot(mouse.x - tabCX, mouse.y - tabCY) < tabernacle.w * 0.38;
    const witnessing = !insideTabernacle && mouse.y > tabernacle.y - 10;
    const isComplete = !!customWonderState.complete;

    if (isComplete && customWonderState.epilogueTimer == null) {
      customWonderState.epilogueTimer = 120;
    }
    if (isComplete && customWonderState.epilogueTimer > 0) {
      customWonderState.epilogueTimer -= 1;
    }

    let progressText;
    if (isComplete) {
      const ep = customWonderState.epilogueTimer || 0;
      if (ep > 90) progressText = "Moses could not enter";
      else if (ep > 45) progressText = "Cloud by day · Fire by night";
      else progressText = "When the cloud lifted, Israel journeyed";
    } else if (insideTabernacle) {
      progressText = "Do not enter";
    } else if (witnessing) {
      progressText = "Behold outside";
    } else {
      progressText = "Stand below the tent";
    }

    window.BibleBowlScenes.drawCaption(ctx, w, "Glory fills tabernacle");
    window.BibleBowlScenes.drawProgress(ctx, w, progressText);

    if (insideTabernacle) {
      customWonderState.witnessHold = 0;
    } else if (witnessing && mouse.down && !isComplete) {
      customWonderState.witnessHold = (customWonderState.witnessHold || 0) + 2;
    } else {
      customWonderState.witnessHold = Math.max(0, (customWonderState.witnessHold || 0) - 1);
    }
    if (!insideTabernacle && witnessing && (customWonderState.witnessHold || 0) > 35) {
      customWonderState.complete = true;
    }

    const dx = mouse.x - tabernacle.x;
    const dy = mouse.y - tabernacle.y;
    const baseAngle = Math.atan2(dy, dx);

    const gradient = ctx.createLinearGradient(tabernacle.x, 0, tabernacle.x, h);
    gradient.addColorStop(0, "rgba(255, 243, 205, 0.4)");
    gradient.addColorStop(0.5, "rgba(243, 156, 18, 0.15)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(tabernacle.x - 70, 0);
    ctx.lineTo(tabernacle.x + 70, 0);
    ctx.lineTo(tabernacle.x + 130, h);
    ctx.lineTo(tabernacle.x - 130, h);
    ctx.closePath();
    ctx.fill();

    const numRays = 7;
    for (let r = 0; r < numRays; r++) {
      const angle = baseAngle + (r * (Math.PI * 2 / numRays)) + canvasTime * 0.003;
      const rayW = 0.15;
      
      ctx.fillStyle = "rgba(254, 219, 134, 0.035)";
      ctx.beginPath();
      ctx.moveTo(tabernacle.x, tabernacle.y - 40);
      ctx.lineTo(tabernacle.x + Math.cos(angle - rayW) * w * 1.2, tabernacle.y - 40 + Math.sin(angle - rayW) * w * 1.2);
      ctx.lineTo(tabernacle.x + Math.cos(angle + rayW) * w * 1.2, tabernacle.y - 40 + Math.sin(angle + rayW) * w * 1.2);
      ctx.closePath();
      ctx.fill();
    }

    if (Math.random() < 0.25) {
      particles.push({
        x: tabernacle.x + (Math.random() - 0.5) * 40,
        y: tabernacle.y - 45 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 1.6,
        r: Math.random() * 3 + 1,
        alpha: 1,
        type: "gold_spark"
      });
    }

    if (witnessing && mouse.down && !customWonderState.rippling && !isComplete) {
      customWonderState.rippling = true;
      customWonderState.ripples.push({
        x: mouse.x,
        y: mouse.y,
        radius: 5,
        alpha: 1
      });
      if (typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound("glory");
      }
    }
    if (!mouse.down) customWonderState.rippling = false;

    if (insideTabernacle) {
      ctx.fillStyle = "rgba(255, 200, 80, 0.12)";
      ctx.fillRect(0, 0, w, h);
      window.BibleBowlScenes.drawTapRing(ctx, tabCX, tabCY, tabernacle.w * 0.42, 28, canvasTime);
    } else if (!witnessing) {
      window.BibleBowlScenes.drawTapRing(ctx, w / 2, h * 0.88, w * 0.3, 16, canvasTime);
    }

    for (let idx = customWonderState.ripples.length - 1; idx >= 0; idx--) {
      const rp = customWonderState.ripples[idx];
      rp.radius += 8;
      rp.alpha -= 0.015;

      if (rp.alpha <= 0) {
        customWonderState.ripples.splice(idx, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(235, 150, 50, ${rp.alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(100, 200, 255, ${rp.alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.radius - 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.012;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(tabernacle.x, tabernacle.y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.strokeStyle = "rgba(212, 160, 78, 0.4)";
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(-tabernacle.w / 2, 80);
    ctx.lineTo(-tabernacle.w / 2, -10);
    ctx.lineTo(0, -tabernacle.h * 0.45);
    ctx.lineTo(tabernacle.w / 2, -10);
    ctx.lineTo(tabernacle.w / 2, 80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(212, 160, 78, 0.25)";
    ctx.strokeRect(-tabernacle.w * 0.25, -5, 10, 85);
    ctx.strokeRect(tabernacle.w * 0.25 - 10, -5, 10, 85);

    const gloryRad = 35 + Math.sin(canvasTime * 0.08) * 5;
    const radial = ctx.createRadialGradient(0, -40, 2, 0, -40, gloryRad);
    radial.addColorStop(0, "#ffffff");
    radial.addColorStop(0.3, "#fbe39f");
    radial.addColorStop(0.8, "rgba(243, 156, 18, 0.3)");
    radial.addColorStop(1, "rgba(243, 156, 18, 0)");
    
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(0, -40, gloryRad, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  };

  const baseSetupParticles = window.BibleBowlScenes.setupParticles;
  window.BibleBowlScenes.setupParticles = function (id, w, h, particles, customWonderState) {
    if (typeof baseSetupParticles === "function") {
      baseSetupParticles(id, w, h, particles, customWonderState);
    }

    if (id === "rephidim") {
      customWonderState.rock = {
        x: w * 0.5,
        y: h * 0.88,
        w: Math.min(w * 0.42, 160),
        h: Math.min(h * 0.46, 125),
        cracked: false,
        struck: false
      };
      customWonderState.striking = false;
      customWonderState.prevStaffX = null;
      customWonderState.prevStaffY = null;
      customWonderState.softHitFlash = null;
    } else if (id === "golden_calf") {
      customWonderState.calf = {
        x: w * 0.5,
        y: h * 0.58,
        w: Math.min(w * 0.34, 110),
        broken: false
      };
      customWonderState.calfPhase = "witness";
      customWonderState.burnProgress = 0;
      customWonderState.grindProgress = 0;
      customWonderState.waterScatter = 0;
      for (let i = 0; i < 80; i++) {
        particles.push({
          angle: Math.random() * Math.PI * 2,
          dist: Math.random() * 80 + 60,
          speed: Math.random() * 0.02 + 0.005,
          r: Math.random() * 2.5 + 1,
          color: `rgba(241, 196, 15, ${Math.random() * 0.5 + 0.3})`,
          type: "glitter"
        });
      }
    } else if (id === "glory") {
      customWonderState.tabernacle = {
        x: w * 0.5,
        y: h * 0.68,
        w: Math.min(w * 0.42, 150),
        h: Math.min(h * 0.35, 100)
      };
      customWonderState.ripples = [];
      customWonderState.rippling = false;
      customWonderState.witnessHold = 0;
      customWonderState.epilogueTimer = null;
    } else if (id === "sinai") {
      if (!customWonderState.mode) customWonderState.mode = "night";
      customWonderState.sinaiPhase = "bounds";
      customWonderState.boundaryStones = [];
      customWonderState.boundaryTemplate = computeSinaiBoundaryRing(w, h);
      customWonderState.trumpetMeter = 0;
      customWonderState.warnCount = 0;
      customWonderState.warnFlash = 0;
      customWonderState.warnCooldown = 0;
      customWonderState.placingLock = false;
      customWonderState.lightning = null;
      customWonderState.lightningTime = 0;
    }
  };

})();
