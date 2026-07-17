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

export function buildReadLinks(week, config) {
  if (String((config && config.passageProvider) || "").toLowerCase() !== "reader") {
    return [buildReadLink(week, config)];
  }

  const chapters = Array.isArray(week.chapters) ? week.chapters : [];
  if (chapters.length <= 1) {
    return [buildReadLink(week, config)];
  }

  return chapters.map((chapter) => {
    const ref = `${week.book} ${chapter}`;
    return {
      href: passageUrl(ref, {
        provider: config.passageProvider,
        bibleVersion: config.bibleVersion,
      }),
      label: passageLabel(ref, { provider: config.passageProvider }),
      external: false,
    };
  });
}

export function buildGatewayLink(week, config) {
  const ref = weekReference(week);
  return {
    href: passageUrl(ref, {
      provider: "biblegateway",
      bibleVersion: config.bibleVersion,
    }),
    label: "Open on Bible Gateway ↗",
    external: true,
  };
}

export function renderPlan(plan, config) {
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
    buildReadLinks(week, config).forEach((readLink) => {
      links.appendChild(link(readLink.href, "primary-btn", readLink.label, readLink.external));
    });
    const gatewayLink = buildGatewayLink(week, config);
    links.appendChild(link(gatewayLink.href, "link-btn", gatewayLink.label, gatewayLink.external));
    card.appendChild(links);

    container.appendChild(card);
  });
}

async function loadPlan() {
  try {
    const config = await loadConfig("data/site-config.json");
    const planRes = await fetch("data/reading-plan.json", { cache: "no-cache" });
    if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`);
    const plan = await planRes.json();
    renderPlan(plan, config);
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
