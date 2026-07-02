(function (global) {
  "use strict";

  const CHANGELOG = [
    {
      date: "2026-07-02",
      title: "Aligned quiz wording to our Bible (Orthodox Study Bible, St. Athanasius Academy Septuagint)",
      intro:
        "We reviewed every question against the OSB text in this app and corrected wording that came from a different translation, so what you study matches what you'll be quizzed on.",
      items: [
        {
          reference: "Exodus 17:7",
          change: 'the place Israel tested the Lord is named "Temptation and Abuse"',
          previous: '"Massah and Meribah"',
        },
        {
          reference: "Exodus 10:13",
          change: "the locusts were brought on a south wind",
          previous: '"east wind"',
        },
        {
          reference: "Exodus 16:16",
          change: "each person gathered one omer of manna",
          previous: '"a homer"',
        },
        {
          reference: "Exodus 9:32",
          change: "the wheat and the rye survived the hail",
          previous: '"spelt"',
        },
        {
          reference: "Exodus 12:11",
          change: 'the verse now reads, "It is the Lord\'s Pascha"',
          previous: '"Passover"',
        },
        {
          reference: "Exodus 16:35",
          change: "the manna stopped at the border of Phoenicia",
          previous: '"Canaan"',
        },
        {
          reference: "Exodus 19:5",
          change: 'Israel is God\'s "special people" above all nations',
          previous: '"treasure"',
        },
        {
          reference: "Exodus 33:18",
          change: 'Moses asked God, "Reveal Yourself to me"',
          previous: '"Show me Your glory"',
        },
        {
          reference: "Exodus 40",
          change: "the tabernacle and cloud verse references were corrected to match the OSB Septuagint numbering",
          previous: "older verse numbering",
        },
      ],
    },
  ];

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CHANGELOG };
  }

  if (!global || !global.document) return;

  const document = global.document;
  const trigger = document.getElementById("open-updates");

  if (!trigger) return;

  const el = function (tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  let modal = null;
  let closeBtn = null;
  let lastFocused = null;

  function ensureModal() {
    if (modal) return;

    modal = el("div", "reader-modal updates-modal");
    modal.id = "updates-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "updates-title");
    modal.setAttribute("aria-hidden", "true");

    const card = el("div", "reader-card updates-card");
    const header = el("header", "reader-header updates-header");
    const heading = el("div", "updates-heading");
    const kicker = el("p", "updates-kicker", "Bible Bowl Study");
    const title = el("h2", "reader-title", "What's New");
    title.id = "updates-title";

    closeBtn = el("button", "reader-close-btn", "x");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close updates");

    heading.append(kicker, title);
    header.append(heading, closeBtn);
    card.append(header, buildBody());
    modal.appendChild(card);
    document.body.appendChild(modal);

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    closeBtn.addEventListener("click", closeModal);
  }

  function buildBody() {
    const body = el("div", "reader-body updates-body");
    CHANGELOG.forEach(function (entry) {
      const section = el("section", "updates-entry");
      const title = el("h3", "updates-entry-title");
      const time = el("time", "", entry.date);
      time.dateTime = entry.date;
      title.append(time, document.createTextNode(" - " + entry.title));

      const intro = el("p", "updates-entry-intro", entry.intro);
      const list = el("ul", "updates-list");

      entry.items.forEach(function (item) {
        const row = el("li", "");
        const reference = el("strong", "updates-reference", item.reference);
        const note = el("span", "updates-note", "Previously: " + item.previous + ".");
        row.append(reference, document.createTextNode(" - " + item.change + "."), note);
        list.appendChild(row);
      });

      section.append(title, intro, list);
      body.appendChild(section);
    });
    return body;
  }

  function isOpen() {
    return !!modal && modal.classList.contains("active");
  }

  function openModal() {
    ensureModal();
    if (isOpen()) return;
    lastFocused = document.activeElement instanceof global.HTMLElement ? document.activeElement : trigger;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    closeBtn.focus();
  }

  function closeModal() {
    if (!modal || !isOpen()) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    const restoreTarget = lastFocused && typeof lastFocused.focus === "function" ? lastFocused : trigger;
    lastFocused = null;
    if (restoreTarget && typeof restoreTarget.focus === "function") {
      restoreTarget.focus();
    }
  }

  trigger.addEventListener("click", openModal);
  document.addEventListener("keydown", function (event) {
    if (!isOpen() || event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
