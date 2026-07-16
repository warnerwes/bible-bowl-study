"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../src/rate-limit");

test("allows a burst within the per-ip capacity and then blocks", () => {
  let now = 0;
  const limiter = createRateLimiter({
    now: () => now,
    perIpCapacity: 3,
    perIpRefillPerMs: 1 / 1000,
    globalCapacity: 100,
    globalRefillPerMs: 100 / 1000
  });

  assert.equal(limiter.check("1.1.1.1").allowed, true);
  assert.equal(limiter.check("1.1.1.1").allowed, true);
  assert.equal(limiter.check("1.1.1.1").allowed, true);

  const blocked = limiter.check("1.1.1.1");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);

  now = 1000;
  assert.equal(limiter.check("1.1.1.1").allowed, true);
});

test("refills over time without exceeding capacity", () => {
  let now = 0;
  const limiter = createRateLimiter({
    now: () => now,
    perIpCapacity: 2,
    perIpRefillPerMs: 1 / 1000,
    globalCapacity: 100,
    globalRefillPerMs: 100 / 1000
  });

  assert.equal(limiter.check("2.2.2.2").allowed, true);
  assert.equal(limiter.check("2.2.2.2").allowed, true);
  assert.equal(limiter.check("2.2.2.2").allowed, false);

  now = 500;
  assert.equal(limiter.check("2.2.2.2").allowed, false);

  now = 1000;
  assert.equal(limiter.check("2.2.2.2").allowed, true);

  now = 10000;
  assert.equal(limiter.check("2.2.2.2").allowed, true);
  assert.equal(limiter.check("2.2.2.2").allowed, true);
  assert.equal(limiter.check("2.2.2.2").allowed, false);
});

test("tracks capacity independently per ip while sharing the global bucket", () => {
  let now = 0;
  const limiter = createRateLimiter({
    now: () => now,
    perIpCapacity: 2,
    perIpRefillPerMs: 1 / 1000,
    globalCapacity: 10,
    globalRefillPerMs: 10 / 1000
  });

  assert.equal(limiter.check("3.3.3.3").allowed, true);
  assert.equal(limiter.check("3.3.3.3").allowed, true);
  assert.equal(limiter.check("3.3.3.3").allowed, false);

  assert.equal(limiter.check("4.4.4.4").allowed, true);
  assert.equal(limiter.check("4.4.4.4").allowed, true);
  assert.equal(limiter.check("4.4.4.4").allowed, false);

  now = 1000;
  assert.equal(limiter.check("3.3.3.3").allowed, true);
  assert.equal(limiter.check("4.4.4.4").allowed, true);
});
