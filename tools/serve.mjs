#!/usr/bin/env node
/* Servidor estático de desarrollo y previsualización.
   Uso: node tools/serve.mjs  ->  http://localhost:4173
   Escucha en 0.0.0.0 para poder abrirse desde la previsualización. */

import { createServer as createHttpServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function cacheControlFor(filePath) {
  const name = path.basename(filePath);
  if (name === 'sw.js') return 'no-store, no-cache, must-revalidate, max-age=0';
  if (name.endsWith('.html') || name === 'manifest.webmanifest') return 'no-cache';
  return 'public, max-age=86400';
}

function extraHeadersFor(filePath) {
  const name = path.basename(filePath);
  if (name === 'sw.js') return { 'Service-Worker-Allowed': '/' };
  return {};
}

async function resolveFile(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null;

  let stats;
  try {
    stats = await fs.stat(candidate);
  } catch {
    return null;
  }
  if (stats.isDirectory()) {
    const index = path.join(candidate, 'index.html');
    try {
      const indexStats = await fs.stat(index);
      if (indexStats.isFile()) return index;
    } catch {
      return null;
    }
    return null;
  }
  return stats.isFile() ? candidate : null;
}

export function createStaticServer({ root = ROOT } = {}) {
  return createHttpServer(async (req, res) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Método no permitido');
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    let filePath = await resolveFile(url.pathname);

    // Rutas de la app (por ejemplo /?view=quote) siempre vuelven al index.
    const safeRoute = !url.pathname.includes('..') && !url.pathname.includes('\\');
    if (!filePath && safeRoute && !path.extname(url.pathname)) {
      filePath = path.join(root, 'index.html');
    }

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('No encontrado');
      return;
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': cacheControlFor(filePath),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...extraHeadersFor(filePath)
    });

    if (method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '0.0.0.0';
  createStaticServer().listen(port, host, () => {
    console.log(`Mono Cromat en http://localhost:${port} (escuchando en ${host}:${port})`);
  });
}
