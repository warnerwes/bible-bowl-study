# Bible Bowl Study — Exodus Wonders Deep Research Brief

**Purpose:** Feed this document into a deep-research session on Orthodox / patristic / OSB authenticity for eight interactive “Wonder” reward mini-games in a Bible Bowl study web app. The researcher should return actionable guidance: corrected scripture wording, patristic citations, liturgical connections, didactic gameplay changes, and copy rewrites.

**When research returns:** Bring findings back to the coding agent with instructions to integrate into `rewards.js` (copy), `rewards-scenes-1.js`, `rewards-scenes-2.js` (interactions), and optionally `rewards.css`.

**Live app:** https://warnerwes.github.io/bible-bowl-study/  
**Source repo paths:** `rewards.js`, `rewards-scenes-1.js`, `rewards-scenes-2.js`, `rewards.css`, `index.html`

**Primary Bible translation target:** Orthodox Study Bible (OSB) / Septuagint where Exodus differs from Masoretic/KJV traditions.

**Footer copy in app:** *“Memory aids draw on Orthodox/patristic tradition and the Orthodox Study Bible.”*

---

## COPY THIS BLOCK AS YOUR RESEARCH PROMPT

```
You are researching for "Bible Bowl Study," a free web app where students master Exodus quiz questions and unlock eight canvas mini-games—one per major Exodus milestone. Each wonder has:

- OSB-oriented scripture quote + patristic description (shown in modal)
- Short gameplay tip
- Touch/mouse canvas interaction teaching the event through action

Your job:

1. For each of the 8 wonders below, verify against OSB/LXX text and Orthodox patristic/liturgical tradition:
   - Is the quote accurate?
   - Is the description theologically sound and helpfully Orthodox (not Protestant novelty, not vague “Christian symbolism”)?
   - Name specific Fathers, homilies, festal hymns, or OSB notes to cite.

2. For each mini-game interaction, judge whether the PLAYER ACTION matches what Moses/Israel actually did in scripture (OSB). Flag mismatches.

3. Propose DIDACTIC improvements: what should the player physically do so the game teaches the event—not entertains abstractly? Include mobile/touch UX notes (large text, progress bars, jar above finger, etc.).

4. Map all 8 wonders to the arc of Exodus (deliverance → testing → Law → idolatry → God's dwelling). Show how rewards order teaches the book.

5. Return structured output per wonder:
   - Corrected OSB quote (if needed)
   - 2–4 sentence Orthodox description (patristic, parish-catechesis tone)
   - Gameplay tip (one line, imperative)
   - Interaction design spec (steps, phases, success/failure teaching moments)
   - Patristic/liturgical references (author, work, brief quote if possible)
   - Red flags in current implementation
   - Priority changes (P0/P1/P2)

Assume audience: Orthodox families, Bible Bowl students, ages ~10–adult. Goal: rewards feel like sacred catechesis through play, not arcade games with Bible skin.
```

---

## Product context

### How wonders unlock
Students answer Exodus questions; after **3 correct streaks** on a question it counts as “mastered.” Wonders unlock on a trophy shelf by mastery progress:

| Order | Wonder       | Unlock threshold      | Exodus chapter |
|-------|--------------|----------------------|----------------|
| 1     | Red Sea      | 10 mastered questions | Ch 14          |
| 2     | Marah        | 5% of bank mastered   | Ch 15          |
| 3     | Elim         | 15%                   | Ch 15          |
| 4     | Manna        | 30%                   | Ch 16          |
| 5     | Rephidim     | 45%                   | Ch 17          |
| 6     | Sinai        | 60%                   | Ch 19          |
| 7     | Golden Calf  | 80%                   | Ch 32          |
| 8     | Glory        | 100%                  | Ch 40          |

### Modal UI structure (per wonder)
- **Caption** (large, on canvas during play)
- **Progress line** (smaller, on canvas)
- **Collapsible panel:** Scripture quote (`quote`), Orthodox description (`desc`), gameplay tip (`tip`)
- **Canvas:** HTML5 2D, pointer/touch events (`mouse.down`, drag, hold)
- **Sinai only:** toggle “Pillar of Cloud” (day) vs “Pillar of Fire” (night) — cosmetic mountain palette

### Technical architecture
- `rewards.js` — `WONDERS[]` config, trophy shelf, modal, audio, unlock logic
- `rewards-scenes-1.js` — scenes: `red_sea`, `marah`, `elim`, `manna`
- `rewards-scenes-2.js` — scenes: `rephidim`, `sinai`, `golden_calf`, `glory`
- Scene functions signature: `(w, h, ctx, canvasTime, mouse, particles, customWonderState)`
- State persists in `customWonderState` per session; particles array for visuals

---

## Full WONDERS config (from `rewards.js`)

```javascript
const WONDERS = [
  {
    id: "red_sea",
    emoji: "🌊",
    label: "Red Sea",
    chapter: "Ch 14",
    threshold: { type: "masteries", value: 10 },
    ref: "Exodus 14:21-22",
    quote: "And Moses stretched out his hand over the sea; and the Lord drove back the sea with a strong south wind all that night and made the sea dry land, and the waters were divided.",
    desc: "In the Septuagint and OSB a strong south wind — not an east wind — drives the sea back. St. Paul reads the crossing as our Baptism: Israel was baptized into Moses in the cloud and in the sea, delivered from Pharaoh into life.",
    tip: "Hold your hand over the sea — Moses stretched out his hand, and a strong south wind parted the waters.",
    color: "#3498db"
  },
  {
    id: "marah",
    emoji: "💧",
    label: "Marah",
    chapter: "Ch 15",
    threshold: { type: "pct", value: 5 },
    ref: "Exodus 15:23,25",
    quote: "They could not drink the waters of Marah, for they were bitter… and the Lord showed him a tree, and he cast it into the water, and the water became sweet.",
    desc: "Marah means bitter. St. Gregory of Nyssa reads the tree cast into bitter water as the Cross plunged into the bitterness of our life — what was undrinkable becomes sweet, and there God names Himself the Lord who heals you.",
    tip: "Drag the tree into the bitter pool and release to cast it in, as Moses did at Marah.",
    color: "#2ecc71"
  },
  {
    id: "elim",
    emoji: "🌴",
    label: "Elim",
    chapter: "Ch 15",
    threshold: { type: "pct", value: 15 },
    ref: "Exodus 15:27",
    quote: "Then they came to Elim, where there were twelve springs of water and seventy palm trees, and they encamped there by the waters.",
    desc: "Rest after Marah. The Fathers read twelve springs for the twelve tribes — fulfilled in the twelve Apostles — and seventy palms for the seventy elders Moses chose, prefiguring the seventy disciples Christ sent (Luke 10). The apostolic Church appears as an oasis: living water that no longer needs the wood of healing.",
    tip: "Hold at each numbered well until you drink from all twelve.",
    color: "#27ae60"
  },
  {
    id: "manna",
    emoji: "🍞",
    label: "Manna",
    chapter: "Ch 16",
    threshold: { type: "pct", value: 30 },
    ref: "Exodus 16:4,13",
    quote: "Then the Lord said to Moses, 'Behold, I will rain bread from heaven for you'… and in the morning the dew lay round about the camp.",
    desc: "Bread from heaven each dawn — Israel named it manna, 'What is it?' Quail covered the camp at evening. The question is not fully answered until Christ stands in the wilderness and says, 'I am the bread of life.'",
    tip: "Scoop manna at dawn. Tap TENT when full. Day 6: two jars same day — then quail at night eat the rest.",
    color: "#f1c40f"
  },
  {
    id: "rephidim",
    emoji: "🪨",
    label: "Rephidim",
    chapter: "Ch 17",
    threshold: { type: "pct", value: 45 },
    ref: "Exodus 17:6",
    quote: "Behold, I will stand before you there on the rock in Horeb; and you shall strike the rock, and water will come out of it for the people to drink.",
    desc: "At Rephidim the rock is smitten once and a river flows for a thirsting nation. St. Paul says plainly, 'that Rock was Christ' — smitten on the Cross so living water pours for the whole people.",
    tip: "Massah and Meribah — tap the rock once to strike it with the staff.",
    color: "#e67e22"
  },
  {
    id: "sinai",
    emoji: "⛰️",
    label: "Sinai",
    chapter: "Ch 19",
    threshold: { type: "pct", value: 60 },
    ref: "Exodus 19:18",
    quote: "Now Mount Sinai was completely in smoke, because the Lord descended upon it in fire. Its smoke ascended like the smoke of a furnace, and the whole mountain quaked greatly.",
    desc: "God descends upon Sinai in fire and cloud to give the Law. The mountain trembles beneath His feet, and the trumpet blast grows ever louder — the herald of the King who comes, not with Moses alone but with myriads of angels.",
    tip: "Do not touch Sinai — lightning strikes if you do.",
    color: "#9b59b6"
  },
  {
    id: "golden_calf",
    emoji: "🐂",
    label: "Golden Calf",
    chapter: "Ch 32",
    threshold: { type: "pct", value: 80 },
    ref: "Exodus 32:20",
    quote: "He took the calf which they had made, burned it in the fire, ground it to powder, scattered it on the water, and made the children of Israel drink it.",
    desc: "While Moses received the Law on the mountain, Israel made a calf below. Moses grinds the idol to dust and pours it on the water they must drink — judgment on idolatry. Three thousand fall by the sword; at Pentecost three thousand are added to life.",
    tip: "Break the calf, grind it to powder, scatter it on the water, and make Israel drink — as Moses did.",
    color: "#e74c3c"
  },
  {
    id: "glory",
    emoji: "✨",
    label: "Glory",
    chapter: "Ch 40",
    threshold: { type: "pct", value: 100 },
    ref: "Exodus 40:34",
    quote: "Then the cloud covered the tabernacle of testimony, and the glory of the Lord filled the tabernacle.",
    desc: "The whole book of Exodus drives toward this: God comes to dwell with His people. St. John deliberately echoes it — 'the Word became flesh and tabernacled among us, and we beheld His glory' — the cloud-filled tent foreshadowing the Incarnation.",
    tip: "Stand outside the tabernacle — Moses could not enter when the glory filled it. Hold and behold.",
    color: "#f39c12"
  }
];
```

---

## Wonder-by-wonder: current gameplay & code

### 1. Red Sea (`red_sea`) — Ch 14

**Theological intent (current):** Moses stretches hand; **strong south wind** (OSB/LXX) parts sea overnight—not striking water. Baptism typology (1 Cor 10).

**Player interaction:**
1. Hold finger/mouse over the sea (not striking).
2. `windStrength` increases → `parting` 0→1.
3. Wind particles blow; water walls recede; dry path appears.
4. After parted: walk on dry land creates dust particles.

**On-screen strings:**
- Caption: `"Stretch hand over sea"` → `"Dry land"`
- Progress: `"South wind N%"` → `"Israel passes through"`

**Key state:** `parting`, `windStrength`, `handExtended`

**Code (interaction core):**
```javascript
if (parting < 1 && overSea && mouse.down) {
  customWonderState.handExtended = true;
  customWonderState.windStrength = (customWonderState.windStrength || 0) + 0.009;
  customWonderState.parting = Math.min(1, customWonderState.windStrength);
}
// Hand + staff drawn at pointer; NOT a striking animation
```

**Research questions:**
- OSB exact wording for wind direction and Moses' action (hand vs rod)?
- Patristic baptism crossing: Cyril of Alexandria, Gregory, Chrysostom?
- Should Israel crossing be player-driven after parting?
- Any liturgical echo (Theophany, Pascha)?

---

### 2. Marah (`marah`) — Ch 15

**Theological intent:** Bitter water; God shows Moses a **tree**; he **casts** it in; sweet; God reveals Himself as healer.

**Player interaction:**
1. Drag tree from top of scene into bitter pool.
2. **Release** finger in pool to cast (not tap-to-sweeten).
3. Ripple converts bitter particles to sweet blue.

**On-screen strings:**
- `"Cast tree into Marah"` / `"Drag tree into pool"` → `"Waters made sweet"`

**Key state:** `treeDragging`, `treeCast`, `treeFixed`, `sweetened`, `rippleRadius`

**Code:**
```javascript
if (!treeCast && customWonderState.treeDragging && !mouse.down) {
  const releaseInPool = treeY > poolY + 8 && treeX > w * 0.08 && treeX < w * 0.92;
  if (releaseInPool) {
    customWonderState.treeCast = true;
    customWonderState.sweetened = true;
  }
}
```

**Research questions:**
- Tree vs branch in OSB? Who cast—Moses alone?
- Gregory of Nyssa *Life of Moses* — exact passage for Cross typology?
- Should God's name revelation ("I am the Lord who heals you") appear in UI?

---

### 3. Elim (`elim`) — Ch 15

**Theological intent:** Twelve springs, seventy palms; rest; apostolic typology (12 apostles, 70 disciples/Luke 10).

**Player interaction:**
1. Twelve numbered wells along bottom.
2. Hold finger on each well ~1 sec to “drink” (progress counter).
3. Must visit all 12.

**On-screen strings:**
- `"Twelve wells at Elim"` / `"Drink from each well N / 12"`

**Key state:** `springs[]` with `{ x, y, drunk, drinkProgress }`, `palms[]`

**Research questions:**
- Are “wells” or “springs” correct OSB term?
- Is 70 palms = 70 elders patristically standard or conflating Numbers 11?
- Better didactic action than sequential drinking?

---

### 4. Manna (`manna`) — Ch 16

**Theological intent:** Bread from heaven with dew; daily gather; Sabbath rest; day 6 double portion; quail at evening; Christ as bread of life.

**Player interaction — phases:**

| Phase | Behavior |
|-------|----------|
| `gather` | Jar floats **above finger** (not hidden). Scoop white manna flakes. Progress bar at top. |
| Full jar | Tap **TENT** (bottom-right) to store. |
| Day 1–5 | 1 jar → night |
| Day 6 | Jar 1 → tent → **same day** jar 2 with **sparse** manna (harder) → tent |
| `night` | Dark overlay; **quail fly across** eating leftover manna on ground |
| After night | Advance to next day (dew flash at dawn) |
| Day 7 | Sabbath: no gather; tap tent to eat saved manna |
| Failure | Collecting extra while jar full → worms (`rotten`) |

**On-screen strings (examples):**
- `"Day N"` / `"Day 6 · jar 1 of 2"`
- `"Scoop manna with your jar"` / `"Jar full · tap TENT"`
- `"Second jar · less manna left"`
- `"Night · quail come"` / `"Quail eat what manna is left"`
- `"Day 7 · Sabbath"` / `"Tap tent to eat saved manna"`

**Key state:** `weekDay` (1–7), `mannaPhase` (`gather`|`night`|`sabbath`), `jarFill`, `jarsStored`, `jarLimit`, `pendingJar`, `rotten`, `nightTimer`

**Code (day 6 + night):**
```javascript
if (weekDay === 6 && customWonderState.jarsStored < jarLimit) {
  spawnMannaFlakes(w, h, particles, { sparse: true }); // second jar, less manna
} else {
  startMannaNight(customWonderState); // quail phase
}
// Night: quail particles eat untaken manna flakes
if (left === 0 || customWonderState.nightTimer > 200) {
  advanceMannaDay(customWonderState, w, h, particles);
}
```

**Research questions:**
- OSB order: dew then manna, or quail first evening then manna morning?
- Quail **came** at evening for meat; did quail **eat** leftover manna? (User requested this for gameplay—verify if typologically/defensible or needs reframing as “manna melts/sun spoils” per Ex 16:21)
- Double portion theology for 6th day in Orthodox practice (pre-Sabbath)
- Jar of manna kept in ark—should gameplay reference Holy of Holies?
- Wormy manna when hoarded—exact OSB verse

---

### 5. Rephidim (`rephidim`) — Ch 17

**Theological intent:** Massah & Meribah (testing/quarreling); strike rock **once** at Horeb; water; Rock is Christ (1 Cor 10:4).

**Player interaction:**
1. Staff follows pointer.
2. Tap/hold on rock once → crack → water streams.
3. Caption references Massah · Meribah.

**On-screen strings:**
- `"Massah · Meribah"` / `"Tap rock once with staff"` → `"Water from the rock"`

**Key state:** `rock.struck`, `rock.cracked`, staff at `mouse.x/y`

**Code:**
```javascript
if (mouse.down && !rock.struck && onRock) {
  rock.struck = true;
  rock.cracked = true;
  // water_stream particles
}
```

**Research questions:**
- Massah/Meribah: show contention scene or subtitle only?
- Strike once vs Numbers 20 second strike (Moses' sin)—how to catechize?
- Amalek battle same chapter—include or distract?

---

### 6. Sinai (`sinai`) — Ch 19

**Theological intent:** God descends in fire/smoke; mountain quakes; trumpet; **do not touch** mountain (death).

**Player interaction:**
1. Ambient embers, periodic lightning from peak.
2. **Touch mountain** → lightning strikes down to finger; flash; sparks; thunder sound.
3. Toggle: Pillar of Cloud (day palette) / Pillar of Fire (night palette).

**On-screen strings:**
- `"Sinai"` / `"Do not touch the mountain"` → `"Lightning!"`
- On mountain: `"DO NOT TOUCH"`

**Key state:** `mode` (`day`|`night`), `zapFlash`, `lightning`, `touchCount`, `onMountain` hit test

**Code:**
```javascript
const touching = onMountain && mouse.down;
if (touching && !customWonderState.zapLock) {
  customWonderState.lightning = generateLightningPath(peakX, peakY - 16, mouse.x, mouse.y);
  customWonderState.touchCount++;
}
```

**Research questions:**
- Ex 19 boundaries vs later ascension of Moses—what should player learn?
- OSB on “beast that touches shall be stoned” — show that text?
- Trumpet / silence / Moses speaking—missing teaching moments?
- Theophany iconography connections?

---

### 7. Golden Calf (`golden_calf`) — Ch 32

**Theological intent:** Idol while Moses on mountain; burn, grind, scatter on water, make Israel drink; judgment; Pentecost contrast.

**Player interaction — phases:**
1. `idol` — tap calf to break → shards
2. `grind` — rub/drag to grind powder
3. `water` — tap water pool to scatter ash
4. `done`

**On-screen strings:**
- `"Golden calf"` / `"Tap calf to break"` → `"Rub to grind powder"` → `"Tap water to scatter"`

**Key state:** `calfPhase`, `grindProgress`, `waterScatter`, `calf.broken`

**Code:**
```javascript
if (phase === "idol" && mouse.down && onCalf) { calf.broken = true; calfPhase = "grind"; }
if (phase === "grind" && mouse.down) { grindProgress += movement; if > 90 → water }
if (phase === "water" && mouse.down && mouse.y > waterY) { waterScatter++; if > 35 → done }
```

**Research questions:**
- OSB order: burned THEN ground? Stream from rock for water source?
- Aaron's role—omit or acknowledge?
- 3000 slain / 3000 saved at Pentecost—is this typology used in Orthodox sources?
- Pastoral sensitivity for children playing “drink idol dust”

---

### 8. Glory (`glory`) — Ch 40

**Theological intent:** Cloud covers tabernacle; glory fills it; **Moses cannot enter**; John 1:14 tabernacling.

**Player interaction:**
1. Tabernacle center; glory light rays follow pointer angle.
2. **Inside tent** → “Do not enter”
3. **Outside below tent** + hold → `witnessHold` builds → complete
4. Ripple effects on hold

**On-screen strings:**
- `"Glory fills tabernacle"` / `"Stand below the tent"` → `"Behold outside"` / `"Do not enter"`

**Key state:** `tabernacle`, `witnessHold`, `insideTabernacle`, `ripples[]`

**Code:**
```javascript
const insideTabernacle = Math.hypot(mouse.x - tabCX, mouse.y - tabCY) < tabernacle.w * 0.38;
const witnessing = !insideTabernacle && mouse.y > tabernacle.y - 10;
if (witnessing && mouse.down) customWonderState.witnessHold += 2;
if (witnessHold > 35) customWonderState.complete = true;
```

**Research questions:**
- Ex 40:34-35 vs 40:20 Moses entering—harmonize?
- Orthodox icon of Transfiguration / Dormition light—visual cues?
- Should player role be Moses, priest, or Israel camped at distance?

---

## Exodus arc (how rewards map to the book)

```
Ch 14  Red Sea      — Deliverance from Egypt (Baptism)
Ch 15  Marah        — First testing; Cross heals bitterness
Ch 15  Elim         — God's provision; Church typology
Ch 16  Manna        — Daily dependence; Sabbath; Eucharist prefigured
Ch 17  Rephidim     — Quarrel; water from Christ the Rock
Ch 19  Sinai        — Holiness; Law; fear of God; boundaries
Ch 32  Golden Calf  — Idolatry while Moses away; judgment
Ch 40  Glory        — Telos of Exodus: God dwells with His people
```

**Research task:** Confirm this arc matches Orthodox lectio divina / patristic reading of Exodus as journey to divine indwelling. Suggest reordering or missing wonders if any (e.g., Passover, Tabernacle construction, Passover institution).

---

## Known design constraints (for researcher)

- **Mobile-first:** large header text (`uiScale`), progress bars, buttons not hidden under thumb
- **Touch:** pointer events, hold/drag/tap; no keyboard required
- **No voiceover** — all teaching via on-screen copy + action
- **Particle canvas** — keep interactions simple (scoop, drag, hold, tap targets)
- **Audio:** subtle synthesized sounds (wind, thunder, gather, etc.) — optional liturgical sound notes only if strongly justified
- **App is study tool** for Bible Bowl — rewards reinforce memory, not replace catechism

---

## Gaps & red flags for researcher to address

| Wonder | Possible issue |
|--------|----------------|
| Red Sea | Player “parts” sea by holding—is Moses' passivity vs God's wind clear enough? |
| Marah | “Tree” unspecified in gameplay |
| Elim | Typology may conflate elders/disciples |
| Manna | Quail eating leftover manna may not match text (quail brought for eating, manna melted by sun) |
| Rephidim | Massah/Meribah contention minimal; Amalek absent |
| Sinai | Lightning on touch is pedagogical fiction—good or needs boundary markers from text? |
| Golden calf | Burn step skipped in gameplay; Aaron absent |
| Glory | Who is the player? Moses excluded from tent—role clarity |

---

## Desired return format (bring this back to the developer)

For each `id` in `["red_sea","marah","elim","manna","rephidim","sinai","golden_calf","glory"]`:

```yaml
wonder_id: manna
osb_quote_revised: "..."
osb_reference: "Exodus 16:x-y (OSB)"
description_revised: "..."
tip_revised: "..."
patristic_sources:
  - author: "..."
    work: "..."
    relevance: "..."
liturgical_connections: ["..."]
interaction_spec:
  phases: [...]
  player_role: "Israelite gatherer / ..."
  success_teaches: "..."
  failure_teaches: "..."
copy_changes:
  caption_lines: [...]
  progress_lines: [...]
gameplay_changes:
  P0: [...]
  P1: [...]
  P2: [...]
theological_red_flags: [...]
```

Plus a **global** section: overall Exodus narrative paragraph for the app, glossary (Massah, Meribah, manna, Shekinah/glory terms Orthodox prefer), and any wonders to add/remove.

---

## Source file map

| File | Contents |
|------|----------|
| `rewards.js` | `WONDERS[]`, unlock thresholds, modal HTML, `openModal()`, audio |
| `rewards-scenes-1.js` | Red Sea, Marah, Elim, Manna canvas scenes |
| `rewards-scenes-2.js` | Rephidim, Sinai, Golden Calf, Glory |
| `rewards.css` | Trophy shelf, modal layout, mobile scene sizing |
| `scripts/test-wonders-mobile.mjs` | Automated mobile (390×844) + desktop (1280×800) QA |
| `index.html` | Script includes, Orthodox footer note |

---

## Version note

Export generated from codebase state after manna night/quail + day-6 two-jar flow. Cache-bust at export time: `rewards-scenes-1.js?v=12`, `rewards.js?v=17`.

---

*End of research brief. Copy everything above the “End of research brief” line into your deep research session, or share this file path: `docs/exodus-wonders-deep-research-brief.md`*
