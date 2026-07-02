import assert from "assert/strict";
import {
  DEFAULT_NVIDIA_RPM,
  TokenBucketLimiter,
  normalizeNvidiaBaseUrl,
  parseRetryAfterMs,
  resolveNvidiaApiKey,
} from "./lib/nvidia-client.mjs";

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result
        .then(() => {
          console.log("  PASS", name);
          pass += 1;
        })
        .catch((error) => {
          console.log("  FAIL", name, "-", error.message);
          fail += 1;
        });
    }
    console.log("  PASS", name);
    pass += 1;
  } catch (error) {
    console.log("  FAIL", name, "-", error.message);
    fail += 1;
  }
  return Promise.resolve();
}

console.log("NVIDIA client checks:");

await check("normalizeNvidiaBaseUrl prepends https and trims trailing slash", () => {
  assert.equal(normalizeNvidiaBaseUrl("integrate.api.nvidia.com/"), "https://integrate.api.nvidia.com");
  assert.equal(normalizeNvidiaBaseUrl("https://example.com///"), "https://example.com");
});

await check("resolveNvidiaApiKey prefers env over secrets file", async () => {
  const key = await resolveNvidiaApiKey({
    env: { NVIDIA_API_KEY: "env-key", CODEX_SECRETS_DIR: "ignored" },
    readFileImpl: async () => "NVIDIA_API_KEY=file-key\n",
  });
  assert.equal(key, "env-key");
});

await check("parseRetryAfterMs handles integer seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("2"), 2000);
  const base = Date.parse("2026-07-02T12:00:00.000Z");
  const retryAt = new Date(base + 4000).toUTCString();
  assert.equal(parseRetryAfterMs(retryAt, base), 4000);
});

await check("TokenBucketLimiter enforces paced issuance under configured RPM", async () => {
  const limiter = new TokenBucketLimiter({ rpm: 120 });
  const grants = [];
  for (let index = 0; index < 4; index += 1) {
    const { grantedAt } = await limiter.acquire();
    grants.push(grantedAt);
  }
  const spacings = grants.slice(1).map((time, index) => time - grants[index]);
  const minimumSpacing = Math.min(...spacings);
  assert.ok(minimumSpacing >= 500, `minimum spacing ${minimumSpacing}ms was too fast`);
});

await check("DEFAULT_NVIDIA_RPM remains 40", () => {
  assert.equal(DEFAULT_NVIDIA_RPM, 40);
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
