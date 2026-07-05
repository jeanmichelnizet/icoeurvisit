// ============================================================
// sw.js — service worker (offline resilience + installable PWA)
// ----------------------------------------------------------------
// Strategy, tuned for a QR-on-the-pontoon app on flaky mobile networks:
//   - App shell (HTML pages, app JS/CSS, manifest): NETWORK-FIRST.
//     Fresh content always wins when online; falls back to cache offline.
//     → we never get stuck serving a stale build.
//   - Heavy immutable assets (GLB model, audio, images, Three.js vendor,
//     fonts): CACHE-FIRST. Instant on repeat visits, works fully offline
//     once seen.
// Bump CACHE to invalidate everything on the next visit.
// ============================================================

const CACHE = 'ic-cache-v4';

// Precache the app shell so the very first offline load works. The heavy
// media (GLB, audio) is cached on demand instead, to keep install light.
const PRECACHE = [
  './',
  'index.html', 'visite.html', 'projet.html', 'mecenat.html', 'sponsors.html',
  'assets/css/styles.css',
  'assets/js/i18n.js', 'assets/js/analytics.js', 'assets/js/content.js',
  'assets/js/panorama.js', 'assets/js/visite.js',
  'assets/vendor/three.min.js', 'assets/vendor/OrbitControls.js', 'assets/vendor/GLTFLoader.js',
  'assets/icons/favicon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ne JAMAIS intercepter/cacher les API externes (GitHub, Netlify) : l'admin
  // en a besoin toujours fraîches (sinon on sert une position de branche périmée → 422).
  if (url.hostname === 'api.github.com' || url.hostname === 'api.netlify.com') return;

  // Médias éditables (photos/vidéos/panoramas) : toujours frais depuis le réseau,
  // pour ne jamais rester bloqué sur une ancienne version cassée.
  if (/\/assets\/(photos|videos|panoramas)\//.test(url.pathname)) return;

  const sameOrigin = url.origin === self.location.origin;

  // App shell → network-first (vendor library is treated as immutable below).
  const isShell =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/manifest.webmanifest') ||
    (sameOrigin && /\.(?:js|css)$/.test(url.pathname) && !url.pathname.includes('/assets/vendor/'));

  event.respondWith(isShell ? networkFirst(req) : cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const home = (await cache.match('index.html')) || (await cache.match('./'));
      if (home) return home;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}
