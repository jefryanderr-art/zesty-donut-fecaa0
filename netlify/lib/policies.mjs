export const PLATFORM_OWNER = 'jefryanderr@gmail.com';
export const OPERATION_ARRAYS = ['shifts', 'cashMovements', 'pettyFunds', 'pettyVouchers', 'cashCounts', 'costCatalog', 'costs', 'suppliers'];
export const operationalRole = access => String(access.member?.role || access.role || '').trim().toLowerCase();
export const salesAdministrator = access => access.owner || operationalRole(access) === 'contador';
export const supervisor = access => access.owner || operationalRole(access) === 'supervisor';
export const cashAdministrator = access => access.owner || ['contador', 'supervisor'].includes(operationalRole(access));
export const operatorId = (access, session) => access.member?.id || session.email;
export const receiptRecords = data => ['taxes', 'pettyVouchers', 'cashMovements', 'costs'].flatMap(name => (data?.[name] || []).filter(record => record.receipt));
export function roleAllows(access, module) {
  if (access.owner) return true;
  const role = operationalRole(access);
  if (module === 'ventas' && role !== 'contador') return false;
  if (['cajero', 'vendedor', 'supervisor'].includes(role) && ['contabilidad', 'finanzas', 'personal', 'fiscal', 'ajustes', 'auditoria', 'accesibilidad'].includes(module)) return false;
  if (['cajero', 'vendedor'].includes(role) && !['facturacion', 'inventario', 'cajas','cuentas_abiertas','agenda','despacho','documentos_venta','comprobantes','medidas','rutas'].includes(module)) return false;
  if (['cajero', 'vendedor'].includes(role) && module === 'inventario') return 'lectura';
  return true;
}
