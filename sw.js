// Offline support. Network-first so a new deploy is picked up immediately;
// the cache is only used when the network is unavailable.
const CACHE = 'frombirth-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// The page sends the list of files it loaded; store any that are missing.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache') return;
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(event.data.urls.map((url) =>
    cache.match(url).then((hit) => hit || cache.add(url).catch(() => { /* skip anything that fails */ }))))));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })));
});
