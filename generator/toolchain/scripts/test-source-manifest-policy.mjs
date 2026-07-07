import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/schema-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "schemas",
  "source-manifest.schema.json"
);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

const VERIFIED_PUBLISHER_KEYS = new Set([
  "translation",
  "rightsHolder",
  "quotedVerseLimit",
  "maxRatioOfWork",
  "maxRatioOfBook",
  "excludedUse",
  "notice",
  "quotedUses"
]);

function baseManifest() {
  return {
    book: "Mark",
    bookSlug: "mark",
    testament: "NT",
    canonicalVerseCount: 678,
    translations: [
      {
        translation: "NKJV",
        rightsHolder: "HarperCollins Christian Publishing / Thomas Nelson",
        quotedVerseLimit: 500,
        maxRatioOfWork: 0.25,
        maxRatioOfBook: 0.5,
        excludedUse: "Biblical reference work",
        notice: "Scripture taken from the New King James Version...",
        internalPolicy: {
          selfImposed: true,
          rationale: "We keep quoted verses well below publisher limits.",
          consecutiveVerseCap: 8
        },
        quotedUses: []
      }
    ]
  };
}

function checkPublisherKeysOnly(manifest) {
  for (const translation of manifest.translations) {
    for (const key of Object.keys(translation)) {
      if (key === "internalPolicy") {
        continue;
      }
      if (!VERIFIED_PUBLISHER_KEYS.has(key)) {
        return false;
      }
    }
  }
  return true;
}

function checkInternalPolicy(manifest) {
  for (const translation of manifest.translations) {
    const policy = translation.internalPolicy;
    if (!policy || typeof policy !== "object") {
      return false;
    }
    if (policy.selfImposed !== true) {
      return false;
    }
    if (
      !policy.rationale ||
      typeof policy.rationale !== "string" ||
      policy.rationale.trim().length === 0
    ) {
      return false;
    }
  }
  return true;
}

let ok = true;

function assert(name, condition) {
  if (!condition) {
    ok = false;
    console.log(`FAIL ${name}`);
  } else {
    console.log(`PASS ${name}`);
  }
}

function assertValid(name, doc) {
  const result = validate(schema, doc);
  assert(`${name} (schema)`, result.valid);
  if (!result.valid) {
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
  }
}

function assertInvalid(name, doc) {
  const result = validate(schema, doc);
  assert(`${name} (schema)`, !result.valid);
}

const good = baseManifest();
assertValid("manifest with verified publisher terms and internalPolicy", good);
assert(
  "publisher block contains only verified keys",
  checkPublisherKeysOnly(good)
);
assert("internalPolicy has selfImposed:true and rationale", checkInternalPolicy(good));

const inventedCap = baseManifest();
inventedCap.translations[0].maxConsecutiveQuotedVerses = 8;
assertInvalid(
  "manifest with invented cap in publisher block fails validation",
  inventedCap
);
assert(
  "invented cap is not a verified publisher key",
  !checkPublisherKeysOnly(inventedCap)
);

const missingRationale = baseManifest();
missingRationale.translations[0].internalPolicy.rationale = "";
assertInvalid(
  "manifest with empty internalPolicy rationale fails validation",
  missingRationale
);
assert(
  "empty rationale fails internalPolicy check",
  !checkInternalPolicy(missingRationale)
);

const notSelfImposed = baseManifest();
notSelfImposed.translations[0].internalPolicy.selfImposed = false;
assertInvalid(
  "manifest with selfImposed:false fails validation",
  notSelfImposed
);
assert(
  "selfImposed:false fails internalPolicy check",
  !checkInternalPolicy(notSelfImposed)
);

process.exit(ok ? 0 : 1);
