export const TARGET_SCRIPTS = [
  "scripts/build.js",
  "scripts/build-review-packets.js",
  "scripts/apply-reviewed-choice.js",
  "scripts/import-review-csv.js",
  "scripts/osb-audit.mjs",
  "scripts/osb-verify.mjs",
  "scripts/lib/osb-audit-core.mjs",
  "scripts/lib/osb-verify-core.mjs",
];

export const SUMMARIES = {
  "scripts/build.js":
    "Merges raw question JSON, validates schema, and writes the consolidated question bank plus review-candidates.",
  "scripts/build-review-packets.js":
    "Creates per-group candidate packets and empty review records from the current memory aids.",
  "scripts/apply-reviewed-choice.js":
    "Applies human-approved candidate choices back into the raw question files.",
  "scripts/import-review-csv.js":
    "Parses a Pro-review CSV and appends agent-suggested replacement candidates into packets.",
  "scripts/osb-audit.mjs":
    "Runs an LLM judge against OSB source text to detect mismatches and optionally apply fixes.",
  "scripts/osb-verify.mjs":
    "Verifies prior audit mismatches with a skeptical second-pass LLM and optionally applies approved fixes.",
  "scripts/lib/osb-audit-core.mjs":
    "Shared audit logic: prompts, reference parsing, verse collection, retry lanes, reports, and apply helpers.",
  "scripts/lib/osb-verify-core.mjs":
    "Shared verify logic: verifier prompts, verdict normalization, reconciliation guards, and verify reports.",
};

const BOOK_SPECIFIC = [
  {
    id: "exodus-reference-regex",
    re: /Exodus\s+\d+/,
    text: "Validates or references the literal book name 'Exodus'.",
  },
  {
    id: "raw-group-list",
    re: /readdirSync\(RAW_DIR\)|groups\.set|groupArg/,
    text: "Hardcodes the raw group file list or group argument handling.",
  },
  {
    id: "factory-data-paths",
    re: /\bdata\/(?:raw|candidates|reviews|questions\.json|review-candidates\.json)\b/,
    text: "Hardcodes factory data directories or output files.",
  },
  {
    id: "review-ledger-paths",
    re: /\b(?:REVIEWS_DIR|LEDGER_PATH|REPORT_PATH|VERIFY_LEDGER_PATH|VERIFY_REPORT_PATH|QUESTIONS_PATH)\b/,
    text: "Hardcodes review/ledger/questions path constants.",
  },
  {
    id: "exodus-source-text",
    re: /source-text|loadSourceForBook|exodus-verses/,
    text: "Hardcodes source-text loading path (currently Exodus-only).",
  },
  {
    id: "exodus-17-7-guard",
    re: /Massah|Meribah|Temptation and Abuse/,
    text: "Exodus 17:7 Massah/Meribah deterministic wording guard.",
  },
  {
    id: "group-placeholder",
    re: /groupA|groupB/,
    text: "Hardcoded group placeholder names.",
  },
];

const BOOK_AGNOSTIC = [
  {
    id: "schema-validation",
    re: /function validate|validateCandidate|invalid|must be a/,
    text: "Schema and validation logic for questions, candidates, and memory aids.",
  },
  {
    id: "merge-sort-write",
    re: /all\.sort|writeFileSync\(OUT|JSON\.stringify\(all\)/,
    text: "Merges, sorts, and writes the question bank.",
  },
  {
    id: "csv-parsing",
    re: /parseCsv|objectRows|\.csv/,
    text: "CSV parsing for review imports.",
  },
  {
    id: "review-packet-mechanics",
    re: /packet|reviewFile|candidateFile|normalizeCandidate|memoryAidFromCandidate/,
    text: "Review packet and candidate mechanics.",
  },
  {
    id: "cli-arg-parsing",
    re: /process\.argv|parseArgs|parseVerifyArgs/,
    text: "Command-line argument parsing.",
  },
  {
    id: "llm-lane-retry",
    re: /runLaneVerdictWithRetry|computeRetryDelayMs|computeQuestionDelayMs|maxRetries/,
    text: "LLM lane invocation, jitter, and retry scheduling.",
  },
  {
    id: "reference-parsing",
    re: /function parseReference|collectReferencedVerses|collectChapterVerses/,
    text: "Scripture reference parsing and verse collection.",
  },
  {
    id: "verdict-normalization",
    re: /normalizeJudgeVerdict|normalizeVerifyVerdict|normalizeSuggestedFields|normalizeCandidate/,
    text: "Normalizes judge/verifier verdicts and suggested fields.",
  },
  {
    id: "report-generation",
    re: /buildReport|buildVerifyReport|writeReport|writeJsonReport/,
    text: "Markdown/JSON report generation.",
  },
  {
    id: "backup-apply",
    re: /nextBackupPath|questions\.backup|applySuggestedChanges/,
    text: "Backup creation and application of approved changes.",
  },
  {
    id: "json-io",
    re: /readJson|writeJson|JSON\.parse|JSON\.stringify/,
    text: "JSON serialization helpers.",
  },
];

export function analyzeScript(relPath, lines) {
  const findings = [];
  for (const detector of BOOK_SPECIFIC) {
    const idx = lines.findIndex((line) => detector.re.test(line));
    if (idx !== -1) {
      findings.push({
        tag: "book-specific",
        text: detector.text,
        ref: `${relPath}:${idx + 1}`,
      });
    }
  }
  for (const detector of BOOK_AGNOSTIC) {
    const idx = lines.findIndex((line) => detector.re.test(line));
    if (idx !== -1) {
      findings.push({
        tag: "book-agnostic",
        text: detector.text,
      });
    }
  }
  return findings;
}
