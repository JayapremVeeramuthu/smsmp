const CACHE_NAME = 'mp-employee-cms-v1';

// Assets to cache immediately on service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-152.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline app shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if the request is for a static asset
function isStaticAsset(url) {
  const extension = url.pathname.split('.').pop();
  const staticExtensions = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'woff', 'woff2', 'ttf', 'eot'];
  return staticExtensions.includes(extension) || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests (e.g. Firebase POST requests/Firestore write calls)
  if (request.method !== 'GET') {
    return;
  }

  // Handle SPA routing: serve index.html for navigation requests so the app shell loads offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          console.log('[Service Worker] Navigation failed, serving cached offline app shell');
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Strategy for Static Assets (JS, CSS, Fonts, Images): Cache-First, fallback to Network
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          // Verify we got a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }

          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // If network fails, try fetching generic fallback image for image requests if necessary
          return new Response('Offline resource not found', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // For other requests: Network First, fallback to Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses dynamically if needed
        if (response.status === 200 && (url.origin === location.origin)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it's a API request or other, we just fail gracefully
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Future-Ready: Background Sync API Hook
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance-corrections') {
    console.log('[Service Worker] Background sync triggered for:', event.tag);
    event.waitUntil(
      // This is a placeholder hook where a background sync syncPendingRecords() function can be run
      Promise.resolve()
    );
  }
});

// Future-Ready: Background Sync for Firestore Offline Data / Firebase Cloud Messaging
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
