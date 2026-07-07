import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/schema-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "..", "..", "schemas");

const SELF_TEST = {
  "queue-item.schema.json": {
    positive: [
      {
        id: "mark-q-0001",
        book: "Mark",
        bookSlug: "mark",
        chapter: 1,
        reference: "Mark 1:1-3",
        kind: "question_seed",
        status: "queued",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z"
      }
    ],
    negative: [
      {
        id: "mark-q-0001",
        book: "Mark",
        bookSlug: "mark",
        chapter: 1,
        reference: "Mark 1:1-3",
        kind: "not_a_kind",
        status: "queued",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z"
      }
    ]
  },
  "question-candidate.schema.json": {
    positive: [
      {
        id: "mark01-001",
        queueItemIds: ["mark-q-0001"],
        researchArtifactIds: [],
        book: "Mark",
        bookSlug: "mark",
        chapter: 1,
        reference: "Mark 1:1-3",
        topic: "John the Baptist",
        type: "multiple-choice",
        question: "Who prepared the way for the Lord?",
        answer: "John the Baptist",
        options: ["John the Baptist", "Peter", "Paul"],
        acceptableAnswers: ["John the Baptist", "John"],
        difficulty: "easy",
        roundFormat: "standard",
        memoryAid: {
          type: "mnemonic",
          text: "A voice crying in the wilderness",
          claimKind: "none",
          sourceStatus: "not-needed"
        },
        studyGuide: {
          summary: "Mark begins with Isaiah's prophecy.",
          citations: ["Mark 1:1-3"]
        },
        reviewStatus: "draft"
      }
    ],
    negative: [
      {
        id: "mark01-001",
        queueItemIds: ["mark-q-0001"],
        book: "Mark",
        bookSlug: "mark",
        chapter: 1,
        reference: "Mark 1:1-3",
        type: "essay",
        question: "Who prepared the way for the Lord?",
        answer: "John the Baptist",
        difficulty: "easy",
        roundFormat: "standard",
        reviewStatus: "draft"
      }
    ]
  },
  "memory-tool-candidate.schema.json": {
    positive: [
      {
        id: "mark-tool-001",
        queueItemIds: [],
        researchArtifactIds: [],
        book: "Mark",
        chapterRange: "1:1-13",
        title: "Order the opening events",
        type: "drag-order",
        learningGoal: "Sequence the events of Mark 1:1-13",
        sourceReferences: ["Mark 1:1-13"],
        items: ["Prophecy", "John's preaching", "Baptism of Jesus"],
        correctOrder: ["Prophecy", "John's preaching", "Baptism of Jesus"],
        distractors: ["The feeding of the 5,000"],
        gameplaySpec: "Drag cards into chronological order.",
        redFlags: [],
        citations: ["Mark 1:1-13"],
        reviewStatus: "draft"
      }
    ],
    negative: [
      {
        id: "mark-tool-001",
        book: "Mark",
        chapterRange: "1:1-13",
        title: "Order the opening events",
        type: "crossword",
        learningGoal: "Sequence the events of Mark 1:1-13",
        reviewStatus: "draft"
      }
    ]
  },
  "research-artifact.schema.json": {
    positive: [
      {
        id: "mark-research-0001",
        batchId: "mark-ch01-opening",
        queueItemIds: [],
        book: "Mark",
        chapters: [1],
        themes: ["baptism", "wilderness"],
        tool: "chatgpt-deep-research",
        promptFile: "prompts/mark-ch01.txt",
        rawImportFile: "imports/mark-ch01.json",
        summary: "Overview of Mark 1 opening.",
        findings: [],
        citations: [
          {
            label: "Mark 1:1-3",
            url: "",
            sourceType: "scripture",
            rightsStatus: "public-domain",
            sourceClaim: "",
            verificationStatus: "verified"
          }
        ],
        redFlags: [],
        createdCandidateIds: [],
        importedAt: "2024-01-01T00:00:00Z"
      }
    ],
    negative: [
      {
        id: "mark-research-0001",
        book: "Mark",
        chapters: [1],
        tool: "chatgpt-deep-research",
        importedAt: "2024-01-01T00:00:00Z"
      }
    ]
  },
  "source-manifest.schema.json": {
    positive: [
      {
        book: "Mark",
        bookSlug: "mark",
        testament: "NT",
        canonicalVerseCount: 678,
        translations: [
          {
            translation: "NKJV",
            rightsHolder: "HarperCollins Christian Publishing / Thomas Nelson",
            quotedVerseLimit: 500,
            maxRatioOfWork: 0.25,
            maxRatioOfBook: 0.5,
            excludedUse: "Biblical reference work",
            notice: "Scripture taken from the New King James Version...",
            internalPolicy: {
              selfImposed: true,
              rationale: "We limit quoted verses to stay well below publisher caps.",
              consecutiveVerseCap: 8
            },
            quotedUses: []
          }
        ]
      }
    ],
    negative: [
      {
        book: "Mark",
        bookSlug: "mark",
        testament: "NT",
        canonicalVerseCount: 678,
        translations: [
          {
            translation: "NKJV",
            rightsHolder: "HarperCollins Christian Publishing / Thomas Nelson",
            quotedVerseLimit: 500,
            maxRatioOfWork: 0.25,
            maxRatioOfBook: 0.5,
            maxConsecutiveQuotedVerses: 8,
            excludedUse: "Biblical reference work",
            notice: "Scripture taken from the New King James Version...",
            internalPolicy: {
              selfImposed: true,
              rationale: "We limit quoted verses to stay well below publisher caps."
            },
            quotedUses: []
          }
        ]
      }
    ]
  },
  "site-config.schema.json": {
    positive: [
      {
        siteName: "Bible Bowl Study",
        repo: "warnerwes/bible-bowl-study",
        bibleVersion: "NKJV",
        defaultBook: "Mark",
        theme: {
          primaryColor: "#3b82f6",
          fontFamily: "system-ui, sans-serif"
        },
        features: {
          memoryLabs: true,
          masteryTrial: true,
          reader: true,
          updates: true
        },
        navigation: [
          { label: "Study", href: "#study" },
          { label: "Memory Labs", href: "#labs" }
        ],
        footer: {
          copyright: "© 2026 Bible Bowl Study",
          links: [{ label: "About", href: "#about" }]
        }
      }
    ],
    negative: [
      {
        siteName: "Bible Bowl Study",
        defaultBook: "Mark",
        features: {
          memoryLabs: true
        }
      }
    ]
  },
  "reading-plan.schema.json": {
    positive: [
      {
        id: "mark-plan-001",
        book: "Mark",
        bookSlug: "mark",
        title: "Mark in 16 Days",
        description: "A chapter-a-day reading plan.",
        days: [
          {
            day: 1,
            reference: "Mark 1:1-45",
            chapters: [1],
            summary: "The beginning of the gospel.",
            memoryVerse: "Mark 1:1"
          }
        ]
      }
    ],
    negative: [
      {
        id: "mark-plan-001",
        book: "Mark",
        bookSlug: "mark",
        title: "Mark in 16 Days",
        days: [
          {
            day: 0,
            reference: "Mark 1:1-45"
          }
        ]
      }
    ]
  },
  "form-config.schema.json": {
    positive: [
      {
        id: "feedback-001",
        title: "Study Feedback",
        description: "Tell us what you think.",
        fields: [
          {
            name: "name",
            label: "Your name",
            type: "text",
            required: true
          },
          {
            name: "rating",
            label: "Rating",
            type: "select",
            required: true,
            options: [
              { value: "1", label: "1 star" },
              { value: "5", label: "5 stars" }
            ]
          }
        ]
      }
    ],
    negative: [
      {
        id: "feedback-001",
        title: "Study Feedback",
        fields: [
          {
            name: "name",
            label: "Your name",
            type: "bad_type"
          }
        ]
      }
    ]
  },
  "reviewer-attestation.schema.json": {
    positive: [
      {
        reviewer: "wes",
        reviewedAt: "2024-01-01T00:00:00Z",
        artifactId: "mark-q-0001",
        verdict: "keep",
        comments: "Looks good.",
        signature: "wes-2024-01-01"
      }
    ],
    negative: [
      {
        reviewer: "wes",
        reviewedAt: "2024-01-01T00:00:00Z",
        artifactId: "mark-q-0001",
        verdict: "maybe"
      }
    ]
  }
};

function runSelfTest() {
  const files = readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".schema.json"))
    .sort();

  let allOk = true;

  for (const file of files) {
    let schema;
    try {
      schema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, file), "utf8"));
    } catch (error) {
      console.error(`${file}: SCHEMA PARSE FAIL: ${error.message}`);
      allOk = false;
      continue;
    }

    const examples = SELF_TEST[file];
    if (!examples) {
      console.error(`${file}: no self-test examples defined`);
      allOk = false;
      continue;
    }

    const localErrors = [];
    let positivePass = 0;
    let negativeFail = 0;

    for (const doc of examples.positive) {
      const result = validate(schema, doc);
      if (result.valid) {
        positivePass += 1;
      } else {
        allOk = false;
        for (const error of result.errors) {
          localErrors.push(`  positive: ${error}`);
        }
      }
    }

    for (const doc of examples.negative) {
      const result = validate(schema, doc);
      if (result.valid) {
        allOk = false;
        localErrors.push("  negative doc should have failed but passed");
      } else {
        negativeFail += 1;
      }
    }

    if (localErrors.length === 0) {
      console.log(
        `${file}: PASS (${positivePass} positive, ${negativeFail} negative)`
      );
    } else {
      console.log(`${file}: FAIL`);
      for (const error of localErrors) {
        console.log(error);
      }
    }
  }

  process.exit(allOk ? 0 : 1);
}

function printUsage() {
  console.log("Usage: node validate-schemas.mjs --self-test");
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  runSelfTest();
} else {
  printUsage();
  process.exit(1);
}
