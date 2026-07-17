"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createUsageRecorder, getUsageMonthKey } = require("../src/usage-counter");

test("getUsageMonthKey uses UTC year and month", () => {
  const key = getUsageMonthKey(() => new Date("2026-08-01T00:30:00.000Z"));
  assert.equal(key, "2026-08");
});

test("createUsageRecorder writes the monthly usage doc with an increment", async () => {
  const calls = [];
  const recordUsage = createUsageRecorder({
    firestore: {
      doc(path) {
        return {
          async set(payload, options) {
            calls.push({ path, payload, options });
          }
        };
      }
    },
    increment(value) {
      return { incrementBy: value };
    },
    now: () => new Date("2026-07-17T18:00:00.000Z")
  });

  await recordUsage();

  assert.deepEqual(calls, [
    {
      path: "usage/2026-07",
      payload: { count: { incrementBy: 1 } },
      options: { merge: true }
    }
  ]);
});
