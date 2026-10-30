// Duskwatch service worker (Pages build only). scripts/pages-sw.mjs copies this file to dist/sw.js
// and fills in the file list and build hash, so every deploy is a new worker.
// Cache-first: the game starts instantly and plays offline after the first visit. A new worker
// waits until the page asks it to take over ("New version, tap to update").
const BUILD = '__BUILD__';
const FILES = __FILES__;
const CACHE = `duskwatch-${BUILD}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('duskwatch-') && k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Every address (#lab, #lodge, ?query) is the same one-page app.
    event.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  }));
});
