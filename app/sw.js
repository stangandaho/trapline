// App-shell service worker: cache-first so the app opens with no network.
// Bump VERSION whenever a shell file changes.
const VERSION = 'trapline-v35';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-64.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
  'icons/station.svg',
  'icons/camera.svg',
  'icons/deploy.svg',
  'icons/map.svg',
  'icons/export.svg',
  'icons/settings.svg',
  'icons/current_location.svg',
  'icons/undo.svg',
  'icons/clear_location.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/flatpickr/flatpickr.min.js',
  'vendor/flatpickr/flatpickr.min.css',
  'vendor/inter/inter-latin-wght-normal.woff2',
  'vendor/inter/inter-latin-ext-wght-normal.woff2',
  'js/app.js',
  'js/db.js',
  'js/util.js',
  'js/model.js',
  'js/export.js',
  'js/store.js',
  'js/ui.js',
  'js/sensors.js',
  'js/tiles.js',
  'js/views/shell.js',
  'js/views/projects.js',
  'js/views/stations.js',
  'js/views/devices.js',
  'js/views/deploy.js',
  'js/views/check.js',
  'js/views/map.js',
  'js/views/more.js',
  'js/zip.js',
  'js/i18n.js',
  'js/install.js',
  'js/views/env.js',
  'js/views/newproject.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache, so a new version never
  // stores stale copies of files that changed.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only the app shell; map tiles are handled by the page (IndexedDB).
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Stale-while-revalidate: answer from cache instantly (works offline), refresh
  // the cache in the background so a new version is picked up on next launch.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      // Revalidate against the server, not the browser's HTTP cache
      const req = e.request.mode === 'navigate'
        ? new Request(e.request.url, { cache: 'no-cache' })
        : new Request(e.request, { cache: 'no-cache' });
      const fresh = fetch(req).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      });
      if (hit) {
        e.waitUntil(fresh.catch(() => {}));
        return hit;
      }
      return fresh.catch(() => (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    }),
  );
});
