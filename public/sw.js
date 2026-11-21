const CACHE_NAME = 'family-card-survey-v3';
const TESSERACT_CACHE = 'tesseract-assets-v3';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching assets warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TESSERACT_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-only for API requests - never cache POST/GET/DELETE survey data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-First strategy for same-origin /tesseract/* assets and models
  // This guarantees 100% offline, fast on-device scanning even on Brave mobile
  if (
    url.pathname.startsWith('/tesseract/') ||
    url.hostname.includes('projectnaptha.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.pathname.endsWith('.traineddata.gz') ||
    url.pathname.endsWith('.wasm')
  ) {
    event.respondWith(
      caches.open(TESSERACT_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Stale-while-revalidate / cache-first for static assets & pages
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
