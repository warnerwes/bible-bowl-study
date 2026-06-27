# Bible Bowl Study — Changelog

Track release-relevant changes for agents and maintainers. The live site deploys from `main` via GitHub Pages (`.github/workflows/deploy.yml`).

**Live:** https://warnerwes.github.io/bible-bowl-study/

---

## 2026-06-26 — Memory Labs + wonder polish (commit `f6fe77a`)

### Memory Labs (new second shelf)

Five interactive **Memory Labs** below **Wonders of the Exodus** on the home page. These teach ordered Scripture structure (not narrative re-enactment).

| Lab ID | Label | Interaction | Unlock gate |
|--------|-------|-------------|-------------|
| `plagues` | Ten Plagues | Drag-order (10 cards) | 8 masteries in ch. 7–12 |
| `tribes` | Twelve Tribes | Drag-order, **birth order** | 5 masteries in ch. 1, 2, 6 |
| `commandments` | Ten Commandments | Drag-order, **Orthodox numbering** | 7 masteries in ch. 19–20 |
| `priest_line` | Line of the Priesthood | Tree placement (15 nodes) | 6 masteries in ch. 2, 4, 6, 18, 28 |
| `consecration` | Holy Consecration | Drag-order (9-step Exodus 29) | 10 masteries in ch. 25–40 |

**New files**

- `memory-labs.js` — shelf, modal, chapter-mastery unlock, completion tracking
- `memory-labs-data.js` — runtime lab definitions (mirrors `data/memory-labs.yaml`)
- `memory-labs-drag.js` — shared drag-order engine with per-lab failure hints
- `memory-labs-tree.js` — priest family tree engine
- `memory-labs.css` — shelf + modal + drag/tree UI
- `data/memory-labs.yaml` — canonical research/spec data
- `docs/exodus-memory-labs-deep-research-brief.md` — integration brief
- `scripts/test-memory-labs.mjs` — Playwright QA (mobile + desktop)

**localStorage keys**

- `bbs:labs-completed:v1` — lab IDs finished successfully
- `bbs:labs-seen-unlock:v1` — lab IDs whose unlock teaching was shown

**QA:** `npm run test:labs` (10 checks) · `npm run test:rewards` (26 checks = wonders + labs)

### Wonder gameplay polish

| Wonder | Change |
|--------|--------|
| **Manna** | Jar counts full at **95%** (`MANNA_JAR_FULL`); replaced `pendingJar` with `jarsCarried` so day 6 fills two jars back-to-back before tent (optional mid-tent deposit); worms only when scooping after quota met |
| **Elim** | Progress counts **springs only**; “70 palm trees…” moved to scenic footer (not a counter) |
| **Rephidim** | Staff drawn as one connected crook stroke |
| **Sinai** | Boundary ring split: **behind** mountain (left) → mountain → **front** (right); lightning on top |

**Cache bust (index.html):** `rewards-scenes-1.js?v=16`, `rewards-scenes-2.js?v=14`, `rewards.js?v=18`, `memory-labs-*.js?v=1`

---

## 2026-06 — Orthodox catechesis pass (commits `d6d1a47` … `91e2a06`)

### Wonders of the Exodus (8 canvas mini-games)

Full rewrite of copy (`rewards.js` `WONDERS[]`) and scenes for OSB/LXX-aligned catechesis:

1. Red Sea — parting + crossing phases  
2. Marah — cast tree into bitter water  
3. Elim — find 12 springs, camp  
4. Manna — quail → dew → gather → day 6 double → Sabbath  
5. Rephidim — strike rock once  
6. Sinai — boundary stones, stand back, trumpet  
7. Golden Calf — burn, grind, scatter  
8. Glory — witness outside; Moses cannot enter  

**Supporting work**

- `scripts/test-wonders-mobile.mjs` — 8 wonders × 2 viewports  
- `docs/exodus-wonders-deep-research-brief.md` — research + file map  
- Sinai boundary markers snap to ring; safe camp zone below mountain  

**Prior manna fixes (`c0295bf`, `75d9d97`):** mobile jar reach; day 6 second jar same flakes (no respawn after first tent deposit).

---

## Still open before “publication” pass

- [ ] Human **printed OSB** wording review for all in-app quotes and lab labels  
- [ ] Wonders P1 gaps (see `docs/exodus-wonders-deep-research-brief.md`)  
- [ ] Memory Labs P1 polish (mother tags, Dog-flies subtitle, two-table visual on commandments)  

---

## Repository layout (rewards + labs)

```
index.html
app.js / styles.css
rewards.js / rewards.css
rewards-scenes-1.js    # red_sea, marah, elim, manna
rewards-scenes-2.js    # rephidim, sinai, golden_calf, glory
memory-labs.js / memory-labs.css
memory-labs-data.js / memory-labs-drag.js / memory-labs-tree.js
data/questions.json / data/memory-labs.yaml
docs/CHANGELOG.md                          # this file
docs/exodus-wonders-deep-research-brief.md
docs/exodus-memory-labs-deep-research-brief.md
scripts/test-wonders-mobile.mjs
scripts/test-memory-labs.mjs
```

**Ignored (not in repo):** `node_modules/`, `captures/` (Playwright screenshots), `data/source-exports/`
