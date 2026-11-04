import {randomUUID,createHash} from 'node:crypto';
import {moneyCents,recurringDay,recurringPeriod,recurringBoundary,treasurySum,treasuryDebt,treasuryDiscountUsed,treasuryForecast,treasuryIndirect,treasuryDayAdd,treasuryRateRows,bankRateMicros,bankConvertCents} from './accounting-engine.mjs';
import {bankBaseCurrency,bankLedger,bankBaseLedger} from './banks.mjs';
import {canonical} from './accounting-codec.mjs';
export const TREASURY_MODULES=['flujo_proyectado','pagos_lote','anticipos','revalorizacion','tipos_cambio'];
export const TREASURY_OPS=['treasuryEnable','batchPolicy','batchPrepare','batchApprove','batchReject','batchPay','batchReverse','advanceCreate','advanceApply','advanceRefund','revaluePost','revalueReverse','ratesImport','ratesSource'];
const fail=m=>{throw Object.assign(new Error(m),{status:400,publicMessage:m})};
const check=(ok,m)=>{if(!ok)fail(m)};
export const treasuryToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const txt=(v,max=200)=>String(v??'').trim().slice(0,max);
const integer=v=>Number.isSafeInteger(v)&&v>0&&v<=99999999900;
const rows=(data,module)=>data.businessRecords?.filter(r=>r.module===module)||[];
export const treasuryModule=body=>body.operation==='treasuryEnable'?body.module:body.operation.startsWith('batch')?'pagos_lote':body.operation.startsWith('advance')?'anticipos':body.operation.startsWith('revalue')?'revalorizacion':'tipos_cambio';
const identity=(access,session)=>access.member?.id||session.email;
const balance=(data,account,date)=>treasurySum(data.entries.filter(e=>e.date<=date).flatMap(e=>e.lines||[]).filter(l=>l.a===account).map(l=>moneyCents(l.d)-moneyCents(l.c)));
const newRecord=(module,kind,date,branchId,name)=>({id:randomUUID(),module,kind,date,branchId,name,status:'Abierta',events:[]});
const documentInvoices=data=>data.entries.filter(e=>['1201','2101'].includes(e.pay)&&!e.invoiceId&&!e.allocationJournal);
export function treasuryForecastReport(data,body){
 const from=recurringDay(body.from),to=recurringDay(body.to),baseCurrency=bankBaseCurrency(data),events=[],notes=[];
 const add=(source,id,date,amountCents,currency=baseCurrency,originalCents=amountCents)=>{if(amountCents){recurringDay(date);events.push({source,id,date,amountCents,currency,originalCents})}};
 for(const e of documentInvoices(data)){const debt=treasuryDebt(data.entries,e,from);if(debt>0){add(e.pay==='1201'?'cobrar':'pagar',e.id,e.due||from,(e.pay==='1201'?1:-1)*debt);if(!e.due)notes.push('Sin vencimiento: '+e.id)}}
 for(const d of data.foreignDocuments||[]){if(d.date>from||d.settled&&data.entries.find(e=>e.id===d.settlementId)?.date<=from)continue;add('divisas',d.id,d.due||from,(d.side==='receive'?1:-1)*moneyCents(d.baseTotal),d.currency,(d.side==='receive'?1:-1)*moneyCents(d.foreignAmount))}
 // Los documentos en divisas no son facturas pay=1201/2101 y no se duplican.
 for(const tax of data.taxes||[]){const n=moneyCents(tax.amount)-moneyCents(tax.paid||0);if(n>0)add('impuestos',tax.id,tax.due||from,-n)}
 for(const payroll of data.payrolls||[])if(!payroll.entryId&&payroll.status!=='Pagada')add('nomina',payroll.id,payroll.payDate||payroll.to||from,-moneyCents(payroll.net||0));
 for(const loan of data.loans||[])for(const installment of loan.schedule||[])if(!installment.entryId)add('prestamos',loan.id+':'+installment.number,installment.due||recurringBoundary(loan.date,1,installment.number),-moneyCents(installment.total));
 for(const template of data.recurringEntries||[])if(template.active)for(let m=from.slice(0,7)+'-01';m<=to;m=recurringBoundary(m,1,1))if(!template.postedMonths?.includes(m.slice(0,7)))add('plantillas',template.id+':'+m,m,treasurySum(template.lines.filter(l=>data.accounts.find(a=>a.code===l.a)?.sub==='ef').map(l=>moneyCents(l.d)-moneyCents(l.c))));
 for(const r of rows(data,'suscripciones'))if(r.status==='Activa'){let depositAvailable=moneyCents(r.deposit||0);for(let p=0;p<1200;p++){const period=recurringPeriod(r,p);if(period.from>to)break;if(period.to<=from||r.billed.some(b=>b.period===p))continue;const vat=data.products.find(x=>x.id===r.productId)?.vatRate||0;const gross=bankConvertCents(period.baseCents,1000000+Math.round(vat*10000));const used=Math.min(gross,depositAvailable);depositAvailable-=used;add('suscripciones',r.id+':'+p,period.from<from?from:period.from,gross-used)}}
 const openingCents=treasurySum(data.entries.filter(e=>e.date<from||e.type==='apertura'&&e.date===from).flatMap(e=>e.lines).filter(l=>data.accounts.find(a=>a.code===l.a)?.sub==='ef').map(l=>moneyCents(l.d)-moneyCents(l.c)));
 const forecast=treasuryForecast({...body,from,to,openingCents,events});
 const original=[];for(const currency of ['NIO','USD'].filter(c=>c!==baseCurrency)){
  const banks=rows(data,'bancos').filter(b=>b.kind==='bank'&&!b.card&&b.currency===currency&&b.date<=from),opening=treasurySum(banks.map(b=>treasurySum([b.openingCents,...bankLedger(data,b,treasuryDayAdd(from,-1)).map(e=>e.amountCents)])));
  if(banks.length||events.some(e=>e.currency===currency))original.push({currency,forecast:treasuryForecast({...body,from,to,openingCents:opening,reserveCents:0,events:events.filter(e=>e.currency===currency).map(e=>({...e,amountCents:e.originalCents}))})});
 }
 return {from,to,baseCurrency,events,notes,forecast,original,indirect:treasuryIndirect(data,from,to)};
}
export function revaluationPreview(data,body,branchId,today=treasuryToday()){
 const date=recurringDay(body.date),month=date.slice(0,7),next=recurringBoundary(month+'-01',1,1),baseCurrency=bankBaseCurrency(data);
 check(date<today,'El mes debe haber terminado antes de revalorizar.');
 check(treasuryDayAdd(date,1)===next,'Selecciona el último día del mes.');check(data.cfg.treasuryControls?.revalorizacion?.enabled===true&&date>=data.cfg.treasuryControls.revalorizacion.since,'La revalorización requiere activación previa del dueño.');
 check(!(data.cfg.periodLocks?.[branchId+':'+month]||data.cfg.periodLocks?.[month])?.closed,'El período está cerrado.');
 check(!rows(data,'revalorizacion').some(r=>r.kind==='valuation'&&r.date===date),'El período ya fue revalorizado en esta sucursal.');
 const exposure=[];
 for(const b of rows(data,'bancos').filter(r=>r.kind==='bank'&&r.currency!==baseCurrency&&r.date<=date))exposure.push({key:'bank:'+b.id,account:b.account,currency:b.currency,originalCents:treasurySum([b.openingCents,...bankLedger(data,b,date).map(e=>e.amountCents)])*(b.card?-1:1),carryingCents:treasurySum(bankBaseLedger(data,b,date).map(e=>e.amountCents))*(b.card?-1:1)});
 for(const d of data.foreignDocuments||[])if(d.currency!==baseCurrency&&d.date<=date&&(!d.settled||data.entries.find(e=>e.id===d.settlementId)?.date>date))exposure.push({key:'document:'+d.id,account:d.side==='receive'?'1201':'2101',currency:d.currency,originalCents:moneyCents(d.foreignAmount)*(d.side==='receive'?1:-1),carryingCents:moneyCents(d.baseTotal)*(d.side==='receive'?1:-1)});
 check(!(data.foreignDocuments||[]).some(d=>d.settled&&data.entries.find(e=>e.id===d.settlementId)?.date>date),'Registra el cierre antes de liquidaciones posteriores para no cambiar su significado.');
 const pending=rows(data,'revalorizacion').filter(r=>r.kind==='valuation'&&!r.reversalId);check(!pending.length,'Confirma la reversa pendiente antes del siguiente cierre.');
 const items=exposure.map(e=>{const rate=(data.exchangeRates||[]).find(r=>r.currency===e.currency&&r.date===date);check(rate,'Importa la tasa y fuente de cierre para '+e.currency);const rateMicros=rate.rateMicros||Math.round(rate.rate*1000000);check(rate.source&&Number.isSafeInteger(rateMicros)&&rateMicros>0,'La tasa requiere fuente y precisión válida.');const targetCents=bankConvertCents(e.originalCents,rateMicros);return {...e,rateMicros,rateSource:rate.source,rateDate:rate.date,targetCents,differenceCents:treasurySum([targetCents,-e.carryingCents])}});
 const preview={date,next,items};return {...preview,token:createHash('sha256').update(canonical(preview)).digest('hex')};
}
export function treasuryReport(data,body,access){
 const module=body.module;check(TREASURY_MODULES.includes(module),'Módulo inválido.');
 if(module==='flujo_proyectado')return treasuryForecastReport(data,body);
 if(module==='revalorizacion'&&body.preview)return revaluationPreview(data,body,access.branchId);
 if(module==='pagos_lote')return {invoices:documentInvoices(data).filter(e=>e.pay==='2101').map(e=>({id:e.id,reference:e.reference,party:e.party,due:e.due||e.date,date:e.date,discount:e.earlyPaymentDiscount||null,balanceCents:treasuryDebt(data.entries,e)})).filter(e=>e.balanceCents>0),records:rows(data,module),policy:data.cfg.treasuryControls?.pagos_lote?.policy||null};
 if(module==='anticipos'){
  const records=rows(data,module),integrated=(data.businessRecords||[]).filter(r=>['suscripciones','reservas','contratos'].includes(r.module)&&r.deposit>0).map(r=>({id:r.id,module:r.module,name:r.name,customerId:r.customerId,remainingCents:moneyCents(r.deposit),managed:true})),totals=new Map();
  for(const r of [...records,...integrated]){const side=r.side||'customer',partyId=r.partyId||r.customerId||r.id,key=side+':'+partyId,party=(side==='customer'?data.customers:data.suppliers||[])?.find(p=>p.id===partyId),b=totals.get(key)||{side,partyId,name:party?.name||r.name,remainingCents:0,count:0};b.remainingCents=treasurySum([b.remainingCents,r.remainingCents]);b.count++;totals.set(key,b);}
  return {records,integrated,balances:[...totals.values()]};
 }
 return {records:module==='tipos_cambio'?data.exchangeRates||[]:rows(data,module),sourceEnabled:data.cfg.treasuryControls?.tipos_cambio?.sourceEnabled===true};
}
export function treasuryOperation(data,access,session,body,ctx){
 check(['NIO','USD'].includes(bankBaseCurrency(data)),'Configura NIO o USD como moneda base antes de usar esta ampliación.');
 const module=treasuryModule(body),op=body.operation,date=recurringDay(body.date),reason=txt(body.reason,501);check(TREASURY_MODULES.includes(module),'Módulo inválido.');ctx.permit(access,module,true);
 check(access.branchId&&body.confirmed===true&&reason.length>=3&&reason.length<=500,'Selecciona sucursal, confirma y escribe el motivo.');
 const actor=identity(access,session),event={date,reason,action:op,actor,actorName:session.member?.name||session.email,at:new Date().toISOString()};data.cfg.treasuryControls||={};
 if(op==='treasuryEnable'){
  check(access.owner&&typeof body.enabled==='boolean','Solo el dueño cambia la activación.');check(date===(ctx.today?.()||treasuryToday()),'La activación es efectiva hoy en Managua.');
  const previous=data.cfg.treasuryControls[module]||{};data.cfg.treasuryControls[module]={...previous,enabled:body.enabled,since:previous.since||date,events:[...(previous.events||[]),{...event,enabled:body.enabled}]};return null;
 }
 const control=data.cfg.treasuryControls[module];check(control?.enabled===true,'El dueño debe activar este módulo.');check(date>=control.since,'Solo operaciones posteriores a la activación.');
 data.businessRecords||=[];
 const all=data.businessRecords,rec=body.businessId?(data.businessRecords||[]).find(r=>r.id===body.businessId&&['suscripciones','reservas','contratos'].includes(r.module)&&r.branchId===access.branchId):rows(data,module).find(r=>r.id===body.id),post=(lines,totalCents,extra={})=>{ctx.permit(access,'contabilidad',true);return ctx.entry(data,session,{date,branchId:access.branchId,type:'tesoreria-'+module,desc:reason,reference:'TES-'+body.operationId,total:totalCents/100,lines,...extra})};
 const line=(a,cents,invoiceId)=>({a,d:cents>0?cents/100:0,c:cents<0?-cents/100:0,...(invoiceId?{invoiceId}:{})});
 const ensure=(code,name,tipo)=>{const existing=data.accounts.find(a=>a.code===code);check(!existing||existing.tipo===tipo,'La cuenta reservada tiene otra naturaleza.');if(!existing)data.accounts.push({code,name,tipo,nat:tipo==='pasivo'?'C':'D',sub:''});return code};
 const cash=(account,amountCents,foreignPayment=null)=>{
  ctx.permit(access,'cajas',true);const fund=data.pettyFunds?.find(f=>f.account===account&&!f.closedAt),bank=rows(data,'bancos').find(b=>b.kind==='bank'&&b.account===account&&!b.card);
  check(account==='1101'||account==='1102'||fund||bank,'Selecciona Caja general, caja chica activa o banco incorporado.');
  if(bank)ctx.permit(access,'bancos',true);
  if(bank&&bank.currency!==bankBaseCurrency(data)){
   check(foreignPayment&&data.cfg.bankControls?.enabled===true&&date>=bank.date,'El banco extranjero requiere activación e importe original confirmado.');
   check(bankConvertCents(foreignPayment.originalCents,foreignPayment.rateMicros)===Math.abs(amountCents)||amountCents===0,'La conversión original no coincide con el pago base.');
   if(amountCents>0)for(const day of [...new Set([date,...data.entries.filter(e=>e.date>=date).map(e=>e.date)])])check(treasurySum([bank.openingCents,...bankLedger(data,bank,day).map(m=>m.amountCents)])>=foreignPayment.originalCents,'El pago deja saldo original negativo.');
  }
  if(fund){check(actor===fund.responsible||access.owner,'Sin permiso sobre el fondo.');check(amountCents<=moneyCents(fund.limit),'El pago supera el límite por movimiento del fondo.');check(date>=(fund.lastCountDate||fund.date),'La fecha precede al último arqueo.');}
  else ctx.financialCash(access);
  if(fund&&amountCents<0)fund.fixedAmount=(moneyCents(fund.fixedAmount)-amountCents)/100;
  if(amountCents>0){for(const day of [...new Set([date,...data.entries.filter(e=>e.date>=date).map(e=>e.date)])])check(balance(data,account,day)>=amountCents,'El pago deja saldo negativo en la fecha elegida o una posterior.');if(fund){check(moneyCents(fund.fixedAmount)-amountCents>=moneyCents((data.pettyVouchers||[]).filter(v=>v.fundId===fund.id&&!v.replenishmentId&&!v.reversalId).reduce((s,v)=>s+v.total,0)),'El fondo conserva vales pendientes.');fund.fixedAmount=(moneyCents(fund.fixedAmount)-amountCents)/100;}}
  return account;
 };
 const originalMovement=(batch,e,sign)=>{
  if(!batch.foreignPayment)return;const bank=rows(data,'bancos').find(b=>b.kind==='bank'&&b.account===batch.account);const fp=batch.foreignPayment;
  all.push({...newRecord('bancos','movement',date,access.branchId,bank.name),bankId:bank.id,entryId:e.id,reference:e.reference,amountCents:sign*fp.originalCents,baseCents:sign*batch.totalCents,rateMicros:fp.rateMicros,rateSource:fp.rateSource,rateDate:fp.rateDate,events:[event]});
 };
 if(op==='batchPolicy'){
  check(access.owner&&Number.isSafeInteger(body.thresholdCents)&&body.thresholdCents>=0,'Solo el dueño configura el umbral en centavos.');check(Array.isArray(body.preparers)&&body.preparers.length&&Array.isArray(body.approvers)&&body.approvers.length,'Selecciona preparadores y aprobadores.');
  const valid=new Set([access.company.ownerEmail,...(ctx.members||[]).map(m=>m.id)]);check([...body.preparers,...body.approvers].every(id=>valid.has(id)),'Selecciona miembros activos de esta empresa.');
  control.policy={thresholdCents:body.thresholdCents,preparers:[...new Set(body.preparers)],approvers:[...new Set(body.approvers)]};control.events.push(event);return null;
 }
 if(op==='batchPrepare'){
  ctx.permit(access,'contabilidad',true);
  ctx.permit(access,'proveedores',true);const policy=control.policy;check(policy&&policy.preparers.includes(actor),'Configura la aprobación y selecciona un preparador autorizado.');
  check(Array.isArray(body.allocations)&&body.allocations.length>0&&body.allocations.length<=200,'Selecciona de 1 a 200 facturas.');const ids=new Set(),allocations=body.allocations.map(a=>{
   const invoice=documentInvoices(data).find(e=>e.id===a.invoiceId&&e.pay==='2101');check(invoice&&!ids.has(invoice.id)&&invoice.date<=date&&integer(a.amountCents),'Factura o importe inválido.');ids.add(invoice.id);
   const discountCents=a.discountCents||0,d=invoice.earlyPaymentDiscount;check(Number.isSafeInteger(discountCents)&&discountCents>=0,'Descuento inválido.');if(discountCents)check(d&&date<=d.until&&discountCents<=d.amountCents-treasuryDiscountUsed(data.entries,invoice.id),'El descuento requiere condiciones documentadas vigentes.');
   check(a.amountCents+discountCents<=treasuryDebt(data.entries,invoice),'El pago supera la deuda.');return {invoiceId:invoice.id,reference:invoice.reference||invoice.id,party:invoice.party,amountCents:a.amountCents,discountCents};
  });
  const totalCents=treasurySum(allocations.map(a=>a.amountCents)),r={...newRecord(module,'batch',date,access.branchId,txt(body.name)||'Lote '+date),allocations,totalCents,preparedBy:actor,preparedName:event.actorName,policy:structuredClone(policy),account:body.account,events:[event]};check(totalCents>0,'Lote vacío.');const bank=rows(data,'bancos').find(b=>b.kind==='bank'&&b.account===body.account);
  if(bank&&bank.currency!==bankBaseCurrency(data)){
   const rateMicros=bankRateMicros(body.rate),rateSource=txt(body.rateSource,201),rateDate=recurringDay(body.rateDate);check(integer(body.originalCents)&&rateSource.length>=3&&rateSource.length<=200&&rateDate<=date&&bankConvertCents(body.originalCents,rateMicros)===totalCents,'Confirma importe original, tasa, fuente y fecha; su equivalente debe coincidir exactamente con el lote.');r.foreignPayment={originalCents:body.originalCents,rateMicros,rateSource,rateDate,currency:bank.currency};
  }
  cash(body.account,0,r.foreignPayment);all.push(r);return r.id;
 }
 if(op.startsWith('batch')){
  check(rec?.kind==='batch'&&rec.branchId===access.branchId&&date>=(rec.events.at(-1)?.date||rec.date),'Lote no encontrado o fecha anterior.');
  const approval=rec.totalCents>=rec.policy.thresholdCents;
  if(op==='batchApprove'){check(rec.status==='Abierta'&&rec.policy.approvers.includes(actor)&&actor!==rec.preparedBy,'Aprueba otra persona autorizada.');rec.status='Aprobada';rec.approvedBy=actor;rec.approvedName=event.actorName;}
  else if(op==='batchReject'){check(['Abierta','Aprobada'].includes(rec.status)&&(actor===rec.preparedBy||rec.policy.approvers.includes(actor)),'No se puede rechazar este lote.');rec.status='Rechazada';}
  else if(op==='batchPay'){
   ctx.permit(access,'proveedores',true);check(rec.policy.preparers.includes(actor)||rec.policy.approvers.includes(actor),'Responsable no autorizado.');check(rec.status==='Aprobada'||!approval&&rec.status==='Abierta','El lote requiere aprobación o ya fue pagado.');
   for(const a of rec.allocations){const invoice=data.entries.find(e=>e.id===a.invoiceId);check(date>=invoice.date&&a.amountCents+a.discountCents<=treasuryDebt(data.entries,invoice),'Una factura ya fue pagada. Actualiza el lote.');if(a.discountCents)check(date<=invoice.earlyPaymentDiscount.until&&a.discountCents<=invoice.earlyPaymentDiscount.amountCents-treasuryDiscountUsed(data.entries,invoice.id),'Venció o ya se aplicó el descuento.');}
   const account=cash(rec.account,rec.totalCents,rec.foreignPayment),lines=rec.allocations.flatMap(a=>[line('2101',a.amountCents+a.discountCents,a.invoiceId),...(a.discountCents?[line(ensure('4192','Descuentos financieros obtenidos','ingreso'),-a.discountCents,a.invoiceId)]:[])]);lines.push(line(account,-rec.totalCents));
   const e=post(lines,rec.totalCents,{allocationJournal:true,treasuryId:rec.id});rec.entryId=e.id;originalMovement(rec,e,-1);rec.status='Pagada';rec.paidDate=date;rec.paidByName=event.actorName;
  }else if(op==='batchReverse'){
   check(access.owner&&rec.status==='Pagada'&&!rec.reversalId&&date>=rec.paidDate,'Solo el dueño revierte un lote pagado una vez.');const e=data.entries.find(e=>e.id===rec.entryId);cash(rec.account,-rec.totalCents,rec.foreignPayment);
   ctx.permit(access,'cajas',true);const reversed=post(e.lines.map(l=>({...l,d:l.c,c:l.d})),rec.totalCents,{allocationJournal:true,reversalOf:e.id,treasuryId:rec.id});rec.reversalId=reversed.id;originalMovement(rec,reversed,1);rec.status='Revertida';
  }else fail('Operación de lote inválida.');rec.events.push(event);return rec.id;
 }
 if(op==='advanceCreate'){
  check(['customer','supplier'].includes(body.side)&&integer(body.amountCents),'Revisa tercero e importe en centavos.');const customer=body.side==='customer';ctx.permit(access,customer?'ventas':'proveedores',true);
  const party=(customer?data.customers:data.suppliers||[]).find(p=>p.id===body.partyId&&p.status!=='inactivo');check(party,'Selecciona un tercero activo.');
  // Los depósitos de Reservas, Contratos y Q conservan su ficha y operaciones.
  check(!body.businessId,'Registra el depósito vinculado desde su módulo original, sin duplicarlo.');
  const account=cash(body.account,customer?-body.amountCents:body.amountCents),controlAccount=customer?ensure('2108','Anticipos de clientes','pasivo'):ensure('1205','Anticipos a proveedores','activo');
  const r={...newRecord(module,'advance',date,access.branchId,party.name),side:body.side,partyId:party.id,remainingCents:body.amountCents,amountCents:body.amountCents,account:controlAccount,events:[event]};
  r.entryId=post([line(account,customer?body.amountCents:-body.amountCents),line(controlAccount,customer?-body.amountCents:body.amountCents)],body.amountCents,{treasuryId:r.id}).id;all.push(r);return r.id;
 }
 if(op==='advanceApply'||op==='advanceRefund'){
  const integrated=!!body.businessId;
  if(integrated){check(rec&&ctx.permit(access,rec.module,true)!==false,'Sin permiso para el depósito vinculado.');check(rec&&rec.deposit>0&&rec.customerId,'Depósito vinculado no disponible.');check(op==='advanceApply','Devuelve el depósito desde su módulo de origen.');}
  const originalDeposit=integrated?moneyCents(rec.deposit):null;
  const advance=integrated?{...rec,kind:'advance',side:'customer',partyId:rec.customerId,remainingCents:originalDeposit,account:rec.liability||rec.depositAccount,events:rec.events||[]}:rec;
  const active=advance;
  check(active?.kind==='advance'&&active.branchId===access.branchId&&active.remainingCents>0&&date>=String(active.events.at(-1)?.date||active.date).slice(0,10),'Anticipo no disponible o fecha anterior.');const customer=active.side==='customer';ctx.permit(access,customer?'ventas':'proveedores',true);
  if(op==='advanceRefund'){
   check(integer(body.amountCents)&&body.amountCents<=active.remainingCents,'La devolución supera el saldo.');const account=cash(body.account,customer?body.amountCents:-body.amountCents);
   event.entryId=post([line(active.account,customer?body.amountCents:-body.amountCents),line(account,customer?-body.amountCents:body.amountCents)],body.amountCents,{treasuryId:active.id}).id;event.amountCents=body.amountCents;active.remainingCents-=body.amountCents;
  }else{
   check(Array.isArray(body.allocations)&&body.allocations.length&&body.allocations.length<=200,'Selecciona facturas.');const ids=new Set(),lines=[],allocations=body.allocations.map(a=>{
    const invoice=documentInvoices(data).find(e=>e.id===a.invoiceId&&e.pay===(customer?'1201':'2101'));check(invoice&&!ids.has(invoice.id)&&invoice.date<=date&&(customer?invoice.customerId===active.partyId:invoice.supplierId===active.partyId)&&integer(a.amountCents)&&a.amountCents<=treasuryDebt(data.entries,invoice),'Factura, tercero o saldo inválido.');ids.add(invoice.id);lines.push(line(active.account,customer?a.amountCents:-a.amountCents,a.invoiceId),line(invoice.pay,customer?-a.amountCents:a.amountCents,a.invoiceId));return {invoiceId:invoice.id,amountCents:a.amountCents};
   });const totalCents=treasurySum(allocations.map(a=>a.amountCents));check(totalCents<=active.remainingCents,'La aplicación supera el anticipo.');event.entryId=post(lines,totalCents,{allocationJournal:true,treasuryId:active.id,...(integrated?{businessId:active.id}:{})}).id;event.amountCents=totalCents;active.remainingCents-=totalCents;event.allocations=allocations;
  }active.events.push(event);if(integrated){rec.deposit=active.remainingCents/100;rec.events=active.events;}else{if(!active.remainingCents)active.status='Cerrada';}return active.id;
 }
 if(op==='revaluePost'){
  if(rows(data,'bancos').some(b=>b.kind==='bank'&&b.currency!==bankBaseCurrency(data)))ctx.permit(access,'bancos',true);
  const preview=revaluationPreview(data,body,access.branchId,ctx.today?.()||treasuryToday());check(preview.token===body.previewToken,'Actualiza y confirma la vista previa.');check(preview.items.some(i=>i.differenceCents),'No hay diferencia por contabilizar.');
  const lines=preview.items.filter(i=>i.differenceCents).flatMap(i=>[line(i.account,i.differenceCents),line(i.differenceCents>0?ensure('4104','Ganancia cambiaria','ingreso'):ensure('6111','Pérdida cambiaria','gasto'),-i.differenceCents)]),r={...newRecord(module,'valuation',date,access.branchId,'Revalorización '+date.slice(0,7)),...preview,events:[event]};
  r.entryId=post(lines,treasurySum(preview.items.map(i=>Math.abs(i.differenceCents))),{treasuryId:r.id,revaluation:true}).id;all.push(r);return r.id;
 }
 if(op==='revalueReverse'){
  check(rec?.kind==='valuation'&&!rec.reversalId&&body.date===rec.next,'Confirma una sola reversa al primer día del mes siguiente.');const e=data.entries.find(e=>e.id===rec.entryId);rec.reversalId=post(e.lines.map(l=>({...l,d:l.c,c:l.d})),moneyCents(e.total),{treasuryId:rec.id,revaluation:true,reversalOf:e.id}).id;rec.events.push(event);rec.status='Cerrada';return rec.id;
 }
 if(op==='ratesSource'){check(access.owner&&typeof body.enabled==='boolean','Solo el dueño configura la fuente.');control.sourceEnabled=body.enabled;control.events.push(event);return null;}
 if(op==='ratesImport'){
  ctx.permit(access,'contabilidad',true);const imported=treasuryRateRows(body.grid,data.exchangeRates||[],bankBaseCurrency(data));check(imported.every(r=>r.date<=date),'No se importan tasas futuras.');data.exchangeRates||=[];data.exchangeRates.push(...imported.map(r=>({...r,importedAt:event.at,importedBy:actor})));return imported[0].id;
 }
 fail('Operación de tesorería inválida.');
}
// Toda escritura y restauración preservan documentos y asientos ya registrados.
export function guardTreasury(previous,next,assert,action=''){
 const isTreasury=TREASURY_OPS.some(op=>action==='Operación: '+op);
 if(!isTreasury){assert(canonical(previous?.cfg?.treasuryControls)===canonical(next.cfg?.treasuryControls),'Usa la operación de configuración de tesorería.');assert(canonical((previous?.businessRecords||[]).filter(r=>TREASURY_MODULES.includes(r.module)))===canonical((next.businessRecords||[]).filter(r=>TREASURY_MODULES.includes(r.module))),'Conserva los documentos de tesorería; usa su operación específica.');}
 for(const e of previous?.entries||[])if(e.treasuryId)assert(canonical(e)===canonical((next.entries||[]).find(n=>n.id===e.id)),'Conserva todo asiento de tesorería contabilizado.');
 for(const e of next.entries||[])if(String(e.type).startsWith('tesoreria-')&&!(previous?.entries||[]).some(old=>old.id===e.id))assert(isTreasury,'Usa la operación específica de tesorería.');
 for(const e of next.entries||[])if(e.allocationJournal){const r=(next.businessRecords||[]).find(r=>r.id===e.treasuryId);assert(r,'Asignación por factura sin documento.');if(!(previous?.entries||[]).some(old=>old.id===e.id))assert(['Operación: batchPay','Operación: batchReverse','Operación: advanceApply'].includes(action),'Usa la operación de aplicación confirmada.');}
 for(const e of next.entries||[])if(e.revaluation){const r=(next.businessRecords||[]).find(r=>r.module==='revalorizacion'&&r.id===e.treasuryId&&[r.entryId,r.reversalId].includes(e.id));assert(r,'Ajuste de moneda sin documento confirmado.');if(!(previous?.entries||[]).some(old=>old.id===e.id))assert(['Operación: revaluePost','Operación: revalueReverse'].includes(action),'Usa la operación confirmada de revalorización.');}

 const oldRows=previous?.businessRecords||[],newRows=next.businessRecords||[];
 for(const r of oldRows.filter(r=>TREASURY_MODULES.includes(r.module))){const n=newRows.find(n=>n.id===r.id);assert(n,'Conserva el documento de tesorería.');if(r.entryId){assert(n.entryId===r.entryId,'Conserva el asiento original.');assert(canonical(previous.entries.find(e=>e.id===r.entryId))===canonical(next.entries.find(e=>e.id===r.entryId)),'Corrige tesorería mediante reversa.');}if(r.kind==='batch'&&r.entryId)assert(canonical(r.allocations)===canonical(n.allocations)&&r.totalCents===n.totalCents&&r.account===n.account,'Conserva el detalle del lote pagado.');if(r.reversalId)assert(n.reversalId===r.reversalId&&canonical(previous.entries.find(e=>e.id===r.reversalId))===canonical(next.entries.find(e=>e.id===r.reversalId)),'Conserva la reversa.');}
 for(const r of oldRows.filter(r=>(previous?.cfg?.treasuryControls?.anticipos?.enabled===true||next.cfg?.treasuryControls?.anticipos?.enabled===true)&&['suscripciones','reservas','contratos'].includes(r.module)&&r.deposit>0)){const n=newRows.find(n=>n.id===r.id);assert(n&&!['Cancelada','Cancelado','Finalizada','Finalizado'].includes(n.status)||n?.deposit===0,'Aplica o devuelve el anticipo antes de cancelar.');}
 for(const rate of previous?.exchangeRates||[])if(rate.importedAt)assert(canonical(rate)===canonical((next.exchangeRates||[]).find(n=>n.id===rate.id)),'Conserva la tasa importada y su fuente.');
}
export function validateTreasuryRecord(r,data,assert){
 assert(['Abierta','Cerrada','Aprobada','Rechazada','Pagada','Revertida'].includes(r.status)&&Array.isArray(r.events),'Documento de tesorería inválido.');
 for(const key of ['amountCents','remainingCents','totalCents'])if(r[key]!==undefined)assert(Number.isSafeInteger(r[key])&&r[key]>=0,'Importe de tesorería inválido.');
 if(r.kind==='advance')assert(r.remainingCents<=r.amountCents,'Saldo de anticipo inválido.');
 if(r.kind==='batch')assert(r.totalCents===treasurySum(r.allocations.map(a=>a.amountCents)),'Lote descuadrado.');
 if(r.entryId)assert(data.entries.some(e=>e.id===r.entryId),'Falta asiento de tesorería.');
}
