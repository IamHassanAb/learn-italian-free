// Service worker: makes the app work offline after the first visit.
// __VERSION__ and __FILES__ are filled in by build/app.py.
const VERSION = "__VERSION__";
const CACHE = "italiano-" + VERSION;
const FILES = __FILES__;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("italiano-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive as soon as you are online), cache as the offline fallback.
// Google Fonts are cached on first use.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;
  e.respondWith(
    (fonts ? caches.match(req).then((hit) => hit || fetchAndCache(req)) : fetchAndCache(req).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))))
  );
});
function fetchAndCache(req) {
  return fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
}
