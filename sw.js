/**
 * Service worker — PWA installability + a thin offline safety net.
 * ---------------------------------------------------------------
 * Deliberately NOT a heavy offline-first cache. This app's whole point is
 * live data (traffic, emergency, power, weather), so:
 *
 *   - Cross-origin requests (the adapters' API calls to Main Roads WA,
 *     Emergency WA, Western Power, and the Leaflet/font CDNs) are never
 *     intercepted — they always go straight to the network. Serving a
 *     cached incident feed would be actively misleading.
 *   - Same-origin app-shell files (HTML/JS/CSS/icons) use network-first:
 *     if you're online, you always get the current file (important while
 *     this app is still being actively developed), and the cache is only
 *     a fallback for when the network request fails (offline, or the dev
 *     server isn't running).
 *
 * CACHE_VERSION bump forces old caches to be dropped on the next load —
 * bump it whenever the shell's file list changes.
 */

const CACHE_VERSION = 'wtg-shell-v2';

const SHELL_URLS = [
  'index.html',
  'incident.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/incident-page.js',
  'js/data/schema.js',
  'js/data/incident-repository.js',
  'js/data/dedupe.js',
  'js/data/mock-incidents.js',
  'js/map/map-init.js',
  'js/map/markers.js',
  'js/map/geolocation.js',
  'js/ui/incident-card.js',
  'js/ui/filters.js',
  'js/ui/feed.js',
  'js/ui/distance.js',
  'js/ui/theme.js',
  'js/tone/summary-modes.js',
  'adapters/main-roads-wa-adapter.js',
  'adapters/emergency-wa-adapter.js',
  'adapters/western-power-adapter.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Best-effort: don't fail install if one file 404s (e.g. shell list
      // drifts from disk during development).
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (live data + CDNs)

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('index.html')))
  );
});
