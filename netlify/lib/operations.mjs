import { tradeOperation, TRADE_OPS } from './trade.mjs';
import { countryTemplate } from './country.mjs';
import { importRecords } from './importer.mjs';
import { invoiceTotals, payrollTotals, allocateReturnItems } from './accounting-engine.mjs';
import { transferOperation, CROSS_BRANCH_OPS } from './transfers.mjs';
import { advancedOperation, handlesAdvanced } from './advanced.mjs';
import { companyBranches, recordBranch } from './branches.mjs';
import { retainedCompanyData } from './accounting-storage.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { and, eq } from 'drizzle-orm';
import { companyMembers, siteContent } from '../../db/schema.ts';
import { allowed, equal, accessError, updateCompany, actorName } from './access.mjs';
import { OPERATION_ARRAYS, operationalRole, salesAdministrator, supervisor, cashAdministrator, operatorId, receiptRecords } from './policies.mjs';

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const cents = value => Math.round(value * 100);
const text = (value, maximum = 200) => String(value || '').trim().slice(0, maximum);
const requireValue = (condition, message) => { if (!condition) accessError(message, 400); };
const amount = (value, zero = false) => {
  const number = Number(value);
  requireValue(Number.isFinite(number) && number >= (zero ? 0 : 0.01) && number <= 999999999 && Math.abs(number - round(number)) < 0.00001, 'Importe inválido; usa como máximo dos decimales.');
  return round(number);
};
const dateValue = value => {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Fecha inválida.');
  return value;
};
export const ledgerBalance = (data, account, through = '9999') => round((data.entries || []).filter(entry => entry.date <= through).reduce((total, entry) => total + (entry.lines || []).filter(line => line.a === account).reduce((sum, line) => sum + line.d - line.c, 0), 0));
const linesBetween = (debit, credit, total) => [{ a: debit, d: total, c: 0 }, { a: credit, d: 0, c: total }];
const requirePermission = (access, module) => { if (!allowed(access, module, true)) accessError('No tienes permiso para realizar esta operación.'); };
const financialCash = access => { if (!cashAdministrator(access) || !allowed(access, 'cajas', true)) accessError('Solo un responsable de caja autorizado realiza esta operación.'); };
const accountExists = (data, code, types) => requireValue(data.accounts.some(account => account.code === code && (!types || types.includes(account.tipo))), 'Selecciona una cuenta contable válida.');
const cashAccounts = data => data.accounts.filter(account => account.code === '1101' || account.code === '1102' || account.code === '1104' || account.code.startsWith('1103-')).map(account => account.code);
const spentVouchers = (data, fundId) => round(data.pettyVouchers.filter(voucher => voucher.fundId === fundId && !voucher.replenishmentId && !voucher.reversalId).reduce((total, voucher) => total + voucher.total, 0));
export function initializeOperations(data) {
  requireValue(data && Array.isArray(data.entries) && Array.isArray(data.accounts) && Array.isArray(data.products), 'Abre primero la empresa para inicializar su contabilidad.');
  for (const name of OPERATION_ARRAYS) data[name] ||= [];
  data.customers ||= [];
  data.taxes ||= [];
  data.cfg ||= {};
  data.invoiceSequences ||= {};
  for (const [code, name, tipo, nat, sub] of [
    ['3191', 'Diferencias de inventario por corrección', 'patrimonio', 'C', ''],
    ['1104', 'Efectivo en turnos de facturación', 'activo', 'D', 'ef'],
    ['1202', 'IVA acreditable / por cobrar', 'activo', 'D', ''],
    ['2102', 'Impuestos por pagar', 'pasivo', 'C', ''],
    ['2106', 'IVA cobrado / por pagar', 'pasivo', 'C', ''],
    ['2107', 'Vales contabilizados por reponer', 'pasivo', 'C', ''],
    ['4190', 'Sobrantes de caja', 'ingreso', 'C', ''],
    ['6108', 'Impuesto sobre ganancias', 'gasto', 'D', ''],
    ['6190', 'Faltantes de caja', 'gasto', 'D', ''],
  ]) if (!data.accounts.some(account => account.code === code)) data.accounts.push({ code, name, tipo, nat, sub });
  return data;
}
function appendEntry(data, session, record) {
  const entry = { id: randomUUID(), actor: actorName(session), managed: true, ...record };
  dateValue(entry.date);
  requireValue(Array.isArray(entry.lines) && entry.lines.every(line => Number.isFinite(line.d) && Number.isFinite(line.c) && line.d >= 0 && line.c >= 0 && !(line.d && line.c)), 'Asiento inválido.');
  for (const line of entry.lines) accountExists(data, line.a);
  requireValue(Math.abs(entry.lines.reduce((total, line) => total + line.d - line.c, 0)) < 0.011, 'El asiento no cuadra.');
  data.entries.push(entry);
  return entry;
}
function currentShift(data, access, session, id) {
  const shift = data.shifts.find(record => record.id === id && !record.closedAt);
  requireValue(shift && (shift.operatorId === operatorId(access, session) || supervisor(access)), 'Selecciona un turno abierto propio o autorizado por el supervisor.');
  return shift;
}
const shiftPayments = (data, shift) => {
  const result = { efectivo: 0, tarjeta: 0, transferencia: 0, credito: 0 };
  for (const entry of data.entries.filter(record => record.shiftId === shift.id && ['venta', 'nota-credito'].includes(record.type))) for (const payment of entry.payments || []) result[payment.method] = round(result[payment.method] + payment.amount * (entry.type === 'nota-credito' ? -1 : 1));
  return result;
};
export function guardCash(previous, next) {
  for (const code of cashAccounts(next)) {
    const minimum = data => {
      let balance = 0, lowest = 0;
      const days = new Map();
      for (const entry of data?.entries || []) days.set(entry.date, (days.get(entry.date) || 0) + (entry.lines || []).filter(line => line.a === code).reduce((total, line) => total + line.d - line.c, 0));
      for (const [, net] of [...days].sort(([first], [second]) => first.localeCompare(second))) {
        balance = round(balance + net);
        lowest = Math.min(lowest, balance);
      }
      return lowest;
    };
    requireValue(minimum(next) >= Math.min(0, minimum(previous)) - 0.01, 'El movimiento deja caja o banco en negativo en alguna fecha. Revisa el fondo y la fecha.');
  }
}
export function guardLedgerMutation(previous, next, access) {
  requireValue(typeof next.cfg?.cur === 'string' && next.cfg.cur.length > 0 && next.cfg.cur.length <= 20 && !/[<>&"'`]/.test(next.cfg.cur), 'Usa un símbolo o código de moneda, sin contenido HTML.');
  for(const record of next.payrolls||[]){const old=previous?.payrolls?.find(p=>p.id===record.id);if(!equal(old,record)){const calculated=payrollTotals(record);requireValue(calculated.gross===record.gross&&calculated.net===record.net,'Los importes de la nómina no coinciden.');}}
  const productIds = new Set();
  for (const product of next.products) {
    requireValue(/^[a-z0-9-]{1,80}$/.test(product.id || '') && !productIds.has(product.id) && typeof product.name === 'string' && product.name.trim() && product.name.length <= 200, 'Producto inválido o duplicado.');
    productIds.add(product.id);
    requireValue(Number.isFinite(product.price) && product.price >= 0 && Number.isFinite(Number(product.min || 0)) && Number(product.min || 0) >= 0 && Number.isFinite(Number(product.vatRate || 0)) && Number(product.vatRate || 0) >= 0 && Number(product.vatRate || 0) <= 100, 'Precio, mínimo o IVA del producto inválido.');
  }
  for (const name of [...OPERATION_ARRAYS, 'assets','loans','recurringEntries','exchangeRates','foreignDocuments','budgets','quotations','purchaseOrders','attendance','vacationRequests','employeeAdvances','stockTransfers','withholdings','instruments','partners', 'invoiceSequences']) {
    const empty = name === 'invoiceSequences' ? {} : [];
    requireValue(equal(previous?.[name] || empty, next[name] || empty), 'Usa la operación específica para modificar facturación, cajas o costos.');
  }
  requireValue(equal(previous?.cfg?.print || {}, next.cfg?.print || {}), 'Configura la impresión desde Ajustes.');
  requireValue(equal(previous?.cfg?.pos || {}, next.cfg?.pos || {}) && equal(previous?.cfg?.cash || {}, next.cfg?.cash || {}) && equal(previous?.cfg?.advance || {}, next.cfg?.advance || {}), 'Los parámetros operativos solo se modifican desde su configuración.');
  const before = new Map((previous?.entries || []).map(entry => [entry.id, entry]));
  const after = new Map(next.entries.map(entry => [entry.id, entry]));
  for (const entry of before.values()) if (entry.type === 'venta' || entry.managed) requireValue(equal(entry, after.get(entry.id)), 'Las facturas y operaciones de caja no se editan ni se borran. Emite una nota de crédito o una anulación.');
  for (const entry of before.values()) if (entry.lines?.some(line => ['1101', '1102', '1104'].includes(line.a) || line.a.startsWith('1103-'))) requireValue(equal(entry, after.get(entry.id)), 'Los movimientos de dinero no se borran ni sobrescriben. Anula con un asiento inverso desde Caja general o registra una corrección documentada.');
  for (const entry of next.entries) if (!equal(before.get(entry.id), entry)) {
    requireValue(!entry.managed && !['venta', 'nota-credito', 'costo', 'caja', 'caja-apertura', 'caja-cierre'].includes(entry.type), 'Registra las ventas desde Facturación con un turno abierto.');
    for (const line of entry.lines || []) {
      requireValue(line.a !== '1104' && !line.a.startsWith('1103-') && line.a !== '2107', 'Las cuentas de turnos y caja chica se mueven desde sus módulos.');
      if (line.a === '1101' && line.c > 0) requireValue(text(entry.reference), 'Cada egreso de Caja general necesita un número de comprobante.');
    }
    if (entry.type === 'abono') {
      const invoice = after.get(entry.invoiceId);
      requireValue(invoice && ['1201', '2101'].includes(invoice.pay) && entry.date >= invoice.date && entry.total > 0 && entry.lines.length === 2, 'El abono debe vincularse a una factura de crédito válida.');
      const debit = invoice.pay === '1201' ? entry.lines.find(line => ['1101', '1102'].includes(line.a) && line.d === entry.total && line.c === 0) : entry.lines.find(line => line.a === '2101' && line.d === entry.total && line.c === 0);
      const credit = invoice.pay === '1201' ? entry.lines.find(line => line.a === '1201' && line.c === entry.total && line.d === 0) : entry.lines.find(line => ['1101', '1102'].includes(line.a) && line.c === entry.total && line.d === 0);
      requireValue(debit && credit, 'El asiento del abono no coincide con el pago.');
      const remaining = next.entries.filter(record => record.id === invoice.id || record.invoiceId === invoice.id || record.reversalOf === invoice.id).reduce((total, record) => total + record.lines.filter(line => line.a === invoice.pay).reduce((sum, line) => sum + (invoice.pay === '1201' ? line.d - line.c : line.c - line.d), 0), 0);
      requireValue(remaining >= -0.01, 'El abono supera la deuda pendiente de la factura.');
    }
    if (entry.supplierId) {
      const supplier = next.suppliers?.find(record => record.id === entry.supplierId);
      requireValue(supplier && (supplier.active || before.get(entry.id)?.supplierId === supplier.id), 'El proveedor no pertenece a esta empresa o está inactivo.');
    }
  }
  for (const tax of previous?.taxes || []) if (tax.source === 'anticipo') {
    const updated = next.taxes?.find(record => record.id === tax.id);
    requireValue(updated && ['source', 'period', 'base', 'rate', 'withholdings', 'amount', 'entryId'].every(name => equal(tax[name], updated[name])), 'Conserva la obligación y el cálculo del anticipo generado.');
  }
  const previousProducts = new Map((previous?.products || []).map(product => [product.id, product]));
  const stockTotals = entries => {
    const totals = new Map();
    for (const entry of entries || []) for (const row of entry.stock || []) totals.set(row.pid, (totals.get(row.pid) || 0) + row.q);
    return totals;
  };
  const previousStock = stockTotals(previous?.entries), nextStock = stockTotals(next.entries);
  for (const product of next.products || []) {
    const old = previousProducts.get(product.id);
    if (old && product.cost !== old.cost) requireValue(next.entries.some(entry => !equal(before.get(entry.id), entry) && entry.type === 'compra' && entry.items?.some(item => item.p === product.id)) || (previous?.entries || []).some(entry => !after.has(entry.id) && entry.type === 'compra' && entry.items?.some(item => item.p === product.id)), 'Edita el costo desde Productos para generar la revalorización contable.');
    const expected = Math.round(((old?.stock || 0) + (nextStock.get(product.id) || 0) - (previousStock.get(product.id) || 0)) * 1e6) / 1e6;
    requireValue(product.unit === undefined || (typeof product.unit === 'string' && product.unit.trim().length > 0 && product.unit.length <= 40), 'Unidad de medida inválida.');
    if (old) requireValue((product.unit || 'unidad') === (old.unit || 'unidad'), 'Edita la unidad desde Productos.');
    requireValue(Number.isFinite(expected) && Math.abs(product.stock - expected) <= 0.000001, 'La existencia debe coincidir con los movimientos del Kardex; usa un ajuste de inventario.');
  }
  for (const product of previous?.products || []) if (!next.products.some(record => record.id === product.id)) requireValue(product.stock === 0 && !next.entries.some(entry => entry.stock?.some(movement => movement.pid === product.id)), 'No se elimina un producto con existencias o movimientos históricos.');
  for (const entry of next.entries) if (!equal(before.get(entry.id), entry)) {
    for (const movement of entry.stock || []) requireValue(Number.isFinite(movement.q) && next.products.some(product => product.id === movement.pid), 'Movimiento de inventario inválido.');
    if (['invini', 'ajuste'].includes(entry.type)) {
      const valuation = round((entry.stock || []).reduce((total, movement) => total + movement.q * (movement.unitCost ?? next.products.find(product => product.id === movement.pid)?.cost ?? 0), 0));
      const posted = entry.lines.filter(line => line.a === '1301').reduce((total, line) => total + line.d - line.c, 0);
      requireValue(Math.abs(valuation - posted) <= 0.011, 'La valoración del movimiento debe coincidir con el asiento de inventario.');
    }
  }
  if (!access.owner) {
    for (const name of OPERATION_ARRAYS) if (!equal(previous?.[name] || [], next[name] || [])) requireValue(name === 'suppliers' && allowed(access, 'proveedores', true), 'Sin permiso para modificar datos operativos.');
  }
  for (const product of next.products || []) requireValue(Number.isFinite(product.stock) && product.stock >= 0 && Number.isFinite(product.cost) && product.cost >= 0, 'Existencia o costo inválido.');
  guardCash(previous, next);
}
function movement(data, session, body, debit, credit, total, extra = {}) {
  requireValue(text(body.reference), 'Indica el número de comprobante.');
  const entry = appendEntry(data, session, { date: dateValue(body.date), type: 'caja', desc: text(body.concept) || 'Movimiento de caja', reference: text(body.reference), party: text(body.party), documentId: text(body.documentId), paymentMethod: text(body.method), total, lines: linesBetween(debit, credit, total), ...extra });
  const record = { id: randomUUID(), entryId: entry.id, date: entry.date, reference: entry.reference, concept: entry.desc, total, currency: text(body.currency, 20) || data.cfg.cur || 'C$', exchangeRate: Number(body.exchangeRate || 1), method: text(body.method) || 'efectivo', party: text(body.party), documentId: text(body.documentId), debit, credit, actor: actorName(session), ...extra };
  requireValue(['efectivo', 'transferencia', 'cheque'].includes(record.method) && Number.isFinite(record.exchangeRate) && record.exchangeRate > 0 && record.exchangeRate < 1000000, 'Moneda, forma o tipo de cambio inválido.');
  record.baseTotal = round(total * record.exchangeRate);
  requireValue(record.baseTotal >= 0.01 && record.baseTotal <= 999999999, 'El monto convertido debe ser al menos un centavo y no exceder el límite.');
  entry.lines = linesBetween(debit, credit, record.baseTotal);
  entry.total = record.baseTotal;
  data.cashMovements.push(record);
  return record;
}
function validateSupplier(data, body) {
  const supplier = { id: body.id || randomUUID(), name: text(body.name), taxId: text(body.taxId, 80), phone: text(body.phone, 80), email: text(body.email, 254), address: text(body.address, 1000), contact: text(body.contact), seller: text(body.seller), paymentType: body.paymentType === 'credito' ? 'credito' : 'contado', creditLimit: amount(body.creditLimit || 0, true), creditDays: Number(body.creditDays || 30), currency: text(body.currency, 20) || data.cfg.cur || 'C$', active: body.active !== false, notes: text(body.notes, 4000) };
  requireValue(supplier.name && Number.isSafeInteger(supplier.creditDays) && supplier.creditDays >= 0 && supplier.creditDays <= 3650, 'Revisa nombre y plazo del proveedor.');
  requireValue(!supplier.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email), 'Correo del proveedor inválido.');
  requireValue(!supplier.taxId || !data.suppliers.some(record => record.id !== supplier.id && record.taxId.toLowerCase() === supplier.taxId.toLowerCase()), 'Ya existe un proveedor con ese RUC.');
  return supplier;
}
function createVoucher(data, access, session, body, accruedEntryId = null) {
  const fund = data.pettyFunds.find(record => record.id === body.fundId && !record.closedAt);
  requireValue(fund && (cashAdministrator(access) || fund.responsible === operatorId(access, session)), 'No tienes acceso a ese fondo.');
  const base = amount(body.base), vatRate = Number(body.vatRate || 0);
  requireValue(Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100, 'IVA inválido.');
  const vat = round(base * vatRate / 100), total = round(base + vat);
  requireValue(total <= fund.limit && total <= round(fund.fixedAmount - spentVouchers(data, fund.id)), 'El vale supera el límite por gasto o el disponible del fondo.');
  requireValue(text(body.reference) && text(body.concept) && text(body.beneficiary), 'El vale requiere comprobante, concepto y beneficiario.');
  accountExists(data, body.account, ['gasto', 'costo']);
  const date = dateValue(body.date);
  requireValue(date >= fund.date && date >= (fund.lastReplenishedDate || fund.date) && date >= (fund.lastCountDate || fund.date), 'El vale no puede preceder a la constitución, última reposición o último arqueo.');
  const voucher = { id: randomUUID(), fundId: fund.id, operatorId: operatorId(access, session), date, reference: text(body.reference), concept: text(body.concept), category: text(body.category) || 'General', beneficiary: text(body.beneficiary), authorizedBy: actorName(session), account: body.account, base, vatRate, vat, total, accruedEntryId, replenishmentId: null };
  data.pettyVouchers.push(voucher);
  return voucher;
}
function registerCost(data, access, session, body) {
  const catalog = data.costCatalog.find(record => record.id === body.catalogId && record.active);
  requireValue(catalog, 'Selecciona un costo activo del catálogo.');
  const base = amount(body.base ?? catalog.amount), vatRate = Number(body.vatRate || 0);
  requireValue(Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100, 'IVA inválido.');
  const vat = round(base * vatRate / 100), total = round(base + vat), date = dateValue(body.date);
  requireValue(text(body.reference), 'El costo necesita un número de recibo o comprobante.');
  const supplier = data.suppliers.find(record => record.id === body.supplierId);
  if (body.supplierId) requireValue(supplier?.active, 'Selecciona un proveedor activo.');
  let pay = body.pay;
  requireValue(['1101', '1102', '2101', 'petty'].includes(pay), 'Forma de pago inválida.');
  if (pay === 'petty') pay = '2107';
  const lines = [{ a: catalog.account, d: base, c: 0 }, { a: pay, d: 0, c: total }];
  if (vat) lines.push({ a: '1202', d: vat, c: 0 });
  const entry = appendEntry(data, session, { date, type: 'costo', desc: 'Costo - ' + catalog.name, party: supplier?.name || text(body.party) || catalog.name, supplierId: supplier?.id || '', reference: text(body.reference), due: dateValue(body.due || date), pay, subtotal: base, vat, total, lines });
  requireValue(entry.due >= date || pay !== '2101', 'El vencimiento no puede ser anterior al costo.');
  const record = { id: randomUUID(), entryId: entry.id, catalogId: catalog.id, name: catalog.name, type: catalog.type, direct: catalog.direct, center: catalog.center, account: catalog.account, date, period: date.slice(0, 7), base, vat, total, pay: body.pay, reference: entry.reference, beneficiary: entry.party, operatorId: operatorId(access, session), recurringPeriod: body.recurringPeriod || null, saleId: body.saleId || null };
  if (body.recurringPeriod) {
    requireValue(/^\d{4}-\d{2}$/.test(body.recurringPeriod) && body.recurringPeriod === date.slice(0, 7) && catalog.recurring && !data.costs.some(cost => cost.catalogId === catalog.id && cost.recurringPeriod === body.recurringPeriod && !cost.reversalId), 'Ese costo recurrente ya se confirmó o el período no corresponde.');
  }
  if (body.pay === 'petty') {
    const voucher = createVoucher(data, access, session, { ...body, base, vatRate, account: catalog.account, category: catalog.name, concept: entry.desc, beneficiary: entry.party }, entry.id);
    record.voucherId = voucher.id;
  }
  data.costs.push(record);
  return record;
}
function makeSale(data, access, session, body) {
  requirePermission(access, 'facturacion');
  const date = dateValue(body.date), payments = body.payments;
  requireValue(Array.isArray(payments) && payments.length > 0 && payments.length <= 4, 'Indica las formas de pago.');
  const methods = new Set();
  for (const payment of payments) {
    requireValue(['efectivo', 'tarjeta', 'transferencia', 'credito'].includes(payment.method) && !methods.has(payment.method), 'Forma de pago inválida o repetida.');
    methods.add(payment.method); payment.amount = amount(payment.amount);
  }
  const nonCredit = payments.some(payment => payment.method !== 'credito');
  let shift = null;
  if (body.shiftId || nonCredit) shift = currentShift(data, access, session, body.shiftId);
  requireValue(shift || salesAdministrator(access), 'El equipo registra las ventas dentro de un turno abierto.');
  if (shift) requireValue(date >= shift.date, 'La factura no puede ser anterior a la apertura del turno.');
  const settings = data.cfg.pos || {}, role = access.owner ? 'dueno' : operationalRole(access);
  const discount = Number(body.discount || 0), limit = settings.discountLimits?.[role] ?? (role === 'dueno' ? 100 : role === 'supervisor' ? 10 : 0);
  requireValue(Number.isFinite(discount) && discount >= 0 && discount <= limit && discount < 100, `El descuento excede el límite autorizado (${limit}%).`);
  requireValue(Array.isArray(body.items) && body.items.length && body.items.length <= 200, 'Agrega productos a la factura.');
  const quantities = new Map();
  const items = body.items.map(item => {
    const product = data.products.find(record => record.id === item.p), quantity = Number(item.q);
    requireValue(product && Number.isFinite(quantity) && quantity > 0 && quantity <= 1000000 && Math.abs(quantity - Math.round(quantity * 1e6) / 1e6) < 1e-9, 'Producto o cantidad inválida.');
    quantities.set(product.id, (quantities.get(product.id) || 0) + quantity);
    const price = amount(item.u ?? product.price, true), unit = round(price * (1 - discount / 100)), vatRate = Number(product.vatRate || 0);
    requireValue(Number.isFinite(price) && price >= 0 && Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100, 'Precio o IVA de producto inválido.');
    const effectiveDiscount = product.price > 0 ? (1 - unit / product.price) * 100 : 0;
    requireValue(effectiveDiscount <= limit + 0.000001, `La rebaja del precio excede el límite autorizado (${limit}%).`);
    return { originalPrice: product.price, code: product.code || '', p: product.id, name: product.name, unit: product.unit || 'unidad', q: quantity, listPrice: price, u: unit, cost: product.cost, vatRate };
  });
  for (const [id, quantity] of quantities) requireValue(data.products.find(product => product.id === id).stock >= quantity, 'Existencia insuficiente.');
  const {subtotal,vat,total}=invoiceTotals(items);
  requireValue(total > 0 && cents(payments.reduce((sum, payment) => sum + payment.amount, 0)) === cents(total), 'La suma de los pagos debe coincidir exactamente con el total.');
  const customer = data.customers.find(record => record.id === body.customerId);
  if (body.customerId) requireValue(customer && customer.status === 'activo', 'Selecciona un cliente activo.');
  const credit = payments.find(payment => payment.method === 'credito')?.amount || 0;
  const due = dateValue(body.due || date);
  requireValue(!credit || due >= date, 'Revisa el vencimiento del crédito.');
  if (credit && customer?.creditLimit > 0) {
    const invoices = new Set(data.entries.filter(entry => entry.customerId === customer.id).map(entry => entry.id));
    const balance = data.entries.filter(entry => invoices.has(entry.id) || invoices.has(entry.invoiceId)).reduce((sum, entry) => sum + (entry.lines || []).filter(line => line.a === '1201').reduce((total, line) => total + line.d - line.c, 0), 0);
    requireValue(round(balance + credit) <= customer.creditLimit, 'La venta supera el límite de crédito del cliente.');
  }
  const series = text(body.series || 'A', 16).toUpperCase();
  requireValue(/^[A-Z0-9-]{1,16}$/.test(series) && (settings.series || [{ code: 'A' }]).some(record => record.code === series), 'Selecciona una serie autorizada.');
  const historicalMax = data.entries.filter(entry => entry.type === 'venta').reduce((maximum, entry) => {
    const suffix = String(entry.reference || '').startsWith(series + '-') ? String(entry.reference).slice(series.length + 1) : '';
    return /^\d{1,9}$/.test(suffix) ? Math.max(maximum, Number(suffix)) : maximum;
  }, 0);
  const sequence = Math.max(data.invoiceSequences[series] || 0, historicalMax) + 1;
  data.invoiceSequences[series] = sequence;
  const reference = `${series}-${String(sequence).padStart(8, '0')}`;
  requireValue(!data.entries.some(entry => entry.type === 'venta' && entry.reference === reference), 'La numeración coincide con una factura histórica. Configura el siguiente número de serie.');
  requireValue((settings.series||[{code:'A',branchId:'principal'}]).some(record=>record.code===series&&(record.branchId||'principal')===access.branchId),'Selecciona una serie de la sucursal activa.');
  const paymentAccounts = { efectivo: '1104', tarjeta: '1102', transferencia: '1102', credito: '1201' };
  const lines = payments.map(payment => ({ a: paymentAccounts[payment.method], d: payment.amount, c: 0 }));
  lines.push({ a: '4101', d: 0, c: subtotal });
  if (vat) lines.push({ a: '2106', d: 0, c: vat });
  const cost = round(items.reduce((sum, item) => sum + item.q * item.cost, 0));
  if (cost) lines.push(...linesBetween('5101', '1301', cost));
  const quotation=body.sourceQuotation?data.quotations?.find(q=>q.id===body.sourceQuotation):null;
  requireValue(!body.sourceQuotation||quotation?.status==='Pendiente','La cotización no está disponible para convertir.');
  const entry = appendEntry(data, session, { date, due, reference, series, sequence, type: 'venta', origin: body.origin === 'ventas' ? 'ventas' : 'facturacion', desc: 'Venta - ' + (customer?.name || text(body.party) || 'Cliente general'), party: customer?.name || text(body.party) || 'Cliente general', customerId: customer?.id || '', customer: customer ? { name: customer.name, taxId: customer.taxId, address: customer.address, phone: customer.phone } : null, operatorId: operatorId(access, session), operatorName: actorName(session), shiftId: shift?.id || null, discount, items, payments, pay: credit ? '1201' : methods.has('efectivo') ? '1104' : '1102', subtotal, vat, total, creditAmount: credit, stock: items.map(item => ({ pid: item.p, q: -item.q, unit: item.unit, unitCost: item.cost })), lines });
  if(quotation){quotation.status='Convertida';quotation.entryId=entry.id;}
  for (const [id, quantity] of quantities) { const product = data.products.find(record => record.id === id); product.stock = Math.round((product.stock - quantity) * 1e6) / 1e6; }
  if (settings.packagingCostId) {
    const catalog = data.costCatalog.find(record => record.id === settings.packagingCostId && record.active);
    requireValue(catalog, 'El costo de empaque configurado ya no está activo.');
    registerCost(data, access, session, { catalogId: catalog.id, date, due: date, base: catalog.amount, reference: 'EMPAQUE-' + reference, pay: settings.packagingPay || '2101', party: 'Empaque por venta', saleId: entry.id });
  }
  return entry;
}
function creditNote(data, access, session, body) {
  requirePermission(access, 'facturacion');
  if (!supervisor(access)) accessError('La anulación o devolución requiere el acceso de un supervisor.');
  const original = data.entries.find(entry => entry.id === body.id && entry.type === 'venta');
  requireValue(original && original.items?.length && text(body.reason), 'Selecciona una factura e indica el motivo.');
  requireValue(original.items.every(item => Number.isFinite(item.cost)), 'La factura histórica no guarda costos por producto. Conserva el original y registra un ajuste contable documentado con el contador.');
  const date = dateValue(body.date);
  requireValue(date >= original.date, 'La nota no puede ser anterior a la factura.');
  const previousNotes = data.entries.filter(entry => entry.type === 'nota-credito' && entry.invoiceId === original.id);
  const {items,finalReturn}=allocateReturnItems(original.items,previousNotes,body.items);
  requireValue(items.every(item=>data.products.some(product=>product.id===item.p)),'Uno de los productos de la devolución ya no existe.');
  let subtotal = round(items.reduce((sum, item) => sum + round(item.q * item.u), 0)), vat = round(items.reduce((sum, item) => sum + round(round(item.q * item.u) * (item.vatRate || 0) / 100), 0));

  if (finalReturn) {
    subtotal = round((original.subtotal ?? original.total - (original.vat || 0)) - previousNotes.reduce((sum, note) => sum + note.subtotal, 0));
    vat = round((original.vat || 0) - previousNotes.reduce((sum, note) => sum + note.vat, 0));
  }
  const total = round(subtotal + vat);
  const debt = round(data.entries.filter(entry => entry.id === original.id || entry.invoiceId === original.id).reduce((sum, entry) => sum + (entry.lines || []).filter(line => line.a === '1201').reduce((value, line) => value + line.d - line.c, 0), 0));
  const debtReduction = Math.min(Math.max(0, debt), total), refund = round(total - debtReduction);
  const payments = [];
  if (debtReduction) payments.push({ method: 'credito', amount: debtReduction });
  let shift = null;
  if (refund) {
    requireValue(['efectivo', 'tarjeta', 'transferencia'].includes(body.refundMethod), 'Selecciona cómo se devuelve el dinero.');
    shift = currentShift(data, access, session, body.shiftId);
    requireValue(date >= shift.date, 'La nota no puede ser anterior al turno de devolución.');
    payments.push({ method: body.refundMethod, amount: refund });
    if (body.refundMethod === 'efectivo') requireValue(round(shift.opening + shiftPayments(data, shift).efectivo) >= refund, 'No hay efectivo suficiente en el turno para devolverlo.');
  }
  const lines = [{ a: '4101', d: subtotal, c: 0 }];
  if (vat) lines.push({ a: '2106', d: vat, c: 0 });
  for (const payment of payments) lines.push({ a: payment.method === 'credito' ? '1201' : payment.method === 'efectivo' ? '1104' : '1102', d: 0, c: payment.amount });
  let cost = round(items.reduce((sum, item) => sum + item.q * item.cost, 0));
  if (finalReturn) cost = round(original.lines.filter(line => line.a === '5101').reduce((sum, line) => sum + line.d - line.c, 0) - previousNotes.reduce((sum, note) => sum + note.lines.filter(line => line.a === '5101').reduce((total, line) => total + line.c - line.d, 0), 0));
  if (cost) lines.push(...linesBetween('1301', '5101', cost));
  const number = (data.invoiceSequences.NC || 0) + 1; data.invoiceSequences.NC = number;
  const note = appendEntry(data, session, { date, type: 'nota-credito', invoiceId: original.id, reference: 'NC-' + String(number).padStart(8, '0'), desc: 'Nota de crédito - ' + (original.reference || original.id), party: original.party, customerId: original.customerId || '', reason: text(body.reason, 1000), supervisor: actorName(session), originalOperatorId: original.operatorId || null, originalOperatorName: original.operatorName || original.actor || 'Histórico', operatorId: operatorId(access, session), shiftId: shift?.id || null, items, payments, debtReduction, refund, subtotal, vat, total, stock: items.map(item => ({ pid: item.p, q: item.q, unit: item.unit || 'unidad', unitCost: item.cost })), lines });
  for (const item of items) { const product = data.products.find(record => record.id === item.p), value = product.stock * product.cost + item.q * item.cost; product.stock = Math.round((product.stock + item.q) * 1e6) / 1e6; product.cost = round(value / product.stock); }
  return note;
}
async function saveAttachment(data, companyId, body, record, addedKeys, historical) {
  if (!body.file) return;
  requireValue(data.cfg.cash?.receiptsEnabled, 'El dueño debe autorizar primero los comprobantes privados en Configuración de caja.');
  const file = body.file;
  requireValue(typeof file.content === 'string' && file.content.length <= 1400000 && /^[A-Za-z0-9+/]*={0,2}$/.test(file.content), 'Archivo inválido.');
  const bytes = Buffer.from(file.content, 'base64');
  const valid = file.type === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : file.type === 'image/webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  requireValue(bytes.length > 0 && bytes.length <= 1048576 && valid, 'Adjunta PDF, JPG, PNG o WebP de hasta 1 MB.');
  const receipts = [...new Map([data, ...historical.map(row => row.data)].flatMap(document => receiptRecords(document).map(item => [item.receipt.key, item.receipt]))).values()];
  requireValue(receipts.length < 100 && receipts.reduce((total, receipt) => total + receipt.size, 0) + bytes.length <= 50 * 1048576, 'La empresa supera 100 comprobantes o 50 MB, incluidas las versiones recuperables.');
  const key = `${companyId}/${randomUUID()}`;
  addedKeys.push(key);
  await getStore({ name: 'acontec-private-receipts', consistency: 'strong' }).set(key, bytes);
  record.receipt = { key, name: text(file.name, 180).replace(/[\x00-\x1f\x7f/\\]/g, '') || 'comprobante', type: file.type, size: bytes.length };
}
export async function runOperation(companyId, session, body) {
  const addedKeys = [];
  let output = null;
  if(body.operationId && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.operationId)) accessError('Identificador de operación inválido.',400);
  const receipt=body.operationId?{id:body.operationId,actor:session.email+':'+(session.memberId||''),hash:createHash('sha256').update(JSON.stringify(body)).digest('hex'),resultId:()=>typeof output==='string'?output:null}:null;
  try {
    const result = await updateCompany(companyId, session, body.revision, async (company, access, client) => {
      const crossBranch=CROSS_BRANCH_OPS.includes(body.operation);
      const data = initializeOperations(structuredClone(crossBranch?access.company.data:company.data));
      const operationSession = access.member ? { ...session, member: access.member } : session;
      const historical = body.file ? await retainedCompanyData(client, companyId) : [];
      const beforeIds=new Set(data.entries.map(e=>e.id));
      const operation = body.operation, userId = operatorId(access, session);
      if(operation==='countryTemplate'){requirePermission(access,'fiscal');let template;try{template=countryTemplate(body)}catch(error){accessError(error.message,400)}data.cfg.countryTemplate=template;data.cfg.fiscal={...data.cfg.fiscal,...template.fiscal};for(const [code,name,tipo,nat]of [['6109','Aportes patronales','gasto','D'],['2112','Aportes patronales por pagar','pasivo','C']])if(!data.accounts.some(a=>a.code===code))data.accounts.push({code,name,tipo,nat,sub:''});}
      else if(crossBranch){output=transferOperation(data,access,operationSession,body,{requireValue,requirePermission,appendEntry,dateValue,amount,ledgerBalance,guardCash});}
      else if(TRADE_OPS.includes(operation)){output=tradeOperation(data,access,operationSession,body,{requireValue,requirePermission,appendEntry,dateValue,amount,ledgerBalance,guardCash});}
      else if(operation==='importRecords'){ output=importRecords(data,access,operationSession,body,{requireValue,requirePermission,appendEntry,dateValue,validateSupplier}); }
      else if (handlesAdvanced(operation)) {
        output=advancedOperation(data,access,operationSession,body,{requireValue,requirePermission,appendEntry,dateValue,amount,actorName});
      } else if (operation === 'branch') {
        if(!access.owner) accessError('Solo el dueño administra sucursales.');
        const branches=companyBranches(company.data),old=branches.find(b=>b.id===body.id);
        const name=text(body.name,100),code=text(body.code,16).toUpperCase();
        requireValue(name && /^[A-Z0-9-]{1,16}$/.test(code), 'Revisa nombre y código de sucursal.');
        requireValue(!branches.some(b=>b.code===code&&b.id!==old?.id),'Código de sucursal repetido.');
        requireValue(!body.id||old,'Sucursal no encontrada.');
        if(!old){const [settings]=await client.select().from(siteContent).where(eq(siteContent.id,'branch-limits'));requireValue(branches.length < (settings?.content?.limit||5),'Se alcanzó el límite de sucursales configurado por Acontec.');}
        const branch={id:old?.id||randomUUID(),name,code,address:text(body.address,1000),phone:text(body.phone,80),active:body.active!==false,main:old?.main||false,createdAt:old?.createdAt||new Date().toISOString()};
        requireValue(!branch.main||branch.active,'La sucursal principal debe permanecer activa.');
        if(!branch.active)requireValue(!data.shifts.some(s=>!s.closedAt&&recordBranch(s)===branch.id),'Cierra los turnos antes de desactivar una sucursal.');
        if(!old){ data.cfg.pos||={series:[{code:'A',name:'Principal',branchId:'principal'}]};data.cfg.pos.series||=[{code:'A',name:'Principal',branchId:'principal'}];requireValue(!data.cfg.pos.series.some(s=>s.code===code),'El código coincide con una serie existente. Usa otro código de sucursal.');data.cfg.pos.series.push({code,name,branchId:branch.id});}
        data.branches=old?branches.map(b=>b.id===old.id?branch:b):[...branches,branch];output=branch.id;
      } else if (operation === 'printSettings') {
        if (!access.owner) accessError('Solo el dueño configura la impresión.');
        requireValue(['a4','letter','thermal'].includes(body.format), 'Formato inválido.');
        data.cfg.print = Object.fromEntries(['format','address','phone','email','creditTerms','legalText','thanks'].map(key => [key, text(body[key], 2000)]));
      } else if (operation === 'settings') {
        if (!access.owner) accessError('Solo el dueño configura cajas, series, descuentos y anticipos.');
        if (body.pos) {
          const series = body.pos.series;
          requireValue(Array.isArray(series) && series.length > 0 && series.length <= 50, 'Configura de 1 a 50 series.');
          const codes = new Set();
          requireValue(series.every(record=>!record.branchId||companyBranches(access.company.data).some(b=>b.id===record.branchId)),'La serie debe pertenecer a una sucursal de esta empresa.');
          for (const record of series) { requireValue(/^[A-Z0-9-]{1,16}$/.test(record.code || '') && record.code !== 'NC' && !codes.has(record.code), 'Código de serie inválido o repetido.'); codes.add(record.code); }
          const limits = {};
          for (const role of ['cajero', 'vendedor', 'supervisor', 'contador']) { const limit = Number(body.pos.discountLimits?.[role] || 0); requireValue(Number.isFinite(limit) && limit >= 0 && limit <= 99, 'Límite de descuento inválido.'); limits[role] = limit; }
          const packagingCostId = text(body.pos.packagingCostId);
          if (packagingCostId) requireValue(data.costCatalog.some(cost => cost.id === packagingCostId && cost.active) && ['1101', '1102', '2101'].includes(body.pos.packagingPay), 'Revisa el costo de empaque y su forma de pago.');
          const logo = text(body.pos.logo, 200);
          requireValue(!logo || /^\/api\/image\?key=[a-f0-9-]+\.webp$/.test(logo), 'Logo no autorizado.');
          data.cfg.pos = { series: series.map(record => ({ code: record.code, name: text(record.name, 80), branchId:record.branchId||data.cfg.pos?.series?.find(s=>s.code===record.code)?.branchId||access.branchId||'principal' })), discountLimits: limits, packagingCostId, packagingPay: body.pos.packagingPay || '2101', logo };
          for (const record of series) if (record.next !== undefined) { const next = Number(record.next); requireValue(Number.isSafeInteger(next) && next >= (data.invoiceSequences[record.code] || 0) + 1 && next <= 999999999, 'El próximo número no puede retroceder.'); data.invoiceSequences[record.code] = next - 1; }
        }
        if (body.cash) data.cfg.cash = { receiptsEnabled: body.cash.receiptsEnabled === true };
        if (body.advance) {
          const advance = body.advance;
          requireValue(typeof advance.enabled === 'boolean', 'Configuración de anticipo inválida.');
          const rate = Number(advance.rate || 0), deadlineDay = Number(advance.deadlineDay || 1);
          requireValue(Number.isFinite(rate) && rate >= 0 && rate <= 100 && Number.isInteger(deadlineDay) && deadlineDay >= 1 && deadlineDay <= 31, 'Revisa porcentaje y día de vencimiento.');
          requireValue(!advance.enabled || (text(advance.country) && advance.confirmed === true && rate > 0), 'Confirma país, porcentaje y vencimiento antes de activar el anticipo.');
          data.cfg.advance = { enabled: advance.enabled, country: text(advance.country, 80), rate, deadlineDay, confirmed: advance.enabled && advance.confirmed === true, confirmedAt: new Date().toISOString(), confirmedBy: session.email };
        }
      } else if (operation === 'supplier') {
        requirePermission(access, 'proveedores');
        if (body.id) requireValue(data.suppliers.some(record => record.id === body.id), 'Proveedor no encontrado.');
        const supplier = validateSupplier(data, body), index = data.suppliers.findIndex(record => record.id === supplier.id);
        if (index < 0) data.suppliers.push(supplier); else data.suppliers[index] = supplier;
        output = supplier.id;
      } else if (operation === 'stockCount') {
        requirePermission(access,'inventario');
        requireValue(body.confirmed===true&&Array.isArray(body.items)&&body.items.length>0&&body.items.length<=1000,'Confirma el resumen del conteo.');
        const date=dateValue(body.date),ids=new Set(),stock=[],counts=[];let increase=0,decrease=0;
        requireValue(['correccion','real'].includes(body.reason),'Selecciona el tratamiento de las diferencias.');
        for(const row of body.items){const product=data.products.find(p=>p.id===row.p),count=Number(row.count);requireValue(product&&!ids.has(product.id)&&Number.isFinite(count)&&count>=0&&count<=1e9&&Math.abs(count*1e6-Math.round(count*1e6))<1e-5,'Producto duplicado o cantidad inválida.');ids.add(product.id);requireValue(row.expected===product.stock,'El inventario cambió. Revisa el conteo nuevamente.');const q=Math.round((count-product.stock)*1e6)/1e6,value=round(Math.abs(q)*product.cost);counts.push({p:product.id,expected:product.stock,count,difference:q});if(!q)continue;stock.push({pid:product.id,q,unit:product.unit||'unidad',unitCost:product.cost});if(q>0)increase+=value;else decrease+=value;product.stock=count;}
        increase=round(increase);decrease=round(decrease);const lines=[];if(increase)lines.push(...linesBetween('1301',body.reason==='correccion'?'3191':'4102',increase));if(decrease)lines.push(...linesBetween(body.reason==='correccion'?'3191':'6107','1301',decrease));
        output=appendEntry(data,operationSession,{date,type:'conteo',desc:'Conteo físico confirmado · '+text(body.reason),counts,stock,total:round(increase+decrease),lines}).id;
      } else if (operation === 'inventoryAdjustment') {
        requirePermission(access, 'inventario');
        const product = data.products.find(record => record.id === body.id);
        const quantity = Number(body.quantity), reason = body.reason;
        requireValue(product && Number.isFinite(quantity) && quantity !== 0 && Math.abs(quantity) <= 1000000 && Math.abs(quantity - Math.round(quantity * 1e6) / 1e6) < 1e-9, 'Producto o cantidad inválida.');
        requireValue(['merma', 'error', 'conteo-inicial', 'sobrante'].includes(reason), 'Selecciona el motivo del ajuste.');
        requireValue(reason !== 'merma' || quantity < 0, 'La merma debe disminuir la existencia.');
        requireValue(reason !== 'sobrante' || quantity > 0, 'El sobrante real debe aumentar la existencia.');
        requireValue(text(body.note, 1000), 'Describe el motivo del ajuste.');
        const date = dateValue(body.date);
        requireValue(!data.entries.some(entry => entry.date > date && entry.stock?.some(row => row.pid === product.id)), 'El ajuste no puede preceder a movimientos posteriores del producto.');
        const stock = Math.round((product.stock + quantity) * 1e6) / 1e6;
        requireValue(stock >= 0, 'No puede quedar existencia negativa.');
        const total = round(Math.abs(quantity) * product.cost);
        const correction = ['error', 'conteo-inicial'].includes(reason);
        const counterpart = correction ? '3191' : quantity < 0 ? '6107' : '4102';
        requireValue(!correction || data.accounts.some(account => account.code === '3191' && account.tipo === 'patrimonio' && account.nat === 'C'), 'La cuenta 3191 debe ser patrimonial y acreedora.');
        const labels = { merma: 'Merma / pérdida real', error: 'Corrección de error de ingreso', 'conteo-inicial': 'Conteo inicial', sobrante: 'Sobrante real' };
        const entry = appendEntry(data, operationSession, { date, type: 'ajuste', adjustmentReason: reason, desc: labels[reason] + ' - ' + product.name + ': ' + text(body.note, 1000), total, stock: [{ pid: product.id, q: quantity, unit: product.unit || 'unidad', unitCost: product.cost }], lines: total ? quantity > 0 ? linesBetween('1301', counterpart, total) : linesBetween(counterpart, '1301', total) : [] });
        product.stock = stock;
        output = entry.id;
      } else if (operation === 'quickProduct') {
        requirePermission(access,'inventario');
        requireValue(text(body.name,200) && text(body.unit,40),'Escribe nombre y unidad.');
        const product={id:randomUUID(),name:text(body.name,200),unit:text(body.unit,40),code:text(body.code,80),price:amount(body.price,true),cost:amount(body.cost,true),stock:0,min:0,vatRate:0,barcodes:body.barcodes||[]};
        data.products.push(product);output=product.id;
      } else if (operation === 'product') {
        requirePermission(access, 'inventario');
        const product = data.products.find(record => record.id === body.id);
        if(product && body.barcodes !== undefined) product.barcodes=body.barcodes;
        requireValue(product && text(body.name), 'Producto no encontrado o nombre vacío.');
        const cost = amount(body.cost, true);
        requireValue(cost===product.cost || (access.company.data?.products?.find(p=>p.id===product.id)?.stock??product.stock)===product.stock,'El producto tiene existencias en otras sucursales. Una revalorización global requiere revisión contable.');
        const difference = round(product.stock * cost) - round(product.stock * product.cost);
        const date = dateValue(body.date);
        requireValue(cost === product.cost || !data.entries.some(entry => entry.date > date && (entry.productId === product.id || entry.stock?.some(movement => movement.pid === product.id))), 'La revalorización no puede preceder a movimientos posteriores del producto.');
        if (difference) appendEntry(data, operationSession, { date, type: 'ajuste-costo', desc: 'Revalorización de costo - ' + product.name, productId: product.id, previousCost: product.cost, nextCost: cost, stock: [{ pid: product.id, q: 0, unitCost: cost, revaluation: round(difference) }], total: Math.abs(difference), lines: difference > 0 ? linesBetween('1301', '6107', round(difference)) : linesBetween('6107', '1301', round(-difference)) });
        const unit = text(body.unit || product.unit || 'unidad', 40);
        requireValue(unit && (!product.unit || unit === product.unit || !access.company.data.entries.some(entry => entry.stock?.some(row => row.pid === product.id))), 'La unidad tiene movimientos históricos. Crea otro producto para una presentación diferente.');
        Object.assign(product, { unit, name: text(body.name), code: text(body.code, 80), cost, price: amount(body.price, true), min: Number(body.min || 0), vatRate: Number(body.vatRate || 0) });
        requireValue(Number.isFinite(product.min) && product.min >= 0 && Number.isFinite(product.vatRate) && product.vatRate >= 0 && product.vatRate <= 100, 'Stock mínimo o IVA inválido.');
      } else if (operation === 'openShift') {
        requirePermission(access, 'facturacion');
        requireValue(!data.shifts.some(shift => shift.operatorId === userId && !shift.closedAt), 'Ya tienes un turno abierto.');
        requireValue(['1101', '1102'].includes(body.source), 'Elige Caja general o Banco como origen del fondo.');
        const opening = amount(body.opening, true), shift = { id: randomUUID(), operatorId: userId, operatorName: actorName(operationSession), date: dateValue(body.date), opening, openedAt: new Date().toISOString(), reference: text(body.reference), closedAt: null };
        if (opening) { const record = movement(data, operationSession, { ...body, concept: 'Fondo inicial de turno', method: 'efectivo', exchangeRate: 1, currency: data.cfg.cur }, '1104', body.source, opening, { shiftId: shift.id, operatorId: userId }); shift.entryId = record.entryId; }
        data.shifts.push(shift); output = shift.id;
      } else if (operation === 'sale') output = makeSale(data, access, operationSession, body).id;
      else if (operation === 'creditNote') output = creditNote(data, access, operationSession, body).id;
      else if (operation === 'closeShift') {
        requirePermission(access, 'facturacion');
        const shift = currentShift(data, access, operationSession, body.id), date = dateValue(body.date);
        requireValue(date >= shift.date && !data.entries.some(entry => entry.shiftId === shift.id && entry.date > date), 'El cierre no puede ser anterior a los movimientos del turno.');
        const totals = shiftPayments(data, shift), expected = round(shift.opening + totals.efectivo), counted = amount(body.counted, true), difference = round(counted - expected);
        if (difference && !supervisor(access)) accessError('Un supervisor debe cerrar los turnos con diferencias.');
        requireValue(['1101', '1102'].includes(body.destination), 'Selecciona Caja general o Banco.');
        requireValue(text(body.reference), 'El cierre necesita comprobante de entrega o depósito.');
        if (difference) appendEntry(data, operationSession, { date, type: 'caja-diferencia', shiftId: shift.id, desc: 'Diferencia en cierre de turno', reference: text(body.reference), total: Math.abs(difference), lines: difference > 0 ? linesBetween('1104', '4190', difference) : linesBetween('6190', '1104', -difference) });
        if (counted) movement(data, operationSession, { ...body, date, concept: 'Entrega del cierre de caja', exchangeRate: 1, currency: data.cfg.cur, method: body.destination === '1102' ? 'transferencia' : 'efectivo' }, body.destination, '1104', counted, { shiftId: shift.id, operatorId: userId });
        Object.assign(shift, { closedAt: new Date().toISOString(), closedBy: actorName(operationSession), closeDate: date, expected, counted, difference, totals, destination: body.destination, closeReference: text(body.reference) });
      } else if (operation === 'cashMovement' || operation === 'deposit') {
        financialCash(access);
        const total = amount(body.total), debit = operation === 'deposit' ? '1102' : body.direction === 'ingreso' ? '1101' : body.contra, credit = operation === 'deposit' ? '1101' : body.direction === 'ingreso' ? body.contra : '1101';
        requireValue(debit !== credit && ![debit, credit].some(code => code === '1104' || code === '2107' || code.startsWith('1103-')), 'Usa la transferencia específica para turnos o caja chica.');
        accountExists(data, debit); accountExists(data, credit);
        const record = movement(data, operationSession, body, debit, credit, total);
        await saveAttachment(data, companyId, body, record, addedKeys, historical);
      } else if (operation === 'cashCount') {
        if (body.fundId && !cashAdministrator(access)) {
          requirePermission(access, 'cajas');
          requireValue(data.pettyFunds.some(fund => fund.id === body.fundId && fund.responsible === userId), 'Solo puedes arquear tu propio fondo.');
        } else financialCash(access);
        requireValue(text(body.reference), 'El arqueo necesita un número de comprobante.');
        const date = dateValue(body.date), counted = amount(body.counted, true);
        let account = '1101', vouchers = 0, expected;
        const fund = data.pettyFunds.find(record => record.id === body.fundId);
        if (body.fundId) {
          requireValue(fund && !fund.closedAt, 'Fondo no encontrado.');
          account = fund.account; vouchers = spentVouchers(data, fund.id); expected = round(fund.fixedAmount - vouchers);
          requireValue(date >= [...data.pettyVouchers.filter(voucher => voucher.fundId === fund.id).map(voucher => voucher.date), fund.date, fund.lastReplenishedDate || fund.date, fund.lastCountDate || fund.date].sort().at(-1), 'El arqueo de caja chica debe incluir todos sus movimientos vigentes.');
        } else expected = ledgerBalance(data, account, date);
        const difference = round(counted - expected);
        if (difference) {
          if (!supervisor(access)) accessError('El supervisor debe autorizar diferencias de arqueo.');
          appendEntry(data, operationSession, { date, type: 'caja-arqueo', desc: 'Diferencia de arqueo', reference: text(body.reference), total: Math.abs(difference), lines: difference > 0 ? linesBetween(account, '4190', difference) : linesBetween('6190', account, -difference) });
          if (fund) { fund.fixedAmount = round(fund.fixedAmount + difference); requireValue(fund.fixedAmount >= vouchers, 'El fondo no puede ser menor que los vales pendientes.'); }
        }
        data.cashCounts.push({ id: randomUUID(), date, reference: text(body.reference), fundId: fund?.id || null, account, expected, counted, vouchers, difference, authorizedFixedAmount: fund?.authorizedAmount || null, actor: actorName(operationSession), operatorId: userId });
        if (fund) fund.lastCountDate = date;
      } else if (operation === 'constituteFund') {
        financialCash(access);
        requireValue(text(body.name) && text(body.responsible) && ['1101', '1102'].includes(body.source), 'Indica nombre, responsable y origen del fondo.');
        if (body.responsible !== company.ownerEmail) {
          requireValue(/^[a-f0-9-]{36}$/.test(body.responsible), 'Selecciona un responsable activo de la empresa.');
          const [responsible] = await client.select({ id: companyMembers.id }).from(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.id, body.responsible), eq(companyMembers.active, true)));
          requireValue(responsible, 'El responsable debe ser el dueño o un acceso activo de esta empresa.');
        }
        const fixedAmount = amount(body.fixedAmount), limit = amount(body.limit);
        requireValue(limit <= fixedAmount, 'El límite por gasto no puede superar el fondo.');
        const id = randomUUID(), account = '1103-' + id;
        data.accounts.push({ code: account, name: 'Caja chica - ' + text(body.name), tipo: 'activo', nat: 'D', sub: 'ef' });
        const record = movement(data, operationSession, { ...body, concept: 'Constitución de caja chica - ' + text(body.name), method: 'efectivo', exchangeRate: 1, currency: data.cfg.cur }, account, body.source, fixedAmount);
        data.pettyFunds.push({ id, account, name: text(body.name), responsible: text(body.responsible), fixedAmount, authorizedAmount: fixedAmount, limit, date: body.date, entryId: record.entryId });
      } else if (operation === 'voucher') {
        requirePermission(access, 'cajas');
        const voucher = createVoucher(data, access, operationSession, body);
        await saveAttachment(data, companyId, body, voucher, addedKeys, historical);
      } else if (operation === 'regularizeFund') {
        financialCash(access);
        if (!supervisor(access)) accessError('El supervisor autoriza la regularización del fondo.');
        const fund = data.pettyFunds.find(record => record.id === body.fundId && !record.closedAt);
        requireValue(fund && ['1101', '1102'].includes(body.source), 'Selecciona fondo y cuenta de dinero.');
        const difference = round(fund.authorizedAmount - fund.fixedAmount), date = dateValue(body.date);
        requireValue(difference !== 0 && date >= (fund.lastCountDate || fund.date), 'No hay diferencias por regularizar o la fecha precede al arqueo.');
        movement(data, operationSession, { ...body, date, concept: 'Regularización de fondo fijo - ' + fund.name, method: 'efectivo', currency: data.cfg.cur, exchangeRate: 1 }, difference > 0 ? fund.account : body.source, difference > 0 ? body.source : fund.account, Math.abs(difference));
        fund.fixedAmount = fund.authorizedAmount;
      } else if (operation === 'voidVoucher') {
        requirePermission(access, 'cajas');
        if (!supervisor(access)) accessError('El supervisor autoriza la anulación de vales.');
        const voucher = data.pettyVouchers.find(record => record.id === body.id && !record.replenishmentId && !record.reversalId && !record.accruedEntryId);
        requireValue(voucher && text(body.reason), 'El vale ya fue repuesto, anulado o se corrige desde Costos.');
        const date = dateValue(body.date);
        requireValue(date >= voucher.date, 'La anulación no puede preceder al vale.');
        const fund = data.pettyFunds.find(record => record.id === voucher.fundId);
        requireValue(date >= (fund.lastCountDate || fund.date), 'La anulación no puede preceder al último arqueo.');
        const entry = appendEntry(data, operationSession, { date, type: 'caja-vale-anulacion', desc: 'Anulación de vale pendiente - ' + text(body.reason), voucherId: voucher.id, reference: voucher.reference, total: 0, lines: [] });
        voucher.reversalId = entry.id;
      } else if (operation === 'replenish') {
        financialCash(access);
        requireValue(['1101', '1102'].includes(body.source) && text(body.reference), 'Indica origen y comprobante de reposición.');
        const fund = data.pettyFunds.find(record => record.id === body.fundId && !record.closedAt);
        requireValue(fund, 'Fondo no encontrado.');
        const vouchers = data.pettyVouchers.filter(voucher => voucher.fundId === fund.id && !voucher.replenishmentId && !voucher.reversalId);
        requireValue(vouchers.length, 'No hay vales pendientes.');
        const date = dateValue(body.date);
        requireValue(vouchers.every(voucher => voucher.date <= date), 'La reposición no puede ser anterior a sus vales.');
        const lines = [];
        for (const voucher of vouchers) {
          if (voucher.accruedEntryId) lines.push({ a: '2107', d: voucher.total, c: 0 });
          else { lines.push({ a: voucher.account, d: voucher.base, c: 0 }); if (voucher.vat) lines.push({ a: '1202', d: voucher.vat, c: 0 }); }
        }
        const total = round(vouchers.reduce((sum, voucher) => sum + voucher.total, 0));
        lines.push({ a: body.source, d: 0, c: total });
        const entry = appendEntry(data, operationSession, { date, type: 'caja-reposicion', desc: 'Reposición exacta - ' + fund.name, reference: text(body.reference), total, voucherIds: vouchers.map(voucher => voucher.id), lines });
        for (const voucher of vouchers) voucher.replenishmentId = entry.id;
        fund.lastReplenishedDate = date;
        data.cashMovements.push({ id: randomUUID(), date, reference: entry.reference, concept: entry.desc, total, baseTotal: total, currency: data.cfg.cur, exchangeRate: 1, method: 'efectivo', credit: body.source, debit: fund.account, entryId: entry.id, actor: actorName(operationSession) });
      } else if (operation === 'reverseMovement') {
        financialCash(access);
        if (!supervisor(access)) accessError('Solo el supervisor anula movimientos.');
        const record = data.cashMovements.find(item => item.id === body.id && !item.reversalId);
        const original = data.entries.find(entry => entry.id === record?.entryId);
        requireValue(original && original.type === 'caja' && !record.shiftId && !record.debit.startsWith('1103-') && !record.credit.startsWith('1103-') && text(body.reason) && text(body.reference), 'Este movimiento requiere su corrección específica o ya está anulado.');
        const date = dateValue(body.date);
        requireValue(date >= original.date, 'La anulación no puede ser anterior al movimiento.');
        const reversal = appendEntry(data, operationSession, { date, type: 'caja-anulacion', reversalOf: original.id, desc: 'Anulación - ' + text(body.reason), reference: text(body.reference), total: original.total, lines: original.lines.map(line => ({ a: line.a, d: line.c, c: line.d })) });
        record.reversalId = reversal.id;
      } else if (operation === 'reverseLegacyCash') {
        financialCash(access);
        if (!supervisor(access)) accessError('El supervisor autoriza las anulaciones de dinero.');
        const original = data.entries.find(entry => entry.id === body.id && !entry.managed);
        requireValue(original && ['manual', 'gasto', 'compra', 'abono', 'fiscal-pago'].includes(original.type) && original.lines.some(line => ['1101', '1102'].includes(line.a)) && !data.entries.some(entry => entry.reversalOf === original.id), 'Este asiento ya está anulado o requiere su corrección específica.');
        requireValue(text(body.reason) && text(body.reference), 'Indica motivo y comprobante de la anulación.');
        const date = dateValue(body.date);
        requireValue(date >= original.date, 'La anulación no puede preceder al asiento.');
        const stock = (original.stock || []).map(movement => ({ ...movement, q: -movement.q }));
        const changes = new Map();
        for (const movement of stock) {
          const product = data.products.find(record => record.id === movement.pid);
          requireValue(product, 'Un producto del asiento ya no existe.');
          const change = changes.get(product.id) || { quantity: 0, value: 0 };
          change.quantity += movement.q;
          change.value += movement.q * (movement.unitCost ?? original.items?.find(item => item.p === product.id)?.u ?? product.cost);
          changes.set(product.id, change);
        }
        for (const [id, change] of changes) {
          const product = data.products.find(record => record.id === id), quantity = Math.round((product.stock + change.quantity) * 1e6) / 1e6, value = product.stock * product.cost + change.value;
          requireValue(quantity >= 0 && value >= -0.01, 'La anulación dejaría inventario negativo; registra un ajuste documentado.');
          product.stock = quantity;
          if (quantity > 0) product.cost = round(Math.max(0, value) / quantity);
        }
        appendEntry(data, operationSession, { date, type: 'caja-anulacion', reversalOf: original.id, invoiceId: original.invoiceId || null, taxId: original.taxId || null, desc: 'Anulación documentada - ' + text(body.reason), reference: text(body.reference), total: original.total, stock, lines: original.lines.map(line => ({ a: line.a, d: line.c, c: line.d })) });
      } else if (operation === 'costCatalog') {
        requirePermission(access, 'costos');
        accountExists(data, body.account, ['gasto', 'costo']);
        const record = { id: body.id || randomUUID(), name: text(body.name), type: body.type, direct: body.direct === true, center: text(body.center) || 'General', account: body.account, amount: amount(body.amount || 0, true), recurring: body.recurring === true, startMonth: text(body.startMonth, 7), active: body.active !== false };
        requireValue(record.name && ['fijo', 'variable'].includes(record.type) && /^\d{4}-(0[1-9]|1[0-2])$/.test(record.startMonth), 'Revisa el nombre, tipo y mes inicial del costo.');
        const index = data.costCatalog.findIndex(cost => cost.id === record.id);
        if (body.id) requireValue(index >= 0, 'Costo no encontrado.');
        if (index < 0) data.costCatalog.push(record); else data.costCatalog[index] = record;
      } else if (operation === 'cost') {
        requirePermission(access, 'costos');
        const record = registerCost(data, access, operationSession, body);
        await saveAttachment(data, companyId, body, record, addedKeys, historical);
      } else if (operation === 'reverseCost') {
        requirePermission(access, 'costos');
        if (!supervisor(access)) accessError('Solo el supervisor anula costos.');
        const cost = data.costs.find(record => record.id === body.id && !record.reversalId), original = data.entries.find(entry => entry.id === cost?.entryId);
        requireValue(cost && original && text(body.reason) && text(body.reference), 'Costo no encontrado o motivo vacío.');
        const date = dateValue(body.date);
        requireValue(date >= original.date, 'La anulación no puede ser anterior al costo.');
        requireValue(!data.entries.some(entry => entry.invoiceId === original.id), 'El costo tiene abonos; revierte primero esos pagos mediante un asiento autorizado.');
        const voucher = data.pettyVouchers.find(record => record.id === cost.voucherId);
        requireValue(!voucher?.replenishmentId, 'El vale ya fue repuesto; requiere un ajuste autorizado de caja.');
        const reversal = appendEntry(data, operationSession, { date, type: 'costo', reversalOf: original.id, desc: 'Anulación de costo - ' + text(body.reason), reference: text(body.reference), total: original.total, lines: original.lines.map(line => ({ a: line.a, d: line.c, c: line.d })) });
        cost.reversalId = reversal.id; if (voucher) voucher.reversalId = reversal.id;
      } else if (operation === 'advance') {
        requirePermission(access, 'fiscal');
        const settings = data.cfg.advance;
        requireValue(settings?.enabled && settings.confirmed, 'El dueño debe confirmar país, porcentaje y fecha límite antes de crear anticipos.');
        const month = body.month;
        requireValue(/^\d{4}-(0[1-9]|1[0-2])$/.test(month || ''), 'Período inválido.');
        requireValue(!data.taxes.some(tax => tax.source === 'anticipo' && tax.period === month), 'Ya existe una obligación de anticipo para ese mes.');
        const base = round(data.entries.filter(entry => entry.date.slice(0, 7) === month && ['venta', 'nota-credito'].includes(entry.type)).reduce((total, entry) => total + (entry.subtotal ?? entry.total - (entry.vat || 0)) * (entry.type === 'nota-credito' ? -1 : 1), 0));
        const withholdings = amount(body.withholdings || 0, true), grossAdvance = round(Math.max(0, base) * settings.rate / 100), total = Math.max(0, round(grossAdvance - withholdings));
        requireValue(total > 0, 'No hay anticipo a pagar; no se genera una obligación ni un gasto en cero.');
        const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
        requireValue(end < new Date().toISOString().slice(0, 10), 'El mes debe haber terminado antes de crear su obligación de anticipo. Puedes consultar la estimación mientras está en curso.');
        const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1));
        const finalDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
        const due = `${nextMonth.toISOString().slice(0, 7)}-${String(Math.min(settings.deadlineDay, finalDay)).padStart(2, '0')}`;
        requireValue(body.confirmed === true && body.rate === settings.rate && body.due === due, 'Confirma el porcentaje y el vencimiento calculado.');
        const entry = appendEntry(data, operationSession, { date: end, type: 'fiscal-anticipo', desc: 'Anticipo mensual IR - ' + month, total, lines: linesBetween('6108', '2102', total) });
        data.taxes.push({ id: randomUUID(), name: 'Anticipo mensual IR', source: 'anticipo', period: month, date: end, due, base, rate: settings.rate, withholdings, grossAdvance, amount: total, paid: 0, payments: [], entryId: entry.id, expense: '6108', liability: '2102', frequency: 'mensual', country: settings.country });
      } else accessError('Operación no encontrada.', 404);
      for(const entry of data.entries)if(!beforeIds.has(entry.id)){if(body.costCenter)entry.costCenter=text(body.costCenter,100);if(body.project)entry.project=text(body.project,100);}
      guardCash(crossBranch?access.company.data:company.data, data);
      return { data, ...(crossBranch?{crossBranch:true}:{}) };
    }, 'Operación: ' + text(body.operation, 50), receipt);
    return { ...result, id: result.replayed ? result.resultId : output };
  } catch (error) {
    const store = getStore({ name: 'acontec-private-receipts', consistency: 'strong' });
    for (const key of addedKeys) { try { await store.delete(key); } catch {} }
    throw error;
  }
}
