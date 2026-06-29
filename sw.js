/* Bible Bowl Study service worker.
   Network-first AND cache-bypassing: every online request goes straight to the
   server (cache: "no-store"), so a new deploy reaches visitors immediately
   instead of waiting for the browser's HTTP cache to expire. The Cache Storage
   copy is kept only as an offline fallback. Bump CACHE on a breaking change to
   purge old caches.

   SPA fallback: this is a single-page app that uses pushState for navigation
   (/quiz/N, /results). When the user reloads at one of those paths (or the
   PWA wakes up at one), the static server returns 404 because there's no
   file at that path. We detect navigation requests with a non-root path
   and, if the network doesn't have a real file, serve index.html instead.
   The app's handlePopstate() then routes from the URL to the right screen. */
const CACHE = "bbs-cache-v22";
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
  // Navigation requests to paths the static server doesn't have (like
  // /quiz/3 or /results — used by our pushState routing) get a 404
  // online. We treat any same-origin GET whose path is not a known
  // static asset as a navigation, and fall back to index.html if the
  // network doesn't have it.
  const url = new URL(req.url);
  const isAsset = /\.[a-zA-Z0-9]{1,6}(\?|$)/.test(url.pathname); // has a file extension
  const isNav = req.mode === "navigate" || (!isAsset && url.pathname !== "/" && req.headers.get("accept")?.includes("text/html"));
  e.respondWith(
    // Always fetch fresh from the network, bypassing the browser HTTP cache, so
    // a deploy is picked up at once. Store the result for offline use, and fall
    // back to the cached copy only when the network is unavailable.
    fetch(req, { cache: "no-store" })
      .then((res) => {
        // For navigation requests that 404, serve index.html instead.
        if (isNav && res.status === 404) {
          return caches.match("./index.html").then((m) => m || Response.error());
        }
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => {
        // Offline: serve from cache. For nav requests, prefer index.html
        // so the SPA can route from the URL.
        if (isNav) {
          return caches.match("./index.html");
        }
        return caches.match(req).then((m) => m || caches.match("./index.html"));
      })
  );
});
