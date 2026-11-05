import {randomUUID} from 'node:crypto';
import {cents} from './accounting-codec.mjs';

export const BENEFIT_OPS=['giftIssue','giftRefund','loyaltyConfigure'];
export const benefitRecord=r=>r.module==='facturacion'&&['gift-card','gift-voucher','loyalty-settings','loyalty-history'].includes(r.kind);
export const giftRecord=r=>benefitRecord(r)&&['gift-card','gift-voucher'].includes(r.kind);
export function validateBenefit(r,check){
 check(benefitRecord(r)&&['Activa','Agotada','Devuelta'].includes(r.status),'Beneficio inválido.');
 if(giftRecord(r))check(Number.isSafeInteger(r.originalCents)&&r.originalCents>0&&Number.isSafeInteger(r.balanceCents)&&r.balanceCents>=0&&r.balanceCents<=r.originalCents&&typeof r.liability==='string'&&Array.isArray(r.events),'Saldo de tarjeta inválido.');
 else check(typeof r.enabled==='boolean'&&Number.isInteger(r.every)&&r.every>=2&&r.every<=100&&Number.isFinite(r.percent)&&r.percent>0&&r.percent<=99,'Programa de lealtad inválido.');
}
export function loyaltyOffer(data,customerId,date){
 const config=(data.businessRecords||[]).find(r=>r.kind==='loyalty-settings'&&r.enabled);
 if(!config||!customerId)return null;
 const purchases=data.entries.filter(e=>e.type==='venta'&&e.customerId===customerId&&e.date>=config.date&&e.date<=date&&(!config.startedAt||e.issuedAt>=config.startedAt)&&cents(e.total)>data.entries.filter(n=>n.type==='nota-credito'&&n.invoiceId===e.id).reduce((s,n)=>s+cents(n.total),0));
 const rewards=purchases.filter(e=>e.loyalty?.configId===config.id).length;
 const available=Math.floor(purchases.filter(e=>!e.loyalty).length/config.every)-rewards;
 return {configId:config.id,every:config.every,percent:config.percent,purchases:purchases.length,available:Math.max(0,available)};
}
export function giftPayment(data,body,date,check){
 const payment=body.payments?.find(p=>p.method==='vale');
 if(!payment)return null;
 const r=(data.businessRecords||[]).find(r=>giftRecord(r)&&r.id===body.giftId);
 check(r&&r.status!=='Devuelta'&&r.date<=date&&(!r.due||date<=r.due)&&r.balanceCents>=cents(payment.amount),'Tarjeta o vale inexistente, vencido o con saldo insuficiente.');
 return {r,amountCents:cents(payment.amount)};
}
export function redeemGift(gift,entry){
 if(!gift)return;
 gift.r.balanceCents-=gift.amountCents;gift.r.status=gift.r.balanceCents?'Activa':'Agotada';
 gift.r.events.push({action:'Canje',date:entry.date,entryId:entry.id,amountCents:gift.amountCents});
 entry.giftRedemption={id:gift.r.id,liability:gift.r.liability,amountCents:gift.amountCents};
}
export function giftReturn(data,original,previousNotes,refund,check){
 const redemption=original.giftRedemption;
 if(!redemption||!refund)return null;
 const remaining=redemption.amountCents-previousNotes.reduce((s,n)=>s+(n.giftRestoration?.amountCents||0),0);
 const amountCents=Math.min(cents(refund),remaining);if(!amountCents)return null;
 const r=(data.businessRecords||[]).find(r=>giftRecord(r)&&r.id===redemption.id);
 check(r&&r.balanceCents+amountCents<=r.originalCents,'No se puede restituir el saldo de la tarjeta original.');
 return {r,amountCents};
}
export function benefitOperation(data,access,session,body,ctx){
 const {check,permit,entry,date,amount}=ctx;
 permit(access,'facturacion',true);check(access.branchId&&body.operationId&&body.confirmed===true,'Selecciona sucursal y confirma la operación.');
 const records=data.businessRecords||=[];
 if(body.operation==='loyaltyConfigure'){
  check(access.owner,'Solo el dueño configura lealtad.');permit(access,'ajustes',true);
  const every=Number(body.every),percent=Number(body.percent),day=date(body.date);
  check(Number.isInteger(every)&&every>=2&&every<=100&&Number.isFinite(percent)&&percent>0&&percent<=99,'Indica de 2 a 100 compras y un descuento de hasta 99%.');
  const old=records.find(r=>r.kind==='loyalty-settings');
  if(old){old.enabled=false;old.kind='loyalty-history';}
  const r={id:randomUUID(),module:'facturacion',kind:'loyalty-settings',name:'Lealtad por frecuencia',status:'Activa',branchId:access.branchId,date:day,startedAt:new Date().toISOString(),enabled:body.enabled===true,every,percent,events:[]};records.push(r);return r.id;
 }
 permit(access,'cajas',true);permit(access,'contabilidad',true);ctx.financialCash(access);
 const day=date(body.date);check(['1101','1102'].includes(body.pay),'Selecciona Caja general o Banco.');
 check(data.accounts.some(a=>a.code===body.pay&&a.tipo==='activo'),'Cuenta de pago inexistente.');
 if(body.operation==='giftIssue'){
  const total=amount(body.total),due=body.due?date(body.due):'';
  check(!due||due>=day,'El vencimiento no puede ser anterior a la venta.');
  check(data.accounts.some(a=>a.code===body.liability&&a.tipo==='pasivo'&&a.nat==='C'),'Selecciona una cuenta de pasivo acreedora para tarjetas y vales.');
  check(!body.customerId||data.customers.some(c=>c.id===body.customerId&&c.status==='activo'),'Cliente inválido.');
  const r={id:randomUUID(),module:'facturacion',kind:body.kind==='gift-voucher'?'gift-voucher':'gift-card',name:String(body.name||'').trim().slice(0,200),date:day,due,status:'Activa',branchId:access.branchId,customerId:body.customerId||'',liability:body.liability,originalCents:cents(total),balanceCents:cents(total),events:[]};
  check(r.name&&!records.some(o=>giftRecord(o)&&o.name.toLowerCase()===r.name.toLowerCase()),'Indica un código de tarjeta único en la sucursal.');
  const e=entry(data,session,{date:day,type:'gift-issue',desc:'Venta de tarjeta / vale · '+r.name,reference:r.name,businessId:r.id,total,lines:[{a:body.pay,d:total,c:0},{a:r.liability,d:0,c:total}]});
  r.entryId=e.id;r.events.push({action:'Venta',date:day,entryId:e.id,amountCents:r.originalCents});records.push(r);return r.id;
 }
 const r=records.find(r=>giftRecord(r)&&r.id===body.id);
 check(access.owner&&r&&r.status!=='Devuelta'&&r.balanceCents>0&&day>=r.date,'Solo el dueño devuelve el saldo pendiente de una tarjeta.');
 const total=r.balanceCents/100;
 const e=entry(data,session,{date:day,type:'gift-refund',desc:'Devolución de saldo · '+r.name,reference:r.name,businessId:r.id,total,lines:[{a:r.liability,d:total,c:0},{a:body.pay,d:0,c:total}]});
 r.events.push({action:'Devolución de saldo',date:day,entryId:e.id,amountCents:r.balanceCents});r.balanceCents=0;r.status='Devuelta';return e.id;
}
