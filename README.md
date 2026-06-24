# Bible Bowl Study — Exodus

A self-contained web app to quiz yourself on the Book of Exodus (Orthodox Study
Bible tradition). When you miss a question it doesn't just hand you the answer —
it gives you a **memory aid** designed to make the fact stick forever: a
mnemonic, a short expository teaching on the fact's significance, or a vivid /
shocking mental image.

## What's here

```
index.html        # the quiz UI (framework-free; restyle/replace freely)
styles.css        # styling
app.js            # quiz engine (loads data/questions.json)
data/
  questions.json  # ← the curated question library (the source of truth, generated)
  raw/*.json      # per-chapter-group source files that get merged into questions.json
scripts/
  build.js        # merge + validate data/raw/*.json -> data/questions.json
  build-review-packets.js  # create candidate/review files for human curation
```

The **question library is the heart of this project**. The front-end is
deliberately simple and decoupled so a separate UI can be built on top of the
same `data/questions.json` without touching the content.

## Question schema

Each question in `data/questions.json` (and the `data/raw/*.json` sources) is:

```jsonc
{
  "id": "ex12-004",               // "ex" + 2-digit chapter + "-" + 3-digit sequence
  "chapter": 12,
  "book": "Exodus",
  "reference": "Exodus 12:3,6",
  "topic": "Passover",
  "type": "multiple-choice",       // "multiple-choice" | "true-false" | "fill-in"
  "question": "On which day of the month was the Passover lamb to be set apart?",
  "answer": "10th day",            // for true-false: exactly "True" or "False"
  "options": ["10th day", "14th day", "1st day", "7th day"], // MC only (incl. answer)
  "acceptableAnswers": ["10th", "tenth day"],                // fill-in only (lowercase)
  "memoryAid": {
    "type": "mnemonic",            // "mnemonic" | "teaching" | "image"
    "text": "'10 to inspect, 14 to perfect.' ...",
    "source": "St. Gregory of Nyssa, The Life of Moses"  // REQUIRED for "teaching"
  }
}
```

**Memory aid types**
- `mnemonic` — an acronym, rhyme, number trick, or word association.
- `teaching` — a short expository teaching on the fact's significance in the
  Orthodox/patristic tradition (typology, salvation-history meaning). **Must
  carry a `source`** citing a Church Father, Scripture, or Fr. Stephen De Young.
- `image` — an emotional, shocking, or weird mental picture that burns it in.

**Terminology** — all wording follows the **Septuagint / Orthodox Study Bible**
(e.g. God's name "I AM THE EXISTING ONE", 75 souls into Egypt, the "south wind"
that divides the Red Sea, the fourth plague of "dog-flies").

## Run it locally

The app fetches `data/questions.json`, so it needs to be served over HTTP
(opening `index.html` via `file://` will be blocked by the browser):

```bash
cd bible-bowl-study
python3 -m http.server 8000
# then open http://localhost:8000
```

## Regenerate / extend the library

Edit or add files under `data/raw/`, then rebuild and validate:

```bash
node scripts/build.js
```

`build.js` validates every question (types, options contain the answer,
true/false answers, memory aids present) and fails loudly on any problem before
writing `data/questions.json`. To add a new book or chapter, drop another
`data/raw/<name>.json` array in and rebuild.

## Human review factory

For the memory-aid curation workflow, see
[`docs/question-factory.md`](docs/question-factory.md). The short version:

```bash
node scripts/build-review-packets.js groupA
node scripts/generate-ollama-candidates.js groupA llama3.1
node scripts/make-source-search-export.js groupA
node scripts/export-review-csv.js groupA
# import source JSON after using ChatGPT/Gemini/Google
node scripts/import-source-export.js data/source-exports/groupA.sources.json
# after reviewers select and verify
node scripts/prepare-review-selections.js groupA
node scripts/apply-reviewed-choice.js groupA
node scripts/build.js
```

The quiz can also collect lightweight A/B votes for current vs imported memory
aid candidates. Exported vote JSON files can be tallied with:

```bash
node scripts/aggregate-aid-votes.js votes/*.json
```

Or pull the public Google Forms response Sheet directly:

```bash
node scripts/sync-form-votes.js
```

For invisible Google Forms collection, create the form fields and generate
`data/vote-sink.json` from a pre-filled link:

```bash
node scripts/create-vote-sink-from-prefill.js "PASTE_PREFILLED_URL_HERE"
```

Closed loop from votes to published aids:

```bash
node scripts/sync-form-votes.js --prepare
# verify OSB answers and source-backed candidates in data/reviews + data/candidates
node scripts/apply-reviewed-choice.js groupA
node scripts/build.js
git add .
git commit -m "Promote reviewed memory aids"
git push origin main
```
