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
      let dragName = null;
      let dragFromSlot = null;

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

      const actions = document.createElement("div");
      actions.className = "lab-drag-actions";
      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "primary-btn lab-check-btn";
      checkBtn.textContent = "Check tree";
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "primary-btn ghost-btn lab-reset-btn";
      resetBtn.textContent = "Reset";
      actions.appendChild(checkBtn);
      actions.appendChild(resetBtn);

      container.appendChild(status);
      container.appendChild(tree);
      container.appendChild(trayLabel);
      container.appendChild(trayEl);
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

      function makeChip(name) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "lab-chip";
        chip.textContent = name;
        if (name === "Eleazar" || name === "Eliezer") {
          chip.title = name === "Eleazar" ? "Aaron's son" : "Moses' son";
        }
        chip.addEventListener("click", () => {
          const empty = slots.find((s) => !filled[s.id]);
          if (empty && tray.includes(name)) {
            assign(empty.id, name);
            render();
          }
        });
        return chip;
      }

      function assign(slotId, name, fromSlot) {
        if (fromSlot && filled[fromSlot]) {
          tray.push(filled[fromSlot]);
          delete filled[fromSlot];
        }
        if (filled[slotId]) {
          tray.push(filled[slotId]);
        }
        filled[slotId] = name;
        tray = tray.filter((n) => n !== name);
      }

      function renderTray() {
        trayEl.innerHTML = "";
        tray.forEach((name) => trayEl.appendChild(makeChip(name)));
      }

      function renderSlots() {
        slots.forEach((spec) => {
          const drop = slotEls[spec.id];
          drop.innerHTML = "";
          drop.classList.remove("filled", "wrong");
          const name = filled[spec.id];
          if (name) {
            drop.classList.add("filled");
            const chip = makeChip(name);
            chip.addEventListener("click", () => {
              delete filled[spec.id];
              tray.push(name);
              render();
            });
            drop.appendChild(chip);
          }
        });
      }

      function render() {
        renderSlots();
        renderTray();
        active.state = { filled: { ...filled }, tray: tray.slice(), complete: false };
      }

      slots.forEach((spec) => {
        const drop = slotEls[spec.id];
        drop.addEventListener("click", () => {
          if (!tray.length) return;
          assign(spec.id, tray[0]);
          render();
        });
      });

      checkBtn.addEventListener("click", () => {
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
          status.textContent = lab.completion_teaching.memory_sentence;
          status.className = "lab-drag-status lab-success";
          checkBtn.disabled = true;
          active.state.complete = true;
          if (callbacks && callbacks.onComplete) callbacks.onComplete();
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("chime");
        } else {
          status.textContent = msg;
          status.className = "lab-drag-status lab-hint";
          if (typeof window.BibleBowlPlaySound === "function") window.BibleBowlPlaySound("thunder");
        }
      });

      resetBtn.addEventListener("click", () => {
        Object.keys(filled).forEach((k) => delete filled[k]);
        tray = shuffle(lab.tree_chips.slice());
        status.textContent = "Place each name in the correct slot on the family tree.";
        status.className = "lab-drag-status";
        checkBtn.disabled = false;
        render();
      });

      active = {
        labId: lab.id,
        state: { filled: {}, tray: [], complete: false },
        fillCorrect() {
          slots.forEach((s) => {
            filled[s.id] = s.accept;
          });
          tray = [];
          render();
        },
        check() {
          checkBtn.click();
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
