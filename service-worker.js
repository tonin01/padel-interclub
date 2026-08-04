const CACHE_NAME = 'padel-interclub-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/store.js',
  './js/sync.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels vers Apps Script — toujours réseau.
  if (url.hostname.indexOf('script.google') > -1 || url.hostname.indexOf('script.googleusercontent') > -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Réseau en priorité pour toujours servir la dernière version déployée ;
  // le cache ne sert que de secours hors-ligne.
  event.respondWith(
    fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request))
  );
});
