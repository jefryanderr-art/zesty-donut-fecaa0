import {randomUUID} from 'node:crypto';
import {moneyCents,recurringDay} from './accounting-engine.mjs';
import {managuaDay} from './billing-rules.mjs';
import {fiscalProvider,fiscalTransition,manualDgiProvider} from './fiscal-provider.mjs';
import {FISCAL_MODULES,FISCAL_NOTICE,fiscalCheck as check,fiscalRows,fiscalConfig,validateValidationSettings,validateIssue,DEFAULT_VALIDATION,checkRange,rangeUsage,withholdingSummary,newChecklist,checklistComplete,periodMonths,booksReport,countryProfile,CHECKLIST_ITEMS,ITEM_STATES,BOOKS,BOOK_COLUMNS} from './fiscal-rules.mjs';
export {FISCAL_MODULES,validateFiscalRecord} from './fiscal-rules.mjs';
export const FISCAL_OPS=['fiscalEnable','fiscalSettings','fiscalRangeSwitch','fiscalRange','fiscalPrepare','fiscalTransition','fiscalCountry','fiscalCertificate','fiscalDeclaration','fiscalPeriodOpen','fiscalPeriodItem','fiscalPeriodClose','fiscalLockSwitch'];
export const fiscalModule=body=>({fiscalEnable:body.module,fiscalSettings:'cumplimiento_fiscal',fiscalRangeSwitch:'cumplimiento_fiscal',fiscalRange:'cumplimiento_fiscal',fiscalPrepare:'cumplimiento_fiscal',fiscalTransition:'cumplimiento_fiscal',fiscalCountry:'cumplimiento_fiscal',fiscalCertificate:'retenciones_fiscales',fiscalDeclaration:'retenciones_fiscales',fiscalPeriodOpen:'cierre_periodo',fiscalPeriodItem:'cierre_periodo',fiscalPeriodClose:'cierre_periodo',fiscalLockSwitch:'cierre_periodo'})[body.operation];
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const cap=s=>s[0].toUpperCase()+s.slice(1);
export async function fiscalOperation(data,access,session,body,ctx){
 const module=fiscalModule(body),op=body.operation,date=recurringDay(body.date),reason=txt(body.reason,501);
 check(FISCAL_MODULES.includes(module),'Módulo inválido.');ctx.permit(access,module,true);
 check(access.branchId&&body.confirmed===true&&reason.length>=3&&reason.length<=500,'Selecciona sucursal, confirma y explica el motivo.');
 const records=data.businessRecords||=[],event={action:op,date,reason,actor:session.member?.name||session.email,at:new Date().toISOString()};
 const add=(kind,values={})=>{const r={id:randomUUID(),module,kind,name:(values.name||reason).slice(0,200),status:'Activa',date,branchId:access.branchId,events:[event],...values};records.push(r);return r};
 let config=fiscalConfig(data,module);
 if(op==='fiscalEnable'){
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia la activación efectiva hoy.');
  if(!config)config=add('configuration',module==='cumplimiento_fiscal'?{provider:'manual_dgi',country:'NI',validation:{...DEFAULT_VALIDATION},validateOnIssue:false,enforceRanges:false}:module==='cierre_periodo'?{lockPeriods:false}:{});
  else config.events.push(event);
  config.status=body.enabled?'Activa':'Inactiva';return config.id;
 }
 check(config?.status==='Activa','El dueño debe activar este módulo.');
 const byId=(kind,id)=>{const r=fiscalRows(data,module).find(r=>r.id===id&&r.kind===kind);check(r,'Registro no encontrado.');return r};
 const log=(r,extra={})=>r.events.push({...event,...extra});
 if(op==='fiscalSettings'){
  check(access.owner,'Solo el dueño configura las validaciones.');fiscalProvider(body.provider);
  config.validation=validateValidationSettings(body.validation);config.provider=body.provider;config.validateOnIssue=body.validateOnIssue===true;
  check(typeof body.country==='string'&&/^[A-Z]{2}$/.test(body.country),'País inválido.');config.country=body.country;log(config);return config.id;
 }
 if(op==='fiscalRangeSwitch'){
  // Riesgo alto: solo hacia adelante, apagado por defecto, no recalcula históricos.
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia la numeración fiscal, con efecto desde hoy.');
  config.enforceRanges=body.enabled;log(config);return config.id;
 }
 if(op==='fiscalRange'){
  const range={series:txt(body.series,16).toUpperCase(),branchId:access.branchId,from:body.from,to:body.to,warnAt:body.warnAt??DEFAULT_VALIDATION.warnAt,status:body.active===false?'Inactiva':'Activa'};
  const existing=body.id?byId('range',body.id):null;
  check(access.owner||!existing,'Solo el dueño modifica un rango existente.');
  const candidate={...(existing||{}),...range,id:existing?.id};checkRange(candidate,data);
  const used=rangeUsage(data,candidate);
  if(existing)check(candidate.to>=used.last&&(!used.usedCount||candidate.from===existing.from),'No reduzcas el rango por debajo de números ya emitidos.');
  if(existing){Object.assign(existing,range);log(existing);return existing.id}
  return add('range',{...range,name:'Rango '+range.series+' '+range.from+'-'+range.to}).id;
 }
 if(op==='fiscalPrepare'){
  ctx.permit(access,'facturacion',true);
  const entry=data.entries.find(e=>e.id===body.entryId&&['venta','nota-credito'].includes(e.type));check(entry,'Documento no encontrado en la sucursal activa.');
  check(!fiscalRows(data,module).some(r=>r.kind==='document'&&r.entryId===entry.id&&r.fiscalState!=='anulado'),'El documento ya tiene un registro fiscal vigente.');
  const provider=fiscalProvider(config.provider),prepared=provider.prepare({number:body.number,fiscalDate:body.fiscalDate});
  const customer=data.customers.find(c=>c.id===entry.customerId),problems=validateIssue(config.validation,{totalCents:moneyCents(entry.total),customerName:customer?.name||entry.party,customerTaxId:customer?.taxId||customer?.ruc,customerAddress:customer?.address,fiscalNumber:prepared.number,fiscalDate:prepared.fiscalDate});
  const r=add('document',{entryId:entry.id,reference:entry.reference||'',fiscalState:'borrador',status:'Borrador',provider:provider.id,number:prepared.number,fiscalDate:prepared.fiscalDate,nonFiscal:prepared.nonFiscal,marker:prepared.marker,problems,history:[{state:'borrador',at:event.at,actor:event.actor,reason}]});
  return r.id;
 }
 if(op==='fiscalTransition'){
  const r=byId('document',body.id),provider=fiscalProvider(r.provider);let to=body.to;
  fiscalTransition(r.fiscalState,to);
  if(r.fiscalState==='borrador'&&to==='emitido'){
   const prepared=provider.prepare({number:body.number??r.number,fiscalDate:body.fiscalDate??r.fiscalDate});Object.assign(r,prepared);
   const entry=data.entries.find(e=>e.id===r.entryId),customer=data.customers.find(c=>c.id===entry?.customerId);
   r.problems=validateIssue(config.validation,{totalCents:moneyCents(entry?.total),customerName:customer?.name||entry?.party,customerTaxId:customer?.taxId||customer?.ruc,customerAddress:customer?.address,fiscalNumber:r.number,fiscalDate:r.fiscalDate});
   check(!r.problems.length,'Resuelve las observaciones antes de emitir: '+r.problems.join(' '));
   check(!fiscalRows(data,module).some(o=>o.kind==='document'&&o.id!==r.id&&o.number&&o.number===r.number&&o.fiscalState!=='anulado'),'Ese número fiscal ya está en otro documento vigente.');
   provider.submit(r);
  }
  if(to==='anulado')provider.cancel(r,reason);
  if(r.fiscalState==='rechazado'&&to==='borrador')Object.assign(r,{nonFiscal:true,marker:'DOCUMENTO NO FISCAL'});
  r.fiscalState=to;r.status=cap(to);r.history.push({state:to,at:event.at,actor:event.actor,reason});log(r);return r.id;
 }
 if(op==='fiscalCountry'){
  check(access.owner,'Solo el dueño edita plantillas de país.');const template=countryProfile(body.template||{});
  let r=fiscalRows(data,module).find(r=>r.kind==='country'&&r.code===template.code);
  if(!r)r=add('country',{name:template.country,code:template.code});else log(r);
  Object.assign(r,{template,reviewedAt:event.at});r.name=template.country;return r.id;
 }
 if(op==='fiscalCertificate'){
  ctx.permit(access,'fiscal',true);
  const w=(data.withholdings||[]).find(w=>w.id===body.withholdingId);check(w,'Retención no encontrada en la sucursal activa.');
  check(!fiscalRows(data,module).some(r=>r.kind==='certificate'&&r.withholdingId===w.id&&r.status==='Activa'),'La retención ya tiene una constancia vigente.');
  const number=txt(body.number,60);check(number,'Escribe el número de la constancia; no se genera numeración oficial.');
  return add('certificate',{withholdingId:w.id,number,side:w.side,party:w.name,totalCents:moneyCents(w.total),issuedOn:recurringDay(body.issuedOn),name:'Constancia '+number}).id;
 }
 if(op==='fiscalDeclaration'){
  ctx.permit(access,'fiscal',true);
  check(/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period||'')&&[body.sufferedCents,body.practicedCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=99999999900),'Período o importes de la declaración inválidos; usa centavos enteros.');
  const previous=fiscalRows(data,module).find(r=>r.kind==='declaration'&&r.period===body.period&&r.status==='Activa');
  if(previous){previous.status='Inactiva';log(previous,{supersededBy:'nuevo registro'})}
  return add('declaration',{period:body.period,sufferedCents:body.sufferedCents,practicedCents:body.practicedCents,note:txt(body.note,500),name:'Declaración '+body.period}).id;
 }
 if(op==='fiscalPeriodOpen'){
  const items=newChecklist(body.periodType,body.period);
  check(!fiscalRows(data,module).some(r=>r.kind==='period'&&r.periodType===body.periodType&&r.period===body.period&&r.branchId===access.branchId),'Ya existe un checklist para ese período y sucursal.');
  return add('period',{periodType:body.periodType,period:body.period,items,status:'Abierta',name:'Cierre '+body.periodType+' '+body.period}).id;
 }
 if(op==='fiscalPeriodItem'){
  const r=byId('period',body.id);check(r.status==='Abierta'&&r.branchId===access.branchId,'El checklist está cerrado o es de otra sucursal.');
  const item=r.items.find(i=>i.key===body.key);check(item&&ITEM_STATES.includes(body.state),'Ítem o estado inválido.');
  Object.assign(item,{state:body.state,note:txt(body.note,500),by:event.actor,at:event.at});log(r,{item:item.key,state:item.state});return r.id;
 }
 if(op==='fiscalPeriodClose'){
  const r=byId('period',body.id);check(r.status==='Abierta'&&r.branchId===access.branchId&&checklistComplete(r),'Completa todos los ítems antes de cerrar.');
  check(access.owner,'Solo el dueño cierra el checklist.');
  const today=managuaDay(),months=periodMonths(r);check(months.every(m=>m<today.slice(0,7)),'El período debe haber terminado.');
  r.status='Cerrada';r.closedAt=event.at;r.locked=false;
  if(config.lockPeriods===true){
   // Reutiliza el bloqueo existente (cfg.periodLocks); el dueño puede reabrir desde Control de períodos.
   data.cfg.periodLocks||={};
   for(const m of months){const key=access.branchId+':'+m;if(!data.cfg.periodLocks[key]?.closed)data.cfg.periodLocks[key]={closed:true,reason:'Checklist de cierre completo: '+reason,at:event.at,actor:event.actor,source:'checklist'}}
   r.locked=true;
  }
  log(r,{locked:r.locked});return r.id;
 }
 if(op==='fiscalLockSwitch'){
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia el bloqueo, con efecto desde hoy.');
  config.lockPeriods=body.enabled;log(config);return config.id;
 }
 check(false,'Operación no disponible.');
}
export function fiscalReport(data,body,canRead){
 const module=body.module;check(FISCAL_MODULES.includes(module),'Módulo inválido.');
 const from=recurringDay(body.from||body.date),to=recurringDay(body.to||body.date);check(from<=to,'Período inválido.');
 const rows=fiscalRows(data,module),result={enabled:fiscalConfig(data,module)?.status==='Activa',notice:FISCAL_NOTICE,records:rows};
 if(module==='cumplimiento_fiscal'){
  result.ranges=rows.filter(r=>r.kind==='range').map(r=>({id:r.id,series:r.series,branchId:r.branchId,from:r.from,to:r.to,status:r.status,...rangeUsage(data,r)}));
  const docs=rows.filter(r=>r.kind==='document');
  result.documentCounts=Object.fromEntries(['borrador','emitido','aceptado','rechazado','anulado'].map(s=>[s,docs.filter(d=>d.fiscalState===s).length]));
  result.countryDefault=globalThis.AcontecCountryTemplates.get('NI');
  if(body.book){
   check(canRead('fiscal'),'Sin permiso para exportar libros.');
   const status=new Map(docs.filter(d=>d.fiscalState!=='anulado').map(d=>[d.entryId,d]));
   result.book=booksReport(data,{...body,from,to},id=>status.get(id));
  }
 }
 if(module==='retenciones_fiscales'){check(canRead('fiscal'),'Sin permiso de lectura fiscal.');result.summary=withholdingSummary(data,from,to);result.certificates=rows.filter(r=>r.kind==='certificate');}
 return result;
}
export {manualDgiProvider,BOOKS,BOOK_COLUMNS,CHECKLIST_ITEMS};
