// Service worker: makes the app work offline after the first visit.
// 1843af7f1c and ["./", "config.json", "data/content.json", "fonts/README.md", "fonts/fraunces-latin.woff2", "fonts/jetbrains-mono-latin.woff2", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "icons/qr-app.png", "index.html", "js/install.js", "js/lib/calendar.js", "js/lib/clock.js", "js/lib/cloze.js", "js/lib/drills.js", "js/lib/errors.js", "js/lib/install.js", "js/lib/merge.js", "js/lib/numbers.js", "js/lib/own.js", "js/lib/register.js", "js/lib/rows.js", "js/lib/search.js", "js/lib/speech.js", "js/lib/srs.js", "js/lib/store.js", "js/lib/sync.js", "js/lib/syncconfig.js", "js/lib/tiers.js", "js/lib/translate.js", "js/lib/util.js", "js/lib/vocabdrills.js", "js/main.js", "js/ui.js", "js/views/drills.js", "js/views/gaps.js", "js/views/installcard.js", "js/views/library.js", "js/views/retell.js", "js/views/review.js", "js/views/scenarios.js", "js/views/search.js", "js/views/settings.js", "js/views/setup.js", "js/views/today.js", "js/views/translate.js", "js/views/write.js", "manifest.webmanifest", "styles.css"] are filled in by build/app.py.
const VERSION = "1843af7f1c";
const CACHE = "italiano-" + VERSION;
const FILES = ["./", "config.json", "data/content.json", "fonts/README.md", "fonts/fraunces-latin.woff2", "fonts/jetbrains-mono-latin.woff2", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "icons/qr-app.png", "index.html", "js/install.js", "js/lib/calendar.js", "js/lib/clock.js", "js/lib/cloze.js", "js/lib/drills.js", "js/lib/errors.js", "js/lib/install.js", "js/lib/merge.js", "js/lib/numbers.js", "js/lib/own.js", "js/lib/register.js", "js/lib/rows.js", "js/lib/search.js", "js/lib/speech.js", "js/lib/srs.js", "js/lib/store.js", "js/lib/sync.js", "js/lib/syncconfig.js", "js/lib/tiers.js", "js/lib/translate.js", "js/lib/util.js", "js/lib/vocabdrills.js", "js/main.js", "js/ui.js", "js/views/drills.js", "js/views/gaps.js", "js/views/installcard.js", "js/views/library.js", "js/views/retell.js", "js/views/review.js", "js/views/scenarios.js", "js/views/search.js", "js/views/settings.js", "js/views/setup.js", "js/views/today.js", "js/views/translate.js", "js/views/write.js", "manifest.webmanifest", "styles.css"];

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
