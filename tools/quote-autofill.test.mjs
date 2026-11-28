/* Pruebas del autocompletado de clientes en cotizaciones y pedidos.
   Ejecutar con: node --test tools/quote-autofill.test.mjs */

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

function loadMatchers() {
  const code = [
    extractFunction(html, 'normalizeClientName'),
    extractFunction(html, 'directoryMatches'),
    extractFunction(html, 'findDirectoryClient'),
    'globalThis.api = { normalizeClientName, directoryMatches, findDirectoryClient };'
  ].join('\n');
  const context = vm.createContext({});
  vm.runInContext(code, context, { filename: 'client-matchers.js' });
  return context.api;
}

const clients = [
  { id: 'c1', name: 'Mariana López', company: 'Estudio Norte', email: 'mariana@norte.mx', phone: '55 1234 5678' },
  { id: 'c2', name: 'Ana Ruiz', company: '', email: 'ana@ruiz.mx', phone: '' },
  { id: 'c3', name: 'Ana Torres', company: '', email: 'ana@torres.mx', phone: '' },
  { id: 'c4', name: 'José Álvarez', company: 'Taller Sur', email: '', phone: '55 9876 5432' }
];

test('cotización: campos conectados al directorio y al aviso de autocompletado', () => {
  assert.match(html, /<input class="edit" id="quote-client" list="client-options" autocomplete="off"/);
  assert.match(html, /<datalist id="client-options"><\/datalist>/);
  assert.match(html, /<input class="edit" id="quote-email"/);
  assert.match(html, /<div id="quote-client-hint" class="client-hint" role="status" aria-live="polite" hidden><\/div>/);
  assert.match(html, /id="quote-client"[\s\S]{0,400}aria-describedby="quote-client-hint"/);
  assert.match(html, /addEventListener\('input',\(\)=>syncQuoteClient\(false\)\)/);
  assert.match(html, /addEventListener\('change',\(\)=>syncQuoteClient\(true\)\)/);
  assert.match(html, /refreshClientOptions\(\)/);
  assert.match(html, /\.client-hint\{/);
});

test('normalización: sin acentos, sin mayúsculas y con espacios colapsados', () => {
  const { normalizeClientName } = loadMatchers();
  assert.equal(normalizeClientName('  Mariana   LÓPEZ '), 'mariana lopez');
  assert.equal(normalizeClientName('José Álvarez'), 'jose alvarez');
  assert.equal(normalizeClientName(null), '');
  assert.equal(normalizeClientName(undefined), '');
});

test('búsqueda: coincidencia exacta sin importar acentos ni mayúsculas', () => {
  const { findDirectoryClient } = loadMatchers();
  assert.equal(findDirectoryClient('mariana lopez', clients, false)?.id, 'c1');
  assert.equal(findDirectoryClient('MARIANA LÓPEZ', clients, true)?.id, 'c1');
  assert.equal(findDirectoryClient('  Ana   Ruiz ', clients, false)?.id, 'c2');
  assert.equal(findDirectoryClient('', clients, true), null);
});

test('búsqueda: prefijo solo al confirmar y solo si es único', () => {
  const { findDirectoryClient, directoryMatches } = loadMatchers();
  // Al escribir no se completa por prefijo.
  assert.equal(findDirectoryClient('Marian', clients, false), null);
  // Al confirmar (blur o elegir de la lista) sí, si es único.
  assert.equal(findDirectoryClient('Marian', clients, true)?.id, 'c1');
  // Prefijo ambiguo: no se elige a ciegas.
  assert.equal(findDirectoryClient('Ana', clients, true), null);
  assert.equal(directoryMatches('Ana', clients).length, 2);
  // Cliente inexistente.
  assert.equal(findDirectoryClient('Pedro', clients, true), null);
});

test('pedido: hereda los datos del cliente y los muestra en la ficha', () => {
  assert.match(html, /directory=findDirectoryClient\(client,clients,true\)/);
  assert.match(html, /items:quote\.items\.map\(item=>\(\{\.\.\.item\}\)\)/);
  assert.match(html, /total:totals\.total/);
  assert.match(html, /clientId:directory\?\.id\|\|null/);
  assert.match(html, /company:directory\?\.company\|\|''/);
  assert.match(html, /email:fields\[1\]\|\|directory\?\.email\|\|''/);
  assert.match(html, /phone:directory\?\.phone\|\|''/);
  assert.match(html, /<div id="order-contact"[^>]*hidden><\/div>/);
  assert.match(html, /contact\.textContent=details\.join\(' · '\);contact\.hidden=!details\.length/);
});

test('el correo escrito a mano nunca se sobrescribe', () => {
  // La regla vive en applyDirectoryClient: solo rellena si el campo está vacío
  // o si todavía contiene el valor que puso el propio autocompletado.
  assert.match(html, /if\(!current\|\|current===autoFilledEmail\)\{field\.value=client\.email\|\|'';autoFilledEmail=client\.email\|\|''\}/);
  assert.match(html, /function clearAutoFilledEmail\(\)\{const field=document\.getElementById\('quote-email'\);if\(field&&autoFilledEmail&&field\.value\.trim\(\)===autoFilledEmail\)field\.value=''/)
});
