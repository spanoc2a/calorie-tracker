self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nutrainer', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/', type: data.type || 'general' },
      tag: data.type || 'general', // remplace les notifs du même type
      renotify: true,
    })
  );

  // Si l'app est ouverte, envoyer un message au client pour rafraîchir
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      cs.forEach(c => c.postMessage({ type: 'PUSH_RECEIVED', data }));
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const c = cs.find(c => c.url.includes(self.location.origin));
      if (c) { c.focus(); c.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

const CACHE = 'nutrainer-v1';
const OFFLINE_ASSETS = ['/offline.html', '/icon.png', '/icon-192.png', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match('/offline.html'))
    )
  );
});

self.addEventListener('sync', e => {
  if (e.tag === 'nutrainer-sync') {
    e.waitUntil(Promise.resolve());
  }
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'nutrainer-daily') {
    e.waitUntil(Promise.resolve());
  }
});
