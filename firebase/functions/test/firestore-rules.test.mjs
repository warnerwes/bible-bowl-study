import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { where } from "firebase/firestore";

const PROJECT_ID = "bible-bowl-study-rules";
const RULES_PATH = new URL("../../firestore.rules", import.meta.url);
const FIRESTORE_PORT = getFirestorePort();

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: FIRESTORE_PORT,
      rules: await readFile(RULES_PATH, "utf8")
    }
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.afterEach(async () => {
  await testEnv.clearFirestore();
});

test("denies unauthenticated suggestion creation", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  const suggestion = doc(db, "suggestions/unauth-create");

  await assertFails(setDoc(suggestion, buildSuggestion({ uid: "anon-user" })));
});

test("allows anonymous auth users to create a valid suggestion", async () => {
  const db = studentDb("anon-user");
  const suggestion = doc(db, "suggestions/valid-anon");

  await assertSucceeds(setDoc(suggestion, buildSuggestion({ uid: "anon-user" })));
});

test("denies create when the suggestion uid does not match the auth uid", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/wrong-uid");

  await assertFails(setDoc(suggestion, buildSuggestion({ uid: "student-2" })));
});

test("denies create when reference is missing", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/no-reference");
  const payload = buildSuggestion({ uid: "student-1" });
  delete payload.reference;

  await assertFails(setDoc(suggestion, payload));
});

test("denies create when kind is not allowed", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/bad-kind");

  await assertFails(
    setDoc(suggestion, buildSuggestion({ uid: "student-1", kind: "reference" }))
  );
});

test("allows create for a surprising fact suggestion", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/surprising-fact");

  await assertSucceeds(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "surprising_fact",
      text: "Synthetic surprising fact",
    }))
  );
});

test("allows create for a valid link suggestion", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/link-ok");

  await assertSucceeds(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "link",
      text: "https://example.com/synthetic",
      url: "https://example.com/synthetic",
    }))
  );
});

test("allows create for a memory_hook with an optional https url", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/memory-hook-url-ok");

  await assertSucceeds(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "memory_hook",
      text: "Synthetic memory hook",
      url: "https://example.com/memory-hook",
    }))
  );
});

test("denies create for a memory_hook with a javascript url", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/memory-hook-url-bad");

  await assertFails(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "memory_hook",
      text: "Synthetic memory hook",
      url: "javascript:alert(1)",
    }))
  );
});

test("denies create for a link suggestion with a javascript URI", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/link-bad-uri");

  await assertFails(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "link",
      text: "javascript:alert(1)",
      url: "javascript:alert(1)",
    }))
  );
});

test("denies create when question_seed includes a url field", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/question-with-url");

  await assertFails(
    setDoc(suggestion, buildSuggestion({
      uid: "student-1",
      kind: "question_seed",
      url: "https://example.com/not-allowed",
    }))
  );
});

test("denies create when chapter exceeds the allowed range", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/bad-chapter");

  await assertFails(setDoc(suggestion, buildSuggestion({ uid: "student-1", chapter: 17 })));
});

test("denies create when an extra key is present", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/extra-key");

  await assertFails(
    setDoc(suggestion, {
      ...buildSuggestion({ uid: "student-1" }),
      extra: "not-allowed"
    })
  );
});

test("denies create when status is not new", async () => {
  const db = studentDb("student-1");
  const suggestion = doc(db, "suggestions/bad-status");

  await assertFails(
    setDoc(suggestion, buildSuggestion({ uid: "student-1", status: "approved" }))
  );
});

test("students can read their own suggestions but not other students' docs", async () => {
  await seedSuggestion("own-doc", { uid: "student-1", authorName: "Alpha" });
  await seedSuggestion("other-doc", { uid: "student-2", authorName: "Beta" });

  const ownDoc = doc(studentDb("student-1"), "suggestions/own-doc");
  const otherDoc = doc(studentDb("student-1"), "suggestions/other-doc");

  await assertSucceeds(getDoc(ownDoc));
  await assertFails(getDoc(otherDoc));
});

test("students cannot update or delete suggestions", async () => {
  await seedSuggestion("student-write-lock", { uid: "student-1" });
  const studentDbRef = studentDb("student-1");
  const suggestion = doc(studentDbRef, "suggestions/student-write-lock");

  await assertFails(updateDoc(suggestion, { status: "approved" }));
  await assertFails(deleteDoc(suggestion));
});

test("forged reviewer-style auth cannot update suggestion status", async () => {
  await seedSuggestion("forged-reviewer", { uid: "student-1", status: "new" });
  const forgedDoc = doc(forgedReviewerDb(), "suggestions/forged-reviewer");

  await assertFails(updateDoc(forgedDoc, { status: "approved" }));
});

test("students can list only their own suggestions with uid, book, and chapter filters", async () => {
  await seedSuggestion("list-own-a", {
    uid: "student-1",
    book: "1 Corinthians",
    chapter: 3,
    createdAt: fixedTimestamp("2026-01-01T00:00:00Z"),
  });
  await seedSuggestion("list-own-b", {
    uid: "student-1",
    book: "1 Corinthians",
    chapter: 3,
    createdAt: fixedTimestamp("2026-01-02T00:00:00Z"),
  });
  await seedSuggestion("list-other", {
    uid: "student-2",
    book: "1 Corinthians",
    chapter: 3,
    createdAt: fixedTimestamp("2026-01-03T00:00:00Z"),
  });

  const suggestions = query(
    collection(studentDb("student-1"), "suggestions"),
    where("uid", "==", "student-1"),
    where("book", "==", "1 Corinthians"),
    where("chapter", "==", 3)
  );
  await assertSucceeds(getDocs(suggestions));
});

test("students cannot list suggestions without a uid filter", async () => {
  await seedSuggestion("missing-uid-filter", { uid: "student-1" });
  const suggestions = query(
    collection(studentDb("student-1"), "suggestions"),
    where("book", "==", "1 Corinthians"),
    where("chapter", "==", 3)
  );
  await assertFails(getDocs(suggestions));
});

test("students cannot list another uid even with matching book and chapter filters", async () => {
  await seedSuggestion("wrong-uid-filter", { uid: "student-2" });
  const suggestions = query(
    collection(studentDb("student-1"), "suggestions"),
    where("uid", "==", "student-2"),
    where("book", "==", "1 Corinthians"),
    where("chapter", "==", 3)
  );
  await assertFails(getDocs(suggestions));
});

test("clients cannot read reviewEvents subcollections", async () => {
  await seedSuggestion("event-parent", { uid: "student-1" });
  await seedReviewEvent("event-parent", "event-1");
  const eventDoc = doc(studentDb("student-1"), "suggestions/event-parent/reviewEvents/event-1");

  await assertFails(getDoc(eventDoc));
});

test("unauthenticated clients can read a monthly usage doc", async () => {
  await seedUsage("2026-07", { count: 17 });
  const usageDoc = doc(testEnv.unauthenticatedContext().firestore(), "usage/2026-07");

  await assertSucceeds(getDoc(usageDoc));
});

test("clients cannot list or write monthly usage docs", async () => {
  await seedUsage("2026-07", { count: 17 });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(unauthDb, "usage")));
  await assertFails(setDoc(doc(unauthDb, "usage/2026-07"), { count: 18 }));

  const authDb = studentDb("student-1");
  await assertFails(updateDoc(doc(authDb, "usage/2026-07"), { count: 18 }));
});

test("clients cannot read or write per-user usage docs", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "usage_users/student-1_2026-07"), {
      count: 2,
      weeks: ["1CO:1-2"],
    });
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const authDb = studentDb("student-1");
  await assertFails(getDoc(doc(unauthDb, "usage_users/student-1_2026-07")));
  await assertFails(getDoc(doc(authDb, "usage_users/student-1_2026-07")));
  await assertFails(setDoc(doc(authDb, "usage_users/student-1_2026-07"), {
    count: 3,
    weeks: ["1CO:1-2", "1CO:3-4"],
  }));
});

test("students can create and update their own mastery docs", async () => {
  const db = studentDb("student-1");
  const ownDoc = doc(db, "mastery/student-1");

  await assertSucceeds(setDoc(ownDoc, buildMastery({ mastered: 3, total: 12 })));
  await assertSucceeds(updateDoc(ownDoc, {
    authorName: "Student",
    mastered: 4,
    total: 12,
    updatedAt: serverTimestamp(),
  }));
});

test("students cannot forge another user's mastery doc id", async () => {
  const db = studentDb("student-1");
  const forgedDoc = doc(db, "mastery/student-2");

  await assertFails(setDoc(forgedDoc, buildMastery({ mastered: 3, total: 12 })));
});

test("students cannot violate mastery bounds or key shape", async () => {
  const db = studentDb("student-1");

  await assertFails(setDoc(doc(db, "mastery/student-1"), buildMastery({
    mastered: 6,
    total: 5,
  })));
  await assertFails(setDoc(doc(db, "mastery/student-1"), {
    ...buildMastery({ mastered: 2, total: 5 }),
    extra: "nope",
  }));
  await assertFails(setDoc(doc(db, "mastery/student-1"), buildMastery({
    authorName: "",
    mastered: 2,
    total: 5,
  })));
});

test("unauthenticated users cannot read mastery docs", async () => {
  await seedMastery("student-1", { authorName: "Seeded", mastered: 3, total: 12 });
  const unauthDb = testEnv.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(unauthDb, "mastery/student-1")));
  await assertFails(getDocs(collection(unauthDb, "mastery")));
});

test("authenticated users can read the scoreboard but not update another student's row", async () => {
  await seedMastery("student-1", { authorName: "Alpha", mastered: 5, total: 12 });
  await seedMastery("student-2", { authorName: "Beta", mastered: 4, total: 12 });

  const readerDb = studentDb("student-3");
  await assertSucceeds(getDoc(doc(readerDb, "mastery/student-1")));
  await assertSucceeds(getDocs(collection(readerDb, "mastery")));
  await assertFails(updateDoc(doc(readerDb, "mastery/student-1"), {
    authorName: "Hacker",
    mastered: 5,
    total: 12,
    updatedAt: serverTimestamp(),
  }));
});

function studentDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function forgedReviewerDb() {
  return testEnv.authenticatedContext("reviewer-user", { reviewer: true }).firestore();
}

function buildSuggestion(overrides = {}) {
  const payload = {
    uid: "student-1",
    authorName: "Student",
    kind: "question_seed",
    book: "1 Corinthians",
    chapter: 5,
    reference: "1 Corinthians 5",
    text: "Why is this passage structured this way?",
    answerText: "",
    status: "new",
    createdAt: serverTimestamp(),
    ...overrides
  };
  if (payload.kind !== "link" && !Object.prototype.hasOwnProperty.call(overrides, "url")) {
    delete payload.url;
  }
  return payload;
}

function buildMastery(overrides = {}) {
  return {
    authorName: "Student",
    mastered: 3,
    total: 12,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedSuggestion(id, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `suggestions/${id}`), {
      uid: "student-1",
      authorName: "Seeded",
      kind: "question_seed",
      book: "1 Corinthians",
      chapter: 3,
      reference: "1 Corinthians 3",
      text: "Seeded text",
      answerText: "",
      status: "new",
      createdAt: fixedTimestamp("2026-01-01T00:00:00Z"),
      ...overrides
    });
  });
}

async function seedReviewEvent(suggestionId, eventId) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), `suggestions/${suggestionId}/reviewEvents/${eventId}`),
      {
        action: "approved",
        actor: "reviewer",
        at: fixedTimestamp("2026-01-01T00:00:00Z"),
      }
    );
  });
}

async function seedUsage(month, payload) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `usage/${month}`), payload);
  });
}

async function seedMastery(uid, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `mastery/${uid}`), {
      authorName: "Seeded",
      mastered: 3,
      total: 12,
      updatedAt: fixedTimestamp("2026-01-01T00:00:00Z"),
      ...overrides,
    });
  });
}

function fixedTimestamp(value) {
  return new Date(value);
}

function getFirestorePort() {
  if (process.env.FIRESTORE_EMULATOR_PORT) {
    return Number(process.env.FIRESTORE_EMULATOR_PORT);
  }
  const host = String(process.env.FIRESTORE_EMULATOR_HOST || "");
  const match = host.match(/:(\d+)$/);
  if (match) {
    return Number(match[1]);
  }
  return 8800;
}
