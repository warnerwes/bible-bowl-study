#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

import { readJson, writeJsonAtomic } from "./lib/manifest.mjs";
import { runExport, QUESTIONS_PATH, assertQuestionIdReuseAllowed } from "./lib/export.mjs";
import { createFirestoreStore } from "./lib/store.mjs";
import {
  BOOKS,
  derivePayloadId,
  domainError,
  normalizeQuoteDecision,
  questionTextKey,
  validateBookChapter,
} from "./lib/verses.mjs";
import { validate } from "../../generator/toolchain/scripts/lib/schema-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const QUESTION_SCHEMA_PATH = path.join(ROOT, "generator", "schemas", "question-candidate.schema.json");

const QUESTION_SCHEMA = await readJson(QUESTION_SCHEMA_PATH);

function createErrorEnvelope(error) {
  return {
    ok: false,
    error: {
      code: error.code ?? "UNEXPECTED_ERROR",
      message: error.message ?? "Unexpected error.",
      details: error.details ?? {},
    },
  };
}

function printAndExit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(exitCode);
}

function parseCommand() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    throw domainError("ARGUMENT_ERROR", "Missing command.", {});
  }
  return { command, rest };
}

function requireReviewer() {
  const reviewerId = process.env.BBS_REVIEWER_ID;
  if (!reviewerId) {
    throw domainError("MISSING_AUTH", "BBS_REVIEWER_ID is required for mutating commands.", {});
  }
  return reviewerId;
}

function requireJsonFlag(values) {
  if (!values.json) {
    throw domainError("ARGUMENT_ERROR", "This command requires --json.", {});
  }
}

function parseJsonPayload(source, fieldName) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw domainError("INVALID_JSON", `Malformed JSON for ${fieldName}.`, {
      fieldName,
      cause: error.message,
    });
  }
}

function estimateQuestionDuplicate(book, chapter, questionText, existingQuestions, ignoredId) {
  const key = questionTextKey(questionText);
  return existingQuestions.find(
    (entry) =>
      entry.book === book &&
      entry.chapter === chapter &&
      entry.id !== ignoredId &&
      questionTextKey(entry.question) === key
  );
}

function ensurePlaceholderReplacement(existingQuestions, question, replacesPlaceholderId) {
  if (!replacesPlaceholderId) return;
  const target = existingQuestions.find((entry) => entry.id === replacesPlaceholderId);
  if (!target) {
    throw domainError("PLACEHOLDER_NOT_FOUND", `Placeholder "${replacesPlaceholderId}" was not found.`, {
      replacesPlaceholderId,
    });
  }
  if (!target.placeholder) {
    throw domainError("PLACEHOLDER_REQUIRED", `Replacement target "${replacesPlaceholderId}" is not a placeholder.`, {
      replacesPlaceholderId,
    });
  }
  if (target.book !== question.book || target.chapter !== question.chapter) {
    throw domainError("PLACEHOLDER_MISMATCH", "Placeholder replacement must stay within the same book and chapter.", {
      replacesPlaceholderId,
      targetBook: target.book,
      targetChapter: target.chapter,
      book: question.book,
      chapter: question.chapter,
    });
  }
}

function validateQuestionPayload({ payload, suggestion, suggestionPath, existingQuestions }) {
  assertQuestionIdReuseAllowed(existingQuestions, payload);
  validateBookChapter(payload.book, payload.chapter);
  if (payload.book !== suggestion.book || payload.chapter !== suggestion.chapter) {
    throw domainError("QUESTION_SCOPE_MISMATCH", "Question payload does not match the suggestion book/chapter.", {
      suggestionId: suggestion.id,
      book: payload.book,
      chapter: payload.chapter,
    });
  }

  const finalQuestion = {
    ...payload,
    id: derivePayloadId({
      kind: suggestion.kind,
      book: payload.book,
      chapter: payload.chapter,
      suggestionPath,
    }),
    queueItemIds: [],
    reviewStatus: "approved",
  };

  if (finalQuestion.placeholder) {
    throw domainError("PLACEHOLDER_NOT_ALLOWED", "Approved questions cannot remain placeholders.", {});
  }

  const schemaResult = validate(QUESTION_SCHEMA, finalQuestion);
  if (!schemaResult.valid) {
    throw domainError("INVALID_QUESTION", "Question payload failed schema validation.", {
      errors: schemaResult.errors,
    });
  }

  if (finalQuestion.type === "multiple-choice") {
    const normalized = new Set((finalQuestion.options ?? []).map((entry) => String(entry).trim().toLowerCase()));
    if (normalized.size < 2) {
      throw domainError("INVALID_QUESTION", "Multiple-choice questions need at least two unique options.", {});
    }
    const answerMatches = (finalQuestion.options ?? []).filter(
      (entry) => String(entry).trim().toLowerCase() === String(finalQuestion.answer).trim().toLowerCase()
    );
    if (answerMatches.length !== 1) {
      throw domainError("INVALID_QUESTION", "Multiple-choice options must contain the answer exactly once.", {});
    }
  }

  if (finalQuestion.type === "true-false") {
    if (!["True", "False"].includes(finalQuestion.answer)) {
      throw domainError("INVALID_QUESTION", 'True/false answers must be "True" or "False".', {});
    }
  }

  if (finalQuestion.type === "fill-in") {
    if (!Array.isArray(finalQuestion.acceptableAnswers) || !finalQuestion.acceptableAnswers.some((entry) => String(entry).trim())) {
      throw domainError("INVALID_QUESTION", "Fill-in questions require at least one acceptable answer.", {});
    }
  }

  const duplicate = estimateQuestionDuplicate(
    finalQuestion.book,
    finalQuestion.chapter,
    finalQuestion.question,
    existingQuestions,
    finalQuestion.id
  );
  if (duplicate) {
    throw domainError("DUPLICATE_QUESTION_TEXT", "A question with the same text already exists in this chapter.", {
      duplicateId: duplicate.id,
      chapter: finalQuestion.chapter,
    });
  }

  const idConflict = existingQuestions.find((entry) => entry.id === finalQuestion.id);
  if (idConflict && JSON.stringify(idConflict) !== JSON.stringify(finalQuestion)) {
    throw domainError("QUESTION_ID_CONFLICT", `Question id "${finalQuestion.id}" already exists with different content.`, {
      id: finalQuestion.id,
    });
  }

  return finalQuestion;
}

function validateMemoryHookPayload({ payload, suggestion, suggestionPath }) {
  validateBookChapter(payload.book, payload.chapter);
  if (payload.book !== suggestion.book || payload.chapter !== suggestion.chapter) {
    throw domainError("MEMORY_HOOK_SCOPE_MISMATCH", "Memory hook payload does not match the suggestion book/chapter.", {
      suggestionId: suggestion.id,
      book: payload.book,
      chapter: payload.chapter,
    });
  }
  if (!payload.reference || !payload.text) {
    throw domainError("INVALID_MEMORY_HOOK", "Memory hook payload requires reference and text.", {});
  }

  return {
    id: derivePayloadId({
      kind: suggestion.kind,
      book: payload.book,
      chapter: payload.chapter,
      suggestionPath,
    }),
    book: payload.book,
    chapter: payload.chapter,
    reference: payload.reference,
    text: payload.text,
    ...(payload.url ? { url: payload.url } : {}),
    ...(suggestion.kind !== "memory_hook" ? { kindTag: suggestion.kind } : {}),
  };
}

function payloadTemplateForSuggestion(suggestion, derivedPayloadId) {
  const bookSlug = BOOKS[suggestion.book].slug;
  if (suggestion.kind === "memory_hook" || suggestion.kind === "surprising_fact") {
    return {
      id: derivedPayloadId,
      book: suggestion.book,
      bookSlug,
      chapter: suggestion.chapter,
      reference: suggestion.reference,
      text: "",
      url: "",
    };
  }
  if (suggestion.kind === "question_seed") {
    return {
      id: derivedPayloadId,
      queueItemIds: [],
      book: suggestion.book,
      bookSlug,
      chapter: suggestion.chapter,
      reference: suggestion.reference,
      topic: "",
      type: "multiple-choice",
      question: "",
      answer: "",
      options: [],
      acceptableAnswers: [],
      difficulty: "medium",
      roundFormat: "standard",
      reviewStatus: "approved",
    };
  }
  return null;
}

function initStore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "bible-bowl-study",
    });
  }
  const firestore = getFirestore();
  return createFirestoreStore({ firestore, FieldValue, Timestamp });
}

async function handleList(store, args) {
  const { values } = parseArgs({
    args,
    options: {
      status: { type: "string", multiple: true },
      kind: { type: "string", multiple: true },
      json: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });
  requireJsonFlag(values);
  const items = await store.listSuggestions({
    statuses: values.status ?? [],
    kinds: values.kind ?? [],
  });
  return { ok: true, items };
}

async function handleShow(store, args) {
  const parsed = parseArgs({
    args,
    options: { json: { type: "boolean" } },
    allowPositionals: true,
    strict: true,
  });
  requireJsonFlag(parsed.values);
  const [id] = parsed.positionals;
  if (!id) throw domainError("ARGUMENT_ERROR", "Missing suggestion id.", {});
  const { suggestion, reviewEvents } = await store.showSuggestion(id);
  const derivedPayloadId = derivePayloadId({
    kind: suggestion.kind,
    book: suggestion.book,
    chapter: suggestion.chapter,
    suggestionPath: `suggestions/${suggestion.id}`,
  });
  return {
    ok: true,
    suggestion,
    reviewEvents,
    derivedPayloadId,
    payloadTemplate: payloadTemplateForSuggestion(suggestion, derivedPayloadId),
  };
}

async function handleApprove(store, args) {
  const reviewerId = requireReviewer();
  const parsed = parseArgs({
    args,
    options: {
      note: { type: "string" },
      question: { type: "string" },
      "memory-hook": { type: "string" },
      "no-scripture-quote": { type: "boolean" },
      "quotes-verses": { type: "string", multiple: true },
      "replaces-placeholder": { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  const [id] = parsed.positionals;
  if (!id) throw domainError("ARGUMENT_ERROR", "Missing suggestion id.", {});
  const hasQuestion = Boolean(parsed.values.question);
  const hasMemoryHook = Boolean(parsed.values["memory-hook"]);
  if (hasQuestion === hasMemoryHook) {
    throw domainError("ARGUMENT_ERROR", "Provide exactly one of --question or --memory-hook.", {});
  }

  const { suggestion } = await store.showSuggestion(id);
  const existingQuestions = await readJson(QUESTIONS_PATH);
  const suggestionPath = `suggestions/${id}`;
  const note = parsed.values.note ?? "Approved for export";
  const quoteDecision = normalizeQuoteDecision({
    book: suggestion.book,
    chapter: suggestion.chapter,
    noScriptureQuote: Boolean(parsed.values["no-scripture-quote"]),
    quotedVerses: parsed.values["quotes-verses"] ?? [],
  });

  if (suggestion.kind === "correction" || suggestion.kind === "link") {
    throw domainError("KIND_NOT_APPROVABLE", `${suggestion.kind} suggestions cannot be approved.`, { id });
  }

  let payloadField;
  let finalPayload;
  if (hasQuestion) {
    if (suggestion.kind !== "question_seed") {
      throw domainError("KIND_MISMATCH", "Question payloads are only valid for question_seed suggestions.", {
        id,
        kind: suggestion.kind,
      });
    }
    finalPayload = validateQuestionPayload({
      payload: parseJsonPayload(parsed.values.question, "--question"),
      suggestion,
      suggestionPath,
      existingQuestions,
    });
    ensurePlaceholderReplacement(existingQuestions, finalPayload, parsed.values["replaces-placeholder"]);
    payloadField = "finalQuestion";
  } else {
    if (suggestion.kind !== "memory_hook" && suggestion.kind !== "surprising_fact") {
      throw domainError("KIND_MISMATCH", "Memory hook payloads are only valid for memory_hook or surprising_fact suggestions.", {
        id,
        kind: suggestion.kind,
      });
    }
    finalPayload = validateMemoryHookPayload({
      payload: parseJsonPayload(parsed.values["memory-hook"], "--memory-hook"),
      suggestion,
      suggestionPath,
    });
    payloadField = "finalMemoryHook";
  }

  const approved = await store.approveSuggestion({
    id,
    reviewerId,
    note,
    payloadField,
    finalPayload,
    payloadId: finalPayload.id,
    quoteDecision,
    replacesPlaceholderId: parsed.values["replaces-placeholder"] ?? null,
  });

  return {
    ok: true,
    suggestion: approved,
    manifestSynced: false,
    remoteCommitted: true,
  };
}

async function handleReject(store, args) {
  const reviewerId = requireReviewer();
  const parsed = parseArgs({
    args,
    options: {
      reason: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  const [id] = parsed.positionals;
  if (!id || !parsed.values.reason) {
    throw domainError("ARGUMENT_ERROR", "reject requires <id> and --reason.", {});
  }
  const result = await store.rejectSuggestion({
    id,
    reviewerId,
    reason: parsed.values.reason,
  });
  return { ok: true, ...result };
}

async function handleAnnotate(store, args) {
  const reviewerId = requireReviewer();
  const parsed = parseArgs({
    args,
    options: {
      note: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  const [id] = parsed.positionals;
  if (!id || !parsed.values.note) {
    throw domainError("ARGUMENT_ERROR", "annotate requires <id> and --note.", {});
  }
  const result = await store.annotateSuggestion({
    id,
    reviewerId,
    note: parsed.values.note,
  });
  return { ok: true, ...result };
}

async function handleExport(store) {
  const reviewerId = requireReviewer();
  const batchId = crypto.randomUUID();
  const result = await runExport({ store, reviewerId, batchId });
  return { ok: true, ...result };
}

async function main() {
  const { command, rest } = parseCommand();
  const store = initStore();

  switch (command) {
    case "list":
      return handleList(store, rest);
    case "show":
      return handleShow(store, rest);
    case "approve":
      return handleApprove(store, rest);
    case "reject":
      return handleReject(store, rest);
    case "annotate":
      return handleAnnotate(store, rest);
    case "export":
      return handleExport(store, rest);
    default:
      throw domainError("ARGUMENT_ERROR", `Unknown command "${command}".`, { command });
  }
}

try {
  printAndExit(await main(), 0);
} catch (error) {
  const envelope = createErrorEnvelope(error);
  const exitCode = ["ARGUMENT_ERROR", "INVALID_JSON"].includes(envelope.error.code) ? 2 : 1;
  printAndExit(envelope, exitCode);
}
