import { and, eq, getTableColumns, getTableName, inArray, sql } from 'drizzle-orm';
import * as schema from '../../db/schema.ts';
import { collections, children } from '../../db/accounting-model.mjs';
import { canonical, documentHash, normalizeDocument, restoreDocument, storageError } from './accounting-codec.mjs';

const tables = {
  assets: schema.assets, loans: schema.loans, recurringEntries: schema.recurringEntries, exchangeRates: schema.exchangeRates, foreignDocuments: schema.foreignDocuments, budgets: schema.budgets, quotations: schema.quotations, purchaseOrders: schema.purchaseOrders, attendance: schema.attendance, vacationRequests: schema.vacationRequests, employeeAdvances: schema.employeeAdvances,
  withholdings:schema.withholdings,instruments:schema.instruments,partners:schema.partners,stockTransfers: schema.stockTransfers, branches: schema.branches, accounts: schema.ledgerAccounts, products: schema.products, customers: schema.customers,
  suppliers: schema.suppliers, employees: schema.employees, payrolls: schema.payrolls,
  settlements: schema.settlements, taxes: schema.taxObligations, properties: schema.properties,
  shifts: schema.shifts, cashMovements: schema.cashMovements, pettyFunds: schema.pettyFunds,
  pettyVouchers: schema.pettyVouchers, cashCounts: schema.cashCounts, costCatalog: schema.costCatalog,
  costs: schema.costs, entries: schema.journalEntries, lines: schema.journalLines,
  items: schema.invoiceItems, stock: schema.inventoryMovements, payments: schema.invoicePayments,
  invoices: schema.invoices,
};
export async function storageState(client, companyId) {
  const [state] = await client.select().from(schema.accountingStorage).where(eq(schema.accountingStorage.companyId, companyId));
  return state || null;
}
// Una consulta y una instantánea SQL para todas las tablas; no una llamada por catálogo.
async function storedRows(client, companyId) {
  const parts = Object.entries(tables).map(([name, table]) => sql`(SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ${sql.identifier(getTableName(table))} t WHERE company_id = ${companyId}) AS ${sql.identifier(name)}`);
  const result = await client.execute(sql`SELECT ${sql.join(parts, sql`, `)}`);
  const raw = (result.rows || result)[0];
  return Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, raw[name].map(row =>
    Object.fromEntries(Object.entries(getTableColumns(table)).map(([key, column]) => [key, row[column.name] === null ? null : column.mapFromDriverValue(row[column.name])])))]));
}
export async function verifyStored(client, company, state) {
  const rows = await storedRows(client, company.id);
  for (const [name, count] of Object.entries(state.manifest.counts)) if (rows[name].length !== count) storageError('Los conteos relacionales no coinciden. Se conservó el origen; no continúes hasta revisar la migración.');
  const data = restoreDocument({ rows, extra: state.documentExtra, manifest: state.manifest });
  if (documentHash(data) !== state.sourceHash || documentHash(company.data) !== state.sourceHash) storageError('La verificación de integridad no coincide con el origen. Se conservó el documento JSON.');
  const verification = normalizeDocument(company.id, data);
  const compatibleManifest={...state.manifest,counts:{...Object.fromEntries(Object.keys(tables).map(name=>[name,0])),...state.manifest.counts}};
  if (canonical(verification.manifest) !== canonical(compatibleManifest)) storageError('Los totales contables no coinciden después de la conversión.');
  // Verifica también claves, índices de fecha y relaciones, no solo el JSON reconstruido.
  const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  for (const name of Object.keys(tables)) if (canonical([...rows[name]].sort(byId)) !== canonical([...verification.rows[name]].sort(byId))) storageError('Una tabla relacional no coincide con el documento verificado.');
  return data;
}
export async function readAccounting(client, company) {
  const state = await storageState(client, company.id);
  if (!state || state.mode === 'legacy') return company.data;
  if (state.revision !== company.revision) storageError('Las revisiones de almacenamiento no coinciden. El origen sigue disponible para recuperación.');
  return verifyStored(client, company, state);
}
async function writeRows(client, company, converted, previous) {
  // Primero retirar hijos eliminados, luego cabeceras. Nunca tocar otra empresa.
  for (const name of [...Object.keys(children), 'invoices', ...Object.keys(collections)]) {
    const table = tables[name];
    const nextIds = new Set(converted.rows[name].map(row => row.id));
    const removed = (previous?.rows[name] || []).filter(row => !nextIds.has(row.id)).map(row => row.id);
    // Sin un estado verificado previo, reconstruir solo la proyección de esta empresa.
    if (!previous) await client.delete(table).where(eq(table.companyId, company.id));
    else for (let index = 0; index < removed.length; index += 200) await client.delete(table).where(and(eq(table.companyId, company.id), inArray(table.id, removed.slice(index, index + 200))));
  }
  for (const [name, table] of Object.entries(tables)) {
    const oldRows = new Map((previous?.rows[name] || []).map(row => [row.id, canonical(row)]));
    const changed = converted.rows[name].filter(row => oldRows.get(row.id) !== canonical(row));
    const columns = getTableColumns(table);
    const set = Object.fromEntries(Object.entries(columns).filter(([key]) => !['companyId', 'id'].includes(key)).map(([key, column]) => [key, sql`excluded.${sql.identifier(column.name)}`]));
    // Homogeneizar campos ausentes para que los lotes y ON CONFLICT no conserven valores viejos.
    const values = changed.map(row => Object.fromEntries(Object.keys(columns).map(key => [key, row[key] ?? null])));
    for (let index = 0; index < values.length; index += 100) await client.insert(table).values(values.slice(index, index + 100)).onConflictDoUpdate({ target: [table.companyId, table.id], set });
  }
}
export async function convertAccounting(client, company, { mode = 'relational', verify = true } = {}) {
  const converted = normalizeDocument(company.id, company.data);
  const existing = await storageState(client, company.id);
  await client.insert(schema.accountingOrigins).values({ companyId: company.id, revision: company.revision, data: company.data, sourceHash: converted.hash }).onConflictDoNothing();
  // La conversión explícita reconstruye y verifica incluso si ya había una proyección.
  await writeRows(client, company, converted, null);
  const state = { companyId: company.id, revision: company.revision, mode, documentExtra: converted.extra, manifest: converted.manifest, sourceHash: converted.hash, verifiedAt: new Date() };
  await client.insert(schema.accountingStorage).values(state).onConflictDoUpdate({ target: schema.accountingStorage.companyId, set: state });
  if (verify) await verifyStored(client, company, state);
  return { mode, revision: company.revision, counts: converted.manifest.counts, debitCents: converted.manifest.debitCents, creditCents: converted.manifest.creditCents, alreadyConverted: !!existing };
}
export async function syncAccounting(client, previousCompany, company) {
  const state = await storageState(client, company.id);
  // Las empresas no convertidas siguen funcionando hasta su migración explícita.
  if (!state) {
    if (previousCompany.data === null) await convertAccounting(client, company);
    return;
  }
  if (state.mode === 'legacy') return;
  if (state.revision !== previousCompany.revision) storageError('El almacenamiento cambió de revisión. Recarga antes de guardar.');
  const previous = normalizeDocument(company.id, previousCompany.data);
  const converted = normalizeDocument(company.id, company.data);
  await writeRows(client, company, converted, previous);
  await client.update(schema.accountingStorage).set({ revision: company.revision, documentExtra: converted.extra, manifest: converted.manifest, sourceHash: converted.hash, verifiedAt: new Date() }).where(eq(schema.accountingStorage.companyId, company.id));
}
export async function returnToLegacy(client, company) {
  const state = await storageState(client, company.id);
  if (!state) storageError('Esta empresa aún no tiene una migración de almacenamiento.');
  // Se conserva la copia JSON vigente y todas las tablas; no se restaura una versión antigua.
  if (state.revision !== company.revision || documentHash(company.data) !== state.sourceHash) storageError('Verifica la copia de origen antes de revertir el modo de lectura.');
  await client.update(schema.accountingStorage).set({ mode: 'legacy' }).where(eq(schema.accountingStorage.companyId, company.id));
  return { mode: 'legacy', revision: company.revision };
}


// Los originales privados también forman parte de la conservación y de las cuotas.
export function retainedCompanyData(client, companyId) {
  return client.select({ data: schema.companyBackups.data }).from(schema.companyBackups)
    .where(eq(schema.companyBackups.companyId, companyId))
    .unionAll(client.select({ data: schema.accountingOrigins.data }).from(schema.accountingOrigins)
      .where(eq(schema.accountingOrigins.companyId, companyId)));
}
