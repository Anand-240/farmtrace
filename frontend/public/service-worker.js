const CACHE_NAME = 'farmtrace-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Routes that work offline with cached data
const OFFLINE_ROUTES = [
  '/dashboard', '/mandi-prices', '/marketplace', '/market-advisory',
  '/govt-schemes', '/auction', '/quality-grading', '/warehouse',
  '/finance', '/dispute', '/buyer-ratings', '/gst-invoice'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-cacheable: API calls, external SDKs, hot-reload sockets
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('razorpay') ||
    url.hostname.includes('sentry') ||
    url.hostname.includes('posthog') ||
    url.hostname.includes('cloudinary') ||
    url.protocol === 'chrome-extension:'
  ) return;

  // Navigation requests: Network-first, fallback to cached index.html (SPA shell)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: Cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // All other requests: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background sync for offline form submissions (future use)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-forms') {
    // Retry any pending form submissions stored in IndexedDB
  }
});

// Push notifications support
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'FarmTrace', body: 'New update!' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'FarmTrace', {
      body: data.body,
      icon: '/logo192.png',
      badge: '/favicon.ico',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
