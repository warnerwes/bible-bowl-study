import assert from "assert/strict";
import { runLaneVerdictWithRetry } from "./osb-audit.mjs";

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

console.log("OSB audit retry checks:");

await check("runLaneVerdictWithRetry retries transient lane failures and later succeeds", async () => {
  const waits = [];
  const retries = [];
  let calls = 0;

  const result = await runLaneVerdictWithRetry({
    prompt: "prompt",
    model: "model",
    maxRetries: 4,
    random: () => 0.5,
    wait: async (ms) => {
      waits.push(ms);
    },
    onRetry: (info) => {
      retries.push(info);
    },
    invokeLane: async () => {
      calls += 1;
      if (calls < 3) {
        return {
          ok: false,
          error: `Command failed with exit code 503 attempt=${calls}`,
        };
      }
      return {
        ok: true,
        jobDir: "job-3",
        stdout: '{"match":true,"confidence":0.82,"issues":[],"fixType":"none","suggested":{},"osbTerms":"OSB"}',
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.jobDir, "job-3");
  assert.equal(result.rawVerdict.match, true);
  assert.deepEqual(waits, [3000, 8000]);
  assert.deepEqual(
    retries.map(({ retryNumber, maxRetries, error }) => ({ retryNumber, maxRetries, error })),
    [
      {
        retryNumber: 1,
        maxRetries: 4,
        error: "Command failed with exit code 503 attempt=1",
      },
      {
        retryNumber: 2,
        maxRetries: 4,
        error: "Command failed with exit code 503 attempt=2",
      },
    ]
  );
});

await check("runLaneVerdictWithRetry does not retry permanent 404 model errors", async () => {
  const waits = [];
  const retries = [];
  let calls = 0;

  const result = await runLaneVerdictWithRetry({
    prompt: "prompt",
    model: "model",
    maxRetries: 4,
    wait: async (ms) => {
      waits.push(ms);
    },
    onRetry: (info) => {
      retries.push(info);
    },
    invokeLane: async () => {
      calls += 1;
      return {
        ok: false,
        error: "Command failed with exit code 404",
      };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
  assert.deepEqual(retries, []);
});

await check("runLaneVerdictWithRetry honors Retry-After on 429 responses", async () => {
  const waits = [];
  const retries = [];
  let calls = 0;

  const result = await runLaneVerdictWithRetry({
    prompt: "prompt",
    model: "model",
    maxRetries: 2,
    wait: async (ms) => {
      waits.push(ms);
    },
    onRetry: (info) => {
      retries.push(info);
    },
    invokeLane: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          errorObject: { status: 429, retryAfterMs: 2750, message: "HTTP 429: rate limited" },
          httpStatus: 429,
          retryAfterMs: 2750,
        };
      }
      return {
        ok: true,
        jobDir: null,
        stdout: '{"match":true,"confidence":0.9,"issues":[],"fixType":"none","suggested":{},"osbTerms":"OSB"}',
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(waits, [2750]);
  assert.equal(retries[0].httpStatus, 429);
});

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
