/* Pruebas del rediseño 2026-11-28 «Balance»: shell con riel derecho y barra
   inferior, panel con gráfica de pedidos abiertos y los cinco documentos
   imprimibles A4 con un solo motor.
   Ejecutar con: node --test tools/documents.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './serve.mjs';

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function loadOpenStats(orders, paidByOrder) {
  const context = vm.createContext({
    orders,
    orderPaid: (order) => paidByOrder[order.id] || 0,
    orderBalance: (order) => Math.max(0, (Number(order.total) || 0) - (paidByOrder[order.id] || 0)),
    roundMoney: round,
    money: (amount) => `$${Number(amount).toFixed(2)}`,
    safe: (value) => String(value ?? '')
  });
  vm.runInContext(
    `${extractFunction(html, 'openOrderStats')}\nglobalThis.stats=openOrderStats;`,
    context,
    { filename: 'open-stats.js' }
  );
  return JSON.parse(JSON.stringify(context.stats()));
}

test('navegación: riel a la derecha en escritorio y barra inferior en móvil', () => {
  // Escritorio: el contenido va primero y el riel ocupa la segunda columna.
  assert.match(html, /\.shell\{display:grid;grid-template-columns:minmax\(0,1fr\) var\(--rail-w\);min-height:100vh/);
  assert.match(html, /\.side\{order:2;/);
  assert.match(html, /\.main\{order:1;/);
  // Móvil: el riel se vuelve barra fija al pie, con área segura de iOS.
  assert.match(html, /@media\(max-width:900px\)\{[\s\S]*?\.side\{order:0;position:fixed;left:0;right:0;bottom:0;top:auto/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  // Los botones siguen siendo solo iconos con nombre accesible y tooltip.
  const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((nav.match(/class="nav-icon"/g) || []).length, 6);
  assert.doesNotMatch(nav, /nav-text/);
  assert.match(html, /\.nav button::after\{content:attr\(aria-label\)/);
});

test('panel: encabezado compacto con saludo breve, sin bloque de bienvenida', () => {
  assert.match(html, /class="home-bar"/);
  assert.match(html, /id="home-greeting"/);
  assert.match(html, /Buenos días\.|Buenas tardes\.|Buenas noches\./);
  assert.doesNotMatch(html, /home-heading|studio-hero|hero-metric|hero-copy/);
  // La gráfica manda: es el primer módulo del mosaico.
  const firstModule = html.indexOf('open-orders home-module');
  assert.ok(firstModule > 0);
  assert.ok(firstModule < html.indexOf('dispatch-panel home-module'));
});

test('gráfica: abonado + por cobrar suma el total de los pedidos abiertos', () => {
  const orders = [
    { id: 'a', total: 1000, delivery: { date: '2026-11-20' } },
    { id: 'b', total: 500 },
    { id: 'c', total: 800, delivery: { date: '2026-11-26' } },
    { id: 'd', total: 300 }
  ];
  const stats = loadOpenStats(orders, { a: 400, b: 500, c: 800, d: 0 });
  // «c» se entregó y se cobró por completo: sale de la gráfica.
  // «a» se entregó pero debe 600, así que sigue abierto. «b» se cobró y aún no se entrega.
  assert.deepEqual(stats.rows.map((row) => row.order.id).sort(), ['a', 'b', 'd']);
  assert.equal(stats.total, 1800);
  assert.equal(stats.paid, 900);
  assert.equal(stats.due, 900);
  assert.equal(round(stats.paid + stats.due), stats.total);
  // Lo que más se debe va primero.
  assert.equal(stats.rows[0].order.id, 'a');
});

test('gráfica: cada barra se apila en abonado y por cobrar, y lo liquidado se marca', () => {
  assert.match(html, /class="open-bar-plot"/);
  assert.match(html, /class="open-bar-due"/);
  assert.match(html, /class="open-bar-paid"/);
  assert.match(html, /\.open-bar-paid\{width:100%;background:linear-gradient\(180deg,#5FD7CE,#49C7BE\)/);
  assert.match(html, /\.open-bar\.done/);
  assert.match(html, /data-home-action="payment"/);
  assert.match(html, /ABONADO \+ POR COBRAR = TOTAL/);
  assert.match(html, /function renderOpenChart\(stats\)/);
});

test('documentos: un solo motor A4 con la misma retícula y pie para los cinco formatos', () => {
  assert.match(html, /const DOC_META=\{[\s\S]*?quote:[\s\S]*?order:[\s\S]*?production:[\s\S]*?quality:[\s\S]*?delivery:/);
  for (const fn of ['docStyles', 'docHeader', 'docSigns', 'docFooter', 'docItemsTable', 'docTotals', 'docCoverage', 'docOpen', 'openPrintWindow']) {
    assert.ok(html.includes(`function ${fn}(`), `falta ${fn}`);
  }
  assert.match(html, /@page\{size:A4;margin:14mm 14mm 16mm\}/);
  assert.match(html, /font:700 19pt\/1 'Bricolage Grotesque'/);
  assert.match(html, /Mono Cromat &amp; Co\. · WhatsApp 55 4929 1166/);
  // Los formatos antiguos (Arial suelto, 780px) ya no existen.
  assert.doesNotMatch(html, /font:14px Arial/);
  assert.doesNotMatch(html, /max-width:780px/);
});

test('documentos: cada formato tiene su función y su título', () => {
  const expected = {
    printQuote: 'COTIZACIÓN',
    printOrder: 'PEDIDO',
    printProduction: 'ORDEN DE PRODUCCIÓN',
    printQuality: 'CONTROL DE CALIDAD',
    printDelivery: 'GUÍA DE ENTREGA'
  };
  for (const [fn, label] of Object.entries(expected)) {
    assert.ok(html.includes(`function ${fn}(`), `falta ${fn}`);
    assert.ok(html.includes(`${label}`), `falta el título ${label}`);
  }
  assert.match(html, /DOC_META\.quality/);
  assert.match(html, /DOC_META\.delivery/);
  // Todos los botones están cableados en la interfaz.
  assert.match(html, /onclick="printQuote\(\)"/);
  assert.match(html, /onclick="printOrder\(\)"/);
  assert.match(html, /onclick="printProduction\(\)"/);
  assert.match(html, /onclick="printQuality\(\)"/);
  assert.match(html, /onclick="printDelivery\(\)"/);
  assert.match(html, /onclick="printQuoteOrder\(\)"/);
});

test('documentos: cotización con partidas, totales, condiciones y vigencia', () => {
  const quote = extractFunction(html, 'printQuote');
  assert.match(quote, /docItemsTable\(q\.items\)/);
  assert.match(quote, /docTotals\(q,\{showBalance:false\}\)/);
  assert.match(quote, /Incluye y condiciones/);
  assert.match(quote, /Cotización válida por/);
  assert.match(quote, /spec\.validity/);
  assert.match(quote, /QUOTE_STATUS\[q\.status\]/);
});

test('documentos: pedido y guía muestran el saldo real de cada pedido', () => {
  assert.match(html, /function coverageText\(o\)/);
  assert.match(html, /docTotals\(o,\{showBalance:true\}\)/);
  const delivery = extractFunction(html, 'printDelivery');
  assert.match(delivery, /Contra entrega/);
  assert.match(delivery, /Saldo a la entrega/);
  assert.match(delivery, /docItemsTable\(o\.items,\{showMoney:false\}\)/);
  assert.match(delivery, /quality\?\.approved/);
});

test('documentos: producción y calidad son internos y llevan checklist', () => {
  const production = extractFunction(html, 'printProduction');
  assert.match(html, /kicker:'DOCUMENTO INTERNO \/ TALLER'/);
  assert.match(production, /Checklist de taller/);
  assert.match(production, /showMoney:false/);
  const quality = extractFunction(html, 'printQuality');

  assert.match(html, /kicker:'DOCUMENTO INTERNO \/ REVISIÓN'/);
  assert.match(quality, /Puntos de revisión/);
  assert.match(quality, /q\.approved/);
  assert.match(html, /function printQuality\(order\)/);
});

test('marca: wordmark y monograma nuevos en todos sus formatos', () => {
  for (const file of ['wordmark-navy.png', 'wordmark-light.png', 'wordmark-white.png', 'monogram-navy.png', 'monogram-blue.png', 'monogram-light.png']) {
    assert.ok(existsSync(path.join(ROOT, 'assets/brand', file)), `falta assets/brand/${file}`);
  }
  assert.match(html, /class="top-wordmark" src="assets\/brand\/wordmark-navy\.png"/);
  assert.match(html, /class="brand-mono" src="assets\/brand\/monogram-light\.png"/);
  assert.match(html, /new URL\('assets\/brand\/wordmark-navy\.png',location\.href\)/);
});
