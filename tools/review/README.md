# Review CLI

Admin-only review workflow for the Corinthians pilot.

## Prerequisites

- Node 20
- Application Default Credentials for `firebase-admin`
- `GOOGLE_CLOUD_PROJECT` set to `bible-bowl-study` or another target project
- `BBS_REVIEWER_ID` set for mutating commands

## Install

```powershell
cd tools/review
npm install
```

## Commands

```powershell
$env:GOOGLE_CLOUD_PROJECT = "bible-bowl-study"
$env:BBS_REVIEWER_ID = "atlas-session-20260716-01"

node review.mjs list --status new --json
node review.mjs show SUGGESTION_ID --json

node review.mjs approve SUGGESTION_ID `
  --question '{"book":"1 Corinthians","bookSlug":"1cor","chapter":13,"reference":"1 Corinthians 13","topic":"Love","type":"multiple-choice","question":"Synthetic prompt","answer":"Synthetic answer","options":["Synthetic answer","Other A","Other B","Other C"],"difficulty":"medium","roundFormat":"standard"}' `
  --no-scripture-quote

node review.mjs approve SUGGESTION_ID `
  --memory-hook '{"book":"1 Corinthians","bookSlug":"1cor","chapter":13,"reference":"1 Corinthians 13:4-7","text":"Synthetic memory hook"}' `
  --quotes-verses "1 Corinthians 13:4-7"

node review.mjs annotate SUGGESTION_ID --note "Needs a tighter correction."
node review.mjs reject SUGGESTION_ID --reason "Out of scope."
node review.mjs export
```

## Suggestion kinds

| Kind | Review action | Export target |
| --- | --- | --- |
| `question_seed` | Approve with `--question`, annotate, reject | `questions.seed.json` |
| `memory_hook` | Approve with `--memory-hook`, annotate, reject | `memory-hooks.json` |
| `surprising_fact` | Approve with `--memory-hook`, annotate, reject | `memory-hooks.json` with `kindTag` |
| `correction` | Annotate, reject | Not exportable |
| `link` | Annotate, reject | Quarantined, not exportable |

## Runbook

1. `node review.mjs list --status new --json`
2. `node review.mjs show SUGGESTION_ID --json`
3. Approve, reject, or annotate.
4. `node review.mjs export`
5. `node generator/pilots/corinthians/build-site.mjs`
6. `git diff --check`
7. `git add tools/review generator/pilots/corinthians firebase`
8. `git commit -m "Export reviewed Corinthians suggestions"`
9. `firebase deploy --only hosting`

## Question id corrections

Material answer corrections must mint a new question id. Reusing an existing id with a different answer is refused with `ID_REUSE_REQUIRES_NEW_ID` so old mastery streaks cannot silently validate against the wrong answer.
