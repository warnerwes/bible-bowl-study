import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertManifestBudget, readJson, reconcileQuotedUses, writeJsonAtomic } from "./manifest.mjs";
import { compareHookOrder, compareQuestionOrder, domainError } from "./verses.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");

export const QUESTIONS_PATH = path.join(ROOT, "generator", "pilots", "corinthians", "questions.seed.json");
export const MEMORY_HOOKS_PATH = path.join(ROOT, "generator", "pilots", "corinthians", "memory-hooks.json");
export const MANIFEST_PATH = path.join(ROOT, "generator", "pilots", "corinthians", "source-manifest.json");
export const QUESTION_FILE = "generator/pilots/corinthians/questions.seed.json";
export const MEMORY_HOOK_FILE = "generator/pilots/corinthians/memory-hooks.json";

function stableJson(value) {
  return JSON.stringify(value);
}

function flattenMemoryHooks(memoryHooks) {
  const hooks = [];
  for (const [book, chapters] of Object.entries(memoryHooks.books ?? {})) {
    for (const [chapter, entries] of Object.entries(chapters ?? {})) {
      for (const entry of entries ?? []) {
        hooks.push({
          id: entry.id,
          book,
          chapter: Number(chapter),
          reference: entry.reference,
          text: entry.text,
          ...(entry.url ? { url: entry.url } : {}),
          ...(entry.kindTag ? { kindTag: entry.kindTag } : {}),
        });
      }
    }
  }
  return hooks;
}

function buildMemoryHooks(hooks) {
  const books = {};
  for (const hook of [...hooks].sort(compareHookOrder)) {
    books[hook.book] ??= {};
    books[hook.book][String(hook.chapter)] ??= [];
    books[hook.book][String(hook.chapter)].push({
      id: hook.id,
      reference: hook.reference,
      text: hook.text,
      ...(hook.url ? { url: hook.url } : {}),
      ...(hook.kindTag ? { kindTag: hook.kindTag } : {}),
    });
  }
  return { schemaVersion: 1, books };
}

function quotedCharsForQuestion(question) {
  const parts = [question.question, question.answer, ...(question.options ?? []), ...(question.acceptableAnswers ?? [])];
  return parts.reduce((sum, part) => sum + String(part ?? "").length, 0);
}

function quotedCharsForHook(hook) {
  return String(hook.text ?? "").length;
}

function buildQuotedUse(doc) {
  if (doc.quoteDecision?.mode !== "quotes-verses") {
    return null;
  }

  const isQuestion = Boolean(doc.finalQuestion);
  return {
    id: doc.payloadId,
    file: isQuestion ? QUESTION_FILE : MEMORY_HOOK_FILE,
    fieldPath: isQuestion ? "payload" : "text",
    reference: doc.quoteDecision.references.join(", "),
    verseKeys: doc.quoteDecision.verseKeys,
    quotedChars: isQuestion ? quotedCharsForQuestion(doc.finalQuestion) : quotedCharsForHook(doc.finalMemoryHook),
    inclusionReason: "review-approved-scripture-quote",
    reviewer: doc.reviewedBy,
    reviewedAt: doc.approvedAt ?? doc.reviewedAt,
  };
}

function mergeQuestion(existingMap, question) {
  const previous = existingMap.get(question.id);
  if (previous && stableJson(previous) !== stableJson(question)) {
    throw domainError("QUESTION_ID_CONFLICT", `Question id "${question.id}" has conflicting content.`, {
      id: question.id,
    });
  }
  existingMap.set(question.id, question);
}

function mergeHook(existingMap, hook) {
  const previous = existingMap.get(hook.id);
  if (previous && stableJson(previous) !== stableJson(hook)) {
    throw domainError("MEMORY_HOOK_ID_CONFLICT", `Memory hook id "${hook.id}" has conflicting content.`, {
      id: hook.id,
    });
  }
  existingMap.set(hook.id, hook);
}

export function projectArtifacts({
  currentQuestions,
  currentMemoryHooks,
  currentManifest,
  reviewDocs,
}) {
  const sortedDocs = [...reviewDocs].sort((left, right) =>
    String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) ||
    left.id.localeCompare(right.id)
  );

  const questionMap = new Map();
  for (const question of currentQuestions) {
    mergeQuestion(questionMap, question);
  }
  const hookMap = new Map();
  for (const hook of flattenMemoryHooks(currentMemoryHooks)) {
    mergeHook(hookMap, hook);
  }

  const quotedUses = [];
  const exportableIds = [];
  for (const doc of sortedDocs) {
    if (doc.finalQuestion) {
      mergeQuestion(questionMap, doc.finalQuestion);
      if (doc.replacesPlaceholderId) {
        questionMap.delete(doc.replacesPlaceholderId);
      }
    }
    if (doc.finalMemoryHook) {
      mergeHook(hookMap, doc.finalMemoryHook);
    }
    const quotedUse = buildQuotedUse(doc);
    if (quotedUse) quotedUses.push(quotedUse);
    if (doc.status === "approved") exportableIds.push(doc.id);
  }

  const questions = [...questionMap.values()].sort(compareQuestionOrder);
  const memoryHooks = buildMemoryHooks([...hookMap.values()]);
  const manifest = reconcileQuotedUses(currentManifest, quotedUses);
  const budget = assertManifestBudget(manifest);

  return {
    questions,
    memoryHooks,
    manifest,
    exportableIds,
    budget,
  };
}

export async function runExport({ store, reviewerId, batchId }) {
  await store.acquireExportLease({ reviewerId, batchId });
  try {
    const [currentQuestions, currentMemoryHooks, currentManifest, reviewDocs] = await Promise.all([
      readJson(QUESTIONS_PATH),
      readJson(MEMORY_HOOKS_PATH),
      readJson(MANIFEST_PATH),
      store.loadExportSuggestions(),
    ]);

    const projected = projectArtifacts({
      currentQuestions,
      currentMemoryHooks,
      currentManifest,
      reviewDocs,
    });

    await writeJsonAtomic(QUESTIONS_PATH, projected.questions);
    await writeJsonAtomic(MEMORY_HOOKS_PATH, projected.memoryHooks);
    await writeJsonAtomic(MANIFEST_PATH, projected.manifest);
    await store.markExported({
      ids: projected.exportableIds,
      reviewerId,
      batchId,
    });

    return {
      batchId,
      questionCount: projected.questions.length,
      memoryHookCount: flattenMemoryHooks(projected.memoryHooks).length,
      exportedIds: projected.exportableIds,
      budget: projected.budget,
      manifestSynced: true,
    };
  } finally {
    await store.releaseExportLease(batchId);
  }
}
