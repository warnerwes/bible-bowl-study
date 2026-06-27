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

    window.BibleBowlScenes.drawCaption(ctx, w, "Strike the rock at Horeb");
    window.BibleBowlScenes.drawProgress(ctx, w,
      rock.struck ? "Water from the rock" : "Smite the rock once with the staff");

    ctx.fillStyle = "#1a1510";
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = "rgba(212, 160, 78, 0.08)";
    ctx.fillRect(0, groundY - 8, w, 8);

    if (mouse.down && !customWonderState.striking && !rock.struck) {
      customWonderState.striking = true;
      const d = Math.hypot(staffX - rockCenterX, staffY - rockCenterY);
      if (d < Math.max(rock.w * 0.55, 48)) {
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

    ctx.save();
    ctx.translate(staffX, staffY);
    ctx.rotate(-0.4);
    ctx.fillStyle = "#8a6d3b";
    ctx.fillRect(-3, -staffLen, 6, staffLen * 2);
    ctx.beginPath();
    ctx.arc(0, -staffLen, 9, Math.PI, Math.PI * 2.2);
    ctx.strokeStyle = "#8a6d3b";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  };

  // ---------------- WONDER 6: SINAI ----------------
  window.BibleBowlScenes.sinai = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const isNight = customWonderState.mode === "night";
    const peakX = w / 2;
    const peakY = h * 0.62;
    const baseW = w * 0.78;

    window.BibleBowlScenes.drawCaption(ctx, w, isNight ? "Sinai in fire and smoke" : "Sinai in cloud and thunder");

    if (Math.random() < (isNight ? 0.3 : 0.1)) {
      particles.push({
        x: peakX + (Math.random() - 0.5) * 80,
        y: peakY - 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 2 - 1,
        r: Math.random() * 3 + 1.5,
        alpha: 1,
        type: "ember"
      });
    }

    if (mouse.down && !customWonderState.lightningActive) {
      customWonderState.lightningActive = true;
      customWonderState.lightning = generateLightningPath(Math.random() * w, 0, mouse.x, mouse.y);
      customWonderState.lightningTime = 12;

      if (typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound("thunder");
      }

      for (let s = 0; s < 25; s++) {
        particles.push({
          x: mouse.x,
          y: mouse.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          r: Math.random() * 2.5 + 1,
          alpha: 1,
          type: "lightning_spark"
        });
      }
    }
    if (!mouse.down) {
      customWonderState.lightningActive = false;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "ember") {
        p.x += p.vx + Math.sin(canvasTime * 0.05 + p.y) * 0.15;
        p.y += p.vy;
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = isNight 
          ? `rgba(230, 126, 34, ${p.alpha})`
          : `rgba(243, 156, 18, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
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

    if (customWonderState.lightning && customWonderState.lightningTime > 0) {
      customWonderState.lightningTime--;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${customWonderState.lightningTime * 0.05})`;
      ctx.fillRect(0, 0, w, h);

      const customWonderTime = customWonderState.lightningTime;
      ctx.strokeStyle = `rgba(220, 240, 255, ${customWonderTime / 12})`;
      ctx.shadowColor = "#66aaff";
      ctx.shadowBlur = 15;
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

    ctx.fillStyle = isNight ? "#120b1f" : "#1a1f28";
    ctx.beginPath();
    ctx.moveTo(peakX - baseW / 2, h);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(peakX + baseW / 2, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isNight ? "#090412" : "#11141b";
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX + baseW * 0.05, h * 0.85);
    ctx.lineTo(peakX - baseW * 0.05, h * 0.75);
    ctx.lineTo(peakX + baseW * 0.1, h);
    ctx.lineTo(peakX + baseW / 2, h);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.fillStyle = isNight ? "rgba(74, 52, 94, 0.25)" : "rgba(100, 110, 120, 0.4)";
    ctx.beginPath();
    ctx.arc(peakX, peakY - 15, 50, 0, Math.PI * 2);
    ctx.arc(peakX - 42, peakY - 10, 42, 0, Math.PI * 2);
    ctx.arc(peakX + 42, peakY - 10, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!customWonderState.lightningActive) {
      window.BibleBowlScenes.drawTapRing(ctx, peakX, peakY + 10, baseW * 0.18, h * 0.12, canvasTime);
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
    window.BibleBowlScenes.drawCaption(ctx, w, "The golden calf · tap to break it");

    if (mouse.down && !calf.broken) {
      const d = Math.hypot(mouse.x - calf.x, mouse.y - calf.y);
      if (d < Math.max(calf.w * 0.55, 42)) {
        calf.broken = true;
        if (typeof window.BibleBowlPlaySound === "function") {
          window.BibleBowlPlaySound("shatter");
        }
        for (let idx=0; idx<40; idx++) {
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
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "glitter") {
        if (!calf.broken) {
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

    if (!calf.broken) {
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

    window.BibleBowlScenes.drawCaption(ctx, w, "Glory fills the tabernacle");

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

    if (mouse.down && !customWonderState.rippling) {
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
    if (!mouse.down) {
      customWonderState.rippling = false;
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
    } else if (id === "sinai") {
      if (!customWonderState.mode) customWonderState.mode = "night";
      customWonderState.lightningActive = false;
      customWonderState.lightning = null;
      customWonderState.lightningTime = 0;
    }
  };

})();
