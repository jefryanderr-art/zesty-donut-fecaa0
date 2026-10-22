import { requireBilling } from './billing.mjs';
import { moduleIncluded,supportGrantActive } from './billing-rules.mjs';
import { users, supportGrants } from '../../db/schema.ts';
import { TRADE_ARRAYS } from './trade.mjs';
import { CROSS_BRANCH_OPS } from './transfers.mjs';
import { ADVANCED_ARRAYS } from './advanced.mjs';
import { branchAccess, scopeBranch, mergeBranch, companyBranches, materializeBranches } from './branches.mjs';
import { syncBarcodes, guardPeriods } from './controls.mjs';
import { readAccounting, syncAccounting, convertAccounting, returnToLegacy, storageState, retainedCompanyData } from './accounting-storage.mjs';
import { normalizeDocument } from './accounting-codec.mjs';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { and, desc, eq, lt, or, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { companies, companyMembers, companyBackups, auditEvents, sessions, saveOperations } from '../../db/schema.ts';
import { OPERATION_ARRAYS, roleAllows, salesAdministrator, cashAdministrator, operatorId, receiptRecords } from './policies.mjs';

export const MODULES = ['ventas', 'compras', 'gastos', 'inventario', 'contabilidad', 'finanzas', 'personal', 'fiscal', 'ajustes', 'accesibilidad', 'auditoria', 'facturacion', 'cajas', 'costos', 'proveedores'];
const DATA_MODULES = ['compras', 'gastos', 'inventario', 'contabilidad', 'finanzas', 'personal', 'fiscal'];
const deriveKey = promisify(scrypt);
const round = value => Math.round(value * 100) / 100;
const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
export const equal = (first, second) => canonical(first) === canonical(second);
export const allowed = (access, module, write = false) => {
  if(access.support && write)return false;
  if(access.billingPlan && !moduleIncluded(access.billingPlan,module))return false;
  if(access.readOnlyLimit && write)return false;
  if (access.owner) return true;
  const fallback = { facturacion: 'ventas', cajas: 'contabilidad', costos: 'gastos', proveedores: 'compras' };
  const level = access.permissions?.[module] ?? (access.member?.role?.toLowerCase() === 'contador' ? access.permissions?.[fallback[module]] : undefined);
  return !!roleAllows(access, module) && !(write && roleAllows(access, module) === 'lectura') && (level === 'escritura' || (!write && level === 'lectura'));
};
export const allData = (access, write = false) => access.unrestrictedBranches !== false && salesAdministrator(access) && [...DATA_MODULES, 'ventas', 'facturacion', 'cajas', 'costos', 'proveedores'].every(module => allowed(access, module, write));
export const actorName = session => session.member ? `${session.member.name} (${session.member.username || session.email})` : session.email;
export const safeMember = member => ({ id: member.id, email: member.email, username: member.username, name: member.name, role: member.role, permissions: member.permissions, branchIds: member.branchIds, active: member.active, version: member.version });
export function accessError(message, status = 403) {
  const error = new Error(message);
  error.publicMessage = message;
  error.status = status;
  throw error;
}
export async function passwordDigest(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) accessError('Usa una contraseña de 8 a 128 caracteres.', 400);
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, digest) {
  const [salt, hash] = (digest || '00000000000000000000000000000000:' + '0'.repeat(128)).split(':');
  const key = await deriveKey(String(password).slice(0, 128), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key) && String(password).length <= 128;
}
export async function accessibleCompanies(session) {
  const summary = { isPlatformCompany: companies.isPlatformCompany, id: companies.id, name: companies.name, description: companies.description };
  const rows = session.member ? [] : await db.select(summary).from(companies).where(and(eq(companies.ownerEmail, session.email), isNull(companies.archivedAt)));
  const memberships = await db.select({ member: { id: companyMembers.id, permissions: companyMembers.permissions, role: companyMembers.role }, company: summary }).from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(isNull(companies.archivedAt), eq(companyMembers.active, true), session.member ? eq(companyMembers.id, session.member.id) : eq(companyMembers.email, session.email)));
  const grants=session.member?[]:await db.select({company:summary}).from(supportGrants).innerJoin(companies,eq(companies.id,supportGrants.companyId)).innerJoin(users,eq(users.email,supportGrants.email)).where(and(eq(supportGrants.email,session.email),eq(users.platformAdmin,true),sql`${supportGrants.expiresAt}>now()`,isNull(companies.archivedAt)));
  const [viewer]=await db.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,session.email));
  const supportCompanies=grants.filter(({company})=>!rows.some(c=>c.id===company.id)&&!memberships.some(m=>m.company.id===company.id)).map(({company})=>({...company,owner:false,permissions:Object.fromEntries(MODULES.map(m=>[m,'lectura'])),role:'Soporte temporal'}));
  return [...supportCompanies,...rows.map(company => ({ ...company, owner: true, permissions: {} })), ...memberships.filter(row => !rows.some(company => company.id === row.company.id)&&(!viewer?.platformAdmin||grants.some(g=>g.company.id===row.company.id))).map(({ company, member }) => ({ ...company, owner: false, permissions: member.permissions, memberId: member.id, role: member.role }))]
    .map(({ isPlatformCompany, id, name, description, owner, permissions, memberId, role }) => ({ isPlatformCompany, id, name, description, owner, permissions, memberId, role: owner ? 'Dueño' : role }));
}
export async function companyAccess(client, companyId, session, lock = false, loadAccounting = true) {
  if (!/^[a-f0-9-]{36}$/.test(companyId || '')) accessError('Empresa no encontrada.', 404);
  let query = client.select().from(companies).where(eq(companies.id, companyId));
  if (lock) query = query.for('update');
  const [company] = await query;
  if (!company || company.archivedAt) accessError('Empresa no encontrada.', 404);
  const finish=async access=>{
    const [ownerUser]=await client.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,company.ownerEmail));
    const billing=await requireBilling(company.ownerEmail,ownerUser?.platformAdmin===true,client);
    const result=await branchAccess(access,session);result.billingPlan=billing.plan;result.entitlement=billing.ent;
    const ownedRows=await client.select({id:companies.id}).from(companies).where(and(eq(companies.ownerEmail,company.ownerEmail),isNull(companies.archivedAt))).orderBy(companies.id);
    const limit=billing.plan?.limits?.companies;result.readOnlyLimit=limit!=null&&ownedRows.findIndex(c=>c.id===company.id)>=limit;
    if(result.billingPlan?.blockedModules?.includes('sucursales')||result.billingPlan?.limits?.branches===1){result.branchId='principal';result.branches=result.branches.filter(b=>b.id==='principal');result.unrestrictedBranches=companyBranches(company.data).length===1}
    return result;};
  if (!session.member && company.ownerEmail === session.email) {
    if (lock && loadAccounting) company.data = await readAccounting(client, company);
    return finish({ company, owner: true, permissions: {} });
  }
  const [viewer]=await client.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,session.email));
  let [member] = await client.select().from(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.active, true), session.member ? eq(companyMembers.id, session.member.id) : eq(companyMembers.email, session.email)));
  if(viewer?.platformAdmin&&!session.member)member=null;
  if (!member) {
    const [admin]=await client.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,session.email));
    const [grant]=await client.select().from(supportGrants).where(and(eq(supportGrants.companyId,companyId),eq(supportGrants.email,session.email)));
    if(!supportGrantActive(grant,session.email,admin?.platformAdmin,!!session.member))accessError('Sin acceso a esta empresa.');
    if(lock&&loadAccounting)company.data=await readAccounting(client,company);
    await audit(client,companyId,session,'Consulta de soporte · solo lectura',[{area:'support',expiresAt:grant.expiresAt.toISOString()}]);
    return finish({company,owner:false,support:true,supportExpiresAt:grant.expiresAt,permissions:Object.fromEntries(MODULES.map(m=>[m,'lectura'])),member:{role:'contador'}});
  }
  if (lock && loadAccounting) company.data = await readAccounting(client, company);
  return finish({ company, owner: false, permissions: member.permissions, member });
}
export function entryModule(entry) {
  if (entry.type === 'venta') return entry.shiftId ? 'facturacion' : 'ventas';
  if (entry.type === 'nota-credito') return 'facturacion';
  if (entry.type === 'costo') return 'costos';
  if (entry.type?.startsWith('caja')) return 'cajas';
  if (['nota-credito-compra','nota-debito-compra','desembarque'].includes(entry.type)) return 'compras';
  if (entry.type === 'compra') return 'compras';
  if (entry.type === 'gasto') return 'gastos';
  if (['invini', 'ajuste'].includes(entry.type)) return 'inventario';
  if (['nomina', 'liquidacion'].includes(entry.type)) return 'personal';
  if (String(entry.type).startsWith('fiscal')) return 'fiscal';
  if (['abono', 'factura'].includes(entry.type)) return 'contabilidad';
  return 'contabilidad';
}
const visibleEntry = (access, entry) => allowed(access, entryModule(entry)) || ['contabilidad', 'finanzas', 'fiscal'].some(module => allowed(access, module));
export function projectData(data, access) {
  data = scopeBranch(data, access);
  if (!data || (access.owner && !(access.billingPlan?.blockedModules||[]).some(m=>['personal','fiscal'].includes(m)))) return data;
  const operationalOnly = ['cajero', 'vendedor'].includes(String(access.member?.role).toLowerCase());
  const ownId = access.member?.id;
  const ownShiftIds = new Set((data.shifts || []).filter(shift => shift.operatorId === ownId).map(shift => shift.id));
  const ownFundIds = new Set((data.pettyFunds || []).filter(fund => fund.responsible === ownId).map(fund => fund.id));
  const ownInvoiceIds = new Set((data.entries || []).filter(entry => entry.type === 'venta' && (entry.operatorId === ownId || ownShiftIds.has(entry.shiftId))).map(entry => entry.id));
  const canSeeEntry = entry => operationalOnly ? (['venta', 'nota-credito'].includes(entry.type) && (entry.operatorId === ownId || ownShiftIds.has(entry.shiftId) || ownInvoiceIds.has(entry.invoiceId))) : visibleEntry(access, entry);
  const visibleIds = new Set((data.entries || []).filter(canSeeEntry).map(entry => entry.id));
  const entries = (data.entries || []).filter(entry => visibleIds.has(entry.id) || (!operationalOnly && entry.invoiceId && visibleIds.has(entry.invoiceId)) || (!operationalOnly && allowed(access, 'inventario') && entry.stock?.length)).map(entry => {
    if (visibleIds.has(entry.id) || (entry.invoiceId && visibleIds.has(entry.invoiceId))) {
      if (!operationalOnly) return entry;
      const copy = structuredClone(entry); copy.lines = []; copy.stock = [];
      for (const item of copy.items || []) delete item.cost;
      return copy;
    }
    return { id: entry.id, date: entry.date, type: entry.type, desc: 'Movimiento de inventario', lines: [], stock: entry.stock, total: 0 };
  });
  const cfg = structuredClone(data.cfg || {});
  if(!access.unrestrictedBranches&&cfg.periodLocks)cfg.periodLocks=Object.fromEntries(Object.entries(cfg.periodLocks).filter(([key])=>key.startsWith(access.branchId+':')));
  if (!['personal', 'fiscal', 'ajustes'].some(module => allowed(access, module))) cfg.fiscal = { vatRate: cfg.fiscal?.vatRate || 0 };
  const projected = { branches: access.branches, cfg, accounts: structuredClone(data.accounts || []), entries, products: [] };
  projected.customers = allowed(access, 'ventas') || allowed(access, 'facturacion') ? structuredClone(data.customers || []) : [];
  if (['ventas', 'facturacion', 'compras', 'inventario', 'contabilidad', 'finanzas', 'fiscal'].some(module => allowed(access, module))) projected.products = structuredClone(data.products || []).map(product => operationalOnly ? { ...product, cost: 0 } : product);
  for (const name of OPERATION_ARRAYS) {
    const module = name === 'suppliers' ? 'proveedores' : ['costCatalog', 'costs'].includes(name) ? 'costos' : name === 'shifts' ? 'facturacion' : 'cajas';
    projected[name] = allowed(access, module) || (name === 'suppliers' && allowed(access, 'compras')) ? structuredClone(data[name] || []) : [];
    if (name === 'shifts' && !cashAdministrator(access)) projected[name] = projected[name].filter(shift => shift.operatorId === ownId);
    if (['pettyFunds', 'pettyVouchers', 'cashCounts'].includes(name) && !cashAdministrator(access)) projected[name] = projected[name].filter(record => record.responsible === ownId || ownFundIds.has(record.fundId));
    if (name === 'cashMovements' && !cashAdministrator(access)) projected[name] = [];
    if (name === 'pettyFunds' && !cashAdministrator(access)) for (const fund of projected[name]) fund.ledgerBalance = Math.round((data.entries || []).flatMap(entry => entry.lines || []).filter(line => line.a === fund.account).reduce((sum, line) => sum + line.d - line.c, 0) * 100) / 100;
  }
  projected.invoiceSequences = {};
  for (const name of ['employees', 'payrolls', 'settlements']) projected[name] = allowed(access, 'personal') ? structuredClone(data[name] || []) : [];
  for (const name of ['taxes', 'properties']) projected[name] = allowed(access, 'fiscal') ? structuredClone(data[name] || []).map(record => {
    const copy = { ...record }; delete copy.receipt; return copy;
  }) : [];
  for(const [name,module] of Object.entries({...ADVANCED_ARRAYS,...TRADE_ARRAYS})) projected[name]=allowed(access,module)?structuredClone(data[name]||[]):[];
  projected.stockTransfers=allowed(access,'inventario')?structuredClone(data.stockTransfers||[]):[];
  return projected;
}
function validateEntries(data) {
  const ids = new Set();
  const accountCodes = new Set(data.accounts.map(account => account.code));
  for (const entry of data.entries) {
    if (!/^[a-z0-9-]{1,80}$/.test(entry.id || '') || ids.has(entry.id) || !Array.isArray(entry.lines) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) accessError('Asiento inválido o duplicado.', 400);
    ids.add(entry.id);
    let debit = 0, credit = 0;
    for (const line of entry.lines) {
      if (!accountCodes.has(line.a) || !Number.isFinite(line.d) || !Number.isFinite(line.c) || line.d < 0 || line.c < 0) accessError('Línea contable inválida.', 400);
      debit += line.d; credit += line.c;
    }
    if (Math.abs(debit - credit) > 0.011) accessError('El asiento no está cuadrado.', 400);
  }
  for (const entry of data.entries) if (entry.invoiceId && !ids.has(entry.invoiceId)) accessError('Conserva las facturas que tienen abonos vinculados.', 400);
}
function validateInvoice(entry, previous, products) {
  const sale = entry.type === 'venta';
  if (!Array.isArray(entry.items) || !entry.items.length || !['1101', '1102', sale ? '1201' : '2101'].includes(entry.pay)) accessError('Factura inválida.', 400);
  let subtotal = 0, vat = 0, cost = 0;
  const stock = [];
  for (const item of entry.items) {
    const product = products.find(record => record.id === item.p);
    if (!product || !Number.isFinite(item.q) || item.q <= 0 || !Number.isFinite(item.u) || item.u < 0 || !Number.isFinite(item.vatRate || 0) || item.vatRate < 0 || item.vatRate > 100) accessError('Producto o importe inválido.', 400);
    const oldItem = previous?.items?.find(record => record.p === item.p);
    const previousCost = (previous?.lines || []).filter(line => line.a === '5101').reduce((total, line) => total + line.d - line.c, 0);
    const previousWeighted = (previous?.items || []).reduce((total, record) => total + record.q * (products.find(product => product.id === record.p)?.cost || 0), 0);
    const unitCost = sale ? oldItem?.cost ?? (oldItem && previousWeighted > 0 ? previousCost * product.cost / previousWeighted : product.cost) : item.u;
    if (Math.abs((item.cost ?? unitCost) - unitCost) > 0.011) accessError('No puedes cambiar el costo desde ventas.', 400);
    subtotal += round(item.q * item.u); vat += round(round(item.q * item.u) * (item.vatRate || 0) / 100); cost += item.q * unitCost;
    item.unit = oldItem ? oldItem.unit || 'unidad' : product.unit || 'unidad';
    stock.push({ pid: item.p, q: sale ? -item.q : item.q, unit: item.unit, unitCost });
  }
  subtotal = round(subtotal); vat = round(vat); cost = round(cost);
  const total = round(subtotal + vat);
  const lines = sale ? [{ a: entry.pay, d: total, c: 0 }, { a: '4101', d: 0, c: subtotal }] : [{ a: '1301', d: subtotal, c: 0 }, { a: entry.pay, d: 0, c: total }];
  if (vat) lines.push(sale ? { a: '2106', d: 0, c: vat } : { a: '1202', d: vat, c: 0 });
  if (sale && cost) lines.push({ a: '5101', d: cost, c: 0 }, { a: '1301', d: 0, c: cost });
  if (!equal(lines, entry.lines) || !equal(stock, entry.stock) || entry.total !== total) accessError('Los importes o movimientos de la factura no coinciden.', 400);
}
function validateCustomers(data) {
  if (!Array.isArray(data.customers)) accessError('Cartera de clientes inválida.', 400);
  const ids = new Set(), taxIds = new Set();
  const fields = { name: 200, taxId: 80, phone: 80, email: 254, address: 1000, contact: 200, seller: 200, currency: 20, notes: 4000 };
  for (const customer of data.customers) {
    if (!customer || !/^[a-z0-9-]{1,80}$/.test(customer.id || '') || ids.has(customer.id)) accessError('Cliente inválido o duplicado.', 400);
    ids.add(customer.id);
    for (const [name, maximum] of Object.entries(fields)) if (typeof customer[name] !== 'string' || customer[name].length > maximum) accessError('Ficha de cliente inválida.', 400);
    if (!customer.name.trim() || !customer.currency.trim() || !['contado', 'credito'].includes(customer.paymentType) || !['activo', 'suspendido', 'inactivo'].includes(customer.status) || ![15, 30, 45].includes(customer.creditDays) || !Number.isFinite(customer.creditLimit) || customer.creditLimit < 0 || customer.creditLimit > 999999999999) accessError('Condiciones del cliente inválidas.', 400);
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) accessError('Correo del cliente inválido.', 400);
    const taxId = customer.taxId.trim().toLowerCase();
    if (taxId && taxIds.has(taxId)) accessError('Ya existe un cliente con ese RUC o cédula.', 400);
    if (taxId) taxIds.add(taxId);
  }
  for (const entry of data.entries) if (entry.type === 'venta' && entry.customerId) {
    const customer = data.customers.find(record => record.id === entry.customerId);
    if (!customer) accessError('El cliente de la venta no está en esta cartera.', 400);
  }
}
export function mergeData(current, incoming, access) {
  if (!incoming || !['accounts', 'entries', 'products'].every(name => Array.isArray(incoming[name]))) accessError('Datos contables inválidos.', 400);
  if (incoming.customers === undefined) incoming.customers = allowed(access, 'ventas') ? structuredClone(current?.customers || []) : [];
  for (const name of ['employees', 'payrolls', 'taxes', 'properties', 'settlements']) if (incoming[name] !== undefined && !Array.isArray(incoming[name])) accessError('Datos contables inválidos.', 400);
  if (!Array.isArray(incoming.customers)) accessError('Cartera de clientes inválida.', 400);
  if(access.support||access.readOnlyLimit)accessError('Este acceso es de solo lectura.');
  if (access.owner && !(access.billingPlan?.blockedModules||[]).some(m=>['personal','fiscal'].includes(m))) { validateEntries(incoming); validateCustomers(incoming); return incoming; }
  if (!DATA_MODULES.some(module => allowed(access, module, true))) accessError('Tu acceso es de solo lectura.');
  const projected = projectData(current, { ...access, branchId: null });
  const merged = structuredClone(current);
  merged.customers = merged.customers || [];
  for (const [name, module] of Object.entries({ customers: 'ventas', accounts: 'contabilidad', employees: 'personal', payrolls: 'personal', settlements: 'personal', taxes: 'fiscal', properties: 'fiscal' })) {
    if (allowed(access, module, true)) merged[name] = structuredClone(incoming[name] || []);
    else if (!equal(incoming[name] || [], projected[name] || [])) accessError('No tienes permiso para modificar ' + module + '.');
  }
  if (allowed(access, 'ajustes', true) && allData(access, true)) merged.cfg = incoming.cfg;
  else if (allowed(access, 'fiscal', true)) merged.cfg.fiscal = incoming.cfg?.fiscal;
  const currentById = new Map((current.entries || []).map(entry => [entry.id, entry]));
  const incomingById = new Map(incoming.entries.map(entry => [entry.id, entry]));
  if (incomingById.size !== incoming.entries.length) accessError('Asientos duplicados.', 400);
  const changes = [];
  for (const previous of projected.entries) {
    const next = incomingById.get(previous.id);
    if (!equal(next, previous)) {
      if (!allowed(access, entryModule(previous), true) || (next && entryModule(next) !== entryModule(previous))) accessError('No tienes permiso para cambiar este asiento.');
      changes.push({ previous, next });
    }
  }
  for (const next of incoming.entries) if (!currentById.has(next.id)) {
    if (!allowed(access, entryModule(next), true)) accessError('No tienes permiso para crear este asiento.');
    changes.push({ next });
  } else if (!projected.entries.some(entry => entry.id === next.id)) accessError('No puedes modificar registros ocultos.');
  merged.entries = (current.entries || []).filter(entry => !changes.some(change => change.previous?.id === entry.id)).concat(changes.filter(change => change.next).map(change => change.next));
  const products = structuredClone(current.products || []);
  const stockChanges = new Map();
  const stockChange = id => {
    if (!stockChanges.has(id)) stockChanges.set(id, { quantity: 0, value: 0, purchase: false });
    return stockChanges.get(id);
  };
  for (const { previous, next } of changes) {
    if (next && ['venta', 'compra'].includes(next.type)) validateInvoice(next, previous, current.products || []);
    for (const entry of [previous, next].filter(Boolean)) for (const movement of entry.stock || []) {
      let product = products.find(record => record.id === movement.pid);
      if (!product && entry.type === 'invini' && allowed(access, 'inventario', true)) {
        const created = incoming.products.find(record => record.id === movement.pid);
        if (created) { product = { ...created, stock: 0 }; products.push(product); }
      }
      if (!product || !Number.isFinite(movement.q)) accessError('Movimiento de inventario inválido.', 400);
      const sign = entry === previous ? -1 : 1;
      stockChange(product.id).quantity += movement.q * sign;
    }
    for (const entry of [previous, next].filter(record => record?.type === 'compra')) for (const item of entry.items || []) {
      const change = stockChange(item.p);
      change.purchase = true;
      change.value += item.q * item.u * (entry === previous ? -1 : 1);
    }
  }
  for (const [id, change] of stockChanges) {
    const product = products.find(record => record.id === id);
    const quantity = Math.round((product.stock + change.quantity) * 1e6) / 1e6;
    if (change.purchase) {
      const value = product.stock * product.cost + change.value;
      if (value < -0.011) accessError('La valoración del inventario sería negativa.', 400);
      product.cost = quantity > 0 ? round(Math.max(0, value) / quantity) : product.cost;
    }
    product.stock = quantity;
  }
  if (products.some(product => product.stock < 0)) accessError('Existencias insuficientes.', 400);
  merged.products = allowed(access, 'inventario', true) ? incoming.products : products;
  if (merged.products.some(product => !Number.isFinite(product.stock) || product.stock < 0 || !Number.isFinite(product.cost) || product.cost < 0)) accessError('Existencias o costo de producto inválidos.', 400);
  if (!allowed(access, 'inventario', true) && projected.products.length) {
    const proposed = structuredClone(incoming.products);
    for (const product of proposed) if (allowed(access, 'compras', true) && stockChanges.get(product.id)?.purchase) {
      if (!Number.isFinite(product.cost) || product.cost < 0) accessError('Costo de producto inválido.', 400);
      product.cost = products.find(record => record.id === product.id)?.cost;
    }
    if (!equal(proposed, products)) accessError('No puedes modificar el catálogo o el inventario directamente.');
  }
  const oldReceipts = new Map((current.taxes || []).filter(tax => tax.receipt).map(tax => [tax.id, tax.receipt]));
  for (const tax of merged.taxes || []) if (oldReceipts.has(tax.id)) tax.receipt = oldReceipts.get(tax.id);
  for(const [name,module] of Object.entries({...ADVANCED_ARRAYS,...TRADE_ARRAYS})) if(!equal(incoming[name]||[],projected[name]||[])) accessError('Usa la operación autorizada para modificar '+name+'.');
  validateEntries(merged);
  validateCustomers(merged);
  return merged;
}
export function dataChanges(previous, next) {
  const changes = [];
  for (const name of new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])) {
    const before = previous?.[name], after = next?.[name];
    if (equal(before, after)) continue;
    if (Array.isArray(before) || Array.isArray(after)) {
      const oldRows = new Map((before || []).map(record => [record.id || record.code, record]));
      const newRows = new Map((after || []).map(record => [record.id || record.code, record]));
      for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) if (!equal(oldRows.get(id), newRows.get(id))) changes.push({ area: name, id, before: oldRows.get(id) || null, after: newRows.get(id) || null });
    } else changes.push({ area: name, before: before ?? null, after: after ?? null });
  }
  return changes;
}
export async function audit(client, companyId, session, action, changes, revision = null) {
  await client.insert(auditEvents).values({ companyId, branchId: session.auditBranchId ?? (session.activeBranchId === 'all' ? null : session.activeBranchId || 'principal'), actor: actorName(session), action, changes, revision });
}
export async function checkpoint(client, company) {
  if (!company.data) return [];
  await client.insert(companyBackups).values({ companyId: company.id, name: company.name, description: company.description, data: company.data, revision: company.revision }).onConflictDoNothing();
  const retained = await client.select({ revision: companyBackups.revision }).from(companyBackups).where(eq(companyBackups.companyId, company.id)).orderBy(desc(companyBackups.revision)).limit(30);
  if (retained.length === 30) {
    const removed = await client.delete(companyBackups).where(and(eq(companyBackups.companyId, company.id), lt(companyBackups.revision, retained[29].revision))).returning({ data: companyBackups.data });
    return removed.flatMap(backup => receiptRecords(backup.data).map(record => record.receipt.key));
  }
  return [];
}
export async function updateCompany(companyId, session, revision, mutate, action = 'Datos contables actualizados', operation = null) {
  let obsoleteKeys = [];
  const result = await db.transaction(async client => {
    const timings = {}, started = performance.now();
    const access = await companyAccess(client, companyId, session, true, false);
    if(access.support||access.readOnlyLimit)accessError('Este acceso es de solo lectura.');
    timings.readMs = Math.round(performance.now() - started);
    const operationActor = operation ? operation.actor + ':' + (access.branchId || 'all') : null;
    if (operation) {
      const [receipt] = await client.select().from(saveOperations).where(and(eq(saveOperations.companyId, companyId), eq(saveOperations.operationId, operation.id)));
      if (receipt) {
        if (receipt.actor !== operationActor || receipt.payloadHash !== operation.hash) accessError('Identificador de guardado reutilizado con otros datos.', 422);
        return {revision: receipt.revision, replayed: true, resultId: receipt.resultId};
      }
    }
    access.company.data = await readAccounting(client, access.company);
    timings.readMs = Math.round(performance.now() - started);
    const remember = async result => {
      if (operation) await client.insert(saveOperations).values({companyId, operationId: operation.id, actor: operationActor, payloadHash: operation.hash, revision: result.revision, resultId: operation.resultId?.() || null});
      return result;
    };
    const fullCompany = access.company;
    const company = { ...fullCompany, data: scopeBranch(fullCompany.data, access) };
    if (!Number.isInteger(revision) || company.revision !== revision) accessError('Los datos cambiaron en otra pestaña. Descarga un respaldo y recarga antes de continuar.', 409);
    let phase = performance.now();
    const patch = await mutate(company, access, client);
    timings.validateMs = Math.round(performance.now() - phase);
    const crossBranch=patch.crossBranch;delete patch.crossBranch;
    if(crossBranch && !CROSS_BRANCH_OPS.some(op=>action==='Operación: '+op)) accessError('Operación entre sucursales no autorizada.');
    if (patch.data) {
      if(!crossBranch) patch.data = mergeBranch(fullCompany.data, company.data, patch.data, access, action === 'Operación: branch' && access.owner);
      materializeBranches(patch.data);
      guardPeriods(fullCompany.data, patch.data, action);
      await syncBarcodes(client, fullCompany, patch.data);
    }
    if (Object.entries(patch).every(([name, value]) => equal(fullCompany[name], value))) return remember({ revision: company.revision, data: projectData(fullCompany.data, access) });
    phase = performance.now();
    obsoleteKeys = await checkpoint(client, fullCompany);
    timings.backupMs = Math.round(performance.now() - phase);
    const [updated] = await client.update(companies).set({ ...patch, revision: company.revision + 1, updatedAt: new Date() }).where(eq(companies.id, companyId)).returning();
    phase = performance.now();
    await syncAccounting(client, fullCompany, updated);
    timings.recordsMs = Math.round(performance.now() - phase);
    const changes = dataChanges(fullCompany.data, updated.data);
    for (const field of ['name', 'description']) if (company[field] !== updated[field]) changes.push({ area: field, before: company[field], after: updated[field] });
    await audit(client, companyId, { ...session, auditBranchId: access.branchId }, action, changes, updated.revision);
    return remember({ revision: updated.revision, data: projectData(updated.data, access), timings });
  });
  if (obsoleteKeys.length) {
    try {
      const [current] = await db.select({ data: companies.data }).from(companies).where(eq(companies.id, companyId));
      const backups = await retainedCompanyData(db, companyId);
      const referenced = new Set([current, ...backups].flatMap(record => receiptRecords(record.data).map(item => item.receipt.key)));
      const store = getStore({ name: 'acontec-private-receipts', consistency: 'strong' });
      for (const key of new Set(obsoleteKeys)) if (key.startsWith(companyId + '/') && !referenced.has(key)) await store.delete(key);
    } catch { console.error('Acontec: limpieza de comprobantes antiguos pendiente'); }
  }
  return result;
}
export function validatePermissions(permissions, access, role) {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) accessError('Permisos inválidos.', 400);
  const result = {};
  for (const module of MODULES) {
    const level = permissions[module] || 'ninguno';
    if (!['ninguno', 'lectura', 'escritura'].includes(level)) accessError('Permisos inválidos.', 400);
    if (level !== 'ninguno' && !allowed(access, module, level === 'escritura')) accessError('No puedes conceder permisos que no tienes.');
    result[module] = level;
  }
  const prospective = { owner: false, permissions: result, member: { role } };
  if (['ajustes', 'auditoria'].some(module => result[module] !== 'ninguno') && !allData(prospective)) accessError('Ajustes y auditoría requieren lectura de todos los módulos por contener información completa.', 400);
  if (result.ajustes === 'escritura' && !allData(prospective, true)) accessError('Restaurar respaldos requiere escritura en todos los módulos.', 400);
  if (result.accesibilidad === 'escritura' && !allData(prospective, true)) accessError('Administrar accesos requiere escritura en todos los módulos.', 400);
  if (!MODULES.some(module => result[module] !== 'ninguno')) accessError('Selecciona al menos un módulo.', 400);
  return result;
}
export async function manageMember(companyId, session, body) {
  if (body.id && !/^[a-f0-9-]{36}$/.test(body.id)) accessError('Acceso no encontrado.', 404);
  const passwordHash = body.password ? await passwordDigest(body.password) : null;
  return db.transaction(async client => {
    const access = await companyAccess(client, companyId, session, true);
    if (!allowed(access, 'accesibilidad', true)) accessError('Solo los responsables autorizados administran los accesos.');
    let previous;
    if (body.id) [previous] = await client.select().from(companyMembers).where(and(eq(companyMembers.id, body.id), eq(companyMembers.companyId, companyId)));
    if (body.id && !previous) accessError('Acceso no encontrado.', 404);
    if (previous && (previous.id === session.member?.id || previous.email === session.email)) accessError('No puedes modificar tu propio acceso.');
    if (previous && previous.version !== body.version) accessError('El acceso cambió. Recarga la lista.', 409);
    const name = String(body.name || '').trim().slice(0, 100), role = String(body.role || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase() || null;
    const username = String(body.username || '').trim().toLowerCase() || null;
    if (!name || !role || (email && !/^\S+@\S+\.\S+$/.test(email)) || (username && !/^[a-z][a-z0-9._-]{3,39}$/.test(username))) accessError('Revisa nombre, cargo, correo y usuario (4 a 40 caracteres).', 400);
    if (email === access.company.ownerEmail) accessError('El acceso del dueño y de la administración no se modifica aquí.', 400);
    if (!email && !username) accessError('Indica un correo o un nombre de usuario.', 400);
    if (username && !(passwordHash || previous?.passwordHash)) accessError('Establece la contraseña del usuario.', 400);
    if (username) {
      const [duplicate] = await client.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.username, username));
      if (duplicate && duplicate.id !== previous?.id) accessError('Ese nombre de usuario ya está ocupado.', 409);
    }
    if (email) {
      const [duplicate] = await client.select({ id: companyMembers.id }).from(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.email, email)));
      if (duplicate && duplicate.id !== previous?.id) accessError('Ese correo ya tiene acceso a la empresa.', 409);
    }
    if (!previous) {
      const count = await client.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.companyId, companyId)).limit(100);
      if (count.length >= 100) accessError('Límite de 100 accesos por empresa.', 400);
    }
    const branchIds = body.branchIds ?? previous?.branchIds ?? ['principal'];
    if (!Array.isArray(branchIds) || !branchIds.length || branchIds.some(id => !companyBranches(access.company.data).some(b => b.id === id && b.active !== false))) accessError('Selecciona sucursales válidas.', 400);
    if (!access.owner && branchIds.some(id => !access.branches.some(b => b.id === id))) accessError('No puedes asignar otra sucursal.');
    const values = { branchIds, name, role, email, username, permissions: validatePermissions(body.permissions, access, role), active: body.active !== false, passwordHash: username ? passwordHash || previous?.passwordHash : null };
    const [member] = previous ? await client.update(companyMembers).set({ ...values, version: previous.version + 1 }).where(eq(companyMembers.id, previous.id)).returning() : await client.insert(companyMembers).values({ ...values, companyId }).returning();
    if (previous) await client.delete(sessions).where(or(eq(sessions.memberId, previous.id), ...(previous.email ? [eq(sessions.email, previous.email)] : [])));
    await audit(client, companyId, session, previous ? 'Acceso modificado' : 'Acceso creado', [{ area: 'accesibilidad', id: member.id, before: previous ? safeMember(previous) : null, after: safeMember(member), passwordChanged: !!passwordHash }]);
    return safeMember(member);
  });
}


// Una empresa por operación, solo su dueño, sin cambiar su revisión contable.
export async function migrateAccountingStorage(companyId, session, body) {
  return db.transaction(async client => {
    // Evita hidratar para permitir recuperación del JSON cuando falla la proyección.
    const access = await companyAccess(client, companyId, session);
    if (!access.owner) accessError('Solo el dueño puede migrar o recuperar el almacenamiento.');
    const [company] = await client.select().from(companies).where(eq(companies.id, companyId)).for('update');
    if (!Number.isInteger(body.revision) || body.revision !== company.revision) accessError('La empresa cambió. Repite la verificación con la revisión vigente.', 409);
    const mode = body.action || 'verify';
    if (!['verify', 'apply', 'rollback'].includes(mode)) accessError('Operación de almacenamiento inválida.', 400);
    let result;
    if (mode === 'verify') {
      const converted = normalizeDocument(companyId, company.data);
      const state = await storageState(client, companyId);
      if (state?.mode === 'relational') await readAccounting(client, company);
      return { mode: state?.mode || 'legacy', revision: company.revision, counts: converted.manifest.counts, debitCents: converted.manifest.debitCents, creditCents: converted.manifest.creditCents, verified: true, persisted: false };
    }
    if (mode === 'apply') result = await convertAccounting(client, company);
    else result = await returnToLegacy(client, company);
    await audit(client, companyId, session, mode === 'apply' ? 'Almacenamiento relacional activado y verificado' : 'Lectura JSON recuperada sin borrar tablas', [{ area: 'almacenamiento', after: result }], company.revision);
    return { ...result, verified: true, persisted: true };
  });
}
