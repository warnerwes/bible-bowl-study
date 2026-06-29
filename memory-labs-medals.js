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

  function tierRank(t) {
    if (t === "gold") return 0;
    if (t === "silver") return 1;
    if (t === "bronze") return 2;
    return 3;
  }

  function readBest(labId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(labId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && VALID_TIERS.includes(parsed.tier)) {
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  function writeBest(labId, record) {
    try {
      localStorage.setItem(STORAGE_KEY(labId), JSON.stringify(record));
    } catch (_) {}
  }

  function recordAttempt(labId, hints) {
    const tier = tierFor(hints);
    const prior = readBest(labId);
    const record = {
      tier,
      hints,
      at: new Date().toISOString(),
    };

    const isNewBest =
      !prior ||
      tierRank(tier) < tierRank(prior.tier) ||
      (tierRank(tier) === tierRank(prior.tier) && hints < (prior.hints || Infinity));

    if (isNewBest) {
      writeBest(labId, record);
    }

    return { tier, hints, isNewBest, prior };
  }

  window.BibleBowlLabMedals = {
    tierFor,
    TIER_EMOJI,
    TIER_LABEL,
    tierRank,
    readBest,
    recordAttempt,
  };
})();
