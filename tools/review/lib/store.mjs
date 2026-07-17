import crypto from "node:crypto";

import { domainError } from "./verses.mjs";

const LEASE_TTL_MS = 5 * 60 * 1000;

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serialize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => serialize(item));
  }
  if (value && typeof value === "object") {
    const plain = {};
    for (const [key, entry] of Object.entries(value)) {
      plain[key] = serialize(entry);
    }
    return plain;
  }
  return toIso(value);
}

function normalizeSuggestion(id, data) {
  return { id, ...serialize(data) };
}

async function listReviewEvents(snapshot) {
  const events = await snapshot.ref.collection("reviewEvents").orderBy("at", "asc").get();
  return events.docs.map((doc) => normalizeSuggestion(doc.id, doc.data()));
}

export function createFirestoreStore({ firestore, FieldValue, Timestamp }) {
  const suggestions = firestore.collection("suggestions");
  const licensingRef = firestore.doc("reviewControl/licensing");
  const leaseRef = firestore.doc("reviewControl/exportLease");

  async function getSuggestionSnapshot(id) {
    const snapshot = await suggestions.doc(id).get();
    if (!snapshot.exists) {
      throw domainError("NOT_FOUND", `Suggestion "${id}" was not found.`, { id });
    }
    return snapshot;
  }

  return {
    async listSuggestions({ statuses = [], kinds = [] } = {}) {
      const snapshot = await suggestions.orderBy("createdAt", "desc").orderBy("__name__", "asc").get();
      return snapshot.docs
        .map((doc) => normalizeSuggestion(doc.id, doc.data()))
        .filter((doc) => (statuses.length ? statuses.includes(doc.status) : true))
        .filter((doc) => (kinds.length ? kinds.includes(doc.kind) : true));
    },

    async showSuggestion(id) {
      const snapshot = await getSuggestionSnapshot(id);
      const suggestion = normalizeSuggestion(snapshot.id, snapshot.data());
      const reviewEvents = await listReviewEvents(snapshot);
      return { suggestion, reviewEvents };
    },

    async approveSuggestion({
      id,
      reviewerId,
      note,
      payloadField,
      finalPayload,
      payloadId,
      quoteDecision,
      replacesPlaceholderId,
    }) {
      const ref = suggestions.doc(id);
      let committedSuggestion = null;
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
          throw domainError("NOT_FOUND", `Suggestion "${id}" was not found.`, { id });
        }

        const data = snapshot.data();
        if (data.status !== "new") {
          throw domainError("INVALID_STATE", "Suggestion is already reviewed.", {
            id,
            status: data.status,
          });
        }
        if (data.kind === "correction" || data.kind === "link") {
          throw domainError("KIND_NOT_APPROVABLE", `${data.kind} suggestions cannot be approved.`, { id });
        }

        const approvedAt = FieldValue.serverTimestamp();
        const payloadHash = `sha256:${crypto.createHash("sha256").update(JSON.stringify(finalPayload)).digest("hex")}`;
        if (quoteDecision.mode === "quotes-verses") {
          const licensingSnapshot = await transaction.get(licensingRef);
          const licensing = licensingSnapshot.exists ? licensingSnapshot.data() : {};
          const current = Number(licensing.totalOccurrences ?? 0);
          const limit = Number(licensing.limit ?? 500);
          const next = current + quoteDecision.occurrenceCount;
          if (next > limit) {
            throw domainError("QUOTE_LIMIT_EXCEEDED", `Quoted verse budget exceeded (${next}/${limit}).`, {
              current,
              attempted: quoteDecision.occurrenceCount,
              limit,
            });
          }
          transaction.set(
            licensingRef,
            {
              totalOccurrences: next,
              limit,
              updatedAt: approvedAt,
              updatedBy: reviewerId,
            },
            { merge: true }
          );
        }

        transaction.set(
          ref,
          {
            status: "approved",
            reviewedAt: approvedAt,
            reviewedBy: reviewerId,
            reviewNote: note,
            approvedAt,
            approvedBy: reviewerId,
            payloadId,
            payloadHash,
            quoteDecision,
            replacesPlaceholderId: replacesPlaceholderId ?? null,
            [payloadField]: finalPayload,
          },
          { merge: true }
        );
        transaction.set(ref.collection("reviewEvents").doc(), {
          action: "approved",
          fromStatus: data.status,
          toStatus: "approved",
          actor: reviewerId,
          note,
          payloadHash,
          at: approvedAt,
        });

        committedSuggestion = {
          ...data,
          status: "approved",
          reviewedBy: reviewerId,
          reviewNote: note,
          payloadId,
          quoteDecision,
          replacesPlaceholderId: replacesPlaceholderId ?? null,
          [payloadField]: finalPayload,
        };
      });

      return normalizeSuggestion(id, committedSuggestion);
    },

    async rejectSuggestion({ id, reviewerId, reason }) {
      const ref = suggestions.doc(id);
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
          throw domainError("NOT_FOUND", `Suggestion "${id}" was not found.`, { id });
        }
        const data = snapshot.data();
        if (data.status !== "new") {
          throw domainError("INVALID_STATE", "Only new suggestions can be rejected.", {
            id,
            status: data.status,
          });
        }

        const rejectedAt = FieldValue.serverTimestamp();
        transaction.set(
          ref,
          {
            status: "rejected",
            reviewedAt: rejectedAt,
            reviewedBy: reviewerId,
            reviewNote: reason,
            rejectedAt,
            rejectedBy: reviewerId,
          },
          { merge: true }
        );
        transaction.set(ref.collection("reviewEvents").doc(), {
          action: "rejected",
          fromStatus: data.status,
          toStatus: "rejected",
          actor: reviewerId,
          note: reason,
          at: rejectedAt,
        });
      });

      return this.showSuggestion(id);
    },

    async annotateSuggestion({ id, reviewerId, note }) {
      const ref = suggestions.doc(id);
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
          throw domainError("NOT_FOUND", `Suggestion "${id}" was not found.`, { id });
        }
        const data = snapshot.data();
        const reviewedAt = FieldValue.serverTimestamp();
        transaction.set(
          ref,
          {
            reviewedAt,
            reviewedBy: reviewerId,
            reviewNote: note,
          },
          { merge: true }
        );
        transaction.set(ref.collection("reviewEvents").doc(), {
          action: "annotated",
          fromStatus: data.status,
          toStatus: data.status,
          actor: reviewerId,
          note,
          at: reviewedAt,
        });
      });

      return this.showSuggestion(id);
    },

    async loadExportSuggestions() {
      const [approved, exported] = await Promise.all([
        suggestions.where("status", "==", "approved").get(),
        suggestions.where("status", "==", "exported").get(),
      ]);
      return [...approved.docs, ...exported.docs]
        .map((doc) => normalizeSuggestion(doc.id, doc.data()))
        .sort((left, right) =>
          String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")) * -1 ||
          left.id.localeCompare(right.id)
        );
    },

    async acquireExportLease({ reviewerId, batchId }) {
      const now = new Date();
      const expiresAt = Timestamp.fromDate(new Date(now.getTime() + LEASE_TTL_MS));
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(leaseRef);
        if (snapshot.exists) {
          const data = snapshot.data();
          const leaseExpiry = data.expiresAt?.toDate?.() ?? null;
          if (leaseExpiry && leaseExpiry > now && data.batchId !== batchId) {
            throw domainError("EXPORT_BUSY", "Another export batch currently holds the lease.", {
              activeBatchId: data.batchId,
              expiresAt: toIso(data.expiresAt),
            });
          }
        }
        transaction.set(leaseRef, {
          batchId,
          reviewerId,
          leasedAt: FieldValue.serverTimestamp(),
          expiresAt,
        });
      });
    },

    async markExported({ ids, reviewerId, batchId }) {
      if (!ids.length) return [];
      await firestore.runTransaction(async (transaction) => {
        const snapshots = await Promise.all(ids.map((id) => transaction.get(suggestions.doc(id))));
        for (const snapshot of snapshots) {
          if (!snapshot.exists) continue;
          const data = snapshot.data();
          if (data.status === "exported") continue;
          if (data.status !== "approved") {
            throw domainError("INVALID_STATE", "Only approved suggestions can be exported.", {
              id: snapshot.id,
              status: data.status,
            });
          }
          const exportedAt = FieldValue.serverTimestamp();
          transaction.set(
            snapshot.ref,
            {
              status: "exported",
              reviewedAt: exportedAt,
              reviewedBy: reviewerId,
              exportedAt,
              exportedBy: reviewerId,
              exportBatchId: batchId,
            },
            { merge: true }
          );
          transaction.set(snapshot.ref.collection("reviewEvents").doc(), {
            action: "exported",
            fromStatus: "approved",
            toStatus: "exported",
            actor: reviewerId,
            note: `Exported in batch ${batchId}`,
            at: exportedAt,
          });
        }
      });
      return ids;
    },

    async releaseExportLease(batchId) {
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(leaseRef);
        if (!snapshot.exists) return;
        const data = snapshot.data();
        if (data.batchId === batchId) {
          transaction.delete(leaseRef);
        }
      });
    },
  };
}
