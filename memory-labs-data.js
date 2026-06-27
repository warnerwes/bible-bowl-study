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
          { id: "nadab", label: "Son of Aaron", accept: "Nadab", row: 5, branch: "aaron" },
          { id: "abihu", label: "Son of Aaron", accept: "Abihu", row: 5, branch: "aaron" },
          { id: "eleazar", label: "Son of Aaron", accept: "Eleazar", row: 5, branch: "aaron" },
          { id: "ithamar", label: "Son of Aaron", accept: "Ithamar", row: 5, branch: "aaron" },
          { id: "phinehas", label: "Son of Eleazar", accept: "Phinehas", row: 6, branch: "eleazar" },
          { id: "gershom", label: "Son of Moses", accept: "Gershom", row: 5, branch: "moses" },
          { id: "eliezer", label: "Son of Moses", accept: "Eliezer", row: 6, branch: "moses" },
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
        label: "Holy Consecration",
        emoji: "🕯️",
        ref: "Exodus 29",
        subtitle: "Remembering God's institution · not performing the rite",
        description:
          "God sets Aaron and his sons apart through washing, vesting, anointing, offerings, and a holy meal — in His commanded order.",
        tip: "Prepare, wash, clothe, anoint, offer, ordain, eat, complete.",
        ordered_items: [
          "Prepare Offerings",
          "Wash Priests",
          "Clothe Aaron",
          "Anoint Aaron",
          "Clothe His Sons",
          "Sin Offering",
          "Burnt Offering",
          "Ordination Ram",
          "Holy Meal & 7 Days",
        ],
        unlock: { chapters: [25, 26, 27, 28, 29, 30, 31, 35, 36, 37, 38, 39, 40], min: 10 },
        unlock_teaching: {
          headline: "Set Apart for God",
          body:
            "Consecration is God setting persons apart for holy service — not a magic costume change. You are remembering the order God gave, not play-acting priestly rites.",
        },
        completion_teaching: {
          memory_sentence:
            "Holy service begins by God's command, in God's order, for God's glory.",
        },
        interaction: { type: "drag_order" },
      },
    ],
  };
})();
