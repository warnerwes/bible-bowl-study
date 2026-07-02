import path from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "node:fs/promises";
import {
  applySuggestedChanges,
  QUESTIONS_PATH,
  LEDGER_PATH,
  DEFAULT_MODEL,
  REPORT_PATH,
  buildPrompt,
  computeQuestionDelayMs,
  computeRetryDelayMs,
  collectChapterVerses,
  collectReferencedVerses,
  loadSourceForBook,
  nextBackupPath,
  normalizeJudgeVerdict,
  parseArgs,
  parseReference,
  readJson,
  runLaneVerdictWithRetry,
  sleep,
  summarizeLedger,
  writeJson,
  writeReport,
} from "./lib/osb-audit-core.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply) {
    await runApply(args);
  } else {
    await runAudit(args);
  }
}

async function runAudit(options) {
  const questions = await readJson(QUESTIONS_PATH);
  const ledger = await readJson(LEDGER_PATH, {});
  const selected = selectQuestions(questions, options);
  let processed = 0;

  for (const question of selected) {
    processed += 1;
    if (shouldSkipQuestion(ledger[question.id], options)) {
      printProgress({
        index: processed,
        total: selected.length,
        question,
        entry: ledger[question.id],
        skipped: true,
      });
      continue;
    }

    const entry = await auditQuestion(question, options);
    ledger[question.id] = entry;
    await writeJson(LEDGER_PATH, ledger);
    printProgress({ index: processed, total: selected.length, question, entry, skipped: false });
    await writeReport({ questions, ledger });
    if (processed < selected.length) {
      await sleep(computeQuestionDelayMs(options.sleepMs));
    }
  }

  await writeReport({ questions, ledger });
  const summary = summarizeLedger(pickLedgerEntries(ledger, selected));
  console.log("");
  console.log(`Ledger: ${LEDGER_PATH}`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(
    `Summary: match=${summary.match} mismatch=${summary.mismatch} no-source=${summary["no-source"]} lane-error=${summary["lane-error"]}` +
      (summary.other ? ` other=${summary.other}` : "")
  );
}

async function auditQuestion(question, options) {
  const timestamp = new Date().toISOString();
  const parsedReference = parseReference(question.reference);
  if (!parsedReference.ok) {
    return {
      id: question.id,
      reference: question.reference,
      model: options.model,
      timestamp,
      status: "no-source",
      issues: [parsedReference.error],
      verdict: {
        match: false,
        confidence: 0,
        issues: [parsedReference.error],
        fixType: "reference",
        suggested: {},
        osbTerms: "",
      },
    };
  }

  const { sourcePath, source } = await loadSourceForBook(parsedReference.book);
  if (!source) {
    return {
      id: question.id,
      reference: question.reference,
      model: options.model,
      timestamp,
      status: "no-source",
      issues: [`Missing source file: ${sourcePath}`],
      verdict: {
        match: false,
        confidence: 0,
        issues: [`Missing source file: ${sourcePath}`],
        fixType: "reference",
        suggested: {},
        osbTerms: "",
      },
    };
  }

  const chapterVerses = collectChapterVerses(source, parsedReference.chapter);
  const referenced = collectReferencedVerses(source, parsedReference);
  if (chapterVerses.length === 0 || !referenced.ok) {
    const missing = chapterVerses.length === 0
      ? `No source verses for chapter ${parsedReference.chapter}`
      : `Missing source verse ${referenced.missingKey}`;
    return {
      id: question.id,
      reference: question.reference,
      model: options.model,
      timestamp,
      status: "no-source",
      issues: [missing],
      verdict: {
        match: false,
        confidence: 0,
        issues: [missing],
        fixType: "reference",
        suggested: {},
        osbTerms: "",
      },
    };
  }

  const prompt = buildPrompt({
    record: question,
    parsedReference,
    source,
    referencedVerses: referenced.verses,
    chapterVerses,
  });

  const laneResult = await runLaneVerdictWithRetry({
    prompt,
    model: options.model,
    rpm: options.rpm,
    maxRetries: options.maxRetries,
  });
  if (!laneResult.ok) {
    const entry = {
      id: question.id,
      reference: question.reference,
      model: options.model,
      timestamp,
      status: "lane-error",
      jobDir: laneResult.jobDir || null,
      attempts: laneResult.attempts,
      issues: [laneResult.error],
      verdict: {
        match: false,
        confidence: 0,
        issues: [laneResult.error],
        fixType: "none",
        suggested: {},
        osbTerms: "",
      },
    };
    if (laneResult.rawOutput) {
      entry.rawOutput = laneResult.rawOutput;
    }
    return entry;
  }

  const verdict = applyDeterministicGuards({
    question,
    source,
    parsedReference,
    verdict: normalizeJudgeVerdict(laneResult.rawVerdict),
  });

  return {
    id: question.id,
    reference: question.reference,
    model: options.model,
    timestamp,
    status: verdict.match ? "match" : "mismatch",
    jobDir: laneResult.jobDir,
    issues: verdict.issues,
    verdict,
  };
}

function applyDeterministicGuards({ question, source, parsedReference, verdict }) {
  const key = `${parsedReference.chapter}:${parsedReference.startVerse}`;
  const verseText = source.verses?.[key] || "";
  const fields = [
    question.question,
    question.answer,
    ...(question.acceptableAnswers || []),
    ...(question.options || []),
    question.memoryAid?.text || "",
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();

  if (
    key === "17:7" &&
    /massah|meribah/.test(fields) &&
    /temptation and abuse/i.test(verseText)
  ) {
    const suggested = {
      question: rewriteField(question.question, /Massah and Meribah/gi, "Temptation and Abuse"),
      answer: rewriteField(question.answer, /Massah and Meribah/gi, "Temptation and Abuse"),
      acceptableAnswers: question.acceptableAnswers
        ? ["temptation and abuse", "abuse and temptation"]
        : undefined,
      options: question.options?.map((option) =>
        rewriteField(option, /Testing and contention/gi, "Temptation and Abuse")
      ),
      memoryAidText: rewriteMassahNote(question.memoryAid?.text),
    };
    const cleanedSuggested = Object.fromEntries(
      Object.entries(suggested).filter(([, value]) => value !== undefined)
    );
    return {
      match: false,
      confidence: Math.max(verdict.confidence ?? 0, 0.98),
      issues: uniqueStrings([
        "Question uses Massah/Meribah wording, but OSB Exodus 17:7 says Temptation and Abuse.",
        ...verdict.issues,
      ]),
      fixType: verdict.fixType === "reference" ? "both" : "wording",
      suggested: {
        ...verdict.suggested,
        ...cleanedSuggested,
      },
      osbTerms: "Temptation and Abuse",
    };
  }

  return verdict;
}

function rewriteField(value, pattern, replacement) {
  if (typeof value !== "string") return value;
  return value.replace(pattern, replacement);
}

function rewriteMassahNote(value) {
  if (typeof value !== "string") return value;
  let next = value
    .replace(/Massah the Mistrust/gi, "Temptation")
    .replace(/Meribah the Murmuring/gi, "Abuse")
    .replace(/Massah\s*=\s*Mass-test;?\s*/gi, "")
    .replace(/Meribah\s*=\s*Merry brawl\.?/gi, "")
    .replace(/Massah and Meribah/gi, "Temptation and Abuse")
    .replace(/Testing\s+and\s+Contention/gi, "Temptation and Abuse")
    .replace(/Testing\s+and\s+contention/gi, "Temptation and Abuse");
  if (!/Temptation and Abuse/.test(next)) {
    next = `${next} The OSB wording is "Temptation and Abuse."`.trim();
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function shouldSkipQuestion(entry, options) {
  if (!entry || !options.resume || options.force) return false;
  return !(options.retryErrors && entry.status === "lane-error");
}

function printProgress({ index, total, question, entry, skipped }) {
  if (entry.status === "match" || entry.status === "mismatch") {
    console.log(
      `[${index}/${total}] ${question.id} ${question.reference} match=${entry.verdict.match} fix=${entry.verdict.fixType}` +
        (skipped ? " skipped" : "")
    );
    return;
  }
  console.log(
    `[${index}/${total}] ${question.id} ${question.reference} status=${entry.status}` +
      (skipped ? " skipped" : "")
  );
}

function selectQuestions(questions, options) {
  const idFilter = options.only.length ? new Set(options.only) : null;
  let selected = questions.filter((question) => !idFilter || idFilter.has(question.id));
  if (options.limit !== null) {
    selected = selected.slice(0, options.limit);
  }
  return selected;
}

function pickLedgerEntries(ledger, selectedQuestions) {
  const entries = {};
  for (const question of selectedQuestions) {
    if (ledger[question.id]) {
      entries[question.id] = ledger[question.id];
    }
  }
  return entries;
}

async function runApply(options) {
  const questions = await readJson(QUESTIONS_PATH);
  const ledger = await readJson(LEDGER_PATH, {});
  const idFilter = options.only.length ? new Set(options.only) : null;
  const applied = [];
  const manualReview = [];

  for (const question of questions) {
    if (idFilter && !idFilter.has(question.id)) continue;
    const entry = ledger[question.id];
    if (!entry || entry.status !== "mismatch") continue;
    if (entry.verdict.confidence === null || entry.verdict.confidence < options.minConfidence) {
      manualReview.push(`${question.id} confidence=${formatApplyConfidence(entry.verdict.confidence)}`);
      continue;
    }

    const changes = applySuggestedChanges(question, entry.verdict.suggested);
    if (changes.length) {
      applied.push({ id: question.id, changes });
    }
  }

  if (!applied.length) {
    console.log("No ledger entries met the apply threshold.");
    if (manualReview.length) {
      console.log("Needs manual review:");
      for (const item of manualReview) console.log(`  ${item}`);
    }
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
  if (manualReview.length) {
    console.log("Needs manual review:");
    for (const item of manualReview) console.log(`  ${item}`);
  }
}

function formatApplyConfidence(confidence) {
  return confidence === null ? "unknown" : String(confidence);
}

export { applySuggestedChanges, computeRetryDelayMs, runLaneVerdictWithRetry } from "./lib/osb-audit-core.mjs";
