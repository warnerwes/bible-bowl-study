/* Bible Bowl Study — Wonders of the Exodus (Scenes 1-4)
   Contains particle setup and rendering for Red Sea, Marah, Elim, and Manna. */

(() => {
  "use strict";

  window.BibleBowlScenes = window.BibleBowlScenes || {};

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
      // Stagnant green water particles
      for (let i = 0; i < 180; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 6 + 2,
          type: "bitter",
          baseColor: { h: Math.random() * 40 + 75, s: 40, l: 30 }
        });
      }
      customWonderState.sweetened = false;
      customWonderState.rippleRadius = 0;
    } else if (id === "elim") {
      // Springs setup
      customWonderState.springs = [];
      const numSprings = 12;
      const step = w / (numSprings + 1);
      for (let i = 1; i <= numSprings; i++) {
        customWonderState.springs.push({
          x: step * i,
          y: h - 30,
          strength: 1
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
    // Draw sand road in center
    ctx.fillStyle = "rgba(212, 160, 78, 0.05)";
    ctx.fillRect(w * 0.28, 0, w * 0.44, h);

    // Draw footprints/dust if mouse is down or dragging in center
    if (mouse.x > w * 0.28 && mouse.x < w * 0.72) {
      if (mouse.x !== mouse.px || mouse.y !== mouse.py) {
        particles.push({
          x: mouse.x + (Math.random() - 0.5) * 15,
          y: mouse.y + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -Math.random() * 0.5,
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

        if (canvasTime % 18 === 0 && Math.random() > 0.6) {
          if (typeof window.BibleBowlPlaySound === "function") {
            window.BibleBowlPlaySound("water");
          }
        }
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
    const branchX = mouse.x;
    const branchY = mouse.y;

    if (!customWonderState.sweetened && branchY > h * 0.45 && mouse.down) {
      customWonderState.sweetened = true;
      customWonderState.rippleRadius = 10;
      customWonderState.rippleX = branchX;
      customWonderState.rippleY = branchY;
      if (typeof window.BibleBowlPlaySound === "function") {
        window.BibleBowlPlaySound("water");
      }
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
    ctx.rotate(0.3);
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(-25, -4, 50, 8);
    ctx.fillStyle = "#27ae60";
    ctx.beginPath();
    ctx.arc(15, -6, 8, 0, Math.PI * 2);
    ctx.arc(-15, -6, 7, 0, Math.PI * 2);
    ctx.arc(0, 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // ---------------- WONDER 3: ELIM ----------------
  window.BibleBowlScenes.elim = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    const springs = customWonderState.springs || [];

    ctx.fillStyle = "#1e291e";
    ctx.fillRect(0, h - 35, w, 35);

    springs.forEach((sp) => {
      const isNearMouse = Math.abs(mouse.x - sp.x) < 50;
      sp.strength = isNearMouse ? 2.5 : 1;

      if (Math.random() < 0.3 * sp.strength) {
        particles.push({
          x: sp.x + (Math.random() - 0.5) * 6,
          y: sp.y,
          vx: (Math.random() - 0.5) * 1.2 * sp.strength,
          vy: -(Math.random() * 5 + 3) * sp.strength,
          r: Math.random() * 3 + 1.5,
          alpha: 1,
          type: "spring_drop"
        });
      }

      if (isNearMouse && Math.random() > 0.96) {
        if (typeof window.BibleBowlPlaySound === "function") {
          window.BibleBowlPlaySound("water");
        }
      }

      ctx.fillStyle = "#5fae86";
      ctx.beginPath();
      ctx.arc(sp.x, sp.y + 5, 8, 0, Math.PI, true);
      ctx.fill();
    });

    ctx.fillStyle = "#0c140e";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.quadraticCurveTo(w * 0.08, h * 0.7, w * 0.08, h * 0.3);
    ctx.lineTo(w * 0.09, h * 0.3);
    ctx.quadraticCurveTo(w * 0.09, h * 0.7, w * 0.02, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.quadraticCurveTo(w * 0.92, h * 0.7, w * 0.92, h * 0.3);
    ctx.lineTo(w * 0.91, h * 0.3);
    ctx.quadraticCurveTo(w * 0.91, h * 0.7, w * 0.98, h);
    ctx.closePath();
    ctx.fill();

    const hoverLeftTree = mouse.x < w * 0.22 && mouse.y < h * 0.45;
    const hoverRightTree = mouse.x > w * 0.78 && mouse.y < h * 0.45;

    if (hoverLeftTree && Math.random() > 0.85) {
      particles.push({
        x: Math.random() * (w * 0.22),
        y: h * 0.25 + (Math.random() - 0.5) * 30,
        vx: Math.random() * 0.5,
        vy: Math.random() * 0.5 + 0.5,
        r: Math.random() * 3 + 4,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        type: "leaf"
      });
    }

    if (hoverRightTree && Math.random() > 0.85) {
      particles.push({
        x: w - Math.random() * (w * 0.22),
        y: h * 0.25 + (Math.random() - 0.5) * 30,
        vx: -Math.random() * 0.5,
        vy: Math.random() * 0.5 + 0.5,
        r: Math.random() * 3 + 4,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        type: "leaf"
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.type === "spring_drop") {
        p.vy += 0.15;
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.y > h - 35 && p.vy > 0) {
          p.y = h - 35;
          p.vy = -p.vy * 0.3;
          p.alpha -= 0.2;
        }

        if (p.alpha <= 0 || p.x < 0 || p.x > w) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(106, 185, 224, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === "leaf") {
        p.x += p.vx + Math.sin(canvasTime * 0.02 + p.y) * 0.2;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        if (p.y > h - 35) {
          p.vy = 0;
          p.vx = 0;
          p.rotSpeed = 0;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = "rgba(46, 125, 50, 0.75)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.y > h - 35) {
          p.r -= 0.015;
          if (p.r <= 0) particles.splice(i, 1);
        }
      }
    }
  };

  // ---------------- WONDER 4: MANNA ----------------
  window.BibleBowlScenes.manna = (w, h, ctx, canvasTime, mouse, particles, customWonderState) => {
    if (Math.random() < 0.15) {
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

        if (mouse.down && dist < 120) {
          const force = (120 - dist) / 120;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * 0.3;
          p.vy += Math.sin(angle) * force * 0.3;

          if (dist < 15) {
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
            if (typeof window.BibleBowlPlaySound === "function") {
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
