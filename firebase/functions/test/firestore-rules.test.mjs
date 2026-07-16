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

const PROJECT_ID = "bible-bowl-study-rules";
const RULES_PATH = new URL("../../firestore.rules", import.meta.url);

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
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

test("reviewer can approve a new suggestion via status-only update", async () => {
  await seedSuggestion("review-status", { uid: "student-1", status: "new" });
  const reviewerDoc = doc(reviewerDb(), "suggestions/review-status");

  await assertSucceeds(updateDoc(reviewerDoc, { status: "approved" }));
});

test("reviewer can list all suggestions", async () => {
  await seedSuggestion("list-a", { uid: "student-1", createdAt: fixedTimestamp("2026-01-01T00:00:00Z") });
  await seedSuggestion("list-b", { uid: "student-2", createdAt: fixedTimestamp("2026-01-02T00:00:00Z") });

  const suggestions = query(collection(reviewerDb(), "suggestions"));
  const snapshot = await assertSucceeds(getDocs(suggestions));

  assert.equal(snapshot.size, 2);
});

function studentDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function reviewerDb() {
  return testEnv.authenticatedContext("reviewer-user", { reviewer: true }).firestore();
}

function buildSuggestion(overrides = {}) {
  return {
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

function fixedTimestamp(value) {
  return new Date(value);
}
