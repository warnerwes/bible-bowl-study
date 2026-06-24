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
    "text": "'10 to inspect, 14 to perfect.' ..."
  }
}
```

**Memory aid types**
- `mnemonic` — an acronym, rhyme, number trick, or word association.
- `teaching` — a short expository teaching on the fact's significance in the
  Orthodox/patristic tradition (typology, salvation-history meaning).
- `image` — an emotional, shocking, or weird mental picture that burns it in.

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
