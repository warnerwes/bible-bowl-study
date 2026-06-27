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
| **Shelf title** | Wonders of the Exodus | Memory Labs (proposed) |
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

## Proposed architecture

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

- [ ] Each lab has `unlock_teaching` + `completion_teaching`
- [ ] Each ordered list verified against OSB/LXX or flagged for human OSB pass
- [ ] Commandments use Orthodox numbering
- [ ] Tribes ordering tradition named explicitly (“birth order, not camp order”)
- [ ] Consecration subset defensible in one mobile session (~3 min)
- [ ] Priest tree node list complete and scriptural
- [ ] No Protestant-only typology stated as Church consensus
- [ ] Final release copy receives human printed-OSB wording pass

---

## Implementation phases

### Phase 1 — Scaffold (P0)
- Second shelf UI below Wonders
- Load `data/memory-labs.yaml` (or embed JSON at build time)
- One drag-order lab end-to-end (**plagues**) as template
- Unlock/completion teaching modals
- Mobile QA script mirroring `test-wonders-mobile.mjs`

### Phase 2 — Remaining drag labs (P0)
- `tribes`, `commandments`, `priest_line` tree

### Phase 3 — Consecration + polish (P1)
- `consecration` lab
- P1 features: mother tags, two-table divider, Dog-flies subtitle

---

## Source file map (existing)

| File | Role |
|------|------|
| `rewards.js` | Wonders shelf pattern to mirror |
| `rewards.css` | Trophy grid / modal styles to extend |
| `app.js` | Stats events (`bbs:stats-updated`) for unlock |
| `scripts/test-wonders-mobile.mjs` | QA pattern for new `test-memory-labs.mjs` |

---

## Version note

Research ingested 2026-06-26 from deep-research session. YAML normalized from chat deliverable (fixed nesting of `completion_teaching` blocks, consolidated footnotes). **Human OSB pass still required** before shipping in-app quotes.

---

*End of Memory Labs research brief. Canonical lab data: `data/memory-labs.yaml`*
