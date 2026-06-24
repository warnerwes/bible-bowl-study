# Question Factory

This repo separates answer correctness from memory-aid quality.

- Answers are verified by human reviewers against the Orthodox Study Bible.
- Memory aids are judged for memorability by reviewers.
- Any teaching, typology, historical context, or surprising-fact claim must have
  a credible source URL and a short source claim that the link actually supports.
- Pure images and mnemonics should not carry source fields.

## Workflow

1. Build review packets from the current raw questions.

```bash
node scripts/build-review-packets.js groupA
```

This writes:

```text
data/candidates/groupA.candidates.json
data/reviews/groupA.review.json
```

2. Add candidate memory aids.

Local Ollama, cheap and private:

```bash
node scripts/generate-ollama-candidates.js groupA llama3.1
```

To limit a test run:

```powershell
$env:LIMIT=3; node scripts/generate-ollama-candidates.js groupA llama3.1
```

3. Make one large source-search prompt for ChatGPT Pro, Google, or Gemini.

```bash
node scripts/make-source-search-export.js groupA
```

For a spreadsheet-friendly export with all review fields and blank columns for
the agent's verdict/replacement proposal:

```bash
node scripts/export-review-csv.js groupA
```

Paste `data/source-exports/groupA.source-search-prompt.md` into the tool. Save
the returned JSON as `data/source-exports/groupA.sources.json`, then import it:

```bash
node scripts/import-source-export.js data/source-exports/groupA.sources.json
```

If the Pro tool returns the completed CSV instead, import it as candidate data:

```bash
node scripts/import-review-csv.js data/source-exports/groupA.review-export.part-01.completed.csv
```

The importer keeps the agent's `verified` source statuses as `found`, not
`verified`. Use `verified` only after your reviewers open the URL and confirm
the claim.

4. Review.

Edit `data/reviews/groupA.review.json`.

For each question:

- set `osbAnswerVerified` to `true` after checking the OSB.
- set `selectedCandidateId` to the candidate reviewers chose.
- add reviewer entries as useful.

For each selected source-backed candidate in `data/candidates`, set:

```json
"sourceStatus": "verified"
```

only after opening the URL and confirming `sourceClaim`.

To prefill selections from imported Pro candidates:

```bash
node scripts/prepare-review-selections.js groupA
```

This selects the newest agent candidate when one exists, otherwise the current
aid. It does not mark OSB answers or sources verified.

5. Apply reviewed choices.

```bash
node scripts/apply-reviewed-choice.js groupA
node scripts/build.js
```

For a stricter check after reviewed source URLs have been added:

```powershell
$env:STRICT_REVIEW=1; node scripts/build.js
```

## Candidate Rules

Each candidate has:

```json
{
  "candidateId": "ex17-006-b",
  "type": "mnemonic|image|teaching",
  "text": "memorable aid",
  "claimKind": "none|source-backed",
  "source": "short source label",
  "sourceUrl": "https://...",
  "sourceClaim": "what the link supports",
  "sourceStatus": "needs-review|needs-url|verified|no-source-found|not-needed"
}
```

Rules:

- `teaching` must be `source-backed`.
- `source-backed` requires `source`, `sourceUrl`, and `sourceClaim`.
- `claimKind: none` must not include source fields.
- `apply-reviewed-choice.js` refuses source-backed candidates unless
  `sourceStatus` is `verified`.

## Feedback Loop

Reviewer choices are data. Keep rejected candidates instead of deleting them
unless they are offensive or inaccurate. Over time, the selected candidates show
which styles actually work for your people.

## In-Quiz Voting

`node scripts/build.js` publishes a sanitized `data/review-candidates.json` file
when candidate packets exist. The quiz loads that file opportunistically. After
a learner sees a memory aid, it can ask which aid sticks better: the current aid
or the latest imported candidate.

Votes are stored in the learner's browser. They can export them from the home
screen with **Export memory-aid votes**.

To send votes invisibly to Google Forms, create a form with short-answer fields
named:

- questionId
- reference
- choiceId
- currentCandidateId
- alternateCandidateId
- chosenText
- mode
- answeredCorrectly
- votedAt

Then use Google Forms' **Get pre-filled link** and fill each field with its exact
field name as the sample value. For example, put `questionId` in the questionId
field, `reference` in the reference field, and so on. Copy the generated
pre-filled URL and run:

```bash
node scripts/create-vote-sink-from-prefill.js "PASTE_PREFILLED_URL_HERE"
```

That writes `data/vote-sink.json`. The quiz will still save votes locally first,
then fire-and-forget a background POST to the Google Form. If the form is
misconfigured or unavailable, the quiz continues normally.

Aggregate exported vote files:

```bash
node scripts/aggregate-aid-votes.js votes/*.json
```

If the Google Forms response Sheet is publicly viewable, skip manual downloads
and sync directly:

```bash
node scripts/sync-form-votes.js
```

To preselect clear alternate winners from live form data:

```bash
node scripts/sync-form-votes.js --prepare
```

To preselect clear alternate winners in `data/reviews`:

```bash
node scripts/aggregate-aid-votes.js --prepare votes/*.json
```

Defaults:

- clear winner requires at least 3 votes.
- clear winner requires at least 65% of votes.

Override these with `MIN_VOTES` and `WIN_RATE`.

This does not mark OSB answers or sources verified. Human verification is still
required before `apply-reviewed-choice.js` can publish the aid into the quiz.

## Closing the Loop

Once learners have voted, run the live Sheet sync:

```bash
node scripts/sync-form-votes.js
```

If the report shows clear winners, prepare review selections:

```bash
node scripts/sync-form-votes.js --prepare
```

Then keep the human gate:

1. Open `data/reviews/group*.review.json`.
2. Confirm each chosen question has `osbAnswerVerified: true`.
3. For selected source-backed candidates, open the source URL and set
   `sourceStatus: "verified"` in `data/candidates/group*.candidates.json`.

Apply and rebuild:

```bash
node scripts/apply-reviewed-choice.js groupA
node scripts/build.js
```

After rebuild, promoted aids become the live `memoryAid` in
`data/questions.json`. The quiz stops comparing an identical candidate because
`build.js` excludes candidate text that already matches the current aid.

Publish by pushing to `main`; GitHub Actions runs `node scripts/build.js` and
deploys the static site to GitHub Pages.
