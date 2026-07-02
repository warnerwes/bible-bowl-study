import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { DEFAULT_NVIDIA_RPM, getSharedNvidiaClient } from "./nvidia-client.mjs";

export const QUESTIONS_PATH = "data/questions.json";
export const REVIEWS_DIR = "data/reviews";
export const LEDGER_PATH = path.join(REVIEWS_DIR, "osb-audit-ledger.json");
export const REPORT_PATH = path.join(REVIEWS_DIR, "osb-audit-report.md");
export const DEFAULT_MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1";
export const DEFAULT_SLEEP_MS = 0;
export const DEFAULT_MAX_RETRIES = 4;
export const DEFAULT_RPM = DEFAULT_NVIDIA_RPM;
export const SUGGESTED_KEYS = [
  "reference",
  "question",
  "answer",
  "acceptableAnswers",
  "options",
  "memoryAidText",
];

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (fallback !== null && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function writeJson(filePath, value, { pretty = true } = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const content = pretty ? `${JSON.stringify(value, null, 2)}\n` : JSON.stringify(value);
  await writeFile(filePath, content, "utf8");
}

export function parseArgs(argv) {
  const args = {
    apply: false,
    limit: null,
    only: [],
    model: DEFAULT_MODEL,
    sleepMs: DEFAULT_SLEEP_MS,
    rpm: DEFAULT_RPM,
    resume: true,
    force: false,
    retryErrors: false,
    maxRetries: DEFAULT_MAX_RETRIES,
    minConfidence: 0.75,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--only") {
      args.only = splitCsv(next);
      index += 1;
    } else if (arg === "--model") {
      args.model = next;
      index += 1;
    } else if (arg === "--sleep") {
      args.sleepMs = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--rpm") {
      args.rpm = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--max-retries") {
      args.maxRetries = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--resume") {
      args.resume = true;
    } else if (arg === "--no-resume") {
      args.resume = false;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--retry-errors") {
      args.retryErrors = true;
    } else if (arg === "--min-confidence") {
      args.minConfidence = Number.parseFloat(next);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isFinite(args.sleepMs) || args.sleepMs < 0) {
    throw new Error("--sleep must be zero or greater");
  }
  if (!Number.isInteger(args.rpm) || args.rpm < 1) {
    throw new Error("--rpm must be a positive integer");
  }
  if (!Number.isInteger(args.maxRetries) || args.maxRetries < 0) {
    throw new Error("--max-retries must be zero or greater");
  }
  if (!Number.isFinite(args.minConfidence) || args.minConfidence < 0 || args.minConfidence > 1) {
    throw new Error("--min-confidence must be between 0 and 1");
  }

  return args;
}

function splitCsv(value) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function slugifyBook(book) {
  return String(book || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function loadSourceForBook(book) {
  const slug = slugifyBook(book);
  const sourcePath = path.join("data", "source-text", slug, `${slug}-verses.json`);
  return {
    sourcePath,
    source: await readJson(sourcePath, null),
  };
}

export function parseReference(reference) {
  const raw = String(reference || "").trim();
  const cleaned = stripReferenceSuffix(raw);
  const match = cleaned.match(/^([1-3]?\s*[A-Za-z][A-Za-z' -]*)\s+(.+)$/);
  if (!match) return invalidReference(raw, `Unsupported reference format: ${raw}`);

  const [, bookText, body] = match;
  const segments = [];
  for (const clause of body.split(/\s*;\s*/).filter(Boolean)) {
    const parsedClause = parseReferenceClause(clause, raw);
    if (!parsedClause.ok) return parsedClause;
    segments.push(...parsedClause.segments);
  }
  if (!segments.length) {
    return invalidReference(raw, `Unsupported reference format: ${raw}`);
  }

  const [firstSegment] = segments;
  return {
    ok: true,
    raw,
    book: bookText.trim(),
    chapter: firstSegment.startChapter,
    startVerse: firstSegment.startVerse,
    endVerse: firstSegment.endVerse,
    segments,
  };
}

export function collectChapterVerses(source, chapter) {
  const lines = [];
  const prefix = `${chapter}:`;
  for (const [key, text] of Object.entries(source.verses || {})) {
    if (!key.startsWith(prefix)) continue;
    const verse = Number.parseInt(key.slice(prefix.length), 10);
    lines.push({ key, chapter, verse, text });
  }
  lines.sort((left, right) => left.verse - right.verse);
  return lines;
}

export function collectReferencedVerses(source, parsedReference) {
  const segments = parsedReference.segments || [
    {
      startChapter: parsedReference.chapter,
      endChapter: parsedReference.chapter,
      startVerse: parsedReference.startVerse,
      endVerse: parsedReference.endVerse,
      wholeChapter: false,
    },
  ];
  const verses = [];
  const seenKeys = new Set();
  const missingKeys = [];

  for (const segment of segments) {
    if (segment.wholeChapter) {
      const chapterVerses = collectChapterVerses(source, segment.startChapter);
      if (!chapterVerses.length) {
        missingKeys.push(`${segment.startChapter}:1`);
        continue;
      }
      for (const entry of chapterVerses) {
        if (seenKeys.has(entry.key)) continue;
        seenKeys.add(entry.key);
        verses.push(entry);
      }
      continue;
    }

    for (let chapter = segment.startChapter; chapter <= segment.endChapter; chapter += 1) {
      const chapterVerses = collectChapterVerses(source, chapter);
      const firstVerse = chapterVerses[0]?.verse ?? 1;
      const lastVerse = chapterVerses[chapterVerses.length - 1]?.verse ?? 0;
      const startVerse = chapter === segment.startChapter ? segment.startVerse : firstVerse;
      const endVerse = chapter === segment.endChapter ? segment.endVerse : lastVerse;
      const verseMap = new Map(chapterVerses.map((entry) => [entry.verse, entry]));

      for (let verse = startVerse; verse <= endVerse; verse += 1) {
        const entry = verseMap.get(verse);
        if (!entry) {
          missingKeys.push(`${chapter}:${verse}`);
          continue;
        }
        if (seenKeys.has(entry.key)) continue;
        seenKeys.add(entry.key);
        verses.push(entry);
      }
    }
  }

  return {
    ok: verses.length > 0,
    missingKey: missingKeys[0] || null,
    missingKeys,
    verses,
  };
}

export function buildPrompt({ record, parsedReference, source, referencedVerses, chapterVerses }) {
  const chapterBlock = formatVerseBlock(chapterVerses);
  const referenceBlock = formatVerseBlock(referencedVerses);
  const recordPayload = {
    id: record.id,
    book: record.book,
    chapter: record.chapter,
    topic: record.topic,
    reference: record.reference,
    type: record.type,
    question: record.question,
    answer: record.answer,
    acceptableAnswers: record.acceptableAnswers,
    options: record.options,
    memoryAidText: record.memoryAid?.text,
    memoryAidSource: record.memoryAid?.source,
  };

  return [
    "# Role",
    "You are auditing a Bible-bowl question against the Orthodox Study Bible, St. Athanasius Academy Septuagint (OSB/SAAS).",
    "",
    "# Rules",
    "The ONLY authoritative text is the OSB/SAAS text provided below.",
    "If a proper name or key term in the question, answer, options, acceptable answers, or memory aid differs from OSB wording, that is a MISMATCH.",
    "The fix must be EITHER a reference correction, a wording correction, or both.",
    "Prefer minimal edits.",
    "Do not change correct theology or pedagogy unless the wording conflicts with the OSB text.",
    "If the current reference looks wrong but a nearby verse in the chapter matches the wording better, suggest the corrected reference.",
    "",
    "# Referenced Verses",
    `Reference: ${parsedReference.raw}`,
    referenceBlock,
    "",
    "# Whole Chapter Context",
    chapterBlock,
    "",
    "# Question Record",
    JSON.stringify(recordPayload, null, 2),
    "",
    "# Output Contract",
    "Return ONLY a SINGLE minified JSON object with no prose, no markdown fences, and no leading or trailing text.",
    "confidence must be a numeric value between 0 and 1.",
    JSON.stringify(
      {
        match: true,
        confidence: 0.0,
        issues: ["short strings"],
        fixType: "none",
        suggested: {
          reference: "Exodus 17:7",
          question: "Rewritten question",
          answer: "Rewritten answer",
          acceptableAnswers: ["updated answers"],
          options: ["updated options"],
          memoryAidText: "updated memory aid",
        },
        osbTerms: "exact OSB wording to use",
      }
    ),
    "Only include keys under suggested that actually change.",
  ].join("\n");
}

function formatVerseBlock(verses) {
  return verses.map(({ key, text }) => `${key}  ${text}`).join("\n");
}

function stripReferenceSuffix(reference) {
  let cleaned = String(reference || "").trim();
  while (/\s+\([^()]+\)\s*$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s+\([^()]+\)\s*$/, "").trim();
  }
  return cleaned;
}

function parseReferenceClause(clause, raw) {
  const chapterOnly = clause.match(/^(\d+)$/);
  if (chapterOnly) {
    const chapter = Number.parseInt(chapterOnly[1], 10);
    return {
      ok: true,
      segments: [createSegment({ startChapter: chapter, wholeChapter: true })],
    };
  }

  const crossChapterRange = clause.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/);
  if (crossChapterRange) {
    const [, startChapterText, startVerseText, endChapterText, endVerseText] = crossChapterRange;
    const startChapter = Number.parseInt(startChapterText, 10);
    const startVerse = Number.parseInt(startVerseText, 10);
    const endChapter = Number.parseInt(endChapterText, 10);
    const endVerse = Number.parseInt(endVerseText, 10);
    if (endChapter < startChapter || (endChapter === startChapter && endVerse < startVerse)) {
      return invalidReference(raw, `Invalid verse range: ${raw}`);
    }
    return {
      ok: true,
      segments: [createSegment({ startChapter, startVerse, endChapter, endVerse })],
    };
  }

  const sameChapterRange = clause.match(/^(\d+):(\d+)\s*-\s*(\d+)$/);
  if (sameChapterRange) {
    const [, chapterText, startVerseText, endVerseText] = sameChapterRange;
    const chapter = Number.parseInt(chapterText, 10);
    const startVerse = Number.parseInt(startVerseText, 10);
    const endVerse = Number.parseInt(endVerseText, 10);
    if (endVerse < startVerse) {
      return invalidReference(raw, `Invalid verse range: ${raw}`);
    }
    return {
      ok: true,
      segments: [createSegment({ startChapter: chapter, startVerse, endVerse })],
    };
  }

  const verseList = clause.match(/^(\d+):(\d+(?:\s*,\s*\d+)*)$/);
  if (verseList) {
    const chapter = Number.parseInt(verseList[1], 10);
    const verses = verseList[2].split(/\s*,\s*/).map((entry) => Number.parseInt(entry, 10));
    return {
      ok: true,
      segments: verses.map((verse) => createSegment({ startChapter: chapter, startVerse: verse })),
    };
  }

  return invalidReference(raw, `Unsupported reference format: ${raw}`);
}

function createSegment({
  startChapter,
  startVerse = null,
  endChapter = startChapter,
  endVerse = startVerse,
  wholeChapter = false,
}) {
  return {
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    wholeChapter,
  };
}

function invalidReference(raw, error) {
  return {
    ok: false,
    raw,
    error,
  };
}

export function extractJsonObject(text) {
  const cleaned = String(text || "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start < 0) {
    throw new Error("No JSON object found in model output");
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(start, index + 1);
      }
    }
  }
  throw new Error("Unterminated JSON object in model output");
}

export function normalizeJudgeVerdict(rawVerdict) {
  const verdict = rawVerdict && typeof rawVerdict === "object" ? rawVerdict : {};
  const fixType = ["none", "reference", "wording", "both"].includes(verdict.fixType)
    ? verdict.fixType
    : verdict.match === false ? "wording" : "none";
  const suggested = normalizeSuggestedFields(verdict.suggested);
  return {
    match: verdict.match === true,
    confidence: clampConfidence(verdict.confidence),
    issues: Array.isArray(verdict.issues)
      ? verdict.issues.map((issue) => String(issue)).filter(Boolean)
      : [],
    fixType,
    suggested,
    osbTerms: verdict.osbTerms ? String(verdict.osbTerms) : "",
  };
}

function clampConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

export function normalizeSuggestedFields(rawSuggested) {
  const suggested = {};
  if (!rawSuggested || typeof rawSuggested !== "object") {
    return suggested;
  }
  for (const key of SUGGESTED_KEYS) {
    if (Object.hasOwn(rawSuggested, key)) {
      suggested[key] = rawSuggested[key];
    }
  }
  return suggested;
}

export function summarizeLedger(ledger) {
  const summary = {
    match: 0,
    mismatch: 0,
    "no-source": 0,
    "lane-error": 0,
    other: 0,
  };
  for (const entry of Object.values(ledger)) {
    const status = entry?.status;
    if (status === "match") summary.match += 1;
    else if (status === "mismatch") summary.mismatch += 1;
    else if (status === "no-source") summary["no-source"] += 1;
    else if (status === "lane-error") summary["lane-error"] += 1;
    else summary.other += 1;
  }
  return summary;
}

export function buildReport({ questions, ledger }) {
  const mismatches = questions
    .map((question) => ({ question, entry: ledger[question.id] }))
    .filter(({ entry }) => entry?.status === "mismatch");

  const groups = new Map();
  for (const item of mismatches) {
    const key = item.entry.verdict.fixType || "wording";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const lines = ["# OSB Audit Report", ""];
  if (mismatches.length === 0) {
    lines.push("No mismatches recorded in the current ledger.");
    return `${lines.join("\n")}\n`;
  }

  for (const key of ["both", "reference", "wording", "none"]) {
    const items = groups.get(key);
    if (!items?.length) continue;
    lines.push(`## ${key}`);
    lines.push("");
    for (const { question, entry } of items) {
      lines.push(`### ${question.id} — ${question.reference}`);
      lines.push(`- Confidence: ${formatConfidence(entry.verdict.confidence)}`);
      lines.push(`- Issues: ${entry.verdict.issues.join("; ") || "None provided"}`);
      lines.push(`- OSB terms: ${entry.verdict.osbTerms || "Not provided"}`);
      const changes = diffSuggestedFields(question, entry.verdict.suggested);
      if (changes.length === 0) {
        lines.push("- Suggested changes: None provided");
      } else {
        lines.push("- Suggested changes:");
        for (const change of changes) {
          lines.push(`  - ${change}`);
        }
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatConfidence(confidence) {
  return confidence === null ? "unknown" : String(confidence);
}

export function diffSuggestedFields(question, suggested) {
  const changes = [];
  for (const [key, nextValue] of Object.entries(suggested || {})) {
    const currentValue = key === "memoryAidText" ? question.memoryAid?.text : question[key];
    const currentJson = JSON.stringify(currentValue);
    const nextJson = JSON.stringify(nextValue);
    if (currentJson === nextJson) continue;
    changes.push(`${key}: ${currentJson} -> ${nextJson}`);
  }
  return changes;
}

export async function writeReport({ questions, ledger }) {
  await mkdir(REVIEWS_DIR, { recursive: true });
  await writeFile(REPORT_PATH, buildReport({ questions, ledger }), "utf8");
}

export function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function nextBackupPath() {
  await mkdir(REVIEWS_DIR, { recursive: true });
  const entries = await readdir(REVIEWS_DIR);
  const counts = entries
    .map((name) => name.match(/^questions\.backup\.(\d+)\.json$/))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));
  const next = counts.length ? Math.max(...counts) + 1 : 1;
  return path.join(REVIEWS_DIR, `questions.backup.${next}.json`);
}

export async function fileLineCount(filePath) {
  const content = await readFile(filePath, "utf8");
  return content.split(/\r?\n/).length;
}

export async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function computeQuestionDelayMs(baseMs, random = Math.random) {
  if (baseMs <= 0) return 0;
  return Math.max(0, baseMs + randomJitter(400, random));
}

export function computeRetryDelayMs(retryNumber, random = Math.random) {
  const schedule = [3000, 8000, 20000, 45000];
  const baseMs = schedule[Math.min(retryNumber - 1, schedule.length - 1)];
  return Math.max(0, baseMs + randomJitter(500, random));
}

export async function runLaneVerdictWithRetry({
  prompt,
  model,
  rpm = DEFAULT_RPM,
  maxRetries = 0,
  invokeLane = runProviderLane,
  wait = sleep,
  random = Math.random,
  onRetry = defaultRetryLogger,
  shouldRetryError = defaultShouldRetryError,
} = {}) {
  let attempts = 0;
  let lastFailure = null;

  while (attempts <= maxRetries) {
    attempts += 1;
    const laneResult = await invokeLane(prompt, model, { rpm });
    if (!laneResult.ok) {
      lastFailure = {
        ok: false,
        attempts,
        jobDir: laneResult.jobDir || null,
        error: summarizeRetryFailure(laneResult),
        httpStatus: laneResult.httpStatus ?? laneResult.errorObject?.status ?? null,
        retryAfterMs: laneResult.retryAfterMs ?? laneResult.errorObject?.retryAfterMs ?? null,
        rawOutput: laneResult.rawOutput || laneResult.stdout || undefined,
      };
    } else {
      try {
        return {
          ok: true,
          attempts,
          jobDir: laneResult.jobDir,
          stdout: laneResult.stdout,
          rawVerdict: JSON.parse(extractJsonObject(laneResult.stdout)),
        };
      } catch (error) {
        lastFailure = {
          ok: false,
          attempts,
          jobDir: laneResult.jobDir || null,
          error: `Invalid judge JSON: ${error.message}`,
          rawOutput: laneResult.stdout,
        };
      }
    }

    if (attempts > maxRetries || !shouldRetryError(lastFailure)) break;
    const retryNumber = attempts;
    const delayMs =
      lastFailure.httpStatus === 429 && Number.isFinite(lastFailure.retryAfterMs)
        ? lastFailure.retryAfterMs
        : computeRetryDelayMs(retryNumber, random);
    onRetry({ retryNumber, maxRetries, error: lastFailure.error, delayMs, httpStatus: lastFailure.httpStatus });
    await wait(delayMs);
  }

  return lastFailure || {
    ok: false,
    attempts,
    jobDir: null,
    error: "Lane failed without an error message",
  };
}

export function applySuggestedChanges(question, suggested) {
  const changes = [];
  for (const [key, value] of Object.entries(suggested || {})) {
    if (value === undefined) continue;
    if (key === "memoryAidText") {
      const current = question.memoryAid?.text;
      if (JSON.stringify(current) === JSON.stringify(value)) continue;
      question.memoryAid = question.memoryAid || {};
      question.memoryAid.text = value;
      changes.push(`memoryAid.text: ${JSON.stringify(current)} -> ${JSON.stringify(value)}`);
      continue;
    }
    const current = question[key];
    if (JSON.stringify(current) === JSON.stringify(value)) continue;
    question[key] = value;
    changes.push(`${key}: ${JSON.stringify(current)} -> ${JSON.stringify(value)}`);
  }
  return changes;
}

function randomJitter(maxAbsMs, random = Math.random) {
  const sample = typeof random === "function" ? random() : Math.random();
  return Math.round((sample * 2 - 1) * maxAbsMs);
}

function defaultRetryLogger({ retryNumber, maxRetries, error }) {
  console.log(`  retry ${retryNumber}/${maxRetries} after ${truncateRetryError(error)}`);
}

function truncateRetryError(error) {
  const text = String(error || "unknown lane error").replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function defaultShouldRetryError(failure) {
  const status = extractRetryStatus(failure);
  if (status === 404 || status === 410) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  if (status >= 400) return false;
  return true;
}

async function runProviderLane(prompt, model, { rpm } = {}) {
  try {
    const stdout = await (await getSharedNvidiaClient({ rpm })).chat({
      model,
      prompt,
      temperature: 0,
    });
    return { ok: true, jobDir: null, stdout };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "NVIDIA request failed",
      errorObject: error,
      httpStatus: error?.status ?? null,
      retryAfterMs: error?.retryAfterMs ?? null,
      rawOutput: error?.responseText || "",
    };
  }
}

function summarizeRetryFailure(laneResult) {
  if (typeof laneResult.error === "string" && laneResult.error.trim()) {
    return laneResult.error.trim();
  }
  if (laneResult.errorObject?.message) {
    return String(laneResult.errorObject.message).trim();
  }
  if (laneResult.httpStatus) {
    return `HTTP ${laneResult.httpStatus}`;
  }
  return "Lane failed";
}

function extractRetryStatus(failure) {
  if (typeof failure === "number") return failure;
  if (failure?.httpStatus) return failure.httpStatus;
  if (failure?.status) return failure.status;
  if (failure?.errorObject?.status) return failure.errorObject.status;
  const match = String(failure?.error ?? failure ?? "").match(/\b(404|410|429|5\d\d)\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}
