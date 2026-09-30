const CACHE_NAME = 'stroke-v4-arcade-tabs';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/css/main.css','/css/sync.css',
  '/js/app.js','/js/sync.js','/js/maths.js','/js/science.js','/js/codeArena.js',
  '/data/elements.json',
  '/vendor/three.module.js','/vendor/OrbitControls.js','/vendor/es-module-shims.js',
  '/manifest.webmanifest'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS.map(u=>new Request(u,{cache:'reload'}))).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(url.pathname.startsWith('/api/')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{ if(r.ok){ const cl=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,cl)); } return r; }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/index.html'))));
    return;
  }
  if(e.request.method==='GET'){
    e.respondWith(caches.match(e.request).then(cached=>{ const fp=fetch(e.request).then(r=>{ if(r.ok&&url.origin===self.location.origin){ const cl=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,cl)); } return r; }).catch(()=>cached); return cached||fp; }));
  }
});
