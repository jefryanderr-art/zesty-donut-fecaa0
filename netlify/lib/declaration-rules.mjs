import {randomUUID} from 'node:crypto';
import {documentHash} from './accounting-codec.mjs';
import {fiscalCheck as check,withholdingSummary,booksReport} from './fiscal-rules.mjs';
import {periodRange,financialReports} from './period-package.mjs';
import '../../public/fiscal-calculations.js';
const {cents,sum,vat,annual,advance,taxCents,effectiveDeclarations}=globalThis.AcontecFiscalMath;
export const WORKFLOW_MODULES=['declaraciones','cierre_anual'];
export const SOURCE_ROUTES={vatOutput:'impuestos',vatInput:'impuestos',vatNet:'impuestos',sales:'ventas',purchases:'compras',expenses:'gastos',withheld:'retenciones',suffered:'retenciones',payrollGross:'nomina',payrollSocial:'nomina',payrollEmployer:'nomina',payrollInatec:'nomina',payrollTax:'nomina',annualProfit:'impuestos',annualTaxable:'impuestos',annualTax:'impuestos',advance:'anticipos',account:'mayor'};
export const workflowRows=(data,module)=> (data.fiscalWorkflows||[]).filter(r=>r.module===module);
export const workflowEnabled=(data,module)=>workflowRows(data,module).find(r=>r.kind==='configuration')?.enabled===true;
const str=(s,n=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function nicaraguaTemplate(){
 const defs=[['iva','IVA mensual','mensual',['vatOutput','vatInput','vatNet']],['retenciones','Retenciones en la fuente','mensual',['withheld']],['anticipos','Anticipos y pago mínimo de renta','mensual',['sales','advance']],['renta','Renta anual','anual',['annualProfit','annualTaxable','annualTax']],['seguridad','Seguridad social e INATEC','mensual',['payrollGross','payrollSocial','payrollEmployer','payrollInatec']],['municipales','Impuestos municipales','mensual',['sales']]];
 return {id:randomUUID(),country:'Nicaragua',code:'NI',version:1,active:true,declarations:defs.map(([id,name,frequency,sources])=>({id,name,frequency,entity:'',channel:'',documents:[],legend:'Verificar con tu contador',due:null,ruleSource:'',effectiveFrom:'',alertDays:null,fields:sources.map((source,i)=>({id:'cifra-'+i,label:source,source,coefficient:source==='vatInput'?-1:1,officialBox:'',rateBps:null})),amountSource:id==='iva'?'vatNet':id==='retenciones'?'withheld':id==='anticipos'?'advance':id==='renta'?'annualTax':null}))};
}
export function validateTemplate(input){
 check(input&&Buffer.byteLength(JSON.stringify(input))<=120000,'Plantilla demasiado grande.');
 check(str(input.country,80)&&/^[A-Z]{2}$/.test(input.code||'')&&Array.isArray(input.declarations)&&input.declarations.length>0&&input.declarations.length<=40,'Plantilla inválida.');
 const ids=new Set();const declarations=input.declarations.map(d=>{
  check(/^[a-z0-9-]{1,60}$/.test(d.id||'')&&!ids.has(d.id)&&str(d.name,160)&&['mensual','trimestral','anual'].includes(d.frequency),'Declaración inválida o duplicada.');ids.add(d.id);
  check(Array.isArray(d.fields)&&d.fields.length>0&&d.fields.length<=80,'Agrega cifras de fuentes internas.');
  const fids=new Set();const fields=d.fields.map(f=>{check(/^[a-z0-9-]{1,60}$/.test(f.id||'')&&!fids.has(f.id)&&str(f.label,160)&&Object.hasOwn(SOURCE_ROUTES,f.source),'Cifra o fuente no válida.');fids.add(f.id);check(f.source!=='account'||/^\d[\w-]{0,30}$/.test(f.account||''),'Cuenta inválida.');check(f.rateBps==null||Number.isInteger(f.rateBps)&&f.rateBps>=0&&f.rateBps<=100000,'Tasa inválida; utiliza puntos básicos.');return {id:f.id,label:f.label,source:f.source,account:f.account||'',officialBox:String(f.officialBox||'').slice(0,80),rateBps:f.rateBps??null,coefficient:[-1,0,1].includes(f.coefficient)?f.coefficient:1};});
  const due=d.due==null?null:{day:d.due.day,monthOffset:d.due.monthOffset};check(!due||Number.isInteger(due.day)&&due.day>=1&&due.day<=31&&Number.isInteger(due.monthOffset)&&due.monthOffset>=0&&due.monthOffset<=24,'Vencimiento inválido.');
  check(d.alertDays==null||Number.isInteger(d.alertDays)&&d.alertDays>=0&&d.alertDays<=365,'Alerta inválida.');
  check(d.amountSource==null||d.amountSource!=='account'&&Object.hasOwn(SOURCE_ROUTES,d.amountSource)||['fields','maxFields'].includes(d.amountSource),'Fuente del total inválida.');
  const late=d.late==null?null:{fixedCents:d.late.fixedCents,dailyBps:d.late.dailyBps,source:d.late.source,effectiveFrom:d.late.effectiveFrom};
  check(!late||Number.isSafeInteger(late.fixedCents)&&late.fixedCents>=0&&Number.isInteger(late.dailyBps)&&late.dailyBps>=0&&late.dailyBps<=10000&&str(late.source,500)&&day(late.effectiveFrom),'Recargos sin fuente, vigencia o parámetros válidos.');
  check(Array.isArray(d.documents)&&d.documents.length<=30&&d.documents.every(x=>str(x,160)),'Documentos requeridos inválidos.');
  return {id:d.id,name:d.name,frequency:d.frequency,entity:String(d.entity||'').slice(0,160),channel:String(d.channel||'').slice(0,500),documents:d.documents,legend:String(d.legend||'').slice(0,500),due,alertDays:d.alertDays??null,ruleSource:String(d.ruleSource||'').slice(0,500),effectiveFrom:String(d.effectiveFrom||'').slice(0,10),fields,amountSource:d.amountSource||null,rateBps:d.rateBps??null,late};
 });
 for(const d of declarations)check(d.rateBps==null||Number.isInteger(d.rateBps)&&d.rateBps>=0&&d.rateBps<=100000,'Tasa del total inválida.');
 return {country:input.country,code:input.code,active:input.active!==false,declarations};
}
export function activeTemplates(data){
 const templates=workflowRows(data,'declaraciones').filter(r=>r.kind==='template');
 return templates.filter(r=>!templates.some(t=>t.parentId===r.id)).filter(r=>r.template.active!==false);
}
export function fiscalSources(data,period,settings={}){
 const {from,to}=periodRange(period),v=vat(data,from,to),a=annual(data,from.slice(0,4)),ws=withholdingSummary(data,from,to),within=r=>(r.date||r.to||'')>=from&&(r.date||r.to||'')<=to;
 const entries=(data.entries||[]).filter(within),payroll=(data.payrolls||[]).filter(within),source=(value,origins)=>({amountCents:value,origins});
 const p=(key)=>{const missing=payroll.some(r=>r[key]==null&&!(key==='employerSocial'&&(data.businessRecords||[]).some(b=>b.module==='planillas_area'&&b.id===r.id&&Number.isSafeInteger(b.employerCents))));return {...source(sum(payroll.map(r=>key==='employerSocial'&&r[key]==null?((data.businessRecords||[]).find(b=>b.module==='planillas_area'&&b.id===r.id)?.employerCents||0):cents(r[key]))),payroll.map(r=>({collection:'payrolls',id:r.id,entryId:r.entryId}))),missing:missing&&['employerSocial','inatec'].includes(key)};};
 const eorig=ids=>ids.map(id=>({collection:'entries',id}));
 const adjusted=[];let adjustmentCents=0;for(const row of settings.adjustments||[]){
  check(['no_deducible','no_gravable','perdida_anterior'].includes(row.kind)&&Number.isSafeInteger(row.amountCents)&&row.amountCents>=0&&str(row.reason,500),'Ajuste fiscal inválido.');
  if(row.kind==='perdida_anterior'){const tax=data.taxes?.find(t=>t.id===row.taxId&&t.period<from.slice(0,4)),loss=data.fiscalWorkflows?.find(r=>r.kind==='lossBalance'&&r.id===row.taxId&&r.period<from.slice(0,4)&&r.effectiveFrom<=to),available=loss?.amountCents??tax?.lossCarryCents;check(Number.isSafeInteger(available),'Pérdida sin origen anterior registrado.');let current=settings.declarationId;const own=new Set();while(current&&!own.has(current)){own.add(current);current=data.fiscalWorkflows?.find(r=>r.id===current)?.parentId;}if(settings.parentId)own.add(settings.parentId);const used=sum(effectiveDeclarations(data).filter(r=>!own.has(r.id)).flatMap(r=>r.frozen.adjustments||[]).filter(a=>a.kind==='perdida_anterior'&&a.taxId===row.taxId).map(a=>a.amountCents));const inThis=sum(adjusted.filter(a=>a.kind==='perdida_anterior'&&a.taxId===row.taxId).map(a=>a.amountCents));check(settings.viewOnly||row.amountCents+inThis<=available-used,'La pérdida arrastrada supera el saldo disponible.');}
  else check(Array.isArray(row.entryIds)&&row.entryIds.length>0&&row.entryIds.every(id=>entries.some(e=>e.id===id)),'El ajuste requiere asientos del período.');
  adjustmentCents+=row.amountCents*(row.kind==='no_deducible'?1:-1);adjusted.push(row);
 }
 const taxableCents=Math.max(0,cents(a.profit)+adjustmentCents);
 const result={vatOutput:source(cents(v.output),eorig(v.origins)),vatInput:source(cents(v.input),eorig(v.origins)),vatNet:source(cents(v.net),eorig(v.origins)),sales:source(cents(v.baseSales),eorig(entries.filter(e=>['venta','nota-credito'].includes(e.type)).map(e=>e.id))),purchases:source(cents(v.basePurchases),eorig(entries.filter(e=>['compra','nota-credito-compra','gasto','costo'].includes(e.type)).map(e=>e.id))),expenses:source(sum(entries.filter(e=>['gasto','costo'].includes(e.type)).map(e=>cents(e.subtotal??e.total))),eorig(entries.filter(e=>['gasto','costo'].includes(e.type)).map(e=>e.id))),withheld:source(sum(ws.rows.filter(r=>r.side==='practicada').map(r=>r.totalCents)),ws.rows.filter(r=>r.side==='practicada').map(r=>({collection:'withholdings',id:r.id,entryId:r.entryId}))),suffered:source(sum(ws.rows.filter(r=>r.side==='recibida').map(r=>r.totalCents)),ws.rows.filter(r=>r.side==='recibida').map(r=>({collection:'withholdings',id:r.id,entryId:r.entryId}))),payrollGross:p('gross'),payrollSocial:p('social'),payrollEmployer:p('employerSocial'),payrollInatec:p('inatec'),payrollTax:p('tax'),annualProfit:source(cents(a.profit),eorig(a.origins)),annualTaxable:source(taxableCents,[...eorig(a.origins),...adjusted.map(r=>({collection:'adjustment',...r}))]),annualTax:source(cents(a.tax),eorig(a.origins)),advance:source(period.length===7?cents(advance(data,period,Number(data.cfg?.advance?.rate||0)).grossAdvance):0,eorig(entries.filter(e=>['venta','nota-credito'].includes(e.type)).map(e=>e.id)))};
 return result;
}
export const lateCharges=globalThis.AcontecFiscalMath.lateCharges;
export function declarationCalculation(data,template,definition,period,settings={},now=new Date().toISOString(),cache=new Map()){
 const {from,to}=periodRange(period),missing=[];
 if(!definition.due||!str(definition.ruleSource,500)||!day(definition.effectiveFrom)||definition.effectiveFrom>to||!definition.entity||!definition.channel||definition.alertDays==null||!definition.amountSource)missing.push('Completar fuente, vigencia, entidad, canal, vencimiento, alertas y regla del total.');
 if(definition.amountSource==='annualTax'&&definition.rateBps==null)missing.push('Configurar tasa de renta con su fuente y vigencia.');
 if(definition.amountSource==='advance'&&(!data.cfg?.advance?.enabled||!data.cfg.advance.confirmed))missing.push('Configurar y confirmar el anticipo en Reglas de cada empresa.');
 const sourceKey='sources:'+period+':'+documentHash(settings.adjustments||[]);if(!cache.has(sourceKey))cache.set(sourceKey,fiscalSources(data,period,settings));
 const sources=cache.get(sourceKey),fields=definition.fields.map(f=>{
  let s=f.source==='account'?{amountCents:sum((data.entries||[]).filter(e=>e.date>=from&&e.date<=to).flatMap(e=>e.lines.filter(l=>l.a===f.account).map(l=>cents(l.d)-cents(l.c)))),origins:(data.entries||[]).filter(e=>e.date>=from&&e.date<=to&&e.lines.some(l=>l.a===f.account)).map(e=>({collection:'entries',id:e.id}))}:sources[f.source];
  if(s.missing)missing.push('Falta aporte registrado para '+f.label+'; configura una tasa documentada sobre salario bruto o registra su origen.');
  let amountCents=s.amountCents;if(f.source==='annualTax')amountCents=definition.rateBps==null?null:taxCents(sources.annualTaxable.amountCents,definition.rateBps);
  if(f.rateBps!=null)amountCents=Math.round(amountCents*f.rateBps/10000);check(amountCents===null||Number.isSafeInteger(amountCents),'Cifra fuera del rango seguro de centavos.');return {...f,amountCents:missing.length?null:amountCents,origins:f.source==='annualTax'?sources.annualTaxable.origins:s.origins,route:SOURCE_ROUTES[f.source]};
 });
 let amountCents=definition.amountSource==='fields'?sum(fields.map(f=>(f.amountCents||0)*f.coefficient)):definition.amountSource==='maxFields'?Math.max(0,...fields.filter(f=>f.coefficient!==0).map(f=>(f.amountCents||0)*f.coefficient)):sources[definition.amountSource]?.amountCents;
 if(definition.amountSource==='annualTax')amountCents=definition.rateBps==null?null:taxCents(sources.annualTaxable.amountCents,definition.rateBps);
 else if(definition.rateBps!=null&&!['fields','maxFields'].includes(definition.amountSource))amountCents=Math.round((amountCents||0)*definition.rateBps/10000);
 check(amountCents==null||Number.isSafeInteger(amountCents),'Total fuera del rango seguro de centavos.');
 if(sources[definition.amountSource]?.missing)missing.push('Falta aporte registrado para el total.');
 const ancestors=new Set([settings.declarationId]);let parent=settings.parentId;while(parent&&!ancestors.has(parent)){ancestors.add(parent);parent=workflowRows(data,'declaraciones').find(r=>r.id===parent)?.parentId;}
 const effective=effectiveDeclarations(data).filter(r=>!ancestors.has(r.id)),credits=[],creditIds=new Set();
 for(const row of settings.credits||[]){
  check(!(row.taxId&&row.withholdingId),'Selecciona un único origen del crédito.');
  const tax=(data.taxes||[]).find(t=>t.id===row.taxId&&['iva','anticipo','retencion'].includes(t.source));
  const withholding=(data.withholdings||[]).find(w=>w.id===row.withholdingId&&w.side==='recibida');
  const origin=tax||withholding,key=tax?'tax:'+tax.id:'withholding:'+withholding?.id;check(origin&&!creditIds.has(key)&&Number.isSafeInteger(row.amountCents)&&row.amountCents>0,'Crédito duplicado o sin origen anterior válido.');creditIds.add(key);
  const originPeriod=tax?.period||withholding.date.slice(0,7);check(/^(20\d{2})(?:-(0[1-9]|1[0-2]))?$/.test(originPeriod),'Período del crédito inválido.');
  const end=periodRange(originPeriod).to,prior=end<from||(period.length===4&&tax?.source==='anticipo'&&originPeriod.length===7&&end<=to);check(prior,'Solo se acreditan períodos anteriores registrados.');
  let available=0;
  if(withholding)available=cents(withholding.total)-sum((data.taxes||[]).filter(t=>t.source==='anticipo'&&t.period>=originPeriod).map(t=>cents(t.withholdings)));
  else if(tax.source==='anticipo'){const payments=(data.entries||[]).filter(e=>e.type==='fiscal-pago'&&e.taxId===tax.id&&e.date<=to);available=payments.length?sum(payments.map(e=>cents(e.total))):cents(tax.paid||0);}
  else available=cents(tax.credit||0);
  const used=sum(effective.flatMap(r=>r.frozen.credits||[]).filter(c=>tax?c.taxId===tax.id:c.withholdingId===withholding.id).map(c=>c.amountCents));
  check(settings.viewOnly||row.amountCents<=Math.max(0,available-used),'El crédito excede el saldo anterior disponible.');
  if(tax?.source==='iva'){
   const pool=(data.taxes||[]).filter(t=>t.source==='iva'&&t.period<period),poolIds=new Set(pool.map(t=>t.id));
   const reserved=sum(effective.flatMap(r=>r.frozen.credits||[]).filter(c=>poolIds.has(c.taxId)).map(c=>c.amountCents));
   const already=sum(credits.filter(c=>c.source==='iva').map(c=>c.amountCents));
   check(settings.viewOnly||already+row.amountCents<=sum(pool.map(t=>cents(t.credit)-cents(t.usedCredit)))-reserved,'Los créditos de IVA ya fueron utilizados por otros cierres.');
  }
  credits.push({taxId:tax?.id||null,withholdingId:withholding?.id||null,amountCents:row.amountCents,period:originPeriod,source:tax?.source||'retencion',entryId:origin.entryId||null});
 }
 const creditCents=sum(credits.map(r=>r.amountCents));check(creditCents<=Math.max(0,amountCents||0),'El crédito supera el impuesto.');amountCents=missing.length?null:Math.max(0,(amountCents||0)-creditCents);
 let due=null;if(definition.due){const d=new Date(to+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+definition.due.monthOffset);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(last,definition.due.day));due=d.toISOString().slice(0,10);}
 const {daysLate,configured:lateValid,penaltyCents,interestCents}=lateCharges(definition,amountCents,due,now,to);
 if(!cache.has('fin:'+period))cache.set('fin:'+period,financialReports(data,from,to));
 const fin=cache.get('fin:'+period),periodEntries=(data.entries||[]).filter(e=>e.date>=from&&e.date<=to);
 const states=new Map((data.businessRecords||[]).filter(r=>r.kind==='document').map(r=>[r.entryId,r]));
 const docTax=types=>{const book=types.includes('venta')?'ventas':'compras';return sum(booksReport(data,{book,from,to,signed:true},id=>states.get(id)).rows.map(r=>r.vatCents||0));};
 const consistency=[{name:'IVA cobrado contra documentos de ventas',differenceCents:sources.vatOutput.amountCents-docTax(['venta','nota-credito'])},{name:'IVA acreditable contra documentos de compras y gastos',differenceCents:sources.vatInput.amountCents-docTax(['compra','nota-credito-compra','gasto','costo'])},{name:'Planilla contra gasto de nómina 6101',differenceCents:sources.payrollGross.amountCents-sum(periodEntries.filter(e=>e.type==='nomina').flatMap(e=>e.lines.filter(l=>l.a==='6101').map(l=>cents(l.d)-cents(l.c))))}];
 const content={templateId:template.id,templateVersion:template.version,definitionId:definition.id,period,from,to,fields,amountCents,due,credits,adjustments:settings.adjustments||[],penaltyCents,interestCents,missing,consistency,warnings:[...fin.warnings,...consistency.filter(c=>c.differenceCents).map(c=>`${c.name}: diferencia de ${c.differenceCents} centavos.`),...(daysLate&&!lateValid?['Presentación o pago tardío: faltan parámetros de recargos; no se calcularon.']:[])]};
 return {...content,hash:documentHash(content),calculatedAt:now};
}
export function declarationView(data,record,template,definition,period,now,cache=new Map()){
 let live;try{live=declarationCalculation(data,record?.templateSnapshot||template,record?.definitionSnapshot||definition,period,{...(record?.settings||{}),declarationId:record?.id,parentId:record?.parentId,viewOnly:!!record?.frozen},record?.frozen?.calculatedAt||now,cache);}catch(error){live={hash:documentHash({error:error.publicMessage||'Origen no disponible'}),amountCents:null,calculatedAt:now,fields:[],missing:[error.publicMessage||'Revisar los orígenes configurados'],warnings:[],consistency:[],credits:[],adjustments:[],penaltyCents:0,interestCents:0};}
 const visible=record?.frozen||live,baseline=record?.frozen||record?.prepared;
 return {id:record?.id||null,templateId:template.id,definitionId:definition.id,name:definition.name,period,state:record?.state||'pendiente',parentId:record?.parentId||null,definition:record?.definitionSnapshot||definition,...visible,liveHash:live.hash,recalculatedAt:live.calculatedAt,freshness:record?.frozen?'Congelada al presentar':'Calculada ahora',changed:!!baseline&&baseline.hash!==live.hash,differenceCents:baseline&&live.amountCents!=null?live.amountCents-(baseline.amountCents||0):null,warning:baseline&&baseline.hash!==live.hash?(record?.frozen?'Los datos cambiaron después de presentar':'Cambio después de preparar'):null,filing:record?.filing,payment:record?.payment,package:record?.package};
}
export function declarationsForPeriod(data,period,now){
 const range=periodRange(period),out=[],seen=new Set(),cache=new Map();
 for(const t of activeTemplates(data))for(const d of t.template.declarations){
  let periods=[];
  if(d.frequency==='mensual')periods=range.months;
  if(d.frequency==='trimestral')periods=[...new Set(range.months.filter(m=>+m.slice(5)%3===1).map(m=>m.slice(0,4)+'-T'+Math.ceil(+m.slice(5)/3)))].filter(p=>periodRange(p).to<=range.to);
  if(d.frequency==='anual'&&period.length===4)periods=[period];
  for(const ownPeriod of periods){
   const records=workflowRows(data,'declaraciones').filter(r=>r.kind==='declaration'&&r.templateFamily===t.family&&r.definitionId===d.id&&r.period===ownPeriod);
   if(!records.length)out.push(declarationView(data,null,{...t.template,id:t.id,version:t.version},d,ownPeriod,now,cache));
   else for(const r of records){out.push(declarationView(data,r,{...t.template,id:t.id,version:t.version},d,ownPeriod,now,cache));seen.add(r.id)}
  }
 }
 for(const r of workflowRows(data,'declaraciones').filter(r=>r.kind==='declaration'&&!seen.has(r.id))){const own=periodRange(r.period);if(own.from>=range.from&&own.to<=range.to)out.push(declarationView(data,r,r.templateSnapshot,r.definitionSnapshot,r.period,now,cache));}
 return out;
}
export function validateWorkflow(data){
 const ids=new Set();for(const r of data.fiscalWorkflows||[]){check(r&&/^[a-z0-9-]{1,80}$/.test(r.id||'')&&!ids.has(r.id)&&WORKFLOW_MODULES.includes(r.module)&&['configuration','template','declaration','closure','packageJob','lossBalance'].includes(r.kind),'Registro fiscal inválido.');ids.add(r.id);if(r.kind==='template')validateTemplate(r.template);}
}
