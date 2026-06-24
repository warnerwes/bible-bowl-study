export const meta = {
  name: 'panel-review',
  description: 'A panel — St. Gregory of Nyssa, St. Cyril of Alexandria, Fr. Stephen De Young, and a master teacher — reviews and upgrades every question\'s memory aid into a memorable learning experience',
  phases: [
    { title: 'Panel', detail: 'three reviewers propose hooks per question' },
    { title: 'Synthesize', detail: 'the teacher crafts the final upgraded aid' },
  ],
}

// Chapter groups map 1:1 to the data/raw/group*.json source files.
const GROUPS = [
  { f: 'A', scope: 'Exodus 1-4' },
  { f: 'B', scope: 'Exodus 5-8' },
  { f: 'C', scope: 'Exodus 9-12' },
  { f: 'D', scope: 'Exodus 13-16' },
  { f: 'E', scope: 'Exodus 17-20' },
  { f: 'F', scope: 'Exodus 32-34, 38-40' },
]

const RAW = (g) => `/home/user/bible-bowl-study/data/raw/group${g.f}.json`
const OUT = (g) => `/home/user/bible-bowl-study/tmp-upgrades/group${g.f}.json`

// Verified, real sources. Reviewers may cite ONLY from genuine works like these
// (or leave the citation empty). Never invent quotes, page numbers, or works.
const CITATIONS = `
VERIFIED SOURCES (cite only genuine works; if you have no real source, leave citation empty ""):
- Scripture: 1 Cor 5:7-8; 1 Cor 10:1-4 (Red Sea baptism, manna, "the Rock was Christ"); John 6:31-51 (Bread of Life); John 19:36 (no bone broken); John 8:58 ("Before Abraham was, I AM"); Acts 7:14 (75 souls, per the Septuagint); Acts 2:41 (3,000 at Pentecost); 2 Cor 3:7-18 (Moses' veiled shining face); 1 Peter 2:9 (royal priesthood); Hebrews 12:18-24 (Sinai).
- St. Gregory of Nyssa, The Life of Moses.
- St. Cyril of Alexandria, Glaphyra on Exodus.
- St. Justin Martyr, Dialogue with Trypho (ch. 90: Moses' arms as the Cross; ch. 111: the Passover lamb and doorpost blood as the Cross).
- Melito of Sardis, On Pascha (the Passover lamb as the type of Christ).
- Theodoret of Cyrus, Questions on Exodus (the Red Sea as the laver of baptism).
- St. Ephrem the Syrian, Commentary on Exodus.
- Orthodox hymnography (e.g. the icon of the Unburnt Bush for the burning bush as the Theotokos).
- Fr. Stephen De Young: The Whole Counsel of God (Ancient Faith, 2021); The Religion of the Apostles (Ancient Faith, 2021); God Is a Man of War (Ancient Faith, 2021); The Lord of Spirits podcast / The Whole Counsel of God podcast (Ancient Faith Radio).
`

const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', description: 'keep | improve — your read on the current aid' },
          hook: { type: 'string', description: 'your proposed memorable hook for this fact, in your voice' },
          citation: { type: 'string', description: 'a real source from the verified list, or "" if none' },
        },
        required: ['id', 'hook', 'citation'],
      },
    },
  },
  required: ['proposals'],
}

function personaPrompt(persona, g) {
  return `You sit on a review panel improving a Bible Bowl study app for the Book of Exodus (Orthodox Study Bible / Septuagint). When a learner answers wrong, they see a "memory aid" meant to make the fact unforgettable. Your job: review EVERY question in this file and propose a better hook for each.

Read the questions here: ${RAW(g)} (covers ${g.scope || ''}). Each has: question, answer, reference, and a current memoryAid {type, text}.

YOUR VOICE — ${persona.name}:
${persona.guide}

For EACH question return an object { id, verdict, hook, citation }:
- verdict: "keep" if the current aid is already excellent, else "improve".
- hook: 1-3 sentences in your voice that would make this fact stick — a genuine insight, image, or device tied to THIS specific fact. Be concrete and vivid, not generic.
- citation: a real source from the list below that genuinely supports your hook, or "" if your hook is a memory device / image that needs no citation. NEVER invent a citation, quote, or work. If you are not certain a Father actually taught this, leave citation "".

${CITATIONS}

Cover every question in the file. Return all proposals.`
}

const PERSONAS = {
  gregory: {
    name: 'St. Gregory of Nyssa',
    guide: `You read Exodus as the soul's ascent to God and as a web of types fulfilled in Christ (you wrote The Life of Moses). You see the burning bush as the Ever-Virgin, Marah's wood and Moses' outstretched arms as the Cross, the rock as Christ, the manna as the Word, the cloud as divine guidance. Offer contemplative, typological hooks. Cite "St. Gregory of Nyssa, The Life of Moses" only when the type is one you genuinely treat.`,
  },
  cyril: {
    name: 'St. Cyril of Alexandria',
    guide: `You expound Exodus typologically and Christologically (you wrote the Glaphyra on Exodus). You connect the Law, the lamb, the priesthood, and the tabernacle to Christ and the Church with precision. Offer sharp Christ-centered hooks. Cite "St. Cyril of Alexandria, Glaphyra on Exodus" only where the connection is genuinely yours; otherwise "".`,
  },
  deyoung: {
    name: 'Fr. Stephen De Young',
    guide: `You read Exodus in its ancient Near Eastern and Second-Temple context: the plagues as YHWH's judgment on the gods of Egypt (Ex 12:12), the Angel of the Lord as the pre-incarnate Word, the divine council and the heavenly host, firstborn/inheritance, the cosmic-warfare backdrop. Offer "weird-but-true" historical/contextual hooks that reframe the fact and make it shocking and memorable. Cite a specific work of yours (The Whole Counsel of God; The Religion of the Apostles; God Is a Man of War; The Lord of Spirits podcast) when apt, else "".`,
  },
}

function synthPrompt(g, gregory, cyril, deyoung) {
  return `You are the panel's MASTER TEACHER and mnemonist — a gifted, dynamic educator who turns scholarship into learning people never forget. You are upgrading the memory aids for a Bible Bowl app (Book of Exodus, Orthodox Study Bible / Septuagint). When a learner answers wrong, this aid is what makes the fact stick forever.

Read the original questions here: ${RAW(g)} (${g.scope || ''}). Each has question, answer, reference, current memoryAid {type, text}.

Three reviewers have proposed hooks per question id. Their proposals (JSON):
=== St. Gregory of Nyssa ===
${JSON.stringify((gregory && gregory.proposals) || [])}
=== St. Cyril of Alexandria ===
${JSON.stringify((cyril && cyril.proposals) || [])}
=== Fr. Stephen De Young ===
${JSON.stringify((deyoung && deyoung.proposals) || [])}

For EVERY question id in the original file, craft the single BEST upgraded memory aid. Decide its type:
- "teaching" — a 2-4 sentence expository insight (typology / salvation-history / Second-Temple context) that makes the fact profound and memorable. MUST include a "source" with a REAL citation drawn from a reviewer's proposal or the verified list. If no genuine citation exists, do NOT use type teaching.
- "image" — a vivid, emotional, shocking, or weird mental picture. No source.
- "mnemonic" — a clever acronym, rhyme, number-trick, or word-association. No source.

QUALITY BAR (this is the whole point):
- Every aid must be concrete, specific to THIS fact, and genuinely sticky. No filler, no vague piety.
- Example of WEAK (reject): "God is the fortress to which the victor runs." Example of STRONG for that same fact (Ex 17:15, altar "The Lord my Refuge"): an "image" — "Moses' arms, held up by Aaron and Hur, were Israel's living battle-standard high on the hill; when the fight was won Moses planted an altar and named it after the true standard — 'The Lord my Refuge.' Picture the raised arms becoming the flagpole the whole army rallies to." Or a "teaching" citing Justin Martyr, Dialogue ch. 90 (the cross-formed arms).
- Prefer a real cited teaching when one of the reviewers offered a genuine one; otherwise pick the most unforgettable image or mnemonic. Keep variety across the file — do not make everything a teaching.
- Keep all wording in OSB / Septuagint terms (e.g. "The Lord my Refuge", "I AM THE EXISTING ONE", south wind, dog-flies).

WRITE your result as a JSON array to the file ${OUT(g)} — create the directory if needed. Each element:
{ "id": "<original id>", "memoryAid": { "type": "teaching|image|mnemonic", "text": "...", "source": "..." } }
Include "source" ONLY for teaching aids (omit it for image/mnemonic). Include an entry for EVERY id in the original file. Validate it is valid JSON before writing.

Return one line: how many aids written, and the breakdown by type.`
}

// Pipeline the six groups; within each group the three reviewers run in parallel,
// then the teacher synthesizes. Groups proceed independently (no global barrier).
const results = await parallel(GROUPS.map((g) => async () => {
  const [gregory, cyril, deyoung] = await parallel([
    () => agent(personaPrompt(PERSONAS.gregory, g), { label: `Gregory:${g.f}`, phase: 'Panel', schema: PROPOSAL_SCHEMA, agentType: 'general-purpose' }),
    () => agent(personaPrompt(PERSONAS.cyril, g), { label: `Cyril:${g.f}`, phase: 'Panel', schema: PROPOSAL_SCHEMA, agentType: 'general-purpose' }),
    () => agent(personaPrompt(PERSONAS.deyoung, g), { label: `DeYoung:${g.f}`, phase: 'Panel', schema: PROPOSAL_SCHEMA, agentType: 'general-purpose' }),
  ])
  const summary = await agent(synthPrompt(g, gregory, cyril, deyoung), {
    label: `Teacher:${g.f}`, phase: 'Synthesize', agentType: 'general-purpose',
  })
  log(`group ${g.f}: ${summary}`)
  return { group: g.f, summary }
}))

return { groups: results.filter(Boolean) }
