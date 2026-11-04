import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manualDgiProvider,fiscalProvider,fiscalTransition,NON_FISCAL_MARK} from '../netlify/lib/fiscal-provider.mjs';
import {maskMatches,validateIssue,rangeUsage,fiscalIssueGuard,fiscalConfig,withholdingSummary,newChecklist,checklistComplete,booksReport,countryProfile,validateFiscalRecord,validateValidationSettings,checkRange} from '../netlify/lib/fiscal-rules.mjs';
import {fiscalOperation,fiscalReport,FISCAL_OPS,fiscalModule} from '../netlify/lib/fiscal-compliance.mjs';
import {managuaDay} from '../netlify/lib/billing-rules.mjs';
import {countryTemplate} from '../netlify/lib/country.mjs';
const config=(extra={})=>({id:'cfg',module:'cumplimiento_fiscal',kind:'configuration',status:'Activa',events:[],validation:{requireTaxId:true,taxIdThresholdCents:10000,requiredFields:['customerName'],numberMask:'AAA-999',warnAt:2},validateOnIssue:true,enforceRanges:false,...extra});
const range=(extra={})=>({id:'r1',module:'cumplimiento_fiscal',kind:'range',status:'Activa',series:'A',branchId:'principal',from:1,to:10,warnAt:2,events:[],...extra});
const sale=n=>({id:'s'+n,type:'venta',series:'A',sequence:n,branchId:'principal',date:'2026-10-05',reference:'A-'+n,party:'Cliente',total:115,subtotal:100,vat:15,customerId:'c',lines:[]});
const base=(rows=[],entries=[])=>({businessRecords:rows,entries,customers:[{id:'c',name:'Cliente',taxId:'J0001'}],suppliers:[],withholdings:[],taxes:[],cfg:{periodLocks:{}}});
const ctx={permit(){}};
const access=(o={})=>({owner:true,branchId:'principal',company:{name:'Demo'},...o});
const session={email:'dueno@example.com'};
const body=(operation,extra={})=>({operation,date:managuaDay(),reason:'Motivo de prueba',confirmed:true,...extra});

test('el proveedor manual DGI marca DOCUMENTO NO FISCAL sin número o fecha y no hace llamadas externas',()=>{
 assert.equal(manualDgiProvider.external,false);
 const p=manualDgiProvider.prepare({number:'',fiscalDate:''});assert.equal(p.nonFiscal,true);assert.equal(p.marker,NON_FISCAL_MARK);
 assert.equal(manualDgiProvider.prepare({number:'ABC-123',fiscalDate:'2026-10-05'}).nonFiscal,false);
 assert.throws(()=>manualDgiProvider.submit({nonFiscal:true}));assert.throws(()=>manualDgiProvider.prepare({number:'1',fiscalDate:'05/10/2026'}));
 assert.throws(()=>fiscalProvider('externo'));assert.equal(fiscalProvider().id,'manual_dgi');
 assert.throws(()=>manualDgiProvider.cancel({},''));
});
test('los estados fiscales solo avanzan por transiciones permitidas',()=>{
 assert.equal(fiscalTransition('borrador','emitido'),'emitido');assert.equal(fiscalTransition('emitido','aceptado'),'aceptado');
 assert.throws(()=>fiscalTransition('borrador','aceptado'));assert.throws(()=>fiscalTransition('anulado','borrador'));assert.equal(fiscalTransition('rechazado','borrador'),'borrador');
});
test('formato de numeración por máscara sin expresiones regulares del usuario',()=>{
 assert.ok(maskMatches('AAA-999','FAC-123'));assert.ok(!maskMatches('AAA-999','FAC-12'));assert.ok(!maskMatches('AAA-999','fac-123'));assert.ok(maskMatches('','cualquier'));assert.throws(()=>maskMatches('x'.repeat(41),'a'));
});
test('validaciones previas: RUC sobre un monto, campos requeridos y formato',()=>{
 const v=config().validation;
 assert.deepEqual(validateIssue(v,{totalCents:9999,customerName:'A',customerTaxId:''}),[]);
 assert.equal(validateIssue(v,{totalCents:10000,customerName:'A',customerTaxId:''}).length,1);
 assert.equal(validateIssue(v,{totalCents:1,customerName:'',customerTaxId:'J'}).length,1);
 assert.equal(validateIssue(v,{totalCents:1,customerName:'A',customerTaxId:'J',fiscalNumber:'mal'}).length,1);
 assert.throws(()=>validateValidationSettings({...v,taxIdThresholdCents:1.5}));assert.throws(()=>validateValidationSettings({...v,requiredFields:['otro']}));
});
test('rangos: uso, agotamiento y auditoría de saltos',()=>{
 const d=base([range()],[sale(1),sale(2),sale(5)]);
 const u=rangeUsage(d,d.businessRecords[0]);assert.equal(u.last,5);assert.deepEqual(u.gaps,[3,4]);assert.equal(u.remaining,5);assert.equal(u.state,'vigente');
 const near=rangeUsage(base([],[sale(8)]),range());assert.equal(near.state,'por_agotarse');
 assert.equal(rangeUsage(base([],[sale(10)]),range()).state,'agotado');
 assert.throws(()=>checkRange(range({from:5,to:4})));assert.throws(()=>checkRange(range({from:0})));
 assert.throws(()=>checkRange(range({id:'r2'}),base([range()])));
});
test('la guardia de emisión no actúa sin módulo activo ni interruptor, y no cambia datos',()=>{
 const ctxSale={series:'A',sequence:50,branchId:'principal',totalCents:10,customer:{name:'C'}};
 assert.equal(fiscalIssueGuard(base(),ctxSale),null);
 assert.equal(fiscalIssueGuard(base([config({status:'Inactiva'})]),ctxSale),null);
 const d=base([config({validateOnIssue:false})]);const before=structuredClone(d);assert.deepEqual(fiscalIssueGuard(d,ctxSale),{warnings:[]});assert.deepEqual(d,before);
});
test('el interruptor de numeración bloquea fuera de rango y avisa agotamiento',()=>{
 const d=base([config({validateOnIssue:false,enforceRanges:true}),range()]);
 const sale1=n=>({series:'A',sequence:n,branchId:'principal',totalCents:1,customer:null});
 assert.throws(()=>fiscalIssueGuard(d,sale1(11)),/fuera del rango/);
 assert.throws(()=>fiscalIssueGuard(d,{...sale1(1),series:'B'}),/rango fiscal autorizado/);
 assert.throws(()=>fiscalIssueGuard(d,{...sale1(1),branchId:'otra'}),/rango fiscal autorizado/);
 assert.deepEqual(fiscalIssueGuard(d,sale1(1)).warnings,[]);assert.equal(fiscalIssueGuard(d,sale1(9)).warnings.length,1);
});
test('validación previa bloquea ventas sobre el monto sin RUC cuando está activada',()=>{
 const d=base([config()]);
 assert.throws(()=>fiscalIssueGuard(d,{series:'A',sequence:1,branchId:'principal',totalCents:20000,customer:{name:'C'}}),/RUC/);
 assert.deepEqual(fiscalIssueGuard(d,{series:'A',sequence:1,branchId:'principal',totalCents:20000,customer:{name:'C',taxId:'J1'}}),{warnings:[]});
});
test('retenciones: acumulados por tercero y cruce con anticipo y declaración en centavos',()=>{
 const d=base([{id:'dec',module:'retenciones_fiscales',kind:'declaration',status:'Activa',period:'2026-10',sufferedCents:1500,practicedCents:0,events:[]}]);
 d.withholdings=[{id:'w1',date:'2026-10-03',name:'Cliente A',side:'recibida',reference:'R1',base:1000,rate:2,total:20.1},{id:'w2',date:'2026-10-20',name:'Cliente A',side:'recibida',reference:'R2',base:500,rate:2,total:10},{id:'w3',date:'2026-11-02',name:'Proveedor',side:'practicada',reference:'R3',base:100,rate:10,total:10}];
 d.taxes=[{source:'anticipo',period:'2026-10',withholdings:30.1}];
 const s=withholdingSummary(d,'2026-10-01','2026-11-30');
 assert.equal(s.rows[0].totalCents,2010);assert.equal(s.annual.find(a=>a.name==='Cliente A').totalCents,3010);
 const oct=s.cross.find(c=>c.month==='2026-10');assert.equal(oct.sufferedCents,3010);assert.equal(oct.advanceWithheldCents,3010);assert.equal(oct.advanceDifferenceCents,0);assert.equal(oct.declarationDifferenceCents.suffered,1510);
 assert.equal(s.cross.find(c=>c.month==='2026-11').declaredSufferedCents,null);
 assert.throws(()=>withholdingSummary(d,'2026-12-01','2026-11-01'));
});
test('checklist mensual y anual con los siete ítems',()=>{
 const items=newChecklist('mensual','2026-10');assert.equal(items.length,7);assert.ok(!checklistComplete({items}));
 assert.ok(checklistComplete({items:items.map((i,n)=>({...i,state:n%2?'completo':'no_aplica'}))}));
 assert.equal(newChecklist('anual','2026').length,7);assert.throws(()=>newChecklist('mensual','2026-13'));assert.throws(()=>newChecklist('anual','26'));
});
test('libros de trabajo: columnas configurables, centavos enteros y aviso no oficial',()=>{
 const d=base([],[sale(1),{...sale(2),type:'nota-credito',date:'2026-10-09'}]);
 const r=booksReport(d,{book:'ventas',from:'2026-10-01',to:'2026-10-31',columns:['date','reference','totalCents']},id=>id==='s1'?{number:'F-1',fiscalState:'emitido'}:null);
 assert.deepEqual(r.columns,['date','reference','totalCents']);assert.equal(r.rows.length,2);assert.equal(r.totals.totalCents,23000);assert.ok(Number.isInteger(r.totals.vatCents));assert.match(r.notice,/no es un formato oficial/);
 assert.throws(()=>booksReport(d,{book:'otro',from:'2026-10-01',to:'2026-10-31'}));assert.throws(()=>booksReport(d,{book:'ventas',from:'2026-10-01',to:'2026-10-31',columns:['secreto']}));
});
test('la plantilla de Nicaragua conserva los valores anteriores y las plantillas son editables',()=>{
 const ni=globalThis.AcontecCountryTemplates.get('NI');
 assert.deepEqual(ni.fiscal,{socialRate:7,daysPerMonth:30,workingHours:8,overtimeFactor:2,bonusDays:30,vacationDays:30,dismissalDays:30,resignationDays:0,premiumDays:0});
 assert.equal(ni.employerRate,21.5);assert.equal(ni.inatecRate,2);assert.equal(ni.vatRate,15);assert.deepEqual(ni.bands.map(b=>b.rate),[0,15,20,25,30]);assert.equal(ni.bands.at(-1).limit,null);
 const legacy=countryTemplate({fiscal:ni.fiscal,employerRate:ni.employerRate,inatecRate:ni.inatecRate,bands:ni.bands,useProgressiveIR:false,confirmed:true});assert.equal(legacy.country,'Nicaragua');
 const other=countryProfile({...ni,code:'XX',country:'Otro',vatRate:12,calendar:[{name:'IVA',day:15,frequency:'mensual'}]});assert.equal(other.vatRate,12);assert.equal(other.calendar.length,1);
 assert.throws(()=>countryProfile({...ni,code:'XX',country:'Otro',vatRate:120}));assert.throws(()=>countryProfile({...ni,code:'x',country:'Otro'}));
 assert.notEqual(globalThis.AcontecCountryTemplates.get('NI'),globalThis.AcontecCountryTemplates.get('NI'));
});
test('operaciones: activación solo del dueño hoy, todo apagado por defecto',async()=>{
 const d=base();
 await assert.rejects(()=>fiscalOperation(d,access({owner:false}),session,body('fiscalEnable',{module:'cumplimiento_fiscal',enabled:true}),ctx),/dueño/);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalEnable',{module:'cumplimiento_fiscal',enabled:true,date:'2020-01-01'}),ctx),/hoy/);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalEnable',{module:'cumplimiento_fiscal',enabled:true,confirmed:false}),ctx),/confirma/i);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalRange',{series:'A',from:1,to:5}),ctx),/activar/);
 await fiscalOperation(d,access(),session,body('fiscalEnable',{module:'cumplimiento_fiscal',enabled:true}),ctx);
 const c=fiscalConfig(d);assert.equal(c.status,'Activa');assert.equal(c.enforceRanges,false);assert.equal(c.validateOnIssue,false);assert.equal(c.provider,'manual_dgi');
});
test('rango, documento fiscal con historial y anulación sin tocar la contabilidad',async()=>{
 const d=base([],[sale(1)]);await fiscalOperation(d,access(),session,body('fiscalEnable',{module:'cumplimiento_fiscal',enabled:true}),ctx);
 const entries=structuredClone(d.entries);
 await fiscalOperation(d,access(),session,body('fiscalRange',{series:'A',from:1,to:100}),ctx);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalRange',{series:'A',from:50,to:150}),ctx),/traslapa/);
 const id=await fiscalOperation(d,access(),session,body('fiscalPrepare',{entryId:'s1'}),ctx);
 let doc=d.businessRecords.find(r=>r.id===id);assert.equal(doc.nonFiscal,true);assert.equal(doc.fiscalState,'borrador');
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalPrepare',{entryId:'s1'}),ctx),/vigente/);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalTransition',{id,to:'emitido'}),ctx));
 await fiscalOperation(d,access(),session,body('fiscalTransition',{id,to:'emitido',number:'F-1',fiscalDate:'2026-10-05'}),ctx);
 await fiscalOperation(d,access(),session,body('fiscalTransition',{id,to:'aceptado'}),ctx);
 await fiscalOperation(d,access(),session,body('fiscalTransition',{id,to:'anulado',reason:'Error de captura'}),ctx);
 doc=d.businessRecords.find(r=>r.id===id);assert.deepEqual(doc.history.map(h=>h.state),['borrador','emitido','aceptado','anulado']);assert.equal(doc.number,'F-1');
 assert.deepEqual(d.entries,entries);validateFiscalRecord(doc);
});
test('checklist cierra solo con todos los ítems y bloquea el período solo si el dueño activó el interruptor',async()=>{
 const run=async lock=>{
  const d=base();await fiscalOperation(d,access(),session,body('fiscalEnable',{module:'cierre_periodo',enabled:true}),ctx);
  if(lock)await fiscalOperation(d,access(),session,body('fiscalLockSwitch',{enabled:true}),ctx);
  const id=await fiscalOperation(d,access(),session,body('fiscalPeriodOpen',{periodType:'mensual',period:'2025-01'}),ctx);
  await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalPeriodClose',{id}),ctx),/Completa/);
  for(const key of ['conciliaciones','depreciacion','provisiones','revaluacion','iva','retenciones','nomina'])await fiscalOperation(d,access(),session,body('fiscalPeriodItem',{id,key,state:'completo'}),ctx);
  await fiscalOperation(d,access(),session,body('fiscalPeriodClose',{id}),ctx);return d;
 };
 assert.deepEqual((await run(false)).cfg.periodLocks,{});
 const locked=await run(true);assert.equal(locked.cfg.periodLocks['principal:2025-01'].closed,true);
 await assert.rejects(()=>fiscalOperation(base(),access({owner:false}),session,body('fiscalLockSwitch',{enabled:true}),ctx));
});
test('constancia y declaración manual; informes respetan permisos y no exponen datos sin lectura fiscal',async()=>{
 const d=base();d.withholdings=[{id:'w1',date:'2026-10-03',name:'Cliente A',side:'recibida',reference:'R1',base:1000,rate:2,total:20}];
 await fiscalOperation(d,access(),session,body('fiscalEnable',{module:'retenciones_fiscales',enabled:true}),ctx);
 const id=await fiscalOperation(d,access(),session,body('fiscalCertificate',{withholdingId:'w1',number:'C-1',issuedOn:'2026-10-04'}),ctx);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalCertificate',{withholdingId:'w1',number:'C-2',issuedOn:'2026-10-04'}),ctx),/vigente/);
 assert.equal(d.businessRecords.find(r=>r.id===id).totalCents,2000);
 await assert.rejects(()=>fiscalOperation(d,access(),session,body('fiscalDeclaration',{period:'2026-10',sufferedCents:10.5,practicedCents:0}),ctx));
 await fiscalOperation(d,access(),session,body('fiscalDeclaration',{period:'2026-10',sufferedCents:2000,practicedCents:0}),ctx);
 assert.throws(()=>fiscalReport(d,{module:'retenciones_fiscales',from:'2026-10-01',to:'2026-10-31'},()=>false),/permiso/);
 const r=fiscalReport(d,{module:'retenciones_fiscales',from:'2026-10-01',to:'2026-10-31'},()=>true);assert.equal(r.summary.cross[0].declarationDifferenceCents.suffered,0);assert.match(r.notice,/Verifica con tu contador/);
});
test('todas las operaciones se asignan a un módulo fiscal y exigen idempotencia en el enrutador',()=>{
 for(const op of FISCAL_OPS)assert.ok(['cumplimiento_fiscal','retenciones_fiscales','cierre_periodo'].includes(fiscalModule({operation:op,module:'cierre_periodo'})),op);
 const source=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 assert.match(source,/FISCAL_OPS\.includes\(body\.operation\)\|\|/);assert.match(source,/fiscalIssueGuard\(access\.company\.data/);assert.match(source,/'Descarga fiscal '/);
});
test('el frontend usa uiT, no modifica style.css y no guarda tokens en localStorage',()=>{
 const ui=readFileSync(new URL('../public/fiscal.js',import.meta.url),'utf8');
 assert.match(ui,/uiT\('fiscal\.'/);assert.doesNotMatch(ui,/localStorage|#[0-9a-fA-F]{3,6}\b|style\.css/);
 const country=readFileSync(new URL('../public/country.js',import.meta.url),'utf8');assert.match(country,/AcontecCountryTemplates\.get\('NI'\)/);
});
