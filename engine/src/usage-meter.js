"use strict";

import { ensureFirebase } from "./firebase-client.js";

const MONTHLY_LIMIT = 5000;

export function getUsageMonthKey(now = () => new Date()) {
  return now().toISOString().slice(0, 7);
}

export function formatUsageMeterCopy(count) {
  return `${count} of ${MONTHLY_LIMIT.toLocaleString()} shared Bible lookups used this month — it refills on the 1st. Read thoughtfully.`;
}

export async function readSiteUsageCount(config) {
  const firebase = await ensureFirebase(config && config.firebase);
  const snapshot = await firebase.getDoc(firebase.doc(firebase.db, `usage/${getUsageMonthKey()}`));
  if (!snapshot || (typeof snapshot.exists === "function" && !snapshot.exists())) {
    return 0;
  }
  const data = typeof snapshot.data === "function" ? snapshot.data() : {};
  const count = Number(data && data.count);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function renderUsage(root, count) {
  root.textContent = formatUsageMeterCopy(count);
  root.hidden = false;
}

export function mountUsageMeter({ root, config }) {
  return {
    async load() {
      if (!root || !config || !config.firebase) return null;
      try {
        const count = await readSiteUsageCount(config);
        renderUsage(root, count);
        return count;
      } catch {
        root.hidden = true;
        root.textContent = "";
        return null;
      }
    },
  };
}

export function mountLazyUsageMeter({ root, config }) {
  if (!root) return;
  let started = false;

  const start = () => {
    if (started) return;
    started = true;
    void mountUsageMeter({ root, config }).load();
  };

  const onVisible = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: 1500 });
      return;
    }
    window.setTimeout(start, 300);
  };

  if (typeof window.IntersectionObserver === "function") {
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        onVisible();
      }
    });
    observer.observe(root);
    return;
  }

  onVisible();
}
