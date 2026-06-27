# Bible Bowl Study — Exodus

A self-contained web app to quiz yourself on the Book of Exodus (Orthodox Study
Bible tradition). When you miss a question it doesn't just hand you the answer —
it gives you a **memory aid** designed to make the fact stick forever: a
mnemonic, a short expository teaching on the fact's significance, or a vivid /
shocking mental image.

## What's here

```
index.html         # the quiz UI (framework-free; restyle/replace freely)
styles.css         # styling (Byzantine-night theme; Cormorant Garamond + Spectral)
app.js             # quiz engine — study modes, progress/mastery, Anki export,
                   #   memory-aid voting, and celebration effects
data/
  questions.json         # ← the curated question library (source of truth, generated)
  raw/*.json             # per-chapter-group sources merged into questions.json
  review-candidates.json # alternate memory-aid candidates shown for in-app A/B voting
  vote-sink.json         # optional Google-Form sink config for anonymous vote capture
  vote-source.json       # Google Sheet CSV URL for pulling submitted votes back
  candidates/  reviews/  # per-group curation packets for the human review factory
scripts/
  build.js               # merge + validate data/raw/*.json -> data/questions.json
  build-review-packets.js + others  # the memory-aid curation / voting pipeline
docs/
  question-factory.md    # the human-review + AI-candidate curation workflow
.github/workflows/
  deploy.yml             # builds + publishes the site to GitHub Pages on push to main
```

The **question library is the heart of this project**. The front-end is
deliberately simple and decoupled so a separate UI can be built on top of the
same `data/questions.json` without touching the content.

## Features (the web app)

A framework-free study tool over `data/questions.json`. Everything runs client-side;
progress is saved **per device** in `localStorage` — no account, no server.

### Study modes
- **Start studying** — the main path: every question, shuffled. Questions you miss
  resurface more often (weighted shuffle); mastered ones are set aside.
- **Drill my missed (N)** — only questions you've gotten wrong, until you master them.
- **Review mastered (N)** — revisit mastered questions with no stakes (results aren't
  recorded, so a miss here won't un-master anything).
- **Build a custom quiz** (advanced) — choose chapters, question types, and length.
- Multiple-choice answer options are **shuffled** on every render.

### Memory aids & study guide
- Miss a question and its **memory aid** (mnemonic / teaching / image, with patristic
  source) is revealed automatically; a **Show / Hide study guide** toggle reveals it on
  correct answers too. "Always show the memory aid" is a home-screen option.
- **Read … in context ↗** — after answering, a link opens the passage in the
  **Septuagint (Brenton LXX)** on BibleHub (the OSB's Old Testament basis).
- **⚐ Suggest a correction** — opens a pre-filled GitHub issue carrying the full
  study-guide content (question, answer, options, memory aid + source).

### Progress & mastery (per device)
- Tracks right/wrong per question; **mastery = 3 correct in a row**, after which a
  question is set aside (shown only rarely).
- The home screen shows **Seen / to review / mastered**, with **Reset mastered** and
  **Reset all** controls. (Stored under `localStorage` key `bbs:stats:v1`.)

### Celebration
- A subtle **confetti burst** on every correct answer, and a **full-screen confetti
  drop + "✦ Mastered!"** flourish when a question reaches mastery. Honors
  `prefers-reduced-motion` (motion skipped; the badge still shows).

### Anki export
- In the advanced panel, **⬇ Export N questions to Anki (CSV)** downloads your current
  selection as an Anki-ready deck — Basic notes (question → answer + reference + memory
  aid), tagged by chapter and type, with `#`-directives for one-click import. The count
  is shown live; the "How many questions?" setting only limits a quiz, not the export.

### Memory-aid A/B voting (curation feedback)
- When an alternate candidate exists for a question (from `data/review-candidates.json`),
  the study guide shows **"Which aid sticks better?"** — pick the current aid or the
  alternate, or **Suggest my own**. The choice is saved when you press **Next**.
- Votes are stored locally (`bbs:aid-votes:v1`). If `data/vote-sink.json` is enabled,
  each vote is also submitted anonymously to a Google Form. **Export memory-aid votes**
  (home screen) downloads them for tallying — see the curation pipeline below.

### Hosting
- Published to **GitHub Pages** by `.github/workflows/deploy.yml` on every push to
  `main` (it validates the library, then deploys). Assets are cache-busted (`?v=N`) so
  visitors always get the latest UI.

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
