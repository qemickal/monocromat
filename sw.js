/* Mono Cromat & Co. — service worker
   Estrategia:
   - App shell precacheado en la instalación (para abrir sin red).
   - Navegación: red primero, con respaldo en el index cacheado.
   - Recursos estáticos: stale-while-revalidate.
   - Fuentes de Google: stale-while-revalidate en caché aparte.
   - /api/*: nunca se cachea (datos siempre frescos).
   Al publicar cambios en index.html hay que subir CACHE_VERSION.
   CACHE_VERSION vive solo aquí: es la única fuente de la versión de caché. */

const CACHE_VERSION = 'v10';
const SHELL_CACHE = `mono-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mono-runtime-${CACHE_VERSION}`;
const RUNTIME_LIMIT = 80;

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/assets/brand/monogram-navy.png',
  '/assets/brand/monogram-blue.png',
  '/assets/brand/monogram-light.png',
  '/assets/brand/wordmark-navy.png',
  '/assets/brand/wordmark-light.png',
  '/assets/brand/wordmark-white.png',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

// Los recursos se cachean con URL absoluta para que las claves sean estables.
const abs = (pathname) => new URL(pathname, self.location.origin).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Cada archivo se guarda por separado: si uno falla, la instalación sigue.
    await Promise.all(SHELL.map(async (url) => {
      try {
        const response = await fetch(new Request(abs(url), { cache: 'reload' }));
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(abs(url), response);
        }
      } catch (error) {
        // Sin red en la instalación: el archivo se cacheará en la primera visita.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isCacheable(response) {
  return Boolean(response) && (response.ok || response.type === 'opaque');
}

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - RUNTIME_LIMIT)).map((key) => cache.delete(key)));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request).then(async (response) => {
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      if (cacheName === RUNTIME_CACHE) await trimRuntimeCache();
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Datos del API: siempre a la red, nunca a la caché.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Navegación: red primero para recibir actualizaciones; sin red, app shell.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (isCacheable(fresh) && url.origin === self.location.origin) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(abs('/index.html'), fresh.clone());
          await cache.put(abs('/'), fresh.clone());
        }
        return fresh;
      } catch (error) {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(abs('/index.html')) || await cache.match(abs('/'));
        return cached || new Response(
          '<!doctype html><meta charset="utf-8"><title>Sin conexión</title><p>Mono Cromat no pudo cargar sin conexión. Vuelve a intentarlo cuando tengas red.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Fuentes y hojas de estilo de Google.
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Recursos estáticos del mismo origen.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
