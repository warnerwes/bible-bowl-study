"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getAllowedChapterIds } = require("../src/allowed-chapters");
const { CACHE_CONTROL, createChapterHandler } = require("../src/chapter-handler");
const { createRateLimiter } = require("../src/rate-limit");

const FAKE_SECRET = "test-key-not-real";

test("accepts every allowed chapter", async () => {
  const accepted = [];
  const fetchImpl = async (url) => {
    accepted.push(url);
    const chapterId = url.match(/chapters\/([^?]+)/)[1];
    return okJsonResponse({
      data: {
        id: chapterId,
        reference: chapterId,
        content: `SYNTHETIC VERSE TEXT ${chapterId}`,
        copyright: "Synthetic Copyright"
      },
      meta: {
        fumsToken: `token-${chapterId}`
      }
    });
  };
  const verifyCalls = [];

  for (const chapterId of getAllowedChapterIds()) {
    const [book, chapter] = chapterId.split(".");
    const { res } = await invokeHandler({
      req: createRequest(`/api/chapter?book=${book}&ch=${chapter}`),
      fetchImpl,
      verifyIdToken: async (token) => {
        verifyCalls.push(token);
        return { firebase: { sign_in_provider: "google.com" } };
      }
    });

    assert.equal(res.statusCode, 200, chapterId);
    assert.equal(res.body.chapterId, chapterId);
    assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  }

  assert.equal(accepted.length, 29);
  assert.equal(verifyCalls.length, 29);
});

test("rejects invalid boundaries and malformed requests", async () => {
  const invalidRequests = [
    "/api/chapter?book=1CO&ch=0",
    "/api/chapter?book=1CO&ch=17",
    "/api/chapter?book=2CO&ch=14",
    "/api/chapter?book=GEN&ch=1",
    "/api/chapter?book=63097d2a0a2f7db3-01&ch=1",
    "/api/chapter?book=1CO&ch=1&extra=1",
    "/api/chapter?book=1CO&ch=01",
    "/api/chapter?book=1CO&ch=1.5",
    "/api/chapter?book=1CO"
  ];

  for (const url of invalidRequests) {
    const { res, serialized } = await invokeHandler({
      req: createRequest(url)
    });

    assert.equal(res.statusCode, 400, url);
    assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
    assert.ok(!serialized.includes(FAKE_SECRET));
  }

  const post = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", { method: "POST" })
  });

  assert.equal(post.res.statusCode, 405);
  assert.equal(post.res.headers.Allow, "GET");
  assert.equal(post.res.headers["Cache-Control"], CACHE_CONTROL);
});

test("maps upstream 429 to downstream 429", async () => {
  const { res, serialized } = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1"),
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => ({})
    })
  });

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, "upstream_rate_limited");
  assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  assert.ok(!serialized.includes(FAKE_SECRET));
});

test("treats non-json upstream responses as 502", async () => {
  const { res, serialized } = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=2"),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      }
    })
  });

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "upstream_error");
  assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  assert.ok(!serialized.includes(FAKE_SECRET));
});

test("rejects missing upstream content, copyright, or fums token", async () => {
  const payloads = [
    {
      data: { id: "1CO.3", reference: "1 Corinthians 3", content: "", copyright: "ok" },
      meta: { fumsToken: "token" }
    },
    {
      data: { id: "1CO.3", reference: "1 Corinthians 3", content: "SYNTHETIC VERSE TEXT 1", copyright: "" },
      meta: { fumsToken: "token" }
    },
    {
      data: {
        id: "1CO.3",
        reference: "1 Corinthians 3",
        content: "SYNTHETIC VERSE TEXT 1",
        copyright: "Synthetic Copyright"
      },
      meta: { fumsToken: "" }
    }
  ];

  for (const payload of payloads) {
    const { res, serialized } = await invokeHandler({
      req: createRequest("/api/chapter?book=1CO&ch=3"),
      fetchImpl: async () => okJsonResponse(payload)
    });

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, "upstream_error");
    assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
    assert.ok(!serialized.includes(FAKE_SECRET));
  }
});

test("returns 504 on upstream timeout", async () => {
  const { res, serialized } = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=4"),
    fetchImpl: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
        options.signal.dispatchEvent(new Event("abort"));
      })
  });

  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, "upstream_timeout");
  assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  assert.ok(!serialized.includes(FAKE_SECRET));
});

test("returns the success shape with verbatim content", async () => {
  const syntheticContent = "SYNTHETIC VERSE TEXT 1\n\nSYNTHETIC VERSE TEXT 2  ";
  const loggerCalls = [];

  const { res, serialized } = await invokeHandler({
    req: createRequest("/api/chapter?book=2CO&ch=5"),
    fetchImpl: async (url, options) => {
      assert.match(url, /2CO\.5\?content-type=text&fums-version=3$/);
      assert.equal(options.headers["api-key"], FAKE_SECRET);

      return okJsonResponse({
        data: {
          id: "2CO.5",
          reference: "2 Corinthians 5",
          content: syntheticContent,
          copyright: "Synthetic Copyright"
        },
        meta: {
          fumsToken: "synthetic-token"
        }
      });
    },
    logger: {
      info(payload) {
        loggerCalls.push(payload);
      }
    }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    book: "2CO",
    chapter: 5,
    chapterId: "2CO.5",
    reference: "2 Corinthians 5",
    content: syntheticContent,
    copyright: "Synthetic Copyright",
    attributionUrl: "https://api.bible",
    fumsToken: "synthetic-token"
  });
  assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  assert.ok(!serialized.includes(FAKE_SECRET));
  assert.deepEqual(loggerCalls, [
    {
      book: "2CO",
      chapter: 5,
      status: 200,
      latencyMs: 0
    }
  ]);
});

test("never leaks the fake secret in any response body", async () => {
  const scenarios = [
    invokeHandler({
      req: createRequest("/api/chapter?book=1CO&ch=1"),
      fetchImpl: async () => okJsonResponse({
        data: {
          id: "1CO.1",
          reference: "1 Corinthians 1",
          content: "SYNTHETIC VERSE TEXT 1",
          copyright: "Synthetic Copyright"
        },
        meta: { fumsToken: "token-1" }
      })
    }),
    invokeHandler({
      req: createRequest("/api/chapter?book=1CO&ch=1&extra=1")
    }),
    invokeHandler({
      req: createRequest("/api/chapter?book=1CO&ch=1"),
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => ({ leaked: FAKE_SECRET })
      })
    })
  ];

  for (const scenario of scenarios) {
    const { serialized } = await scenario;
    assert.ok(!serialized.includes(FAKE_SECRET));
  }
});

test("integrates the rate limiter and returns retry-after on burst exhaustion", async () => {
  const rateLimiter = createRateLimiter({
    now: () => 0,
    perIpCapacity: 2,
    perIpRefillPerMs: 1 / 60000,
    globalCapacity: 100,
    globalRefillPerMs: 100 / 1000
  });

  const fetchImpl = async () =>
    okJsonResponse({
      data: {
        id: "1CO.1",
        reference: "1 Corinthians 1",
        content: "SYNTHETIC VERSE TEXT 1",
        copyright: "Synthetic Copyright"
      },
      meta: { fumsToken: "token-1" }
    });

  const first = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", { ip: "9.9.9.9" }),
    fetchImpl,
    rateLimiter
  });
  const second = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", { ip: "9.9.9.9" }),
    fetchImpl,
    rateLimiter
  });
  const third = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", { ip: "9.9.9.9" }),
    fetchImpl,
    rateLimiter
  });

  assert.equal(first.res.statusCode, 200);
  assert.equal(second.res.statusCode, 200);
  assert.equal(third.res.statusCode, 429);
  assert.equal(third.res.headers["Retry-After"], "60");
  assert.equal(third.res.headers["Cache-Control"], CACHE_CONTROL);
});

test("returns 401 when the authorization header is missing or malformed", async () => {
  const requests = [
    createRequest("/api/chapter?book=1CO&ch=1"),
    createRequest("/api/chapter?book=1CO&ch=1", {
      headers: { authorization: "token nope" }
    }),
    createRequest("/api/chapter?book=1CO&ch=1", {
      headers: { authorization: "Bearer bad token" }
    }),
  ];

  for (const req of requests) {
    const { res } = await invokeHandler({ req, autoAuth: false });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "SIGN_IN_REQUIRED");
    assert.equal(res.headers["Cache-Control"], CACHE_CONTROL);
  }
});

test("returns 401 when token verification fails or provider is not google", async () => {
  const invalidToken = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", {
      headers: { authorization: "Bearer invalid-token" }
    }),
    autoAuth: false,
    verifyIdToken: async () => {
      throw new Error("invalid");
    }
  });
  assert.equal(invalidToken.res.statusCode, 401);
  assert.equal(invalidToken.res.body.error, "SIGN_IN_REQUIRED");

  const anonymous = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=1", {
      headers: { authorization: "Bearer anon-token" }
    }),
    autoAuth: false,
    verifyIdToken: async () => ({ firebase: { sign_in_provider: "anonymous" } })
  });
  assert.equal(anonymous.res.statusCode, 401);
  assert.equal(anonymous.res.body.error, "SIGN_IN_REQUIRED");
});

test("accepts verified google tokens", async () => {
  const verifyCalls = [];
  const { res } = await invokeHandler({
    req: createRequest("/api/chapter?book=2CO&ch=6", {
      headers: { authorization: "Bearer real-token" }
    }),
    verifyIdToken: async (token) => {
      verifyCalls.push(token);
      return { firebase: { sign_in_provider: "google.com" } };
    }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(verifyCalls, ["real-token"]);
});

test("awaits usage counting only on upstream 200 responses", async () => {
  const usageCalls = [];
  const recordUsage = async () => {
    usageCalls.push("counted");
  };
  const request = createRequest("/api/chapter?book=1CO&ch=1", {
    headers: { authorization: "Bearer good-token" }
  });

  const success = await invokeHandler({ req: request, recordUsage });
  assert.equal(success.res.statusCode, 200);
  assert.equal(usageCalls.length, 1);

  const scenarios = [
    invokeHandler({
      req: request,
      recordUsage,
      fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}) })
    }),
    invokeHandler({
      req: request,
      recordUsage,
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) })
    }),
    invokeHandler({
      req: request,
      recordUsage,
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) })
    }),
  ];
  await Promise.all(scenarios);
  assert.equal(usageCalls.length, 1);
});

test("still serves chapter 200 when usage counting fails", async () => {
  const loggerCalls = [];
  let usageAwaited = false;

  const { res } = await invokeHandler({
    req: createRequest("/api/chapter?book=1CO&ch=2", {
      headers: { authorization: "Bearer good-token" }
    }),
    recordUsage: async () => {
      await Promise.resolve();
      usageAwaited = true;
      throw new Error("write failed");
    },
    logger: {
      info(payload) {
        loggerCalls.push(payload);
      },
      error(payload) {
        loggerCalls.push(payload);
      }
    }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(usageAwaited, true);
  assert.equal(loggerCalls.at(-1).message, "usage_count_failed");
});

function okJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

async function invokeHandler({
  req,
  fetchImpl = async () =>
    okJsonResponse({
      data: {
        id: "1CO.1",
        reference: "1 Corinthians 1",
        content: "SYNTHETIC VERSE TEXT 1",
        copyright: "Synthetic Copyright"
      },
      meta: {
        fumsToken: "token-1"
      }
    }),
  logger = { info() {} },
  verifyIdToken = async () => ({ firebase: { sign_in_provider: "google.com" } }),
  recordUsage = async () => {},
  autoAuth = true,
  rateLimiter = createRateLimiter({
    now: () => 0,
    globalCapacity: 100,
    globalRefillPerMs: 100 / 1000
  })
} = {}) {
  const res = createResponse();
  const normalizedReq = req || createRequest("/api/chapter?book=1CO&ch=1");
  normalizedReq.headers = autoAuth
    ? {
        authorization: "Bearer test-google-token",
        ...(normalizedReq.headers || {})
      }
    : { ...(normalizedReq.headers || {}) };
  const handler = createChapterHandler({
    fetchImpl,
    getApiKey: () => FAKE_SECRET,
    rateLimiter,
    verifyIdToken,
    recordUsage,
    logger,
    now: () => 0
  });

  await handler(normalizedReq, res);
  return {
    res,
    serialized: JSON.stringify({
      headers: res.headers,
      body: res.body
    })
  };
}

function createRequest(url, { method = "GET", ip = "127.0.0.1", headers = {} } = {}) {
  return {
    method,
    url,
    ip,
    headers,
    socket: {
      remoteAddress: ip
    }
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
    }
  };
}
