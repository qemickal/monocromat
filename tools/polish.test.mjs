/* Pruebas de la pulida 2026-11-25: dashboard "Hoy en el taller", respaldo,
   cotización con especificación y partidas, envío por WhatsApp, marca y versión.
   Ejecutar con: node --test tools/polish.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './serve.mjs';

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const swSource = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start > -1, `no se encontró la función ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`función ${name} incompleta`);
}

function loadHelpers() {
  const statusMatch = html.match(/const QUOTE_STATUS=\{[^}]*\};/);
  assert.ok(statusMatch, 'no se encontró QUOTE_STATUS');
  const code = [
    statusMatch[0],
    extractFunction(html, 'todayISO'),
    extractFunction(html, 'daysSince'),
    extractFunction(html, 'orderStage'),
    extractFunction(html, 'orderPaid'),
    extractFunction(html, 'orderBalance'),
    extractFunction(html, 'parseBackup'),
    extractFunction(html, 'normalizeQuote'),
    extractFunction(html, 'normalizeOrder'),
    'globalThis.api={daysSince,orderStage,orderPaid,orderBalance,parseBackup,normalizeQuote,normalizeOrder};'
  ].join('\n');
  const context = vm.createContext({});
  vm.runInContext(code, context, { filename: 'polish-core.js' });
  return context.api;
}

function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'no es un PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('marca: papel #FAF7F4 y Blanco Hielo #F5F8FA, sin el gris anterior', () => {
  assert.match(html, /--paper:#FAF7F4/);
  assert.ok(html.includes('#F5F8FA'), 'falta Blanco Hielo #F5F8FA');
  assert.doesNotMatch(html, /#f5f6f2/);
  assert.equal(manifest.background_color, '#F5F8FA');
});

test('versión: CACHE_VERSION v5 y los íconos M precacheados', () => {
  assert.match(swSource, /const CACHE_VERSION = 'v5'/);
  for (const icon of ['/icons/m-192.png', '/icons/m-512.png', '/icons/m-maskable-512.png', '/icons/m-apple-touch-icon.png']) {
    assert.ok(swSource.includes(`'${icon}'`), `falta ${icon} en el precache`);
  }
});

test('ícono M: existe, es cuadrado y del tamaño declarado (trazo de la M de Mick, no el mono)', async () => {
  for (const [file, size] of [['icons/m-192.png', 192], ['icons/m-512.png', 512], ['icons/m-maskable-512.png', 512], ['icons/m-apple-touch-icon.png', 180]]) {
    const buffer = readFileSync(path.join(ROOT, file));
    assert.deepEqual(pngSize(buffer), { width: size, height: size }, `${file} no mide ${size}x${size}`);
  }
  // El ícono del mono sigue en el repo: la M es candidata, no un reemplazo silencioso.
  assert.ok(await fs.access(path.join(ROOT, 'icons/icon-512.png')).then(() => true).catch(() => false));
});

test('dashboard: "Hoy en el taller" es una cola de trabajo, no una rejilla de tarjetas', () => {
  assert.match(html, /Hoy en el taller/);
  assert.match(html, /id="hoy-list"/);
  assert.match(html, /Hoy — entregas/);
  assert.match(html, /En producción ahora/);
  assert.match(html, /Dinero que falta/);
  assert.match(html, /Cotizaciones esperando/);
  assert.match(html, /Registrar abono/);
  assert.match(html, /Recordar por WhatsApp/);
  assert.doesNotMatch(html, /id="home-projects"/);
  assert.doesNotMatch(html, /PROYECTOS RECIENTES/);
});

test('dashboard: la etapa y el saldo se derivan de los datos, no de texto fijo', () => {
  const { orderStage, orderBalance, daysSince } = loadHelpers();
  assert.equal(orderStage({}), 'Confirmado');
  assert.equal(orderStage({ production: {} }), 'Producción');
  assert.equal(orderStage({ production: {}, quality: { approved: true } }), 'Calidad');
  assert.equal(orderStage({ delivery: { date: '2026-12-01' } }), 'Entrega');
  assert.equal(orderBalance({ total: 1000, payments: [{ cents: 40000 }] }), 600);
  assert.equal(orderBalance({ total: 1000, payments: [{ cents: 100000 }] }), 0);
  assert.equal(daysSince('2026-11-25'), Math.max(0, Math.round((new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - new Date(2026, 10, 25)) / 86400000)));
  assert.equal(daysSince('no-fecha'), 0);
});

test('respaldo: exportar e importar JSON están en el panorama y validan el archivo', () => {
  assert.match(html, /onclick="exportBackup\(\)"/);
  assert.match(html, /id="backup-file"/);
  assert.match(html, /onchange="importBackupFile\(this\)"/);
  assert.match(html, /function buildBackup\(\)/);
  assert.match(html, /function parseBackup\(data\)/);
  const { parseBackup } = loadHelpers();
  const data = parseBackup({ app: 'mono-cromat', clients: [{ id: 'c1' }], quotes: [], orders: [], counters: { quote: 2, order: 3 } });
  assert.equal(data.clients.length, 1);
  assert.equal(data.counters.quote, 2);
  assert.equal(data.counters.order, 3);
  assert.throws(() => parseBackup({ app: 'otra-app' }), /Respaldo no válido/);
  assert.throws(() => parseBackup(null), /Respaldo no válido/);
});

test('cotización: especificación real del taller y acabados estrella', () => {
  for (const id of ['q-service', 'q-qty', 'q-format', 'q-paper', 'q-delivery', 'q-deposit', 'q-validity']) {
    assert.ok(html.includes(`id="${id}"`), `falta el campo ${id}`);
  }
  for (const service of ['Offset', 'Serigrafía', 'Encuadernación artesanal', 'Textil DTF']) {
    assert.ok(html.includes(`<option>${service}</option>`), `falta el servicio ${service}`);
  }
  for (const finish of ['Texturas en frío', 'Hot stamping', 'Laminados térmicos']) {
    assert.ok(html.includes(`value="${finish}"`), `falta el acabado ${finish}`);
  }
  assert.match(html, /id="quote-errors"/);
  assert.match(html, /id="draft-status"/);
  assert.match(html, /Borrador guardado/);
});

test('cotización: las opciones son partidas cantidad × precio unitario', () => {
  assert.match(html, /class="opt-qty"/);
  assert.match(html, /class="opt-unit"/);
  assert.match(html, /class="opt-price opt-total"/);
  assert.match(html, /qty\*unit/);
  assert.match(html, /Máximo 3 opciones visibles/);
  const { normalizeQuote } = loadHelpers();
  const quote = normalizeQuote({ id: 'q1', fields: ['Ana'], options: [{ name: 'Única', description: '', price: '100', selected: true, hidden: false }], conditions: '' }, '2024-01-01');
  assert.equal(quote.options.length, 3);
  assert.equal(quote.options[0].qty, 1);
  assert.equal(quote.options[0].unit, '');
  assert.equal(JSON.stringify(quote.spec), JSON.stringify({ service: '', quantity: '', format: '', paper: '', finishes: [], deliveryDate: '', deposit: '', validity: '' }));
});

test('cotización: crear pedido pasa por confirmación con resumen, no por un solo clic', () => {
  assert.match(html, /id="order-confirm"/);
  assert.match(html, /id="order-confirm-text"/);
  assert.match(html, /onclick="confirmCreateOrder\(\)"/);
  assert.match(html, /onclick="cancelCreateOrder\(\)"/);
  assert.match(html, /function showOrderConfirm\(q\)/);
});

test('envío: WhatsApp real y sin QR falso ni texto de "no se envía"', () => {
  assert.match(html, /onclick="sendQuoteWhatsApp\(\)"/);
  assert.match(html, /wa\.me\//);
  assert.match(html, /525549291166/);
  assert.doesNotMatch(html, /Espacio para código QR/);
  assert.doesNotMatch(html, /qr-placeholder/);
  assert.doesNotMatch(html, /No se envían por correo/);
});

test('flujo: sin alert() ni confirm() del navegador en la app', () => {
  assert.doesNotMatch(html, /alert\(/);
  assert.doesNotMatch(html, /confirm\(/);
  assert.match(html, /function showAppToast\(/);
  assert.match(html, /function confirmToast\(/);
  assert.match(html, /function askDelete\(/);
});
