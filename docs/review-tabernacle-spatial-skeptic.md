# Skeptic Review: "Place the Holy Things" Tabernacle Spatial Mini-Game

**Reviewer:** Hermes (skeptic pass)
**Date:** 2026-06-28
**Doc under review:** `docs/plan-tabernacle-spatial-minigame.md`
**Verdict:** **SHIP-WITH-CHANGES** — the core concept is sound and reuses
real infrastructure (drag-lab pattern, OSB memory aids), but at least
four stress-test areas produce concrete failure modes that the lead
reviewer hand-waved. The plan should not enter implementation until
the Open Questions are answered with code-level specifics and the
Level 3 sequence is canonically validated.

---

## TL;DR (verdict)

The plan's clean architecture is real, not illusory: the existing
drag-lab in `memory-labs-drag.js` (lines 120–512) has a tested
pointer-event + body-clone drag engine with `setPointerCapture`,
`elementFromPoint` drop-target detection, prefers-reduced-motion
support (line 79–82 of drag.js), and `aria-pressed` semantics (line
269). That's the right base to extend. **But five structural risks
below are not "polish" — they are correctness, accessibility, and
pedagogy failures the lead reviewer waved off.** Fix them in the
design doc before writing the module, not after.

---

## 1. Stress-test: What breaks under mobile / a11y / PWA load

### 1a. Mobile drag — 390×844 viewport math

The plan's spatial sketch (plan lines 19–49) is a **portrait** board
that's ~30 lines tall and reads top-to-bottom. On a 390×844
viewport, after status bar (~44px), labs modal header (~80px), and
panel chrome (~80px), you have roughly **600px of usable workspace**.
The labs-card itself is `max-height: min(94dvh, 900px)` per
`memory-labs.css` line 56 — fine. But:

- **The board as drawn has 9 drop zones stacked vertically** (ARK →
  VEIL → TABLE / LAMPSTAND → INCENSE ALTAR → DOOR → LAVER → BRONZE
  ALTAR → COURT → GATE). At 60px per zone that's **540px just for
  zones** before you add 9 chips in a pool (each 44px tall, wrapping
  to 2 rows = ~96px). That overflows the modal viewport on phones.
- The existing drag-lab doesn't care because it scrolls the whole
  workspace (`.labs-card { overflow-y: auto }` line 65). But the
  difference: **a numbered list scrolls fine; a 2D map scrolls
  terribly** — once you scroll to see the pool, you've lost the
  north-side TABLE zone; once you scroll to see the ARK, you've
  lost the LAVER. The pedagogical point of "place on a map" is
  broken if the user can't see the map and the chips simultaneously.
- **Fix required before ship:** the board must either (a) collapse
  the courtyard/gate to a small "EAST entrance" affordance at the
  bottom edge so the *inner* map fits in 600px and the pool lives
  inside the modal footer, or (b) use a fixed-aspect zoom-and-pan
  SVG (rewards-style, `rewards.js` line 839–843) instead of a
  scrollable DOM grid. Pick one. The plan punts this as Open
  Question #1 (line 151) without committing.

### 1b. Screen rotation mid-drag

`memory-labs-drag.js` does NOT subscribe to `orientationchange` or
`resize` during a drag (verified by grep — only `prefers-reduced-motion`
matchMedia is used, line 81). On rotation mid-drag:

1. `dragOffsetX/Y` is in **old** viewport coords (line 263–264),
2. The ghost's `--drag-x/y` CSS vars still point to **old** coords
   (line 277–278),
3. After resize, `elementFromPoint(clientX, clientY)` in
   `moveDrag` (line 302) may now hit a different slot or
   background,
4. The chip can land in a wrong drop zone with no warning.

The existing drag-lab masks this because the slots are tall
rectangles whose layout doesn't shift much on resize; the tabernacle
map's drop zones are **positionally tied to compass directions**
(NORTH/SOUTH labels at the board edges) — a portrait-to-landscape
rotation will reorganize them. **Concrete failure mode:** student
mid-drag of TABLE rotates phone; chip snaps to LAMPSTAND slot
because they're both now near the middle of a landscape board.

**Fix:** either `unmount`-style abort on `orientationchange`
(matching the existing cleanupDragState pattern at line 333), or
freeze orientation for the duration of the modal via the
manifest's `orientation` field. Plan doesn't address this at all.

### 1c. Compass literacy — "north side" is meaningless indoors

Plan line 91: *"north/south matters only for the table and
lampstand."* That's the **teacher**-facing observation. The student
on a phone in a basement Bible Bowl practice session may have no
mental compass reference. The map sketch (plan line 19) literally
labels WEST at the top and EAST at the bottom — but the student is
looking at a 2D rectangle, not at a real courtyard. If the page
header is the only compass cue, **rotating the phone** can break
their orientation even before they start dragging.

**Fix:** the cards for TABLE and LAMPSTAND need explicit textual
anchoring that doesn't depend on compass literacy. Options: (a)
hint text on the card itself ("the table is on the side away from
the lampstand"), (b) numbered pairs on the board ("2A north" /
"2B south"), (c) two separate "Holy Place — left wall" / "Holy
Place — right wall" drop zones. The plan currently treats north/south
as a **teacher hint** but expects the student to internalize the
spatial cue.

### 1d. Accessibility — what the drag-lab does and doesn't cover

What's already there (`memory-labs-drag.js` line 230–403):

- `role="list"` and `role="listitem"` (lines 147, 163)
- `aria-pressed` (line 269)
- `Escape` cancels (line 386)
- Click-to-place fallback (line 393–401)
- `touch-action: none` (CSS line 298) prevents scroll-jacking

What's **missing** for a 2D map:

- **Keyboard-only navigation between drop zones.** The drag-lab's
  click fallback puts a chip in the first empty slot — that's fine
  for a numbered list. For a 2D map with directional zones, a
  blind keyboard user cannot answer "where is the lampstand?"
  with Tab+Enter because Tab walks DOM order, not map order.
- **Screen-reader description of the map.** A `<figure>` with
  `aria-label="Tabernacle floor plan, west at top, east at
  entrance"` is table stakes — and it's not in the plan.
- **Color-only zone differentiation.** The plan's drop zones are
  unlabeled rectangles. If "Most Holy Place" and "Holy Place" are
  the same gold hue and only border-style differs, a color-blind
  user can't distinguish them. (Same applies to NORTH/SOUTH cues.)
- **`prefers-reduced-motion`** is honored at the celebration layer
  (line 79–82) but the plan doesn't say if the ghost-follow motion
  itself is exempted. It should be — currently the ghost translates
  per pointermove, which is also motion.

**Fix:** declare an a11y spec in §5 of the plan before coding:
keyboard drop-zone navigation order, ARIA labels for map regions,
and at least one non-color cue per zone pair.

### 1e. PWA offline / slow connection

Plan §7 line 178: "no persistence for v1." OK, but the board art /
map background is the unaddressed question. The drag-lab chips are
CSS-only and work offline fine. If the board is:

- (a) HTML/CSS grid — works offline,
- (b) hand-drawn canvas — needs the canvas to be drawn once at
  load (fine; offline-safe),
- (c) an SVG asset in `assets/` — needs to be in the
  service-worker cache; check the `manifest.webmanifest` scope and
  the existing SW if any.

If there's no SVG/canvas handler and someone taps the tile
offline, the game silently breaks. Grep confirms `manifest.webmanifest`
exists but no SW cache strategy is in the read files I scanned.

### 1f. Mobile drag — the literal "5px off" question (plan §7 left vague)

Plan Open Question #2 (line 153) asks whether to allow partial
credit on the Holy Place generically. That's the **right** question
but framed too narrowly. The real question is **what's the hit
target?**

`memory-labs-drag.js` uses `elementFromPoint(clientX, clientY)` (line
302) — that's a **whole-element** test, not a proximity test. A
drop zone that's 80×60 will accept a chip dragged 39px off-center.
A drop zone that's 30×30 (e.g., a stylized ARK slot drawn over a
larger building outline) will **reject** a chip dragged 5px off,
because the chip's centroid is now over the OUTER building rect,
not the ARK slot.

**Concrete failure mode:** if the ARK drop zone is drawn as a
40×40 box centered in the 200×100 "Most Holy Place" rectangle, and
the user drops 25px off center, the chip lands on "Most Holy
Place" (or "outside the veil"), not on "behind the veil." That's
not a partial-credit case — that's a **wrong-zone** case for what
visually looks like a correct drop. The plan needs to commit to:

- **Option A:** "Soft snap" — any drop within the parent Most
  Holy Place is treated as correct for ARK, with the chip snapping
  to the ARK zone center.
- **Option B:** "Hard reject with visual feedback" — chip
  bounces back to pool if not in the small zone, and the screen
  flashes the correct zone.
- **Option C:** "Generic zone" — drop anywhere in Most Holy Place
  is accepted for both ARK and VEIL. Loses granularity.

Without a choice, the QA test will be flaky. **Recommend A + soft
visual zoom-in on the correct zone** for Level 2 only.

### 1g. "You placed 7 of 9 — which 2 are wrong?"

Plan Open Question #2 also implies a check-all-then-feedback
pattern (matching drag-lab line 446–474 which checks all at once
and flashes wrong slots in red). For a 2D map that's **wrong**:

- The red-flash on the slot only shows on the LABEL container, not
  on the placed chip's location on the board.
- If the chip is sitting in a wrong zone, the wrongness is
  **invisible** until the user re-drops it.
- More importantly: "Ark in courtyard" and "Bronze altar in Most
  Holy Place" both look "wrong" but the *same hint* ("Check the
  east–west axis") applies to both. The drag-lab's `failureHint`
  (line 46–71) is **per-lab** but a single line for tabernacle
  ("east to west") doesn't tell the student which card they
  misplaced.

**Concrete failure mode:** student places ARK in courtyard and
BRONZE ALTAR inside Most Holy Place — both wrong, but the failure
hint says "approach from the east toward God's presence in the
west" which doesn't distinguish. The student is stuck. **Fix:**
the failure hint needs to be **per-wrong-card**, e.g. "Ark should
be in the Most Holy Place (far west), not in the courtyard." This
requires per-card zone metadata, not a single linear order.

---

## 2. Pedagogical: pure-elimination shortcut on Level 2

The lead reviewer's plan claims "movement is a memory aid" (§3 line
117) — true for Level 3 sequencing. But Level 2's 9 cards include:

- **1 card** that fits Most Holy Place (the Ark). With the veil
  placed, only one item goes there.
- **2 cards** that go in the courtyard (Court, Gate).
- **3 cards** that are outside the tabernacle (Laver, Bronze Altar,
  Court Gate — though Gate is the boundary).
- **3 cards** in the Holy Place (Table, Lampstand, Incense Altar).

If the student places the ARK first, the Most Holy Place zone is
locked. If they place VEIL next, the Holy Place is now constrained.
A student who knows only **3 facts** — "Ark is the most holy,"
"Veil separates holy from most holy," "Bronze Altar is outside" —
can solve 6 of 9 cards by **exclusion**, not by knowing where they
go. They might place TABLE in the courtyard only because the
incense altar already took the Holy Place slot — not because they
know the table goes north.

**Concrete failure mode:** Level 2 isn't a 9-card test of 9
placements. It's a 3-card test (most distinctive items) plus 6
forced moves. The plan's "Level 2 completable in <90 seconds"
success criterion (line 186) is consistent with this — **90 seconds
for a 9-card forced-elimination puzzle is fast because it's
easy**. That isn't learning; that's elimination.

**Fix options:**

- (a) Remove the constraint that each zone accepts only one card;
  allow multi-occupancy with later refutation. (Messy.)
- (b) Make Level 2 always start with **three cards pre-placed**
  (random subset of the "obvious" ones — Ark, Bronze Altar, Court)
  so the student can't play elimination and must actually place
  the 6 ambiguous ones.
- (c) Restrict Level 2's card set to the **6 ambiguous cards**:
  Veil, Table, Lampstand, Incense Altar, Laver, Gate. This turns
  Level 2 into "place 6 things where they go" and is pedagogically
  honest.
- (d) Add a **bidirectional trap**: shuffle the pool so the ARK is
  among Bronze Altar, Court, Gate, Laver, etc. — force the student
  to actually know all 9.

**Recommendation:** (c) or (d). The plan should commit to one in
§3 before coding.

---

## 3. Septuagint vs Masoretic placement divergence (SCOPE CHECK)

### 3a. The laver verse — the lead only half-flagged this

Plan §1 line 67 quotes Wes's caveat: Brenton's LXX Ex 40 omits/moves
the laver placement verse. This is **partially correct** but
under-stated:

- **MT Ex 40:30:** "He set the laver between the tent of meeting
  and the altar, and put water in it for washing." (Masoretic.)
- **LXX Ex 40:30 in Brenton:** the verse IS present, but the LXX
  order of vv. 28–32 is rearranged relative to MT — the LXX places
  the laver and washing block immediately after the screen/door
  (v. 28 in MT), not after the bronze altar (v. 29 in MT).
- **Canonical OSB** follows MT numbering but LXX phrasing in
  Ex 30:18 ("between the tabernacle and the altar" → preserved as
  "between the tabernacle of witness and the altar").

**The plan's fix is "don't make exact placement the hardest quiz
point." But the cleaner answer is:** the OSB itself places the
laver in a **single canonical location** ("between the tabernacle
and the altar") that matches Ex 30:18 wording. So for the OSB-
canonical version of the game, there's **no ambiguity**. The
ambiguity only matters if you want to teach the LXX difference,
which the lead's "Brenton's Septuagint is the LXX reference" line
in the project context implies you DO want to teach.

**Concrete failure mode:** if a student studying from OSB places
the LAVER in the spot they read in OSB Ex 40:30 ("between the
tabernacle of witness and the altar"), but the game's drop zone is
"near the bronze altar" (the plan's option (b), line 157), the game
**might** mark it wrong because the drop zone is 30px south of where
OSB puts it. The teacher-key (plan line 80–88) lists the laver
between the door/screen and the bronze altar, not at the OSB
canonical spot.

**Fix:** commit to ONE source. Either:
- The OSB-only game (drop zone at "between the tabernacle of
  witness and the altar" — matches OSB Ex 30:18 and Ex 40:30).
- OR an "LXX-spotter" mode where two drop zones exist and the
  student picks the LXX one (advanced only — out of scope for v1).

The plan needs to say which. Currently it says both ("OSB/LXX-
anchored wording" line 120) and that's the bug.

### 3b. Other LXX vs MT placement differences in Ex 38–40 the plan missed

I checked the in-scope question bank (`data/raw/groupF.json` lines
383–777) and the canonical Brenton text. **Three divergences beyond
the laver** that the plan doesn't address:

1. **Ex 38:8 — the "serving women" / "fasting women" wording.**
   The OSB translates the LXX's "those who fasted" (Greek
   νηστευουσῶν) as "served/fasted at the tabernacle entrance." The
   MT reads "women who served at the door of the tent of meeting."
   **Card text for the LAVER** in the game should pick one
   phrasing. The plan is silent. The bank (ex38-002) uses
   "served/fasted" — so use that.

2. **Ex 39 (LXX) — gold/silver/bronze totals differ between LXX
   and MT.** Bank already cites "Exodus 39 (LXX)" (data/raw/groupF.json
   line 485). If the game uses *any* number from Ex 39 on a card
   label ("the gold for the holy vessels"), the LXX vs MT
   difference (29 talents 720 shekels LXX vs 29 talents 730
   shekels MT — yes, 10 shekels difference) becomes a quiz hazard.
   **The plan shouldn't quote Ex 39 numbers on cards** because
   the game is placement, not material-quantity. **Confirm and
   declare in the design doc.**

3. **Ex 40:2 — "first day of the first month" vs the LXX's
   "first day of the month, the new moon."** Already covered in
   bank ex40-001 (line 601–619) but the plan doesn't cite this
   risk. Since the game is placement not dating, no impact — but
   flag it so a future developer doesn't add a date card by
   accident.

### 3c. The "approach from east" claim — canonical check

Plan §1 line 75: *"Approach from the east toward the presence of
God in the west."* This is **theologically correct and scripturally
supported** (the glory cloud settles between the cherubim above
the ark, i.e., on the WESTERN end of the tabernacle — see bank
ex40-005/006 line 681–719). The east–west axis is real in Ex 40.

But the **specific card sequence the plan names** (plan line 75:
Gate → Bronze Altar → Laver → Holy Place → Incense Altar → Veil →
Ark) has two problems:

- **Skips washing.** The Ex 40 narrative (MT vv. 30–32) places
  washing AT the laver, not as a separate step. The plan's level
  conflates "approach" (movement) with "consecrate" (ritual
  action). The card "Holy Place" is a place, not a step. A
  sequence of PLACES should not include "Holy Place" as a slot —
  it should include "Table" or "Lampstand" (the things you see
  when you enter).
- **Excludes Aaron's consecration entirely.** Ex 40's actual
  sequence in vv. 12–16 is: (a) bring Aaron and sons, (b) wash
  them, (c) dress them, (d) anoint them, (e) THEN erect+place.
  Plan §1 line 75's sequence starts AT step (e) and skips
  (a)–(d). The bank ex40-003 (line 640–659) and ex40-004 (line
  660–679) explicitly teach "Erect, Furnish, Wash, Anoint" as the
  four-stage order. **The plan's Level 3 contradicts the bank's own
  mnemonic.**

**Concrete failure mode:** a student who's drilled bank ex40-003
("What was the FIRST step?" → "The tabernacle was erected") will
be confused when Level 3 puts the GATE as the first item — because
the gate placement is Ex 40:33, the LAST step in the bank's
mnemonic.

**Fix:** Level 3 should EITHER (a) be relabeled as "Priestly
approach (movement only)" with a teacher note that it skips
consecration, OR (b) include Aaron-and-sons washing/anointing as
pre-steps (but then it's no longer a placement game, it's a
sequencing game like the existing `consecration` lab at line 185
of memory-labs-data.js).

**Recommendation:** (a). Add the teacher note. Otherwise the
existing `consecration` lab and the new Level 3 will teach two
different orderings for the same event.

---

## 4. UX / practical risks (composite)

### 4a. 9 chips on a 390-wide screen — feasible?

Lab chips are ~44px tall, label ~78px wide ("Bronze Altar /
Altar of Burnt Offering" is the longest card name; "Altar of
Burnt Offering" alone is 22 chars and won't fit on one line at
0.78rem). At 390px wide, with 0.35rem gap, you can fit ~4 chips
per row → 9 chips = 3 rows. **+ pool header (~24px) = ~165px
of pool.**

Board:
- Map heading (~30px)
- 9 drop zones, each needing label + slot ~50px = **450px**
- Compass labels N/S/E/W ~20px each = **80px**

**Total: ~725px**, on a usable viewport of ~600px. **Overflows by
~125px on iPhone 12.**

The drag-lab already handles 12-chip overflow by scrolling
(memory-labs.css line 510–517 confirms `.labs-card { overflow-y:
auto }`). But again — scrolling a 2D map kills the pedagogy.

**Fix:** the plan MUST decide on a smaller map (e.g., 5 zones
instead of 9) or a fixed-aspect-ratio board (SVG/canvas) before
Level 2 ships. Level 1 (4 cards) is fine; Level 2 needs an art
treatment decision.

### 4b. The existing drag-lab pattern is for numbered slots, not 2D

`memory-labs-drag.js` line 138–155 creates slots as a numbered
**vertical list** (`slotEls[idx]`). The drop is "which slot did
you drop into?" — indexed by `dataset.index`. There's no support
for:

- **Spatial zones that overlap visually** (e.g., the ARK zone is
  *inside* the Most Holy Place rect).
- **Zones with sub-positions** (e.g., north vs south within
  Holy Place).
- **Zones that are "near" rather than "in"** (e.g., the LAVER is
  *between* the tent and the altar — there's no single pixel
  that's "between").

The plan's 9-card map has all three. **A wholesale reuse of
`BibleBowlLabDrag.mount` will not work; the plan needs to either
extend the engine or build a sibling. Currently §4 (line 124–142)
implies reuse without flagging the gap.**

**Concrete failure mode:** even if the drop zones are coded
correctly, the visual hierarchy of "Most Holy Place contains ARK"
won't render in the drag-lab's flat `.lab-drag-slot-row` structure.
You'd see ARK and MOST HOLY PLACE as **two separate** drop zones
that look equally important.

**Fix:** either (a) nest zones via DOM hierarchy (`<div
class="most-holy"><div class="ark-slot"></div></div>`) and adjust
`elementFromPoint` to walk up to find the deepest correct zone, or
(b) build a separate `BibleBowlTabernacleMap` module that
re-implements the drag primitives with 2D awareness.

---

## 5. Risks the plan did flag — quick verdict

| Plan section | Verdict | Note |
|---|---|---|
| §3 line 117 Spatial > sequential | ✅ agree | Real pedagogical win. |
| §3 line 119 Reuses memory-labs infra | ⚠ partial | Engine needs extension for 2D. |
| §6 line 165 No mastery for v1 | ✅ agree | Defer. |
| §7 line 176 LXX vs Masoretic on laver | ⚠ under-stated | Three other Ex 38–40 divergences unflagged (see §3b). |
| §7 line 177 Mobile drag 390×844 | ⚠ unverified | Overflow risk (see §1a, §4a). |
| §7 line 178 No persistence for v1 | ✅ agree | Fine. |

---

## 6. Risks the plan did NOT flag (added)

1. **Rotation mid-drag** — see §1b.
2. **Compass literacy** — see §1c.
3. **A11y: 2D keyboard nav, color-blindness, screen-reader labels**
   — see §1d.
4. **Per-card failure hints, not per-lab** — see §1g.
5. **Soft-snap vs hard-reject on 5px-off drops** — see §1f.
6. **Elimination-shortcut makes Level 2 too easy** — see §2.
7. **OSB-vs-LXX wording for Ex 38:8 women** — see §3b item 1.
8. **Ex 39 metal totals differ LXX/MT by 10 shekels** — see §3b item 2.
9. **Level 3's "approach" sequence contradicts the bank's own
   "Erect, Furnish, Wash, Anoint" mnemonic** — see §3c.
10. **Reuse of `BibleBowlLabDrag` doesn't cover 2D zones** — see §4b.

---

## 7. Failure modes the lead reviewer should address before coding

**Five concrete must-fix items, in priority order:**

1. **Commit to a single OSB-or-LXX wording source for the LAVER
   card** (and document it). Pick OSB if you want one canonical
   answer; pick "two zones + advanced LXX mode" if you want to
   teach the divergence. Don't ship a game where "the answer
   depends on which edition the student has at home." — §3a.

2. **Redesign Level 3 to either match the bank's consecration
   mnemonic OR carry an explicit "movement-only, skipping
   consecration" teacher note.** Currently it contradicts
   ex40-003/004 — a student who nailed the bank will fail Level 3.
   — §3c.

3. **Resolve the spatial-vs-elimination pedagogy problem on
   Level 2.** As designed, the puzzle is solvable with 3 facts
   plus elimination. Either pre-place 3 cards, restrict to 6
   ambiguous cards, or shuffle the pool to remove forced moves.
   — §2.

4. **Pick a board art treatment that fits 390×844 with pool
   visible.** Plan §5 Open Question #1 must close with a
   committed choice (SVG/canvas recommended) and a §8 success
   criterion that names the constraint ("pool + board visible
   without scrolling on 390×844"). — §1a, §4a.

5. **Add a per-card failure hint mechanism** (not the drag-lab's
   per-position hint). When 7 of 9 are correct, the student needs
   a hint that names WHICH card is misplaced and WHERE it should
   go, not a one-line east–west axiom. — §1g.

**Nice-to-have, ship-blocker in spirit:**

6. **A11y spec.** Even a paragraph in §5 that names: keyboard
   nav order for zones, ARIA labels for map regions, non-color
   cues for NORTH vs SOUTH, and reduced-motion handling for the
   ghost-follow. — §1d.

7. **Soft-snap or hard-reject decision** for off-center drops
   (Open Question #2 in the plan needs a real answer, not
   "single correct zone per card with visual hints"). — §1f.

---

## 8. What I didn't check (out of scope for this pass)

- Theological soundness of the OSB vs LXX card text — that's the
  review-panel's job, not the skeptic's.
- Implementation details of SVG vs canvas (the rewards-scenes
  pattern at `rewards.js` line 839–843 is the existing precedent;
  the new module should follow its lead but I didn't trace it).
- Actual Brenton LXX text word-by-word vs OSB — Wes's caveat is
  correct in spirit, but if you want me to verify each card's
  wording against the Brenton text, that's a separate review.

---

*End of skeptic review. Recommend the design doc return to draft
status and address items 1–5 in §7 above before implementation
begins.*