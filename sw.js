/* Familien-Dashboard – Service Worker
   Ermöglicht Offline-Nutzung: die App-Dateien werden gecacht.
   Bei jeder Änderung an den Dateien die CACHE-Version hochzählen. */
const CACHE = 'familien-dashboard-v11';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/store.js',
  './js/cloud.js',
  './js/ui.js',
  './js/kidmode.js',
  './js/start.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Cache-first: schnell und offline-fähig; sonst aus dem Netz nachladen.
// Nur eigene Dateien – fremde Ziele (z. B. Supabase) gehen immer direkt
// ins Netz, sonst würde der Cache alte Datenstände liefern.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
