"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { createChapterHandler } = require("./chapter-handler");
const { createRateLimiter } = require("./rate-limit");

const API_BIBLE_KEY = defineSecret("API_BIBLE_KEY");
const rateLimiter = createRateLimiter();

const handler = createChapterHandler({
  fetchImpl: fetch,
  getApiKey: () => API_BIBLE_KEY.value(),
  rateLimiter
});

exports.getChapter = onRequest(
  {
    secrets: [API_BIBLE_KEY],
    maxInstances: 2,
    timeoutSeconds: 10
  },
  handler
);
