import {moneyCents,recurringDay,recurringPeriod,customerPaymentQuote} from './accounting-engine.mjs';
export const CLIENT_MODULES=['comunicacion','cobranza','terminos_pago','emision_recurrente'];
export const clientCheck=(value,message)=>{if(!value)throw Object.assign(new Error(message),{publicMessage:message,status:400})};
export const clientDayAdd=(day,n)=>{recurringDay(day);const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const clientRows=(data,module)=> (data.businessRecords||[]).filter(r=>r.module===module);
export const clientSettings=(data,module)=>clientRows(data,module).find(r=>r.kind==='configuration');
export function clientDebt(data,invoice,through='9999'){
 return Math.max(0,data.entries.filter(e=>e.date<=through&&(e.id===invoice.id||e.invoiceId===invoice.id||e.lines?.some(l=>l.invoiceId===invoice.id))).flatMap(e=>(e.lines||[]).filter(l=>l.a==='1201'&&(e.id===invoice.id||e.invoiceId===invoice.id||l.invoiceId===invoice.id))).reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0));
}
export function clientStatement(data,customerId,date){
 recurringDay(date);return data.entries.filter(e=>e.type==='venta'&&e.customerId===customerId&&e.date<=date).map(e=>({id:e.id,reference:e.reference,date:e.date,due:e.due||e.date,totalCents:moneyCents(e.total),balanceCents:clientDebt(data,e,date)}));
}
export function dunningCandidates(data,date){
 recurringDay(date);const settings=clientSettings(data,'cobranza');if(!settings||settings.status!=='Activa')return [];
 return data.entries.filter(e=>e.type==='venta'&&e.customerId&&e.date<=date&&clientDebt(data,e,date)>0).flatMap(e=>(settings.offsets||[]).filter(offset=>clientDayAdd(e.due||e.date,offset)<=date).map(offset=>({key:e.id+':'+offset,invoiceId:e.id,customerId:e.customerId,due:e.due||e.date,offset,balanceCents:clientDebt(data,e,date)}))).filter(c=>!clientRows(data,'cobranza').some(r=>r.kind==='reminder'&&r.key===c.key));
}
export function clientCreditDecision(data,customerId,newCreditCents){
 const policy=clientRows(data,'cobranza').find(r=>r.kind==='credit'&&r.customerId===customerId),settings=clientSettings(data,'cobranza');
 if(settings?.status!=='Activa'||!policy)return null;
 const balanceCents=data.entries.filter(e=>e.type==='venta'&&e.customerId===customerId).reduce((n,e)=>n+clientDebt(data,e),0),exceeded=balanceCents+newCreditCents>policy.limitCents;
 return {exceeded,mode:policy.mode,limitCents:policy.limitCents,balanceCents};
}
export function paymentTermsSnapshot(data,customerId,date){
 if(clientSettings(data,'terminos_pago')?.status!=='Activa')return null;
 const r=clientRows(data,'terminos_pago').find(r=>r.kind==='terms'&&r.customerId===customerId);if(!r)return null;
 return {netDays:r.netDays,discountDays:r.discountDays,discountBps:r.discountBps,discountAccount:r.discountAccount,deadline:clientDayAdd(date,r.discountDays),due:clientDayAdd(date,r.netDays),version:1};
}
export function invoiceCollectionQuote(data,invoice,date){
 const balanceCents=clientDebt(data,invoice),terms=invoice.paymentTerms;
 const alreadyPaid=data.entries.some(e=>e.invoiceId===invoice.id&&e.lines?.some(l=>l.a==='1201'&&moneyCents(l.c)>0));
 return customerPaymentQuote({balanceCents,baseCents:moneyCents(invoice.subtotal),discountBps:terms?.discountBps||0,date,deadline:terms?.deadline||'',alreadyPaid});
}
export function nextClientIssues(data,from,to,canRead=()=>true){
 recurringDay(from);recurringDay(to);clientCheck(from<=to,'Período inválido.');
 if(clientSettings(data,'emision_recurrente')?.status!=='Activa')return [];
 const result=[];
 for(const link of clientRows(data,'emision_recurrente').filter(r=>r.kind==='link')){
  if(!canRead(link.sourceModule))continue;
  const r=(data.businessRecords||[]).find(r=>r.id===link.sourceId&&r.module===link.sourceModule);if(!r)continue;
  if(r.module==='suscripciones'&&r.kind==='subscription'&&r.status==='Activa')for(let period=0;period<1200;period++){
   const p=recurringPeriod(r,period);if(p.from>to)break;
   if(p.from>=from&&p.baseCents>0&&!r.billed.some(b=>b.period===period))result.push({sourceId:r.id,sourceModule:r.module,name:r.name,date:p.from,period,baseCents:p.baseCents});
  }
  if(r.module==='contratos'&&r.status==='Activo')for(let period=1;period<=r.periods;period++){
   let date;if(r.frequency==='mensual'){const d=new Date(r.date+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+period);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(+r.date.slice(8),last));date=d.toISOString().slice(0,10)}else date=clientDayAdd(r.date,period*({diaria:1,semanal:7,quincenal:15}[r.frequency]||0));
   if(date>=from&&date<=to&&!(r.billed||[]).some(b=>b.key==='periodo-'+period))result.push({sourceId:r.id,sourceModule:r.module,name:r.name,date,period});
  }
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function renderClientTemplate(template,values){
 clientCheck(typeof template==='string'&&template.length<=4000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(template),'Plantilla inválida.');
 return template.replace(/\{(empresa|cliente|documento|fecha)\}/g,(_,k)=>String(values[k]||''));
}
export function clientWhatsApp(phone,message){const digits=String(phone||'').replace(/[ +()-]/g,'');clientCheck(/^\d{8,15}$/.test(digits),'Usa teléfono con código internacional.');return 'https://wa.me/'+digits+'?text='+encodeURIComponent(message)}
export function validateClientRecord(r,check=clientCheck){
 check(['configuration','template','message','reminder','promise','management','credit','terms','link'].includes(r.kind),'Tipo de comunicación inválido.');
 for(const key of ['amountCents','limitCents','discountBps'])if(r[key]!==undefined)check(Number.isSafeInteger(r[key])&&r[key]>=0,'Importe entero inválido.');
 check(Array.isArray(r.events),'Conserva el historial de gestión.');
}
