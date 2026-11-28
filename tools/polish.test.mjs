/* Pruebas del rediseño 2026-11-27: dashboard "Hoy en el taller", respaldo,
   cotización con especificación y partidas, envío por WhatsApp, marca y versión.
   Ejecutar con: node --test tools/polish.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
    extractFunction(html, 'roundMoney'),
    extractFunction(html, 'quoteLineTotal'),
    extractFunction(html, 'calculateQuoteTotals'),
    extractFunction(html, 'normalizeLineItems'),
    extractFunction(html, 'parseBackup'),
    extractFunction(html, 'normalizeQuote'),
    extractFunction(html, 'normalizeOrder'),
    'globalThis.api={daysSince,orderStage,orderPaid,orderBalance,roundMoney,quoteLineTotal,calculateQuoteTotals,normalizeLineItems,parseBackup,normalizeQuote,normalizeOrder};'
  ].join('\n');
  const context = vm.createContext({});
  vm.runInContext(code, context, { filename: 'polish-core.js' });
  return context.api;
}


function runQuoteErrors(fields, lineValues) {
  const rows = lineValues.map((item) => ({
    querySelector(selector) {
      if (selector === '.q-item-description') return { value: item.description };
      if (selector === '.q-item-quantity') return { value: item.quantity };
      if (selector === '.q-item-unit-price') return { value: item.unitPrice };
      return null;
    }
  }));
  const document = {
    querySelectorAll(selector) {
      if (selector === '.info .edit') return fields.map((value) => ({ value }));
      if (selector === '#quote-items .quote-item-row') return rows;
      return [];
    }
  };
  const context = vm.createContext({ document });
  vm.runInContext(`${extractFunction(html, 'quoteFormErrors')}\nglobalThis.validate=quoteFormErrors;`, context, { filename: 'quote-validation.js' });
  return JSON.parse(JSON.stringify(context.validate()));
}

test('marca: paleta del manual 2026 (Oxford, Dark Royal, Mint, Papel)', () => {
  assert.match(html, /--oxford:#071E33/);
  assert.match(html, /--royal:#24479D/);
  assert.match(html, /--mint:#49C7BE/);
  assert.match(html, /--paper:#F5F3ED/);
  assert.ok(html.includes('#F5F8FA'), 'falta Blanco Hielo #F5F8FA');
  assert.doesNotMatch(html, /#f5f6f2|#081c30|#fa876f/i);
  assert.equal(manifest.background_color, '#F5F3ED');
  assert.equal(manifest.theme_color, '#071E33');
});

test('tipografía: Bricolage Grotesque, Sora y Fira Mono del manual de marca', () => {
  assert.match(html, /family=Bricolage\+Grotesque/);
  assert.match(html, /family=Sora:wght@/);
  assert.match(html, /family=Fira\+Mono/);
  assert.doesNotMatch(html, /Lexend|Inter:wght@/);
});

test('versión: CACHE_VERSION v10 y el precache incluye solo recursos existentes', () => {
  assert.match(swSource, /const CACHE_VERSION = 'v10'/);
  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png']) {
    assert.ok(swSource.includes(`'${icon}'`), `falta ${icon} en el precache`);
  }
  assert.doesNotMatch(swSource, /\/icons\/m-(?:192|512|maskable-512|apple-touch-icon)\.png/);
});

test('paleta: sin acentos fuera del manual y saldo con mint teal', () => {
  assert.doesNotMatch(html, /#d9f27b|#e2f187|#d3e878|#d7e98e|#4cd8c0/i);
  assert.match(html, /\.balance-panel\{[^}]*#49C7BE/);
  assert.match(html, /\.open-meter-paid\{[^}]*#49C7BE/);
});

test('marca: wordmark y monograma activos en barra, riel, manifest y precache', () => {
  assert.match(html, /src="assets\/brand\/wordmark-navy\.png"/);
  assert.match(html, /src="assets\/brand\/monogram-light\.png"/);
  for (const asset of ['wordmark-navy.png', 'wordmark-light.png', 'wordmark-white.png', 'monogram-navy.png', 'monogram-blue.png', 'monogram-light.png']) {
    assert.ok(existsSync(path.join(ROOT, 'assets/brand', asset)), `falta assets/brand/${asset}`);
  }
  assert.ok(manifest.icons.some((icon) => icon.src === 'icons/icon-512.png'));
  assert.ok(swSource.includes("'/assets/brand/wordmark-navy.png'"));
  assert.ok(swSource.includes("'/assets/brand/monogram-light.png'"));
});

test('dashboard: panel compacto con gráfica de pedidos abiertos, sin saludo gigante', () => {
  assert.match(html, /id="home-greeting"/);
  assert.doesNotMatch(html, /Hoy en el taller/);
  assert.doesNotMatch(html, /Un vistazo claro a entregas/);
  assert.match(html, /id="hoy-list"/);
  assert.match(html, /class="open-orders home-module"/);
  assert.match(html, /class="open-meter"/);
  assert.match(html, /Abonado y por cobrar/);
  assert.match(html, /function openOrderStats\(/);
  assert.match(html, /class="flow-map"/);
  assert.match(html, /class="balance-panel home-module"/);
  assert.match(html, /Hoy — entregas/);
  assert.match(html, /En producción ahora/);
  assert.match(html, /Dinero que falta/);
  assert.match(html, /Cotizaciones esperando/);
  assert.match(html, /Registrar abono/);
  assert.doesNotMatch(html, /class="studio-hero"|El estado real/);
  assert.match(html, /Recordar por WhatsApp/);
  assert.doesNotMatch(html, /id="home-projects"/);
  assert.doesNotMatch(html, /PROYECTOS RECIENTES/);
  assert.match(html, /data-home-action="payment"/);
  assert.match(html, /data-home-action="reminder"/);
});


test('navegación: iconos SVG sin etiquetas visibles, con nombres accesibles', () => {
  const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((nav.match(/<button\b/g) || []).length, 6);
  assert.equal((nav.match(/<svg class="nav-icon"/g) || []).length, 6);
  assert.match(nav, /aria-label="Panel"/);
  assert.match(html, /\.nav-badge\{/);
  assert.match(nav, /aria-label="Producción"/);
  assert.doesNotMatch(nav, /nav-text|<span>/);
});

test('formularios: campos principales tienen etiquetas y precios explicados', () => {
  for (const [label, id] of [['CLIENTE *', 'quote-client'], ['PROYECTO *', 'quote-project'], ['NOMBRE *', 'c-name'], ['FECHA DE ENTREGA *', 'd-date'], ['VIGENCIA (DÍAS)', 'q-validity']]) {
    const start = html.indexOf(`<label class="field-label" for="${id}"`);
    const end = start < 0 ? -1 : html.indexOf('</label>', start);
    assert.ok(start >= 0 && end > start && html.slice(start, end).includes(label), `falta etiqueta para ${id}`);
  }
  assert.match(html, /form-intro/);
  assert.match(html, /\.edit\{[^}]*border:1px solid/);
});

test('dashboard: renderiza el mosaico con saldos completos y acciones reales', () => {
  const box = { innerHTML: '', querySelectorAll: () => [] };
  const dateNode = { textContent: '' };
  const orders = [
    { id: 'o1', project: 'Campaña otoño', client: 'Ana', folio: 'MCCO-P-0001', createdAt: '2026-11-20', total: 2000, payments: [{ cents: 50000 }], delivery: { date: '2026-11-27', method: 'Recogida' } },
    { id: 'o2', project: 'Muestra editorial', client: 'Taller', folio: 'MCCO-P-0002', createdAt: '2026-11-19', total: 800, payments: [], production: { description: 'Impresión' } }
  ];
  const quotes = [{ id: 'q1', status: 'enviada', createdAt: '2026-11-20', folio: 'MCCO-C-0001', fields: ['Ana', '', 'Diseño editorial'] }];
  const context = vm.createContext({
    document: { getElementById: (id) => id === 'hoy-list' ? box : id === 'home-date' ? dateNode : null },
    orders, quotes, clients: [{ id: 'c1', name: 'Ana' }],
    todayISO: () => '2026-11-27', formatDate: (date) => date,
    daysSince: () => 7, orderStage: (order) => order.delivery?.date ? 'Entrega' : order.production ? 'Producción' : 'Confirmado',
    orderBalance: (order) => Math.max(0, order.total - (order.payments || []).reduce((sum, payment) => sum + payment.cents / 100, 0)),
    orderPaid: (order) => (order.payments || []).reduce((sum, payment) => sum + payment.cents / 100, 0),
    money: (amount) => `MXN ${amount.toFixed(2)}`, safe: (value) => String(value ?? '').replace(/[&<>"']/g, '')
  });
  vm.runInContext(`${extractFunction(html, 'openOrderStats')}\n${extractFunction(html, 'renderOpenChart')}\n${extractFunction(html, 'renderHome')}\nrenderHome();`, context);
  assert.match(box.innerHTML, /class="open-orders home-module"/);
  assert.match(box.innerHTML, /class="open-meter-paid"/);
  assert.match(box.innerHTML, /Campaña otoño/);
  assert.match(box.innerHTML, /MXN 2300\.00/);
  assert.match(box.innerHTML, /data-home-action="payment" data-target="o1"/);
  assert.match(box.innerHTML, /ENTREGA HOY/);
  assert.match(box.innerHTML, /Recordar por WhatsApp/);
  assert.match(dateNode.textContent, /noviembre de 2026/);
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

test('cotización: productos y servicios se capturan en renglones libres, no en un catálogo', () => {
  for (const id of ['quote-items', 'q-delivery', 'q-deposit', 'q-validity']) {
    assert.ok(html.includes(`id="${id}"`), `falta el campo ${id}`);
  }
  // Papel, medidas, técnica y acabados ya no se capturan.
  for (const gone of ['q-format', 'q-paper', 'quote-technique', 'class="q-finish"']) {
    assert.ok(!html.includes(`id="${gone}"`), `sobra el campo ${gone}`);
  }
  assert.match(html, /PRODUCTO \/ DESCRIPCIÓN/);
  assert.match(html, /PRECIO UNITARIO/);
  assert.match(html, /class="add-quote-item"/);
  assert.match(html, /function addQuoteItem\(/);
  assert.match(html, /function removeQuoteItem\(/);
  assert.doesNotMatch(html, /id="q-service"|id="q-qty"|function addOption\(/);
  assert.match(html, /id="quote-errors"/);
  assert.match(html, /id="draft-status"/);
  assert.match(html, /Borrador guardado/);
  assert.doesNotMatch(html, /ACABADOS|Hot stamping/);
});

test('validación de cotización: permite técnica vacía y exige partidas completas', () => {
  assert.deepEqual(runQuoteErrors(['Ana Ruiz', '', 'Volantes', ''], [{ description: 'Volantes A5', quantity: '250', unitPrice: '3.50' }]), []);
  assert.ok(runQuoteErrors(['Ana Ruiz', '', 'Volantes', ''], []).some((error) => error.includes('Agrega al menos un producto')));
  const errors = runQuoteErrors(['Ana Ruiz', '', 'Volantes', ''], [{ description: '', quantity: '0', unitPrice: '' }]);
  assert.ok(errors.some((error) => error.includes('descripción')));
  assert.ok(errors.some((error) => error.includes('cantidad')));
  assert.ok(errors.some((error) => error.includes('precio unitario')));
  assert.ok(runQuoteErrors(['Ana Ruiz', 'correo-inválido', 'Volantes', ''], [{ description: 'Volantes', quantity: '1', unitPrice: '10' }]).some((error) => error.includes('correo')));
});

test('cotización: renglones libres calculan cantidad × precio, subtotal, IVA y total', () => {
  assert.match(html, /q-item-description/);
  assert.match(html, /q-item-quantity/);
  assert.match(html, /q-item-unit-price/);
  assert.match(html, /function calculateQuoteTotals\(/);
  assert.match(html, /function quoteLineTotal\(/);
  assert.match(html, /items=readQuoteItems\(\)/);
  assert.match(html, /items:quote\.items\.map\(item=>\(\{\.\.\.item\}\)\)/);
  assert.match(html, /id="order-items"/);
  assert.match(html, /function renderOrderItems\(/);
  const { normalizeQuote, calculateQuoteTotals } = loadHelpers();
  const quote = normalizeQuote({ id: 'q-items', fields: ['Ana', '', 'Campaña', ''], items: [{ description: 'Tarjetas', quantity: 500, unitPrice: 2.5 }, { description: 'Diseño', quantity: 1, unitPrice: 300 }], iva: true }, '2024-01-01');
  assert.equal(quote.options.length, 0);
  assert.equal(quote.subtotal, 1550);
  assert.equal(quote.tax, 248);
  assert.equal(quote.total, 1798);
  assert.deepEqual(JSON.parse(JSON.stringify(calculateQuoteTotals(quote.items, false))), { subtotal: 1550, tax: 0, total: 1550 });
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
