const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const CANDIDATE_DIR = path.join(ROOT, "data", "candidates");
const REVIEW_DIR = path.join(ROOT, "data", "reviews");
const EXPORT_DIR = path.join(ROOT, "data", "source-exports");

const AID_TYPES = new Set(["mnemonic", "teaching", "image"]);
const CLAIM_KINDS = new Set(["none", "source-backed"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function groupNameFromFile(file) {
  const base = path.basename(file);
  return base.replace(/\.json$/i, "");
}

function rawFiles() {
  return fs.readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(RAW_DIR, f));
}

function loadQuestions(group) {
  const files = rawFiles().filter((file) => !group || groupNameFromFile(file) === group);
  if (!files.length) throw new Error(`No raw files matched group "${group || "*"}"`);
  return files.flatMap((file) => readJson(file).map((q) => ({ ...q, _file: file, _group: groupNameFromFile(file) })));
}

function candidateFile(group) {
  return path.join(CANDIDATE_DIR, `${group}.candidates.json`);
}

function reviewFile(group) {
  return path.join(REVIEW_DIR, `${group}.review.json`);
}

function normalizeCandidate(q, c, index) {
  const candidateId = c.candidateId || `${q.id}-${String.fromCharCode(97 + index)}`;
  const type = c.type || (c.memoryAid && c.memoryAid.type) || "mnemonic";
  const text = String(c.text || (c.memoryAid && c.memoryAid.text) || "").trim();
  const source = String(c.source || (c.memoryAid && c.memoryAid.source) || "").trim();
  const sourceUrl = String(c.sourceUrl || "").trim();
  const sourceClaim = String(c.sourceClaim || "").trim();
  const claimKind = c.claimKind || (type === "teaching" || source || sourceUrl || sourceClaim ? "source-backed" : "none");

  return {
    candidateId,
    type,
    text,
    claimKind,
    ...(source ? { source } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceClaim ? { sourceClaim } : {}),
    sourceStatus: c.sourceStatus || (claimKind === "source-backed" ? "needs-review" : "not-needed"),
    styleNotes: c.styleNotes || "",
  };
}

function validateCandidate(q, c) {
  const errors = [];
  if (!c.candidateId) errors.push("missing candidateId");
  if (!AID_TYPES.has(c.type)) errors.push(`invalid type: ${c.type}`);
  if (typeof c.text !== "string" || c.text.trim().length < 10) errors.push("text too short or missing");
  if (!CLAIM_KINDS.has(c.claimKind)) errors.push(`invalid claimKind: ${c.claimKind}`);
  if (c.type === "teaching" && c.claimKind !== "source-backed") errors.push("teaching must be source-backed");
  if (c.claimKind === "source-backed") {
    if (!c.source) errors.push("source-backed candidate missing source");
    if (!c.sourceUrl) errors.push("source-backed candidate missing sourceUrl");
    if (!c.sourceClaim) errors.push("source-backed candidate missing sourceClaim");
  }
  if (c.claimKind === "none" && (c.source || c.sourceUrl || c.sourceClaim)) {
    errors.push("claimKind none must not include source fields");
  }
  if (errors.length) return `${q.id} ${c.candidateId || "?"}: ${errors.join("; ")}`;
  return null;
}

function memoryAidFromCandidate(c) {
  const memoryAid = { type: c.type, text: c.text.trim() };
  if (c.claimKind === "source-backed") {
    memoryAid.source = c.source.trim();
    memoryAid.sourceUrl = c.sourceUrl.trim();
    memoryAid.sourceClaim = c.sourceClaim.trim();
  }
  return memoryAid;
}

module.exports = {
  ROOT,
  RAW_DIR,
  CANDIDATE_DIR,
  REVIEW_DIR,
  EXPORT_DIR,
  ensureDir,
  readJson,
  writeJson,
  rawFiles,
  loadQuestions,
  groupNameFromFile,
  candidateFile,
  reviewFile,
  normalizeCandidate,
  validateCandidate,
  memoryAidFromCandidate,
};
