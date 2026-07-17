"use strict";

const {
  buildOwnedWeeksSummary,
  getExpectedVerseCount,
  getWeekForChapter,
  isAllowedBook,
  isAllowedChapter,
} = require("./checkout-plan");
const { MONTHLY_LIMIT, createMonthlyLimitError } = require("./usage-counter");

const API_BIBLE_URL = "https://rest.api.bible/v1/bibles/63097d2a0a2f7db3-01/passages";
const API_BIBLE_ATTRIBUTION_URL = "https://api.bible";
const CACHE_CONTROL = "no-store, no-cache, must-revalidate, private";
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function createChapterHandler({
  fetchImpl,
  getApiKey,
  rateLimiter,
  verifyIdToken,
  usageTracker,
  logger = console,
  now = () => Date.now(),
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
  if (typeof verifyIdToken !== "function") {
    throw new Error("verifyIdToken is required");
  }
  if (!usageTracker || typeof usageTracker.precheck !== "function" || typeof usageTracker.claimWeek !== "function") {
    throw new Error("usageTracker.precheck and usageTracker.claimWeek are required");
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

    const idToken = parseBearerToken(req.headers.authorization);
    if (!idToken) {
      return sendError(res, 401, "SIGN_IN_REQUIRED", logger, context, startedAt, now);
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch {
      return sendError(res, 401, "SIGN_IN_REQUIRED", logger, context, startedAt, now);
    }

    if (decodedToken?.firebase?.sign_in_provider !== "google.com" || !decodedToken.uid) {
      return sendError(res, 401, "SIGN_IN_REQUIRED", logger, context, startedAt, now);
    }

    const rateLimit = rateLimiter.check(getIpAddress(req));
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return sendError(res, 429, "rate_limited", logger, context, startedAt, now);
    }

    const week = getWeekForChapter(book, chapter);
    if (!week) {
      return sendError(res, 400, "invalid_reference", logger, context, startedAt, now);
    }

    let advisory;
    try {
      advisory = await usageTracker.precheck({ uid: decodedToken.uid, weekKey: week.weekKey });
    } catch {
      return sendError(res, 503, "usage_unavailable", logger, context, startedAt, now);
    }
    if (!advisory.owned && advisory.count >= MONTHLY_LIMIT) {
      return sendError(res, 429, "MONTHLY_LIMIT", logger, context, startedAt, now);
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);

    try {
      const upstream = await fetchImpl(buildPassageUrl(week), {
        headers: { "api-key": getApiKey() },
        signal: abortController.signal,
      });

      if (upstream.status === 429) {
        return sendError(res, 429, "upstream_rate_limited", logger, context, startedAt, now);
      }
      if (!upstream.ok) {
        return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
      }

      let payload;
      try {
        payload = await upstream.json();
      } catch {
        return sendError(res, 502, "upstream_error", logger, context, startedAt, now);
      }

      const projected = projectWeekPayload(payload, week, now());
      if (!projected) {
        return sendError(res, 502, "UPSTREAM_INCOMPLETE", logger, context, startedAt, now);
      }

      let claim;
      try {
        claim = await usageTracker.claimWeek({ uid: decodedToken.uid, weekKey: week.weekKey, monthKey: advisory.monthKey });
      } catch (error) {
        if (error?.code === "MONTHLY_LIMIT") {
          return sendError(res, 429, "MONTHLY_LIMIT", logger, context, startedAt, now);
        }
        return sendError(res, 503, "usage_unavailable", logger, context, startedAt, now);
      }

      const response = {
        chapters: projected.chapters,
        fumsToken: projected.fumsToken,
        fetchedAt: projected.fetchedAt,
        expiresAt: projected.expiresAt,
        remaining: claim.remaining,
        ownedWeeks: buildOwnedWeeksSummary(claim.weeks, projected.expiresAt),
        usage: {
          month: claim.monthKey,
          used: claim.count,
          limit: MONTHLY_LIMIT,
          remaining: claim.remaining,
        },
        siteUsage: {
          used: claim.siteCount,
          limit: 5000,
        },
      };

      logRequest(logger, {
        book,
        chapter,
        status: 200,
        latencyMs: now() - startedAt,
      });
      res.status(200).json(response);
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

function buildPassageUrl(week) {
  const refs = week.chapters.map((chapter) => `${week.book}.${chapter}`).join(",");
  return `${API_BIBLE_URL}/${encodeURIComponent(refs)}?content-type=text&fums-version=3`;
}

function parseBearerToken(headerValue) {
  if (typeof headerValue !== "string") {
    return "";
  }
  const match = headerValue.match(/^Bearer ([^\s]+)$/);
  return match ? match[1] : "";
}

function projectWeekPayload(payload, week, fetchedAt) {
  const data = payload && payload.data;
  const meta = payload && payload.meta;
  if (!isNonEmptyString(data && data.content)) return null;
  if (!isNonEmptyString(data && data.copyright)) return null;
  if (!isNonEmptyString(meta && meta.fumsToken)) return null;

  const verseCount = Number(data && data.verseCount);
  if (!Number.isFinite(verseCount) || verseCount !== week.totalVerses) {
    return null;
  }

  const contentByChapter = splitRangeContentByChapter(data.content, week);
  if (!contentByChapter) {
    return null;
  }

  return {
    chapters: week.chapters.map((chapter) => ({
      book: week.book,
      chapter,
      chapterId: `${week.book}.${chapter}`,
      reference: `${week.bookName} ${chapter}`,
      content: contentByChapter.get(chapter),
      copyright: data.copyright,
      attributionUrl: API_BIBLE_ATTRIBUTION_URL,
    })),
    fetchedAt,
    expiresAt: fetchedAt + CACHE_TTL_MS,
    fumsToken: meta.fumsToken,
  };
}

function splitRangeContentByChapter(text, week) {
  const source = String(text || "");
  const matches = Array.from(source.matchAll(/\[(\d+)\]\s?/g)).map((match) => ({
    number: Number(match[1]),
    index: match.index,
    markerText: `[${match[1]}]`,
  }));
  if (!matches.length) return null;

  const contentByChapter = new Map();
  let cursor = 0;
  for (let index = 0; index < week.chapters.length; index += 1) {
    const chapter = week.chapters[index];
    const expectedCount = getExpectedVerseCount(week.book, chapter);
    if (!expectedCount) return null;

    const startMatch = matches[cursor];
    if (!startMatch || startMatch.number !== 1) return null;

    for (let verse = 1; verse <= expectedCount; verse += 1) {
      const match = matches[cursor + verse - 1];
      if (!match || match.number !== verse) {
        return null;
      }
    }

    const nextChapterStart = matches[cursor + expectedCount];
    if (index < week.chapters.length - 1) {
      if (!nextChapterStart || nextChapterStart.number !== 1) {
        return null;
      }
    } else if (nextChapterStart) {
      return null;
    }

    const start = startMatch.index;
    const end = nextChapterStart ? nextChapterStart.index : source.length;
    const chapterText = source.slice(start, end).trimEnd();
    const validated = validateChapterContent(chapterText, expectedCount);
    if (!validated) return null;
    contentByChapter.set(chapter, chapterText);
    cursor += expectedCount;
  }

  return contentByChapter.size === week.chapters.length ? contentByChapter : null;
}

function validateChapterContent(text, expectedCount) {
  const matches = Array.from(String(text || "").matchAll(/\[(\d+)\]\s?/g));
  if (matches.length !== expectedCount) return false;
  for (let index = 0; index < matches.length; index += 1) {
    if (Number(matches[index][1]) !== index + 1) {
      return false;
    }
  }
  return true;
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
      chapter,
    },
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
    latencyMs: now() - startedAt,
  });
  res.status(status).json({ error });
}

function logRequest(logger, payload) {
  logger.info({
    book: payload.book,
    chapter: payload.chapter,
    status: payload.status,
    latencyMs: payload.latencyMs,
  });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isAbortError(error) {
  return error && (error.name === "AbortError" || error.code === "ABORT_ERR");
}

module.exports = {
  API_BIBLE_URL,
  CACHE_CONTROL,
  CACHE_TTL_MS,
  buildPassageUrl,
  createChapterHandler,
  projectWeekPayload,
  splitRangeContentByChapter,
  validateChapterContent,
};
