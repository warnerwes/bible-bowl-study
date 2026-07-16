"use strict";

const DEFAULTS = {
  now: () => Date.now(),
  perIpCapacity: 60,
  perIpRefillPerMs: 60 / 60000,
  globalCapacity: 20,
  globalRefillPerMs: 20 / 10000
};

function createRateLimiter(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const buckets = new Map();
  const globalBucket = createBucket(config.globalCapacity, config.globalRefillPerMs, config.now);

  function check(ipAddress) {
    const key = ipAddress || "unknown";
    const bucket = getBucket(key);
    const bucketPreview = previewConsume(bucket, 1);
    const globalPreview = previewConsume(globalBucket, 1);

    if (bucketPreview.tokensRemaining < 0 || globalPreview.tokensRemaining < 0) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          bucketPreview.retryAfterSeconds,
          globalPreview.retryAfterSeconds,
          1
        )
      };
    }

    consume(bucket, 1);
    consume(globalBucket, 1);

    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }

  function reset() {
    buckets.clear();
    globalBucket.tokens = globalBucket.capacity;
    globalBucket.updatedAt = config.now();
  }

  function getBucket(key) {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = createBucket(config.perIpCapacity, config.perIpRefillPerMs, config.now);
      buckets.set(key, bucket);
    }
    return bucket;
  }

  return {
    check,
    reset
  };
}

function createBucket(capacity, refillPerMs, now) {
  return {
    capacity,
    refillPerMs,
    now,
    tokens: capacity,
    updatedAt: now()
  };
}

function previewConsume(bucket, amount) {
  const refilled = refill(bucket);
  const deficit = amount - refilled.tokens;

  if (deficit <= 0) {
    return {
      tokensRemaining: refilled.tokens - amount,
      retryAfterSeconds: 0
    };
  }

  return {
    tokensRemaining: -deficit,
    retryAfterSeconds: Math.ceil(deficit / bucket.refillPerMs / 1000)
  };
}

function consume(bucket, amount) {
  refill(bucket);
  bucket.tokens -= amount;
}

function refill(bucket) {
  const now = bucket.now();
  const elapsed = Math.max(0, now - bucket.updatedAt);
  const replenishedTokens = elapsed * bucket.refillPerMs;

  if (replenishedTokens > 0) {
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + replenishedTokens);
    bucket.updatedAt = now;
  }

  return bucket;
}

module.exports = {
  createRateLimiter
};
