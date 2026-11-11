import { randomUUID } from 'node:crypto';
import { normalizeItemQuantity, invoiceTotals } from './accounting-engine.mjs';
// Runs inside updateCompany: revision, session, owner/membership and branch merge stay authoritative.
export function invoiceDraftOperation(data,access,body,{requireValue:check,requirePermission:permit,amount,dateValue:date}) {
 permit(access,'facturacion');check(access.branchId,'Selecciona una sucursal.');
 data.invoiceDrafts||=[];
 const existing=body.id?data.invoiceDrafts.find(r=>r.id===body.id&&r.branchId===access.branchId):null;
 check(!body.id||existing?.status==='Registrada','La factura registrada no está disponible para editar.');
 if(body.operation==='deleteInvoiceDraft'){
  check(existing&&body.confirmed===true,'Confirma la eliminación de la factura registrada.');
  data.invoiceDrafts=data.invoiceDrafts.filter(r=>r.id!==existing.id);return existing.id;
 }
 check(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=200,'Agrega productos.');
 const customer=body.customerId?data.customers.find(c=>c.id===body.customerId):null;
 check(!body.customerId||customer,'Cliente inexistente.');
 const name=String(customer?.name||body.party||'').trim().slice(0,200);check(name,'Indica el cliente.');
 const items=body.items.map(row=>{
  const p=data.products.find(p=>p.id===row.p),q=normalizeItemQuantity(row.q);
  check(p&&Number.isFinite(q)&&q>0&&q<=1e6,'Producto o cantidad inválida.');
  return {p:p.id,q,u:amount(row.u??p.price,true),vatRate:p.vatRate||0};
 });
 const discount=Number(body.discount||0);check(Number.isFinite(discount)&&discount>=0&&discount<100,'Descuento inválido.');
 const record={discount,id:existing?.id||randomUUID(),branchId:access.branchId,status:'Registrada',date:date(body.date),name,customerId:customer?.id||'',items,total:invoiceTotals(items).total,...(body.sourceQuotation?{sourceQuotation:String(body.sourceQuotation)}:{})};
 if(existing)Object.assign(existing,record);else data.invoiceDrafts.push(record);
 return record.id;
}
