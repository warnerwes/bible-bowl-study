import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const meterUrl = pathToFileURL(path.join(__dirname, "..", "src", "usage-meter.js")).href;
const firebaseUrl = pathToFileURL(path.join(__dirname, "..", "src", "firebase-client.js")).href;

test("usage meter formats the approved copy and shows the current count", async () => {
  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=meter-success`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() { return {}; },
    },
    {
      getFirestore() { return { name: "db" }; },
      doc(_db, path) { return { path }; },
      async getDoc(ref) {
        return {
          exists() { return true; },
          data() {
            return { count: 1284, refPath: ref.path };
          },
        };
      },
    },
  ]));

  const root = { hidden: true, textContent: "" };
  const { formatUsageMeterCopy, mountUsageMeter } = await import(`${meterUrl}?case=meter-success`);
  assert.equal(
    formatUsageMeterCopy(1284),
    "1284 of 5,000 shared Bible lookups used this month — it refills on the 1st. Read thoughtfully."
  );

  const meter = mountUsageMeter({
    root,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });
  const count = await meter.load();

  assert.equal(count, 1284);
  assert.equal(root.hidden, false);
  assert.equal(root.textContent, formatUsageMeterCopy(1284));
});

test("usage meter hides itself silently when the read fails", async () => {
  const { setFirebaseLoader } = await import(`${firebaseUrl}?case=meter-fail`);
  setFirebaseLoader(async () => ([
    {
      getApps() { return []; },
      initializeApp(config) { return { options: config }; },
    },
    {
      getAuth() { return {}; },
    },
    {
      getFirestore() { return { name: "db" }; },
      doc(_db, path) { return { path }; },
      async getDoc() {
        throw new Error("unavailable");
      },
    },
  ]));

  const root = { hidden: false, textContent: "stale" };
  const { mountUsageMeter } = await import(`${meterUrl}?case=meter-fail`);
  const meter = mountUsageMeter({
    root,
    config: { firebase: { projectId: "bible-bowl-study" } },
  });

  const count = await meter.load();
  assert.equal(count, null);
  assert.equal(root.hidden, true);
  assert.equal(root.textContent, "");
});
