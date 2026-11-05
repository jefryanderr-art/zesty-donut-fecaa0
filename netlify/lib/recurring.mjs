import {PLAN_OPS,planOperation,validatePlan,planSnapshot,planFor,recurringDebt} from './recurring-plans.mjs';
import {randomUUID} from 'node:crypto';
import {AccountingValidationError,recurringDay,recurringInvoiceItems,recurringActiveDays,recurringPeriod,recurringRatio,recurringMetrics,moneyCents,invoiceTotals,round,invoiceLinkedEntries} from './accounting-engine.mjs';
export const RECURRING_OPS=[...PLAN_OPS,'recurringCreate','recurringState','recurringBill','recurringAdvance','recurringRefund','recurringRecognize'];
const text=(v,n=200)=>String(v??'').trim().slice(0,n);
export function recurringReport(data,from,to){
 recurringDay(from);recurringDay(to);if(from>to)throw new AccountingValidationError('El inicio del período no puede ser posterior al cierre.');
 const entries=data.entries||[],records=(data.businessRecords||[]).filter(r=>r.module==='suscripciones'&&r.kind==='subscription'&&r.date<=to),metrics=recurringMetrics(records,entries,from,to);
 const snapshots=records.map(r=>{
  const copy=structuredClone(r),through=entries.filter(e=>e.date<=to&&e.businessId===r.id);
  copy.status=[{date:r.date,status:'Activa'},...r.events.filter(e=>e.status)].filter(e=>e.date<=to).at(-1).status;
  copy.deposit=through.filter(e=>e.lines?.some(l=>['1101','1102','1201'].includes(l.a))).flatMap(e=>e.lines||[]).filter(l=>l.a===r.liability).reduce((n,l)=>n+moneyCents(l.c)-moneyCents(l.d),0)/100;
  copy.events=copy.events.filter(e=>e.date>=from&&e.date<=to);
  copy.billed=copy.billed.filter(b=>{const invoice=entries.find(e=>e.id===b.entryId);return invoice&&invoice.date>=from&&invoice.date<=to}).map(b=>{
   const linked=entries.filter(e=>e.date<=to&&(e.id===b.entryId||e.invoiceId===b.entryId));
   b.creditBaseCents=linked.filter(e=>e.type==='nota-credito').reduce((n,e)=>n+moneyCents(e.subtotal),0);
   if(b.deferred)b.recognizedCents=linked.flatMap(e=>e.lines||[]).filter(l=>l.a==='4101').reduce((n,l)=>n+moneyCents(l.c)-moneyCents(l.d),0);
   return b;
  });let next=0;const issued=new Set(r.billed.map(b=>b.period));while(next<1199&&issued.has(next))next++;const lookahead=Math.min(1199,next+24);if(r.status==='Activa'&&copy.status==='Activa')while(next<lookahead&&recurringPeriod(r,next).baseCents===0)next++;const nextPeriod=recurringPeriod(r,next);const rate=data.products?.find(p=>p.id===r.productId)?.vatRate||0;copy.upcoming=copy.status==='Activa'&&nextPeriod.baseCents>0?{period:next,...nextPeriod,totalCents:moneyCents(invoiceTotals(recurringInvoiceItems(r,nextPeriod).map(i=>({...i,vatRate:rate}))).total)}:null;
  copy.statement=entries.filter(e=>e.type==='venta'&&(r.billed||[]).some(b=>b.entryId===e.id)).flatMap(invoice=>invoiceLinkedEntries(entries,invoice.id).filter(e=>e.date<=to).map(e=>({id:e.id,invoiceId:invoice.id,date:e.date,reference:e.reference||e.id,debitCents:(e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d),0),creditCents:(e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.c),0)})));copy.debt=recurringDebt(data,r,to);copy.plan=planFor(r,to);copy.collections=(r.collections||[]).filter(e=>e.date<=to);return copy;
 });return {version:1,from,to,records:snapshots,plans:(data.businessRecords||[]).filter(r=>r.kind==='recurring-plan'),metrics:{...metrics,retentionBps:10000-metrics.churnBps}};
}
export async function recurringOperation(data,access,session,body,ctx){
 if(PLAN_OPS.includes(body.operation))return planOperation(data,access,session,body,ctx);
 const check=ctx.check,permit=m=>ctx.permit(access,m,true),date=recurringDay(body.date);permit('suscripciones');
 check(access.branchId&&body.confirmed===true&&text(body.reason,501).length>=3&&text(body.reason,501).length<=500,'Selecciona sucursal, confirma e indica un motivo de 3 a 500 caracteres.');
 const records=data.businessRecords||=[],event={date,action:body.operation,reason:text(body.reason,500),at:new Date().toISOString()},op=body.operation;
 if(op==='recurringCreate'){
  check(access.owner,'Solo el dueño crea una suscripción.');permit('inventario');permit('facturacion');
  const customer=data.customers.find(c=>c.id===body.customerId&&c.status==='activo');check(customer&&customer.name.trim().toLowerCase()!=='cliente general','Selecciona un cliente activo identificado.');
  const planRow=records.find(r=>r.id===body.planId&&r.kind==='recurring-plan'&&r.branchId===access.branchId);check(!body.planId||planRow&&planRow.date<=date,'Plan no disponible en esa fecha.');const plan=planRow?planSnapshot(planRow):null;if(plan)validatePlan(plan,check);
  const amountCents=plan?.amountCents??body.amountCents,months=plan?.months??Number(body.months),anchor=recurringDay(body.anchor),vatRate=Number(body.vatRate||0),name=text(body.name);
  check(name&&Number.isSafeInteger(amountCents)&&amountCents>0&&amountCents<=99999999900&&[1,3,6,12].includes(months)&&anchor<=date,'Revisa nombre, precio en centavos, periodicidad y fecha de anclaje.');
  check(recurringPeriod({date,anchor,months,amountCents,events:[]},0).to>date,'El alta debe pertenecer al primer período de anclaje.');check(Number.isFinite(vatRate)&&vatRate>=0&&vatRate<=100,'IVA inválido; verifica con tu contador.');
  const liability=data.accounts.find(a=>a.code===body.liability&&a.tipo==='pasivo');check(liability&&!['2101','2102','2103','2104','2105','2106','2107','2112','2197'].includes(liability.code),'Selecciona un pasivo exclusivo para anticipos e ingresos diferidos.');
  const product={id:randomUUID(),code:'REC-'+randomUUID().slice(0,8),name,kind:'service',unit:'día de servicio',stock:0,min:0,cost:0,price:0,vatRate};
  const roundingProduct={...product,id:randomUUID(),code:'REC-'+randomUUID().slice(0,8),name:name.slice(0,160)+' · tarifa diaria complementaria'};
  const r={id:randomUUID(),module:'suscripciones',kind:'subscription',name,date,anchor,months,amountCents,price:amountCents/100,status:'Activa',branchId:access.branchId,customerId:customer.id,productId:product.id,roundingProductId:roundingProduct.id,liability:liability.code,deferred:body.deferred===true,deposit:0,events:[event],billed:[]};
  if(plan){r.planHistory=[{date,planId:planRow.id,plan}];r.usage=[];r.trialEnd=new Date(Date.parse(date)+plan.trialDays*86400000).toISOString().slice(0,10);}
  data.products.push(product,roundingProduct);records.push(r);return r.id;
 }
 const r=records.find(r=>r.id===body.id&&r.module==='suscripciones'&&r.kind==='subscription'&&r.branchId===access.branchId);check(r,'Suscripción no encontrada en la sucursal activa.');check(date>=r.date&&date>=(r.events.at(-1)?.date||r.date),'Registra las operaciones en orden cronológico.');
 const post=(lines,total,action,extra={})=>{permit('contabilidad');return ctx.entry(data,session,{date,type:'negocio-recurrentes',desc:action+' · '+r.name,total,reference:'REC-'+r.id.slice(0,8),businessId:r.id,lines,...extra})};
 const cash=()=>{permit('cajas');ctx.financialCash(access);check(['1101','1102'].includes(body.pay),'Selecciona Caja general o Banco.');return body.pay};
 if(op==='recurringState'){
  check(data.cfg.treasuryControls?.anticipos?.enabled!==true||body.status!=='Cancelada'||!r.deposit,'Aplica o devuelve el anticipo antes de cancelar la suscripción.');
  check(access.owner,'Solo el dueño cambia el estado.');check(['Activa','Pausada','Cancelada'].includes(body.status)&&r.status!=='Cancelada'&&r.status!==body.status,'Transición no permitida.');
  if(body.status==='Cancelada'){const plan=planFor(r,date);if(plan?.noticeDays)check(body.noticeDate&&recurringDay(body.noticeDate)>=r.date&&Date.parse(date)-Date.parse(body.noticeDate)>=plan.noticeDays*86400000,'No se cumple el preaviso de cancelación del plan.');}
  if(body.status==='Activa')check(!r.billed.some(b=>b.to>date),'La reanudación empieza desde el siguiente período para conservar las facturas y sus notas.');
  const proposed={...r,events:[...r.events,{...event,status:body.status}]};
  for(const b of r.billed.filter(b=>b.to>date)){
   check(!r.planHistory?.length&&!b.discount,'Corrige el período de plan con notas de crédito antes de pausar o cancelar; conserva sus documentos emitidos.');
   check(body.status!=='Activa'&&body.creditConfirmed===true,'Confirma las notas de crédito del prorrateo antes de cambiar un período facturado.');
   check(!data.entries.some(e=>e.type==='nota-credito'&&e.invoiceId===b.entryId),'Este período ya tiene notas de crédito. Revisa la corrección con tu contador y cambia el estado desde el próximo período.');
   const target=recurringPeriod(proposed,b.period),desired=recurringInvoiceItems(r,target),invoice=data.entries.find(e=>e.id===b.entryId),items=invoice.items.map(i=>({p:i.p,q:i.q-(desired.find(d=>d.p===i.p)?.q||0)})).filter(i=>i.q>0);
   check(invoice.items.every(i=>i.q>=(desired.find(d=>d.p===i.p)?.q||0)),'La corrección requiere revisión de las cantidades diarias.');
   if(b.baseCents>target.baseCents){
    const note=ctx.credit({id:invoice.id,date,items,reasonCategory:'otro',reason:body.reason,refundMethod:body.refundMethod||'transferencia',shiftId:body.shiftId});
    check(moneyCents(note.subtotal)===b.baseCents-target.baseCents,'La nota no coincide con el prorrateo confirmado.');
    recurringCredit(data,access,session,note,ctx);
   }
  }
  r.status=body.status;event.status=body.status;r.events.push(event);return r.id;
 }
 if(op==='recurringAdvance'||op==='recurringRefund'){
  const total=ctx.amount(body.total),refund=op==='recurringRefund';check(refund||r.status!=='Cancelada','La suscripción está cancelada.');check(!refund||moneyCents(total)<=moneyCents(r.deposit),'La devolución supera el anticipo disponible.');
  const account=cash(),e=post(refund?[{a:r.liability,d:total,c:0},{a:account,d:0,c:total}]:[{a:account,d:total,c:0},{a:r.liability,d:0,c:total}],total,refund?'Devolución de anticipo':'Anticipo de suscripción');r.deposit=(moneyCents(r.deposit)+(refund?-1:1)*moneyCents(total))/100;r.events.push({...event,entryId:e.id,total});return e.id;
 }
 if(op==='recurringBill'){
  permit('facturacion');const period=Number(body.period),p=recurringPeriod(r,period);check(p.from<=date&&p.baseCents>0,'El período es futuro o no tiene días activos.');check(!r.billed.some(b=>b.period===period),'Ese período ya está facturado.');
  check(period===0||r.billed.some(b=>b.period===period-1)||recurringPeriod(r,period-1).baseCents===0,'Revisa primero el período anterior.');
  const product=data.products.find(p=>p.id===r.productId);check(product?.kind==='service'&&product.price===0&&!product.serviceDefinition?.enabled,'Conserva el servicio exclusivo de esta suscripción sin precio de catálogo ni consumibles.');
  const rounding=data.products.find(p=>p.id===r.roundingProductId);check(rounding?.kind==='service'&&rounding.price===0&&rounding.vatRate===product.vatRate&&!rounding.serviceDefinition?.enabled,'Conserva los dos servicios exclusivos con el mismo IVA.');
  const items=recurringInvoiceItems(r,p),discount=Number(body.discount||0);check(Number.isFinite(discount)&&discount>=0&&discount<=99,'Descuento inválido.');const total=invoiceTotals(items.map(i=>({...i,u:round(i.u*(1-discount/100)),vatRate:product.vatRate}))).total;
  if(body.coupon){const coupon=planFor(r,date)?.coupons?.find(c=>c.code===body.coupon);check(coupon&&coupon.until>=date&&coupon.discount===discount,'Cupón vencido o descuento diferente.');}
  check(body.previewCents===moneyCents(total),'Revisa el importe actualizado antes de confirmar.');
  const bill=await ctx.sale({...body,items,discount,sourceQuotation:undefined,customerId:r.customerId,due:body.due||date,payments:[{method:'credito',amount:total}]},r.id);
  const b={period,...p,baseCents:moneyCents(bill.subtotal),discount,coupon:text(body.coupon,40),entryId:bill.id,total:bill.total,recognizedCents:0,deferred:r.deferred};
  if(r.deferred){permit('contabilidad');const e=post([{a:'4101',d:bill.subtotal,c:0},{a:r.liability,d:0,c:bill.subtotal}],bill.subtotal,'Ingreso diferido de suscripción',{invoiceId:bill.id});b.deferralEntryId=e.id;}
  if(r.deposit){const applied=Math.min(moneyCents(r.deposit),moneyCents(bill.total))/100,e=post([{a:r.liability,d:applied,c:0},{a:'1201',d:0,c:applied}],applied,'Aplicación de anticipo',{invoiceId:bill.id});r.deposit=(moneyCents(r.deposit)-moneyCents(applied))/100;b.applicationEntryId=e.id;}
  r.billed.push(b);r.events.push({...event,entryId:bill.id,total});return bill.id;
 }
 if(op==='recurringRecognize'){
  const b=r.billed.find(b=>b.period===Number(body.period)&&b.deferred);check(b,'Período diferido no encontrado.');check(!b.recognizedThrough||date>b.recognizedThrough,'Ya reconociste hasta esa fecha.');
  const full=recurringPeriod(r,b.period),through=[date,b.to].sort()[0],cut={...r,events:[...(r.events||[]).filter(e=>e.date<=through),{date:through,status:'Pausada'}]},accrued=date<=b.from?0:recurringPeriod(cut,b.period).baseCents,elapsed=date<=b.from?0:recurringActiveDays(r,b.from,through),earned=r.planHistory?.length?(full.baseCents?Math.min(b.baseCents-(b.creditBaseCents||0),recurringRatio(b.baseCents-(b.creditBaseCents||0),accrued,full.baseCents)):0):(full.activeDays?recurringRatio(b.baseCents-(b.creditBaseCents||0),elapsed,full.activeDays):0),cents=earned-b.recognizedCents;
  check(cents>0,'No hay ingreso nuevo para reconocer.');const e=post([{a:r.liability,d:cents/100,c:0},{a:'4101',d:0,c:cents/100}],cents/100,'Reconocimiento confirmado de ingreso',{invoiceId:b.entryId});b.recognizedCents=earned;b.recognizedThrough=date;r.events.push({...event,entryId:e.id,total:cents/100});return e.id;
 }
 check(false,'Operación recurrente no disponible.');
}

// Complemento optativo de Q después de la nota ordinaria; no cambia sus líneas ni el emisor.
export function recurringCredit(data,access,session,note,ctx){
 const r=(data.businessRecords||[]).find(r=>r.module==='suscripciones'&&r.billed?.some(b=>b.entryId===note.invoiceId));if(!r)return;
 ctx.permit(access,'suscripciones',true);ctx.check(access.branchId&&note.date>=(r.events||[]).reduce((latest,e)=>e.date>latest?e.date:latest,r.date),'La corrección debe respetar la sucursal y la fecha de la última operación recurrente.');const b=r.billed.find(b=>b.entryId===note.invoiceId),cents=moneyCents(note.subtotal),remaining=b.baseCents-(b.creditBaseCents||0);ctx.check(cents<=remaining,'La nota supera la base recurrente disponible.');
 if(b.deferred){
  ctx.permit(access,'contabilidad',true);const deferred=Math.min(cents,Math.max(0,remaining-b.recognizedCents)),recognized=cents-deferred;
  if(deferred)ctx.entry(data,session,{date:note.date,type:'negocio-recurrentes',desc:'Corrección de ingreso diferido · '+r.name,invoiceId:note.invoiceId,businessId:r.id,creditNoteId:note.id,total:deferred/100,lines:[{a:r.liability,d:deferred/100,c:0},{a:'4101',d:0,c:deferred/100}]});
  b.recognizedCents-=recognized;
 }
 b.creditBaseCents=(b.creditBaseCents||0)+cents;r.events.push({date:note.date,at:new Date().toISOString(),action:'Nota de crédito recurrente',entryId:note.id,total:note.total});
}
export function validateRecurringRecord(r,data,check){
 if(r.kind==='recurring-plan'){validatePlan(r.plan,check);return;}
 if(r.planHistory){check(Array.isArray(r.planHistory)&&r.planHistory.length<=1200,'Historial de planes inválido.');for(const h of r.planHistory){recurringDay(h.date);if(h.plan.retryDays!==undefined)validatePlan(h.plan,check);}}
 check(r.kind==='subscription'&&moneyCents(r.price)===r.amountCents&&Number.isSafeInteger(r.amountCents)&&r.amountCents>0&&r.amountCents<=99999999900&&[1,3,6,12].includes(r.months),'Configuración recurrente inválida.');
 recurringDay(r.anchor);recurringDay(r.date);check(r.anchor<=r.date&&typeof r.deferred==='boolean'&&data.products.some(p=>p.id===r.productId&&p.kind==='service')&&data.products.some(p=>p.id===r.roundingProductId&&p.kind==='service')&&data.customers.some(c=>c.id===r.customerId),'Referencias recurrentes inválidas.');
 check(data.accounts.some(a=>a.code===r.liability&&a.tipo==='pasivo')&&Array.isArray(r.billed)&&Array.isArray(r.events)&&r.billed.length<=1200,'Pasivo o historial recurrente inválidos.');
 const periods=new Set();for(const b of r.billed){const p=recurringPeriod(r,b.period);check(!periods.has(b.period)&&p.from===b.from&&p.to===b.to&&Number.isSafeInteger(b.baseCents)&&b.baseCents>0&&b.baseCents<=99999999900&&Number.isInteger(b.activeDays)&&b.activeDays>0&&b.activeDays<=b.days&&data.entries.some(e=>e.id===b.entryId&&e.type==='venta'),'Renovación inválida o duplicada.');periods.add(b.period);for(const key of ['baseCents','recognizedCents','creditBaseCents'])check(Number.isSafeInteger(b[key]||0)&&(b[key]||0)>=0,'Importe recurrente inválido.');check(b.recognizedCents+(b.creditBaseCents||0)<=b.baseCents,'El reconocimiento supera la base neta.');}
}
