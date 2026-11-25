/* Pruebas del flujo local: folios, fechas, estados e historial.
   Ejecutar con: node --test tools/local-flow.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

function extractConst(source, name) {
  const start = source.indexOf(`const ${name}=`);
  assert.ok(start > -1, `no se encontró la constante ${name}`);
  const end = source.indexOf('};', start);
  assert.ok(end > -1, `constante ${name} incompleta`);
  return source.slice(start, end + 2);
}

function loadCore() {
  const code = [
    extractConst(html, 'QUOTE_STATUS'),
    extractConst(html, 'FOLIO_PREFIX'),
    extractFunction(html, 'newId'),
    extractFunction(html, 'todayISO'),
    extractFunction(html, 'formatDate'),
    extractFunction(html, 'folioNumber'),
    extractFunction(html, 'nextFolioNumber'),
    extractFunction(html, 'normalizeQuote'),
    extractFunction(html, 'normalizeOrder'),
    'globalThis.api={QUOTE_STATUS,FOLIO_PREFIX,formatDate,folioNumber,nextFolioNumber,normalizeQuote,normalizeOrder};'
  ].join('\n');
  const context = vm.createContext({});
  vm.runInContext(code, context, { filename: 'local-flow-core.js' });
  return context.api;
}

test('folios: consecutivos por tipo, sin mezclar cotizaciones y pedidos', () => {
  const { folioNumber, nextFolioNumber } = loadCore();
  assert.equal(folioNumber('MCCO-C-0007', 'MCCO-C-'), 7);
  assert.equal(folioNumber('MCCO-C-0007', 'MCCO-P-'), 0);
  assert.equal(folioNumber('MCCO-C-00x7', 'MCCO-C-'), 0);
  assert.equal(folioNumber('', 'MCCO-C-'), 0);
  assert.equal(nextFolioNumber({ quote: 4 }, 'quote', [{ folio: 'MCCO-C-0009' }, {}]), 10);
  assert.equal(nextFolioNumber({ quote: 12 }, 'quote', []), 13);
  assert.equal(nextFolioNumber({}, 'order', []), 1);
});

test('fechas: formato de la cotización y valores inválidos', () => {
  const { formatDate } = loadCore();
  assert.equal(formatDate('2026-11-25'), '25 / 11 / 2026');
  assert.equal(formatDate('2026-01-02'), '02 / 01 / 2026');
  assert.equal(formatDate(''), '—');
  assert.equal(formatDate('sin fecha'), '—');
});

test('normalización: pedido sin total ni abonos no rompe la app', () => {
  const { normalizeOrder } = loadCore();
  const order = normalizeOrder({ id: '1712345678901abc', client: 'Ana', project: 'Proyecto' }, '2024-01-01');
  assert.equal(order.total, 0);
  assert.equal(order.payments.length, 0);
  assert.equal(order.createdAt, '2024-01-01');
  assert.equal(order.option, 1);
  assert.equal(order.quoteId, null);
  assert.equal(order.folio, '');
});

test('normalización: abonos viejos en pesos se convierten a centavos', () => {
  const { normalizeOrder } = loadCore();
  const order = normalizeOrder({
    id: 'o1',
    total: '500',
    payments: [{ amount: 150, date: '2026-01-01' }, { cents: '250' }, 25]
  }, '2024-01-01');
  assert.equal(order.total, 500);
  assert.equal(order.payments.length, 3);
  assert.equal(order.payments[0].cents, 15000);
  assert.equal(order.payments[1].cents, 250);
  assert.equal(order.payments[2].cents, 2500);
});

test('normalización: cotización con una sola opción se rellena a tres', () => {
  const { normalizeQuote } = loadCore();
  const quote = normalizeQuote({
    id: 'q1',
    fields: ['Ana'],
    options: [{ name: 'Única', description: '', price: '100', selected: true, hidden: false }],
    conditions: 'Línea 1\nLínea 2'
  }, '2024-01-01');
  assert.equal(quote.fields.length, 4);
  assert.equal(quote.options.length, 3);
  assert.equal(quote.options[0].selected, true);
  assert.equal(quote.options[1].hidden, true);
  assert.equal(quote.status, 'borrador');
  assert.equal(quote.createdAt, '2024-01-01');
  assert.equal(quote.conditions, 'Línea 1\nLínea 2');
});

test('normalización: opciones ocultas o sin selección quedan utilizables', () => {
  const { normalizeQuote } = loadCore();
  const quote = normalizeQuote({
    id: 'q2',
    fields: ['Ana', '', 'Proyecto', ''],
    options: [
      { name: 'A', selected: true, hidden: true },
      { name: 'B', selected: true, hidden: true },
      { name: 'C', selected: false, hidden: true }
    ]
  }, '2024-01-01');
  assert.equal(quote.options.filter((option) => !option.hidden).length, 1);
  assert.equal(quote.options.filter((option) => option.selected).length, 1);
  assert.equal(quote.options[0].hidden, false);
  assert.equal(quote.options[0].selected, true);
});

test('interfaz: folios, estados, vínculo, borrado e historial están conectados', () => {
  assert.match(html, /<span id="doc-folio">/);
  assert.match(html, /<span id="doc-date">/);
  assert.match(html, /id="doc-status"/);
  assert.match(html, /<select id="quote-status"/);
  assert.match(html, /<option value="borrador">/);
  assert.match(html, /<option value="rechazada">/);
  assert.match(html, /id="order-folio"/);
  assert.match(html, /id="order-date"/);
  assert.match(html, /id="order-quote-link"/);
  assert.match(html, /id="client-history"/);
  assert.match(html, /id="client-delete"/);
  assert.match(html, /onclick="deleteOrder\(\)"/);
  assert.match(html, /onclick="deleteClient\(\)"/);
  assert.match(html, /onclick="openLinkedQuote\(\)"/);
  assert.match(html, /onclick="printQuote\(\)"/);
  assert.match(html, /function printQuote\(\)/);
  assert.match(html, /\.conditions\{[^}]*white-space:pre-wrap/);
  assert.doesNotMatch(html, /MCCO-C-0001 &nbsp; · &nbsp; 19 \/ 11 \/ 2026/);
});

test('flujo: el pedido se vincula y la cotización queda aceptada', () => {
  assert.match(html, /quoteId:quote\.id/);
  assert.match(html, /quoteFolio:quote\.folio/);
  assert.match(html, /quote\.status='aceptada'/);
  assert.match(html, /function linkedOrderFor/);
  assert.match(html, /const previous=existing\?linkedOrderFor\(existing\.id\):null/);
  assert.match(html, /Esta cotización está vinculada al pedido/);
  assert.match(html, /currentQuoteId===quote\.id\)updateQuoteMeta\(quote\)/);
});
