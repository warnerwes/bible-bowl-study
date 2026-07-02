import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  QUESTIONS_PATH,
  LEDGER_PATH,
  applySuggestedChanges,
  collectChapterVerses,
  collectReferencedVerses,
  computeQuestionDelayMs,
  diffSuggestedFields,
  loadSourceForBook,
  nextBackupPath,
  parseReference,
  readJson,
  runLaneVerdictWithRetry,
  sleep,
  writeJson,
} from "./lib/osb-audit-core.mjs";
import {
  DEFAULT_VERIFY_FALLBACK_MODELS,
  DEFAULT_VERIFY_MODEL,
  VERIFY_LEDGER_PATH,
  VERIFY_REPORT_PATH,
  buildDroppedNullEntry,
  buildVerifyPrompt,
  buildVerifyReport,
  classifyVerificationResult,
  normalizeVerifyVerdict,
  parseVerifyArgs,
  reconcileVerifierVerdict,
  selectMismatchCandidates,
} from "./lib/osb-verify-core.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseVerifyArgs(process.argv.slice(2));
  if (args.apply) {
    await runApply(args);
  } else {
    await runVerify(args);
  }
}

async function runVerify(options) {
  const questions = await readJson(QUESTIONS_PATH);
  const auditLedger = await readJson(LEDGER_PATH, {});
  const verifyLedger = await readJson(VERIFY_LEDGER_PATH, {});
  const candidates = selectMismatchCandidates({
    questions,
    auditLedger,
    only: options.only,
    limit: options.limit,
  });
  const contextCache = new Map();
  let processed = 0;

  for (const question of candidates) {
    processed += 1;
    const auditEntry = auditLedger[question.id];
    const priorVerifyEntry = verifyLedger[question.id];
    if (shouldSkipVerify(priorVerifyEntry, options)) {
      printVerifyProgress({
        question,
        index: processed,
        total: candidates.length,
        entry: priorVerifyEntry,
        skipped: true,
      });
      continue;
    }

    const timestamp = new Date().toISOString();
    const nullEntry = buildNullChangeEntryIfNeeded({ question, auditEntry, model: options.model, timestamp });
    if (nullEntry) {
      verifyLedger[question.id] = nullEntry;
      await writeJson(VERIFY_LEDGER_PATH, verifyLedger);
      await writeVerifyReport({ questions, auditLedger, verifyLedger, contextCache });
      printVerifyProgress({
        question,
        index: processed,
        total: candidates.length,
        entry: nullEntry,
        skipped: false,
      });
      continue;
    }

    const verificationEntry = await verifyCandidate({
      question,
      auditEntry,
      options,
      timestamp,
      contextCache,
    });
    verifyLedger[question.id] = verificationEntry;
    await writeJson(VERIFY_LEDGER_PATH, verifyLedger);
    await writeVerifyReport({ questions, auditLedger, verifyLedger, contextCache });
    printVerifyProgress({
      question,
      index: processed,
      total: candidates.length,
      entry: verificationEntry,
      skipped: false,
    });
    if (processed < candidates.length) {
      await sleep(computeQuestionDelayMs(options.sleepMs));
    }
  }

  await writeVerifyReport({ questions, auditLedger, verifyLedger, contextCache });
  const summary = summarizeVerifyLedger({ verifyLedger, candidates });
  console.log("");
  console.log(`Verify ledger: ${VERIFY_LEDGER_PATH}`);
  console.log(`Verify report: ${VERIFY_REPORT_PATH}`);
  console.log(
    `Summary: candidates=${candidates.length} dropped-null=${summary.droppedNull} apply=${summary.apply} flag=${summary.flag} verify-errors=${summary.verifyErrors}`
  );
}

async function verifyCandidate({ question, auditEntry, options, timestamp, contextCache }) {
  const context = await loadQuestionContext(question, contextCache);
  if (!context.ok) {
    return {
      id: question.id,
      reference: question.reference,
      auditModel: auditEntry.model || null,
      auditConfidence: auditEntry.verdict?.confidence ?? null,
      model: options.model,
      timestamp,
      status: "flag",
      dropped: null,
      finalSuggested: auditEntry.verdict?.suggested || {},
      verifier: {
        realMismatch: false,
        fixCorrect: false,
        confidence: null,
        reason: context.error,
        correctedSuggested: {},
      },
      error: context.error,
    };
  }

  const prompt = buildVerifyPrompt({
    question,
    auditEntry,
    parsedReference: context.parsedReference,
    referencedVerses: context.referencedVerses,
    chapterVerses: context.chapterVerses,
  });
  const laneAttempt = await runVerificationLane({
    prompt,
    model: options.model,
    rpm: options.rpm,
    maxRetries: options.maxRetries,
  });
  const laneResult = laneAttempt.result;

  if (!laneResult.ok) {
    const verifier = {
      realMismatch: false,
      fixCorrect: false,
      confidence: null,
      reason: laneResult.error,
      correctedSuggested: {},
    };
    const entry = classifyVerificationResult({
      question,
      auditEntry,
      model: laneAttempt.model,
      timestamp,
      normalizedVerdict: verifier,
    });
    return {
      ...entry,
      status: "flag",
      requestedModel: options.model,
      fallbackFrom: laneAttempt.fallbackFrom || null,
      attempts: laneResult.attempts,
      jobDir: laneResult.jobDir || null,
      error: laneResult.error,
      rawOutput: laneResult.rawOutput || null,
    };
  }

  return {
    ...classifyVerificationResult({
      question,
      auditEntry,
      model: laneAttempt.model,
      timestamp,
      normalizedVerdict: reconcileVerifierVerdict({
        question,
        auditEntry,
        normalizedVerdict: normalizeVerifyVerdict(laneResult.rawVerdict),
        osbSnippet: context.osbSnippet,
      }),
    }),
    requestedModel: options.model,
    fallbackFrom: laneAttempt.fallbackFrom || null,
    attempts: laneResult.attempts,
    jobDir: laneResult.jobDir || null,
  };
}

async function runApply(options) {
  const questions = await readJson(QUESTIONS_PATH);
  const verifyLedger = await readJson(VERIFY_LEDGER_PATH, {});
  const idFilter = options.only.length ? new Set(options.only) : null;
  const applied = [];

  for (const question of questions) {
    if (idFilter && !idFilter.has(question.id)) continue;
    const verifyEntry = verifyLedger[question.id];
    if (!verifyEntry || verifyEntry.status !== "apply") continue;
    const changes = applySuggestedChanges(question, verifyEntry.finalSuggested);
    if (changes.length) {
      applied.push({ id: question.id, changes });
    }
  }

  if (!applied.length) {
    console.log("No APPLY entries matched the requested ids.");
    return;
  }

  const backupPath = await nextBackupPath();
  await writeFile(backupPath, await readFile(QUESTIONS_PATH, "utf8"), "utf8");
  await writeFile(QUESTIONS_PATH, JSON.stringify(questions), "utf8");

  console.log(`Backup: ${backupPath}`);
  for (const item of applied) {
    console.log(`Applied ${item.id}:`);
    for (const change of item.changes) {
      console.log(`  ${change}`);
    }
  }
}

function buildNullChangeEntryIfNeeded({ question, auditEntry, model, timestamp }) {
  const suggested = auditEntry.verdict?.suggested || {};
  const hasChange = diffSuggestedFields(question, suggested).length > 0;
  if (hasChange) return null;
  return buildDroppedNullEntry({ question, auditEntry, model, timestamp });
}

async function loadQuestionContext(question, contextCache) {
  const parsedReference = parseReference(question.reference);
  if (!parsedReference.ok) {
    return {
      ok: false,
      error: parsedReference.error,
    };
  }

  const cacheKey = parsedReference.book;
  let cached = contextCache.get(cacheKey);
  if (!cached) {
    cached = await loadSourceForBook(parsedReference.book);
    contextCache.set(cacheKey, cached);
  }
  if (!cached.source) {
    return {
      ok: false,
      error: `Missing source file: ${cached.sourcePath}`,
    };
  }

  const chapterVerses = collectChapterVerses(cached.source, parsedReference.chapter);
  if (!chapterVerses.length) {
    return {
      ok: false,
      error: `No source verses for chapter ${parsedReference.chapter}`,
    };
  }

  const referenced = collectReferencedVerses(cached.source, parsedReference);
  if (!referenced.ok) {
    return {
      ok: false,
      error: `Missing source verse ${referenced.missingKey}`,
    };
  }

  return {
    ok: true,
    parsedReference,
    chapterVerses,
    referencedVerses: referenced.verses,
    osbSnippet: referenced.verses.map(({ key, text }) => `${key} ${text}`).join(" "),
  };
}

async function writeVerifyReport({ questions, auditLedger, verifyLedger, contextCache }) {
  const contexts = {};
  for (const question of questions) {
    if (!verifyLedger[question.id]) continue;
    const context = await loadQuestionContext(question, contextCache);
    contexts[question.id] = {
      osbSnippet: context.ok ? context.osbSnippet : context.error,
    };
  }
  await writeJsonReport(buildVerifyReport({ questions, auditLedger, verifyLedger, contexts }));
}

async function writeJsonReport(report) {
  await writeFile(VERIFY_REPORT_PATH, report, "utf8");
}

function summarizeVerifyLedger({ verifyLedger, candidates }) {
  const candidateIds = new Set(candidates.map((question) => question.id));
  const summary = {
    droppedNull: 0,
    apply: 0,
    flag: 0,
    verifyErrors: 0,
  };
  for (const [id, entry] of Object.entries(verifyLedger)) {
    if (!candidateIds.has(id)) continue;
    if (entry.dropped === "null-change") {
      summary.droppedNull += 1;
    }
    if (entry.status === "apply") {
      summary.apply += 1;
      continue;
    }
    summary.flag += 1;
    if (entry.error) {
      summary.verifyErrors += 1;
    }
  }
  return summary;
}

function shouldSkipVerify(entry, options) {
  if (!entry || !options.resume || options.force) return false;
  return true;
}

async function runVerificationLane({ prompt, model, rpm, maxRetries }) {
  const primary = await runLaneVerdictWithRetry({
    prompt,
    model,
    rpm,
    maxRetries,
  });
  if (primary.ok || !shouldFallbackModel(model, primary.error)) {
    return { model, result: primary, fallbackFrom: null };
  }

  for (const fallbackModel of DEFAULT_VERIFY_FALLBACK_MODELS) {
    if (fallbackModel === model) continue;
    console.log(`  fallback model ${fallbackModel} after ${primary.error}`);
    const fallback = await runLaneVerdictWithRetry({
      prompt,
      model: fallbackModel,
      rpm,
      maxRetries,
    });
    if (fallback.ok || !isModelUnavailableError(fallback.error)) {
      return {
        model: fallbackModel,
        result: fallback,
        fallbackFrom: model,
      };
    }
  }

  return { model, result: primary, fallbackFrom: null };
}

function shouldFallbackModel(model, error) {
  if (model !== DEFAULT_VERIFY_MODEL) return false;
  return isModelUnavailableError(error);
}

function isModelUnavailableError(error) {
  return /\b(?:404|410)\b/.test(String(error || ""));
}

function printVerifyProgress({ question, index, total, entry, skipped }) {
  const bits = [`[${index}/${total}]`, question.id, question.reference, `status=${entry.status}`];
  if (entry.dropped) bits.push(`dropped=${entry.dropped}`);
  if (entry.status === "apply") bits.push("bucket=APPLY");
  if (entry.status === "flag") bits.push("bucket=FLAG");
  if (skipped) bits.push("skipped");
  console.log(bits.join(" "));
}
