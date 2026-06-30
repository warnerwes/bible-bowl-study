/* Bible Bowl Study — Memory Labs data (from data/memory-labs.yaml) */

(() => {
  "use strict";

  window.BibleBowlLabs = {
    intro:
      "Memory Labs teach the ordered patterns of Exodus — judgment, covenant, priesthood, and worship — through touch and placement, not arcade spectacle.",

    labs: [
      {
        id: "plagues",
        label: "Ten Plagues",
        emoji: "🩸",
        ref: "Exodus 7:14–12:32",
        subtitle: "Exact plague order · OSB/LXX labels",
        description:
          "The ten plagues are an ordered judgment against Pharaoh's hardness. They move from waters to creatures, bodies, sky, darkness, and the firstborn.",
        tip: "Start with the Nile, end with the firstborn.",
        ordered_items: [
          "Water to Blood",
          "Frogs",
          "Lice",
          "Dog-flies",
          "Livestock Disease",
          "Boils",
          "Hail and Fire",
          "Locusts",
          "Darkness",
          "Firstborn Struck",
        ],
        item_emojis: ["🩸", "🐸", "🪲", "🪰", "🐄", "🤒", "🌨️", "🦗", "🌑", "💀"],
        unlock: { chapters: [7, 8, 9, 10, 11, 12], min: 8 },
        unlock_teaching: {
          headline: "Judgment That Teaches",
          body:
            "The plagues are not random disasters; they are ordered signs of God's authority. The fourth plague's dog-fly wording is vivid on purpose in the Greek tradition. Holy Saturday readings keep Passover and the sea crossing close to Pascha.",
        },
        completion_teaching: {
          memory_sentence:
            "God's judgments in Exodus are ordered signs, leading from bloodied water to Passover deliverance.",
        },
        interaction: { type: "drag_order" },
      },
      {
        id: "tribes",
        label: "Twelve Tribes",
        emoji: "⛺",
        ref: "Genesis 29–35; Exodus 1",
        subtitle: "Birth order, not camp order",
        description:
          "Jacob's twelve sons in birth order — the foundation before camp lists, blessings, and land allotments.",
        tip: "Leah's first four, Bilhah's two, Zilpah's two, Leah's last two, Rachel's two.",
        ordered_items: [
          "Reuben",
          "Simeon",
          "Levi",
          "Judah",
          "Dan",
          "Naphtali",
          "Gad",
          "Asher",
          "Issachar",
          "Zebulun",
          "Joseph",
          "Benjamin",
        ],
        item_emojis: [
          "🥇", // Reuben — firstborn ("behold a son")
          "⚔️", // Simeon — linked with sword, Dinah's vengeance
          "📜", // Levi — priestly line, set apart
          "🦁", // Judah — Lion of Judah, scepter
          "⚖️", // Dan — "judge" / scales of justice
          "🦌", // Naphtali — "hind let loose", swift
          "🐺", // Gad — "troop shall overcome him"
          "🌾", // Asher — "happy / bread", fertile
          "🐴", // Issachar — strong donkey between burdens
          "⛵", // Zebulun — "dwelling" by the sea, haven for ships
          "🌟", // Joseph — dreamer, fruitful bough
          "🐺", // Benjamin — "son of the right hand", ravenous wolf
        ],
        unlock: { chapters: [1, 2, 6], min: 5 },
        unlock_teaching: {
          headline: "One Family, Twelve Names",
          body:
            "The twelve tribes begin as twelve sons in a complicated family. Scripture lists them differently for different purposes — here we learn birth order first.",
        },
        completion_teaching: {
          memory_sentence:
            "The tribes begin as sons: remember the family order before you memorize the later tribal maps.",
        },
        interaction: { type: "drag_order" },
      },
      {
        id: "commandments",
        label: "Ten Commandments",
        emoji: "📜",
        ref: "Exodus 20:1–17",
        subtitle: "Orthodox numbering · two tables",
        teacher_note: "Other traditions number the commandments differently.",
        description:
          "After Sinai the Lord speaks the Decalogue — first love of God, then love of neighbor.",
        tip: "Learn the two tables: God first, then neighbor.",
        ordered_items: [
          "No Other Gods",
          "No Carved Images",
          "Honor God's Name",
          "Keep Sabbath Holy",
          "Honor Parents",
          "Do Not Murder",
          "No Adultery",
          "Do Not Steal",
          "No False Witness",
          "Do Not Covet",
        ],
        item_emojis: [
          "🚫", // No Other Gods
          "🗿", // No Carved Images
          "📛", // Honor God's Name
          "🕯️", // Keep Sabbath Holy
          "👨‍👩‍👧", // Honor Parents
          "🗡️", // Do Not Murder
          "💍", // No Adultery (covenant bond)
          "🔒", // Do Not Steal
          "👅", // No False Witness
          "👀", // Do Not Covet (eyes)
        ],
        unlock: { chapters: [19, 20], min: 7 },
        unlock_teaching: {
          headline: "Words at Sinai",
          body:
            "Exodus 20 gives covenant words into holy fear. Orthodox numbering treats carved images as the second commandment and coveting as one tenth commandment. Veneration of icons is not worship of created things.",
        },
        completion_teaching: {
          memory_sentence:
            "The commandments order love: first toward God, then toward the neighbor.",
        },
        interaction: { type: "drag_order" },
      },
      {
        id: "priest_line",
        label: "Line of the Priesthood",
        emoji: "🌿",
        ref: "Exodus 6:16–25; 18:3–4; 28:1",
        subtitle: "Aaron's line · Moses' sons for contrast",
        description:
          "Moses and Aaron share Levi's line, but priestly ministry runs through Aaron and his sons — not through Gershom or Eliezer.",
        tip: "Trunk: Jacob → Levi → Kohath → Amram, then split Aaron's priests from Moses' sons.",
        unlock: { chapters: [2, 4, 6, 18, 28], min: 6 },
        unlock_teaching: {
          headline: "One Tribe, Two Callings",
          body:
            "Moses leads as prophet; Aaron and his sons are set apart for priestly ministry. Eleazar belongs under Aaron; Eliezer belongs under Moses.",
        },
        completion_teaching: {
          memory_sentence:
            "Moses and Aaron share Levi's line, but the priesthood runs through Aaron.",
        },
        interaction: { type: "tree_place" },
        tree_slots: [
          { id: "jacob", label: "Patriarch", accept: "Jacob", row: 0 },
          { id: "levi", label: "Son of Jacob", accept: "Levi", row: 1 },
          { id: "kohath", label: "Son of Levi", accept: "Kohath", row: 2 },
          { id: "amram", label: "Son of Kohath", accept: "Amram", row: 3 },
          { id: "jochebed", label: "Spouse of Amram", accept: "Jochebed", row: 3, side: true },
          { id: "miriam", label: "Daughter", accept: "Miriam", row: 4, branch: "sibling" },
          { id: "aaron", label: "Son · priest", accept: "Aaron", row: 4, branch: "sibling" },
          { id: "moses", label: "Son · prophet", accept: "Moses", row: 4, branch: "sibling" },
          { id: "nadab", label: "1st son of Aaron", accept: "Nadab", row: 5, branch: "aaron" },
          { id: "abihu", label: "2nd son of Aaron", accept: "Abihu", row: 5, branch: "aaron" },
          { id: "eleazar", label: "3rd son of Aaron", accept: "Eleazar", row: 5, branch: "aaron" },
          { id: "ithamar", label: "4th son of Aaron", accept: "Ithamar", row: 5, branch: "aaron" },
          { id: "phinehas", label: "Son of Eleazar", accept: "Phinehas", row: 6, branch: "eleazar" },
          { id: "gershom", label: "1st son of Moses", accept: "Gershom", row: 5, branch: "moses" },
          { id: "eliezer", label: "2nd son of Moses", accept: "Eliezer", row: 6, branch: "moses" },
        ],
        tree_chips: [
          "Jacob", "Levi", "Kohath", "Amram", "Jochebed",
          "Miriam", "Aaron", "Moses",
          "Nadab", "Abihu", "Eleazar", "Ithamar", "Phinehas",
          "Gershom", "Eliezer",
        ],
      },
      {
        id: "consecration",
        label: "Setting Up the Tabernacle",
        emoji: "🕯️",
        ref: "Exodus 40:1-13",
        subtitle: "The order Moses raised & consecrated it · OSB Exodus 40",
        // Exodus 40:1-13 — the ORDER God commanded Moses to raise and
        // consecrate the tabernacle, ending with the priests. This lab tests
        // the temporal sequence ("first..., then..."); the companion lab
        // "Place the Holy Things" tests the SPATIAL layout of the same items.
        // The fuller Exodus 29 ordination rite (offerings, ordination ram, the
        // seven-day holy meal) is OUT of quiz scope and is not included.
        description:
          "On the first day of the first month, Moses raises the tabernacle from the inside out, anoints it all holy, then washes, clothes, and anoints Aaron and his sons. You are remembering the order God gave, not performing the rite.",
        tip: "Inside out: ark, then the Holy Place (table, lampstand, incense), then the door veil and the outer altar — anoint it all holy — then the priests at the door.",
        ordered_items: [
          "Set Up the Tabernacle",
          "Place the Ark & Veil",
          "Bring in the Table & Bread",
          "Bring in the Lampstand & Lamps",
          "Set the Altar of Incense",
          "Hang the Veil at the Door",
          "Set the Altar of Burnt Offering",
          "Anoint & Consecrate It All",
          "Wash Aaron & His Sons",
          "Clothe & Anoint Aaron",
          "Clothe & Anoint His Sons",
        ],
        item_emojis: [
          "🏕️", // Set up the tabernacle (Ex 40:2)
          "📜", // Put in the ark, cover it with the veil (Ex 40:3)
          "🍞", // Bring in the table & lay out its bread (Ex 40:4)
          "🕎", // Bring in the lampstand & install its lamps (Ex 40:4)
          "🪔", // Set the gold altar of incense before the ark (Ex 40:5)
          "🚪", // Put up the veil for the door (Ex 40:5)
          "🔥", // Set the altar of burnt offering before the door (Ex 40:6)
          "🫒", // Anoint & consecrate the tabernacle & all in it (Ex 40:7-9)
          "💧", // Bring Aaron & his sons to the door, wash them (Ex 40:10)
          "👕", // Clothe & anoint Aaron (Ex 40:11)
          "👔", // Clothe & anoint his sons (Ex 40:12-13)
        ],
        unlock: { chapters: [38, 39, 40], min: 1 },
        unlock_teaching: {
          headline: "Raised in God's Order",
          body:
            "The tabernacle is not thrown together — God gives Moses an exact order. Moses builds from the Most Holy outward, anoints everything holy, and consecrates the priests last, at the door. You are remembering the order God gave, not play-acting priestly rites.",
        },
        completion_teaching: {
          memory_sentence:
            "Moses raised the tabernacle from the ark outward, anointed it all holy, then washed, clothed, and anointed Aaron and his sons at the door.",
        },
        interaction: { type: "drag_order" },
      },
      {
        id: "tabernacle_place",
        label: "Place the Holy Things",
        emoji: "⛪",
        ref: "Exodus 40:1-33",
        subtitle: "OSB Ex 40 placements · 8 holy items on a map",
        // This is NOT the same as the bank's Erect/Furnish/Wash/Anoint
        // mnemonic (ex40-003/004). This is a movement-only drill — what
        // you see walking east→west through the courtyard. Consecration
        // happens BEFORE this in the bank's order.
        teacher_note:
          "Movement only — does NOT include Aaron's washing or anointing (see 'Holy Consecration' lab for that).",
        description:
          "The tabernacle is laid out west to east: God's presence over the Ark at the far west, the priest entering from the east. Place each holy item where it stands according to OSB Exodus 40.",
        tip:
          "Start at the east entrance and walk west — Bronze Altar → Laver → Holy Place (Table north, Lampstand south, Golden Altar before veil) → Ark in the Most Holy Place.",
        // 8 zones. Court + Court Gate collapsed to "East Entrance" to fix the
        // elimination-shortcut pedagogy problem (skeptic §2). The Courtyard
        // is split into two sub-zones (Bronze Altar slot + Laver slot) so
        // each card has a distinct drop target — fillCorrect can place both.
        tabernacle_zones: [
          // Top-level zones (rendered in document order).
          // Note (2026-06-28): Each zone shows ONLY a directional/room
          // label initially. The answer-name lives in `reveal_label` and
          // is swapped in ONLY after a correct placement, so the user
          // cannot memorize positions by reading the map.
          {
            id: "most_holy",
            label: "Most Holy Place",
            sublabel: "God's presence",
            reveal_label: "Ark of the Covenant",
            position: "west",
            pattern: "stripes",
            accept: ["ark"],
          },
          {
            id: "holy_place",
            label: "Holy Place",
            sublabel: "Priest enters here",
            position: "center",
            pattern: "dots",
            accept: [], // parent zone; only children accept
          },
          {
            id: "tabernacle_exterior",
            label: "Courtyard",
            sublabel: "Before the door",
            position: "east",
            pattern: "plain",
            accept: [], // parent zone; only children accept
          },
          {
            id: "east_entrance",
            label: "East Entrance",
            sublabel: "The court gate",
            reveal_label: "Court Gate",
            position: "east-edge",
            pattern: "plain",
            accept: ["east_entrance"],
          },
          // Nested zones inside Holy Place.
          {
            id: "table_zone",
            parent: "holy_place",
            label: "① North Wall",
            sublabel: "Holy Place",
            reveal_label: "Table of Showbread",
            position: "north",
            pattern: "dots",
            accept: ["table"],
          },
          {
            id: "lampstand_zone",
            parent: "holy_place",
            label: "① South Wall",
            sublabel: "Holy Place",
            reveal_label: "Lampstand",
            position: "south",
            pattern: "dots",
            accept: ["lampstand"],
          },
          {
            id: "incense_zone",
            parent: "holy_place",
            label: "Centered · against the west wall",
            sublabel: "Holy Place",
            reveal_label: "Golden Altar of Incense",
            position: "incense",
            pattern: "dots",
            accept: ["golden_altar"],
          },
          {
            id: "veil_zone",
            // Top-level zone (not nested under most_holy) so the grid can
            // render it as its own row between Most Holy Place and Holy
            // Place. The veil IS the divider — it lives between the two
            // rooms, not inside either of them.
            label: "Divider",
            sublabel: "Most Holy Place",
            reveal_label: "Veil (Parochet)",
            position: "veil",
            pattern: "stripes",
            accept: ["veil"],
          },
          // Nested zones inside Courtyard. DECLARATION ORDER IS SPATIAL:
          // the courtyard slot is a flex column (top = WEST, toward the
          // tent; bottom = EAST, toward the gate), so the FIRST child
          // renders highest/west. Per LXX (Ex 30:18; 40:30) the laver
          // stands BETWEEN the tabernacle and the altar — so walking in
          // from the east gate the order is Altar → Laver → Holy Place.
          // Therefore declare the Laver FIRST (higher/west) and the
          // Bronze Altar SECOND (lower/east, "before the door"). Do not
          // reorder these without re-checking the rendered Y positions.
          {
            id: "laver_zone",
            parent: "tabernacle_exterior",
            label: "Between tabernacle and altar",
            sublabel: "Courtyard",
            reveal_label: "Laver (Washing Basin)",
            position: "east",
            pattern: "plain",
            accept: ["laver"],
          },
          {
            id: "bronze_altar_zone",
            parent: "tabernacle_exterior",
            label: "Centered · before the door",
            sublabel: "Courtyard",
            reveal_label: "Bronze Altar of Burnt Offering",
            position: "east",
            pattern: "plain",
            accept: ["bronze_altar"],
          },
        ],
        tabernacle_cards: [
          // OSB Ex 40:3, 21 — Ark in Most Holy Place
          {
            id: "ark",
            label: "Ark of the Testimony",
            emoji: "📜",
            osb_ref: "Ex 40:3, 21",
          },
          {
            id: "veil",
            label: "Veil",
            emoji: "🟪",
            osb_ref: "Ex 40:21",
          },
          // OSB Ex 40:22-23 — Table on north side of Holy Place
          {
            id: "table",
            label: "Table of Showbread",
            emoji: "🍞",
            osb_ref: "Ex 40:22-23",
          },
          // OSB Ex 40:24-25 — Lampstand on south side
          {
            id: "lampstand",
            label: "Lampstand",
            emoji: "🕯️",
            osb_ref: "Ex 40:24-25",
          },
          // OSB Ex 40:24-25 — Golden Altar before the veil
          {
            id: "golden_altar",
            label: "Golden Altar of Incense",
            emoji: "🪔",
            osb_ref: "Ex 40:24-25",
          },
          // OSB Ex 40:30 + Ex 30:18 — between tabernacle and altar
          {
            id: "laver",
            label: "Bronze Laver",
            emoji: "🚰",
            osb_ref: "Ex 40:30; OSB Ex 30:18",
          },
          // OSB Ex 40:29 — Bronze Altar by the doors
          {
            id: "bronze_altar",
            label: "Bronze Altar of Burnt Offering",
            emoji: "🔥",
            osb_ref: "Ex 40:29",
          },
          // OSB Ex 40:33 — Court around the tabernacle and altar
          {
            id: "east_entrance",
            label: "East Entrance / Court Gate",
            emoji: "🚪",
            osb_ref: "Ex 40:33; Ex 27:13-16",
          },
        ],
        unlock: { chapters: [38, 39, 40], min: 6 },
        unlock_teaching: {
          headline: "Where God's Presence Dwells",
          body:
            "The tabernacle is a map of approach: God's presence sits at the far west, and the priest enters from the east. Every item has a place that teaches its role — closest to God, or closest to the people, or between.",
        },
        completion_teaching: {
          memory_sentence:
            "God's presence dwells in the Most Holy Place; the priest approaches through courtyard, altar, laver, and Holy Place to stand before the Ark.",
        },
        interaction: { type: "tabernacle_place" },
      },
    ],
  };
})();
