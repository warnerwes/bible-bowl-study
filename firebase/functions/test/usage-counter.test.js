"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MONTHLY_LIMIT,
  createUsageTracker,
  getUsageMonthKey,
  getUserUsagePath,
} = require("../src/usage-counter");

test("getUsageMonthKey uses UTC year and month", () => {
  const key = getUsageMonthKey(() => new Date("2026-08-01T00:30:00.000Z"));
  assert.equal(key, "2026-08");
});

test("getUserUsagePath uses the flat uid-month doc id", () => {
  assert.equal(getUserUsagePath("abc", "2026-07"), "usage_users/abc_2026-07");
});

test("usage precheck returns ownership and remaining", async () => {
  const tracker = createUsageTracker({
    firestore: createFakeFirestore({
      userDocs: {
        "usage_users/student-1_2026-07": { count: 3, weeks: ["1CO:1-2"] },
      },
    }),
    now: () => new Date("2026-07-17T18:00:00.000Z"),
  });

  const result = await tracker.precheck({ uid: "student-1", weekKey: "1CO:1-2" });
  assert.deepEqual(result, {
    monthKey: "2026-07",
    owned: true,
    count: 3,
    weeks: ["1CO:1-2"],
    remaining: MONTHLY_LIMIT - 3,
  });
});

test("claimWeek serves already-owned weeks for free", async () => {
  const firestore = createFakeFirestore({
    userDocs: {
      "usage_users/student-1_2026-07": { count: 4, weeks: ["1CO:1-2"] },
    },
    globalDocs: {
      "usage/2026-07": { count: 99 },
    },
  });
  const tracker = createUsageTracker({ firestore, now: () => new Date("2026-07-17T18:00:00.000Z") });

  const result = await tracker.claimWeek({ uid: "student-1", weekKey: "1CO:1-2" });
  assert.equal(result.owned, true);
  assert.equal(result.count, 4);
  assert.equal(result.remaining, MONTHLY_LIMIT - 4);
  assert.equal(result.siteCount, 99);
  assert.deepEqual(firestore.writes, []);
});

test("claimWeek throws at the monthly cap", async () => {
  const tracker = createUsageTracker({
    firestore: createFakeFirestore({
      userDocs: {
        "usage_users/student-1_2026-07": { count: MONTHLY_LIMIT, weeks: [] },
      },
    }),
    now: () => new Date("2026-07-17T18:00:00.000Z"),
  });

  await assert.rejects(
    () => tracker.claimWeek({ uid: "student-1", weekKey: "1CO:1-2" }),
    /MONTHLY_LIMIT/
  );
});

test("claimWeek charges once and updates the global month counter", async () => {
  const firestore = createFakeFirestore({
    userDocs: {
      "usage_users/student-1_2026-07": { count: 19, weeks: ["1CO:1-2"] },
    },
    globalDocs: {
      "usage/2026-07": { count: 400 },
    },
  });
  const tracker = createUsageTracker({ firestore, now: () => new Date("2026-07-17T18:00:00.000Z") });

  const result = await tracker.claimWeek({ uid: "student-1", weekKey: "1CO:3-4" });
  assert.equal(result.owned, false);
  assert.equal(result.count, 20);
  assert.equal(result.remaining, 0);
  assert.deepEqual(firestore.userDocs["usage_users/student-1_2026-07"], {
    count: 20,
    weeks: ["1CO:1-2", "1CO:3-4"],
  });
  assert.deepEqual(firestore.globalDocs["usage/2026-07"], { count: 401 });
});

test("claimWeek serializes same-week retries so only the first call charges", async () => {
  const firestore = createFakeFirestore({
    userDocs: {
      "usage_users/student-1_2026-07": { count: 19, weeks: [] },
    },
    globalDocs: {
      "usage/2026-07": { count: 10 },
    },
  });
  const tracker = createUsageTracker({ firestore, now: () => new Date("2026-07-17T18:00:00.000Z") });

  const first = await tracker.claimWeek({ uid: "student-1", weekKey: "1CO:1-2" });
  const second = await tracker.claimWeek({ uid: "student-1", weekKey: "1CO:1-2" });

  assert.equal(first.owned, false);
  assert.equal(second.owned, true);
  assert.equal(firestore.userDocs["usage_users/student-1_2026-07"].count, 20);
  assert.equal(firestore.globalDocs["usage/2026-07"].count, 11);
});

test("claimWeek uses one captured request month across a rollover boundary", async () => {
  let callCount = 0;
  const tracker = createUsageTracker({
    firestore: createFakeFirestore(),
    now: () => {
      callCount += 1;
      return callCount === 1
        ? new Date("2026-07-31T23:59:59.999Z")
        : new Date("2026-08-01T00:00:00.001Z");
    },
  });

  const monthKey = getUsageMonthKey(() => new Date("2026-07-31T23:59:59.999Z"));
  const result = await tracker.claimWeek({ uid: "student-1", weekKey: "2CO:13", monthKey });

  assert.equal(result.monthKey, "2026-07");
});

function createFakeFirestore({ userDocs = {}, globalDocs = {} } = {}) {
  const state = {
    userDocs: structuredClone(userDocs),
    globalDocs: structuredClone(globalDocs),
    writes: [],
  };

  function doc(path) {
    return {
      path,
      async get() {
        return makeSnapshot(readPath(path));
      },
    };
  }

  function readPath(path) {
    if (path.startsWith("usage_users/")) return state.userDocs[path];
    if (path.startsWith("usage/")) return state.globalDocs[path];
    return undefined;
  }

  function writePath(path, payload, options) {
    const target = path.startsWith("usage_users/") ? state.userDocs : state.globalDocs;
    const current = readPath(path) || {};
    target[path] = options?.merge ? { ...current, ...payload } : payload;
    state.writes.push({ path, payload, options });
  }

  return {
    ...state,
    doc,
    async runTransaction(handler) {
      const transaction = {
        async get(ref) {
          return makeSnapshot(readPath(ref.path));
        },
        set(ref, payload, options) {
          writePath(ref.path, payload, options);
        },
      };
      return handler(transaction);
    },
  };
}

function makeSnapshot(data) {
  return {
    exists() {
      return data != null;
    },
    data() {
      return data == null ? {} : structuredClone(data);
    },
  };
}
