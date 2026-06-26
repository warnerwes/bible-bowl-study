/* Bible Bowl Study service worker.
   Network-first AND cache-bypassing: every online request goes straight to the
   server (cache: "no-store"), so a new deploy reaches visitors immediately
   instead of waiting for the browser's HTTP cache to expire. The Cache Storage
   copy is kept only as an offline fallback. Bump CACHE on a breaking change to
   purge old caches. */
const CACHE = "bbs-cache-v2";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./data/questions.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  // Seed the offline cache with fresh copies (bypass the HTTP cache).
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(CORE.map((u) => new Request(u, { cache: "reload" }))).catch(() => {})
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // Always fetch fresh from the network, bypassing the browser HTTP cache, so
    // a deploy is picked up at once. Store the result for offline use, and fall
    // back to the cached copy only when the network is unavailable.
    fetch(req, { cache: "no-store" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});
