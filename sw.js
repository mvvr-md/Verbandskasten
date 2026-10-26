// Service Worker: Cache-first für alle App-Dateien.
// Der Cache-Name hängt an APP_VERSION aus version.js. Ändert sich die
// Version, installiert der Browser diesen Worker neu; er wartet dann, bis die
// App ihn per Nachricht "SKIP_WAITING" aktiviert (Tippen auf den Hinweis).
importScripts('./version.js');

const CACHE_PREFIX = 'verbandskasten-';
const CACHE = CACHE_PREFIX + 'v' + self.APP_VERSION;
const ASSETS = [
  './',
  './index.html',
  './version.js',
  './storage.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') {
        const index = await cache.match('./index.html');
        if (index) return index;
      }
      throw err;
    }
  })());
});
