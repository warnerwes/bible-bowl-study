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

      function makeChip(label, from, index) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "lab-chip";
        chip.textContent = label;
        chip.dataset.label = label;
        if (lab.id === "commandments" && label === "No Carved Images") {
          chip.title = "Orthodox #2 — distinct from #1";
        }
        if (lab.id === "plagues" && label === "Dog-flies") {
          chip.title = "LXX/OSB term — not generic flies";
        }

        chip.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          dragChip = label;
          dragFrom = { from, index };
          chip.classList.add("dragging");
          chip.setPointerCapture(e.pointerId);
        });
        // Touch fallback for browsers that don't fire pointer events
        // on tap-and-hold (older Android Chrome, in-app webviews).
        // Mirrors the pointerdown/pointerup behaviour using touch coords.
        chip.addEventListener("touchstart", (e) => {
          if (dragChip) return;
          e.preventDefault();
          dragChip = label;
          dragFrom = { from, index };
          chip.classList.add("dragging");
        }, { passive: false });
        chip.addEventListener("touchend", (e) => {
          if (!dragChip) return;
          e.preventDefault();
          chip.classList.remove("dragging");
          const touch = e.changedTouches[0];
          const target = document.elementFromPoint(touch.clientX, touch.clientY);
          const slot = target && target.closest(".lab-drag-slot");
          const poolTarget = target && target.closest(".lab-drag-pool");
          if (slot) {
            placeInSlot(Number(slot.dataset.index), dragChip, dragFrom);
          } else if (poolTarget) {
            returnToPool(dragChip, dragFrom);
          }
          dragChip = null;
          dragFrom = null;
          renderAll();
        }, { passive: false });
        chip.addEventListener("touchcancel", () => {
          if (!dragChip) return;
          chip.classList.remove("dragging");
          dragChip = null;
          dragFrom = null;
        });
        chip.addEventListener("pointerup", (e) => {
          chip.classList.remove("dragging");
          if (!dragChip) return;
          const target = document.elementFromPoint(e.clientX, e.clientY);
          const slot = target && target.closest(".lab-drag-slot");
          const poolTarget = target && target.closest(".lab-drag-pool");
          if (slot) {
            placeInSlot(Number(slot.dataset.index), dragChip, dragFrom);
          } else if (poolTarget) {
            returnToPool(dragChip, dragFrom);
          }
          dragChip = null;
          dragFrom = null;
          renderAll();
        });
        chip.addEventListener("click", () => {
          if (dragChip) return;
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
          status.className = "lab-drag-status lab-success";
          slotEls.forEach((d) => d.classList.add("filled"));
          checkBtn.disabled = true;
          active.state.complete = true;
          if (callbacks && callbacks.onComplete) callbacks.onComplete();
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("chime");
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
