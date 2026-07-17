"use strict";

const MONTHLY_LIMIT = 20;

function getUsageMonthKey(now = () => new Date()) {
  return now().toISOString().slice(0, 7);
}

function getUserUsagePath(uid, monthKey) {
  return `usage_users/${uid}_${monthKey}`;
}

function normalizeUsageData(snapshot) {
  if (!snapshot || (typeof snapshot.exists === "function" && !snapshot.exists())) {
    return { count: 0, weeks: [] };
  }
  const data = typeof snapshot.data === "function" ? snapshot.data() : {};
  const count = Number(data && data.count);
  const weeks = Array.isArray(data && data.weeks)
    ? data.weeks.filter((value) => typeof value === "string" && value)
    : [];
  return {
    count: Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0,
    weeks: [...new Set(weeks)],
  };
}

function buildUsageState(data) {
  return {
    count: data.count,
    weeks: [...data.weeks],
    remaining: Math.max(0, MONTHLY_LIMIT - data.count),
  };
}

function createMonthlyLimitError() {
  const error = new Error("MONTHLY_LIMIT");
  error.code = "MONTHLY_LIMIT";
  return error;
}

function createUsageTracker({
  firestore,
  now = () => new Date(),
}) {
  if (!firestore || typeof firestore.doc !== "function" || typeof firestore.runTransaction !== "function") {
    throw new Error("firestore.doc and firestore.runTransaction are required");
  }

  return {
    async precheck({ uid, weekKey, monthKey = getUsageMonthKey(now) }) {
      const snapshot = await firestore.doc(getUserUsagePath(uid, monthKey)).get();
      const data = normalizeUsageData(snapshot);
      return {
        monthKey,
        owned: data.weeks.includes(weekKey),
        ...buildUsageState(data),
      };
    },

    async claimWeek({ uid, weekKey, monthKey = getUsageMonthKey(now) }) {
      const userRef = firestore.doc(getUserUsagePath(uid, monthKey));
      const globalRef = firestore.doc(`usage/${monthKey}`);

      return firestore.runTransaction(async (transaction) => {
        const [userSnap, globalSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(globalRef),
        ]);
        const data = normalizeUsageData(userSnap);
        const alreadyOwned = data.weeks.includes(weekKey);
        if (alreadyOwned) {
          return {
            monthKey,
            owned: true,
            siteCount: normalizeGlobalUsage(globalSnap),
            ...buildUsageState(data),
          };
        }
        if (data.count >= MONTHLY_LIMIT) {
          throw createMonthlyLimitError();
        }

        const nextData = {
          count: data.count + 1,
          weeks: [...data.weeks, weekKey],
        };
        transaction.set(userRef, nextData, { merge: true });
        transaction.set(globalRef, { count: normalizeGlobalUsage(globalSnap) + 1 }, { merge: true });
        return {
          monthKey,
          owned: false,
          siteCount: normalizeGlobalUsage(globalSnap) + 1,
          ...buildUsageState(nextData),
        };
      });
    },
  };
}

function normalizeGlobalUsage(snapshot) {
  if (!snapshot || (typeof snapshot.exists === "function" && !snapshot.exists())) {
    return 0;
  }
  const data = typeof snapshot.data === "function" ? snapshot.data() : {};
  const count = Number(data && data.count);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

module.exports = {
  MONTHLY_LIMIT,
  createMonthlyLimitError,
  createUsageTracker,
  getUsageMonthKey,
  getUserUsagePath,
  normalizeUsageData,
};
