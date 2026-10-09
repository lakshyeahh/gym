/* Offline support: network-first (so plan updates show up), cache fallback at the gym. */
const CACHE = 'gymplan-v1';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'plan.js', 'figures.js', 'dev-stub.js',
  'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const fromNet = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; });
  const timeout = new Promise((_, rej) => setTimeout(rej, 3000));
  e.respondWith(Promise.race([fromNet, timeout]).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(r => r || fromNet.catch(() => caches.match('index.html')))));
});
