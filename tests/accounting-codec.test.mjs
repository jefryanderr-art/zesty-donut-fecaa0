// Preparadas para ejecución por la plataforma; no ejecutar localmente en sesiones gestionadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, documentHash, normalizeDocument, restoreDocument } from '../netlify/lib/accounting-codec.mjs';
const company = '11111111-1111-4111-8111-111111111111';
const fixture = () => ({
  cfg: { cur: 'C$', pos: { discountLimits: { dueno: 12.345 } } },
  accounts: [{ code: '1101', name: 'Caja' }, { code: '4101', name: 'Ventas' }],
  products: [{ id: 'p1', name: 'Producto', stock: 1.125, min: 0.1, price: 10.25, cost: 5.12 }],
  customers: [{ id: 'c1', name: '<Cliente>', creditLimit: 100 }],
  entries: [{ id: 'e1', type: 'venta', date: '2026-10-21', reference: 'A-1', subtotal: 10, vat: 1.5, total: 11.5,
    lines: [{ a: '1101', d: 11.5, c: 0 }, { a: '4101', d: 0, c: 11.5 }],
    items: [{ p: 'p1', q: 1.125, u: 10.25, cost: 5.12, vatRate: 15 }],
    stock: [{ pid: 'p1', q: -1.125, unitCost: 5.12 }], payments: [{ method: 'efectivo', amount: 11.5 }],
  }],
  taxes: [{ id: 't1', amount: 1.5, calculation: { output: 1.5, input: 0, net: 1.5 } }],
  employees: [], payrolls: [], suppliers: [], invoiceSequences: { A: 1 },
});
test('reconstruye todos los campos sin perder cantidades, tasas, orden ni colecciones vacías', () => {
  const source = fixture(), converted = normalizeDocument(company, source);
  assert.deepEqual(restoreDocument(converted), source);
  assert.equal(converted.rows.products[0].priceCents, 1025);
  assert.equal(converted.rows.lines[0].dCents, 1150);
  assert.equal(converted.rows.items[0].uCents, 1025);
  assert.equal(converted.rows.payments[0].amountCents, 1150);
  assert.equal(converted.manifest.debitCents, converted.manifest.creditCents);
  assert.equal(converted.manifest.counts.invoices, 1);
  assert.equal(converted.hash, documentHash(source));
});
test('conserva documento nulo y campos ausentes frente a listas vacías', () => {
  for (const source of [null, {}, { entries: [], cfg: {} }]) assert.deepEqual(restoreDocument(normalizeDocument(company, source)), source);
});
test('identificadores iguales en empresas distintas conservan claves de empresa separadas', () => {
  const first = normalizeDocument(company, fixture()), second = normalizeDocument('22222222-2222-4222-8222-222222222222', fixture());
  assert.notEqual(first.rows.lines[0].companyId, second.rows.lines[0].companyId);
  assert.equal(first.rows.lines[0].id, second.rows.lines[0].id);
});
test('rechaza asiento descuadrado, cuenta inexistente y duplicados sin modificar el origen', () => {
  const source = fixture(), original = structuredClone(source);
  source.entries[0].lines[0].d = 11.51;
  assert.throws(() => normalizeDocument(company, source), /descuadrados/);
  assert.equal(source.entries[0].lines[0].d, 11.51);
  original.entries[0].lines[0].a = 'inexistente';
  assert.throws(() => normalizeDocument(company, original), /cuenta inexistente/);
  const duplicate = fixture(); duplicate.products.push(structuredClone(duplicate.products[0]));
  assert.throws(() => normalizeDocument(company, duplicate), /duplicados/);
});
test('no redondea silenciosamente fracciones de centavo ni acepta valores inseguros', () => {
  assert.equal(cents(0.29), 29);
  assert.throws(() => cents(0.001), /fracciones de centavo/);
  assert.throws(() => cents(Number.MAX_SAFE_INTEGER), /rango seguro/);
  assert.throws(() => cents(Infinity), /finitos/);
});
