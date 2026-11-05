import {randomUUID} from 'node:crypto';
import {invoiceTotals} from './accounting-engine.mjs';
export const DELIVERY_OPS=['deliveryZone','deliveryDetails'];
export const deliveryZoneRecord=r=>r.module==='despacho'&&r.kind==='delivery-zone';
const text=(v,n=200)=>String(v||'').trim().slice(0,n);
export function deliveryOperation(data,access,session,b,ctx){
 const {check,permit}=ctx;permit(access,'despacho',true);check(access.branchId&&b.operationId&&b.confirmed===true,'Selecciona sucursal y confirma.');
 const rows=data.businessRecords||=[];
 if(b.operation==='deliveryZone'){
  check(access.owner,'Solo el dueño configura zonas.');permit(access,'inventario',true);
  const p=data.products.find(p=>p.id===b.productId&&p.kind==='service'),name=text(b.name,100);check(p&&name,'Indica zona y servicio de catálogo para el envío.');
  check(!rows.some(r=>deliveryZoneRecord(r)&&r.name.toLowerCase()===name.toLowerCase()),'La zona ya existe.');
  const r={id:randomUUID(),module:'despacho',kind:'delivery-zone',name,status:'Recibido',date:ctx.date(b.date),branchId:access.branchId,productId:p.id,events:[]};rows.push(r);return r.id;
 }
 const r=rows.find(r=>r.id===b.id&&r.module==='despacho'&&!deliveryZoneRecord(r));
 check(r&&!r.sourceAccountId&&!r.entryId&&!['Entregado','Cancelado'].includes(r.status),'Configura la entrega en un pedido independiente antes de facturar.');
 const mode=b.mode;check(['domicilio','llevar'].includes(mode),'Selecciona domicilio o retiro.');
 const phone=text(b.phone,80),address=text(b.address,1000),promised=new Date(b.promised),zone=rows.find(z=>deliveryZoneRecord(z)&&z.id===b.zoneId);
 check(phone&&Number.isFinite(promised.getTime()),'Indica teléfono y hora prometida.');
 check(mode!=='domicilio'||(address&&zone),'Domicilio requiere dirección y zona.');
 check(['prepaid','cod'].includes(b.paymentMode),'Selecciona pago anticipado o contra entrega.');
 const commissionRate=Number(b.commissionRate||0);check(Number.isFinite(commissionRate)&&commissionRate>=0&&commissionRate<=100,'Comisión inválida.');
 r.items=(r.items||[]).filter(i=>!i.deliveryFee);
 if(mode==='domicilio'){
  const p=data.products.find(p=>p.id===zone.productId&&p.kind==='service');check(p,'El servicio de envío ya no está disponible.');
  r.items.push({lineId:randomUUID(),deliveryFee:true,p:p.id,name:p.name,q:1,u:p.price,vatRate:p.vatRate||0,unit:p.unit||'servicio'});
 }
 check(r.items.length<=200,'El pedido supera 200 líneas.');
 r.total=invoiceTotals(r.items).total;r.kind=mode;r.modality=mode;
 r.deliveryDetails={mode,phone,address,reference:text(b.reference,1000),zoneId:zone?.id||'',zoneName:mode==='domicilio'?zone.name:'',promised:promised.toISOString(),driver:text(b.driver),paymentMode:b.paymentMode,commissionRate};
 r.events.push({date:new Date().toISOString(),action:'Entrega configurada',actor:session.email});return r.id;
}
