/* reading-plan.js — renders reading-plan.json as a week-by-week list.
   Each row shows the week number, book + chapter range, a summary, an
   external NKJV link (Bible Gateway), and a prefilled seed-submission
   Google Form link. Pure browser JS (ES module), framework-free.
   No dependency on the quiz engine. */
"use strict";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function a(href, cls, text) {
  const n = el("a", cls, text);
  n.href = href;
  n.target = "_blank";
  n.rel = "noopener";
  return n;
}

// Bible Gateway NKJV URL for a reference string (matches engine/passage-links).
function gatewayUrl(reference) {
  const v = encodeURIComponent("NKJV");
  const r = encodeURIComponent(reference || "");
  return `https://www.biblegateway.com/passage/?search=${r}&version=${v}`;
}

// Build a prefilled Google Form link from form-config + a week assignment.
// `form` is the parsed form-config.json; `entry` is an entry-id map by name.
function seedFormUrl(form, week) {
  if (!form || !form.formBaseUrl) return "#";
  const base = form.formBaseUrl.split("?")[0];
  const params = new URLSearchParams();
  const book = week.book || "";
  const chapter = (week.chapters && week.chapters.length)
    ? (week.chapters.length === 1
        ? String(week.chapters[0])
        : `${week.chapters[0]}-${week.chapters[week.chapters.length - 1]}`)
    : (week.reference || "");
  const entryMap = {};
  if (Array.isArray(form.fields)) {
    form.fields.forEach((f) => {
      if (f.name && f.entryId != null) entryMap[f.name] = String(f.entryId);
    });
  }
  // entry IDs are PLACEHOLDER values; still build the prefilled URL shape.
  if (entryMap.book) params.set(`entry.${entryMap.book}`, book);
  if (entryMap.chapter) params.set(`entry.${entryMap.chapter}`, chapter);
  if (entryMap.kind) params.set(`entry.${entryMap.kind}`, "question_seed");
  if (entryMap.note) params.set(`entry.${entryMap.note}`, "");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function loadPlan() {
  try {
    const [planRes, formRes] = await Promise.all([
      fetch("data/reading-plan.json", { cache: "no-cache" }),
      fetch("data/form-config.json", { cache: "no-cache" }),
    ]);
    if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`);
    const plan = await planRes.json();
    let form = null;
    if (formRes.ok) {
      try { form = await formRes.json(); } catch (e) { form = null; }
    }
    renderPlan(plan, form);
  } catch (err) {
    const e = $("plan-error");
    if (e) {
      e.hidden = false;
      e.textContent =
        "Could not load reading plan (" + err.message +
        "). If you opened this file directly, run a local server.";
    }
  }
}

function renderPlan(plan, form) {
  const title = $("plan-title");
  if (title && plan.title) title.textContent = plan.title;
  const desc = $("plan-description");
  if (desc && plan.description) desc.textContent = plan.description;

  const container = $("plan-weeks");
  if (!container) return;
  container.innerHTML = "";

  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  weeks.forEach((w) => {
    const card = el("div", "card plan-week");
    const head = el("div", "plan-week-head");
    head.appendChild(el("span", "plan-week-num", `Week ${w.week}`));
    head.appendChild(el("span", "tag tag-ref", `${w.book} ${chapterRange(w)}`));
    card.appendChild(head);

    if (w.summary) card.appendChild(el("p", "muted", w.summary));

    const links = el("div", "plan-week-links");
    const readRef = w.reference || `${w.book} ${chapterRange(w)}`;
    const readUrl = w.readUrl || gatewayUrl(readRef);
    links.appendChild(a(readUrl, "primary-btn", `Read ${readRef} on Bible Gateway ↗`));

    const seedUrl = (w.seedFormUrl && w.seedFormUrl.indexOf("PLACEHOLDER") === -1)
      ? w.seedFormUrl
      : seedFormUrl(form, w);
    const seed = a(seedUrl, "link-btn", "Submit a seed for this reading →");
    if (seedUrl && seedUrl.indexOf("PLACEHOLDER") !== -1) {
      seed.title = "Form not yet created — link is a placeholder.";
    }
    links.appendChild(seed);
    card.appendChild(links);

    container.appendChild(card);
  });
}

function chapterRange(w) {
  if (!w.chapters || !w.chapters.length) return w.reference || "";
  if (w.chapters.length === 1) return `ch. ${w.chapters[0]}`;
  return `ch. ${w.chapters[0]}–${w.chapters[w.chapters.length - 1]}`;
}

loadPlan();