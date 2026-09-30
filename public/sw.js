/**
 * sw.js – PWA offline service worker
 * Do NOT cache private /api responses
 */
const CACHE_NAME = 'stroke-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/sync.css',
  '/js/app.js',
  '/js/sync.js',
  '/js/maths.js',
  '/js/science.js',
  '/js/codeArena.js',
  '/data/elements.json',
  '/vendor/three.module.js',
  '/vendor/OrbitControls.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(u => new Request(u, { cache:'reload' }))).catch(err=>{
        console.warn('[sw] cache addAll failed', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Do not cache /api – network only, no-store
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request, { cache:'no-store' }).catch(err=> {
        return new Response(JSON.stringify({ error:'offline', message: err.message }), {
          status: 503,
          headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
        });
      })
    );
    return;
  }

  // For other requests, cache-first then network
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          // cache successful same-origin static
          if (resp.ok && url.origin === self.location.origin) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache=> cache.put(event.request, clone));
          }
          return resp;
        }).catch(()=>{
          // fallback to index.html for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});
