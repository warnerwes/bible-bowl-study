/* Bible Bowl Study — Memory Labs priest tree engine */

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

  window.BibleBowlLabTree = {
    mount(container, lab, callbacks) {
      const slots = lab.tree_slots.slice();
      const correct = {};
      slots.forEach((s) => {
        correct[s.id] = s.accept;
      });
      const filled = {};
      let tray = shuffle(lab.tree_chips.slice());
      let selectedSlot = null;
      let hintsUsed = 0;
      let complete = false;

      container.innerHTML = "";
      container.className = "lab-tree-root";

      const status = document.createElement("p");
      status.className = "lab-drag-status";
      status.textContent = "Place each name in the correct slot on the family tree.";

      const tree = document.createElement("div");
      tree.className = "lab-tree-board";

      const slotEls = {};
      slots.forEach((spec) => {
        const cell = document.createElement("div");
        cell.className = "lab-tree-cell";
        if (spec.side) cell.classList.add("lab-tree-side");
        if (spec.branch) cell.classList.add("lab-tree-branch-" + spec.branch);
        cell.style.setProperty("--row", String(spec.row));

        const cap = document.createElement("span");
        cap.className = "lab-tree-caption";
        cap.textContent = spec.label;

        const drop = document.createElement("div");
        drop.className = "lab-tree-slot";
        drop.dataset.slotId = spec.id;
        drop.dataset.accept = spec.accept;

        cell.appendChild(cap);
        cell.appendChild(drop);
        tree.appendChild(cell);
        slotEls[spec.id] = drop;
      });

      const trayLabel = document.createElement("p");
      trayLabel.className = "lab-drag-pool-label";
      trayLabel.textContent = "Names";

      const trayEl = document.createElement("div");
      trayEl.className = "lab-drag-pool";

      const trayMeta = document.createElement("p");
      trayMeta.className = "lab-drag-dispenser-meta";

      const dispenserWrap = document.createElement("div");
      dispenserWrap.className = "lab-drag-dispenser";
      dispenserWrap.appendChild(trayLabel);
      dispenserWrap.appendChild(trayEl);
      dispenserWrap.appendChild(trayMeta);

      const actions = document.createElement("div");
      actions.className = "lab-drag-actions";
      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "primary-btn lab-check-btn";
      checkBtn.textContent = "Check tree";
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

      const hintCounter = document.createElement("span");
      hintCounter.className = "lab-tabernacle-hint-counter";
      hintCounter.setAttribute("aria-live", "polite");
      actions.appendChild(hintCounter);

      container.appendChild(status);
      container.appendChild(tree);
      container.appendChild(dispenserWrap);
      container.appendChild(actions);

      function wrongBranchMessage(name, slotId) {
        if ((name === "Gershom" || name === "Eliezer") && slotId.startsWith("nadab")) {
          return "Moses' sons are not the Aaronic priestly line.";
        }
        if ((name === "Gershom" || name === "Eliezer") && ["nadab", "abihu", "eleazar", "ithamar", "phinehas", "aaron"].some((p) => slotId.includes(p) || slotId === "aaron")) {
          return "Gershom and Eliezer belong under Moses, not Aaron.";
        }
        if (name === "Eleazar" && slotId === "eliezer") {
          return "Eleazar (Aaron's son) is not Eliezer (Moses' son).";
        }
        if (name === "Eliezer" && slotId === "eleazar") {
          return "Eliezer (Moses' son) is not Eleazar (Aaron's son).";
        }
        if (["Nadab", "Abihu", "Eleazar", "Ithamar", "Phinehas"].includes(name) && (slotId === "gershom" || slotId === "eliezer" || slotId === "moses")) {
          return "Aaron's priestly sons belong under Aaron's branch.";
        }
        return `"${name}" does not belong in this slot.`;
      }

      function makeChip(name, fromSlot) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "lab-chip";
        chip.dataset.name = name;
        if (fromSlot) chip.dataset.slotId = fromSlot;
        chip.disabled = complete;
        if (fromSlot && selectedSlot === fromSlot) {
          chip.classList.add("lab-chip-selected");
          chip.setAttribute("aria-pressed", "true");
        }
        chip.textContent = name;
        if (name === "Eleazar" || name === "Eliezer") {
          chip.title = name === "Eleazar" ? "Aaron's son" : "Moses' son";
        }
        chip.addEventListener("click", (e) => {
          if (complete) return;
          e.stopPropagation();
          if (fromSlot) {
            if (selectedSlot && selectedSlot !== fromSlot) {
              assign(fromSlot, filled[selectedSlot], selectedSlot);
              render();
              return;
            }
            selectedSlot = selectedSlot === fromSlot ? null : fromSlot;
            status.textContent = selectedSlot
              ? `Tap another family slot to move ${name}.`
              : "Place each name in the correct slot on the family tree.";
            status.className = "lab-drag-status";
            render();
            return;
          }
          status.textContent = "Tap the family slot where this name belongs.";
          status.className = "lab-drag-status";
        });
        return chip;
      }

      function assign(slotId, name, fromSlot) {
        if (complete) return;
        if (fromSlot) {
          if (fromSlot === slotId) return;
          const moving = filled[fromSlot];
          if (!moving) return;
          const displaced = filled[slotId] || null;
          delete filled[fromSlot];
          filled[slotId] = moving;
          if (displaced) filled[fromSlot] = displaced;
          selectedSlot = null;
          return;
        }
        if (filled[slotId]) {
          tray.unshift(filled[slotId]);
        }
        filled[slotId] = name;
        tray = tray.filter((n) => n !== name);
      }

      function renderTray() {
        trayEl.innerHTML = "";
        trayLabel.textContent = "Next name";
        if (tray[0]) {
          trayEl.appendChild(makeChip(tray[0], null));
        } else {
          const done = document.createElement("span");
          done.className = "lab-drag-dispenser-empty";
          done.textContent = "All names placed";
          trayEl.appendChild(done);
        }
        trayMeta.textContent =
          tray.length === 1
            ? "1 name still waiting"
            : `${tray.length} names still waiting`;
      }

      function renderSlots() {
        slots.forEach((spec) => {
          const drop = slotEls[spec.id];
          drop.innerHTML = "";
          drop.classList.remove("filled", "wrong", "lab-hint-reveal");
          const name = filled[spec.id];
          if (name) {
            drop.classList.add("filled");
            drop.appendChild(makeChip(name, spec.id));
          }
        });
      }

      function render() {
        renderSlots();
        renderTray();
        updateHintCounter();
        active.state = {
          filled: { ...filled },
          tray: tray.slice(),
          hintsUsed,
          complete,
        };
      }

      function updateHintCounter() {
        hintCounter.textContent = `Hints: ${hintsUsed}`;
      }

      function clearHintReveal() {
        container
          .querySelectorAll(".lab-hint-reveal")
          .forEach((el) => el.classList.remove("lab-hint-reveal"));
      }

      function pulseHint(el) {
        if (!el) return;
        el.classList.add("lab-hint-reveal");
        setTimeout(() => el.classList.remove("lab-hint-reveal"), 1600);
      }

      function chipForName(name) {
        return [...container.querySelectorAll(".lab-chip")].find(
          (chip) => chip.dataset.name === name
        );
      }

      function revealOneHint() {
        if (tray.length) {
          const name = tray[0];
          const spec = slots.find((s) => s.accept === name);
          if (spec && filled[spec.id] !== name) {
            requestAnimationFrame(() => {
              pulseHint(chipForName(name));
              pulseHint(slotEls[spec.id]);
            });
            return true;
          }
        }
        const spec = slots.find((s) => filled[s.id] !== s.accept);
        if (!spec) return false;
        requestAnimationFrame(() => {
          pulseHint(chipForName(spec.accept));
          pulseHint(slotEls[spec.id]);
        });
        return true;
      }

      slots.forEach((spec) => {
        const drop = slotEls[spec.id];
        drop.addEventListener("click", () => {
          if (complete) return;
          if (selectedSlot) {
            assign(spec.id, filled[selectedSlot], selectedSlot);
            render();
            return;
          }
          if (!tray.length) return;
          assign(spec.id, tray[0]);
          render();
        });
      });

      checkBtn.addEventListener("click", () => {
        if (complete) return;
        const missing = slots.filter((s) => !filled[s.id]);
        if (missing.length) {
          status.textContent = "Fill every slot on the tree.";
          status.className = "lab-drag-status lab-hint";
          return;
        }
        let ok = true;
        let msg = "";
        for (const spec of slots) {
          if (filled[spec.id] !== spec.accept) {
            ok = false;
            msg = wrongBranchMessage(filled[spec.id], spec.id);
            slotEls[spec.id].classList.add("wrong");
            break;
          }
        }
        if (ok) {
          complete = true;
          status.textContent = lab.completion_teaching.memory_sentence;
          status.className = "lab-drag-status lab-success";
          checkBtn.disabled = true;
          hintBtn.disabled = true;
          container.querySelectorAll(".lab-chip").forEach((chip) => {
            chip.disabled = true;
          });
          active.state.complete = complete;
          active.state.hintsUsed = hintsUsed;
          if (callbacks && callbacks.onComplete) callbacks.onComplete();
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("chime");
        } else {
          status.textContent = msg;
          status.className = "lab-drag-status lab-hint";
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("thunder");
        }
      });

      hintBtn.addEventListener("click", () => {
        if (active.state.complete) return;
        if (!revealOneHint()) {
          status.textContent = "Everything is already in the right place.";
          status.className = "lab-drag-status";
          return;
        }
        hintsUsed++;
        updateHintCounter();
        active.state.hintsUsed = hintsUsed;
      });

      resetBtn.addEventListener("click", () => {
        Object.keys(filled).forEach((k) => delete filled[k]);
        tray = shuffle(lab.tree_chips.slice());
        selectedSlot = null;
        hintsUsed = 0;
        complete = false;
        clearHintReveal();
        status.textContent = "Place each name in the correct slot on the family tree.";
        status.className = "lab-drag-status";
        checkBtn.disabled = false;
        hintBtn.disabled = false;
        render();
      });

      active = {
        labId: lab.id,
        state: { filled: {}, tray: [], hintsUsed: 0, complete: false },
        fillCorrect() {
          if (complete) return;
          slots.forEach((s) => {
            filled[s.id] = s.accept;
          });
          tray = [];
          selectedSlot = null;
          render();
        },
        check() {
          checkBtn.click();
        },
        hintCount() {
          return hintsUsed;
        },
      };

      render();
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
