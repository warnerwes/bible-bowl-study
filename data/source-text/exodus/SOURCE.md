# Exodus — source text (Orthodox Study Bible)

Raw scripture text for the Book of Exodus, extracted for use as the grounding
source behind this study app's questions and memory aids.

## Attribution & fair use

Scripture text is taken from the **Orthodox Study Bible**, Old Testament
translated by the **St. Athanasius Academy of Orthodox Theology** (the *St.
Athanasius Academy Septuagint™*, "SAAS"). The Old Testament follows the
**Septuagint (LXX)** tradition, so chapter/verse divisions and some wording
differ from the Masoretic/KJV tradition.

> Scripture text from *The Orthodox Study Bible*, © St. Athanasius Academy of
> Orthodox Theology. Used by permission under fair use for non-commercial study.

This excerpt is limited to a small portion of the work (well under the 1,000
verses permitted), used for personal/educational study. Credit is given to the
Orthodox Study Bible and St. Athanasius Academy.

## What's here

Selected chapters only — the scope of the Bible Bowl study set:

- **Exodus 1–20** (Israel in Egypt → the plagues → Red Sea → Sinai → Decalogue)
- **Exodus 32–34** (golden calf → covenant renewal)
- **Exodus 38–40** (tabernacle construction → glory fills the tabernacle)

| File | Contents |
|---|---|
| **`exodus-verses.json`** | **Primary lookup file — verse-level, structured.** See below. |
| `exodus-NN.txt` | One chapter per file: `N  <verse text>` per line, `## Heading` lines for sections. |
| `exodus-selected.txt` | All chapters in one file (`===== EXODUS N =====` separators). |
| `exodus-selected.json` | `{ "chapters": { "<n>": "<numbered flowing text>" } }` — chapter-level. |
| `extract-osb-exodus.py` | The reproducible extractor (needs the OSB PDF + PyMuPDF). |

All files are generated from the same validated verse data, so the `.txt`,
chapter JSON, and verse JSON agree.

## `exodus-verses.json` — the structured one

Flat `"chapter:verse"` keys for O(1) lookup, matching how `data/questions.json`
writes references (e.g. `"Exodus 1:1-5"` → loop `1:1`…`1:5`):

```json
{
  "book": "Exodus",
  "translation": "Orthodox Study Bible — St. Athanasius Academy Septuagint (SAAS)",
  "versification": "Septuagint (LXX)",
  "verses": { "1:1": "Now these are the names...", "20:13": "“You shall not murder.”" },
  "headings": { "2:1": "The Birth of Moses" }
}
```

- **720 verses**, every chapter validated against the OSB's own chapter-index
  verse counts (1:22, 12:51, 15:27, 40:32, …). Counts are LXX, not KJV.
- Section headings live in a **separate `headings` map** (keyed by the verse they
  precede), not mixed into the verse text.
- OSB **study articles/sidebars** (e.g. ch. 12 "Christ Our Passover", ch. 20
  "Grace of Christ and the Law of Moses") and study-note markers (`†`, `ω`) are
  **excluded** from the verse text.
- Known cosmetic artifact: a handful of **intra-word spaces** survive in the
  ch. 15 poetry (the Song of the Sea), e.g. `forev er`, `salv ation` — these are
  in the source PDF's text layer on that page. ~18 occurrences, almost all in
  ch. 15. Clean up with a downstream pass if needed.
- Verse 1 of each chapter was located via the PDF's own per-verse navigation
  anchors (verse 1 is unnumbered in the text); verses 2..N split on the
  embedded/superscript verse numbers.
- **Validation:** every chapter's verse count is checked against the OSB index,
  and a boundary check confirms each chapter's v1 starts a sentence and its last
  verse ends on terminal punctuation (catches misplaced chapter splits).

## Raw extraction — caveats (cleanup pending)

This is a **raw** pull from the source PDF, intended to be cleaned up
downstream. Known artifacts:

- **Verse numbers are inline** (e.g. `2Reuben`, `8But there arose`). Verse 1 of
  each chapter is unnumbered (it just begins the chapter). No verse number is
  separated from its following word.
- **Section headings are included** inline (e.g. `The Birth of Moses`,
  `Entrance of the Priests`).
- **OSB study articles / sidebars are sometimes included.** Some pages embed
  commentary boxes (e.g. *"The Grace of Christ and the Law of Moses"* in ch. 20)
  whose text was pulled into the chapter flow. These are OSB *commentary*, not
  scripture — strip them during cleanup.
- **Study-note markers** (the `†` and `ω` superscripts in the PDF) were removed.
- Line breaks reflect the PDF's wrapping, not sentence/verse structure.

## Provenance

Extracted from the publicly posted OSB PDF
(`myorthodoxbooks.org/.../the_orthodox_study_bible_-_st.pdf`), Exodus text pages,
using the PDF's own per-verse navigation anchors to slice chapter boundaries.
Verse counts validated against the PDF's chapter index pages.
