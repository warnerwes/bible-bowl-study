/* Passage links — builds external licensed passage URLs from a reference
   string. NO scripture text is fetched, displayed, or stored — only an
   outbound link to a licensed Bible host (Bible Gateway by default).
   Pure browser JS (ES module), framework-free.

   Bible Gateway terms permit linking to passage pages; the engine never
   reproduces scripture text itself. */
"use strict";

const PROVIDERS = {
  biblegateway: {
    name: "Bible Gateway",
    // Reference like "Genesis 1:1-5" → URL path /bible/VER/GEN/1.1-5
    // We use the search/passage shortcut which accepts a raw reference.
    build(ref, version) {
      const v = encodeURIComponent(version || "NKJV");
      const r = encodeURIComponent(ref || "");
      return `https://www.biblegateway.com/passage/?search=${r}&version=${v}`;
    },
    label(ref) {
      return `Read ${ref || ""} on Bible Gateway ↗`;
    },
  },
};

export function getProvider(name) {
  const key = (name || "biblegateway").toLowerCase();
  return PROVIDERS[key] || PROVIDERS.biblegateway;
}

// Build an external passage URL for a reference string (e.g. "Genesis 1:1-5").
export function passageUrl(ref, { provider, bibleVersion } = {}) {
  const p = getProvider(provider);
  return p.build(ref, bibleVersion);
}

// Human-readable label for a link pointing at the passage.
export function passageLabel(ref, { provider } = {}) {
  const p = getProvider(provider);
  return p.label(ref);
}