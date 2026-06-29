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
    const isQA = typeof window !== "undefined" && window.location && window.location.search.includes("qa=1");
    if (isQA) return arr.slice();
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
      const usesDispenser = true;
      const zones = lab.tabernacle_zones.slice();
      const cards = lab.tabernacle_cards.slice();
      const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
      const placed = {}; // zoneId -> cardId
      let tray = shuffle(cards.map((c) => c.id));
      let hintsUsed = 0; // increments on each Hint button press
      let dragCardId = null;
      let dragFromZone = null; // null = from pool
      let highlightedZoneId = null;
      let selectedCardId = null;

      function selectCard(cardId) {
        selectedCardId = cardId;
        render();
      }

      // Build the DOM. ADD the root class rather than overwriting className
      // so the host workspace keeps "labs-workspace" + "labs-workspace--tabernacle"
      // (the mobile flex-height chain depends on those classes surviving mount).
      container.innerHTML = "";
      container.classList.add("lab-tabernacle-root");
      if (usesDispenser) container.classList.add("has-dispenser");

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

      // Compass cues: WEST above, EAST below the board. Rendered as
      // flow siblings of the board inside the layout container.
      const compassW = document.createElement("div");
      compassW.className = "lab-tabernacle-compass lab-tabernacle-compass-west";
      compassW.textContent = "↑ God's Presence (WEST)";
      const compassE = document.createElement("div");
      compassE.className = "lab-tabernacle-compass lab-tabernacle-compass-east";
      compassE.textContent = "↓ Entrance (EAST)";

      // Zones. Nested zones are rendered as child <div>s inside their
      // parent so DOM walk-up (`closest('[data-zone-id]')`) finds the
      // deepest valid zone first.
      //
      // Layout per zone (2026-06-29): labels live OUTSIDE the drop
      // slot so the user sees the slot name (e.g. "Divider") right
      // next to the slot itself. Each zone becomes a 2-cell row:
      //   [ label-block | drop-slot ]
      // The label-block holds caption + sublabel + reveal; the
      // drop-slot holds only placed chips. This way labels never
      // collide with placed chips and the map reads like an
      // annotated floor plan.
      //
      // Anti-leak: `reveal_label` (the answer-name) is hidden until
      // a correct placement, so the user cannot solve by reading the
      // labels alone.
      const zoneEls = {};
      zones.forEach((z) => {
        // Outer row wraps the zone (label + drop slot).
        const el = document.createElement("div");
        el.className = `lab-tabernacle-zone lab-tabernacle-zone-${z.position}`;
        el.dataset.zoneId = z.id;
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", z.label);

        // Label block: caption + sublabel + reveal. Sits to the LEFT
        // of the drop slot via CSS. Pointer-events disabled so it
        // doesn't intercept drag events.
        const labelBlock = document.createElement("div");
        labelBlock.className = "lab-tabernacle-label";

        const cap = document.createElement("span");
        cap.className = "lab-tabernacle-zone-caption";
        cap.dataset.role = "label";
        cap.textContent = z.label;
        labelBlock.appendChild(cap);

        if (z.sublabel) {
          const sub = document.createElement("span");
          sub.className = "lab-tabernacle-zone-sublabel";
          sub.dataset.role = "sublabel";
          sub.textContent = z.sublabel;
          labelBlock.appendChild(sub);
        }

        if (z.reveal_label) {
          const reveal = document.createElement("span");
          reveal.className = "lab-tabernacle-zone-reveal";
          reveal.dataset.role = "reveal";
          reveal.textContent = z.reveal_label;
          reveal.hidden = true;
          labelBlock.appendChild(reveal);
        }

        const slot = document.createElement("div");
        slot.className = "lab-tabernacle-slot";
        slot.dataset.role = "slot";

        // Pattern fill hook for color-blind users (CSS handles).
        if (z.pattern) slot.classList.add("lab-tabernacle-slot-pattern-" + z.pattern);

        el.appendChild(labelBlock);
        el.appendChild(slot);

        el.tabIndex = 0;
        el.addEventListener("click", () => {
          if (!selectedCardId) return;
          const cardId = selectedCardId;
          const fromZone = findZoneContaining(cardId);
          if (placed[z.id]) {
            status.textContent = "This zone already has an item placed.";
            status.className = "lab-drag-status lab-hint";
            return;
          }
          const success = assign(z.id, cardId, fromZone);
          if (success) {
            selectCard(null);
            render();
          } else {
            status.textContent = "This zone cannot hold this item. Drop on a smaller marked zone.";
            status.className = "lab-drag-status lab-hint";
          }
        });

        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (selectedCardId) {
              e.preventDefault();
              const cardId = selectedCardId;
              const fromZone = findZoneContaining(cardId);
              if (placed[z.id]) {
                status.textContent = "This zone already has an item placed.";
                status.className = "lab-drag-status lab-hint";
                return;
              }
              const success = assign(z.id, cardId, fromZone);
              if (success) {
                selectCard(null);
                render();
              } else {
                status.textContent = "This zone cannot hold this item. Drop on a smaller marked zone.";
                status.className = "lab-drag-status lab-hint";
              }
            }
          }
        });

        if (z.position === "west" || z.position === "veil" || z.position === "center") {
          let building = board.querySelector(".lab-tabernacle-building");
          if (!building) {
            building = document.createElement("div");
            building.className = "lab-tabernacle-building";
            board.appendChild(building);
          }
          building.appendChild(el);
        } else {
          board.appendChild(el);
        }
        zoneEls[z.id] = el;
      });

      // Append nested zones inside their parents.
      zones.forEach((z) => {
        if (z.parent && zoneEls[z.parent]) {
          const parentZone = zoneEls[z.parent];
          // Find the parent's drop slot and append the child there.
          const parentSlot = parentZone.querySelector(".lab-tabernacle-slot");
          if (parentSlot) parentSlot.appendChild(zoneEls[z.id]);
        }
      });

      // Dispenser / Tray (chip pool)

      const trayLabel = document.createElement("p");
      trayLabel.className = "lab-drag-pool-label lab-tabernacle-pool-label";
      trayLabel.textContent = usesDispenser ? "Next Item" : "Holy Items";

      const trayEl = document.createElement("div");
      trayEl.className = "lab-drag-pool lab-tabernacle-pool";
      trayEl.setAttribute("role", "list");

      const dispenserMeta = document.createElement("p");
      dispenserMeta.className = "lab-drag-dispenser-meta";

      const dispenserWrap = document.createElement("div");
      dispenserWrap.className = "lab-drag-dispenser";
      dispenserWrap.appendChild(trayLabel);
      dispenserWrap.appendChild(trayEl);
      dispenserWrap.appendChild(dispenserMeta);

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

      // Build a sidebar that lists every zone (id, caption, sublabel).
      // On mobile the sidebar collapses below the map; on desktop it
      // sits beside the map. Labels live OUTSIDE the map so each zone
      // has more room for its placed emoji chip — fixes the issue
      // where chips overflowed small zones and got clipped.
      //
      // Order: SPATIAL (top→bottom matching the map), not data order.
      // Data order puts East Entrance (#4) before nested children and
      // Divider (#8), which made the sidebar read nonsensically. The
      // map renders zones top-down (Most Holy → Divider → Holy Place
      // → Courtyard → East Entrance), so the sidebar should too.
      //
      // We build the sidebar empty, attach the layout to the DOM
      // so the board has layout, read each zone's getBoundingClientRect
      // to compute true spatial position, then sort + populate the
      // sidebar items. Pure DOM order won't work because nested
      // zones are appended to the board first then moved into their
      // parent's slot — Divider (declared last) ends up last in DOM
      // even though it should be 2nd from top on the map.
      const sidebar = document.createElement("aside");
      sidebar.className = "lab-tabernacle-sidebar";
      sidebar.setAttribute("aria-label", "Zone legend");
      const sidebarList = document.createElement("ul");
      sidebarList.className = "lab-tabernacle-sidebar-list";

      // Pre-create empty list items for every zone. We'll sort and
      // populate them after the layout is mounted.
      const zoneElsList = [...board.querySelectorAll(".lab-tabernacle-zone")];
      zoneElsList.forEach((zoneEl) => {
        const zid = zoneEl.dataset.zoneId;
        const z = zoneById[zid];
        if (!z) return;
        const li = document.createElement("li");
        li.className = "lab-tabernacle-sidebar-item";
        li.dataset.sidebarFor = z.id;
        li.dataset.zoneRef = zid; // for spatial sort
        const cap = document.createElement("span");
        cap.className = "lab-tabernacle-sidebar-caption";
        cap.dataset.role = "label";
        cap.textContent = z.label;
        li.appendChild(cap);
        if (z.sublabel) {
          const sub = document.createElement("span");
          sub.className = "lab-tabernacle-sidebar-sublabel";
          sub.dataset.role = "sublabel";
          sub.textContent = z.sublabel;
          li.appendChild(sub);
        }
        // Slot for the answer-name emoji+label once the user places
        // correctly. Empty placeholder until then — keeping the answer-
        // name out of the initial render (anti-leak).
        const answerSlot = document.createElement("span");
        answerSlot.className = "lab-tabernacle-sidebar-answer";
        answerSlot.dataset.role = "answer";
        answerSlot.hidden = true;
        li.appendChild(answerSlot);
        sidebarList.appendChild(li);
      });
      sidebar.appendChild(sidebarList);

      // Wrap map + sidebar in a flex layout row. Compass labels live
      // above (WEST) and below (EAST) the board so the spatial cue
      // is concrete and never gets clipped by overflow.
      const layout = document.createElement("div");
      layout.className = "lab-tabernacle-layout";
      // Board wrapper holds the compass pair + board vertically so
      // both labels and the board sit in the same column.
      const boardCol = document.createElement("div");
      boardCol.className = "lab-tabernacle-board-col";
      boardCol.appendChild(compassW);
      boardCol.appendChild(board);
      boardCol.appendChild(compassE);
      layout.appendChild(boardCol);
      layout.appendChild(sidebar);

      // Tray footer: the chip pool + action buttons sit in a non-flexing
      // footer so the map (boardCol) gets all the remaining vertical space
      // and the chips stay pinned at the bottom of the viewport on mobile
      // (see CSS .lab-tabernacle-tray-footer). The medal renders inside
      // the footer too so the achievement appears where the user worked.
      const trayFooter = document.createElement("div");
      trayFooter.className = "lab-tabernacle-tray-footer";
      if (usesDispenser) {
        trayFooter.appendChild(dispenserWrap);
      } else {
        trayFooter.appendChild(trayLabel);
        trayFooter.appendChild(trayEl);
      }
      trayFooter.appendChild(actions);
      trayFooter.appendChild(medalEl);

      container.appendChild(layout);
      container.appendChild(trayFooter);

      // Now that the board is in the DOM, sort sidebar items by the
      // spatial top position of their matching zone. Tiebreak by left
      // so side-by-side nested zones (north before south) read in the
      // natural left-to-right order. Re-append in sorted order.
      const sortedItems = [...sidebarList.children].sort((a, b) => {
        const za = zoneById[a.dataset.zoneRef];
        const zb = zoneById[b.dataset.zoneRef];
        if (!za || !zb) return 0;
        const zaEl = zoneEls[za.id];
        const zbEl = zoneEls[zb.id];
        if (!zaEl || !zbEl) return 0;
        const ra = zaEl.getBoundingClientRect();
        const rb = zbEl.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 4) return ra.top - rb.top;
        return ra.left - rb.left;
      });
      sortedItems.forEach((li) => sidebarList.appendChild(li));

      // ---- Drag engine -------------------------------------------------

      let dragGhost = null;
      let dragSourceEl = null;
      let dragPointerId = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      // Tracks whether the active drag has moved far enough to count
      // as a real drag (vs a tap). Mirrors the per-chip `draggedFar`
      // closure variable inside renderZones, kept global so the
      // window-level pointermove listener (attached in startDrag)
      // can update it. Used by the placed-chip click handler to
      // decide whether to bounce-back to pool. (2026-06-28 fix.)
      let dragMovedFar = false;
      let dragStartX = 0;
      let dragStartY = 0;

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
        if (cardId === selectedCardId) {
          chip.classList.add("selected");
          chip.setAttribute("aria-pressed", "true");
        }
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

        // Pointer-based drag (mouse + touch + pen). pointermove + pointerup
        // are handled by WINDOW-level listeners attached in startDrag
        // (so the drag continues even after the source chip is hidden
        // via visibility:hidden). This block only needs pointerdown.
        chip.addEventListener("pointerdown", (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          e.preventDefault();
          startDrag(cardId, chip, e.clientX, e.clientY, e.pointerId);
        });

        // Keyboard: Enter = place in highlighted zone; Esc = cancel.
        chip.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            if (dragCardId === cardId) cancelDrag();
            if (selectedCardId === cardId) selectCard(null);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (highlightedZoneId && !placed[highlightedZoneId]) {
              assign(highlightedZoneId, cardId, dragFromZone);
              render();
            } else {
              if (selectedCardId === cardId) {
                selectCard(null);
              } else {
                selectCard(cardId);
              }
            }
          }
        });

        // Click-to-place fallback & tap-to-select.
        chip.addEventListener("click", () => {
          if (dragCardId) return;
          if (selectedCardId === cardId) {
            selectCard(null);
          } else {
            selectCard(cardId);
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

        // Attach pointermove + pointerup + pointercancel to WINDOW so the
        // drag continues even if the cursor leaves the source chip's
        // bounding box. The chip becomes `visibility: hidden` once the
        // ghost is created, and pointer-capture on a hidden element is
        // unreliable across browsers — global listeners are the
        // rock-solid fallback. (2026-06-28 fix: drag-out from placed
        // chips was failing because pointermove on the hidden chip
        // wasn't firing reliably.)
        window.addEventListener("pointermove", onWindowPointerMove);
        window.addEventListener("pointerup", onWindowPointerUp);
        window.addEventListener("pointercancel", onWindowPointerCancel);

        if (pointerId !== null && chip.setPointerCapture) {
          try {
            chip.setPointerCapture(pointerId);
          } catch (_) {}
        }
      }

      function onWindowPointerMove(e) {
        if (!dragCardId) return;
        if (
          dragPointerId !== null &&
          e.pointerId !== undefined &&
          e.pointerId !== dragPointerId
        ) {
          return;
        }
        moveDrag(e.clientX, e.clientY);
      }

      function onWindowPointerUp(e) {
        if (!dragCardId) return;
        if (
          dragPointerId !== null &&
          e.pointerId !== undefined &&
          e.pointerId !== dragPointerId
        ) {
          return;
        }
        e.preventDefault();
        endDrag(e.clientX, e.clientY);
      }

      function onWindowPointerCancel() {
        if (dragCardId) cancelDrag();
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
        // Detach the global pointer listeners that startDrag attached
        // so they don't fire on subsequent unrelated clicks elsewhere
        // on the page. (2026-06-28 fix.)
        window.removeEventListener("pointermove", onWindowPointerMove);
        window.removeEventListener("pointerup", onWindowPointerUp);
        window.removeEventListener("pointercancel", onWindowPointerCancel);
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
        if (usesDispenser) {
          trayLabel.textContent = "Next Item";
          const next = tray[0];
          if (next) {
            trayEl.appendChild(makeChip(next));
          } else {
            const done = document.createElement("span");
            done.className = "lab-drag-dispenser-empty";
            done.textContent = "All items placed";
            trayEl.appendChild(done);
          }
          const unit = tray.length === 1 ? "item" : "items";
          dispenserMeta.textContent =
            tray.length === 1
              ? `1 ${unit} still waiting`
              : `${tray.length} ${unit} still waiting`;
        } else {
          trayLabel.textContent = "Holy Items";
          tray.forEach((cid) => {
            const chip = makeChip(cid);
            if (chip) trayEl.appendChild(chip);
          });
        }
      }

      function renderZones() {
        Object.keys(zoneEls).forEach((zid) => {
          const el = zoneEls[zid];
          // Remove any placed-chip element but keep caption/sublabel/reveal.
          const placedChip = el.querySelector(".lab-tabernacle-placed");
          if (placedChip) placedChip.remove();
          el.classList.remove("wrong", "filled", "lab-tabernacle-key-focus", "lab-tabernacle-zone-selectable");

          if (selectedCardId && !placed[zid]) {
            el.classList.add("lab-tabernacle-zone-selectable");
          }

          // Reset reveal state. The reveal slot is populated ONLY when
          // a card has been placed in this zone — keeping the answer-name
          // hidden until the user earns it. (2026-06-28 anti-leak fix.)
          const revealEl = el.querySelector('[data-role="reveal"]');
          if (revealEl) revealEl.hidden = true;

          // Reset sidebar answer slot for this zone.
          const sidebarItem = sidebarList.querySelector(
            `[data-sidebar-for="${zid}"]`
          );
          const sidebarAnswer = sidebarItem?.querySelector(
            '[data-role="answer"]'
          );
          if (sidebarAnswer) {
            sidebarAnswer.hidden = true;
            sidebarAnswer.textContent = "";
          }
          if (sidebarItem) sidebarItem.classList.remove("filled");

          const cardId = placed[zid];
          if (!cardId) return;
          el.classList.add("filled");

          // Reveal the answer-name now that a card sits in this zone.
          if (revealEl) revealEl.hidden = false;

          const card = cards.find((c) => c.id === cardId);
          if (!card) return;

          // Populate sidebar answer slot with emoji + label of the
          // placed card. (Splitscreen: legend shows what's where.)
          if (sidebarAnswer && sidebarItem) {
            sidebarAnswer.textContent = card.emoji
              ? `${card.emoji} ${card.label}`
              : card.label;
            sidebarAnswer.hidden = false;
            sidebarItem.classList.add("filled");
          }

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
          // (2026-06-28 fix: removed per-chip pointermove + pointerup
          //  + pointercancel handlers — startDrag() now attaches global
          //  window-level listeners so the drag continues even after
          //  the source chip is hidden via visibility:hidden.)
          // (2026-06-29 fix: append the placed chip to the slot, not
          //  the zone wrapper, so the chip lands inside the drop
          //  target next to its label.)
          const slot = el.querySelector(".lab-tabernacle-slot") || el;
          slot.appendChild(placedChipEl);
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
          selectedCardId,
          dispenser: usesDispenser
            ? { current: tray[0] || null, remaining: tray.length }
            : null,
        };
      }

      // ---- Hint / medal -------------------------------------------------

      // Tier/persistence logic lives in the shared BibleBowlLabMedals helper.
      const TIER_LINE = {
        gold: "Mastered with no hints — every holy thing placed from memory alone.",
        silver: "Placed cleanly with a hint or two — the placements are known, the recall almost there.",
        bronze: "Placed with many hints — keep practicing until the map lives in your heart.",
      };

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
        const BB = window.BibleBowlLabMedals || {};
        const TIER_EMOJI = BB.TIER_EMOJI || { gold: "🥇", silver: "🥈", bronze: "🥉" };
        const TIER_LABEL = BB.TIER_LABEL || { gold: "GOLD", silver: "SILVER", bronze: "BRONZE" };
        const tierRank = BB.tierRank || function(t) {
          if (t === "gold") return 0;
          if (t === "silver") return 1;
          if (t === "bronze") return 2;
          return 3;
        };
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
        let tier, priorBest = null;
        if (window.BibleBowlLabMedals) {
          const result = window.BibleBowlLabMedals.recordAttempt(lab.id, hintsUsed);
          tier = result.tier;
          priorBest = result.prior;
        } else {
          tier = hintsUsed <= 0 ? "gold" : hintsUsed <= 2 ? "silver" : "bronze";
        }
        renderMedal(tier, hintsUsed, priorBest);
        if (callbacks && callbacks.onComplete) callbacks.onComplete();
        if (typeof window.BibleBowlPlaySound === "function")
          window.BibleBowlPlaySound("unlock");
      });

      resetBtn.addEventListener("click", () => {
        selectCard(null);
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
          return window.BibleBowlLabMedals ? window.BibleBowlLabMedals.tierFor(h) : (h <= 0 ? "gold" : h <= 2 ? "silver" : "bronze");
        },
        // Test hook: clear localStorage medal (for clean test runs).
        clearMedalForTest() {
          try {
            localStorage.removeItem(`bbs-medal:${lab.id}`);
          } catch (_) {}
        },
        // Test hook: read what medal would currently be persisted.
        readBestMedal() {
          return window.BibleBowlLabMedals ? window.BibleBowlLabMedals.readBest(lab.id) : null;
        },
        cleanup() {
          window.removeEventListener("orientationchange", onOrientationChange);
          if (dragCardId) cancelDrag();
          // Drop the root class we added on mount so the host workspace
          // returns to its plain .labs-workspace state for the next lab.
          container.classList.remove("lab-tabernacle-root");
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