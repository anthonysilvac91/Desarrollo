// Service Worker minimalista para habilitar la instalación PWA (beforeinstallprompt)
// No intercepta llamadas a la API ni realiza caché agresivo.

const CACHE_NAME = 'recall-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/app',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Ignorar errores de caché en desarrollo
        console.warn('SW: Algunos recursos no pudieron ser cacheados');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Implementación mínima de fetch (Network First para todo) para cumplir con requerimientos PWA
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;
  // Ignorar peticiones a APIs y Chrome Extensions
  if (event.request.url.includes('/api/') || event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
