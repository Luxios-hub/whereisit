// Cache-first app shell so the compass works offline for the last state.
// Geocoding requests (nominatim) are network-only.

const CACHE = 'whereisit-v5';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/geo.js',
  './js/compass.js',
  './js/search.js',
  './js/scene.js',
  './js/sky.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // nominatim etc: network only
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html') })
      .then((hit) => hit || fetch(e.request))
  );
});
