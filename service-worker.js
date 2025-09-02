const VERSION = 'v1.0.0';
const PRECACHE = `precache-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const CORE = [
  '/', '/search.html', '/timeline.html',
  '/assets/css/site.css',
  '/assets/js/search-ui.js',
  '/assets/js/index-loader.js',
  '/assets/js/sw-register.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PRECACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(k => ![PRECACHE, RUNTIME].includes(k))
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/data/search-index.json')) {
    event.respondWith(
      fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(RUNTIME).then(c => c.put(event.request, copy));
      return res;
    }))
  );
});
