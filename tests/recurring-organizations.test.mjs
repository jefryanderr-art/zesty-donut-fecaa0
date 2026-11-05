// Preparadas para ejecución por la plataforma; no ejecutadas en esta sesión.
import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringPeriod,recurringInvoiceItems,invoiceTotals,recurringPlanPrice} from '../public/accounting-math.mjs';
import {validatePlan,planOperation} from '../netlify/lib/recurring-plans.mjs';
import {organizationOperation,organizationReport} from '../netlify/lib/organizations.mjs';
import {validateProfile,operationalType} from '../netlify/lib/business-profile.mjs';
const check=(value,message)=>{if(!value)throw new Error(message)};
const plan={mode:'fixed',months:1,amountCents:30000,unitCents:0,maxUnits:100,trialDays:0,noticeDays:0,retryDays:3,suspendDays:15,tiers:[],coupons:[]};
const record={id:'r',date:'2026-11-01',anchor:'2026-11-01',months:1,amountCents:30000,productId:'p',roundingProductId:'q',events:[],planHistory:[{date:'2026-11-01',plan}],usage:[]};
test('cambio a mitad del período conserva el precio de cada tramo',()=>{
 const r={...record,planHistory:[...record.planHistory,{date:'2026-11-16',plan:{...plan,amountCents:60000}}]};
 const p=recurringPeriod(r,0);assert.equal(p.baseCents,45000);assert.equal(invoiceTotals(recurringInvoiceItems(r,p)).subtotal,450);
});
test('prueba sin cargo y precio por uso se calculan en el mismo motor',()=>{
 const r={...record,trialEnd:'2026-11-11',planHistory:[{date:record.date,plan:{...plan,mode:'usage',unitCents:100}}],usage:[{period:0,units:30}]};
 assert.equal(recurringPeriod(r,0).baseCents,22000);assert.equal(recurringPlanPrice({...plan,mode:'tiered',tiers:[{upTo:10,unitCents:100},{upTo:100,unitCents:50}]},20),31500);
});
test('cambio anual empieza en un límite y conserva los períodos anteriores',()=>{
 const r={...record,cycles:[{index:1,anchor:'2026-12-01',months:12}],planHistory:[...record.planHistory,{date:'2026-12-01',plan:{...plan,months:12,amountCents:300000}}]};
 assert.equal(recurringPeriod(r,0).to,'2026-12-01');assert.equal(recurringPeriod(r,1).to,'2027-12-01');assert.equal(recurringPeriod(r,1).baseCents,300000);
});
test('escalones, cupones y rangos rechazan configuraciones inconsistentes',()=>{
 assert.throws(()=>validatePlan({...plan,mode:'tiered',tiers:[{upTo:10,unitCents:1}]},check));
 assert.throws(()=>validatePlan({...plan,coupons:[{code:'PRUEBA',discount:100,until:'2026-12-01'}]},check));
 assert.throws(()=>validatePlan({...plan,amountCents:0.1},check));
});
test('uso exige permiso, sucursal, límite y período sin factura',()=>{
 const r={...structuredClone(record),module:'suscripciones',kind:'subscription',branchId:'principal',status:'Activa',billed:[]};const data={businessRecords:[r]},access={branchId:'principal'},ctx={check,permit:()=>{}};
 const b={operation:'recurringUsage',id:'r',date:'2026-11-02',period:0,units:101,confirmed:true,reason:'Uso confirmado'};
 assert.throws(()=>planOperation(data,access,{},b,ctx),/límite/);b.units=50;planOperation(data,access,{},b,ctx);assert.equal(r.usage[0].units,50);
 r.billed.push({period:0});assert.throws(()=>planOperation(data,access,{},b,ctx),/período abierto/);
});
test('cambio de plan no reescribe una factura del período',()=>{
 const r={...structuredClone(record),module:'suscripciones',kind:'subscription',branchId:'principal',status:'Activa',billed:[{period:0,to:'2026-12-01'}]};
 assert.throws(()=>planOperation({businessRecords:[r,{id:'p',kind:'recurring-plan',branchId:'principal',date:'2026-11-01',plan}]},{branchId:'principal',owner:true},{},{operation:'recurringChangePlan',id:'r',planId:'p',date:'2026-11-16',confirmed:true,reason:'Cambio autorizado'},{check,permit:()=>{}}),/facturas/);
});
const fixture=()=>({accounts:[{code:'1101',tipo:'activo'},{code:'4101',tipo:'ingreso'},{code:'6101',tipo:'gasto'}],entries:[],businessRecords:[{id:'fund',module:'aportes',kind:'organization-fund',name:'Campaña',date:'2026-11-01',branchId:'principal',targetCents:10000,events:[]},{id:'member',module:'aportes',kind:'organization-member',name:'Donante',date:'2026-11-01',branchId:'principal',fundId:'fund',anchor:'2026-11-01',months:1,amountCents:10000,events:[]}]});
test('cuotas parciales generan recibos, saldo e historial sin duplicar ingreso',()=>{
 const data=fixture(),ctx={check,permit:()=>{},financialCash:()=>{},date:v=>v,entry:(data,s,e)=>{const row={id:'e'+data.entries.length,...e};data.entries.push(row);return row}},access={branchId:'principal'};
 const b={operation:'organizationContribution',date:'2026-11-02',fundId:'fund',memberId:'member',period:0,amountCents:4000,pay:'1101',incomeAccount:'4101',confirmed:true,reason:'Aporte confirmado'};
 organizationOperation(data,access,{},b,ctx);let r=organizationReport(data,'2026-11-01','2026-11-30');assert.equal(r.funds[0].incomeCents,4000);assert.equal(r.members[0].dues[0].remainingCents,6000);
 assert.throws(()=>organizationOperation(data,access,{}, {...b,amountCents:7000},ctx),/saldo/);organizationOperation(data,access,{}, {...b,amountCents:6000},ctx);r=organizationReport(data,'2026-11-01','2026-11-30');assert.equal(r.members[0].dues.length,0);assert.equal(r.members[0].totalCents,10000);
});
test('informe de fondo descuenta reversas de gastos dentro del período',()=>{
 const data=fixture();data.entries=[{id:'cost',date:'2026-11-02',organizationFundId:'fund',lines:[{a:'6101',d:10,c:0},{a:'1101',d:0,c:10}]},{id:'reverse',date:'2026-11-03',reversalOf:'cost',lines:[{a:'6101',d:0,c:10},{a:'1101',d:10,c:0}]}];
 assert.equal(organizationReport(data,'2026-11-01','2026-11-30').funds[0].expenseCents,0);assert.equal(organizationReport(data,'2026-11-01','2026-11-02').funds[0].expenseCents,1000);
});
test('personalizado resuelve modelo validado sin cambiar el perfil',()=>{
 const config=validateProfile('personalizado',{operationalProfile:'farmacia',shown:['lotes','aportes','suscripciones']});assert.equal(config.businessType,'personalizado');assert.equal(operationalType(config),'farmacia');assert.throws(()=>validateProfile('comercio',{operationalProfile:'farmacia'}));assert.throws(()=>validateProfile('personalizado',{operationalProfile:'inexistente'}));
});
