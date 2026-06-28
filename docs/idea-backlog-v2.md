# Idea Backlog — Memory Lab v2 features

Brainstormed 2026-06-28 using local Ollama models (deepseek-r1:14b,
gemma4:26b-mlx, gemma4:12b) and the existing 6-lab pattern as context.
Strict chapter scope: Ex 1-20, 32-34, 38-40 only.

## Top 8 candidate ideas (prioritized by interaction novelty)

Each idea proposes a **NEW interaction type** beyond the existing
drag-order (plagues, tribes, commandments, consecration), tree-place
(priest_line), and 2D spatial placement (tabernacle_place).

### 1. Holy Furnishings — silhouette match
- **Ref:** Exodus 38-40 (already covered by ex38-001..ex40-009)
- **Mechanic:** Display a silhouette (no labels), 4 options to pick the
  correct name. Tests visual recognition of the Ark, Bronze Altar,
  Golden Altar, Laver, Lampstand, Table from outline shape alone.
- **OSB anchor:** "He made the ark of shittim wood" (Ex 37:1-9 LXX) for
  Ark outline; "a horn on each of its four corners" for Bronze Altar.
- **Interaction type:** Multiple-choice with imagery instead of text.
- **Reuses:** Question bank schema (multiple-choice with `options`).

### 2. Fiery Calling — zoom-in on the burning bush
- **Ref:** Exodus 3:1-6
- **Mechanic:** Zoom into the desert scene. Identify the bush as the
  burning bush (vs. a regular shrub) by visual cues (flames, glow).
  Then tap to remove sandals.
- **OSB anchor:** "the bush was burning with fire, but the bush was
  not consumed" (Ex 3:2).
- **Interaction type:** Zoom-in + identification tap.
- **Why it teaches:** Visual attention to "burning but not consumed"
  reinforces the theophanic nature of the encounter.

### 3. Broken Covenant — fade-to-reveal of the Golden Calf
- **Ref:** Exodus 32:1-20, 32:24
- **Mechanic:** Black-fade reveal of the calf being formed (earrings →
  molten gold → calf shape → golden calf). At each stage, pick the
  correct material or action. Tests recall of the sequence and OSB's
  "these are your gods, O Israel, which brought you up out of Egypt."
- **OSB anchor:** Ex 32:24 (the calf from gold earrings) + Ex 32:19
  (Moses breaks the tablets).
- **Interaction type:** Sequential reveal + identification.

### 4. Plague Strike — target tap
- **Ref:** Exodus 7:14-12:32 (in-scope, already covered)
- **Mechanic:** A scene shows Egypt (Nile, crops, livestock, sky,
  darkness). Tap the affected element for each plague in order. This
  tests **spatial** understanding of WHERE each plague struck, not just
  WHEN. Different from drag-order (which tests sequence).
- **OSB anchor:** "All the water of the river was changed to blood"
  (Ex 7:20).
- **Interaction type:** Target-tap with visual feedback.

### 5. Manna Catch — timing tap
- **Ref:** Exodus 16:14-21, 16:22-30 (sabbath double portion)
- **Mechanic:** A canvas with manna falling. Tap to gather one omer per
  day. Day 6 requires double-tap (two omers). Day 7 shows no manna
  (sabbath rest). Tests the daily portion rhythm + sabbath exception.
- **OSB anchor:** "an omer for each person" (Ex 16:16) + "on the
  sixth day they shall prepare what they bring in" (Ex 16:5).
- **Interaction type:** Rhythm/timing tap.

### 6. Glory Reveal — lens exploration
- **Ref:** Exodus 40:34-35 (already covered by ex40-005/006)
- **Mechanic:** Start with a dark canvas. Drag a "light source" around
  to reveal the tabernacle beneath. Once Moses enters, the cloud
  settles and the canvas goes dark again ("Moses was not able to
  enter"). Tests visual recall of the glory-cloud scene.
- **OSB anchor:** "The glory of the Lord filled the tabernacle" (Ex
  40:35) + "Moses was not able to enter into the tabernacle of
  witness" (Ex 40:35).
- **Interaction type:** Drag-to-reveal (light/darkness mechanic).

### 7. Stone Carving — path tracing
- **Ref:** Exodus 20:1-17 (commandments), Exodus 34:1 (new tablets)
- **Mechanic:** Display a blank stone tablet. Trace the path of
  "God's finger" carving each commandment in order. Each correct
  trace fades in the commandment text; wrong trace rewinds.
- **OSB anchor:** "Written with the finger of God" (Ex 31:18) +
  "the latter first" hint from Ex 20:1 (God spoke all these words).
- **Interaction type:** Path tracing.

### 8. Sea Split — swipe mechanic
- **Ref:** Exodus 14:21-22 (already covered by ex14-001/002)
- **Mechanic:** Swipe horizontally across a wave-pattern canvas. On the
  correct swipe (south wind), the water parts revealing dry land. Wrong
  swipes flood back. Tests the "strong south wind" (LXX vs MT east
  wind) detail from memory aid `ex14-003/004`.
- **OSB anchor:** "the Lord drove back the sea with a strong south
  wind" (Ex 14:21, LXX).
- **Interaction type:** Swipe gesture.

## Constraints (all ideas must satisfy)

- ✅ Strict chapter scope: Ex 1-20, 32-34, 38-40
- ✅ No out-of-scope content (no Lev, Num, Deut; no Ch 21-31, 35-37)
- ✅ New interaction type (not drag-order, not tree-place, not 2D
  placement)
- ✅ OSB-canonical wording (no Brenton LXX-only phrasings)
- ✅ Reuses existing infrastructure (Pointer events, CSS, modal,
  mastery tracking) — no new external dependencies

## Risk: a11y for gesture-only interactions

Several of these (Sea Split swipe, Manna Catch timing, Stone Carving
path) are gesture-only. Need keyboard/touch fallbacks:
- Sea Split: keyboard arrow keys instead of swipe
- Manna Catch: tap/Enter instead of timing-based catch
- Stone Carving: choose from numbered options instead of free-path trace

## Risk: visual asset cost

Several of these need original artwork or SVG (silhouettes of tabernacle
items, Egypt map for plagues, falling manna). Cost: designer time +
asset pipeline. Mitigation: ship placeholder SVG first; revisit visuals
in v2.1.

## Recommendation

Build in this order:
1. **Holy Furnishings** (silhouette match) — pure data-driven, no new
   artwork (use CSS clip-path on emoji icons)
2. **Plague Strike** (target tap) — reuses existing Egypt scene code
3. **Glory Reveal** (drag-to-reveal) — reuses tabernacle render from
   the rewards scene
4. **Manna Catch** — needs timing logic + new visual

Each takes ~half-day to build, ~half-day to test.

Each needs:
- 1 module file (e.g., `memory-labs-furnishings.js`)
- Data shape in `memory-labs-data.js`
- CSS additions
- Test in `scripts/`
- Wiring in `memory-labs.js` orchestrator