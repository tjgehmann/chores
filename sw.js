/* Familien-Dashboard – Service Worker
   Ermöglicht Offline-Nutzung: die App-Dateien werden gecacht.

   Zwei Strategien:
   - App-Code (HTML, JS, CSS): NETZ ZUERST, Cache nur als Rückfall. So kommt
     eine neue Version immer an, auch wenn die CACHE-Version unten vergessen
     wird. Damit ein langsames Netz den Start nicht blockiert, greift nach
     NET_TIMEOUT der Cache.
   - Alles andere (Icons, Manifest): Cache zuerst, das ändert sich kaum.

   Die CACHE-Version trotzdem bei Änderungen hochzählen – sie räumt alte
   Bestände weg. Vergessen ist seit „Netz zuerst" aber nicht mehr fatal. */
const CACHE = 'familien-dashboard-v22';
const CODE = /\.(?:js|css)$/;   // zusammen mit Navigationen: der App-Code
const NET_TIMEOUT = 3000;       // ms, danach lieber der Cache als warten
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

// Antwort im Hintergrund in den Cache legen (nur brauchbare Antworten).
function keep(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

// fetch mit Zeitlimit – sonst hängt der Start an einem lahmen WLAN.
// cache: 'reload' umgeht dabei den HTTP-Cache des Browsers: ohne das kann
// eine dort noch als frisch geltende Kopie die neue Version verdecken, und
// „Netz zuerst" liefert trotzdem alten Code aus.
function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req.url, { cache: 'reload', credentials: 'same-origin' }).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); });
  });
}

// Nur eigene Dateien – fremde Ziele (z. B. Supabase) gehen immer direkt
// ins Netz, sonst würde der Cache alte Datenstände liefern.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  const isCode = req.mode === 'navigate' || CODE.test(new URL(req.url).pathname);

  if (isCode) {
    // Netz zuerst: neue Versionen kommen sofort an. Bei Netzfehler oder
    // Zeitüberschreitung der Cache; ohne Cache regulär scheitern lassen.
    e.respondWith(
      fromNetwork(req, NET_TIMEOUT)
        .then((res) => keep(req, res))
        .catch(() => caches.match(req).then((cached) => cached || fetch(req)))
    );
    return;
  }

  // Alles Übrige: Cache zuerst, sonst nachladen.
  e.respondWith(
    caches.match(req).then((cached) => cached
      || fetch(req).then((res) => keep(req, res)).catch(() => cached))
  );
});
