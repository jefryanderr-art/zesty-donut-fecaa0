// Preparadas para la plataforma. Esta sesión solo comprueba sintaxis.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recurringBoundary,recurringPeriod,recurringMetrics,recurringRatio,moneyCents,invoiceTotals} from '../public/accounting-math.mjs';
import {recurringOperation,recurringCredit,recurringReport,validateRecurringRecord} from '../netlify/lib/recurring.mjs';
import {businessOperation,validateBusinessRecords} from '../netlify/lib/business.mjs';
import {catalog} from '../netlify/lib/business-profile.mjs';
import {moduleIncluded,DEFAULT_PLANS} from '../netlify/lib/billing-rules.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
const check=(value,message)=>assert.ok(value,message);
const entry=(data,s,e)=>{const r={id:'e-'+data.entries.length,...e};data.entries.push(r);return r};
const fixture=()=>{
 const data={cfg:{},accounts:[{code:'1102',tipo:'activo'},{code:'1201',tipo:'activo'},{code:'4101',tipo:'ingreso'},{code:'2199',tipo:'pasivo'}],products:[],customers:[{id:'c',name:'Servicios Segovia',status:'activo'}],businessRecords:[],entries:[]},access={owner:true,branchId:'principal',company:{businessType:'software',data}};
 const ctx={check,permit:(a,m)=>check(!a.blocked?.includes(m),'Sin permiso '+m),amount:v=>{check(moneyCents(v)>0,'Importe');return v},financialCash:()=>{},entry,sale:async b=>{const p=data.products.find(p=>p.id===b.items[0].p),t=invoiceTotals(b.items.map(i=>({...i,vatRate:p.vatRate})));return entry(data,{}, {date:b.date,due:b.due,type:'venta',pay:'1201',customerId:b.customerId,items:b.items,...t,lines:[{a:'1201',d:t.total,c:0},{a:'4101',d:0,c:t.subtotal},...(t.vat?[{a:'2106',d:0,c:t.vat}]:[])]})}};
 return {data,access,ctx};
};
const base={operation:'recurringCreate',date:'2026-11-01',anchor:'2026-11-01',months:1,amountCents:30000,name:'Soporte mensual',customerId:'c',liability:'2199',confirmed:true,reason:'Alta expresamente confirmada',deferred:true};
const create=async(f,extra={})=>recurringOperation(f.data,f.access,{}, {...base,...extra},f.ctx);
const op=(f,operation,id,extra={})=>recurringOperation(f.data,f.access,{}, {operation,id,date:'2026-11-01',confirmed:true,reason:'Confirmación del responsable',...extra},f.ctx);
test('informe rechaza períodos invertidos o fechas inexistentes sin modificar datos',()=>{
 const {data}=fixture(),before=structuredClone(data);
 assert.throws(()=>recurringReport(data,'2026-11-30','2026-11-01'),/posterior/);
 assert.throws(()=>recurringReport(data,'2026-02-30','2026-11-01'));
 assert.deepEqual(data,before);
});
test('anclaje fin de mes conserva día original y año bisiesto',()=>{
 assert.equal(recurringBoundary('2028-01-31',1,1),'2028-02-29');assert.equal(recurringBoundary('2028-01-31',1,2),'2028-03-31');assert.throws(()=>recurringBoundary('2026-02-30',1,0));assert.throws(()=>recurringRatio(1.5,1,2));
});
test('prorratea alta, pausa, reanudación y baja sin modificar historial',()=>{
 const r={date:'2026-11-11',anchor:'2026-11-01',months:1,amountCents:30000,events:[{date:'2026-11-16',status:'Pausada'},{date:'2026-11-21',status:'Activa'},{date:'2026-11-26',status:'Cancelada'}]},before=structuredClone(r),p=recurringPeriod(r,0);assert.equal(p.activeDays,10);assert.equal(p.baseCents,10000);assert.deepEqual(r,before);assert.equal(recurringRatio(1,1,2),1);
});
test('MRR y ARR normalizan periodicidad; churn usa cohorte inicial; cartera solo recurrentes',()=>{
 const a={id:'a',date:'2026-10-01',months:1,amountCents:12000,events:[],billed:[{entryId:'sale'}]},b={id:'b',date:'2026-10-01',months:12,amountCents:120000,events:[{date:'2026-11-15',status:'Cancelada'}],billed:[]},c={id:'c',date:'2026-11-02',months:3,amountCents:30000,events:[],billed:[]};
 const e=[{id:'sale',date:'2026-11-01',due:'2026-11-02',pay:'1201',lines:[{a:'1201',d:100,c:0}]},{id:'other',date:'2026-11-01',due:'2026-11-02',pay:'1201',lines:[{a:'1201',d:999,c:0}]}],m=recurringMetrics([a,b,c],e,'2026-11-01','2026-11-30');assert.equal(m.mrrCents,22000);assert.equal(m.arrCents,264000);assert.equal(m.churnBps,5000);assert.equal(m.portfolio.rows.length,1);
});
test('anticipo como pasivo, factura única, diferimiento y reconocimiento confirmado',async()=>{
 const f=fixture(),id=await create(f);await op(f,'recurringAdvance',id,{total:100,pay:'1102'});assert.equal(f.data.entries[0].lines[1].a,'2199');
 await op(f,'recurringBill',id,{period:0,previewCents:30000});assert.equal(f.data.businessRecords[0].deposit,0);const count=f.data.entries.length;
 await assert.rejects(op(f,'recurringBill',id,{period:0,previewCents:30000}),/facturado/);assert.equal(f.data.entries.length,count);
 await op(f,'recurringRecognize',id,{period:0,date:'2026-11-16'});assert.equal(f.data.businessRecords[0].billed[0].recognizedCents,15000);
 await op(f,'recurringRecognize',id,{period:0,date:'2026-12-01'});assert.equal(f.data.businessRecords[0].billed[0].recognizedCents,30000);
 const balance=f.data.entries.flatMap(e=>e.lines).filter(l=>l.a==='2199').reduce((s,l)=>s+moneyCents(l.c)-moneyCents(l.d),0);assert.equal(balance,0);validateBusinessRecords(f.data,check);
});
test('cambio futuro no altera períodos facturados y cancelación prorratea antes de emitir',async()=>{
 const f=fixture(),id=await create(f);await op(f,'recurringState',id,{date:'2026-11-16',status:'Cancelada'});assert.equal(recurringPeriod(f.data.businessRecords[0],0).baseCents,15000);await op(f,'recurringBill',id,{date:'2026-11-16',period:0,previewCents:15000});await assert.rejects(op(f,'recurringState',id,{date:'2026-12-01',status:'Activa'}),/Transición/);
});
test('nota de crédito compensa diferimiento y conserva factura y nota',async()=>{
 const f=fixture(),id=await create(f);await op(f,'recurringBill',id,{period:0,previewCents:30000});const r=f.data.businessRecords[0],original=structuredClone(f.data.entries[0]),note=entry(f.data,{}, {date:'2026-11-15',type:'nota-credito',invoiceId:r.billed[0].entryId,subtotal:100,total:100,lines:[{a:'4101',d:100,c:0},{a:'1201',d:0,c:100}]});
 const saved=structuredClone(note);recurringCredit(f.data,f.access,{},note,f.ctx);assert.deepEqual(f.data.entries[0],original);assert.deepEqual(note,saved);assert.equal(r.billed[0].creditBaseCents,10000);await op(f,'recurringRecognize',id,{period:0,date:'2026-12-01'});assert.equal(r.billed[0].recognizedCents,20000);
});
test('sin permisos, sin confirmación, sucursal ajena y guardado genérico se rechazan',async()=>{
 for(const blocked of ['suscripciones','inventario','facturacion']){const f=fixture();f.access.blocked=[blocked];await assert.rejects(create(f));assert.equal(f.data.businessRecords.length,0);}
 const f=fixture(),id=await create(f);await assert.rejects(op(f,'recurringAdvance',id,{confirmed:false,total:1,pay:'1102'}));await assert.rejects(recurringOperation(f.data,{...f.access,branchId:'otra'},{},{...base,operation:'recurringRefund',id,total:1},f.ctx));await assert.rejects(businessOperation(f.data,f.access,{}, {operation:'businessSave',module:'suscripciones'},f.ctx));
});
test('reporte no modifica datos y codec conserva nuevos metadatos de centavos',async()=>{
 const f=fixture();await create(f);const before=structuredClone(f.data);recurringReport(f.data,'2026-11-01','2026-11-30');assert.deepEqual(f.data,before);
 // La proyección relacional debe conservar los metadatos nativos sin multiplicarlos por cien.
 const packed=normalizeDocument('company',f.data);assert.ok(packed.rows.businessRecords[0].extra.data.amountCents===30000);
});
test('Q independiente de Contratos, perfiles, plan y personalización conservan autorización',()=>{
 assert.equal(catalog.capabilities.suscripciones.letter,'Q');for(const id of ['software','recurrentes'])assert.ok(catalog.get(id).capabilities.includes('suscripciones'));
 for(const p of DEFAULT_PLANS){assert.equal(moduleIncluded(p,'suscripciones'),p.id!=='facturacion');assert.equal(moduleIncluded({...p,blockedModules:[...p.blockedModules,'suscripciones']},'suscripciones'),false);}
 const source=readFileSync(new URL('../public/business.js',import.meta.url),'utf8');assert.ok(source.indexOf('if(!routeAllowed(route))return false;')<source.indexOf('custom.shown?.includes(route)'));
});
test('tarifas diarias conservan centavos en altas y bajas de precios no divisibles',async()=>{
 const {recurringInvoiceItems}=await import('../public/accounting-math.mjs');
 for(const amountCents of [1,17,101,99999999900]){const r={date:'2026-11-01',anchor:'2026-11-01',months:1,amountCents,productId:'low',roundingProductId:'high',events:[]},p=recurringPeriod(r,0),items=recurringInvoiceItems(r,p);assert.equal(moneyCents(invoiceTotals(items).subtotal),amountCents);
  for(const day of [2,15,29]){const proposal={...r,events:[{date:'2026-11-'+String(day).padStart(2,'0'),status:'Cancelada'}]},target=recurringPeriod(proposal,0),wanted=recurringInvoiceItems(r,target);for(const i of wanted)assert.ok(i.q<=(items.find(o=>o.p===i.p)?.q||0));assert.equal(moneyCents(invoiceTotals(wanted).subtotal),target.baseCents);}
 }
});
test('cancelación facturada confirma nota exacta y conserva ingreso ya reconocido',async()=>{
 const {allocateReturnItems,creditReturnSummary}=await import('../public/accounting-math.mjs'),f=fixture(),id=await create(f);await op(f,'recurringBill',id,{period:0,previewCents:30000});
 await op(f,'recurringRecognize',id,{period:0,date:'2026-11-11'});f.ctx.credit=b=>{const sale=f.data.entries.find(e=>e.id===b.id),previous=f.data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===sale.id),allocated=allocateReturnItems(sale.items,previous,b.items),totals=creditReturnSummary(sale,previous,allocated.items,allocated.finalReturn,f.data.entries);return entry(f.data,{}, {date:b.date,type:'nota-credito',invoiceId:sale.id,items:allocated.items,...totals,lines:[{a:'4101',d:totals.subtotal,c:0},{a:'1201',d:0,c:totals.total}]})};
 const original=structuredClone(f.data.entries[0]);await op(f,'recurringState',id,{date:'2026-11-16',status:'Cancelada',creditConfirmed:true});assert.deepEqual(f.data.entries[0],original);const r=f.data.businessRecords[0];assert.equal(r.billed[0].creditBaseCents,15000);assert.equal(r.billed[0].recognizedCents,10000);await op(f,'recurringRecognize',id,{date:'2026-11-17',period:0});assert.equal(r.billed[0].recognizedCents,15000);validateRecurringRecord(r,f.data,check);
});
test('integración conserva sesión, soporte/limitadas, permisos, sucursal e idempotencia',()=>{
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8'),access=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 assert.match(ops,/RECURRING_OPS.includes\(body.operation\)[\s\S]*!body.operationId/);assert.match(ops,/recurringReport'[\s\S]*companyAccess\(client,companyId,session,true\);requireModule\(access,'suscripciones'\)/);
 assert.match(access,/if\(access.support\|\|access.readOnlyLimit\)accessError/);assert.match(access,/guardPeriods\(fullCompany.data, patch.data, action\)/);assert.match(ops,/recurringOperation\(data,access,operationSession,body/);
});
test('Q conserva la ruta, permiso y acciones anteriores de plantillas de asientos',()=>{
 const advanced=readFileSync(new URL('../public/advanced.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/recurring.js',import.meta.url),'utf8');
 const business=readFileSync(new URL('../public/business.js',import.meta.url),'utf8');
 assert.match(advanced,/V\.recurrentes=/);assert.match(advanced,/recurrentes:'contabilidad'/);
 assert.ok(!catalog.all.includes('recurrentes'));assert.ok(catalog.all.includes('suscripciones'));
 assert.match(ui,/V\.suscripciones=/);assert.doesNotMatch(ui,/V\.recurrentes=/);
 assert.doesNotMatch(ui,/action\.startsWith\('recurring'\)/);
 assert.match(business,/ROUTE_MODULE\[id\]=id/);
});

test('guardado genérico y restauración no pueden reescribir renovaciones de Q',()=>{
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 assert.match(ops,/for\(const module of \['suscripciones','bancos'\]\)requireValue\(equal/);
});
