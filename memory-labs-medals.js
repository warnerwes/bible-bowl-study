/* Bible Bowl Study — Memory Labs shared medal helpers
 *
 * Single source of truth for per-lab best medal tier persistence.
 * Storage key stays "bbs-medal:<labId>" so existing Tabernacle medals
 * continue to work.
 */

(() => {
  "use strict";

  const STORAGE_KEY = (labId) => `bbs-medal:${labId}`;
  const VALID_TIERS = ["gold", "silver", "bronze"];

  function tierFor(hints) {
    if (hints <= 0) return "gold";
    if (hints <= 2) return "silver";
    return "bronze";
  }

  const TIER_EMOJI = {
    gold: "🥇",
    silver: "🥈",
    bronze: "🥉",
  };

  const TIER_LABEL = {
    gold: "Gold",
    silver: "Silver",
    bronze: "Bronze",
  };

  const TIER_LINE = {
    gold: "Mastered from memory.",
    silver: "Strong recall, nearly clean.",
    bronze: "Completed; keep practicing.",
  };

  function tierRank(t) {
    if (t === "gold") return 0;
    if (t === "silver") return 1;
    if (t === "bronze") return 2;
    return 3;
  }

  function count(n) {
    const parsed = Number(n);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function normalizeRecord(record) {
    if (!record || !VALID_TIERS.includes(record.tier)) return null;
    const hints = count(record.hints);
    const mistakes = count(record.mistakes);
    const score = count(record.score || hints + mistakes);
    return {
      ...record,
      tier: record.tier,
      hints,
      mistakes,
      score,
    };
  }

  function penaltyText(hints, mistakes) {
    if (!hints && !mistakes) return "Flawless";
    return `${mistakes} mistake${mistakes === 1 ? "" : "s"}, ${hints} hint${
      hints === 1 ? "" : "s"
    }`;
  }

  function isBetterAttempt(record, prior) {
    if (!prior) return true;
    if (record.score !== prior.score) return record.score < prior.score;
    if (record.mistakes !== prior.mistakes) return record.mistakes < prior.mistakes;
    return record.hints < prior.hints;
  }

  function readBest(labId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(labId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && VALID_TIERS.includes(parsed.tier)) {
        return normalizeRecord(parsed);
      }
    } catch (_) {}
    return null;
  }

  function writeBest(labId, record) {
    try {
      localStorage.setItem(STORAGE_KEY(labId), JSON.stringify(record));
    } catch (_) {}
  }

  function recordAttempt(labId, hints, mistakes = 0) {
    hints = count(hints);
    mistakes = count(mistakes);
    const score = hints + mistakes;
    const tier = tierFor(score);
    const prior = readBest(labId);
    const record = {
      tier,
      hints,
      mistakes,
      score,
      at: new Date().toISOString(),
    };

    const isNewBest = isBetterAttempt(record, prior);

    if (isNewBest) {
      writeBest(labId, record);
    }

    return { tier, hints, mistakes, score, isNewBest, prior };
  }

  function renderBanner(targetEl, result) {
    if (!targetEl || !result) return null;
    const tier = VALID_TIERS.includes(result.tier) ? result.tier : tierFor(count(result.score));
    const hints = count(result.hints);
    const mistakes = count(result.mistakes);
    const record = { tier, hints, mistakes, score: count(result.score || hints + mistakes) };
    const prior = normalizeRecord(result.prior);
    const isNewBest = isBetterAttempt(record, prior);
    const medalText = `${TIER_EMOJI[tier]} ${TIER_LABEL[tier]}`;

    targetEl.innerHTML = "";
    targetEl.hidden = false;

    const badge = document.createElement("div");
    badge.className = `lab-medal-badge-card lab-medal--${tier}`;

    const head = document.createElement("div");
    head.className = "lab-medal-headline";
    head.textContent = medalText;

    const sub = document.createElement("div");
    sub.className = "lab-medal-sub";
    sub.textContent = `${penaltyText(hints, mistakes)} - ${TIER_LINE[tier]}`;

    badge.appendChild(head);
    badge.appendChild(sub);

    const note = document.createElement("div");
    note.className = `lab-medal-note ${isNewBest ? "lab-medal-note--new" : "lab-medal-note--old"}`;
    if (isNewBest && prior) {
      note.textContent = `New best! Previous: ${TIER_EMOJI[prior.tier]} ${TIER_LABEL[prior.tier]} (${penaltyText(
        prior.hints,
        prior.mistakes
      )})`;
    } else if (isNewBest) {
      note.textContent = "First medal on this device.";
    } else if (prior) {
      note.textContent = `Best remains: ${TIER_EMOJI[prior.tier]} ${TIER_LABEL[prior.tier]} (${penaltyText(
        prior.hints,
        prior.mistakes
      )})`;
    }
    if (note.textContent) badge.appendChild(note);
    targetEl.appendChild(badge);
    return medalText;
  }

  window.BibleBowlLabMedals = {
    tierFor,
    TIER_EMOJI,
    TIER_LABEL,
    tierRank,
    readBest,
    recordAttempt,
    renderBanner,
  };
})();
