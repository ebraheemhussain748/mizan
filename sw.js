/* Mizan service worker — keeps the app working offline.
   Network first for everything, so a new version shows up on the next visit;
   the cached copy is only used when there's no connection. */
const VERSION = 'mizan-v2.2.1';
const V = '?v=2.2.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './assets/css/app.css' + V,
  './assets/fonts/bricolage-grotesque.woff2',
  './assets/fonts/atkinson-hyperlegible-next.woff2',
  './assets/fonts/atkinson-hyperlegible-next-ext.woff2',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './assets/js/core.js' + V,
  './assets/js/config.js' + V,
  './assets/js/data-templates.js' + V,
  './assets/js/setup.js' + V,
  './assets/js/calc.js' + V,
  './assets/js/tt-custom.js' + V,
  './assets/js/sun.js' + V,
  './assets/js/data-growth.js' + V,
  './assets/js/data-foods.js' + V,
  './assets/js/mealplan.js' + V,
  './assets/js/data-exercises.js' + V,
  './assets/js/ui.js' + V,
  './assets/js/views-dashboard.js' + V,
  './assets/js/views-today.js' + V,
  './assets/js/views-plan.js' + V,
  './assets/js/views-habits.js' + V,
  './assets/js/views-body.js' + V,
  './assets/js/views-food.js' + V,
  './assets/js/views-welcome.js' + V,
  './assets/js/views-settings.js' + V,
  './assets/js/views-more.js' + V,
  './assets/js/backup.js' + V,
  './assets/js/assistant.js' + V,
  './assets/js/move.js' + V,
  './assets/js/beard.js' + V,
  './assets/js/looks.js' + V,
  './assets/js/app.js' + V
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // the app page (./, ./index.html, ./?n=…) is stored as ./index.html; other pages (privacy.html) under their own address
  const isApp = req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname);
  const key = isApp ? './index.html' : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key)
        .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : hit)))
  );
});

/* Taps on a notification (water reminders): tell the open app, or open it */
self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const kind = (n.data && n.data.kind) || '';
  const action = event.action || 'open';
  n.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) {
      const c = all[0];
      c.postMessage({ type: 'mizan-notification', kind, action });
      try { if ('focus' in c) await c.focus(); } catch (e) { /* ignore */ }
      return;
    }
    await self.clients.openWindow('./?n=' + encodeURIComponent(kind + ':' + action) + '#/dashboard');
  })());
});
