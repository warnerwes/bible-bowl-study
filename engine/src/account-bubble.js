"use strict";

function clearNode(node) {
  if (!node) return;
  if (typeof node.replaceChildren === "function") {
    node.replaceChildren();
    return;
  }
  node.textContent = "";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function initialsFor(name) {
  return String(name || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function daysLeft(expiresAt, now = Date.now()) {
  const delta = Math.max(0, expiresAt - now);
  const days = Math.floor(delta / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  const hours = Math.max(1, Math.ceil(delta / (60 * 60 * 1000)));
  return `${hours} hour${hours === 1 ? "" : "s"} left`;
}

export function mountAccountBubble({ root, onSignOut = () => {}, now = () => Date.now() }) {
  if (!root) {
    return { close() {}, render() {} };
  }

  let toggle = null;
  let menu = null;
  let open = false;

  function close() {
    if (!menu) return;
    open = false;
    menu.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
  }

  function render(state) {
    clearNode(root);
    if (!state || state.kind !== "google") {
      root.hidden = true;
      toggle = null;
      menu = null;
      return;
    }

    root.hidden = false;
    toggle = el("button", "reader-account-toggle", initialsFor(state.name));
    toggle.type = "button";
    toggle.setAttribute("aria-haspopup", "menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", `Account menu for ${state.name}`);

    menu = el("div", "reader-account-menu");
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.appendChild(el("p", "reader-account-name", state.name));
    menu.appendChild(el("p", "reader-account-usage muted", `Checkouts left: ${state.remaining} of 20`));

    const ownedList = el("ul", "reader-account-weeks");
    for (const week of state.ownedWeeks || []) {
      const item = el("li", "reader-account-week", `${week.label} · ${daysLeft(Number(week.expiresAt || now()), now())}`);
      ownedList.appendChild(item);
    }
    if (ownedList.children.length) {
      menu.appendChild(ownedList);
    }

    const signOut = el("button", "link-btn reader-account-signout", "Sign out");
    signOut.type = "button";
    signOut.addEventListener("click", () => {
      close();
      onSignOut();
    });
    menu.appendChild(signOut);

    toggle.addEventListener("click", () => {
      open = !open;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });

    root.appendChild(toggle);
    root.appendChild(menu);
  }

  document.addEventListener("click", (event) => {
    if (!root.contains || !open) return;
    if (!root.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return { close, render };
}
