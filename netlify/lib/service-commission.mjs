import {randomUUID} from 'node:crypto';
import {recurringRatio,moneyCents} from './accounting-engine.mjs';
export function serviceCommissionAccrual(data,access,session,body,ctx){
 const check=ctx.check;for(const m of ['comisiones','personal','contabilidad'])ctx.permit(access,m,true);
 check(access.branchId&&body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Selecciona sucursal, confirma e indica un motivo.');
 const sale=data.entries.find(e=>e.id===body.saleId&&e.type==='venta'),employee=data.employees.find(e=>e.id===body.employeeId&&e.active!==false);check(sale&&employee&&ctx.date(body.date)>=sale.date,'Selecciona venta, empleado activo y fecha posterior a la venta.');
 check(!(data.businessRecords||[]).some(r=>r.module==='comisiones'&&r.saleId===sale.id&&r.employeeId===employee.id&&r.entryId),'Esa venta y empleado ya tienen comisión devengada.');
 check(!(data.payrolls||[]).some(p=>p.employeeId===employee.id&&p.from<=sale.date&&p.to>=sale.date&&moneyCents(p.commission||0)>0),'Existe comisión manual en una nómina de ese período; revisa su origen antes de devengar otra.');
 const rows=(sale.serviceSnapshots||[]).filter(s=>!s.employeeId||s.employeeId===employee.id);check(rows.length,'La factura no conserva referencias de comisión para ese empleado. No se infirieron comisiones históricas.');
 const returned=new Map();for(const i of data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===sale.id).flatMap(e=>e.items||[]))returned.set(i.p,(returned.get(i.p)||0)+Math.round(i.q*1000));
 let totalCents=0;for(const s of sale.serviceSnapshots){
  const original=Math.round(s.q*1000),used=Math.min(original,returned.get(s.productId)||0);returned.set(s.productId,Math.max(0,(returned.get(s.productId)||0)-used));
  check(Number.isSafeInteger(original)&&original>0&&Number.isSafeInteger(s.commissionCents)&&s.commissionCents>=0,'Referencia de comisión inválida.');
  if(!s.employeeId||s.employeeId===employee.id)totalCents+=recurringRatio(s.commissionCents,original-used,original);
 }
 check(Number.isSafeInteger(totalCents)&&totalCents>0,'No existe comisión positiva después de las notas de crédito.');
 check(data.accounts.some(a=>a.code===body.expenseAccount&&a.tipo==='gasto')&&data.accounts.some(a=>a.code===body.liabilityAccount&&a.tipo==='pasivo'),'Selecciona cuentas de gasto y pasivo para la comisión.');
 const id=randomUUID(),entry=ctx.entry(data,session,{date:ctx.date(body.date),type:'negocio-comisiones',desc:'Comisión confirmada de catálogo',businessId:id,saleId:sale.id,total:totalCents/100,lines:[{a:body.expenseAccount,d:totalCents/100,c:0},{a:body.liabilityAccount,d:0,c:totalCents/100}],reason:body.reason.trim()});
 (data.businessRecords||=[]).push({id,module:'comisiones',kind:'catalogo-servicios',name:'Comisión · '+(sale.reference||sale.id),date:ctx.date(body.date),status:'Pendiente',branchId:access.branchId,employeeId:employee.id,saleId:sale.id,entryId:entry.id,total:totalCents/100,paid:0,expenseAccount:body.expenseAccount,liabilityAccount:body.liabilityAccount,serviceCatalogAccrual:true,commissionSaleDate:sale.date,events:[{date:ctx.date(body.date),action:'Devengo de referencia confirmado',entryId:entry.id,reason:body.reason.trim()}]});return id;
}
export function guardServicePayroll(previous,next,check){
 const accruals=(next.businessRecords||[]).filter(r=>r.serviceCatalogAccrual&&r.entryId);
 if(!accruals.length)return;
 for(const p of next.payrolls||[]){const old=(previous?.payrolls||[]).find(o=>o.id===p.id);if(JSON.stringify(old)===JSON.stringify(p))continue;
  check(!moneyCents(p.commission||0)||!accruals.some(r=>r.employeeId===p.employeeId&&r.commissionSaleDate>=p.from&&r.commissionSaleDate<=p.to),'Ese período tiene comisiones de catálogo devengadas por separado. No las incluyas de nuevo en nómina.');
 }
}
