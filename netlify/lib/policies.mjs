import '../../public/role-permissions.js';
export const roleRules = globalThis.AcontecRoles;
export const adminEmail = () => String(globalThis.Netlify?.env?.get('ADMIN_EMAIL') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
export const adminPasswordLogin = () => String(globalThis.Netlify?.env?.get('ADMIN_PASSWORD_LOGIN') ?? process.env.ADMIN_PASSWORD_LOGIN ?? '').trim().toLowerCase() !== 'off';
export const OPERATION_ARRAYS = ['shifts', 'cashMovements', 'pettyFunds', 'pettyVouchers', 'cashCounts', 'costCatalog', 'costs', 'suppliers'];
export const operationalRole = access => String(access.member?.role || access.role || '').trim().toLowerCase();
export const salesAdministrator = access => access.owner || (access.rolePolicy ? access.rolePolicy.specials?.salesAdmin === true : operationalRole(access) === 'contador');
export const supervisor = access => access.owner || (access.rolePolicy ? access.rolePolicy.specials?.corrections === true : operationalRole(access) === 'supervisor');
export const cashAdministrator = access => access.owner || (access.rolePolicy ? access.rolePolicy.specials?.cashAdmin === true : ['contador', 'supervisor'].includes(operationalRole(access)));
export const operatorId = (access, session) => access.member?.id || session.email;
export const receiptRecords = data => [...['taxes', 'pettyVouchers', 'cashMovements', 'costs'].flatMap(name => (data?.[name] || []).filter(record => record.receipt)),...(data?.fiscalWorkflows||[]).flatMap(r=>['filing','payment','package'].filter(k=>r[k]?.receipt).map(k=>({id:r.id+':'+k,receipt:r[k].receipt})).concat(['receipt','snapshot','backup'].filter(k=>r[k]?.key).map(k=>({id:r.id+':'+k,receipt:r[k]}))))];
export function roleAllows(access, module) {
  if (access.owner || access.rolePolicy) return true;
  if (module === 'diseno_factura'||module==='auditoria_revision') return true;
  const role = operationalRole(access);
  if (module === 'ventas' && role !== 'contador') return false;
  if (['cajero', 'vendedor', 'supervisor'].includes(role) && ['contabilidad', 'finanzas', 'personal', 'fiscal', 'ajustes', 'auditoria', 'accesibilidad'].includes(module)) return false;
  if (['cajero', 'vendedor'].includes(role) && !['tableros_rol', 'facturacion', 'inventario', 'cajas','cuentas_abiertas','agenda','despacho','documentos_venta','comprobantes','medidas','rutas'].includes(module)) return false;
  if (['cajero', 'vendedor'].includes(role) && module === 'inventario') return 'lectura';
  return true;
}
