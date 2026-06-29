# Plan: "Place the Holy Things" — Tabernacle Spatial Mini-Game

**Status:** Draft for review (asking GLM-5.2 + Kimi-K2.7)
**Author:** Hermes (Wes)
**Date:** 2026-06-28
**Repo:** `warnerwes/bible-bowl-study`
**Branch:** TBD (currently `main` at `52fd36c` / `99ef4ec`)

---

## 1. The Pitch (Wes's brief, captured verbatim)

> "Make it a map-placement game, not an ordering game."

> "One important Bible Bowl caution: Exodus 40 is the main placement chapter. In Brenton's Septuagint, Exodus 38 mainly names/makes items, while Exodus 40 tells where several items are placed. For example, Exodus 40 places the table on the north side, the lampstand on the south side, the golden altar before the veil, the burnt-offering altar by the doors, and the court around the tabernacle and altar."

**Spatial Game Board** (Wes's sketch)

```
WEST
              God's presence / Most Holy Place

┌──────────────────────────────────────────────┐
│                 COURTYARD                    │
│                                              │
│        ┌──────── TABERNACLE ────────┐        │
│        │                            │        │
│        │  MOST HOLY PLACE           │        │
│        │                            │        │
│        │        [ ARK ]             │        │
│        │                            │        │
│        ├────────── VEIL ────────────┤        │
│        │                            │        │
│ NORTH  │ [ TABLE ]   [ INCENSE ]    │ SOUTH  │
│        │             [ ALTAR ]      │        │
│        │                  [ LAMP ]  │        │
│        │                            │        │
│        └───────── DOOR / SCREEN ────┘        │
│                                              │
│                 [ LAVER ]                    │
│                                              │
│             [ BRONZE ALTAR ]                 │
│                                              │
│              COURTYARD GATE                  │
└──────────────────────────────────────────────┘

                         EAST
                   entrance / approach
```

**Correct drop zones**

| Card | Correct location |
|---|---|
| Ark of the Testimony | Inside the tabernacle, behind/covered by the veil |
| Veil | Separates the ark from the Holy Place |
| Table / Showbread | Holy Place, north side, outside the veil |
| Lampstand / Candlestick | Holy Place, south side, opposite the table |
| Golden Altar of Incense | Holy Place, before the veil |
| Bronze Altar / Altar of Burnt Offering | Outside the tabernacle, by the doors / entrance |
| Laver | Washing station near the approach to the tabernacle/altar |
| Court / Courtyard | Around the tabernacle and altar |
| Courtyard Gate | East entrance to the courtyard |

**Laver caveat (Wes, important)**

> "For strict Septuagint wording, I'd be careful with the laver: Exodus 38 says it was made for washing when Moses, Aaron, and his sons went into the tabernacle or approached the altar; the common 'between the tabernacle and altar' placement is explicit in Exodus 30:18 and in Masoretic-based Exodus 40, but Brenton's LXX Exodus 40 has that verse omitted/moved. So I would include the laver spatially, but not make its exact placement the hardest quiz point unless your OSB wording states it directly."

The shipped question bank already covers this: `ex38-002` ("The bronze laver was made from the mirrors of which women? → The women who served/fasted at the tabernacle entrance") gives us OSB/LXX-anchored wording.

**Three-level structure (Wes's design)**

- **Level 1 — Easy (4 cards):** Ark, Table, Lampstand, Bronze Altar. Tests the four most iconic items.
- **Level 2 — Full Placement (9 cards):** Add Veil, Golden Altar of Incense, Laver, Courtyard, Courtyard Gate.
- **Level 3 — Direction Challenge (sequencing):** Clue: "Approach from the east toward the presence of God in the west." Place in movement order: Gate → Bronze Altar → Laver → Holy Place → Incense Altar → Veil → Ark.

**Teacher key (Wes)**

```
WEST  Ark
      Veil
      Table north — Lampstand south
      Incense altar before veil
      Door/screen
      Laver
      Bronze altar
      Gate
EAST
```

> "The main thing: north/south matters only for the table and lampstand. Most other items are placed by 'inside/outside,' 'before the veil,' or 'by the doors.'"

---

## 2. Scope Check (in-scope chapters only: Ex 1-20, 32-34, 38-40)

Walked each card against the bank scope rule:

| Card | Placement ref | In scope? | Notes |
|---|---|---|---|
| Ark | Ex 25:10-22 / 26:33-34 (build), Ex 40:3,5,21 (placement) | ✅ Placement in scope; build is out | We can quiz placement ("inside, behind veil"), not dimensions (2.5×1.5×1.5 cubits) |
| Veil | Ex 26:31-33 (build), Ex 40:3,21 (placement) | ✅ Placement in scope; build is out | Quiz as "separates ark from Holy Place" |
| Table (north) | Ex 40:22-23 | ✅ Fully in scope | "North side, outside veil" — directly anchored |
| Lampstand (south) | Ex 40:24-25 | ✅ Fully in scope | "South side, opposite the table" — directly anchored |
| Golden Altar | Ex 40:26-27 | ✅ Fully in scope | "Before the veil" — directly anchored |
| Bronze Altar | Ex 38:1-7 / 40:29 | ✅ Fully in scope | Already 5 questions in bank |
| Laver | Ex 38:8 / 40:7,30 | ⚠ Partial | Use Wes's caveat — don't make exact placement the hardest quiz point |
| Court | Ex 38:9-13 / 40:8 | ✅ Fully in scope | "Around the tabernacle and altar" |
| Court Gate | Ex 38:18 / 40:33 | ✅ Fully in scope | East entrance |

**Verdict:** Every Level 2 card has an in-scope placement reference. The build-side references (Ch 25-27, 30, 37) are all OUT of scope, but we only need the placement references.

---

## 3. Why This Format Works (rationale)

- **Spatial > sequential.** Sequencing cards on a number line trains "list" memory; placing them on a 2D map trains "where" memory, which is the actual skill being tested. Matches Wes's stated pedagogy preference.
- **Movement is a memory aid.** Level 3 (approach from east to west) ties the spatial layout to the actual narrative movement of priest/people, which is how Scripture itself organizes it.
- **Reuses existing infra.** Bible-bowl-study already has `memory-labs` infrastructure (drag-and-drop tree of life, drag-lab, ghost-follow + drop highlight). "Place the Holy Things" can be a sibling mini-game reusing `dragLab`/drop-zone patterns.
- **Anchors on shipped OSB wording.** Card text can pull from `ex38-001`..`ex40-009` memory aids for context lines.

---

## 4. Proposed File/Data Structure (sketch — open for review)

**New files**

```
memory-labs-tabernacle.js      # new mini-game module
docs/exodus-tabernacle-placement-research.md   # OSB/LXX cross-reference for card text
scripts/_test-tabernacle-placement.mjs          # playwright regression
```

**Touched files**

```
index.html         # new entry on setup screen ("Place the Holy Things")
memory-labs-data.js # new mini-game data: card list + correct-zone map per level
styles.css         # tabernacle map board + card styling (or piggyback on .labs-card)
```

**Question-bank wiring**

- Does this count for mastery? My recommendation: **no**, at least not initially. It's a spatial reinforcement mini-game, not a recall quiz. Keep mastery driven by the existing MC/fill/true-false bank.
- Could add a "tabernacle mastery" counter to the rewards system later, mirroring the 8 Wonders track. Out of scope for v1.

---

## 5. Open Questions for Reviewers

1. **Map board source:** Should the map board be (a) hand-drawn canvas (matches rewards-scenes style), (b) HTML/CSS grid with snap zones, or (c) an SVG file shipped in `assets/`? The existing drag-lab is (b); rewards scenes are (a).

2. **Drop-zone precision:** For "Table = north side," is a single drop zone enough, or should it accept "Holy Place" generically (with partial credit)? My lean: single correct zone per card, but Level 1/2 give visual hints after first wrong drop.

3. **Level 3 sequencing input:** Should the student (a) place cards in order on a single map (one row of drop zones, in movement sequence), or (b) place all cards freely and the game checks their final order matches the canonical sequence? (b) feels cleaner — same UI as Levels 1-2, just with a different success criterion.

4. **Laver placement:** Per Wes's caveat, where exactly should the laver drop zone be? Options: (a) "between tabernacle and bronze altar" (Masoretic, matches Ex 40:30 wording but Brenton's LXX omits that verse), (b) "near the entrance / by the bronze altar" (loose, OSB-safe), (c) don't include laver in Level 2's hardest quiz point at all.

5. **Card text source:** Pull verbatim from the existing 21 Ch 38-40 memory aids? Re-write using OSB-only phrases? Re-write to match Septuagint where it diverges from Hebrew? The bank uses OSB/Septuagint phrasing — match that.

6. **Discovery vs. setting:** Add as a new tile on the setup screen, or surface as a sub-mode of an existing mini-game? My lean: new tile — it's its own thing, distinct from the "tree of life" drag lab.

---

## 6. Out of Scope for v1

- Mastery/score integration with rewards system
- A second tabernacle question bank for non-placement facts (the dimension coverage check earlier showed Ch 38-40 dimensions are already covered by ex38-003/004)
- A print/PDF version of the map board for offline study
- Sound effects (the bank already has `BibleBowlPlaySound` calls in places)

---

## 7. Risks / Pitfalls

- **Brenton LXX vs Masoretic divergence** on the laver. Wes already flagged this. Don't make it the hardest quiz point.
- **Mobile drag UX** — the existing drag-lab uses touch events; need to verify tabernacle map works on 390×844 viewport (iPhone 12-ish).
- **PWA persistence** — does mini-game progress need to persist across reloads? My lean: no for v1 (it's a quick practice round, not high-stakes).

---

## 8. Success Criteria

- New "Place the Holy Things" tile appears on setup screen
- Level 1 (4 cards) completable in <30 seconds by someone who knows the layout
- Level 2 (9 cards) completable in <90 seconds
- Level 3 (sequencing) completable in <60 seconds with hint
- Reuses existing drag-lab patterns; no new external dependencies
- Regression test covers Levels 1, 2, 3 placement + wrong-drop feedback
- Stays strictly in Ex 38-40 placement references (Ch 25-27, 30, 37 never cited)
- Existing test suite (`npm run test:wonders-mobile`, `npm run test:labs`) still green