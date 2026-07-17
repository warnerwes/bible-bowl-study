import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { countQuotedOccurrences, domainError } from "./verses.mjs";

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJsonAtomic(filePath, value) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  const json = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(tempPath, json, "utf8");
  await rename(tempPath, filePath);
}

export function reconcileQuotedUses(manifest, quotedUses) {
  const next = structuredClone(manifest);
  if (!Array.isArray(next.translations) || next.translations.length === 0) {
    throw domainError("INVALID_MANIFEST", "Source manifest is missing translations.", {});
  }

  const translation = next.translations[0];
  const preserved = new Map((translation.quotedUses ?? []).map((entry) => [entry.id, entry]));
  for (const entry of quotedUses) {
    preserved.set(entry.id, entry);
  }

  translation.quotedUses = [...preserved.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  return next;
}

export function assertManifestBudget(manifest) {
  const translation = manifest.translations?.[0];
  if (!translation) {
    throw domainError("INVALID_MANIFEST", "Source manifest is missing the primary translation.", {});
  }
  const limit = translation.quotedVerseLimit ?? 0;
  const totalOccurrences = countQuotedOccurrences(translation.quotedUses ?? []);
  if (totalOccurrences > limit) {
    throw domainError("QUOTE_LIMIT_EXCEEDED", `Quoted verse budget exceeded (${totalOccurrences}/${limit}).`, {
      totalOccurrences,
      limit,
    });
  }
  return { totalOccurrences, limit };
}
