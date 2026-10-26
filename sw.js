/* Rawaq service worker: keeps the whole app on the device so it opens with no connection.
   Every app file is cached under one version; a new version is installed all at once and used from the next launch.
   Requests to other sites (the optional bridges) are never touched or cached.
   After changing any app file, run `node scripts/stamp-sw.js` (VERSION is a hash of the files;
   tests/audit.test.js fails if it's out of date or if a file is missing from this list). */
const VERSION = 'rawaq-6af752b962bb';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable.svg',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/shortcut-breathe.png',
  'icons/shortcut-breathe.svg',
  'icons/shortcut-capture.png',
  'icons/shortcut-capture.svg',
  'icons/shortcut-focus.png',
  'icons/shortcut-focus.svg',
  'css/rawaq.css',
  'js/app.js',
  'js/core.js',
  'js/exports.js',
  'js/integrations/gdrive.js',
  'js/integrations/google.js',
  'js/integrations/mstodo.js',
  'js/integrations/net.js',
  'js/integrations/notion.js',
  'js/integrations/obsidian.js',
  'js/integrations/payloads.js',
  'js/screens/applications.js',
  'js/screens/body.js',
  'js/screens/bridges.js',
  'js/screens/connection.js',
  'js/screens/decisions.js',
  'js/screens/faith.js',
  'js/screens/focus.js',
  'js/screens/inbox.js',
  'js/screens/letters.js',
  'js/screens/more.js',
  'js/screens/papers.js',
  'js/screens/questions.js',
  'js/screens/reset.js',
  'js/screens/review.js',
  'js/screens/settings.js',
  'js/screens/sleep.js',
  'js/screens/today.js',
  'js/screens/week.js',
  'js/screens/welcome.js',
  'js/screens/wins.js',
  'js/screens/work.js',
  'js/seed.js',
  'js/store.js',
  'js/sync.js',
  'js/ui.js',
  'fonts/aref-ruqaa-arabic-400-normal.woff2',
  'fonts/aref-ruqaa-latin-400-normal.woff2',
  'fonts/fraunces-latin-400-normal.woff2',
  'fonts/fraunces-latin-600-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-400-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-600-normal.woff2',
  'fonts/ibm-plex-sans-latin-400-normal.woff2',
  'fonts/ibm-plex-sans-latin-500-normal.woff2',
  'fonts/ibm-plex-sans-latin-600-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rawaq-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // bridges talk to their services directly
  if (url.pathname.endsWith('/sw.js')) return; // the browser checks for updates to this file itself
  if (req.mode === 'navigate') {
    // Any page address (including ?code=… coming back from a sign-in) opens the cached app.
    event.respondWith(caches.open(VERSION).then((c) => c.match('index.html')).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(
    caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
