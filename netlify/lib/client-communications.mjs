import {randomUUID} from 'node:crypto';
import {moneyCents,recurringDay} from './accounting-engine.mjs';
import {managuaDay} from './billing-rules.mjs';
import {CLIENT_MODULES,clientCheck as check,clientRows,clientSettings,clientStatement,dunningCandidates,nextClientIssues,renderClientTemplate,clientWhatsApp,invoiceCollectionQuote} from './client-rules.mjs';
export {CLIENT_MODULES,validateClientRecord} from './client-rules.mjs';
export const CLIENT_OPS=['clientEnable','clientTemplate','clientSend','clientRetry','clientDunningRules','clientReminders','clientApprove','clientReject','clientPromise','clientManagement','clientCreditPolicy','clientTerms','clientCollect','clientReverseCollect','clientLink'];
export const clientModule=body=>({clientTemplate:'comunicacion',clientSend:'comunicacion',clientRetry:'comunicacion',clientDunningRules:'cobranza',clientReminders:'cobranza',clientApprove:'cobranza',clientReject:'cobranza',clientPromise:'cobranza',clientManagement:'cobranza',clientCreditPolicy:'cobranza',clientTerms:'terminos_pago',clientReverseCollect:'terminos_pago',clientCollect:'terminos_pago',clientLink:'emision_recurrente'})[body.operation]||body.module;
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
export function clientDocument(data,body,company,actor){
 const date=recurringDay(body.date),customer=data.customers.find(c=>c.id===body.customerId);check(customer,'Cliente no encontrado.');
 let document;
 if(body.documentType==='statement')document={type:'statement',customer:customer.name,rows:clientStatement(data,customer.id,date)};
 else if(body.documentType==='invoice'){
  const e=data.entries.find(e=>e.id===body.documentId&&e.type==='venta'&&e.customerId===customer.id);check(e,'Factura no encontrada.');
  document={type:'invoice',reference:e.reference,date:e.date,due:e.due,customer:e.party,items:(e.items||[]).map(i=>({name:i.name,q:i.q,unitCents:moneyCents(i.u),vatRate:i.vatRate})),subtotalCents:moneyCents(e.subtotal),vatCents:moneyCents(e.vat),totalCents:moneyCents(e.total)};
 }else{
  check(['quotation','proforma'].includes(body.documentType),'Tipo de documento inválido.');
  const q=(data.quotations||[]).find(q=>q.id===body.documentId&&(!q.customerId||q.customerId===customer.id)),r=clientRows(data,'documentos_venta').find(r=>r.id===body.documentId&&r.customerId===customer.id&&r.kind===(body.documentType==='proforma'?'proforma':'cotizacion'));
  check(q||r,'Documento no encontrado.');const source=q||r;document={type:body.documentType,reference:source.reference||source.name||source.id,date:source.date,customer:customer.name,items:(source.items||[]).map(i=>({name:i.name,q:i.q,unitCents:moneyCents(i.u),vatRate:i.vatRate})),totalCents:moneyCents(source.total||0)};
 }
 return {...document,company,currency:data.cfg?.cur||'NIO',period:body.from?recurringDay(body.from)+' / '+date:date,generatedAt:new Date().toISOString(),generatedBy:actor,version:1,branchId:body.branchId};
}
export async function clientOperation(data,access,session,body,ctx){
 const module=clientModule(body),op=body.operation,date=recurringDay(body.date),reason=txt(body.reason,501);
 check(CLIENT_MODULES.includes(module),'Módulo inválido.');ctx.permit(access,module,true);
 check(access.branchId&&body.confirmed===true&&reason.length>=3&&reason.length<=500,'Selecciona sucursal, confirma y explica el motivo.');
 const records=data.businessRecords||=[],event={action:op,date,reason,actor:session.member?.name||session.email,at:new Date().toISOString()};
 const add=(kind,values={})=>{const r={id:randomUUID(),module,kind,name:reason.slice(0,200),status:'Activa',date,branchId:access.branchId,events:[event],...values};records.push(r);return r};
 let config=clientSettings(data,module);
 if(op==='clientEnable'){
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia la activación efectiva hoy.');
  if(!config)config=add('configuration');else config.events.push(event);config.status=body.enabled?'Activa':'Inactiva';return config.id;
 }
 check(config?.status==='Activa','El dueño debe activar este módulo.');
 const customer=()=>{ctx.permit(access,'facturacion',true);const c=data.customers.find(c=>c.id===body.customerId&&c.status==='activo');check(c,'Selecciona cliente activo.');return c};
 const queue=async(r,snapshot,recipient,template)=>{
  check(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)&&recipient.length<=254,'Correo del cliente inválido.');
  const values={empresa:access.company.name,cliente:snapshot.customer,documento:snapshot.reference||snapshot.type,fecha:date};
  const subject=renderClientTemplate(template?.subject||'{empresa} · {documento}',values).replace(/[\r\n]/g,' '),message=renderClientTemplate(template?.body||'Estimado/a {cliente}: adjuntamos {documento}.',values);
  const id=randomUUID();await ctx.queue.insert({id,email:access.company.ownerEmail,subject,body:JSON.stringify({recipient,message,document:snapshot}),dedupeKey:'client:'+access.company.id+':'+r.id,actor:session.email});r.queueId=id;r.recipient=recipient;r.document=snapshot;r.subject=subject;r.message=message;return r.id;
 };
 if(op==='clientTemplate'){
  check(access.owner,'Solo el dueño edita plantillas.');renderClientTemplate(body.subject,{});renderClientTemplate(body.body,{});check(body.subject.length<=200&&!/[\r\n]/.test(body.subject),'Asunto inválido.');
  let r=clientRows(data,module).find(r=>r.kind==='template');if(!r)r=add('template');else r.events.push(event);r.subject=body.subject;r.body=body.body;return r.id;
 }
 if(op==='clientSend'){
  ctx.permit(access,'facturacion',true);if(['quotation','proforma'].includes(body.documentType))ctx.permit(access,'documentos_venta',true);
  const c=customer(),snapshot=clientDocument(data,{...body,branchId:access.branchId},access.company.name,event.actor),r=add('message',{documentId:body.documentId||null,customerId:c.id});
  return queue(r,snapshot,c.email,clientRows(data,'comunicacion').find(r=>r.kind==='template'));
 }
 if(op==='clientRetry'){
  const r=clientRows(data,module).find(r=>r.id===body.id&&r.kind==='message');check(r,'Envío no encontrado.');
  const m=await ctx.queue.get(r.queueId);
  check(m?.dedupeKey==='client:'+access.company.id+':'+r.id&&m.state==='error','Solo se reintentan errores definitivos; un envío ambiguo requiere revisión SMTP.');
  await ctx.queue.retry(m.id);r.events.push({...event,previousAttempts:m.attempts});return r.id;
 }
 if(op==='clientDunningRules'){
  check(access.owner&&Array.isArray(body.offsets)&&body.offsets.length<=12&&new Set(body.offsets).size===body.offsets.length&&body.offsets.every(n=>Number.isInteger(n)&&Math.abs(n)<=365),'Define hasta doce desplazamientos únicos en días (- antes, + después).');config.offsets=body.offsets;config.events.push(event);return config.id;
 }
 if(op==='clientReminders'){
  ctx.permit(access,'facturacion',true);const candidates=dunningCandidates(data,date);check(candidates.length<=500,'Reduce las reglas o gestiona los recordatorios existentes.');for(const c of candidates)add('reminder',{...c,approval:'proposed'});return config.id;
 }
 if(op==='clientApprove'||op==='clientReject'){
  const r=clientRows(data,module).find(r=>r.id===body.id&&r.kind==='reminder');check(r?.approval==='proposed','Recordatorio ya gestionado.');
  if(op==='clientApprove'){
   ctx.permit(access,'comunicacion',true);ctx.permit(access,'facturacion',true);check(clientSettings(data,'comunicacion')?.status==='Activa','Activa Comunicación.');
   const c=data.customers.find(c=>c.id===r.customerId),invoice=data.entries.find(e=>e.id===r.invoiceId);check(c&&invoice&&clientStatement(data,c.id,date).some(i=>i.id===invoice.id&&i.balanceCents>0),'La deuda ya no está disponible.');
   const snapshot=clientDocument(data,{date,customerId:c.id,documentType:'statement',branchId:access.branchId},access.company.name,event.actor);
   const message={id:randomUUID(),module:'comunicacion',kind:'message',name:reason,date,status:'Activa',branchId:access.branchId,customerId:c.id,events:[event]};records.push(message);
   await queue(message,snapshot,c.email,clientRows(data,'comunicacion').find(r=>r.kind==='template'));r.messageId=message.id;
  }
  r.approval=op==='clientApprove'?'approved':'rejected';r.events.push(event);return r.id;
 }
 if(op==='clientPromise'||op==='clientManagement'){
  const c=customer();if(op==='clientPromise')check(Number.isSafeInteger(body.amountCents)&&body.amountCents>0&&recurringDay(body.due)>=date,'Promesa inválida.');
  return add(op==='clientPromise'?'promise':'management',{customerId:c.id,note:txt(body.note,1000),...(op==='clientPromise'?{amountCents:body.amountCents,due:body.due}:{})}).id;
 }
 if(op==='clientCreditPolicy'){
  check(access.owner,'Solo el dueño configura el límite.');const c=customer();check(Number.isSafeInteger(body.limitCents)&&body.limitCents>=0&&body.limitCents<=99999999900&&['warn','block'].includes(body.mode),'Límite inválido.');
  let r=clientRows(data,module).find(r=>r.kind==='credit'&&r.customerId===c.id);if(!r)r=add('credit',{customerId:c.id});else r.events.push(event);Object.assign(r,{limitCents:body.limitCents,mode:body.mode});return r.id;
 }
 if(op==='clientTerms'){
  check(access.owner,'Solo el dueño configura condiciones futuras.');const c=customer();check([body.netDays,body.discountDays,body.discountBps].every(Number.isInteger)&&body.netDays>=0&&body.netDays<=3650&&body.discountDays>=0&&body.discountDays<=body.netDays&&body.discountBps>=0&&body.discountBps<=10000,'Condiciones inválidas.');
  check(data.accounts.some(a=>a.code===body.discountAccount&&a.tipo==='gasto'),'Selecciona gasto financiero; verifica con tu contador.');let r=clientRows(data,module).find(r=>r.kind==='terms'&&r.customerId===c.id);if(!r)r=add('terms',{customerId:c.id});else r.events.push(event);Object.assign(r,{netDays:body.netDays,discountDays:body.discountDays,discountBps:body.discountBps,discountAccount:body.discountAccount});return r.id;
 }
 if(op==='clientCollect'){
  ctx.permit(access,'facturacion',true);ctx.permit(access,'contabilidad',true);ctx.financialCash(access);
  const invoice=data.entries.find(e=>e.id===body.invoiceId&&e.type==='venta');check(invoice&&invoice.paymentTerms&&date>=invoice.date&&!data.entries.some(e=>e.invoiceId===invoice.id&&e.date>date),'Selecciona factura con condiciones y respeta el orden de cobros.');
  const quote=invoiceCollectionQuote(data,invoice,date);check(quote.balanceCents>0&&body.previewCents===quote.payableCents&&['1101','1102'].includes(body.pay),'Revisa el saldo y el descuento antes de confirmar.');
  check(Number.isSafeInteger(body.amountCents)&&body.amountCents>=0&&(body.amountCents>0||quote.discountCents>0&&quote.payableCents===0)&&body.amountCents<=quote.payableCents,'Cobro inválido.');
  const discount=body.amountCents===quote.payableCents?quote.discountCents:0;check(!discount||data.accounts.some(a=>a.code===invoice.paymentTerms.discountAccount&&a.tipo==='gasto'),'Cuenta de descuento no disponible.');
  const e=ctx.entry(data,session,{date,type:'abono',clientCollection:true,invoiceId:invoice.id,customerId:invoice.customerId,party:invoice.party,desc:reason,total:(body.amountCents+discount)/100,discountCents:discount,lines:[{a:body.pay,d:body.amountCents/100,c:0},...(discount?[{a:invoice.paymentTerms.discountAccount,d:discount/100,c:0}]:[]),{a:'1201',d:0,c:(body.amountCents+discount)/100}]});return e.id;
 }
 if(op==='clientReverseCollect'){
  ctx.permit(access,'facturacion',true);ctx.permit(access,'contabilidad',true);ctx.financialCash(access);
  check(access.owner||(access.rolePolicy?access.rolePolicy.specials?.corrections===true:['contador','supervisor'].includes(access.member?.role)),'Solo el dueño o responsable contable autorizado revierte cobros.');
  const original=data.entries.find(e=>e.id===body.id&&e.clientCollection===true);
  check(original&&!data.entries.some(e=>e.reversalOf===original.id),'Cobro no encontrado o ya revertido.');
  check(date>=original.date&&!data.entries.some(e=>e.invoiceId===original.invoiceId&&e.date>date),'La reversa debe respetar la cronología de la factura.');
  const entry=ctx.entry(data,session,{date,type:'caja-anulacion',clientCollectionReversal:true,reversalOf:original.id,invoiceId:original.invoiceId,customerId:original.customerId,party:original.party,desc:reason,total:original.total,lines:original.lines.map(l=>({a:l.a,d:l.c,c:l.d}))});return entry.id;
 }
 if(op==='clientLink'){
  check(access.owner&&['suscripciones','contratos'].includes(body.sourceModule),'Solo el dueño vincula Q o Contratos.');ctx.permit(access,body.sourceModule,true);ctx.permit(access,'facturacion',true);
  const source=(data.businessRecords||[]).find(r=>r.id===body.sourceId&&r.module===body.sourceModule);check(source&&!clientRows(data,module).some(r=>r.sourceId===source.id),'Origen no disponible o ya vinculado.');return add('link',{sourceId:source.id,sourceModule:source.module}).id;
 }
 check(false,'Operación no disponible.');
}
export function clientReport(data,body,canRead){
 const date=recurringDay(body.to||body.date),module=body.module;check(CLIENT_MODULES.includes(module),'Módulo inválido.');
 const from=recurringDay(body.from||date),to=recurringDay(body.to||date);check(from<=to,'Período inválido.');
 const result={enabled:clientSettings(data,module)?.status==='Activa',records:clientRows(data,module).filter(r=>(!body.customerId||!r.customerId||r.customerId===body.customerId)&&(!['message','promise','management','reminder'].includes(r.kind)||r.date>=from&&r.date<=to))};
 if(module==='cobranza'){result.candidates=dunningCandidates(data,date);result.statement=body.customerId?clientStatement(data,body.customerId,date):[];}
 if(module==='terminos_pago')result.collections=data.entries.filter(e=>e.clientCollection===true&&e.date>=from&&e.date<=to).map(e=>({id:e.id,date:e.date,invoiceId:e.invoiceId,customerId:e.customerId,totalCents:moneyCents(e.total),discountCents:e.discountCents,reversed:data.entries.some(r=>r.reversalOf===e.id)}));
 if(module==='terminos_pago')result.invoices=data.entries.filter(e=>e.type==='venta'&&e.paymentTerms&&clientStatement(data,e.customerId,date).some(i=>i.id===e.id&&i.balanceCents>0)).map(e=>({id:e.id,reference:e.reference,date:e.date,customerId:e.customerId,...invoiceCollectionQuote(data,e,date)}));
 if(module==='emision_recurrente')result.upcoming=nextClientIssues(data,body.from||date,body.to||date,canRead);
 if(module==='comunicacion'&&body.documentType){result.document=clientDocument(data,body,body.company,body.actor);const c=data.customers.find(c=>c.id===body.customerId);try{result.whatsapp=clientWhatsApp(c.phone,renderClientTemplate(clientRows(data,module).find(r=>r.kind==='template')?.body||'{empresa}: {documento}',{empresa:body.company,cliente:c.name,documento:result.document.reference||body.documentType,fecha:date}))}catch{result.whatsapp=null}}
 return result;
}
