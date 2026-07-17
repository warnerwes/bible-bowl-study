"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getAllowedChapterIds, getWeekForChapter } = require("../src/checkout-plan");
const {
  API_BIBLE_URL,
  CACHE_CONTROL,
  buildPassageUrl,
  createChapterHandler,
  projectWeekPayload,
  splitRangeContentByChapter,
} = require("../src/chapter-handler");
const { createRateLimiter } = require("../src/rate-limit");

const FAKE_SECRET = "test-key-not-real";

test("week mapping covers every allowed chapter and keeps weeks at or below 200 verses", () => {
  for (const chapterId of getAllowedChapterIds()) {
    const [book, chapterText] = chapterId.split(".");
    const week = getWeekForChapter(book, Number(chapterText));
    assert.ok(week, chapterId);
    assert.ok(week.totalVerses <= 200, week.weekKey);
  }
});

test("buildPassageUrl requests the whole week with one upstream call", () => {
  const week = getWeekForChapter("1CO", 2);
  assert.equal(
    buildPassageUrl(week),
    `${API_BIBLE_URL}/1CO.1%2C1CO.2?content-type=text&fums-version=3`
  );
});

test("splitRangeContentByChapter validates the expected verse sequence per chapter", () => {
  const week = getWeekForChapter("1CO", 1);
  const content = makeWeekContent("1CO", [1, 2]);
  const map = splitRangeContentByChapter(content, week);
  assert.equal(map.get(1).startsWith("[1]"), true);
  assert.equal(map.get(2).startsWith("[1]"), true);
});

test("projectWeekPayload rejects whole-range truncation and per-chapter truncation", () => {
  const week = getWeekForChapter("1CO", 1);
  const goodContent = makeWeekContent("1CO", [1, 2]);
  const wholeRangeTruncated = {
    data: {
      content: goodContent,
      copyright: "Synthetic Copyright",
      verseCount: week.totalVerses - 1,
    },
    meta: { fumsToken: "token" },
  };
  assert.equal(projectWeekPayload(wholeRangeTruncated, week, 1000), null);

  const chapterTruncated = {
    data: {
      content: `${makeChapterContent("1CO", 1)}\n${makeChapterContent("1CO", 2, { dropLastVerse: true })}`,
      copyright: "Synthetic Copyright",
      verseCount: week.totalVerses - 1,
    },
    meta: { fumsToken: "token" },
  };
  assert.equal(projectWeekPayload(chapterTruncated, week, 1000), null);
});

test("projectWeekPayload rejects missing, duplicate, and reset-out-of-order markers", () => {
  const week = getWeekForChapter("1CO", 1);
  const duplicate = {
    data: {
      content: "[1] SYNTHETIC ONE.\n[1] SYNTHETIC DUPLICATE.",
      copyright: "Synthetic Copyright",
      verseCount: week.totalVerses,
    },
    meta: { fumsToken: "token" },
  };
  assert.equal(projectWeekPayload(duplicate, week, 1000), null);

  const outOfOrder = {
    data: {
      content: `${makeChapterContent("1CO", 1)}\n[2] WRONG RESET.\n${makeChapterContent("1CO", 2).slice(4)}`,
      copyright: "Synthetic Copyright",
      verseCount: week.totalVerses,
    },
    meta: { fumsToken: "token" },
  };
  assert.equal(projectWeekPayload(outOfOrder, week, 1000), null);
});

test("accepts verified google tokens and returns the week checkout response", async () => {
  const fetchCalls = [];
  const usageTracker = createUsageTrackerDouble({
    precheck: { monthKey: "2026-07", owned: false, count: 3, weeks: ["1CO:1-2"], remaining: 17 },
    claim: { monthKey: "2026-07", owned: false, count: 4, weeks: ["1CO:1-2", "1CO:3-4"], remaining: 16, siteCount: 128 },
  });

  const { res, serialized } = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=3", {
      headers: { authorization: "Bearer real-token" },
    }),
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options });
      return okJsonResponse({
        data: {
          content: makeWeekContent("1CO", [3, 4]),
          copyright: "Synthetic Copyright",
          verseCount: 44,
        },
        meta: { fumsToken: "synthetic-token" },
      });
    },
    verifyIdToken: async (token) => {
      assert.equal(token, "real-token");
      return { uid: "student-1", firebase: { sign_in_provider: "google.com" } };
    },
    usageTracker,
  });

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /1CO\.3%2C1CO\.4/);
  assert.equal(fetchCalls[0].options.headers["api-key"], FAKE_SECRET);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.fumsToken, "synthetic-token");
  assert.equal(res.body.remaining, 16);
  assert.equal(res.body.ownedWeeks.length, 2);
  assert.equal(res.body.siteUsage.used, 128);
  assert.equal(res.body.chapters.length, 2);
  assert.ok(!serialized.includes(FAKE_SECRET));
});

test("owned-week re-fetch is free and still returns scripture", async () => {
  const usageTracker = createUsageTrackerDouble({
    precheck: { monthKey: "2026-07", owned: true, count: 8, weeks: ["1CO:1-2"], remaining: 12 },
    claim: { monthKey: "2026-07", owned: true, count: 8, weeks: ["1CO:1-2"], remaining: 12, siteCount: 200 },
  });

  const { res } = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=2"),
    fetchImpl: async () => okJsonResponse({
      data: {
        content: makeWeekContent("1CO", [1, 2]),
        copyright: "Synthetic Copyright",
        verseCount: 47,
      },
      meta: { fumsToken: "token-1" },
    }),
    usageTracker,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.usage.used, 8);
  assert.equal(res.body.remaining, 12);
});

test("advisory pre-check blocks a capped user before any upstream call", async () => {
  let fetchCalled = false;
  const { res } = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=1"),
    fetchImpl: async () => {
      fetchCalled = true;
      return okJsonResponse({});
    },
    usageTracker: createUsageTrackerDouble({
      precheck: { monthKey: "2026-07", owned: false, count: 20, weeks: [], remaining: 0 },
    }),
  });

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, "MONTHLY_LIMIT");
  assert.equal(fetchCalled, false);
});

test("claim transaction blocks a cap race after a validated upstream fetch", async () => {
  const { res } = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=1"),
    fetchImpl: async () => okJsonResponse({
      data: {
        content: makeWeekContent("1CO", [1, 2]),
        copyright: "Synthetic Copyright",
        verseCount: 47,
      },
      meta: { fumsToken: "token-1" },
    }),
    usageTracker: createUsageTrackerDouble({
      precheck: { monthKey: "2026-07", owned: false, count: 19, weeks: [], remaining: 1 },
      claimError: createMonthlyLimitError(),
    }),
  });

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, "MONTHLY_LIMIT");
});

test("uses one captured request month for precheck and claim", async () => {
  const usageTracker = createUsageTrackerDouble({
    precheck: { monthKey: "2026-07", owned: false, count: 0, weeks: [], remaining: 20 },
    claim: { monthKey: "2026-07", owned: false, count: 1, weeks: ["2CO:13"], remaining: 19, siteCount: 1 },
  });

  const { res } = await invokeHandler({
    req: createRequest("/api/checkout?book=2CO&ch=13"),
    usageTracker,
    nowValues: [Date.parse("2026-07-31T23:59:59.999Z"), Date.parse("2026-08-01T00:00:01.000Z")],
    fetchImpl: async () => okJsonResponse({
      data: {
        content: makeWeekContent("2CO", [13]),
        copyright: "Synthetic Copyright",
        verseCount: 14,
      },
      meta: { fumsToken: "token-13" },
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(usageTracker.calls.map((call) => call.monthKey), ["2026-07", "2026-07"]);
});

test("maps upstream 429, timeout, and malformed auth to downstream errors", async () => {
  const upstream429 = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=1"),
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
  });
  assert.equal(upstream429.res.body.error, "upstream_rate_limited");

  const timeout = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=1"),
    fetchImpl: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
        options.signal.dispatchEvent(new Event("abort"));
      }),
  });
  assert.equal(timeout.res.body.error, "upstream_timeout");

  const badAuth = await invokeHandler({
    req: createRequest("/api/checkout?book=1CO&ch=1", {
      headers: { authorization: "token nope" },
    }),
    autoAuth: false,
  });
  assert.equal(badAuth.res.statusCode, 401);
});

function createMonthlyLimitError() {
  const error = new Error("MONTHLY_LIMIT");
  error.code = "MONTHLY_LIMIT";
  return error;
}

function createUsageTrackerDouble({ precheck, claim, claimError } = {}) {
  return {
    calls: [],
    async precheck(payload) {
      this.calls.push({ kind: "precheck", ...payload, monthKey: payload.monthKey || precheck?.monthKey });
      return precheck ?? { monthKey: "2026-07", owned: false, count: 0, weeks: [], remaining: 20 };
    },
    async claimWeek(payload) {
      this.calls.push({ kind: "claim", ...payload });
      if (claimError) throw claimError;
      return claim ?? { monthKey: "2026-07", owned: false, count: 1, weeks: [payload.weekKey], remaining: 19, siteCount: 1 };
    },
  };
}

function makeWeekContent(book, chapters) {
  return chapters.map((chapter) => makeChapterContent(book, chapter)).join("\n");
}

function makeChapterContent(book, chapter, { dropLastVerse = false } = {}) {
  const week = getWeekForChapter(book, chapter);
  const expected = week
    ? require("../src/checkout-plan").getExpectedVerseCount(book, chapter)
    : 0;
  const verses = [];
  const total = dropLastVerse ? expected - 1 : expected;
  for (let verse = 1; verse <= total; verse += 1) {
    verses.push(`[${verse}] SYNTHETIC ${book}.${chapter}.${verse}.`);
  }
  return verses.join("\n");
}

function okJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

async function invokeHandler({
  req,
  fetchImpl = async () =>
    okJsonResponse({
      data: {
        content: makeWeekContent("1CO", [1, 2]),
        copyright: "Synthetic Copyright",
        verseCount: 47,
      },
      meta: { fumsToken: "token-1" },
    }),
  logger = { info() {} },
  verifyIdToken = async () => ({ uid: "student-1", firebase: { sign_in_provider: "google.com" } }),
  usageTracker = createUsageTrackerDouble(),
  autoAuth = true,
  nowValues = [0, 0, 0, 0],
  rateLimiter = createRateLimiter({
    now: () => 0,
    globalCapacity: 100,
    globalRefillPerMs: 100 / 1000,
  }),
} = {}) {
  const res = createResponse();
  const normalizedReq = req || createRequest("/api/checkout?book=1CO&ch=1");
  normalizedReq.headers = autoAuth
    ? { authorization: "Bearer test-google-token", ...(normalizedReq.headers || {}) }
    : { ...(normalizedReq.headers || {}) };

  let nowIndex = 0;
  const handler = createChapterHandler({
    fetchImpl,
    getApiKey: () => FAKE_SECRET,
    rateLimiter,
    verifyIdToken,
    usageTracker,
    logger,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
  });

  await handler(normalizedReq, res);
  return {
    res,
    serialized: JSON.stringify({ headers: res.headers, body: res.body }),
  };
}

function createRequest(url, { method = "GET", ip = "127.0.0.1", headers = {} } = {}) {
  return {
    method,
    url,
    ip,
    headers,
    socket: { remoteAddress: ip },
  };
}

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
