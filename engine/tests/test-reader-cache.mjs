import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { makeStorage } from "./headless-dom.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheUrl = pathToFileURL(path.join(__dirname, "..", "src", "reader-cache.js")).href;

test("reader cache writes and reads a whole week atomically", async () => {
  const storage = makeStorage();
  const { createReaderCache } = await import(`${cacheUrl}?case=atomic-write`);
  const cache = createReaderCache({ storage, now: () => 1_000 });

  const ok = cache.writeWeek({
    chapters: [
      { book: "1CO", chapter: 1, reference: "1 Corinthians 1", content: "[1] SYNTHETIC", copyright: "c" },
      { book: "1CO", chapter: 2, reference: "1 Corinthians 2", content: "[1] SYNTHETIC", copyright: "c" },
    ],
    fetchedAt: 1_000,
    expiresAt: 2_000,
    fumsToken: "token-1",
  });

  assert.equal(ok, true);
  assert.equal(cache.getDeviceChapterCount(), 2);
  assert.equal(cache.readChapter("1CO", 1).fumsToken, "token-1");
  assert.equal(cache.readChapter("1CO", 2).reference, "1 Corinthians 2");
});

test("reader cache purges expired, malformed, and future-dated entries", async () => {
  const storage = makeStorage();
  storage.setItem("bbs:reader-cache:v1", JSON.stringify({
    version: 1,
    chapters: {
      "1CO.1": { content: "ok", reference: "r", copyright: "c", fumsToken: "t", fetchedAt: 100, expiresAt: 900 },
      "1CO.2": { content: "bad", reference: "r", copyright: "c", fumsToken: "t", fetchedAt: 2_000, expiresAt: 3_000 },
      "1CO.3": { nope: true },
    },
  }));

  const { createReaderCache } = await import(`${cacheUrl}?case=purge`);
  const cache = createReaderCache({ storage, now: () => 1_000 });
  cache.purge();

  assert.equal(cache.readChapter("1CO", 1), null);
  assert.equal(cache.readChapter("1CO", 2), null);
  assert.equal(cache.readChapter("1CO", 3), null);
});

test("reader cache keeps a per-user usage snapshot and clears it on purge", async () => {
  const storage = makeStorage();
  const { createReaderCache } = await import(`${cacheUrl}?case=usage-snapshot`);
  const cache = createReaderCache({ storage, now: () => 5_000 });

  cache.writeUsageSnapshot("student-1", { month: "2026-07", used: 3, limit: 20, remaining: 17 }, [
    { weekKey: "1CO:1-2", label: "1 Corinthians 1-2", expiresAt: 10_000 },
  ]);
  assert.equal(cache.readUsageSnapshot("student-1", "2026-07").used, 3);

  cache.clearAll();
  assert.equal(cache.readUsageSnapshot("student-1", "2026-07"), null);
});
