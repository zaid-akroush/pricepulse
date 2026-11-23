// The PWA/push service worker was removed. Browsers that installed the old one
// keep running it until it is replaced, so this version clears its caches and
// unregisters itself, then reloads open tabs onto the plain site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
