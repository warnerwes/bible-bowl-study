/* Bible Bowl Study — Memory Labs Tabernacle spatial engine
 *
 * "Place the Holy Things." A 2D map of the tabernacle courtyard where the
 * student drags 8 holy items (Ark, Veil, Table, Lampstand, Golden Altar,
 * Laver, Bronze Altar, East Entrance) onto their correct drop zones.
 *
 * Design decisions baked in (see docs/plan-tabernacle-spatial-minigame.md
 * and docs/review-tabernacle-spatial-skeptic.md):
 *   - 8 zones, not 9 (Court + Gate collapsed to "East Entrance")
 *   - Nested zones via DOM hierarchy with `data-parent-zone` walk
 *   - Soft snap: drop anywhere in parent zone counts as nested zone
 *   - Per-card failure hints via failureHintFor() function
 *   - Keyboard nav: Tab = next chip, Enter = place in highlighted zone,
 *     arrow keys move zone highlight, Esc = cancel
 *   - Orientation change aborts an in-progress drag (no misrouted chips)
 *   - Reduced motion: ghost-follow is `transform` based, honored
 *   - Compass cues: numbered pairs (① ② ③) + wall labels
 *     ("North (Left Wall)" / "South (Right Wall)") — no compass literacy req
 *   - Reuses pointer primitives from BibleBowlLabDrag (this file is
 *     intentionally self-contained for clarity; drag-lab primitives are
 *     not externally exposed)
 */

(() => {
  "use strict";

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let active = null;

  // Per-card failure hints. Keyed by card id; the message names the
  // specific card and where it belongs, not a one-line east-west axiom.
  // See docs/review-tabernacle-spatial-skeptic.md §1g.
  function failureHintFor(cardId, expectedZoneId) {
    const hints = {
      ark:
        "The Ark belongs in the Most Holy Place, behind the veil — God's presence rests over the mercy seat (Ex 40:3, 21).",
      veil:
        "The Veil separates the Most Holy Place from the Holy Place — drape, not place (Ex 40:21).",
      table:
        "The Table of Showbread stands in the Holy Place, on the NORTH side (Ex 40:22-23).",
      lampstand:
        "The Lampstand stands in the Holy Place, on the SOUTH side, opposite the table (Ex 40:24-25).",
      golden_altar:
        "The Golden Altar of Incense stands in the Holy Place, BEFORE the veil (Ex 40:26-27).",
      laver:
        "The Laver sits BETWEEN the tabernacle of witness and the altar — a washing station before approach (Ex 40:30; OSB Ex 30:18).",
      bronze_altar:
        "The Bronze Altar stands OUTSIDE the tabernacle, by the doors of the entrance (Ex 40:29).",
      east_entrance:
        "The Court Gate is the EAST entrance — approach God's presence from the east (Ex 40:33; Ex 27:13-16).",
    };
    return (
      hints[cardId] ||
      `This item belongs in the ${expectedZoneId} zone (check OSB Ex 40 for placement).`
    );
  }

  // ---- Mount -----------------------------------------------------------

  window.BibleBowlLabTabernacle = {
    mount(container, lab, callbacks) {
      const zones = lab.tabernacle_zones.slice();
      const cards = lab.tabernacle_cards.slice();
      const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
      const placed = {}; // zoneId -> cardId
      let tray = shuffle(cards.map((c) => c.id));
      let dragCardId = null;
      let dragFromZone = null; // null = from pool
      let highlightedZoneId = null;

      // Build the DOM
      container.innerHTML = "";
      container.className = "lab-tabernacle-root";

      // Heading + status
      const status = document.createElement("p");
      status.className = "lab-drag-status";
      status.textContent =
        "Drag each item onto its correct place on the tabernacle map.";

      // Optional teacher note (printed for Level 3 to disambiguate from
      // the bank's Erect/Furnish/Wash/Anoint mnemonic).
      if (lab.teacher_note) {
        const note = document.createElement("p");
        note.className = "lab-teacher-note";
        note.textContent = lab.teacher_note;
        container.appendChild(note);
      }
      container.appendChild(status);

      // The map board
      const board = document.createElement("div");
      board.className = "lab-tabernacle-board";
      board.setAttribute("role", "figure");
      board.setAttribute(
        "aria-label",
        "Tabernacle floor plan. God's presence is at the west (top). The priestly approach begins at the east entrance (bottom)."
      );

      // Compass cues: top is WEST, bottom is EAST. We use numbered pairs
      // and wall labels so compass literacy is NOT required.
      const compass = document.createElement("div");
      compass.className = "lab-tabernacle-compass";
      compass.innerHTML = `
        <span class="lab-tabernacle-compass-w">↑ God's Presence (WEST)</span>
        <span class="lab-tabernacle-compass-e">↓ Entrance (EAST)</span>
      `;
      board.appendChild(compass);

      // Zones. Nested zones are rendered as child <div>s inside their
      // parent so DOM walk-up (`closest('[data-zone-id]')`) finds the
      // deepest valid zone first.
      const zoneEls = {};
      zones.forEach((z) => {
        const el = document.createElement("div");
        el.className = `lab-tabernacle-zone lab-tabernacle-zone-${z.position}`;
        el.dataset.zoneId = z.id;
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", z.label);

        const cap = document.createElement("span");
        cap.className = "lab-tabernacle-zone-caption";
        cap.textContent = z.label;
        el.appendChild(cap);

        if (z.sublabel) {
          const sub = document.createElement("span");
          sub.className = "lab-tabernacle-zone-sublabel";
          sub.textContent = z.sublabel;
          el.appendChild(sub);
        }

        // Pattern fill hook for color-blind users (CSS handles).
        if (z.pattern) el.classList.add("lab-tabernacle-zone-pattern-" + z.pattern);

        board.appendChild(el);
        zoneEls[z.id] = el;
      });

      // Append nested zones inside their parents.
      zones.forEach((z) => {
        if (z.parent && zoneEls[z.parent]) {
          zoneEls[z.parent].appendChild(zoneEls[z.id]);
        }
      });

      // Tray (chip pool)
      const trayLabel = document.createElement("p");
      trayLabel.className = "lab-drag-pool-label";
      trayLabel.textContent = "Holy Items";

      const trayEl = document.createElement("div");
      trayEl.className = "lab-drag-pool lab-tabernacle-pool";
      trayEl.setAttribute("role", "list");

      // Actions
      const actions = document.createElement("div");
      actions.className = "lab-drag-actions";
      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "primary-btn lab-check-btn";
      checkBtn.textContent = "Check placements";
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "primary-btn ghost-btn lab-reset-btn";
      resetBtn.textContent = "Reset";
      actions.appendChild(checkBtn);
      actions.appendChild(resetBtn);

      container.appendChild(board);
      container.appendChild(trayLabel);
      container.appendChild(trayEl);
      container.appendChild(actions);

      // ---- Drag engine -------------------------------------------------

      let dragGhost = null;
      let dragSourceEl = null;
      let dragPointerId = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function clearHighlight() {
        if (highlightedZoneId && zoneEls[highlightedZoneId]) {
          zoneEls[highlightedZoneId].classList.remove("lab-tabernacle-key-focus");
        }
        highlightedZoneId = null;
      }

      function setHighlight(zoneId) {
        if (highlightedZoneId === zoneId) return;
        clearHighlight();
        highlightedZoneId = zoneId;
        if (zoneId && zoneEls[zoneId]) {
          zoneEls[zoneId].classList.add("lab-tabernacle-key-focus");
        }
      }

      function findZoneAtPoint(clientX, clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        if (!el) return null;
        // Walk up to the nearest zone (handles nested + zone label hits).
        return el.closest("[data-zone-id]");
      }

      function makeChip(cardId) {
        const card = cards.find((c) => c.id === cardId);
        if (!card) return null;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "lab-chip lab-tabernacle-chip";
        chip.dataset.cardId = cardId;
        chip.setAttribute("role", "listitem");
        chip.setAttribute(
          "aria-label",
          `${card.label}${card.osb_ref ? `, ${card.osb_ref}` : ""}`
        );
        if (card.emoji) {
          const e = document.createElement("span");
          e.className = "lab-chip-emoji";
          e.setAttribute("aria-hidden", "true");
          e.textContent = card.emoji;
          chip.appendChild(e);
        }
        const lbl = document.createElement("span");
        lbl.className = "lab-chip-label";
        lbl.textContent = card.label;
        chip.appendChild(lbl);

        // Pointer-based drag (mouse + touch + pen).
        chip.addEventListener("pointerdown", (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          e.preventDefault();
          startDrag(cardId, chip, e.clientX, e.clientY, e.pointerId);
        });
        chip.addEventListener("pointermove", (e) => {
          if (dragCardId !== cardId) return;
          moveDrag(e.clientX, e.clientY);
        });
        chip.addEventListener("pointerup", (e) => {
          if (dragCardId !== cardId) return;
          e.preventDefault();
          endDrag(e.clientX, e.clientY);
        });
        chip.addEventListener("pointercancel", () => {
          if (dragCardId === cardId) cancelDrag();
        });

        // Keyboard: Enter = place in highlighted zone; Esc = cancel.
        chip.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            if (dragCardId === cardId) cancelDrag();
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (highlightedZoneId && !placed[highlightedZoneId]) {
              assign(highlightedZoneId, cardId, dragFromZone);
              render();
            }
          }
        });

        // Click-to-place fallback (tap-only users).
        chip.addEventListener("click", () => {
          if (dragCardId) return;
          const empty = zones.find((z) => !placed[z.id]);
          if (empty) {
            assign(empty.id, cardId, dragFromZone);
            render();
          }
        });

        return chip;
      }

      function startDrag(cardId, chip, clientX, clientY, pointerId) {
        if (dragGhost) return;
        dragCardId = cardId;
        dragFromZone = findZoneContaining(cardId); // null if from pool
        dragPointerId = pointerId;

        const r = chip.getBoundingClientRect();
        dragOffsetX = clientX - r.left;
        dragOffsetY = clientY - r.top;

        chip.classList.add("dragging");
        chip.setAttribute("aria-pressed", "true");
        dragSourceEl = chip;

        // Body-level ghost (escapes the labs-card overflow:auto scroll).
        dragGhost = chip.cloneNode(true);
        dragGhost.classList.remove("dragging");
        dragGhost.classList.add("dragging-floating");
        if (!reduceMotion) {
          dragGhost.style.setProperty("--drag-x", r.left + "px");
          dragGhost.style.setProperty("--drag-y", r.top + "px");
          dragGhost.style.width = r.width + "px";
          dragGhost.style.height = r.height + "px";
        } else {
          // Reduced motion: ghost is positioned but not animated.
          dragGhost.style.left = r.left + "px";
          dragGhost.style.top = r.top + "px";
        }
        dragGhost.removeAttribute("aria-pressed");
        document.body.appendChild(dragGhost);

        if (pointerId !== null && chip.setPointerCapture) {
          try {
            chip.setPointerCapture(pointerId);
          } catch (_) {}
        }
      }

      function moveDrag(clientX, clientY) {
        if (!dragGhost || !dragCardId) return;
        if (!reduceMotion) {
          const x = clientX - dragOffsetX;
          const y = clientY - dragOffsetY;
          dragGhost.style.setProperty("--drag-x", x + "px");
          dragGhost.style.setProperty("--drag-y", y + "px");
        } else {
          dragGhost.style.left = clientX - dragOffsetX + "px";
          dragGhost.style.top = clientY - dragOffsetY + "px";
        }
        // Live zone highlight under pointer.
        clearHighlight();
        const zone = findZoneAtPoint(clientX, clientY);
        if (zone) setHighlight(zone.dataset.zoneId);
      }

      function endDrag(clientX, clientY) {
        if (!dragCardId) return;
        const zone = findZoneAtPoint(clientX, clientY);
        if (zone && !placed[zone.dataset.zoneId]) {
          assign(zone.dataset.zoneId, dragCardId, dragFromZone);
        }
        // Soft snap is automatic: if dropped on a parent zone, the deepest
        // accept set is matched in assign(). If dropped outside, card
        // returns to its source (pool or original zone).
        cleanupDrag();
        render();
      }

      function cancelDrag() {
        cleanupDrag();
        render();
      }

      function cleanupDrag() {
        if (dragGhost) {
          dragGhost.remove();
          dragGhost = null;
        }
        if (dragSourceEl) {
          dragSourceEl.classList.remove("dragging");
          dragSourceEl.removeAttribute("aria-pressed");
          dragSourceEl = null;
        }
        clearHighlight();
        dragCardId = null;
        dragFromZone = null;
        dragOffsetX = 0;
        dragOffsetY = 0;
        dragPointerId = null;
      }

      // Cancel any in-progress drag if the device rotates — addresses
      // skeptic's §1b "rotation mid-drag" failure mode.
      function onOrientationChange() {
        if (dragCardId) cancelDrag();
      }
      window.addEventListener("orientationchange", onOrientationChange);

      // ---- State ops ---------------------------------------------------

      function findZoneContaining(cardId) {
        for (const zid of Object.keys(placed)) {
          if (placed[zid] === cardId) return zid;
        }
        return null;
      }

      // Soft-snap: if dropped on a parent zone, look for the FIRST child
      // zone whose `accept` set contains this card and place it there.
      function assign(zoneId, cardId, fromZone) {
        // Remove from current source.
        if (fromZone) {
          delete placed[fromZone];
        } else {
          tray = tray.filter((c) => c !== cardId);
        }

        // Resolve nested target.
        let target = zoneById[zoneId];
        if (target && Array.isArray(target.accept) && !target.accept.includes(cardId)) {
          // Dropped on a parent — try its children.
          const child = zones.find(
            (z) => z.parent === zoneId && Array.isArray(z.accept) && z.accept.includes(cardId)
          );
          if (child) target = child;
        }

        // If the resolved target already has a card, bounce it back to pool.
        if (placed[target.id] && placed[target.id] !== cardId) {
          tray.push(placed[target.id]);
        }
        placed[target.id] = cardId;
      }

      // ---- Rendering ---------------------------------------------------

      function renderTray() {
        trayEl.innerHTML = "";
        tray.forEach((cid) => {
          const chip = makeChip(cid);
          if (chip) trayEl.appendChild(chip);
        });
      }

      function renderZones() {
        Object.keys(zoneEls).forEach((zid) => {
          const el = zoneEls[zid];
          // Remove any placed-chip element but keep caption/sublabel.
          const placedChip = el.querySelector(".lab-tabernacle-placed");
          if (placedChip) placedChip.remove();
          el.classList.remove("wrong", "filled", "lab-tabernacle-key-focus");

          const cardId = placed[zid];
          if (!cardId) return;
          el.classList.add("filled");
          const card = cards.find((c) => c.id === cardId);
          if (!card) return;

          const placedChipEl = document.createElement("button");
          placedChipEl.type = "button";
          placedChipEl.className =
            "lab-chip lab-tabernacle-chip lab-tabernacle-placed";
          placedChipEl.dataset.cardId = cardId;
          placedChipEl.setAttribute("aria-label", `${card.label}, placed`);
          placedChipEl.setAttribute("title", card.label);
          if (card.emoji) {
            const e = document.createElement("span");
            e.className = "lab-chip-emoji";
            e.setAttribute("aria-hidden", "true");
            e.textContent = card.emoji;
            placedChipEl.appendChild(e);
          }
          // Include the label as visually hidden text for screen readers
          // and keyboard focus, but hide it visually so the chip stays compact.
          const lbl = document.createElement("span");
          lbl.className = "lab-chip-label";
          lbl.textContent = card.label;
          placedChipEl.appendChild(lbl);
          // Click placed chip = return to pool.
          placedChipEl.addEventListener("click", () => {
            delete placed[zid];
            tray.push(cardId);
            render();
          });
          el.appendChild(placedChipEl);
        });
      }

      function render() {
        renderTray();
        renderZones();
        active.state = {
          placed: { ...placed },
          tray: tray.slice(),
          complete: false,
        };
      }

      // ---- Check / reset ----------------------------------------------

      checkBtn.addEventListener("click", () => {
        // Only require zones with a non-empty accept set to be filled.
        // Parent zones (e.g., holy_place, most_holy) are visual containers
        // whose children hold the actual drop targets — they should not
        // appear "missing" when all their children are filled.
        const required = zones.filter((z) => Array.isArray(z.accept) && z.accept.length > 0);
        const missing = required.filter((z) => !placed[z.id]);
        if (missing.length) {
          status.textContent = `Place every item — ${missing.length} zone(s) still empty.`;
          status.className = "lab-drag-status lab-hint";
          return;
        }
        // Walk placed zones, check each card is in a zone whose accept
        // set contains it.
        let ok = true;
        let firstWrong = null;
        for (const zid of Object.keys(placed)) {
          const z = zoneById[zid];
          const cid = placed[zid];
          if (!z || !Array.isArray(z.accept) || !z.accept.includes(cid)) {
            ok = false;
            firstWrong = { cardId: cid, zoneId: zid, expectedZoneId: z && z.parent ? z.parent : zid };
            zoneEls[zid].classList.add("wrong");
            break;
          }
        }
        if (ok) {
          status.textContent = lab.completion_teaching.memory_sentence;
          status.className = "lab-drag-status lab-success";
          checkBtn.disabled = true;
          active.state.complete = true;
          if (callbacks && callbacks.onComplete) callbacks.onComplete();
          if (typeof window.BibleBowlPlaySound === "function")
            window.BibleBowlPlaySound("unlock");
        } else {
          status.textContent = failureHintFor(
            firstWrong.cardId,
            firstWrong.expectedZoneId
          );
          status.className = "lab-drag-status lab-hint";
          if (typeof window.BibleBowlPlaySound === "function")
            window.BibleBowlPlaySound("thunder");
        }
      });

      resetBtn.addEventListener("click", () => {
        Object.keys(placed).forEach((k) => {
          tray.push(placed[k]);
          delete placed[k];
        });
        tray = shuffle(tray);
        status.textContent =
          "Drag each item onto its correct place on the tabernacle map.";
        status.className = "lab-drag-status";
        checkBtn.disabled = false;
        render();
      });

      // ---- Keyboard zone navigation (West → East) ---------------------
      // Tab order: chips first, then zones (Ark → East Entrance).
      container.addEventListener("keydown", (e) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
          return;
        e.preventDefault();
        const orderedZones = zones.filter((z) => !z.parent); // top-level only
        const idx = orderedZones.findIndex((z) => z.id === highlightedZoneId);
        let next = idx;
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + orderedZones.length) % orderedZones.length;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % orderedZones.length;
        setHighlight(orderedZones[next].id);
      });

      // ---- Public active object ---------------------------------------

      active = {
        labId: lab.id,
        state: { placed: {}, tray: [], complete: false },
        fillCorrect() {
          // Two passes:
          // 1. Fill zones with their declared `accept[0]` card. Multi-accept
          //    zones (e.g. tabernacle_exterior) get the first match.
          // 2. Place any remaining tray cards into zones whose accept set
          //    still has room. This handles the laver → courtyard case.
          const allCards = cards.map((c) => c.id);
          zones.forEach((z) => {
            if (Array.isArray(z.accept) && z.accept.length > 0 && !placed[z.id]) {
              const c = z.accept.find((cid) => allCards.includes(cid) && !Object.values(placed).includes(cid));
              if (c) {
                placed[z.id] = c;
                tray = tray.filter((x) => x !== c);
              }
            }
          });
          render();
        },
        check() {
          checkBtn.click();
        },
        // Test hook: programmatic placement (used by regression tests to
        // simulate user actions without DOM events). Bypasses drag engine.
        assignForTest(zoneId, cardId) {
          assign(zoneId, cardId, findZoneContaining(cardId));
          render();
        },
        cleanup() {
          window.removeEventListener("orientationchange", onOrientationChange);
          if (dragCardId) cancelDrag();
        },
      };

      render();
      return active;
    },

    getActive() {
      return active;
    },

    unmount() {
      if (active && active.cleanup) active.cleanup();
      active = null;
    },
  };
})();