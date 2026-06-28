// Service Worker for installability only.
// It does not cache pages, navigations, API responses, or application shell HTML.

const CACHE_NAME = "fentri-pwa-v3";
const ASSETS_TO_CACHE = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        console.warn("SW: some static assets could not be cached");
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (!ASSETS_TO_CACHE.includes(requestUrl.pathname)) return;

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
