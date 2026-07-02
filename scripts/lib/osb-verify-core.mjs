import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_SLEEP_MS,
  diffSuggestedFields,
  normalizeSuggestedFields,
} from "./osb-audit-core.mjs";

export const VERIFY_LEDGER_PATH = "data/reviews/osb-verify-ledger.json";
export const VERIFY_REPORT_PATH = "data/reviews/osb-verify-report.md";
export const VERIFY_MODEL_CANDIDATES = [
  "mistralai/mixtral-8x22b-instruct-v0.1",
  "qwen/qwen2.5-72b-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "mistralai/mixtral-8x7b-instruct-v0.1",
];
export const DEFAULT_VERIFY_MODEL = "mistralai/mixtral-8x7b-instruct-v0.1";
export const DEFAULT_VERIFY_FALLBACK_MODELS = VERIFY_MODEL_CANDIDATES.filter(
  (model) => model !== DEFAULT_VERIFY_MODEL
);

export function parseVerifyArgs(argv) {
  const args = {
    apply: false,
    only: [],
    limit: null,
    model: DEFAULT_VERIFY_MODEL,
    sleepMs: DEFAULT_SLEEP_MS,
    rpm: 40,
    resume: true,
    force: false,
    maxRetries: DEFAULT_MAX_RETRIES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--only") {
      args.only = splitCsv(next);
      index += 1;
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(next, 10);
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

  return args;
}

export function selectMismatchCandidates({ questions, auditLedger, only = [], limit = null }) {
  const idFilter = only.length ? new Set(only) : null;
  let selected = questions.filter((question) => {
    if (idFilter && !idFilter.has(question.id)) return false;
    return auditLedger[question.id]?.status === "mismatch";
  });
  if (limit !== null) {
    selected = selected.slice(0, limit);
  }
  return selected;
}

export function buildVerifyPrompt({
  question,
  auditEntry,
  parsedReference,
  referencedVerses,
  chapterVerses,
}) {
  const questionPayload = {
    id: question.id,
    reference: question.reference,
    type: question.type,
    question: question.question,
    answer: question.answer,
    acceptableAnswers: question.acceptableAnswers,
    options: question.options,
    memoryAidText: question.memoryAid?.text,
  };
  const auditPayload = {
    model: auditEntry.model || null,
    confidence: auditEntry.verdict?.confidence ?? null,
    issues: auditEntry.verdict?.issues || [],
    fixType: auditEntry.verdict?.fixType || "none",
    suggested: auditEntry.verdict?.suggested || {},
    osbTerms: auditEntry.verdict?.osbTerms || "",
  };

  return [
    "# Role",
    "You are a skeptical verifier checking a previously-flagged Bible-bowl question against the Orthodox Study Bible, St. Athanasius Academy Septuagint (OSB/SAAS).",
    "",
    "# Mission",
    "Your job is to REFUTE the prior audit unless the mismatch is clearly real from the OSB text alone.",
    "Bias toward realMismatch=false when uncertain, when the wording is defensible, or when the proposed fix is not clearly justified by the provided OSB text.",
    "Use ONLY the OSB text below. Ignore outside Bible knowledge, lexicons, and prior assumptions.",
    "Treat the provided chapter text as exhaustive for this decision. If a name or term does not appear in the supplied OSB text, do not import it from another translation or tradition.",
    "",
    "# Referenced Verses",
    `Reference: ${parsedReference.raw}`,
    formatVerseBlock(referencedVerses),
    "",
    "# Whole Chapter Context",
    formatVerseBlock(chapterVerses),
    "",
    "# Current Question Record",
    JSON.stringify(questionPayload, null, 2),
    "",
    "# Prior Audit Proposal",
    JSON.stringify(auditPayload, null, 2),
    "",
    "# Decision Rules",
    "realMismatch=true only if the current question materially conflicts with the OSB wording.",
    "fixCorrect=true only if the proposed fix is itself correct and appropriate.",
    "For proper names and key terms, exact OSB wording matters more than semantic equivalence. If the current card uses a different name than the supplied OSB text, that is a real mismatch even if the meaning is similar.",
    "If the proposed fix replaces a non-OSB name or term with the exact wording present in the supplied OSB text, that is strong evidence that the fix is correct.",
    "If the current question, answer, options, acceptable answers, or memory aid use a name or term that does not appear in the supplied OSB text for that event, that is strong evidence of a real mismatch.",
    "Do not 'restore' names from outside the supplied OSB text. Judge only the wording that actually appears in the supplied OSB chapter.",
    "If the mismatch is real but the proposed fix is wrong or incomplete, set realMismatch=true and fixCorrect=false, then provide correctedSuggested.",
    "If you provide correctedSuggested, only include changed keys and keep the same shape as suggested.",
    "",
    "# Output Contract",
    "Return ONLY a SINGLE minified JSON object on one line with no prose or markdown.",
    JSON.stringify({
      realMismatch: false,
      fixCorrect: false,
      confidence: 0,
      reason: "Short explanation tied to OSB wording",
      correctedSuggested: {
        reference: "Exodus 17:7",
        question: "Rewritten question",
        answer: "Rewritten answer",
        acceptableAnswers: ["updated answers"],
        options: ["updated options"],
        memoryAidText: "updated memory aid",
      },
    }),
  ].join("\n");
}

export function normalizeVerifyVerdict(rawVerdict) {
  const verdict = rawVerdict && typeof rawVerdict === "object" ? rawVerdict : {};
  return {
    realMismatch: verdict.realMismatch === true,
    fixCorrect: verdict.fixCorrect === true,
    confidence: clampConfidence(verdict.confidence),
    reason: String(verdict.reason || "No verifier reason provided."),
    correctedSuggested: normalizeSuggestedFields(verdict.correctedSuggested),
  };
}

export function buildDroppedNullEntry({ question, auditEntry, model, timestamp }) {
  return {
    id: question.id,
    reference: question.reference,
    auditModel: auditEntry.model || null,
    auditConfidence: auditEntry.verdict?.confidence ?? null,
    model,
    timestamp,
    status: "flag",
    dropped: "null-change",
    finalSuggested: normalizeSuggestedFields(auditEntry.verdict?.suggested),
    verifier: {
      realMismatch: false,
      fixCorrect: false,
      confidence: null,
      reason: "Dropped before verification because the audit's suggested patch makes no effective change.",
      correctedSuggested: {},
    },
  };
}

export function classifyVerificationResult({
  question,
  auditEntry,
  model,
  timestamp,
  normalizedVerdict,
}) {
  const auditSuggested = normalizeSuggestedFields(auditEntry.verdict?.suggested);
  const correctedSuggested = normalizedVerdict.correctedSuggested;
  const preferredSuggested = Object.keys(correctedSuggested).length ? correctedSuggested : auditSuggested;
  const finalSuggested = normalizeSuggestedFields(preferredSuggested);
  const effectiveChanges = diffSuggestedFields(question, finalSuggested);
  const base = {
    id: question.id,
    reference: question.reference,
    auditModel: auditEntry.model || null,
    auditConfidence: auditEntry.verdict?.confidence ?? null,
    model,
    timestamp,
    dropped: null,
    finalSuggested,
    verifier: normalizedVerdict,
  };

  if (normalizedVerdict.realMismatch && normalizedVerdict.fixCorrect && effectiveChanges.length > 0) {
    return {
      ...base,
      status: "apply",
    };
  }

  let reason = normalizedVerdict.reason;
  if (normalizedVerdict.realMismatch && normalizedVerdict.fixCorrect && effectiveChanges.length === 0) {
    reason = `${reason} Final suggested patch makes no effective change, so it was flagged instead of applied.`;
  }

  return {
    ...base,
    status: "flag",
    verifier: {
      ...normalizedVerdict,
      reason,
    },
  };
}

export function reconcileVerifierVerdict({
  question,
  auditEntry,
  normalizedVerdict,
  osbSnippet,
}) {
  const osbTerms = String(auditEntry.verdict?.osbTerms || "").trim();
  if (!osbTerms) return normalizedVerdict;

  const reason = String(normalizedVerdict.reason || "");
  const reasonLower = reason.toLowerCase();
  const acknowledgesMismatch =
    /do not match the osb wording/.test(reasonLower) ||
    /does not match the osb wording/.test(reasonLower) ||
    /do not appear in the provided osb text/.test(reasonLower) ||
    /do not appear in the supplied osb text/.test(reasonLower) ||
    /not explicitly mentioned in the osb text/.test(reasonLower);

  const snippetLower = String(osbSnippet || "").toLowerCase();
  const currentLower = flattenQuestionText(question).toLowerCase();
  const suggestedLower = flattenSuggestedText(auditEntry.verdict?.suggested).toLowerCase();
  const osbTermsLower = osbTerms.toLowerCase();
  const namesPlaceExactly = snippetLower.includes(`called the name of that place ${osbTermsLower}`);

  if (!snippetLower.includes(osbTermsLower)) return normalizedVerdict;
  if (currentLower.includes(osbTermsLower)) return normalizedVerdict;
  if (!suggestedLower.includes(osbTermsLower)) return normalizedVerdict;

  if (namesPlaceExactly) {
    return {
      ...normalizedVerdict,
      realMismatch: true,
      fixCorrect: true,
      reason: `${reason} Deterministic guard: the supplied OSB verse explicitly says, "called the name of that place ${osbTerms}", and the audit fix moves the card to that exact OSB name phrase.`,
      correctedSuggested: {},
    };
  }

  if (!acknowledgesMismatch) return normalizedVerdict;

  return {
    ...normalizedVerdict,
    realMismatch: true,
    fixCorrect: true,
    reason: `${reason} Deterministic guard: the verifier reason itself acknowledges a wording mismatch, and the audit fix moves the card to the exact OSB term "${osbTerms}".`,
    correctedSuggested: {},
  };
}

export function buildVerifyReport({ questions, auditLedger, verifyLedger, contexts = {} }) {
  const orderedEntries = questions
    .map((question) => ({ question, verifyEntry: verifyLedger[question.id], auditEntry: auditLedger[question.id] }))
    .filter(({ verifyEntry }) => verifyEntry);

  const applyItems = orderedEntries.filter(({ verifyEntry }) => verifyEntry.status === "apply");
  const flagItems = orderedEntries.filter(({ verifyEntry }) => verifyEntry.status !== "apply");
  const lines = ["# OSB Verify Report", ""];

  appendSection(lines, {
    title: "APPLY",
    items: applyItems,
    contexts,
  });
  appendSection(lines, {
    title: "FLAG",
    items: flagItems,
    contexts,
  });

  return `${lines.join("\n")}\n`;
}

function appendSection(lines, { title, items, contexts }) {
  lines.push(`## ${title}`);
  lines.push("");
  if (!items.length) {
    lines.push("None.");
    lines.push("");
    return;
  }

  for (const { question, verifyEntry, auditEntry } of items) {
    const context = contexts[question.id] || {};
    lines.push(`### ${question.id} - ${question.reference}`);
    lines.push(`- OSB: ${context.osbSnippet || "Unavailable"}`);
    for (const changeLine of renderBeforeAfterLines(question, verifyEntry.finalSuggested, verifyEntry.dropped)) {
      lines.push(changeLine);
    }
    lines.push(`- Audit confidence: ${formatConfidence(auditEntry?.verdict?.confidence ?? verifyEntry.auditConfidence)}`);
    lines.push(`- Verify confidence: ${formatConfidence(verifyEntry.verifier?.confidence ?? null)}`);
    lines.push(`- Verifier reason: ${verifyEntry.verifier?.reason || "No verifier reason provided."}`);
    lines.push("");
  }
}

function renderBeforeAfterLines(question, suggested, dropped) {
  const changes = diffSuggestedFields(question, suggested);
  if (!changes.length) {
    if (dropped === "null-change") {
      return ["- Before -> After: no effective change; dropped as null-change."];
    }
    return ["- Before -> After: no effective change proposed."];
  }
  return ["- Before -> After:", ...changes.map((change) => `  - ${change}`)];
}

function splitCsv(value) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function clampConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function formatConfidence(confidence) {
  return confidence === null ? "unknown" : String(confidence);
}

function formatVerseBlock(verses) {
  return verses.map(({ key, text }) => `${key}  ${text}`).join("\n");
}

function flattenQuestionText(question) {
  return [
    question.question,
    question.answer,
    ...(question.acceptableAnswers || []),
    ...(question.options || []),
    question.memoryAid?.text,
  ]
    .filter(Boolean)
    .join(" ");
}

function flattenSuggestedText(suggested) {
  return Object.values(normalizeSuggestedFields(suggested))
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      return [value];
    })
    .filter(Boolean)
    .join(" ");
}
