/* Pruebas de la capa PWA: manifest, íconos, service worker, HTML y servidor.
   Ejecutar con: node --test tools/pwa.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { createStaticServer, ROOT } from './serve.mjs';

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const swSource = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const fileExists = async (relative) => {
  try {
    await fs.access(path.join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
};

function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'no es un PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseSwShell(source) {
  const start = source.indexOf('const SHELL = [');
  assert.ok(start > -1, 'no se encontró la lista SHELL');
  const end = source.indexOf('];', start);
  const block = source.slice(start, end);
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

test('manifest: cumple los requisitos mínimos de instalación', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length > 0);
  assert.ok(manifest.short_name && manifest.short_name.length <= 12, 'short_name debe ser corto');
  assert.match(manifest.start_url, /^\//);
  assert.match(manifest.scope, /^\//);
  assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display));
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.equal(manifest.lang, 'es-MX');

  const anyIcons = manifest.icons.filter((icon) => (icon.purpose || 'any').includes('any'));
  const sizes = anyIcons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'), 'falta el ícono 192x192');
  assert.ok(sizes.includes('512x512'), 'falta el ícono 512x512');
  assert.ok(manifest.icons.some((icon) => (icon.purpose || '').includes('maskable')), 'falta un ícono maskable');
  assert.ok(manifest.shortcuts.length >= 1);
  for (const shortcut of manifest.shortcuts) assert.match(shortcut.url, /^\/\?view=/);
});

test('íconos: existen, son cuadrados y del tamaño declarado', async () => {
  for (const icon of manifest.icons) {
    assert.ok(await fileExists(icon.src), `no existe ${icon.src}`);
    const size = pngSize(readFileSync(path.join(ROOT, icon.src)));
    assert.equal(size.width, size.height, `${icon.src} no es cuadrado`);
    assert.equal(`${size.width}x${size.height}`, icon.sizes, `${icon.src} no mide ${icon.sizes}`);
  }
  for (const extra of ['icons/apple-touch-icon.png', 'icons/favicon-32.png', 'favicon.ico', 'logo.png']) {
    assert.ok(await fileExists(extra), `no existe ${extra}`);
  }
  const apple = pngSize(readFileSync(path.join(ROOT, 'icons/apple-touch-icon.png')));
  assert.deepEqual(apple, { width: 180, height: 180 });
});

test('index.html: enlaza manifest, íconos y metadatos de instalación', () => {
  assert.match(head, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(head, /<meta name="theme-color" content="#081c30">/);
  assert.match(head, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(head, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(head, /name="apple-mobile-web-app-title" content="Mono Cromat"/);
  assert.match(head, /name="viewport" content="width=device-width,initial-scale=1"/);
  // Los metadatos deben estar en el head, no dentro de un <style>.
  const styles = [...head.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n');
  assert.ok(!styles.includes('<meta'), 'hay etiquetas meta dentro del CSS');
  assert.ok(!styles.includes('<link'), 'hay etiquetas link dentro del CSS');
});

test('index.html: registra el service worker y ofrece instalar/offline', () => {
  assert.match(html, /navigator\.serviceWorker\.register\('sw\.js'/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /appinstalled/);
  assert.match(html, /id="install-app"/);
  assert.match(html, /Añadir a pantalla de inicio/);
  assert.match(html, /navigator\.onLine/);
  assert.match(html, /view=quote&new=1/);
  assert.match(html, /matchMedia\('\(display-mode: standalone\)'\)/);
});

test('index.html: todos los recursos locales referenciados existen', async () => {
  const references = new Set();
  for (const match of html.matchAll(/<(?:img|link)[^>]+?(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|data:|\/\/)/.test(value) || value.includes('${')) continue;
    references.add(value);
  }
  for (const href of [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((match) => match[1])) {
    if (!/^(https?:|data:|\/\/)/.test(href) && !href.includes('${')) references.add(href);
  }
  for (const reference of references) {
    const clean = reference.split('?')[0].split('#')[0];
    assert.ok(await fileExists(clean), `recurso referenciado inexistente: ${reference}`);
  }
});

test('service worker: precachea el shell, evita /api y respeta el ciclo de vida', async () => {
  const shell = parseSwShell(swSource);
  for (const required of ['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/icons/icon-192.png', '/icons/icon-512.png']) {
    assert.ok(shell.includes(required), `falta ${required} en el precache`);
  }
  for (const url of shell) {
    const target = url === '/' ? 'index.html' : url.replace(/^\//, '');
    assert.ok(await fileExists(target), `el precache incluye un archivo inexistente: ${url}`);
  }
  assert.match(swSource, /addEventListener\('install'/);
  assert.match(swSource, /addEventListener\('activate'/);
  assert.match(swSource, /addEventListener\('fetch'/);
  assert.match(swSource, /skipWaiting/);
  assert.match(swSource, /startsWith\('\/api\/'\)/);
  assert.match(swSource, /request\.mode === 'navigate'/);
  assert.match(swSource, /const CACHE_VERSION = 'v\d+'/);
});

/* Arma un entorno mínimo de service worker para probar de verdad la estrategia offline. */
function createServiceWorkerHarness({ online = true } = {}) {
  const caches = new Map();
  class FakeCache {
    constructor() { this.entries = new Map(); }
    async put(request, response) {
      this.entries.set(typeof request === 'string' ? request : request.url, response.clone());
    }
    async match(request) {
      const key = typeof request === 'string' ? request : request.url;
      const response = this.entries.get(key);
      return response ? response.clone() : undefined;
    }
    async keys() {
      return [...this.entries.keys()].map((key) => new Request(new URL(key, 'http://localhost').href));
    }
    async delete(request) {
      const key = typeof request === 'string' ? request : request.url;
      return this.entries.delete(key);
    }
  }
  const cacheStorage = {
    async open(name) {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name);
    },
    async keys() { return [...caches.keys()]; },
    async delete(name) { return caches.delete(name); },
    async match(request) {
      for (const cache of caches.values()) {
        const response = await cache.match(request);
        if (response) return response;
      }
      return undefined;
    }
  };
  const listeners = new Map();
  const state = { online, requested: [], installed: false, claimed: false, skipped: false };
  const self = {
    location: new URL('http://localhost/sw.js'),
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    async skipWaiting() { state.skipped = true; },
    clients: { async claim() { state.claimed = true; } }
  };
  const context = vm.createContext({
    self,
    caches: cacheStorage,
    fetch: async (request) => {
      const url = typeof request === 'string' ? request : request.url;
      state.requested.push(url);
      if (!state.online) throw new TypeError('Failed to fetch');
      return new Response(`respuesta de ${url}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    },
    Request,
    Response,
    URL,
    console
  });
  vm.runInContext(swSource, context, { filename: 'sw.js' });
  assert.ok(listeners.has('install') && listeners.has('fetch'));

  async function dispatch(type, event) {
    let promise;
    const eventWithWait = Object.assign(event, {
      waitUntil(value) { promise = value; },
      respondWith(value) { event.respondedWith = value; }
    });
    for (const handler of listeners.get(type) || []) handler(eventWithWait);
    if (promise) await promise;
    if (event.respondedWith) event.respondedWith = await event.respondedWith;
    return event;
  }

  return { state, caches, dispatch };
}

test('service worker: instala el shell y responde sin conexión con el index cacheado', async () => {
  const harness = createServiceWorkerHarness();
  await harness.dispatch('install', {});
  assert.ok(harness.state.skipped, 'debe activarse con skipWaiting');

  // El index real se precarga cuando hay red:
  const onlineInstall = harness.caches.get('mono-shell-v1');
  assert.ok(onlineInstall.entries.has('http://localhost/index.html'));
  assert.ok(onlineInstall.entries.has('http://localhost/manifest.webmanifest'));
  assert.ok(onlineInstall.entries.has('http://localhost/icons/icon-512.png'));

  await harness.dispatch('activate', {});
  assert.ok(harness.state.claimed, 'debe tomar control de las pestañas');

  // Sin red: la navegación debe caer al index precacheado.
  harness.state.online = false;
  const offlineNavigation = await harness.dispatch('fetch', {
    request: { method: 'GET', url: 'http://localhost/?view=quote', mode: 'navigate', headers: new Headers() }
  });
  assert.equal(offlineNavigation.respondedWith.status, 200);
  assert.match(await offlineNavigation.respondedWith.text(), /respuesta de http:\/\/localhost\/index\.html/);

  // Con red: se sirve lo fresco y se actualiza el index guardado.
  harness.state.online = true;
  const onlineNavigation = await harness.dispatch('fetch', {
    request: { method: 'GET', url: 'http://localhost/?view=quote', mode: 'navigate', headers: new Headers() }
  });
  assert.equal(onlineNavigation.respondedWith.status, 200);
  assert.match(await onlineNavigation.respondedWith.text(), /respuesta de http:\/\/localhost\/\?view=quote/);
  const updatedIndex = await harness.caches.get('mono-shell-v1').match('http://localhost/index.html');
  assert.match(await updatedIndex.text(), /respuesta de http:\/\/localhost\/\?view=quote/);
});

test('service worker: no intercepta /api y cachea fuentes de Google', async () => {
  const harness = createServiceWorkerHarness();
  await harness.dispatch('install', {});

  const api = await harness.dispatch('fetch', {
    request: { method: 'GET', url: 'http://localhost/api/clients', mode: 'cors', headers: new Headers() }
  });
  assert.equal(api.respondedWith, undefined, '/api no debe pasar por la caché');

  const font = await harness.dispatch('fetch', {
    request: { method: 'GET', url: 'https://fonts.googleapis.com/css2?family=Inter', mode: 'cors', headers: new Headers() }
  });
  assert.ok(font.respondedWith, 'las fuentes deben servirse desde caché/red');
  const fontCache = harness.caches.get('mono-runtime-v1');
  assert.ok([...fontCache.entries.keys()].some((key) => key.includes('fonts.googleapis.com')));

  const post = await harness.dispatch('fetch', {
    request: { method: 'POST', url: 'http://localhost/api/login', mode: 'cors', headers: new Headers() }
  });
  assert.equal(post.respondedWith, undefined, 'los POST no se interceptan');
});

test('servidor: cabeceras de PWA, tipos MIME y respaldo de la app', async (t) => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  }));
  const base = `http://127.0.0.1:${server.address().port}`;

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /^text\/html/);
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  assert.match(await home.text(), /manifest\.webmanifest/);

  const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('content-type'), /^application\/manifest\+json/);

  const swResponse = await fetch(`${base}/sw.js`);
  assert.equal(swResponse.status, 200);
  assert.match(swResponse.headers.get('content-type'), /javascript/);
  assert.equal(swResponse.headers.get('service-worker-allowed'), '/');
  assert.match(swResponse.headers.get('cache-control'), /no-store/);

  const icon = await fetch(`${base}/icons/icon-192.png`);
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get('content-type'), 'image/png');

  const deepLink = await fetch(`${base}/?view=calendario`);
  assert.equal(deepLink.status, 200);
  assert.match(await deepLink.text(), /id="calendario"/);

  const missing = await fetch(`${base}/icons/no-existe.png`);
  assert.equal(missing.status, 404);

  const post = await fetch(`${base}/`, { method: 'POST' });
  assert.equal(post.status, 405);

  // Intento de salir del directorio raíz: nunca debe filtrar archivos.
  const traversal = await rawRequest(server.address().port, '/..%2f..%2fetc%2fpasswd');
  assert.equal(traversal.status, 404);
  assert.ok(!traversal.body.includes('root:'));

  // Los atajos del manifest (@view) abren la vista correcta.
  const shortcut = await fetch(`${base}/?view=quote&new=1`);
  assert.equal(shortcut.status, 200);
});

function rawRequest(port, rawPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}
