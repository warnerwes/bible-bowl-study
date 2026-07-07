# Bible Bowl Game Generator Vision

## What We Built Here

This Exodus site is not just a quiz app. It is a content factory with a small
static web app wrapped around it.

The design process had four main parts:

1. Build a scripture-rooted question bank.
2. Attach memory aids that help students remember missed facts.
3. Verify answers and source-backed teaching through a human review gate.
4. Reward mastery with interactive tools that make ordered biblical structure
   easier to remember.

The frontend is intentionally simple. The durable asset is the curated data:
`data/raw/*.json`, generated into `data/questions.json`, with candidate review
packets, source exports, learner voting, and build-time validation around it.

## Current Question Module Process

Questions start in per-group raw JSON files under `data/raw/`. Each question
has a stable id, book, chapter, reference, topic, type, prompt, answer, options
or acceptable answers, and a `memoryAid`.

The schema is deliberately constrained:

- `multiple-choice` questions must include options and the correct answer.
- `true-false` answers must be exactly true or false.
- `fill-in` questions can carry acceptable answer variants.
- Every question must cite a scripture reference.
- Every question must have a memory aid.
- Teaching memory aids must cite a source.

`scripts/build.js` merges and validates the raw files into
`data/questions.json`. This keeps the runtime app clean: it fetches one generated
question file and does not need to know how curation happened.

The review factory is the important design pattern:

1. `scripts/build-review-packets.js groupA` copies each current memory aid into
   a candidate packet and creates a review file.
2. AI or human editors add alternate candidates: mnemonic, image, or teaching.
3. Source-backed candidates must include source label, URL, and a short claim.
4. Reviewers verify the OSB answer separately from the memory-aid quality.
5. Reviewers select a candidate only after checking the answer and source.
6. `scripts/apply-reviewed-choice.js groupA` promotes selected candidates.
7. `scripts/build.js` republishes the validated library.

The site can also show A/B memory-aid choices to learners. Those votes are not
treated as truth; they are feedback for reviewers. Human review remains the
publishing gate.

## Current Research Process

The project used separate deep-research briefs for two kinds of add-ons:

- Wonders: reward scenes that reenact major narrative moments.
- Memory Labs: ordered-structure games such as plagues, tribes, commandments,
  priestly genealogy, and consecration.

The research briefs ask for:

- OSB / SAAS wording checks.
- Septuagint-specific differences.
- Orthodox patristic and liturgical sources.
- Fr. Stephen De Young or other Orthodox teaching where relevant.
- Red flags where gameplay might teach the wrong action.
- Concrete interaction specs, not just general ideas.

That separation is worth keeping. Question accuracy, memory-aid quality,
patristic study notes, and interactive game design are related but distinct
review tracks.

## Goal For The New Generator

Create a generator skill/toolchain in this repo, orchestrated by Claude Code
with worker models, that can build a new Bible Bowl study site for any book of
the Bible using the same factory pattern. The Exodus app stays exactly as-is;
the generator copies its shared engine (quiz logic, memory-lab framework,
mastery trials, stats) into each new book repo as a pinned version. Engine
version bumps in book repos are manual for now, automatable by a bot later.

The generator treats readers as the students. Parish students (mostly minors)
read their own printed or purchased Orthodox Study Bibles. The public site
never displays scripture book text for reading. Instead, each book site ships a
reading-plan page with reference ranges and a weekly schedule, plus deep links
per assignment to a licensed platform that carries the NKJV (e.g. Bible
Gateway) for anyone without a print copy.

Seeds come from the students. While reading, students submit queue items
through a Google Form deep-linked from the reading-plan page with book and
chapter pre-filled via URL parameters. The queue item types are the same ones
identified in v1:

- `memory_point`
- `question_seed`
- `sequence_seed`
- `reward_seed`
- `confusing_detail`
- `patristic_thread`

An ingestion script pulls the Google Sheet into `data/queue/*.json`. Every
ingested seed starts in a moderation state; the project owner approves seeds
before they enter the pipeline. The form collects at most first name or
initials, and no student names are ever published; ingestion strips PII.

The next book will be a New Testament book (specific book TBD), but the
generator must handle any book of the Bible. Book identity is a runtime
parameter, never baked into generator code.

## Bible Text Constraint

The source Bible text must be the St. Athanasius Academy Septuagint / Orthodox
Study Bible tradition, but the public site never hosts whole books. Because the
source is copyrighted, the generator enforces a per-translation quotation
policy, not a flat verse budget.

The OSB is two translations with two rights holders:

- **NKJV (OSB New Testament).** Gratis-use terms verified 2026-07-06 against
  the live HarperCollins Christian Publishing permissions page: max 500 verses;
  quoted scripture must be less than 25% of the total text of the work; must not
  account for more than 50% of an entire book of the Bible; must not be part of
  a commentary or other Biblical reference work. Required notice:

  > "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved."

  Gratis use covers websites ("any form... electronic"), but smartphone apps /
  digital products are routed to the licensing department — the classification
  of a web app is a known gray zone. A permission/clarification email has been
  sent to HCCPpermissions@HarperCollins.com asking (a) whether a quiz study
  site counts as a "Biblical reference work" and (b) whether a free website
  falls under electronic gratis use.

- **SAAS (OSB Old Testament, including the 2008 Psalms which follow LXX
  numbering and include Psalm 151).** Copyright 2008 by St. Athanasius Academy
  of Orthodox Theology — a different rights holder from Thomas Nelson; NOT
  covered by the HarperCollins policy. Gratis terms per the OSB copyright
  page: up to 1,000 verses, less than 50% of any complete book, less than 50%
  of the quoting work. Required notice:

  > "Scripture taken from the St. Athanasius Academy Septuagint™. Copyright © 2008 by St. Athanasius Academy of Orthodox Theology. Used by permission. All rights reserved."

  Requests beyond gratis: press@stacollege.org.

Every verse used counts as a full verse against the budget. Whole-book hosting
is impossible under either gratis policy. OSB study notes and footnotes are
NEVER quoted — summarize and cite only. Patristic texts may be quoted,
preferring public-domain translations (ANF/NPNF); modern copyrighted
translations and modern authors' books are summarized and cited, though freely
published blog/podcast material may be quoted with citation.

Questions are written to test facts by reference without reproducing verse text
whenever possible. Every verbatim excerpt must carry an `inclusionReason` in
the source manifest. The gratis caps are ceilings, not targets.

For NT books, the OSB NT is the NKJV, so no PDF extraction is needed: quoted
excerpts are transcribed/verified from an owned copy, and full-text reading is
delegated to students' own Bibles plus links to licensed platforms. An
optional future upgrade is a dynamic reading view via the API.Bible service
(which carries the NKJV on a free non-commercial plan) — but its terms require
cache refresh at least every 30 days and forbid caching 500+ consecutive
verses, so API text can never be baked into the repo; it would be a runtime-only
reader. For future OT books (SAAS), extraction from the owner's own copy only
(never from pirate scans), stored local-only and gitignored, with OCR cleanup
and verse-continuity validation against a canonical verse-count index.

## Proposed Generator Workflow

### 1. Book Setup

The skill receives a target book and creates a project using the existing
static-app pattern:

- `data/raw/`
- `data/candidates/`
- `data/reviews/`
- `data/queue/`
- `docs/`
- scripts for build, validation, review packets, source auditing, and queue
  ingestion

For NT books there is no `data/source-text/<book>/` directory in the repo;
source text is local-only and gitignored for OT books only, and even there it
is only the owner's own copy used for extraction, never published.

The manifest records the per-translation quotation policy, for example:

```json
{
  "translation": "NKJV",
  "rightsHolder": "HarperCollins Christian Publishing / Thomas Nelson",
  "quotedVerseLimit": 500,
  "maxRatioOfWork": 0.25,
  "maxRatioOfBook": 0.50,
  "excludedUse": "Biblical reference work",
  "notice": "Scripture taken from the New King James Version. Copyright 1982 by Thomas Nelson. Used by permission. All rights reserved.",
  "quotedVersesUsed": 0,
  "inclusionReasons": []
}
```

### 2. Reading Capture

The reading-plan page lists assignments by reference range and week. Each
assignment links to the Google Form with book and chapter pre-filled. Students
submit seeds; the ingestion script pulls the Sheet into `data/queue/*.json`.

Every seed starts with `status: "queued"` and moves through moderation:

```text
queued → approved → researched → drafted → in-review → published
                    ↳ rejected (with permanent rejection reason)
```

Rejected seeds keep their rejection reason permanently and are never
re-proposed.

### 3. Queue Refinement

Approved queue items become the new question factory input. Each item can
promote into one or more candidate artifacts:

- quiz question,
- memory aid,
- study-guide note,
- ordered memory lab,
- unlockable reward idea,
- research task.

The skill does not assume every note becomes a question. Some notes are better
as memory aids, study-guide explanations, or lab/reward ideas. Duplicate seeds
are deduplicated/merged before drafting.

### 4. Deep Research Pass

For selected approved queue items, the generator produces export-ready
research briefs, batched by chapter/theme rather than one per seed. The owner
runs them in ChatGPT deep research, and the results are imported back as
candidate artifacts with citations, feeding review packets. Source-backed claims
still require URLs and human review before publishing.

The briefs ask for the same checks as before:

- OSB / SAAS wording checks.
- Septuagint-specific differences.
- Orthodox patristic and liturgical sources.
- Fr. Stephen De Young or other Orthodox teaching where relevant.
- Red flags where gameplay might teach the wrong action.
- Concrete interaction specs, not just general ideas.

### 5. Question Shaping

Question candidates are shaped around Bible Bowl usefulness:

- one clear tested fact,
- exact scripture reference,
- answer verifiable from the OSB text,
- plausible but fair distractors,
- topic tagging,
- difficulty and/or Bible Bowl round-format field,
- memory aid,
- optional study guide,
- source-backed teaching only when verified.

The system prefers fewer excellent questions over a large weak bank. A
per-chapter coverage report tracks seeds and questions per chapter so thin
coverage is visible.

### 6. Memory Tools And Games Analysis

The skill scans the selected book for structures that deserve games:

- ordered lists,
- genealogies,
- journeys,
- repeated phrases,
- covenant commands,
- speeches,
- ritual sequences,
- named people and offices,
- places in order,
- cause-and-effect chains.

Output types:

- drag-order labs,
- tree-placement labs,
- map/path ordering,
- matching games,
- timeline reconstruction,
- unlockable reward scenes.

Rewards should teach the book. They should not be generic badges. A reward is
worth building when the player action reinforces the biblical event, pattern,
or memory structure.

## Proposed Skill Responsibilities

The generator skill/toolchain in this repo guides Claude Code through these
phases:

1. Inspect the current Bible Bowl repo pattern.
2. Create or update the game scaffold for a new book.
3. For OT books only, extract and budget permitted SAAS verses from a local,
   gitignored copy of the source text.
4. Build the reading-capture queue and Google Form integration.
5. Convert queue items into candidate questions and memory tools.
6. Generate deep-research prompts from approved queue items.
7. Import researched candidates into review packets.
8. Enforce human review before publishing.
9. Validate all generated data.
10. Keep runtime files under 800 lines when adding code.

The skill preserves the same principle used here: AI can propose, compare, and
organize, but verified scripture accuracy and Orthodox teaching require a
review gate. The project owner is the only human gate for now. At scale (e.g.
300 seeds), bot review lanes pre-filter: at least two out-of-family AI models
independently verify answer-vs-text before anything reaches the owner's review
queue; the owner gates final publish. The A/B learner-voting loop from the
Exodus app carries forward: votes are reviewer feedback, never truth.

## Data Model Additions Over v1

Queue item:

```json
{
  "id": "mark-q-0001",
  "book": "Mark",
  "reference": "Mark 1:1-3",
  "excerpt": "",
  "kind": "question_seed",
  "userNote": "Important opening wording to remember.",
  "tags": ["opening", "baptism"],
  "status": "queued",
  "createdAt": "2026-07-06T00:00:00.000Z"
}
```

Question candidate:

```json
{
  "queueItemId": "mark-q-0001",
  "id": "mark01-001",
  "book": "Mark",
  "chapter": 1,
  "reference": "Mark 1:1-3",
  "topic": "The Forerunner",
  "type": "multiple-choice",
  "question": "",
  "answer": "",
  "options": [],
  "difficulty": "medium",
  "memoryAid": {
    "type": "teaching",
    "text": "",
    "source": "",
    "sourceUrl": "",
    "sourceClaim": ""
  },
  "reviewStatus": "draft"
}
```

Coverage report:

```json
{
  "book": "Mark",
  "chapters": [
    { "chapter": 1, "seedCount": 12, "questionCount": 5, "coverage": "thin" }
  ]
}
```

All IDs are book-slug-prefixed (e.g. `mark-q-0001`) to prevent cross-book
collisions. A published question carries its `queueItemId` and research-artifact
reference so any live question audits back to its seed.

## Review Gates

A candidate should not become live until:

- the OSB answer is checked,
- the reference is correct,
- distractors are fair,
- the memory aid is accurate,
- source-backed teaching has a verified source,
- the wording is age-appropriate,
- the generated app passes schema tests.

For Bible text usage, every build should also check:

- quoted verse count is at or under the per-translation cap,
- no untracked Bible excerpt is present,
- references are valid,
- no copyrighted long passage is accidentally embedded.

## Build Gates Copied Into Every Scaffold

Every generated site ships with the same enforcement scripts, not just policy
prose:

- schema validation,
- verse-budget audit (verse count vs cap, max-consecutive-verses / 50%-of-book
  check, 25% ratio computed as quoted-scripture characters over total
  published text characters),
- untracked-excerpt detection (verbatim scripture allowed only in designated
  excerpt fields the auditor counts),
- encoding health check (scan for U+FFFD and cp1252-mangled UTF-8 sequences),
- 800-line source-file limit.

## Bugs And Process Risks Spotted In This Repo

- Some markdown and console output show mojibake characters, likely from UTF-8
  text being read or written with the wrong encoding. The generator enforces
  UTF-8 and adds the encoding health check above.
- Several runtime files exceed the 800-line project rule, including `app.js`,
  `rewards-scenes-2.js`, and `memory-labs-tabernacle.js`. New generator work
  should split modules earlier instead of repeating that growth pattern.
- Some docs still mention a human printed-OSB wording pass as incomplete. The
  generator should treat that as a first-class release gate, not a note.

## North Star

The generator should turn reading into game design.

Students read the Bible, select what matters, and submit seeds. Claude Code
and its worker team then help organize those seeds into accurate Bible Bowl
questions, vivid memory aids, Orthodox study guides, ordered memory games, and
unlockable rewards. The final game is not AI trivia over a Bible book. It is a
reviewed study tool that grew out of attentive reading.

## Open Questions

- Which New Testament book is first (affects reading plan, structure scan, pilot).
- HCCP permission email response pending (reference-work classification; website vs digital product).
- SAAS copyright-page wording to be verified against a print OSB.
- Google Form final field list and PII policy details.
- Whether a dynamic API.Bible reading view is wanted at launch or deferred.
