const CACHE = 'cifrae-songbook-v2';
const CORE = ['./', './index.html', './songbook.html'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of CORE) {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(url, { cache: 'reload', redirect: 'follow' });
        if (response.ok && !response.redirected) {
          await cache.put(url, response.clone());
        }
      } catch (error) {
        // A falha de um arquivo não deve impedir a instalação do app.
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('cifrae-songbook-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        const isSongbook = url.pathname.endsWith('/songbook.html') || url.pathname === '/songbook.html';
        const fallbackPath = isSongbook ? './songbook.html' : './index.html';
        const fallback = await cache.match(new URL(fallbackPath, self.registration.scope));
        if (fallback) return fallback;
        return new Response('Esta página ainda não está disponível offline. Abra-a uma vez com internet e tente novamente.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }

    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected && response.type !== 'opaque') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
