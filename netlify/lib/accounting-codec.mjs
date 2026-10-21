import { createHash } from 'node:crypto';
import { collections, children } from '../../db/accounting-model.mjs';

export function storageError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  error.status = 422;
  throw error;
}
export const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
export const documentHash = data => createHash('sha256').update(canonical(data)).digest('hex');
export function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) storageError('La conversión requiere importes numéricos finitos.');
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || Math.abs(value * 100 - result) > 0.000001) storageError('Hay importes con fracciones de centavo o fuera del rango seguro. Revisa el origen antes de migrar; no se redondearon datos.');
  return result;
}
const moneyNames = new Set([...Object.values(collections), ...Object.values(children)].flatMap(def => def.money || []).concat([
  'listPrice', 'salaryPending', 'indemnity', 'vacation', 'aguinaldo', 'output', 'input', 'net', 'profit', 'revenue', 'expenses', 'tax', 'balance', 'originalPrice', 'originalSubtotal', 'discountAmount', 'refund', 'debtReduction', 'cash', 'card', 'transfer', 'efectivo', 'tarjeta', 'transferencia', 'credito',
]));
// El JSON residual conserva configuraciones y campos históricos, nunca el documento completo.
// Las cantidades y tasas conservan precisión; todo campo monetario conocido usa centavos.
function encode(value, key = '') {
  if (typeof value === 'number' && moneyNames.has(key)) return { $acontecCents: cents(value) };
  if (Array.isArray(value)) return value.map(item => encode(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, encode(item, name)]));
  return value;
}
function decode(value) {
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && Object.hasOwn(value, '$acontecCents')) {
    if (!Number.isSafeInteger(value.$acontecCents)) storageError('La representación de centavos no es válida.');
    return value.$acontecCents / 100;
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  return value;
}
function pack(record, definition, companyId, id, position, date = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) storageError('Se encontró un registro inválido en el documento de origen.');
  const extra = structuredClone(record), fields = [];
  const row = { companyId, id, position, date, extra: null };
  for (const field of definition.text || []) row[field] = null;
  for (const field of definition.money || []) row[field + 'Cents'] = null;
  for (const field of definition.numeric || []) row[field] = null;
  for (const field of ['date', ...(definition.text || []), ...(definition.money || []), ...(definition.numeric || [])]) {
    if (!Object.hasOwn(record, field)) continue;
    fields.push(field); delete extra[field];
    const value = record[field];
    if ((definition.money || []).includes(field)) row[field + 'Cents'] = value === null ? null : cents(value);
    else if ((definition.numeric || []).includes(field)) {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) storageError('Cantidad inválida en el documento de origen.');
      row[field] = value === null ? null : String(value);
    } else {
      if (value !== null && typeof value !== 'string') storageError('Referencia o fecha inválida en el documento de origen.');
      row[field] = value;
    }
  }
  // id/code permanece en los metadatos para reconstruir exactamente el contrato antiguo.
  row.extra = { fields, data: encode(extra) };
  return row;
}
function unpack(row, definition) {
  const record = decode(row.extra.data);
  for (const field of row.extra.fields) {
    if ((definition.money || []).includes(field)) {
      const value = row[field + 'Cents'];
      if (value !== null && !Number.isSafeInteger(Number(value))) storageError('Importe fuera del rango seguro.');
      record[field] = value === null ? null : Number(value) / 100;
    } else if ((definition.numeric || []).includes(field)) record[field] = row[field] === null ? null : Number(row[field]);
    else record[field] = row[field];
  }
  return record;
}
export function normalizeDocument(companyId, data) {
  const rows = Object.fromEntries([...Object.keys(collections), ...Object.keys(children), 'invoices'].map(name => [name, []]));
  if (data === null) return { rows, extra: {}, manifest: { version: 1, empty: true, arrays: [], counts: Object.fromEntries(Object.keys(rows).map(name => [name, 0])), debitCents: 0, creditCents: 0 }, hash: documentHash(null) };
  if (!data || typeof data !== 'object' || Array.isArray(data)) storageError('El documento contable no es válido.');
  const extra = structuredClone(data), arrays = [];
  let debitCents = 0, creditCents = 0;
  const accountCodes = new Set((data.accounts || []).map(account => account.code));
  for (const [name, definition] of Object.entries(collections)) {
    if (!Object.hasOwn(data, name)) continue;
    if (!Array.isArray(data[name])) storageError('Un catálogo del origen no es una lista válida.');
    arrays.push(name); delete extra[name];
    const ids = new Set();
    for (const [position, record] of data[name].entries()) {
      const id = record?.[definition.key || 'id'];
      if (typeof id !== 'string' || !id || ids.has(id)) storageError('El origen contiene identificadores ausentes o duplicados. No se modificó.');
      ids.add(id);
      const header = structuredClone(record), present = [];
      if (name === 'entries') {
        let debit = 0, credit = 0;
        if (!Array.isArray(record.lines)) storageError('Un asiento no contiene líneas contables válidas.');
        for (const [childName, childDef] of Object.entries(children)) {
          if (!Object.hasOwn(record, childName)) continue;
          if (!Array.isArray(record[childName])) storageError('Un asiento contiene líneas, artículos o movimientos inválidos.');
          present.push(childName); delete header[childName];
          for (const [index, item] of record[childName].entries()) {
            if (childName === 'lines') {
              if (!accountCodes.has(item.a) || item.d < 0 || item.c < 0) storageError('El origen contiene una cuenta inexistente o una línea negativa.');
              debit += cents(item.d); credit += cents(item.c);
            }
            rows[childName].push({ ...pack(item, childDef, companyId, id + ':' + index, index, record.date || null), entryId: id });
          }
        }
        if (debit !== credit) storageError('El origen contiene asientos descuadrados en centavos. Corrígelos antes de migrar; el origen se conservó.');
        debitCents += debit; creditCents += credit;
        if (!Number.isSafeInteger(debitCents) || !Number.isSafeInteger(creditCents)) storageError('Los totales exceden el rango seguro.');
        if (['venta', 'compra', 'nota-credito', 'factura'].includes(record.type)) {
          rows.invoices.push(pack(Object.fromEntries(Object.entries(header).filter(([field]) => ['date', 'type', 'reference', 'due', 'customerId', 'supplierId', 'pay', 'subtotal', 'vat', 'total'].includes(field))), invoiceDefinition, companyId, id, position));
        }
      }
      const row = pack(header, definition, companyId, id, position);
      if (name === 'entries') row.extra.children = present;
      rows[name].push(row);
    }
  }
  const result = { rows, extra: encode(extra), manifest: { version: 1, arrays, counts: Object.fromEntries(Object.entries(rows).map(([name, list]) => [name, list.length])), debitCents, creditCents }, hash: documentHash(data) };
  if (documentHash(restoreDocument(result)) !== result.hash) storageError('La conversión no conservó todos los campos del origen.');
  return result;
}
export const invoiceDefinition = { text: ['type', 'reference', 'due', 'customerId', 'supplierId', 'pay'], money: ['subtotal', 'vat', 'total'] };
export function restoreDocument({ rows, extra, manifest }) {
  if (manifest.empty) return null;
  const data = decode(extra);
  const grouped = Object.fromEntries(Object.keys(children).map(name => [name, new Map()]));
  for (const name of Object.keys(children)) for (const child of rows[name]) {
    if (!grouped[name].has(child.entryId)) grouped[name].set(child.entryId, []);
    grouped[name].get(child.entryId).push(child);
  }
  for (const name of manifest.arrays) data[name] = [...rows[name]].sort((a, b) => a.position - b.position).map(row => {
    const record = unpack(row, collections[name]);
    if (name === 'entries') for (const childName of row.extra.children) record[childName] = (grouped[childName].get(row.id) || []).sort((a, b) => a.position - b.position).map(child => unpack(child, children[childName]));
    return record;
  });
  return data;
}
