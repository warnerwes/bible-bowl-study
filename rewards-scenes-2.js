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

    window.BibleBowlScenes.drawCaption(ctx, w, "Massah · Meribah");
    window.BibleBowlScenes.drawProgress(ctx, w,
      rock.struck
        ? "Here the rock was struck once"
        : canvasTime < 80
          ? "They tested the Lord"
          : "Tap rock once with staff");

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

    if (mouse.down && !rock.struck && onRock) {
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
    ctx.translate(rock.x, rock.y);
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
    // not cross its face. Side stones use small t values (close to base,
    // far from peak) so they sit in the lower portion of the canvas and
    // the dashed segments between them don't cut across the mountain.
    return [
      { x: m.leftBase.x - margin, y: h - margin },
      outwardBoundaryPoint(m.leftBase, m.peak, 0.05, margin, w, h),
      outwardBoundaryPoint(m.leftBase, m.peak, 0.18, margin, w, h),
      outwardBoundaryPoint(m.rightBase, m.peak, 0.18, margin, w, h),
      outwardBoundaryPoint(m.rightBase, m.peak, 0.05, margin, w, h),
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
      window.BibleBowlScenes.drawProgressBar(ctx, w, h * 0.12, trumpetMeter / 80, "Trumpet");
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

    window.BibleBowlScenes.drawCaption(ctx, w, "Golden calf");
    window.BibleBowlScenes.drawProgress(ctx, w,
      phase === "witness" ? "False worship below Sinai"
        : phase === "burn" ? "Burn the idol in the fire"
        : phase === "grind" ? "Rub to grind powder"
        : phase === "water" ? "Tap water to scatter"
        : "The people face their sin");

    const onCalf = Math.hypot(mouse.x - calf.x, mouse.y - calf.y) < Math.max(calf.w * 0.72, 58);
    if (phase === "witness" && mouse.down && !calf.broken && onCalf) {
      calf.broken = true;
      customWonderState.calfPhase = "burn";
      if (typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound("shatter");
      }
      for (let idx = 0; idx < 40; idx++) {
        particles.push({
          x: calf.x,
          y: calf.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          r: Math.random() * 5 + 3,
          alpha: 1,
          type: "golden_shard"
        });
      }
    }

    if (phase === "burn") {
      if (mouse.down && inFireZone) {
        customWonderState.burnProgress = (customWonderState.burnProgress || 0) + 1.4;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.type !== "golden_shard") continue;
        const nearFire = Math.hypot(p.x - fireCX, p.y - fireY) < fireW + 20;
        if (mouse.down && Math.hypot(mouse.x - p.x, mouse.y - p.y) < p.r + 12) {
          p.x += (mouse.x - p.x) * 0.25;
          p.y += (mouse.y - p.y) * 0.25;
        } else if (nearFire) {
          p.x += (fireCX - p.x) * 0.04;
          p.y += (fireY - p.y) * 0.06;
          p.alpha -= 0.015;
        }
        if (nearFire && inFireZone) p.alpha -= 0.025;
      }
      if ((customWonderState.burnProgress || 0) > 60) {
        customWonderState.calfPhase = "grind";
      }
    }

    if (phase === "grind" && mouse.down) {
      customWonderState.grindProgress = (customWonderState.grindProgress || 0) +
        Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      if (canvasTime % 3 === 0) {
        particles.push({
          x: mouse.x, y: mouse.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 0.8,
          r: 1.5, alpha: 0.9, type: "ash"
        });
      }
      if (customWonderState.grindProgress > 90) {
        customWonderState.calfPhase = "water";
      }
    }

    if (phase === "grind") {
      const gp = Math.min(1, (customWonderState.grindProgress || 0) / 90);
      ctx.fillStyle = `rgba(180, 160, 90, ${0.15 + gp * 0.25})`;
      ctx.fillRect(calf.x - 60 * scale, calf.y + 20 * scale, 120 * scale, 24 * scale);
    }

    if (phase === "burn") {
      const bp = Math.min(1, (customWonderState.burnProgress || 0) / 60);
      ctx.fillStyle = "#3d2a1a";
      ctx.fillRect(fireCX - fireW, fireY, fireW * 2, h - fireY);
      const fireGrad = ctx.createRadialGradient(fireCX, fireY + 8, 4, fireCX, fireY, fireW);
      fireGrad.addColorStop(0, `rgba(255, 220, 80, ${0.5 + bp * 0.4})`);
      fireGrad.addColorStop(0.5, `rgba(230, 80, 20, ${0.35 + bp * 0.35})`);
      fireGrad.addColorStop(1, "rgba(180, 40, 10, 0)");
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.ellipse(fireCX, fireY + 10, fireW, 22 + bp * 10, 0, 0, Math.PI * 2);
      ctx.fill();
      window.BibleBowlScenes.drawProgressBar(ctx, w, fireY - 18, bp, "Burn");
      if (canvasTime % 4 === 0) {
        particles.push({
          x: fireCX + (Math.random() - 0.5) * fireW,
          y: fireY + Math.random() * 8,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 2 - 0.5,
          r: Math.random() * 3 + 1,
          alpha: 0.9,
          type: "ember"
        });
      }
    }

    const waterY = h * 0.86;
    if (phase === "water" || phase === "done") {
      ctx.fillStyle = "rgba(52, 152, 219, 0.28)";
      ctx.fillRect(0, waterY, w, h - waterY);
      if (phase === "water") {
        ctx.fillStyle = "rgba(236,230,216,0.6)";
        ctx.font = "500 9px Spectral, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("Scatter ash on the water", w / 2, waterY + 16);
      }
    }
    if (phase === "water" && mouse.down && mouse.y > waterY - 12) {
      customWonderState.waterScatter = (customWonderState.waterScatter || 0) + 1;
      if (canvasTime % 4 === 0) {
        particles.push({
          x: mouse.x, y: waterY,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 0.5,
          r: 2, alpha: 0.8, type: "ash"
        });
      }
      if (customWonderState.waterScatter > 35) {
        customWonderState.calfPhase = "done";
        customWonderState.complete = true;
      }
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
      }
    }

    if (phase === "witness" && !calf.broken) {
      window.BibleBowlScenes.drawTapRing(ctx, calf.x, calf.y, 52 * scale, 38 * scale, canvasTime);
      ctx.save();
      ctx.translate(calf.x, calf.y);
      ctx.scale(scale, scale);
      ctx.shadowColor = "#e67e22";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath();
      ctx.ellipse(0, 5, 45, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-35, 5);
      ctx.lineTo(-58, -12);
      ctx.lineTo(-45, -25);
      ctx.lineTo(-30, -5);
      ctx.closePath();
      ctx.fill();

      ctx.fillRect(-28, 15, 10, 30);
      ctx.fillRect(18, 15, 10, 30);

      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-55, -28, 12, 0, Math.PI * 0.5, true);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(40, -5);
      ctx.quadraticCurveTo(55, 10, 48, 28);
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#d35400";
      ctx.fillRect(-55, 42, 110, 12);
      ctx.restore();
    } else {
      ctx.fillStyle = "#5e4b3c";
      ctx.fillRect(calf.x - 45 * scale, calf.y + 42 * scale, 90 * scale, 8);
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
