import {serviceLineCostCents,moneyCents} from './accounting-engine.mjs';
export function restoreServiceConsumables(data,access,session,note,body,ctx){
 if(body.restockConsumables!==true)return null;
 ctx.check(access.branchId,'Selecciona una sucursal para reponer insumos.');
 ctx.permit(access,'inventario',true);ctx.permit(access,'contabilidad',true);
 ctx.check(body.restockConfirmed===true&&typeof body.restockReason==='string'&&body.restockReason.trim().length>=3&&body.restockReason.length<=500,'Confirma por separado la reposición física e indica el motivo.');
 const sale=data.entries.find(e=>e.id===note.invoiceId&&e.type==='venta'),consumption=data.entries.find(e=>e.id===sale?.serviceConsumptionId&&e.type==='servicio-consumo'&&e.saleId===sale.id);
 ctx.check(consumption?.serviceConsumption?.rows?.length,'La factura no conserva un consumo explícito recuperable. No se infirieron consumibles históricos.');
 ctx.check(!data.entries.some(e=>e.serviceRestockOf===consumption.id),'Los consumibles de esta prestación ya se repusieron.');
 const notes=data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===sale.id),serviceIds=new Set(sale.items.filter(i=>i.service).map(i=>i.p));
 for(const pid of serviceIds){const original=sale.items.filter(i=>i.p===pid).reduce((s,i)=>s+i.q,0),returned=notes.flatMap(e=>e.items).filter(i=>i.p===pid).reduce((s,i)=>s+i.q,0);ctx.check(Math.round(original*1e6)===Math.round(returned*1e6),'La reposición conjunta requiere haber devuelto todos los servicios de la factura. No se asignan consumos agregados a devoluciones parciales.');}
 const stock=[];let currentCents=0,originalCents=0;
 for(const row of consumption.serviceConsumption.rows){
  const p=data.products.find(p=>p.id===row.pid);ctx.check(p&&p.kind!=='service','Conserva el artículo consumible original.');
  ctx.check(!(data.businessRecords||[]).some(r=>r.productId===p.id&&(['lotes','produccion'].includes(r.module)||r.module==='variantes'&&r.serial)),'No se reponen automáticamente consumibles con lotes, series o producción.');
  const value=serviceLineCostCents(p.cost,row.q);ctx.check(Number.isSafeInteger(row.costCents)&&row.costCents>=0&&moneyCents(p.cost)>=0,'Costo de reposición inválido.');currentCents+=value;originalCents+=row.costCents;stock.push({pid:p.id,q:row.q,unit:p.unit||'unidad',unitCost:p.cost});
 }
 ctx.check(Number.isSafeInteger(currentCents)&&Number.isSafeInteger(originalCents),'Reposición fuera de rango.');
 const delta=currentCents-originalCents,lines=[];if(currentCents)lines.push({a:'1301',d:currentCents/100,c:0});if(originalCents)lines.push({a:'5101',d:0,c:originalCents/100});
 if(delta){ctx.check(data.accounts.some(a=>a.code===body.varianceAccount&&a.tipo==='gasto'),'Selecciona una cuenta de gasto para la diferencia de valoración.');lines.push({a:body.varianceAccount,d:delta<0?-delta/100:0,c:delta>0?delta/100:0});}
 const entry=ctx.entry(data,session,{date:note.date,type:'servicio-reposicion',desc:'Reposición confirmada de consumibles',reference:'REP-'+note.reference,invoiceId:sale.id,creditNoteId:note.id,serviceRestockOf:consumption.id,total:currentCents/100,stock,lines,reason:body.restockReason.trim()});
 for(const row of stock){const p=data.products.find(p=>p.id===row.pid);p.stock=Math.round((p.stock+row.q)*1e6)/1e6;ctx.check(Number.isFinite(p.stock)&&p.stock<=1e9,'Existencias fuera de rango.');}
 note.serviceRestockId=entry.id;return entry.id;
}
