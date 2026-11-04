import {moneyCents,recurringDay} from './accounting-engine.mjs';
import {countryTemplate} from './country.mjs';
import '../../public/country-templates.js';
// Reglas puras de cumplimiento fiscal. Todo es configurable por empresa; no se afirma cumplimiento ni validez fiscal.
// Verifica con tu contador. Importes siempre en centavos enteros.
export const FISCAL_MODULES=['cumplimiento_fiscal','retenciones_fiscales','cierre_periodo'];
export const FISCAL_NOTICE='Formato de trabajo para el contador; no es un formato oficial homologado. Verifica con tu contador.';
export const fiscalCheck=(value,message)=>{if(!value)throw Object.assign(new Error(message),{publicMessage:message,status:400})};
export const fiscalRows=(data,module)=>(data.businessRecords||[]).filter(r=>r.module===module);
export const fiscalConfig=(data,module='cumplimiento_fiscal')=>fiscalRows(data,module).find(r=>r.kind==='configuration');
export const DEFAULT_VALIDATION={requireTaxId:false,taxIdThresholdCents:0,requiredFields:['customerName'],numberMask:'',warnAt:10};
export const REQUIRED_FIELD_OPTIONS=['customerName','customerTaxId','customerAddress','fiscalNumber','fiscalDate'];
export const FIELD_LABELS={customerName:'nombre del cliente',customerTaxId:'RUC/cédula',customerAddress:'dirección',fiscalNumber:'número fiscal',fiscalDate:'fecha fiscal'};
export const BOOKS={
 ventas:{types:['venta','nota-credito'],label:'Libro de ventas (trabajo)'},
 compras:{types:['compra','nota-credito-compra'],label:'Libro de compras (trabajo)'},
 retenciones:{types:[],label:'Registro de retenciones (trabajo)'}
};
export const BOOK_COLUMNS=['date','reference','party','taxId','subtotalCents','vatCents','totalCents','type','fiscalNumber','fiscalStatus'];
// Máscara: A = letra mayúscula, 9 = dígito, cualquier otro carácter es literal. Sin expresiones regulares del usuario.
export function maskMatches(mask,value){
 if(!mask)return true;fiscalCheck(typeof mask==='string'&&mask.length<=40,'Formato de numeración inválido.');
 const text=String(value??'');if(text.length!==mask.length)return false;
 return [...mask].every((m,i)=>m==='A'?/[A-Z]/.test(text[i]):m==='9'?/\d/.test(text[i]):m===text[i]);
}
export function validateValidationSettings(v){
 fiscalCheck(v&&typeof v==='object'&&typeof v.requireTaxId==='boolean','Revisa las validaciones previas.');
 fiscalCheck(Number.isSafeInteger(v.taxIdThresholdCents)&&v.taxIdThresholdCents>=0&&v.taxIdThresholdCents<=99999999900,'Monto mínimo inválido; usa centavos enteros.');
 fiscalCheck(Array.isArray(v.requiredFields)&&v.requiredFields.length<=REQUIRED_FIELD_OPTIONS.length&&v.requiredFields.every(f=>REQUIRED_FIELD_OPTIONS.includes(f)),'Campos requeridos inválidos.');
 fiscalCheck(typeof v.numberMask==='string'&&v.numberMask.length<=40&&/^[A-Za-z0-9\-\/. ]*$/.test(v.numberMask),'Formato de numeración inválido.');
 fiscalCheck(Number.isInteger(v.warnAt)&&v.warnAt>=0&&v.warnAt<=1000000,'Umbral de agotamiento inválido.');
 return {requireTaxId:v.requireTaxId,taxIdThresholdCents:v.taxIdThresholdCents,requiredFields:[...new Set(v.requiredFields)],numberMask:v.numberMask,warnAt:v.warnAt};
}
// Validaciones previas a emitir; devuelve la lista de problemas (vacía = sin observaciones).
export function validateIssue(settings,doc){
 const v={...DEFAULT_VALIDATION,...(settings||{})},problems=[];
 if(v.requireTaxId&&doc.totalCents>=v.taxIdThresholdCents&&!String(doc.customerTaxId||'').trim())problems.push('RUC/cédula obligatorio para este monto.');
 const have={customerName:doc.customerName,customerTaxId:doc.customerTaxId,customerAddress:doc.customerAddress,fiscalNumber:doc.fiscalNumber,fiscalDate:doc.fiscalDate};
 for(const f of v.requiredFields)if(!String(have[f]??'').trim())problems.push('Falta el campo requerido: '+(FIELD_LABELS[f]||f)+'.');
 if(doc.fiscalNumber&&!maskMatches(v.numberMask,doc.fiscalNumber))problems.push('El número no coincide con el formato configurado.');
 return [...new Set(problems)];
}
export function rangeUsage(data,range){
 const used=new Set();
 for(const e of data.entries||[])if(e.type==='venta'&&e.series===range.series&&(e.branchId||'principal')===range.branchId&&Number.isInteger(e.sequence)&&e.sequence>=range.from&&e.sequence<=range.to)used.add(e.sequence);
 const sorted=[...used].sort((a,b)=>a-b),last=sorted.at(-1)??range.from-1,gaps=[];
 for(let n=sorted[0]??0;sorted.length&&n<last&&gaps.length<200;n++)if(!used.has(n))gaps.push(n);
 const remaining=range.to-last,warnAt=range.warnAt??DEFAULT_VALIDATION.warnAt;
 return {usedCount:used.size,last,remaining,gaps,state:remaining<=0?'agotado':remaining<=warnAt?'por_agotarse':'vigente'};
}
export function activeRanges(data,series,branchId){return fiscalRows(data,'cumplimiento_fiscal').filter(r=>r.kind==='range'&&r.status==='Activa'&&r.series===series&&r.branchId===branchId)}
// Guardia de emisión de facturas: solo actúa si el dueño activó el módulo y los interruptores. Lee la empresa completa.
export function fiscalIssueGuard(full,ctx){
 const config=fiscalConfig(full);if(config?.status!=='Activa')return null;
 const result={warnings:[]};
 if(config.validateOnIssue===true){
  const problems=validateIssue(config.validation,{totalCents:ctx.totalCents,customerName:ctx.customer?.name,customerTaxId:ctx.customer?.taxId||ctx.customer?.ruc,customerAddress:ctx.customer?.address});
  const blocking=problems.filter(p=>!/número fiscal|fecha fiscal/.test(p));
  fiscalCheck(!blocking.length,'Validación fiscal previa: '+blocking.join(' '));
 }
 if(config.enforceRanges===true){
  const ranges=activeRanges(full,ctx.series,ctx.branchId);
  fiscalCheck(ranges.length,'No hay un rango fiscal autorizado para la serie y la sucursal; configúralo en Cumplimiento fiscal.');
  const range=ranges.find(r=>ctx.sequence>=r.from&&ctx.sequence<=r.to);
  fiscalCheck(range,'El número '+ctx.sequence+' queda fuera del rango autorizado de la serie '+ctx.series+'.');
  const remaining=range.to-ctx.sequence;if(remaining<=(range.warnAt??DEFAULT_VALIDATION.warnAt))result.warnings.push('Rango por agotarse: quedan '+remaining+' números.');
 }
 return result;
}
export function checkRange(r,data,check=fiscalCheck){
 check(typeof r.series==='string'&&/^[A-Z0-9-]{1,16}$/.test(r.series)&&typeof r.branchId==='string'&&r.branchId.length<=80,'Serie o sucursal inválida.');
 check(Number.isSafeInteger(r.from)&&Number.isSafeInteger(r.to)&&r.from>=1&&r.to>=r.from&&r.to<=999999999,'Rango numérico inválido.');
 check(Number.isInteger(r.warnAt)&&r.warnAt>=0&&r.warnAt<=1000000,'Alerta de agotamiento inválida.');
 if(r.status==='Activa'&&data)check(!fiscalRows(data,'cumplimiento_fiscal').some(o=>o.id!==r.id&&o.kind==='range'&&o.status==='Activa'&&o.series===r.series&&o.branchId===r.branchId&&o.from<=r.to&&o.to>=r.from),'El rango se traslapa con otro activo de la misma serie y sucursal.');
}
// Retenciones: acumulados por tercero y cruce con anticipo mensual y declaración manual.
export function withholdingSummary(data,from,to){
 recurringDay(from);recurringDay(to);fiscalCheck(from<=to,'Período inválido.');
 const rows=(data.withholdings||[]).filter(w=>w.date>=from&&w.date<=to).map(w=>({id:w.id,date:w.date,name:w.name,side:w.side,reference:w.reference,baseCents:moneyCents(w.base),rate:w.rate,totalCents:moneyCents(w.total),invoiceId:w.invoiceId,entryId:w.entryId}));
 const mk=(period)=>{const m=new Map();for(const r of rows.filter(r=>r.date.startsWith(period)||period==='')){const key=r.side+'|'+r.name+'|'+r.date.slice(0,period.length||7);const a=m.get(key)||{side:r.side,name:r.name,period:r.date.slice(0,period.length||7),baseCents:0,totalCents:0,count:0};a.baseCents+=r.baseCents;a.totalCents+=r.totalCents;a.count++;m.set(key,a)}return [...m.values()]};
 const monthly=mk('');
 const annual=new Map();for(const r of rows){const key=r.side+'|'+r.name+'|'+r.date.slice(0,4);const a=annual.get(key)||{side:r.side,name:r.name,period:r.date.slice(0,4),baseCents:0,totalCents:0,count:0};a.baseCents+=r.baseCents;a.totalCents+=r.totalCents;a.count++;annual.set(key,a)}
 const months=[...new Set(rows.map(r=>r.date.slice(0,7)))].sort();
 const cross=months.map(month=>{
  const suffered=rows.filter(r=>r.date.startsWith(month)&&r.side==='recibida').reduce((n,r)=>n+r.totalCents,0),practiced=rows.filter(r=>r.date.startsWith(month)&&r.side==='practicada').reduce((n,r)=>n+r.totalCents,0);
  const advance=(data.taxes||[]).filter(t=>t.source==='anticipo'&&t.period===month).reduce((n,t)=>n+moneyCents(t.withholdings||0),0);
  const declaration=fiscalRows(data,'retenciones_fiscales').find(r=>r.kind==='declaration'&&r.period===month&&r.status==='Activa');
  return {month,sufferedCents:suffered,practicedCents:practiced,advanceWithheldCents:advance,advanceDifferenceCents:suffered-advance,declaredSufferedCents:declaration?.sufferedCents??null,declaredPracticedCents:declaration?.practicedCents??null,declarationDifferenceCents:declaration?{suffered:suffered-declaration.sufferedCents,practiced:practiced-declaration.practicedCents}:null};
 });
 return {rows,monthly,annual:[...annual.values()],cross};
}
export const CHECKLIST_ITEMS=['conciliaciones','depreciacion','provisiones','revaluacion','iva','retenciones','nomina'];
export const ITEM_STATES=['pendiente','completo','no_aplica'];
export function newChecklist(type,period){
 fiscalCheck(type==='mensual'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||type==='anual'&&/^\d{4}$/.test(period),'Período inválido.');
 return CHECKLIST_ITEMS.map(key=>({key,state:'pendiente',note:'',by:null,at:null}));
}
export const checklistComplete=r=>r.items.length===CHECKLIST_ITEMS.length&&r.items.every(i=>['completo','no_aplica'].includes(i.state));
export function periodMonths(r){return r.periodType==='anual'?Array.from({length:12},(_,i)=>r.period+'-'+String(i+1).padStart(2,'0')):[r.period]}
export function booksReport(data,body,fiscalStatusOf=()=>null){
 const book=BOOKS[body.book];fiscalCheck(book,'Libro inválido.');recurringDay(body.from);recurringDay(body.to);fiscalCheck(body.from<=body.to,'Período inválido.');
 const columns=body.columns?.length?body.columns:BOOK_COLUMNS;fiscalCheck(Array.isArray(columns)&&columns.every(c=>BOOK_COLUMNS.includes(c)),'Columnas inválidas.');
 let source;
 if(body.book==='retenciones')source=(data.withholdings||[]).filter(w=>w.date>=body.from&&w.date<=body.to).map(w=>({date:w.date,reference:w.reference,party:w.name,taxId:'',subtotalCents:moneyCents(w.base),vatCents:0,totalCents:moneyCents(w.total),type:'retención '+w.side,fiscalNumber:'',fiscalStatus:''}));
 else source=(data.entries||[]).filter(e=>book.types.includes(e.type)&&e.date>=body.from&&e.date<=body.to).map(e=>{const party=(e.type.includes('compra')?data.suppliers:data.customers)?.find(p=>p.id===(e.supplierId||e.customerId));const f=fiscalStatusOf(e.id);return {date:e.date,reference:e.reference||'',party:e.party||'',taxId:party?.taxId||party?.ruc||'',subtotalCents:moneyCents(e.subtotal??Math.max(0,e.total-(e.vat||0))),vatCents:moneyCents(e.vat||0),totalCents:moneyCents(e.total),type:e.type,fiscalNumber:f?.number||'',fiscalStatus:f?.fiscalState||''}});
 if(body.signed)source=source.filter(r=>r.fiscalStatus!=='anulado').map(r=>r.type==='nota-credito'||r.type==='nota-credito-compra'?{...r,subtotalCents:-r.subtotalCents,vatCents:-r.vatCents,totalCents:-r.totalCents}:r);
 source.sort((a,b)=>a.date.localeCompare(b.date)||a.reference.localeCompare(b.reference));
 const rows=source.map(r=>Object.fromEntries(columns.map(c=>[c,r[c]])));
 return {book:body.book,label:book.label,columns,rows,totals:{subtotalCents:source.reduce((n,r)=>n+r.subtotalCents,0),vatCents:source.reduce((n,r)=>n+r.vatCents,0),totalCents:source.reduce((n,r)=>n+r.totalCents,0)},notice:FISCAL_NOTICE};
}
// Plantilla de país editable: reutiliza la validación laboral existente y añade IVA, etiquetas y calendario.
export function countryProfile(body){
 fiscalCheck(/^[A-Z]{2}$/.test(body.code||'')&&typeof body.country==='string'&&body.country.trim()&&body.country.length<=80,'Código o nombre de país inválido.');
 const base=countryTemplate({fiscal:body.fiscal,employerRate:body.employerRate,inatecRate:body.inatecRate,bands:body.bands,useProgressiveIR:body.useProgressiveIR,confirmed:true});
 const vatRate=Number(body.vatRate);fiscalCheck(Number.isFinite(vatRate)&&vatRate>=0&&vatRate<=100,'Tasa de IVA inválida.');
 const l=body.labels||{};for(const k of ['taxId','taxName','authority','currency'])fiscalCheck(typeof l[k]==='string'&&l[k].trim()&&l[k].length<=60,'Etiquetas fiscales inválidas.');
 fiscalCheck(Array.isArray(body.calendar)&&body.calendar.length<=40&&body.calendar.every(c=>typeof c.name==='string'&&c.name.trim()&&c.name.length<=120&&Number.isInteger(c.day)&&c.day>=1&&c.day<=31&&['mensual','anual'].includes(c.frequency)&&(c.frequency==='mensual'||Number.isInteger(c.month)&&c.month>=1&&c.month<=12)),'Calendario inválido.');
 return {code:body.code,country:body.country.trim(),vatRate,labels:{taxId:l.taxId,taxName:l.taxName,authority:l.authority,currency:l.currency},fiscal:base.fiscal,employerRate:base.employerRate,inatecRate:base.inatecRate,bands:base.bands,useProgressiveIR:base.useProgressiveIR,calendar:body.calendar.map(c=>({name:c.name.trim(),day:c.day,frequency:c.frequency,...(c.month?{month:c.month}:{})}))};
}
export function validateFiscalRecord(r,check=fiscalCheck){
 check(['configuration','range','document','country','certificate','declaration','period'].includes(r.kind),'Tipo fiscal inválido.');
 check(Array.isArray(r.events),'Conserva el historial de gestión.');
 for(const key of ['totalCents','sufferedCents','practicedCents'])if(r[key]!==undefined&&r[key]!==null)check(Number.isSafeInteger(r[key])&&r[key]>=0,'Importe entero inválido.');
 if(r.kind==='configuration'&&r.validation)validateValidationSettings(r.validation);
 if(r.kind==='range')checkRange(r,null,check);
 if(r.kind==='document')check(Array.isArray(r.history)&&r.history.length>=1&&['borrador','emitido','aceptado','rechazado','anulado'].includes(r.fiscalState),'Historial fiscal inválido.');
 if(r.kind==='period')check(Array.isArray(r.items)&&r.items.length===CHECKLIST_ITEMS.length&&r.items.every(i=>ITEM_STATES.includes(i.state)),'Checklist inválido.');
}
