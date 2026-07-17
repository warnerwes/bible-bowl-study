"use strict";

const { FieldValue } = require("firebase-admin/firestore");

function getUsageMonthKey(now = () => new Date()) {
  return now().toISOString().slice(0, 7);
}

function createUsageRecorder({
  firestore,
  increment = (value) => FieldValue.increment(value),
  now = () => new Date()
}) {
  if (!firestore || typeof firestore.doc !== "function") {
    throw new Error("firestore.doc is required");
  }

  return async function recordUsage() {
    await firestore.doc(`usage/${getUsageMonthKey(now)}`).set(
      { count: increment(1) },
      { merge: true }
    );
  };
}

module.exports = {
  createUsageRecorder,
  getUsageMonthKey
};
