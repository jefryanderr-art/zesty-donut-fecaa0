import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/annual-ledger.js';
import {connectedCostReport} from '../public/accounting-math.mjs';
import {statement} from '../netlify/lib/reporting.mjs';
import {budgetReport} from '../netlify/lib/budgets.mjs';
const from='2026-11-01',to='2026-11-30';
function fixture(){
 const accounts=[['1101','activo'],['1202','activo'],['1301','activo'],['1403','activo'],['2101','pasivo'],['2102','pasivo'],['4101','ingreso'],['5101','costo'],['5110','costo'],['6102','gasto'],['6103','gasto'],['6101','gasto'],['6106','gasto'],['6199','gasto']].map(([code,tipo])=>({code,name:code,tipo,nat:['ingreso','pasivo'].includes(tipo)?'C':'D'}));
 const entry=(id,type,lines,extra={})=>({id,type,date:'2026-11-10',branchId:'principal',lines,...extra});
 const debit=(a,d)=>({a,d,c:0}),credit=(a,c)=>({a,c,d:0});
 const sale=entry('sale','venta',[debit('1101',1150),credit('4101',1000),credit('2102',150),debit('5101',300),credit('1301',300)],{reference:'F-1',eventId:'event',businessId:'project',customerId:'customer',items:[{p:'product',q:1,u:1000,cost:300}]});
 const variable=entry('variable','costo',[debit('5110',100),debit('1202',15),credit('2101',115)],{reference:'C-1',pay:'2101',supplierId:'supplier',party:'Proveedor',saleId:'sale',eventId:'event',businessId:'project',customerId:'customer',productId:'product'});
 const fixed=entry('fixed','costo',[debit('6102',50),credit('1101',50)]);
 const entries=[sale,variable,fixed,entry('expense','gasto',[debit('6103',40),credit('1101',40)]),entry('payroll','nomina',[debit('6101',60),credit('1101',60)]),entry('dep','depreciacion',[debit('6106',20),credit('1403',20)]),entry('other','manual',[debit('6199',10),credit('1101',10)]),entry('payment','abono',[debit('2101',15),credit('1101',15)],{invoiceId:'variable'})];
 return {accounts,entries,costCatalog:[{id:'v',name:'Empaque'},{id:'f',name:'Alquiler'}],costs:[{id:'cv',entryId:'variable',date:'2026-11-10',catalogId:'v',type:'variable',direct:true,base:100,vat:15,total:115,pay:'2101',saleId:'sale',eventId:'event',businessId:'project',customerId:'customer',productId:'product',center:'Producción'},{id:'cf',entryId:'fixed',date:'2026-11-10',catalogId:'f',type:'fijo',direct:false,base:50,pay:'1101',center:'General'}],businessRecords:[{id:'project',module:'proyectos',billed:[{entryId:'sale'}]}]};
}
const total=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
test('utilidad operativa y equilibrio incluyen egresos reales, sin duplicar IVA, nómina ni costos',()=>{
 const r=connectedCostReport(fixture(),from,to);
 assert.equal(r.revenueCents,100000);assert.equal(r.cogsCents,30000);assert.equal(r.grossCents,70000);
 assert.equal(r.variableCents,10000);assert.equal(r.fixedCents,5000);assert.equal(r.expensesCents,4000);assert.equal(r.payrollCents,6000);assert.equal(r.depreciationCents,2000);assert.equal(r.otherCents,1000);
 assert.equal(r.operatingCents,42000);assert.equal(r.fixedActualCents,18000);assert.equal(r.breakEvenCents,30000);
});
test('cada dimensión concilia con resultados y con la suma de líneas del mayor',()=>{
 const data=fixture(),r=connectedCostReport(data,from,to),s=statement(data,from,to);
 assert.equal(r.operatingCents,Math.round(s.profit*100));
 assert.equal(r.cogsCents+r.outgoingsCents,Math.round((s.cost+s.expense)*100));
 const ledger=data.entries.flatMap(e=>e.lines).filter(l=>['gasto','costo'].includes(data.accounts.find(a=>a.code===l.a)?.tipo)).reduce((n,l)=>n+Math.round(l.d*100)-Math.round(l.c*100),0);
 for(const rows of Object.values(r.groups)){assert.equal(total(rows,'revenueCents'),r.revenueCents);assert.equal(total(rows,'cogsCents')+total(rows,'costCents'),ledger);assert.equal(total(rows,'resultCents'),Math.round(s.profit*100))}
 assert.equal(total(r.details.flatMap(d=>d.accountAmounts),'amountCents'),ledger);
});
test('estado por evento, proyecto y factura usa ingresos netos, 5101 y costos imputados',()=>{
 const r=connectedCostReport(fixture(),from,to);
 for(const [dimension,id]of [['eventId','event'],['businessId','project'],['saleId','sale']]){const row=r.groups[dimension].find(x=>x.key===id);assert.equal(row.revenueCents,100000);assert.equal(row.cogsCents,30000);assert.equal(row.costCents,10000);assert.equal(row.resultCents,60000)}
});
test('indirectos solo se reparten al elegir criterio, conservando todos los centavos',()=>{
 const data=fixture(),plain=connectedCostReport(data,from,to),r=connectedCostReport(data,from,to,{allocation:'revenue'});
 assert.equal(plain.groups.saleId.find(x=>x.key==='sale').allocatedCents,0);
 assert.equal(r.groups.saleId.find(x=>x.key==='sale').allocatedCents,5000);
 for(const rows of Object.values(r.groups)){assert.equal(total(rows,'allocatedCents'),0);assert.equal(total(rows,'resultCents'),r.operatingCents)}
 assert.throws(()=>connectedCostReport(data,from,to,{allocation:'inventado'}));
});
test('pendientes se enlazan a proveedor y descuentan abonos sin mezclar IVA con utilidad',()=>{
 const r=connectedCostReport(fixture(),from,to);assert.equal(r.pendingCents,10000);assert.equal(r.pending[0].supplierId,'supplier');assert.equal(r.pending[0].entryId,'variable');
});
test('anulación netea catálogo, evento y factura y cancela pendientes sin borrar el original',()=>{
 const d=fixture();d.entries=d.entries.filter(e=>e.id!=='payment');const source=d.entries.find(e=>e.id==='variable');d.costs[0].reversalId='reverse';d.entries.push({...source,id:'reverse',reversalOf:source.id,lines:source.lines.map(l=>({a:l.a,d:l.c,c:l.d}))});
 const r=connectedCostReport(d,from,to);assert.equal(r.variableCents,0);assert.equal(r.pendingCents,0);assert.equal(r.groups.eventId.find(x=>x.key==='event').costCents,0);assert.equal(r.operatingCents,52000);assert.equal(r.operatingCents,Math.round(statement(d,from,to).profit*100));
});
test('anulación posterior no cambia resultados ni deuda de un período anterior',()=>{
 const d=fixture(),source=d.entries.find(e=>e.id==='variable');d.costs[0].reversalId='reverse';d.entries.push({...source,id:'reverse',date:'2026-12-01',reversalOf:source.id,lines:source.lines.map(l=>({a:l.a,d:l.c,c:l.d}))});
 const r=connectedCostReport(d,from,to);assert.equal(r.variableCents,10000);assert.equal(r.pendingCents,10000);
 const dec=connectedCostReport(d,'2026-12-01','2026-12-31');assert.equal(dec.variableCents,-10000);assert.equal(dec.operatingCents,Math.round(statement(d,'2026-12-01','2026-12-31').profit*100));
});
test('presupuesto de catálogo compara con los mismos asientos y no con total con IVA',()=>{
 const d=fixture();d.businessRecords.push({id:'config',module:'presupuestos',kind:'configuration',status:'Activa'},{id:'budget',module:'presupuestos',kind:'budget',status:'Activa',year:2026,dimension:'catalogo',lines:[{key:'v',amountCents:12000}]});
 const r=budgetReport(d,{from,to});assert.equal(r.budgets[0].lines[0].actualCents,10000);assert.equal(r.budgets[0].lines[0].diffCents,-2000);
});
test('sin ingresos no inventa punto de equilibrio; sin vínculos conserva Sin asignar',()=>{
 const d=fixture();d.entries=d.entries.filter(e=>e.type!=='venta');d.costs=d.costs.map(c=>({entryId:c.entryId,id:c.id,date:c.date,type:c.type}));for(const e of d.entries){delete e.saleId;delete e.eventId;delete e.businessId;delete e.productId;delete e.customerId}
 const r=connectedCostReport(d,from,to);assert.equal(r.breakEvenCents,null);assert.equal(r.costSalesPct,null);assert.ok(r.groups.businessId.some(x=>x.key==='Sin asignar'&&x.costCents>0));assert.equal(connectedCostReport({entries:[],accounts:[]},from,to).hasData,false);
});
test('notas de crédito reducen ingreso y costo de la factura en su período',()=>{
 const d=fixture();d.entries.push({id:'note',date:'2026-11-20',type:'nota-credito',invoiceId:'sale',lines:[{a:'4101',d:100,c:0},{a:'1101',d:0,c:100},{a:'5101',d:0,c:30},{a:'1301',d:30,c:0}],items:[{p:'product',q:0.1,u:1000,cost:300}]});
 const r=connectedCostReport(d,from,to),invoice=r.groups.saleId.find(x=>x.key==='sale');assert.equal(invoice.revenueCents,90000);assert.equal(invoice.cogsCents,27000);assert.equal(invoice.resultCents,53000);assert.equal(r.operatingCents,Math.round(statement(d,from,to).profit*100));
});
test('no modifica datos y rechaza importes fraccionarios de centavo',()=>{
 const d=fixture(),copy=structuredClone(d);connectedCostReport(d,from,to,{allocation:'revenue'});assert.deepEqual(d,copy);d.entries[0].lines[0].d=1.001; // no afecta resultados; la línea de ingreso sí se valida
 d.entries[0].lines[1].c=1.001;assert.throws(()=>connectedCostReport(d,from,to));
});
test('reparto con restos de centavo es determinista y no altera el mayor',()=>{
 const d=fixture(),sale=d.entries[0];for(const id of ['sale2','sale3'])d.entries.push({...structuredClone(sale),id});
 d.entries.find(e=>e.id==='fixed').lines=[{a:'6102',d:0.01,c:0},{a:'1101',d:0,c:0.01}];
 const r=connectedCostReport(d,from,to,{allocation:'revenue'}),rows=r.groups.saleId.filter(x=>x.key.startsWith('sale'));
 assert.equal(total(rows,'allocatedCents'),1);assert.ok(rows.every(x=>Number.isSafeInteger(x.allocatedCents)));assert.equal(total(r.groups.saleId,'resultCents'),Math.round(statement(d,from,to).profit*100));
});
test('cierres y movimientos personales patrimoniales no entran en resultados',()=>{
 const d=fixture(),before=connectedCostReport(d,from,to);d.accounts.push({code:'3103',tipo:'patrimonio',nat:'D'});d.entries.push({id:'personal',date:'2026-11-15',type:'capital-socio',lines:[{a:'3103',d:50,c:0},{a:'1101',d:0,c:50}]},{id:'close',date:'2026-11-30',type:'cierre',lines:[{a:'4101',d:1000,c:0},{a:'3103',d:0,c:1000}]});
 const after=connectedCostReport(d,from,to);assert.equal(after.operatingCents,before.operatingCents);assert.equal(after.outgoingsCents,before.outgoingsCents);assert.equal(after.operatingCents,Math.round(statement(d,from,to).profit*100));
});
