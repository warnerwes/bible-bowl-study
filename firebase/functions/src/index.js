"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { createChapterHandler } = require("./chapter-handler");
const { createRateLimiter } = require("./rate-limit");
const { createUsageRecorder } = require("./usage-counter");

const API_BIBLE_KEY = defineSecret("API_BIBLE_KEY");
const rateLimiter = createRateLimiter();
const app = getApps()[0] || initializeApp();
const auth = getAuth(app);
const firestore = getFirestore(app);
const recordUsage = createUsageRecorder({ firestore });

const handler = createChapterHandler({
  fetchImpl: fetch,
  getApiKey: () => API_BIBLE_KEY.value(),
  rateLimiter,
  verifyIdToken: (token) => auth.verifyIdToken(token),
  recordUsage
});

exports.getChapter = onRequest(
  {
    secrets: [API_BIBLE_KEY],
    maxInstances: 2,
    timeoutSeconds: 10
  },
  handler
);
