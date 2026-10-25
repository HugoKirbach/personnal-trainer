// Service worker : fonctionnement hors ligne et rappel du jour.
const VERSION = 'v7';
// Module de compte (Firebase, versionné dans l'URL) : gardé en cache pour retrouver sa session hors ligne.
const SDK_CACHE = 'pt-sdk-10.12.2';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/program.js', 'js/store.js', 'js/timer.js', 'js/charts.js', 'js/calendar.js', 'js/guided.js', 'js/guides.js', 'js/lifts.js', 'js/voice.js', 'js/cloud.js', 'js/merge.js', 'js/projects.js', 'js/photos.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/badge.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(`pt-${VERSION}`).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pt-v') && k !== `pt-${VERSION}`).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK_CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((res) => {
      const copy = res.clone();
      caches.open(`pt-${VERSION}`).then((c) => c.put(e.request, copy));
      return res;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function remindToday() {
  const c = await caches.open('pt-data');
  const plan = await (await c.match('plan.json'))?.json();
  if (!plan?.enabled) return;
  const date = today();
  const sent = (await (await c.match('notified.json'))?.json()) || {};
  if (sent[date]) return;
  const items = plan.items.filter((i) => i.date === date);
  if (!items.length) return;
  const first = items[0];
  await self.registration.showNotification(`Aujourd'hui : ${first.title} à ${first.time}`, {
    body: `💡 ${first.tip}`,
    tag: `rappel-${date}`,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge.png',
  });
  await c.put('notified.json', new Response(JSON.stringify({ [date]: true })));
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'rappel-seance') e.waitUntil(remindToday());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    const open = list.find((w) => 'focus' in w);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});
