const LINEAR = [
  "queued",
  "approved",
  "researched",
  "drafted",
  "in-review",
  "published"
];
const REJECTABLE = new Set([
  "queued",
  "approved",
  "researched",
  "drafted",
  "in-review"
]);
const REASON_CODES = new Set([
  "pii",
  "offensive",
  "off_topic",
  "copyright_risk",
  "duplicate",
  "not_verifiable",
  "too_broad",
  "pastoral_sensitivity",
  "already_covered",
  "other"
]);

function isLegalTransition(from, to) {
  if (from === to) {
    return true;
  }
  if (from === "rejected") {
    return false;
  }
  if (to === "rejected") {
    return REJECTABLE.has(from);
  }
  const fromIndex = LINEAR.indexOf(from);
  const toIndex = LINEAR.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }
  return toIndex === fromIndex + 1;
}

function isValidRejection(doc) {
  if (doc.status !== "rejected") {
    return true;
  }
  const rejection = doc.rejection;
  if (!rejection || typeof rejection !== "object") {
    return false;
  }
  if (
    !rejection.reasonCode ||
    typeof rejection.reasonCode !== "string" ||
    !REASON_CODES.has(rejection.reasonCode)
  ) {
    return false;
  }
  if (
    !rejection.reasonText ||
    typeof rejection.reasonText !== "string" ||
    rejection.reasonText.trim().length === 0
  ) {
    return false;
  }
  return true;
}

const transitionCases = [
  { from: "queued", to: "approved", expect: true },
  { from: "approved", to: "researched", expect: true },
  { from: "researched", to: "drafted", expect: true },
  { from: "drafted", to: "in-review", expect: true },
  { from: "in-review", to: "published", expect: true },
  { from: "queued", to: "rejected", expect: true },
  { from: "approved", to: "rejected", expect: true },
  { from: "researched", to: "rejected", expect: true },
  { from: "drafted", to: "rejected", expect: true },
  { from: "in-review", to: "rejected", expect: true },
  { from: "queued", to: "published", expect: false },
  { from: "queued", to: "drafted", expect: false },
  { from: "researched", to: "approved", expect: false },
  { from: "published", to: "rejected", expect: false },
  { from: "rejected", to: "queued", expect: false },
  { from: "rejected", to: "approved", expect: false },
  { from: "rejected", to: "published", expect: false }
];

const rejectionCases = [
  {
    name: "rejection with reasonCode and reasonText",
    doc: {
      status: "rejected",
      rejection: {
        reasonCode: "off_topic",
        reasonText: "Not related to the book.",
        permanent: true
      }
    },
    expect: true
  },
  {
    name: "rejection missing reasonCode",
    doc: {
      status: "rejected",
      rejection: {
        reasonText: "Not related to the book.",
        permanent: true
      }
    },
    expect: false
  },
  {
    name: "rejection missing reasonText",
    doc: {
      status: "rejected",
      rejection: {
        reasonCode: "off_topic",
        permanent: true
      }
    },
    expect: false
  },
  {
    name: "non-rejected item needs no rejection",
    doc: { status: "approved" },
    expect: true
  },
  {
    name: "rejection with invalid reasonCode",
    doc: {
      status: "rejected",
      rejection: {
        reasonCode: "made_up",
        reasonText: "Not related to the book."
      }
    },
    expect: false
  }
];

let ok = true;

for (const { from, to, expect } of transitionCases) {
  const result = isLegalTransition(from, to);
  if (result !== expect) {
    ok = false;
    console.log(
      `FAIL transition ${from} -> ${to}: expected ${expect}, got ${result}`
    );
  } else {
    console.log(`PASS transition ${from} -> ${to}`);
  }
}

for (const { name, doc, expect } of rejectionCases) {
  const result = isValidRejection(doc);
  if (result !== expect) {
    ok = false;
    console.log(`FAIL rejection case "${name}": expected ${expect}, got ${result}`);
  } else {
    console.log(`PASS rejection case "${name}"`);
  }
}

process.exit(ok ? 0 : 1);
