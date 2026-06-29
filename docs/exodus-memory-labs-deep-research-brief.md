# Bible Bowl Study — Exodus Memory Labs Deep Research Brief

**Purpose:** Canonical Orthodox / OSB research for five interactive “Memory Lab” mini-games — a second shelf teaching ordered structure in Exodus (plagues, tribes, commandments, consecration, priestly genealogy). Use this alongside the Wonders brief; do not merge the two shelves.

**When research returns:** Integrate into new `memory-labs.js` (shelf + modal + unlock), shared drag-order engine, `memory-labs-tree.js` (priest line), and `memory-labs.css`. Load lab definitions from `data/memory-labs.yaml`.

**Live app:** https://warnerwes.github.io/bible-bowl-study/  
**Canonical data:** `data/memory-labs.yaml`  
**Related:** `docs/exodus-wonders-deep-research-brief.md`, `rewards.js`

**Primary Bible translation target:** Orthodox Study Bible (OSB) / SAAS (St. Athanasius Academy Septuagint).

---

## Memory Labs vs Wonders

| | **Wonders of the Exodus** | **Memory Labs** |
|---|---|---|
| **Shelf title** | Wonders of the Exodus | Memory Labs |
| **Goal** | Re-enact narrative milestones | Memorize ordered structure |
| **Interaction** | Canvas scenes (parting sea, manna jar, etc.) | Drag-order lists + tree placement |
| **Tone** | Dramatic, embodied story | Quiet catechesis, pattern memory |
| **Unlock** | Mastery % thresholds | Chapter mastery counts (per lab) |

Footer copy already notes Orthodox/patristic tradition. Memory Labs should reuse the same modal teaching pattern: **unlock teaching** before first attempt, **completion sentence** after success.

---

## Five labs (P0 unless noted)

| Order | ID | Label | Items | Interaction | Priority |
|-------|-----|-------|-------|-------------|----------|
| 1 | `plagues` | Ten Plagues | 10 | drag_order | P0 |
| 2 | `tribes` | Twelve Tribes | 12 | drag_order (birth order) | P0 |
| 3 | `commandments` | Ten Commandments | 10 | drag_order (Orthodox numbering) | P0 |
| 4 | `priest_line` | Line of the Priesthood | 15 nodes | tree_place | P0 |
| 5 | `consecration` | Holy Consecration | 9 | drag_order (Exodus 29 subset) | P1 |

### Critical content flags (from research)

- **Plagues:** Use **Lice** and **Dog-flies** (not generic gnats/flies without note).
- **Tribes:** **Birth order**, not Exodus 1 name order or camp order. Subtitle required.
- **Commandments:** **Orthodox numbering** only as default; teacher note on Catholic/Lutheran/Jewish divergence.
- **Consecration:** “Remembering God’s institution, not performing the rite.” No cartoon blood.
- **Priest line:** **Eleazar ≠ Eliezer**; Gershom/Eliezer under Moses, not Aaron.

---

## Proposed architecture (implemented 2026-06-26)

```
index.html
  ├── rewards.js              (existing Wonders shelf — unchanged)
  ├── memory-labs.js          (new: LAB[] config, shelf, modal, unlock)
  ├── memory-labs-drag.js     (shared drag_order engine for 4 labs)
  ├── memory-labs-tree.js     (tree_place for priest_line)
  └── memory-labs.css

data/memory-labs.yaml         (canonical lab content — already in repo)
```

### Shared `drag_order` engine (P0)

1. Shuffle labeled cards in a scrollable tray.
2. Student drags into numbered slots (touch-friendly, 44px+ targets).
3. **Check order** → success shows `completion_teaching.memory_sentence`; failure shows `interaction_spec.failure_teaches` hint (region/mother-group/numbering note).
4. First open shows `unlock_teaching` headline + body in modal before play.

### `tree_place` engine (P0)

- Vertical trunk slots + branch columns per `mobile_layout` in YAML.
- Drag name chips into parent/child/spouse slots.
- Wrong-branch drops trigger `failure_teaches` (e.g. Gershom under Aaron).

### Unlock model (suggested in YAML)

Each lab has `suggested_unlock.type: chapter_masteries` with chapter list + `min_masteries`. Wire to existing mastery stats the same way Wonders use `masteredCount` / `masteryPct` — exact thresholds can be tuned in `memory-labs.js`.

---

## Acceptance checklist

- [x] Each lab has `unlock_teaching` + `completion_teaching`
- [ ] Each ordered list verified against OSB/LXX or flagged for human OSB pass
- [x] Commandments use Orthodox numbering
- [x] Tribes ordering tradition named explicitly (“birth order, not camp order”)
- [x] Consecration subset defensible in one mobile session (~3 min)
- [x] Priest tree node list complete and scriptural
- [x] No Protestant-only typology stated as Church consensus
- [ ] Final release copy receives human printed-OSB wording pass

---

## Implementation status

**Shipped** in commit `f6fe77a`: all five labs playable; `npm run test:labs` passes 10/10 (mobile + desktop). Runtime config in `memory-labs-data.js`; canonical YAML in `data/memory-labs.yaml`.

**P1 not yet built:** mother tags on tribes, Dog-flies subtitle card, optional compare screens, expanded Levitical tree.

---

## Implementation phases

### Phase 1 — Scaffold (P0) ✓
### Phase 2 — Remaining drag labs (P0) ✓
### Phase 3 — Consecration + polish (P1) — consecration shipped; P1 polish deferred

---

## Source file map

| File | Role |
|------|------|
| `memory-labs.js` | Shelf, modal, unlock, completion tracking |
| `memory-labs-data.js` | Runtime lab definitions |
| `memory-labs-drag.js` | Drag-order engine |
| `memory-labs-tree.js` | Priest tree engine |
| `memory-labs.css` | UI styles |
| `data/memory-labs.yaml` | Canonical spec / research data |
| `rewards.js` / `rewards.css` | Wonders shelf pattern |
| `app.js` | Stats events (`bbs:stats-updated`) for unlock refresh |
| `scripts/test-memory-labs.mjs` | Playwright QA |
| `docs/CHANGELOG.md` | Release notes |

---

## Version note

Implemented 2026-06-26 (commit `f6fe77a`). YAML ingested from deep-research session. **Human OSB pass still required** before shipping in-app quotes. See [`docs/CHANGELOG.md`](CHANGELOG.md).

---

*End of Memory Labs research brief. Canonical lab data: `data/memory-labs.yaml`*
