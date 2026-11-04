import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {treasuryForecast,treasuryIndirect,treasuryDebt,treasuryRateRows,invoiceLinkedEntries,moneyCents,customerCreditBalance,aging} from '../public/accounting-math.mjs';
import {treasuryOperation,treasuryReport,treasuryForecastReport,revaluationPreview,guardTreasury,validateTreasuryRecord,TREASURY_MODULES} from '../netlify/lib/treasury.mjs';
import {officialRatesPreview,BCN_RATE_ENDPOINT} from '../netlify/lib/treasury-rates.mjs';
import {normalizeDocument,restoreDocument,documentHash} from '../netlify/lib/accounting-codec.mjs';
import {guardBankReconciliations} from '../netlify/lib/banks.mjs';
import {validateBusinessRecords} from '../netlify/lib/business.mjs';
import {moduleIncluded,DEFAULT_PLANS,BLOCKABLE_MODULES} from '../netlify/lib/billing-rules.mjs';
const check=(ok,m)=>{if(!ok)throw new Error(m)};
function fixture(){
 const data={cfg:{cur:'NIO',treasuryControls:Object.fromEntries(TREASURY_MODULES.map(m=>[m,{enabled:true,since:'2026-11-01',events:[]}]))},products:[],customers:[{id:'c1',name:'Cliente Norte',status:'activo'}],suppliers:[{id:'s1',name:'Proveedor Sur',status:'activo'}],accounts:[['1101','activo','ef'],['1102','activo','ef'],['1201','activo',''],['2101','pasivo',''],['1301','activo',''],['3101','patrimonio',''],['4101','ingreso','']],entries:[{id:'opening',date:'2026-11-01',type:'apertura',lines:[{a:'1102',d:1000,c:0},{a:'3101',d:0,c:1000}]}],businessRecords:[],pettyFunds:[],pettyVouchers:[],foreignDocuments:[],exchangeRates:[]};
 data.accounts=data.accounts.map(([code,tipo,sub])=>({code,name:code,tipo,sub,nat:tipo==='pasivo'?'C':'D'}));
 const access={owner:true,branchId:'principal',company:{ownerEmail:'owner@example.test',data}},session={email:'owner@example.test'},ctx={today:()=> '2026-12-01',permit(a,m){check(m&&!a.support&&!a.readOnlyLimit&&!a.denied?.includes(m),'Sin permiso '+m)},financialCash(a){check(!a.noCash,'Sin permiso caja')},members:[{id:'approver'},{id:'preparer'}],entry(d,s,e){check(moneyCents(e.lines.reduce((n,l)=>n+l.d,0))===moneyCents(e.lines.reduce((n,l)=>n+l.c,0)),'Asiento descuadrado');const r={id:randomUUID(),managed:true,...e};d.entries.push(r);return r}};
 const op=(operation,body={})=>treasuryOperation(data,access,session,{operation,date:'2026-11-04',confirmed:true,reason:'Confirmación documentada',operationId:randomUUID(),...body},ctx);
 const invoice=(id='i1',total=200,side='pay')=>{const receive=side==='receive',e={id,type:receive?'venta':'compra',date:'2026-11-02',due:'2026-11-20',reference:id,party:receive?'Cliente Norte':'Proveedor Sur',...(receive?{customerId:'c1'}:{supplierId:'s1'}),pay:receive?'1201':'2101',total,lines:receive?[{a:'1201',d:total,c:0},{a:'4101',d:0,c:total}]:[{a:'1301',d:total,c:0},{a:'2101',d:0,c:total}]};data.entries.push(e);return e};
 const policy=(thresholdCents=10000)=>op('batchPolicy',{thresholdCents,preparers:[session.email],approvers:['approver']});
 return {data,access,session,ctx,op,invoice,policy};
}
const forecastInput={from:'2026-11-01',to:'2026-12-31',openingCents:1000,frequency:'week',events:[{date:'2026-11-02',amountCents:-1200},{date:'2026-11-03',amountCents:800}]};
test('F2.3 escenarios semanales y mensuales conservan supuestos y primer faltante diario',()=>{
 const result=treasuryForecast(forecastInput);assert.equal(result.length,3);for(const s of result){assert.equal(s.firstShortfall,'2026-11-02');assert.equal(s.liquidity,'rojo');assert.ok(s.buckets.length>0)}
 const monthly=treasuryForecast({...forecastInput,frequency:'month',scenarios:{base:{delayDays:0,badDebtBps:5000}}});assert.equal(monthly[1].balanceCents,200);assert.equal(monthly[1].assumption.badDebtBps,5000);assert.equal(monthly[1].buckets.length,2);
 assert.throws(()=>treasuryForecast({...forecastInput,scenarios:{base:{delayDays:-1}}}));assert.throws(()=>treasuryForecast({...forecastInput,openingCents:1.1}));assert.throws(()=>treasuryForecast({...forecastInput,to:'2030-01-01'}));
});
test('F2.3 semáforo distingue reserva y ausencia de faltantes; cuotas atrasadas no desaparecen',()=>{
 const input={...forecastInput,events:[],reserveCents:1500};assert.equal(treasuryForecast(input)[0].liquidity,'amarillo');assert.equal(treasuryForecast({...input,reserveCents:0})[0].liquidity,'verde');assert.equal(treasuryForecast({...input,events:[{date:'2026-10-01',amountCents:-2000}]})[0].firstShortfall,input.from);
});
test('F2.3 fuentes y moneda original no mutan la empresa ni duplican documentos',()=>{
 const {data,invoice}=fixture();invoice('receive',300,'receive');invoice();data.taxes=[{id:'tax',due:'2026-11-15',amount:10,paid:2}];data.payrolls=[{id:'payroll',to:'2026-11-20',net:50,status:'Borrador'}];data.loans=[{id:'loan',date:'2026-10-15',schedule:[{number:1,total:25}]}];data.recurringEntries=[{id:'template',active:true,postedMonths:[],lines:[{a:'1102',d:0,c:5},{a:'2101',d:5,c:0}]}];data.foreignDocuments=[{id:'fx',date:'2026-11-01',currency:'USD',side:'receive',foreignAmount:10,baseTotal:366,settled:false}];const before=structuredClone(data),report=treasuryForecastReport(data,{from:'2026-11-04',to:'2026-12-31'});
 for(const source of ['cobrar','pagar','impuestos','nomina','prestamos','plantillas','divisas'])assert.ok(report.events.some(e=>e.source===source),source);assert.equal(report.original[0].currency,'USD');assert.deepEqual(data,before);
});
test('F2.3 indirecto conserva ajustes no monetarios y expone diferencia de un asiento descuadrado',()=>{
 const {data,invoice}=fixture();invoice('sale',20,'receive');let r=treasuryIndirect(data,'2026-11-01','2026-11-30');assert.equal(r.profitCents,2000);assert.equal(r.directCents,0);assert.equal(r.indirectCents,0);data.entries.push({id:'broken',date:'2026-11-03',lines:[{a:'1102',d:1,c:0}]});r=treasuryIndirect(data,'2026-11-01','2026-11-30');assert.equal(r.differenceCents,100);assert.match(r.explanation,/Diferencia/);
});
test('F2.4 umbral, separación de personas, asiento único y bloqueo del segundo pago',()=>{
 const f=fixture(),i=f.invoice();f.policy();const id=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:i.id,amountCents:10000}]});assert.throws(()=>f.op('batchPay',{id}),/aprobación/);assert.throws(()=>f.op('batchApprove',{id}),/otra persona/);f.access.owner=false;f.access.member={id:'approver'};f.op('batchApprove',{id});f.op('batchPay',{id});assert.equal(f.data.entries.filter(e=>e.treasuryId===id).length,1);assert.equal(treasuryDebt(f.data.entries,i),10000);assert.equal(aging(f.data.entries,'2101','2026-11-30').rows[0].balance,100);assert.throws(()=>f.op('batchPay',{id}));validateBusinessRecords(f.data,check);
});
test('F2.4 varias facturas, rechazo, descuento documentado y reversa única',()=>{
 const f=fixture(),a=f.invoice('a',30),b=f.invoice('b',50);a.earlyPaymentDiscount={until:'2026-11-10',amountCents:100};f.policy(999999);
 const id=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:a.id,amountCents:2900,discountCents:100},{invoiceId:b.id,amountCents:5000}]});f.op('batchPay',{id});assert.equal(treasuryDebt(f.data.entries,a),0);assert.equal(treasuryDebt(f.data.entries,b),0);f.op('batchReverse',{id,date:'2026-11-05'});assert.equal(treasuryDebt(f.data.entries,a),3000);assert.equal(treasuryDebt(f.data.entries,b),5000);assert.throws(()=>f.op('batchReverse',{id,date:'2026-11-06'}));
 const rejected=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:a.id,amountCents:100}]});f.op('batchReject',{id:rejected});assert.throws(()=>f.op('batchPay',{id:rejected}));
});
test('F2.4 factura ya pagada entre preparación y ejecución no se paga dos veces',()=>{
 const f=fixture(),i=f.invoice();f.policy(999999);const body={account:'1102',allocations:[{invoiceId:i.id,amountCents:20000}]},a=f.op('batchPrepare',body),b=f.op('batchPrepare',body);f.op('batchPay',{id:a});assert.throws(()=>f.op('batchPay',{id:b}),/ya fue pagada/);
});
test('F2.4 rechaza duplicados, importes fraccionarios, sobregiro y descuento inventado',()=>{
 const f=fixture(),i=f.invoice();f.policy(999999);for(const allocations of [[{invoiceId:i.id,amountCents:10.5}],[{invoiceId:i.id,amountCents:1},{invoiceId:i.id,amountCents:1}],[{invoiceId:i.id,amountCents:100,discountCents:1}]])assert.throws(()=>f.op('batchPrepare',{account:'1102',allocations}));const id=f.op('batchPrepare',{account:'1101',allocations:[{invoiceId:i.id,amountCents:100}]});assert.throws(()=>f.op('batchPay',{id}),/negativo/);
});
test('F2.4 banco de otra moneda requiere su operación original; caja chica valida responsable y límite',()=>{
 const f=fixture(),i=f.invoice();f.policy(999999);f.data.accounts.push({code:'1190',tipo:'activo'});f.data.businessRecords.push({id:'bank',module:'bancos',kind:'bank',account:'1190',currency:'USD',branchId:'principal'});assert.throws(()=>f.op('batchPrepare',{account:'1190',allocations:[{invoiceId:i.id,amountCents:100}]}));
 f.data.pettyFunds.push({id:'fund',account:'1103-fund',responsible:'other',fixedAmount:10,limit:1,date:'2026-11-01'});f.access.owner=false;f.access.member={id:'other-preparer'};f.data.cfg.treasuryControls.pagos_lote.policy.preparers.push('other-preparer');assert.throws(()=>f.op('batchPrepare',{account:'1103-fund',allocations:[{invoiceId:i.id,amountCents:100}]}),/permiso/);
});
test('F2.5 anticipo cliente es pasivo, se aplica parcialmente a varias facturas y se devuelve saldo',()=>{
 const f=fixture(),a=f.invoice('a',20,'receive'),b=f.invoice('b',30,'receive'),id=f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:6000,account:'1102'}),r=f.data.businessRecords.find(r=>r.id===id);assert.equal(r.account,'2108');assert.equal(f.data.entries.at(-1).lines.find(l=>l.a==='2108').c,60);
 f.op('advanceApply',{id,allocations:[{invoiceId:a.id,amountCents:2000},{invoiceId:b.id,amountCents:1000}]});assert.equal(r.remainingCents,3000);assert.equal(treasuryDebt(f.data.entries,a),0);assert.equal(treasuryDebt(f.data.entries,b),2000);assert.equal(customerCreditBalance('c1',f.data.entries),20);
 f.op('advanceRefund',{id,amountCents:3000,account:'1102'});assert.equal(r.remainingCents,0);assert.throws(()=>f.op('advanceApply',{id,allocations:[{invoiceId:b.id,amountCents:1}]}));validateBusinessRecords(f.data,check);
});
test('F2.5 anticipo proveedor es activo, no se aplica a otro tercero ni por encima del saldo',()=>{
 const f=fixture(),i=f.invoice(),id=f.op('advanceCreate',{side:'supplier',partyId:'s1',amountCents:5000,account:'1102'}),r=f.data.businessRecords.find(r=>r.id===id);assert.equal(r.account,'1205');assert.equal(f.data.entries.at(-1).lines.find(l=>l.a==='1205').d,50);assert.throws(()=>f.op('advanceApply',{id,allocations:[{invoiceId:i.id,amountCents:5001}]}));i.supplierId='different';assert.throws(()=>f.op('advanceApply',{id,allocations:[{invoiceId:i.id,amountCents:1}]}));i.supplierId='s1';f.op('advanceApply',{id,allocations:[{invoiceId:i.id,amountCents:2000}]});f.op('advanceRefund',{id,amountCents:3000,account:'1102'});assert.equal(r.remainingCents,0);
});
test('F2.5 depósitos vinculados conservan ficha original y no crean anticipos duplicados',()=>{
 for(const module of ['contratos','reservas','suscripciones']){const f=fixture(),i=f.invoice('bill',10,'receive');f.data.accounts.push({code:'2190',tipo:'pasivo'});const r={id:'source',module,kind:'source',name:'Origen',date:'2026-11-01',branchId:'principal',customerId:'c1',deposit:20,depositAccount:'2190',liability:'2190',events:[]};f.data.businessRecords.push(r);f.op('advanceApply',{businessId:r.id,allocations:[{invoiceId:i.id,amountCents:500}]});assert.equal(r.deposit,15);assert.equal(f.data.businessRecords.length,1);assert.equal(f.data.entries.at(-1).businessId,r.id);assert.throws(()=>f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:100,account:'1102',businessId:r.id}));}
});
function foreignFixture(){const f=fixture();f.data.accounts.push({code:'1190',name:'Banco USD',tipo:'activo',nat:'D',sub:'ef'});f.data.entries.push({id:'bank-open',date:'2026-10-31',type:'apertura',branchId:'principal',lines:[{a:'1190',d:360,c:0},{a:'3101',d:0,c:360}]});f.data.businessRecords.push({id:'bank-usd',module:'bancos',kind:'bank',name:'Banco USD',date:'2026-11-01',status:'Abierta',branchId:'principal',currency:'USD',account:'1190',masked:'•••• 1234',card:false,openingCents:1000,baseOpeningCents:36000,rateMicros:36000000,rateDate:'2026-11-01',rateSource:'Apertura confirmada',events:[]});f.data.exchangeRates.push({id:'USD-2026-11-30',date:'2026-11-30',currency:'USD',rate:37,rateMicros:37000000,source:'Fuente de cierre'});return f}
test('F2.6 cierre mensual, vista previa, ajuste sin movimiento original y reversa única',()=>{
 const f=foreignFixture(),before=structuredClone(f.data),preview=revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01');assert.equal(preview.items[0].differenceCents,1000);assert.deepEqual(f.data,before);assert.throws(()=>f.op('revaluePost',{date:'2026-11-30',previewToken:'old'}),/vista previa/);const id=f.op('revaluePost',{date:'2026-11-30',previewToken:preview.token});guardBankReconciliations(before,f.data,check);guardTreasury(before,f.data,check,'Operación: revaluePost');validateBusinessRecords(f.data,check);assert.equal(f.data.businessRecords.filter(r=>r.kind==='movement').length,0);assert.throws(()=>revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01'),/ya fue/);assert.throws(()=>f.op('revalueReverse',{id,date:'2026-12-02'}));f.op('revalueReverse',{id,date:'2026-12-01'});assert.throws(()=>f.op('revalueReverse',{id,date:'2026-12-01'}));assert.equal(f.data.entries.at(-1).lines.find(l=>l.a==='1190').c,10);
});
test('F2.6 no revaloriza históricos, meses abiertos incompletos o bloqueados ni sin tasa de cierre',()=>{
 const f=foreignFixture();assert.throws(()=>revaluationPreview(f.data,{date:'2026-11-29'},'principal','2026-12-01')); f.data.cfg.periodLocks={'principal:2026-11':{closed:true}};assert.throws(()=>revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01'),/cerrado/);delete f.data.cfg.periodLocks;f.data.cfg.treasuryControls.revalorizacion.since='2026-12-01';assert.throws(()=>revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01')); f.data.cfg.treasuryControls.revalorizacion.since='2026-11-01';f.data.exchangeRates=[];assert.throws(()=>revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01'),/tasa/);
});
test('F2.6 incluye cuentas por cobrar y pagar originales; no infiere monedas de facturas históricas',()=>{
 const f=foreignFixture();f.data.foreignDocuments=[{id:'receivable',date:'2026-11-01',currency:'USD',side:'receive',foreignAmount:2,baseTotal:72,settled:false},{id:'payable',date:'2026-11-01',currency:'USD',side:'pay',foreignAmount:3,baseTotal:108,settled:false}];f.invoice('historical');const p=revaluationPreview(f.data,{date:'2026-11-30'},'principal','2026-12-01');assert.deepEqual(p.items.map(i=>i.differenceCents),[1000,200,-300]);
});
test('F2.7 tasas rechazan fechas falsas, cero, duplicados, moneda base y fuente ausente',()=>{
 const good=['2026-11-03','USD','36.6243','Referencia documentada'];assert.equal(treasuryRateRows([good])[0].rateMicros,36624300);for(const row of [['2026-02-30',...good.slice(1)],[good[0],'USD','0',good[3]],[good[0],'NIO','1',good[3]],[...good.slice(0,3),'']])assert.throws(()=>treasuryRateRows([row]));assert.throws(()=>treasuryRateRows([good,good]));assert.throws(()=>treasuryRateRows([good],[{date:good[0],currency:'USD'}]));
});
test('F2.7 importación guarda fuente y fecha, rechaza repetición y no modifica operaciones',()=>{
 const f=fixture();const before=structuredClone(f.data.entries),grid=[['2026-11-03','USD','36.6243','Documento revisado']];f.op('ratesImport',{grid});assert.deepEqual(f.data.entries,before);assert.equal(f.data.exchangeRates[0].rateDate,'2026-11-03');assert.equal(f.data.exchangeRates[0].source,'Documento revisado');assert.throws(()=>f.op('ratesImport',{grid}));assert.throws(()=>f.op('ratesImport',{grid:[['2026-12-01','USD','37','Fuente']]}));
});
test('F2.7 adaptador apagado y sin configuración no llama a la red',async()=>{
 const previous=globalThis.Netlify;globalThis.Netlify={env:{get:()=>undefined}};try{const f=fixture();let calls=0;const request=async()=>{calls++;throw new Error('No red')};let r=await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},request);assert.equal(r.available,false);f.data.cfg.treasuryControls.tipos_cambio.sourceEnabled=true;r=await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},request);assert.equal(r.available,false);assert.equal(calls,0);}finally{globalThis.Netlify=previous}
});
test('F2.7 adaptador valida respuesta oficial y tolera fallos sin guardar',async()=>{
 const previous=globalThis.Netlify;globalThis.Netlify={env:{get:k=>k==='BCN_RATES_ENABLED'?'true':undefined}};
 try{const f=fixture();f.data.cfg.treasuryControls.tipos_cambio.sourceEnabled=true;const before=structuredClone(f.data);let calledUrl;const response=await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},async(url,options)=>{calledUrl=url;assert.equal(options.redirect,'error');assert.match(options.body,/<Ano>2026<\/Ano>/);return new Response('<RecuperaTC_DiaResult>36.6243</RecuperaTC_DiaResult>')});assert.equal(calledUrl,BCN_RATE_ENDPOINT);assert.equal(response.available,true);assert.equal(response.rates[0].rateMicros,36624300);assert.deepEqual(f.data,before);
 for(const request of [async()=>{throw new Error('offline')},async()=>new Response('bad',{status:503}),async()=>new Response('<!DOCTYPE x><RecuperaTC_DiaResult>36</RecuperaTC_DiaResult>'),async()=>new Response('<RecuperaTC_DiaResult>0</RecuperaTC_DiaResult>')])assert.equal((await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},request)).available,false);
 }finally{globalThis.Netlify=previous}
});
test('controles nuevos apagados, dueño, sucursal, permisos y solo lectura',()=>{
 for(const module of TREASURY_MODULES){const f=fixture();delete f.data.cfg.treasuryControls[module];assert.throws(()=>f.op('treasuryEnable',{module,enabled:true,confirmed:false}));f.access.owner=false;assert.throws(()=>f.op('treasuryEnable',{module,enabled:true}));}
 for(const overrides of [{branchId:null},{support:true},{readOnlyLimit:true},{denied:['anticipos']}]){const f=fixture();Object.assign(f.access,overrides);assert.throws(()=>f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:100,account:'1102'}));}
});
test('planes y módulos propios no conceden acceso por perfil',()=>{
 for(const module of TREASURY_MODULES){assert.ok(BLOCKABLE_MODULES.includes(module));for(const plan of DEFAULT_PLANS)assert.equal(moduleIncluded(plan,module),plan.id!=='facturacion');assert.equal(moduleIncluded({...DEFAULT_PLANS[3],blockedModules:[module]},module),false)}
});
test('guardas de restauración conservan asientos y depósitos pendientes',()=>{
 const f=fixture(),id=f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:100,account:'1102'}),before=structuredClone(f.data);f.data.entries.find(e=>e.treasuryId===id).lines[0].d=2;assert.throws(()=>guardTreasury(before,f.data,check));const next=structuredClone(before);next.businessRecords=[];assert.throws(()=>guardTreasury(before,next,check));const legacy=fixture().data;legacy.businessRecords=[{id:'old',module:'reservas',deposit:5,status:'Reservada'}];const canceled=structuredClone(legacy);canceled.businessRecords[0].status='Cancelada';assert.throws(()=>guardTreasury(legacy,canceled,check));
});
test('normalización relacional y respaldo conservan metadatos en centavos y asignaciones',()=>{
 const f=fixture(),i=f.invoice();f.policy(999999);const id=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:i.id,amountCents:1234}]});f.op('batchPay',{id});const packed=normalizeDocument('00000000-0000-4000-8000-000000000001',f.data);assert.equal(documentHash(restoreDocument(packed)),documentHash(f.data));assert.equal(invoiceLinkedEntries(f.data.entries,i.id).at(-1).lines[0].invoiceId,i.id);
});
test('rutas reutilizan sesión, transacción, permisos, revisión, idempotencia y auditoría existentes',()=>{
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8'),access=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');assert.match(ops,/TREASURY_OPS.includes\(body.operation\).*operationId/s);assert.match(ops,/updateCompany\(companyId, session, body.revision/);assert.match(ops,/companyAccess\(client,companyId,session,true\);requireModule\(access,body.module\)/);assert.match(ops,/Descarga tesorería/);assert.match(access,/guardTreasury\(fullCompany.data,patch.data/);assert.match(access,/readOnlyLimit/);
});
test('F2.3 capacidad Q proyecta períodos sin facturar y descuenta anticipo sin duplicar facturas',()=>{
 const f=fixture();f.data.products=[{id:'service-q',kind:'service',vatRate:0}];f.data.businessRecords=[{id:'q',module:'suscripciones',name:'Mensualidad',date:'2026-11-01',anchor:'2026-11-01',months:1,amountCents:10000,status:'Activa',productId:'service-q',deposit:30,events:[],billed:[]}];const r=treasuryForecastReport(f.data,{from:'2026-11-04',to:'2026-11-30'});assert.equal(r.events.filter(e=>e.source==='suscripciones').length,1);assert.equal(r.events.find(e=>e.source==='suscripciones').amountCents,7000);f.data.businessRecords[0].billed=[{period:0}];assert.equal(treasuryForecastReport(f.data,{from:'2026-11-04',to:'2026-11-30'}).events.filter(e=>e.source==='suscripciones').length,0);
});
test('guardas no permiten inventar asientos de revalorización o aplicar desde otra sucursal',()=>{
 const f=fixture(),before=structuredClone(f.data);f.data.entries.push({id:'forged',date:'2026-11-04',type:'manual',revaluation:true,treasuryId:'unknown',lines:[]});assert.throws(()=>guardTreasury(before,f.data,check));const x=fixture(),i=x.invoice(),id=x.op('advanceCreate',{side:'supplier',partyId:'s1',amountCents:100,account:'1102'});x.access.branchId='otra';// updateCompany entrega solo las filas de la sucursal del servidor.
 x.data.businessRecords=x.data.businessRecords.filter(r=>r.branchId===x.access.branchId);assert.throws(()=>x.op('advanceApply',{id,allocations:[{invoiceId:i.id,amountCents:100}]}));
});
test('F2.7 tasa inversa para empresa USD y respuesta excesiva se validan sin red real',async()=>{
 const previous=globalThis.Netlify;globalThis.Netlify={env:{get:()=> 'true'}};try{const f=fixture();f.data.cfg.cur='USD';f.data.cfg.treasuryControls.tipos_cambio.sourceEnabled=true;const r=await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},async()=>new Response('<RecuperaTC_DiaResult>40</RecuperaTC_DiaResult>'));assert.equal(r.rates[0].currency,'NIO');assert.equal(r.rates[0].rateMicros,25000);assert.equal((await officialRatesPreview(f.data,{module:'tipos_cambio',date:'2026-11-03'},async()=>new Response('x'.repeat(200001)))).available,false);}finally{globalThis.Netlify=previous}
});
test('F2.4 descuento de pronto pago no puede consumirse repetidamente entre lotes',()=>{
 const f=fixture(),i=f.invoice('discounted',100);i.earlyPaymentDiscount={until:'2026-11-10',amountCents:200};f.policy(999999);const first=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:i.id,amountCents:1000,discountCents:200}]});f.op('batchPay',{id:first});assert.throws(()=>f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:i.id,amountCents:1000,discountCents:1}]}));f.op('batchReverse',{id:first});const second=f.op('batchPrepare',{account:'1102',allocations:[{invoiceId:i.id,amountCents:1000,discountCents:200}]});assert.ok(second);
});
test('F2.4 lote desde banco extranjero conserva original, tasa y asiento único; reversa el mismo original',()=>{
 const f=foreignFixture(),i=f.invoice('foreign-payment',74);f.data.cfg.bankControls={enabled:true};f.policy(999999);const id=f.op('batchPrepare',{account:'1190',originalCents:200,rate:'37',rateSource:'Fuente confirmada del pago',rateDate:'2026-11-03',allocations:[{invoiceId:i.id,amountCents:7400}]});const before=structuredClone(f.data);f.op('batchPay',{id});guardBankReconciliations(before,f.data,check);validateBusinessRecords(f.data,check);const movement=f.data.businessRecords.find(r=>r.kind==='movement');assert.equal(movement.amountCents,-200);assert.equal(movement.baseCents,-7400);assert.equal(treasuryDebt(f.data.entries,i),0);assert.equal(f.data.entries.filter(e=>e.treasuryId===id).length,1);const paid=structuredClone(f.data);f.op('batchReverse',{id,date:'2026-11-05'});guardBankReconciliations(paid,f.data,check);assert.equal(f.data.businessRecords.filter(r=>r.kind==='movement').at(-1).amountCents,200);assert.equal(treasuryDebt(f.data.entries,i),7400);
});
test('F2.4 saldo original y saldo futuro del banco extranjero impiden sobregiro',()=>{
 const f=foreignFixture(),i=f.invoice('large',370);f.data.cfg.bankControls={enabled:true};f.policy(999999);f.data.businessRecords[0].openingCents=900;const id=f.op('batchPrepare',{account:'1190',originalCents:1000,rate:'37',rateSource:'Fuente confirmada',rateDate:'2026-11-03',allocations:[{invoiceId:i.id,amountCents:37000}]});assert.throws(()=>f.op('batchPay',{id}),/original negativo/);
});
test('F2.5 informe agrupa saldos por tercero e incluye la ficha original una vez',()=>{
 const f=fixture();f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:1000,account:'1102'});f.op('advanceCreate',{side:'customer',partyId:'c1',amountCents:2000,account:'1102'});assert.equal(f.data.businessRecords.filter(r=>r.module==='anticipos').length,2);
 f.data.businessRecords.push({id:'linked',module:'reservas',customerId:'c1',deposit:5,name:'Reserva',branchId:'principal'});const before=structuredClone(f.data),report=treasuryReport(f.data,{module:'anticipos'},f.access);assert.equal(report.balances.length,1);assert.equal(report.balances[0].remainingCents,3500);assert.equal(report.balances[0].count,3);assert.equal(report.integrated.length,1);assert.deepEqual(f.data,before);
});
