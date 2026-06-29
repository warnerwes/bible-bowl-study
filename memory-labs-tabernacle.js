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
      let hintsUsed = 0; // increments on each Hint button press
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
      //
      // Note (2026-06-28): Initial labels show ONLY directional/room
      // text (e.g. "① North Wall"). The answer-name lives in
      // `reveal_label` and is swapped in AFTER a correct placement
      // (see renderZones), so the user cannot solve the lab by reading
      // the map — they have to know the placement from memory.
      const zoneEls = {};
      zones.forEach((z) => {
        const el = document.createElement("div");
        el.className = `lab-tabernacle-zone lab-tabernacle-zone-${z.position}`;
        el.dataset.zoneId = z.id;
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", z.label);

        const cap = document.createElement("span");
        cap.className = "lab-tabernacle-zone-caption";
        cap.dataset.role = "label";
        cap.textContent = z.label;
        el.appendChild(cap);

        if (z.sublabel) {
          const sub = document.createElement("span");
          sub.className = "lab-tabernacle-zone-sublabel";
          sub.dataset.role = "sublabel";
          sub.textContent = z.sublabel;
          el.appendChild(sub);
        }

        // Optional reveal slot — only populated after a correct
        // placement. Hidden by default so the answer-name never leaks
        // before the user has earned the reveal.
        if (z.reveal_label) {
          const reveal = document.createElement("span");
          reveal.className = "lab-tabernacle-zone-reveal";
          reveal.dataset.role = "reveal";
          reveal.textContent = z.reveal_label;
          reveal.hidden = true;
          el.appendChild(reveal);
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
      const hintBtn = document.createElement("button");
      hintBtn.type = "button";
      hintBtn.className = "primary-btn ghost-btn lab-hint-btn";
      hintBtn.textContent = "Hint";
      hintBtn.setAttribute("aria-label", "Reveal one correct placement");
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "primary-btn ghost-btn lab-reset-btn";
      resetBtn.textContent = "Reset";
      actions.appendChild(checkBtn);
      actions.appendChild(hintBtn);
      actions.appendChild(resetBtn);

      // Hint counter pill (separate from the button so it can update
      // without re-rendering the button + without losing focus).
      const hintCounter = document.createElement("span");
      hintCounter.className = "lab-tabernacle-hint-counter";
      hintCounter.setAttribute("aria-live", "polite");
      actions.appendChild(hintCounter);

      // Medal badge container — rendered ONLY on completion. Hidden
      // before then. Lives under the tray so the achievement feels
      // anchored to the user's working area.
      const medalEl = document.createElement("div");
      medalEl.className = "lab-tabernacle-medal";
      medalEl.setAttribute("role", "status");
      medalEl.setAttribute("aria-live", "polite");
      medalEl.hidden = true;

      container.appendChild(board);
      container.appendChild(trayLabel);
      container.appendChild(trayEl);
      container.appendChild(actions);
      container.appendChild(medalEl);

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
        // Soft snap: if dropped on a parent zone whose children don't
        // accept this card, the drop is REJECTED — the card returns to
        // its source (pool or original zone). Previously a failed soft-
        // snap would silently assign the card to the parent zone's id,
        // which is not a real drop target and would corrupt state
        // (Card visible in Courtyard but blocked any future drops
        // there). assign() now refuses in that case. (2026-06-28 fix.)
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
      // If the dropped-on zone is a parent (accept: []) AND no child
      // accepts this card, REFUSE the drop — return false so the caller
      // doesn't corrupt state by writing to a non-target zone id.
      // (2026-06-28 fix: previously a failed soft-snap would write the
      // card to the parent's id, blocking future drops and surfacing as
      // a phantom "wrong placement" on Check.)
      // Resolve a drop to its target zone.
      // Three cases:
      //  1. Card dropped on a zone whose `accept` includes it → place there.
      //  2. Card dropped on a parent zone (accept: []) whose child
      //     accepts it → soft-snap to that child. (User-friendly: dropping
      //     Bronze Altar on the big Courtyard box routes to the
      //     bronze_altar sub-zone.)
      //  3. Card dropped on a zone (or parent whose children don't accept
      //     it) where it doesn't belong → place it anyway. The user is
      //     learning — wrong placements get marked red on Check and the
      //     user can drag the chip back out. The ONLY case that refuses
      //     is when the dropped-on zone is a parent AND no child accepts
      //     it (silent state corruption: nothing on the screen would
      //     visually match the assignment).
      //
      // Returns true if placed, false if rejected (card returned to
      // source). (2026-06-28 fix.)
      function assign(zoneId, cardId, fromZone) {
        const target = zoneById[zoneId];
        if (!target) {
          // Unknown zone — undo source removal.
          undoSourceRemoval(cardId, fromZone);
          return false;
        }
        const accepts =
          Array.isArray(target.accept) && target.accept.includes(cardId);
        if (accepts) {
          return commitPlace(target, cardId, fromZone);
        }
        // Not accepted by the dropped-on zone. Try children if it's a
        // parent (soft-snap).
        const child = zones.find(
          (z) =>
            z.parent === zoneId &&
            Array.isArray(z.accept) &&
            z.accept.includes(cardId)
        );
        if (child) {
          return commitPlace(child, cardId, fromZone);
        }
        // No matching child. If the dropped-on zone is a parent with
        // no children that accept this card, REFUSE — the user has
        // dropped on a region that visibly cannot hold this card, and
        // accepting would corrupt state (write a card id to a zone id
        // that has no rendered slot for it).
        if (!Array.isArray(target.accept) || target.accept.length === 0) {
          undoSourceRemoval(cardId, fromZone);
          return false;
        }
        // Otherwise: the dropped-on zone has its own accept set, and
        // the card isn't in it. This is a WRONG placement — place it
        // anyway so the user gets feedback on Check and can drag the
        // chip back out to try again.
        return commitPlace(target, cardId, fromZone);
      }

      function commitPlace(target, cardId, fromZone) {
        // Remove from current source.
        if (fromZone) {
          delete placed[fromZone];
        } else {
          tray = tray.filter((c) => c !== cardId);
        }
        // If the target already has a card, bounce it back to pool.
        if (placed[target.id] && placed[target.id] !== cardId) {
          tray.push(placed[target.id]);
        }
        placed[target.id] = cardId;
        return true;
      }

      function undoSourceRemoval(cardId, fromZone) {
        if (fromZone) {
          placed[fromZone] = cardId;
        } else {
          if (!tray.includes(cardId)) tray.push(cardId);
        }
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
          // Remove any placed-chip element but keep caption/sublabel/reveal.
          const placedChip = el.querySelector(".lab-tabernacle-placed");
          if (placedChip) placedChip.remove();
          el.classList.remove("wrong", "filled", "lab-tabernacle-key-focus");

          // Reset reveal state. The reveal slot is populated ONLY when
          // a card has been placed in this zone — keeping the answer-name
          // hidden until the user earns it. (2026-06-28 anti-leak fix.)
          const revealEl = el.querySelector('[data-role="reveal"]');
          if (revealEl) revealEl.hidden = true;

          const cardId = placed[zid];
          if (!cardId) return;
          el.classList.add("filled");

          // Reveal the answer-name now that a card sits in this zone.
          if (revealEl) revealEl.hidden = false;

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
          // Click placed chip = return to pool (only if no drag started).
          let pointerDownX = 0;
          let pointerDownY = 0;
          let draggedFar = false;
          placedChipEl.addEventListener("pointerdown", (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            pointerDownX = e.clientX;
            pointerDownY = e.clientY;
            draggedFar = false;
            startDrag(cardId, placedChipEl, e.clientX, e.clientY, e.pointerId);
          });
          placedChipEl.addEventListener("pointermove", (e) => {
            if (dragCardId !== cardId) return;
            moveDrag(e.clientX, e.clientY);
            if (
              !draggedFar &&
              Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 6
            ) {
              draggedFar = true;
            }
          });
          placedChipEl.addEventListener("pointerup", (e) => {
            if (dragCardId !== cardId) return;
            e.preventDefault();
            endDrag(e.clientX, e.clientY);
          });
          placedChipEl.addEventListener("pointercancel", () => {
            if (dragCardId === cardId) cancelDrag();
          });
          placedChipEl.addEventListener("click", (e) => {
            // Suppress click-to-return if user just dragged this chip.
            if (draggedFar) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // Quick tap on a placed chip = bounce back to pool.
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
        // Mirror hint progress in the chip pill so user sees their
        // counter ticking up without it blocking the active drag.
        hintCounter.textContent =
          hintsUsed === 0
            ? "Hints: 0"
            : `Hints: ${hintsUsed}`;
        active.state = {
          placed: { ...placed },
          tray: tray.slice(),
          hintsUsed,
          complete: false,
        };
      }

      // ---- Hint / medal -------------------------------------------------

      // Tier mapping per Wes's spec (2026-06-28):
      //   0 hints  → GOLD
      //   1–2 hints → SILVER
      //   3+ hints → BRONZE
      function tierFor(hints) {
        if (hints <= 0) return "gold";
        if (hints <= 2) return "silver";
        return "bronze";
      }
      const TIER_LABEL = {
        gold: "GOLD",
        silver: "SILVER",
        bronze: "BRONZE",
      };
      const TIER_EMOJI = {
        gold: "🥇",
        silver: "🥈",
        bronze: "🥉",
      };
      const TIER_LINE = {
        gold: "Mastered with no hints — every holy thing placed from memory alone.",
        silver: "Placed cleanly with a hint or two — the placements are known, the recall almost there.",
        bronze: "Placed with many hints — keep practicing until the map lives in your heart.",
      };
      const MEDAL_STORAGE_KEY = `bbs-medal:${lab.id}`;
      function readBestMedal() {
        try {
          const raw = localStorage.getItem(MEDAL_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (parsed && ["gold", "silver", "bronze"].includes(parsed.tier)) {
            return parsed;
          }
        } catch (_) {}
        return null;
      }
      function writeBestMedal(record) {
        try {
          localStorage.setItem(MEDAL_STORAGE_KEY, JSON.stringify(record));
        } catch (_) {}
      }
      // Tier ranking for "did this beat the prior best" comparison.
      function tierRank(t) {
        if (t === "gold") return 0;
        if (t === "silver") return 1;
        if (t === "bronze") return 2;
        return 3;
      }

      // Reveal one placement visually: pulse the source CHIP and the
      // target ZONE together. Then commit the placement into `placed`
      // and re-render so the chip actually moves. Returns true on
      // success, false if nothing left to reveal.
      function revealOne() {
              // 1. Prefer unresolved tray cards (user hasn't placed yet).
              for (const cardId of tray) {
                // Find the first required zone whose accept set contains
                // this card.
                const target = zones.find(
                  (z) =>
                    Array.isArray(z.accept) &&
                    z.accept.includes(cardId) &&
                    !placed[z.id]
                );
                if (target) {
                  flashHint(cardId, target.id);
                  return true;
                }
              }
              // 2. Tray empty but something is wrongly placed — point at the
              // mis-placed chip and its correct home so the user can re-drag.
              for (const zid of Object.keys(placed)) {
                const z = zoneById[zid];
                if (!z || !Array.isArray(z.accept)) continue;
                if (!z.accept.includes(placed[zid])) {
                  // Find the FIRST required zone whose accept set contains
                  // this card and is currently empty.
                  const correctZoneId = zones
                    .filter(
                      (zz) =>
                        Array.isArray(zz.accept) &&
                        zz.accept.includes(placed[zid]) &&
                        !placed[zz.id]
                    )
                    .map((zz) => zz.id)[0];
                  if (correctZoneId) {
                    flashHint(placed[zid], correctZoneId);
                    return true;
                  }
                }
              }
              return false;
            }
            // Hint reveal: pulse the source chip + the target zone so the
            // user can SEE where the card goes, but DO NOT auto-place it.
            // The user must still drag the chip themselves — mastery comes
            // from the muscle memory of moving the card into place, not
            // from a programmatic click. (2026-06-28 fix: previously the
            // hint button called assign() and dropped the card for the
            // user, which made the gold tier trivially achievable.)
            function flashHint(cardId, zoneId) {
              requestAnimationFrame(() => {
                const chipEl =
                  trayEl.querySelector(`[data-card-id="${cardId}"]`) ||
                  document.querySelector(
                    `[data-card-id="${cardId}"].lab-tabernacle-placed`
                  );
                if (chipEl) {
                  chipEl.classList.add("lab-hint-reveal");
                  setTimeout(
                    () => chipEl.classList.remove("lab-hint-reveal"),
                    1600
                  );
                }
                const zoneEl = zoneEls[zoneId];
                if (zoneEl) {
                  zoneEl.classList.add("lab-hint-reveal");
                  setTimeout(
                    () => zoneEl.classList.remove("lab-hint-reveal"),
                    1600
                  );
                }
              });
            }

      // Public hint counter for the test harness.
      function hintCount() {
        return hintsUsed;
      }

      // Build the medal DOM. Hidden until a successful Check.
      function renderMedal(tier, hintsCount, previousBest) {
        medalEl.hidden = false;
        const isNewBest =
          !previousBest || tierRank(tier) < tierRank(previousBest.tier);
        const medalText = `${TIER_EMOJI[tier]} ${TIER_LABEL[tier]}`;
        const tierLabel = `${medalText} (${hintsCount} hint${
          hintsCount === 1 ? "" : "s"
        })`;
        medalEl.innerHTML = "";
        const badge = document.createElement("div");
        badge.className = `lab-tabernacle-medal-badge lab-tabernacle-medal-${tier}`;
        const head = document.createElement("div");
        head.className = "lab-tabernacle-medal-headline";
        head.textContent = medalText;
        const sub = document.createElement("div");
        sub.className = "lab-tabernacle-medal-sub";
        sub.textContent = `${hintsCount} hint${hintsCount === 1 ? "" : "s"} — ${TIER_LINE[tier]}`;
        badge.appendChild(head);
        badge.appendChild(sub);
        if (isNewBest && previousBest) {
          const newBest = document.createElement("div");
          newBest.className = "lab-tabernacle-medal-newbest";
          newBest.textContent = `New best! (Previous: ${TIER_EMOJI[previousBest.tier]} ${TIER_LABEL[previousBest.tier]})`;
          badge.appendChild(newBest);
        } else if (isNewBest && !previousBest) {
          const firstEver = document.createElement("div");
          firstEver.className = "lab-tabernacle-medal-newbest";
          firstEver.textContent = "First completion on this device.";
          badge.appendChild(firstEver);
        } else if (previousBest) {
          const keepTrying = document.createElement("div");
          keepTrying.className = "lab-tabernacle-medal-oldbest";
          keepTrying.textContent = `Best remains: ${TIER_EMOJI[previousBest.tier]} ${TIER_LABEL[previousBest.tier]} (${previousBest.hints} hint${
            previousBest.hints === 1 ? "" : "s"
          })`;
          badge.appendChild(keepTrying);
        }
        medalEl.appendChild(badge);
        return tierLabel;
      }

      hintBtn.addEventListener("click", () => {
        if (active.state.complete) return; // No hints after completion.
        const did = revealOne();
        if (!did) {
          status.textContent =
            "All placements are already correct — no hint needed.";
          status.className = "lab-drag-status";
          return;
        }
        hintsUsed++;
        // Render keeps the chip pill in sync + re-draws tray/zones. We
        // capture the new render() values via the call above.
        render();
      });

      // ---- Check / reset ----------------------------------------------

      checkBtn.addEventListener("click", () => {
        // Clear any prior per-zone feedback classes before re-evaluating.
        Object.values(zoneEls).forEach((el) => {
          el.classList.remove(
            "wrong",
            "right",
            "missing",
            "checked",
            "lab-tabernacle-key-focus"
          );
        });
        // Only require zones with a non-empty accept set to be filled.
        // Parent zones (e.g., holy_place, most_holy) are visual containers
        // whose children hold the actual drop targets — they should not
        // appear "missing" when all their children are filled.
        const required = zones.filter((z) => Array.isArray(z.accept) && z.accept.length > 0);
        const missingZones = required.filter((z) => !placed[z.id]);
        let wrongCount = 0;
        let correctCount = 0;
        // Mark every required zone with status class so user can see at a
        // glance which placements are right, wrong, and still empty.
        required.forEach((z) => {
          const el = zoneEls[z.id];
          if (!el) return;
          el.classList.add("checked");
          if (!placed[z.id]) {
            el.classList.add("missing");
          } else if (Array.isArray(z.accept) && z.accept.includes(placed[z.id])) {
            el.classList.add("right");
            correctCount++;
          } else {
            el.classList.add("wrong");
            wrongCount++;
          }
        });
        const totalRequired = required.length;
        const empty = missingZones.length;
        if (empty || wrongCount) {
          // Compose a precise status so user knows what to fix.
          const parts = [];
          if (wrongCount) parts.push(`${wrongCount} misplacement${wrongCount === 1 ? "" : "s"}`);
          if (empty) parts.push(`${empty} zone${empty === 1 ? "" : "s"} still empty`);
          status.textContent = `${correctCount}/${totalRequired} right — ${parts.join(", ")}. Red zones need to swap; pulsing zones still need a card.`;
          status.className = "lab-drag-status lab-hint";
          if (wrongCount && typeof window.BibleBowlPlaySound === "function") {
            window.BibleBowlPlaySound("thunder");
          }
          return;
        }
        // All correct. Compute medal tier from hint usage and render the
        // badge in the tray area so the achievement sits where the user
        // was just working. Persist if it beats the prior best.
        status.textContent = lab.completion_teaching.memory_sentence;
        status.className = "lab-drag-status lab-success";
        checkBtn.disabled = true;
        hintBtn.disabled = true; // no more hints after success
        active.state.complete = true;
        const priorBest = readBestMedal();
        const tier = tierFor(hintsUsed);
        const record = {
          tier,
          hints: hintsUsed,
          at: new Date().toISOString(),
        };
        // Only persist if this attempt beats the prior best (or no prior).
        if (
          !priorBest ||
          tierRank(tier) < tierRank(priorBest.tier) ||
          (tierRank(tier) === tierRank(priorBest.tier) &&
            hintsUsed < (priorBest.hints || Infinity))
        ) {
          writeBestMedal(record);
        }
        renderMedal(tier, hintsUsed, priorBest);
        if (callbacks && callbacks.onComplete) callbacks.onComplete();
        if (typeof window.BibleBowlPlaySound === "function")
          window.BibleBowlPlaySound("unlock");
      });

      resetBtn.addEventListener("click", () => {
        Object.keys(placed).forEach((k) => {
          tray.push(placed[k]);
          delete placed[k];
        });
        tray = shuffle(tray);
        // Fresh attempt: clear hint counter so a gold attempt is
        // genuinely possible from this point on.
        hintsUsed = 0;
        // Clear per-zone feedback so previous Check marks don't bleed into the new attempt.
        Object.values(zoneEls).forEach((el) => {
          el.classList.remove(
            "wrong",
            "right",
            "missing",
            "checked",
            "lab-tabernacle-key-focus",
            "lab-hint-reveal"
          );
        });
        status.textContent =
          "Drag each item onto its correct place on the tabernacle map.";
        status.className = "lab-drag-status";
        checkBtn.disabled = false;
        hintBtn.disabled = false;
        // Hide the medal so the prior badge doesn't shadow the new attempt.
        medalEl.hidden = true;
        medalEl.innerHTML = "";
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
        // Returns true on success, false if the drop was rejected (e.g.
        // card placed on a parent zone whose children don't accept it).
        assignForTest(zoneId, cardId) {
          const result = assign(zoneId, cardId, findZoneContaining(cardId));
          render();
          return result;
        },
        // Test hook: pull a placed card back to the tray, leaving its
        // zone empty. Used to simulate user actions that need a known
        // empty required zone (e.g. verifying .missing feedback works).
        unplaceForTest(cardId) {
          const zid = findZoneContaining(cardId);
          if (zid) {
            delete placed[zid];
            tray.push(cardId);
            render();
          }
        },
        // Test hook: force a placement bypassing soft-snap validation.
        // Used to set up "wrong placement" test fixtures — assign()
        // now refuses drops onto zones that don't accept the card, so
        // tests that need to verify Check handles wrong placements
        // must use this hook to inject the wrong state directly.
        forcePlaceForTest(zoneId, cardId) {
          // Remove from wherever it currently is.
          for (const zid of Object.keys(placed)) {
            if (placed[zid] === cardId) delete placed[zid];
          }
          tray = tray.filter((c) => c !== cardId);
          // If the target already has a card, push it back to tray.
          if (placed[zoneId] && placed[zoneId] !== cardId) {
            tray.push(placed[zoneId]);
          }
          placed[zoneId] = cardId;
          render();
        },
        // Test hook: read the current hint counter.
        hintCount() {
          return hintsUsed;
        },
        // Test hook: compute the tier for a hypothetical hint count.
        tierFor(h) {
          return tierFor(h);
        },
        // Test hook: clear localStorage medal (for clean test runs).
        clearMedalForTest() {
          try {
            localStorage.removeItem(MEDAL_STORAGE_KEY);
          } catch (_) {}
        },
        // Test hook: read what medal would currently be persisted.
        readBestMedal() {
          return readBestMedal();
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