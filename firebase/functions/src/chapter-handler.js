"use strict";

const { isAllowedBook, isAllowedChapter } = require("./allowed-chapters");

const API_BIBLE_URL = "https://rest.api.bible/v1/bibles/63097d2a0a2f7db3-01/chapters";
const CACHE_CONTROL = "no-store, no-cache, must-revalidate, private";

function createChapterHandler({
  fetchImpl,
  getApiKey,
  rateLimiter,
  logger = console,
  now = () => Date.now()
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl is required");
  }
  if (typeof getApiKey !== "function") {
    throw new Error("getApiKey is required");
  }
  if (!rateLimiter || typeof rateLimiter.check !== "function") {
    throw new Error("rateLimiter.check is required");
  }

  return async function chapterHandler(req, res) {
    const startedAt = now();
    const rawQuery = getRawQuery(req);
    const context = { book: null, chapter: null };

    setNoStore(res);

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendError(res, 405, "method_not_allowed", logger, context, startedAt, now);
    }

    const parsedQuery = parseQuery(rawQuery);
    if (!parsedQuery.ok) {
      return sendError(res, 400, "invalid_query", logger, context, startedAt, now);
    }

    const { book, chapter } = parsedQuery.value;
    context.book = book;
    context.chapter = chapter;

    if (!isAllowedBook(book) || !isAllowedChapter(book, chapter)) {
      return sendError(res, 400, "invalid_reference", logger, context, startedAt, now);
    }

    const rateLimit = rateLimiter.check(getIpAddress(req));
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return sendError(res, 429, "rate_limited", logger, context, startedAt, now);
    }

    const chapterId = `${book}.${chapter}`;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);

    try {
      const response = await fetchImpl(
        `${API_BIBLE_URL}/${chapterId}?content-type=text&fums-version=3`,
        {
          headers: {
            "api-key": getApiKey()
          },
          signal: abortController.signal
        }
      );

      if (response.status === 429) {
        return sendError(res, 429, "upstream_rate_limited", logger, context, startedAt, now);
      }

      if (!response.ok) {
        return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
      }

      const projected = projectPayload(payload, book, chapter);
      if (!projected) {
        return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
      }

      logRequest(logger, {
        book,
        chapter,
        status: 200,
        latencyMs: now() - startedAt
      });

      res.status(200).json(projected);
    } catch (error) {
      if (isAbortError(error)) {
        return sendError(res, 504, "upstream_timeout", logger, context, startedAt, now);
      }

      return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function projectPayload(payload, book, chapter) {
  const data = payload && payload.data;
  const meta = payload && payload.meta;

  if (!isNonEmptyString(data && data.content)) {
    return null;
  }
  if (!isNonEmptyString(data && data.copyright)) {
    return null;
  }
  if (!isNonEmptyString(meta && meta.fumsToken)) {
    return null;
  }

  return {
    book,
    chapter,
    chapterId: isNonEmptyString(data.id) ? data.id : `${book}.${chapter}`,
    reference: isNonEmptyString(data.reference) ? data.reference : `${book} ${chapter}`,
    content: data.content,
    copyright: data.copyright,
    attributionUrl: "https://api.bible",
    fumsToken: meta.fumsToken
  };
}

function parseQuery(rawQuery) {
  if (!Array.isArray(rawQuery) || rawQuery.length !== 2) {
    return { ok: false };
  }

  const map = new Map();
  for (const [key, value] of rawQuery) {
    if (!["book", "ch"].includes(key) || map.has(key) || typeof value !== "string") {
      return { ok: false };
    }
    map.set(key, value);
  }

  if (!map.has("book") || !map.has("ch")) {
    return { ok: false };
  }

  const chapter = parseCanonicalPositiveInteger(map.get("ch"));
  if (chapter === null) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      book: map.get("book"),
      chapter
    }
  };
}

function getRawQuery(req) {
  const url = new URL(req.url || "/", "http://localhost");
  return Array.from(url.searchParams.entries());
}

function getIpAddress(req) {
  return req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
}

function parseCanonicalPositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value) {
    return null;
  }

  return parsed;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", CACHE_CONTROL);
}

function sendError(res, status, error, logger, context, startedAt, now) {
  logRequest(logger, {
    book: context.book,
    chapter: context.chapter,
    status,
    latencyMs: now() - startedAt
  });
  res.status(status).json({ error });
}

function logRequest(logger, payload) {
  logger.info({
    book: payload.book,
    chapter: payload.chapter,
    status: payload.status,
    latencyMs: payload.latencyMs
  });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isAbortError(error) {
  return error && (error.name === "AbortError" || error.code === "ABORT_ERR");
}

module.exports = {
  CACHE_CONTROL,
  createChapterHandler
};
