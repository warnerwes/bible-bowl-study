"use strict";

import { loadConfig } from "./config.js";
import { passageLabel, passageUrl } from "./passage-links.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function link(href, cls, text, isExternal) {
  const node = el("a", cls, text);
  node.href = href;
  if (isExternal) {
    node.target = "_blank";
    node.rel = "noopener";
  }
  return node;
}

export function chapterRange(week) {
  if (!week.chapters || !week.chapters.length) return week.reference || "";
  if (week.chapters.length === 1) return `ch. ${week.chapters[0]}`;
  return `ch. ${week.chapters[0]}-${week.chapters[week.chapters.length - 1]}`;
}

function weekReference(week) {
  if (week.reference) return week.reference;
  if (!week.chapters || !week.chapters.length) return week.book || "";
  if (week.chapters.length === 1) return `${week.book} ${week.chapters[0]}`;
  return `${week.book} ${week.chapters[0]}-${week.chapters[week.chapters.length - 1]}`;
}

export function createSeedFormUrl(form, week) {
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
    form.fields.forEach((field) => {
      if (field.name && field.entryId != null) entryMap[field.name] = String(field.entryId);
    });
  }
  const kindField = Array.isArray(form.fields)
    ? form.fields.find((field) => field && field.name === "kind")
    : null;
  const kindOpt = kindField && Array.isArray(kindField.options)
    ? kindField.options.find((opt) => opt && opt.value === "question_seed")
    : null;
  const kindLabel = kindOpt && kindOpt.label ? kindOpt.label : "question_seed";
  if (entryMap.book) params.set(`entry.${entryMap.book}`, book);
  if (entryMap.chapter) params.set(`entry.${entryMap.chapter}`, chapter);
  if (entryMap.kind) params.set(`entry.${entryMap.kind}`, kindLabel);
  if (entryMap.note) params.set(`entry.${entryMap.note}`, "");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildReadLink(week, config) {
  const ref = weekReference(week);
  const url = passageUrl(ref, {
    provider: config.passageProvider,
    bibleVersion: config.bibleVersion,
  });
  return {
    href: url,
    label: passageLabel(ref, { provider: config.passageProvider }),
    external: /^https?:\/\//i.test(url),
  };
}

export function renderPlan(plan, form, config) {
  const title = $("plan-title");
  if (title && plan.title) title.textContent = plan.title;
  const desc = $("plan-description");
  if (desc && plan.description) desc.textContent = plan.description;

  const container = $("plan-weeks");
  if (!container) return;
  container.textContent = "";

  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  weeks.forEach((week) => {
    const card = el("div", "card plan-week");
    const head = el("div", "plan-week-head");
    head.appendChild(el("span", "plan-week-num", `Week ${week.week}`));
    head.appendChild(el("span", "tag tag-ref", `${week.book} ${chapterRange(week)}`));
    card.appendChild(head);

    if (week.summary) card.appendChild(el("p", "muted", week.summary));

    const links = el("div", "plan-week-links");
    const readLink = buildReadLink(week, config);
    links.appendChild(link(readLink.href, "primary-btn", readLink.label, readLink.external));

    const seedUrl = createSeedFormUrl(form, week);
    const seed = link(seedUrl, "link-btn", "Submit a seed for this reading →", true);
    if (seedUrl && seedUrl.indexOf("PLACEHOLDER") !== -1) {
      seed.title = "Form not yet created - link is a placeholder.";
    }
    links.appendChild(seed);
    card.appendChild(links);

    container.appendChild(card);
  });
}

async function loadPlan() {
  try {
    const config = await loadConfig("data/site-config.json");
    const [planRes, formRes] = await Promise.all([
      fetch("data/reading-plan.json", { cache: "no-cache" }),
      fetch("data/form-config.json", { cache: "no-cache" }),
    ]);
    if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`);
    const plan = await planRes.json();
    let form = null;
    if (formRes.ok) {
      try { form = await formRes.json(); } catch { form = null; }
    }
    renderPlan(plan, form, config);
  } catch (error) {
    const node = $("plan-error");
    if (!node) return;
    node.hidden = false;
    node.textContent =
      "Could not load reading plan (" + error.message +
      "). If you opened this file directly, run a local server.";
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void loadPlan();
}
