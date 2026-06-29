/* Bible Bowl Study — Memory Labs drag-order engine */

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

  function plagueRegionHint(index) {
    const regions = [
      "water",
      "creatures",
      "creatures",
      "creatures (Dog-flies — LXX/OSB term)",
      "livestock / bodies",
      "bodies",
      "sky",
      "sky",
      "darkness",
      "firstborn",
    ];
    return regions[index] || "judgment";
  }

  function tribeMotherHint(index) {
    if (index < 4) return "Leah's first four sons";
    if (index < 6) return "Bilhah's two sons";
    if (index < 8) return "Zilpah's two sons";
    if (index < 10) return "Leah's last two sons";
    return "Rachel's two sons";
  }

  function consecrationPhaseHint(index) {
    if (index === 0) return "preparation";
    if (index <= 4) return "washing, vesting, and anointing";
    if (index <= 7) return "offerings and ordination";
    return "holy meal and seven days";
  }

  function failureHint(labId, userOrder, correct) {
    for (let i = 0; i < correct.length; i++) {
      if (userOrder[i] !== correct[i]) {
        if (labId === "plagues") {
          return `Check position ${i + 1}: think ${plagueRegionHint(i)} — expected "${correct[i]}".`;
        }
        if (labId === "tribes") {
          return `Check position ${i + 1}: ${tribeMotherHint(i)} — expected "${correct[i]}".`;
        }
        if (labId === "commandments") {
          if (i === 1) {
            return "Orthodox #2 is No Carved Images (distinct from #1). Catholic/Lutheran lists often combine these.";
          }
          if (i === 9) {
            return "Orthodox #10 keeps all coveting as one commandment.";
          }
          return `Commandment ${i + 1} should be "${correct[i]}". Remember: God first, then neighbor.`;
        }
        if (labId === "consecration") {
          return `Step ${i + 1} belongs to ${consecrationPhaseHint(i)} — expected "${correct[i]}".`;
        }
        return `Position ${i + 1} should be "${correct[i]}".`;
      }
    }
    return "Keep trying — match the Scripture order.";
  }

  let active = null;

  // Victory celebration primitives. Wraps the existing confetti system
  // (CONFETTI_COLORS, makeConfettiLayer, addPiece in app.js) so the drag
  // lab doesn't reinvent burst logic. Honors prefers-reduced-motion.
  function celebrateLabVictory(slotEls) {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const origin = slotEls.length
      ? slotEls[slotEls.length - 1].getBoundingClientRect()
      : { left: W / 2, top: H / 2, width: 0, height: 0 };
    const cx = origin.left + origin.width / 2;
    const cy = origin.top + origin.height / 2;

    // 90-piece radial burst from the last-filled slot — celebrates the
    // chip the user JUST placed (the climax of the activity).
    const layer = window.BibleBowlMakeConfettiLayer
      ? window.BibleBowlMakeConfettiLayer(3600)
      : null;
    if (!layer || !window.BibleBowlAddConfettiPiece) return;

    for (let i = 0; i < 90; i++) {
      const px = cx + (Math.random() - 0.5) * 60;
      const py = cy + (Math.random() - 0.5) * 30;
      const p = window.BibleBowlAddConfettiPiece(layer, px, py);
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 180;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + 60; // bias downward
      const rot = Math.random() * 720 - 360;
      const delay = Math.random() * 200;
      const dur = 1400 + Math.random() * 900;
      p.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: dur, delay, easing: "cubic-bezier(.2,.6,.4,1)" }
      ).onfinish = () => p.remove();
    }
  }

  window.BibleBowlLabDrag = {
    mount(container, lab, callbacks) {
      const correct = lab.ordered_items.slice();
      const slots = Array(correct.length).fill(null);
      let pool = shuffle(correct);
      let dragChip = null;
      let dragFrom = null;

      container.innerHTML = "";
      container.className = "lab-drag-root";

      const status = document.createElement("p");
      status.className = "lab-drag-status";
      status.textContent = "Drag each card into its numbered slot.";

      const slotsWrap = document.createElement("div");
      slotsWrap.className = "lab-drag-slots";

      const slotEls = correct.map((label, idx) => {
        const row = document.createElement("div");
        row.className = "lab-drag-slot-row";
        const num = document.createElement("span");
        num.className = "lab-drag-num";
        num.textContent = String(idx + 1);
        const drop = document.createElement("div");
        drop.className = "lab-drag-slot";
        drop.dataset.index = String(idx);
        drop.setAttribute("role", "listitem");
        if (lab.id === "commandments" && idx === 4) {
          row.classList.add("lab-table-divider");
        }
        row.appendChild(num);
        row.appendChild(drop);
        slotsWrap.appendChild(row);
        return drop;
      });

      const poolLabel = document.createElement("p");
      poolLabel.className = "lab-drag-pool-label";
      poolLabel.textContent = "Cards";

      const poolEl = document.createElement("div");
      poolEl.className = "lab-drag-pool";
      poolEl.setAttribute("role", "list");

      const actions = document.createElement("div");
      actions.className = "lab-drag-actions";

      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "primary-btn lab-check-btn";
      checkBtn.textContent = "Check order";

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "primary-btn ghost-btn lab-reset-btn";
      resetBtn.textContent = "Shuffle again";

      actions.appendChild(checkBtn);
      actions.appendChild(resetBtn);

      container.appendChild(status);
      if (lab.subtitle) {
        const sub = document.createElement("p");
        sub.className = "lab-drag-subtitle";
        sub.textContent = lab.subtitle;
        container.appendChild(sub);
      }
      if (lab.teacher_note) {
        const note = document.createElement("p");
        note.className = "lab-teacher-note";
        note.textContent = lab.teacher_note;
        container.appendChild(note);
      }
      container.appendChild(slotsWrap);
      container.appendChild(poolLabel);
      container.appendChild(poolEl);
      container.appendChild(actions);

      function renderPool() {
        poolEl.innerHTML = "";
        pool.forEach((label) => {
          poolEl.appendChild(makeChip(label, "pool", null));
        });
      }

      // Emoji lookup for memorable chip visuals. Falls back to "" if data
      // is missing so old labs keep working.
      const EMOJI_MAP = (lab.item_emojis && Array.isArray(lab.item_emojis))
        ? Object.fromEntries(lab.ordered_items.map((l, i) => [l, lab.item_emojis[i] || ""]))
        : {};

      // Module-level drag state. Only one chip drags at a time. The
      // floating "ghost" is a clone of the source chip appended to
      // document.body — it escapes the .labs-card overflow:auto scroll
      // container and uses CSS custom properties for compositor-friendly
      // per-frame updates.
      let dragGhost = null;       // body-level follower <button>
      let dragSourceEl = null;    // original chip (hidden via .dragging)
      let dragPointerId = null;
      let dragOffsetX = 0;        // pointer's offset within chip at grab
      let dragOffsetY = 0;
      let dragMoved = false;      // becomes true on first pointermove

      function clearDragOverHighlights() {
        const slots = container.querySelectorAll(".lab-drag-slot.drag-over");
        slots.forEach((s) => s.classList.remove("drag-over"));
      }

      function makeChip(label, from, index) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "lab-chip";
        chip.dataset.label = label;
        if (lab.id === "commandments" && label === "No Carved Images") {
          chip.title = "Orthodox #2 — distinct from #1";
        }
        if (lab.id === "plagues" && label === "Dog-flies") {
          chip.title = "LXX/OSB term — not generic flies";
        }

        // Render emoji + label inside the chip for memorability.
        const emoji = EMOJI_MAP[label];
        if (emoji) {
          const e = document.createElement("span");
          e.className = "lab-chip-emoji";
          e.setAttribute("aria-hidden", "true");
          e.textContent = emoji;
          chip.appendChild(e);
        }
        const lbl = document.createElement("span");
        lbl.className = "lab-chip-label";
        lbl.textContent = label;
        chip.appendChild(lbl);

        function startDrag(clientX, clientY, pointerId) {
          if (dragGhost) return; // already dragging something else
          dragChip = label;
          dragFrom = { from, index };
          dragMoved = false;
          dragPointerId = pointerId;

          const r = chip.getBoundingClientRect();
          dragOffsetX = clientX - r.left;
          dragOffsetY = clientY - r.top;

          // Hide source via .dragging (visibility:hidden — layout preserved,
          // non-hit-testable). ARIA announces it as "selected".
          chip.classList.add("dragging");
          chip.setAttribute("aria-pressed", "true");
          dragSourceEl = chip;

          // Build the floating body-level clone. CSS handles position:fixed
          // and z-index; we just set initial coords via CSS custom props.
          dragGhost = chip.cloneNode(true);
          dragGhost.classList.remove("dragging");
          dragGhost.classList.add("dragging-floating");
          dragGhost.style.setProperty("--drag-x", r.left + "px");
          dragGhost.style.setProperty("--drag-y", r.top + "px");
          dragGhost.style.width = r.width + "px";
          // Replace the clone's internal aria-pressed (was the source's).
          dragGhost.removeAttribute("aria-pressed");
          document.body.appendChild(dragGhost);

          // Capture the pointer on the SOURCE so move/up events flow even
          // when the finger leaves the source's bounds. The ghost does NOT
          // need capture (and shouldn't — only one capture per pointer id).
          if (pointerId !== null && chip.setPointerCapture) {
            try { chip.setPointerCapture(pointerId); } catch (_) {}
          }
        }

        function moveDrag(clientX, clientY) {
          if (!dragGhost || dragChip !== label) return;
          dragMoved = true;
          const x = clientX - dragOffsetX;
          const y = clientY - dragOffsetY;
          dragGhost.style.setProperty("--drag-x", x + "px");
          dragGhost.style.setProperty("--drag-y", y + "px");

          // Live drop-target highlight. Clear previous, find new.
          clearDragOverHighlights();
          const target = document.elementFromPoint(clientX, clientY);
          const slot = target && target.closest(".lab-drag-slot");
          if (slot) slot.classList.add("drag-over");
        }

        function endDrag(clientX, clientY) {
          if (dragChip !== label) return;
          const target = document.elementFromPoint(clientX, clientY);
          const slot = target && target.closest(".lab-drag-slot");
          const poolTarget = target && target.closest(".lab-drag-pool");
          let returnedToPool = false;
          if (slot) {
            placeInSlot(Number(slot.dataset.index), dragChip, dragFrom);
          } else if (poolTarget) {
            returnToPool(dragChip, dragFrom);
            returnedToPool = true;
          }
          cleanupDragState();
          if (returnedToPool) flashPoolReturn();
          renderAll();
        }

        function cancelDrag() {
          if (dragChip !== label) return;
          cleanupDragState();
          // renderAll not strictly needed because source is still in DOM
          // and data hasn't changed; but call it to ensure any visual
          // artefacts are cleared.
          renderAll();
        }

        function cleanupDragState() {
          // Remove ghost first so it disappears visually, then unhide source.
          if (dragGhost) {
            dragGhost.remove();
            dragGhost = null;
          }
          if (dragSourceEl) {
            dragSourceEl.classList.remove("dragging");
            dragSourceEl.removeAttribute("aria-pressed");
            dragSourceEl = null;
          }
          clearDragOverHighlights();
          dragChip = null;
          dragFrom = null;
          dragOffsetX = 0;
          dragOffsetY = 0;
          dragMoved = false;
          dragPointerId = null;
        }

        function flashPoolReturn() {
          // Brief background flash so returning-to-pool feels acknowledged.
          poolEl.classList.remove("return-flash");
          // Force reflow so the animation restarts even on rapid drops.
          void poolEl.offsetWidth;
          poolEl.classList.add("return-flash");
          setTimeout(() => poolEl.classList.remove("return-flash"), 280);
        }

        // ---- POINTER PATH (covers mouse, trackpad, touch, pen).
        //      setPointerCapture on the source routes move/up to it even
        //      when the pointer leaves its bounds. The ghost has no
        //      pointer events (CSS) so it never steals the capture. ----
        chip.addEventListener("pointerdown", (e) => {
          if (e.button !== undefined && e.button !== 0) return; // left only
          e.preventDefault();
          startDrag(e.clientX, e.clientY, e.pointerId);
        });
        chip.addEventListener("pointermove", (e) => {
          if (dragChip !== label) return;
          moveDrag(e.clientX, e.clientY);
        });
        chip.addEventListener("pointerup", (e) => {
          if (dragChip !== label) return;
          e.preventDefault();
          endDrag(e.clientX, e.clientY);
        });
        chip.addEventListener("pointercancel", () => {
          cancelDrag();
        });

        // Esc cancels the drag — gives keyboard users an escape hatch.
        chip.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && dragChip === label) {
            e.preventDefault();
            cancelDrag();
          }
        });

        // Keyboard / click-to-fill: still works for a11y and tap-only users.
        chip.addEventListener("click", (e) => {
          if (dragChip) return;
          e.preventDefault();
          const empty = slots.findIndex((s) => !s);
          if (empty >= 0 && from === "pool") {
            placeInSlot(empty, label, dragFrom);
            renderAll();
          }
        });

        return chip;
      }

      function placeInSlot(index, label, from) {
        if (from.from === "slot" && from.index !== null) {
          slots[from.index] = null;
        } else if (from.from === "pool") {
          pool = pool.filter((x) => x !== label);
        }
        if (slots[index]) {
          pool.push(slots[index]);
        }
        slots[index] = label;
      }

      function returnToPool(label, from) {
        if (from.from === "slot" && from.index !== null) {
          slots[from.index] = null;
        }
        if (!pool.includes(label)) pool.push(label);
      }

      function renderSlots() {
        slotEls.forEach((drop, idx) => {
          drop.innerHTML = "";
          drop.classList.remove("filled", "wrong");
          if (slots[idx]) {
            drop.classList.add("filled");
            drop.appendChild(makeChip(slots[idx], "slot", idx));
          }
        });
      }

      function renderAll() {
        renderSlots();
        renderPool();
        active.state = { slots: slots.slice(), pool: pool.slice(), complete: false };
      }

      function userOrder() {
        return slots.slice();
      }

      checkBtn.addEventListener("click", () => {
        if (slots.some((s) => !s)) {
          status.textContent = "Fill every slot before checking.";
          status.className = "lab-drag-status lab-hint";
          return;
        }
        const order = userOrder();
        const ok = order.every((v, i) => v === correct[i]);
        if (ok) {
          status.textContent = lab.completion_teaching.memory_sentence;
          status.className = "lab-drag-status lab-success victory";
          slotEls.forEach((d, i) => {
            d.classList.add("filled", "victory");
            d.style.animationDelay = (i * 35) + "ms";
          });
          checkBtn.disabled = true;
          active.state.complete = true;
          // onComplete owns the modal-level celebration (sound + status
          // text). Drag engine owns the in-lab burst + slot cascade.
          celebrateLabVictory(slotEls);
          if (callbacks && callbacks.onComplete) callbacks.onComplete();
        } else {
          status.textContent = failureHint(lab.id, order, correct);
          status.className = "lab-drag-status lab-hint";
          order.forEach((v, i) => {
            if (v !== correct[i]) slotEls[i].classList.add("wrong");
          });
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("thunder");
        }
      });

      resetBtn.addEventListener("click", () => {
        for (let i = 0; i < slots.length; i++) slots[i] = null;
        pool = shuffle(correct);
        status.textContent = "Drag each card into its numbered slot.";
        status.className = "lab-drag-status";
        checkBtn.disabled = false;
        renderAll();
      });

      active = {
        labId: lab.id,
        correct,
        state: { slots: [], pool: [], complete: false },
        setOrder(labels) {
          for (let i = 0; i < slots.length; i++) slots[i] = labels[i] || null;
          pool = correct.filter((x) => !labels.includes(x));
          renderAll();
        },
        check() {
          checkBtn.click();
        },
      };

      renderAll();
      return active;
    },

    getActive() {
      return active;
    },

    unmount() {
      active = null;
    },
  };
})();
