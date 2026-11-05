import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceMeasure,commerceUnitCents,commerceSupplierNetCents,commercePromotion,commerceReplenishment,commerceABC,commerceRouteCashRows,commerceInstallmentBalances} from '../public/commerce-math.mjs';
import {commerceOperation,commerceReserve,commerceReserved,commerceSaleGuard,commerceLoadSale,commerceReservationsValid,commerceCanRead} from '../netlify/lib/commerce.mjs';
const check=(value,message)=>{if(!value)throw Error(message)};
const access={owner:true,branchId:'principal',company:{businessType:'comercio'}},session={email:'owner@example.test'};
const ctx={check,permit(){},date:v=>v};
const fixture=()=>({cfg:{},accounts:[{code:'6107',tipo:'gasto'}],products:[{id:'article',name:'Artículo',kind:'stock',price:3,cost:2,stock:20,unit:'kg'}],entries:[],businessRecords:[],customers:[{id:'customer',name:'Cliente',status:'activo'}],suppliers:[],purchaseOrders:[],employees:[]});
const run=(data,body,a=access,c=ctx)=>commerceOperation(data,a,session,{date:'2026-11-05',confirmed:true,operationId:'operation',...body},c);
test('exact base conversions, fractions and tare reject silently rounded quantities',()=>{
 assert.equal(commerceMeasure({quantity:2,factor:12}),24);
 assert.equal(commerceMeasure({gross:2.5,tare:0.2}),2.3);
 assert.equal(commerceMeasure({quantity:1,factor:0.125}),0.125);
 assert.throws(()=>commerceMeasure({gross:1,tare:2}));
 assert.throws(()=>commerceMeasure({quantity:1,factor:1/3}));
 assert.equal(commerceUnitCents(1200,12),100);
 assert.equal(commerceUnitCents(3,0.03),100);
 assert.throws(()=>commerceUnitCents(100,12));
});
test('supplier reductions use integer cent rounding and enforce two decimal percentages',()=>{
 assert.equal(commerceSupplierNetCents(101,50),51);
 assert.throws(()=>commerceSupplierNetCents(100,0.001));
});
test('pending orders prevent duplicate replenishment and promotions respect dates and quantities',()=>{
 assert.equal(commerceReplenishment({stock:2,min:5,max:10,pending:3}),0);
 assert.equal(commerceReplenishment({stock:2,min:5,max:10,pending:1}),7);
 const p={from:'2026-11-01',to:'2026-11-30',minimum:2,mode:'2x1'};
 assert.equal(commercePromotion(p,4,'2026-11-05'),50);
 assert.equal(commercePromotion(p,4,'2026-12-01'),0);
});
test('orders do not move inventory; full advances reserve and refunds release',async()=>{
 const d=fixture(),id=await run(d,{operation:'commerceOrder',customerId:'customer',mode:'retiro',items:[{p:'article',q:5}]});const r=d.businessRecords.find(r=>r.id===id);
 assert.equal(d.products[0].stock,20);assert.equal(commerceReserved(d,'article'),0);
 r.deposit=r.total;commerceReserve(d,r,check);assert.equal(commerceReserved(d,'article'),5);
 assert.throws(()=>commerceSaleGuard(d,{items:[{p:'article',q:16}]},check));
 assert.doesNotThrow(()=>commerceSaleGuard(d,{items:r.items},check,r.id));
 r.deposit=0;commerceReserve(d,r,check);assert.equal(commerceReserved(d,'article'),0);
});
test('a second paid reservation cannot overcommit inventory',async()=>{
 const d=fixture();for(let n=0;n<2;n++)await run(d,{operation:'commerceOrder',customerId:'customer',mode:'envio',items:[{p:'article',q:12}]});
 const [a,b]=d.businessRecords;a.deposit=a.total;commerceReserve(d,a,check);b.deposit=b.total;assert.throws(()=>commerceReserve(d,b,check));
});
test('configuration requires owner and rejects overlapping seasons',async()=>{
 const b={operation:'commerceProduct',productId:'article',presentations:[],customerPrices:[],min:2,max:10,seasons:[]};
 await assert.rejects(run(fixture(),b,{...access,owner:false}));
 await assert.rejects(run(fixture(),{...b,seasons:[{name:'A',from:'2026-11-01',to:'2026-11-10',min:2,max:5},{name:'B',from:'2026-11-10',to:'2026-11-20',min:2,max:5}]}));
});
test('clothing matrix creates unique zero-stock products and rejects reused codes',async()=>{
 const d=fixture(),a={...access,company:{businessType:'ropa'}},b={operation:'commerceMatrix',name:'Camisa',prefix:'CAM',sizes:['S','M'],colors:['Azul','Rojo'],unitCents:2000};
 await run(d,b,a);assert.equal(d.products.length,5);assert.equal(new Set(d.products.map(p=>p.code).filter(Boolean)).size,4);assert.ok(d.products.slice(1).every(p=>p.stock===0));await assert.rejects(run(d,b,a));
});
test('paid orders cannot dispatch before an invoice and branch ids are server-controlled',async()=>{
 const d=fixture(),id=await run(d,{operation:'commerceOrder',customerId:'customer',mode:'obra',branchId:'forged',items:[{p:'article',q:1}]});
 const r=d.businessRecords.find(r=>r.id===id);assert.equal(r.branchId,'principal');
 await run(d,{operation:'commerceStage',id,stage:'Preparando'});await run(d,{operation:'commerceStage',id,stage:'Listo'});
 await assert.rejects(run(d,{operation:'commerceStage',id,stage:'Enviado',tracking:'123'}));
});
test('route loading reserves availability and returns unsold goods without a second stock entry',async()=>{
 const d=fixture(),a={...access,company:{businessType:'distribuidora'}};d.businessRecords.push({id:'route',module:'rutas',name:'Ruta',items:[],events:[]});
 const id=await run(d,{operation:'commerceLoad',routeId:'route',items:[{p:'article',q:10}]},a);assert.equal(d.products[0].stock,20);assert.equal(commerceReserved(d,'article'),10);
 commerceSaleGuard(d,{commerceLoadId:id,items:[{p:'article',q:3}]},check,null,()=>{});
 commerceLoadSale(d,{commerceLoadId:id},{id:'sale',date:'2026-11-05',items:[{p:'article',q:3}]},check,()=>{});assert.equal(commerceReserved(d,'article'),7);
 await run(d,{operation:'commerceLoadReturn',id,reason:'Recibido todo el sobrante'},a);assert.equal(commerceReserved(d,'article'),0);assert.equal(d.products[0].stock,20);assert.equal(d.businessRecords.find(r=>r.id===id).returnedItems[0].q,7);
});
test('reservations protect later stock operations and sensitive metadata respects extra module permissions',()=>{
 const d=fixture();d.businessRecords.push({id:'hold',kind:'commerce-order',reserved:true,items:[{p:'article',q:21}]});assert.throws(()=>commerceReservationsValid(d,check));
 assert.equal(commerceCanRead({kind:'commerce-supplier'},m=>m==='compras'),false);
 assert.equal(commerceCanRead({kind:'commerce-route-close'},()=>false),false);
});
test('ABC deducts credit notes and distinguishes unsold products',()=>{
 const rows=commerceABC([{id:'p',name:'P',stock:1},{id:'q',name:'Q',stock:0}],[{type:'venta',date:'2026-11-01',items:[{p:'p',q:2,u:1}]},{type:'nota-credito',date:'2026-11-02',items:[{p:'p',q:1,u:1}]}],'2026-11-01','2026-11-05');
 assert.equal(rows[0].amountCents,100);assert.equal(rows[0].q,1);assert.equal(rows[1].abc,'C');assert.equal(rows[1].idleDays,null);
});

test('route cash reconciliation includes load sales, credit collections and cash refunds only once',()=>{
 const records=[{id:'r',module:'rutas',billed:[]},{kind:'commerce-load',routeId:'r',sales:['s']}],entries=[{id:'s',type:'venta',date:'2026-11-05',payments:[{method:'efectivo',amount:8},{method:'transferencia',amount:2}]},{id:'collect',date:'2026-11-05',invoiceId:'s',lines:[{a:'1201',d:0,c:3},{a:'1101',d:3,c:0}]},{id:'refund',type:'nota-credito',date:'2026-11-05',invoiceId:'s',payments:[{method:'efectivo',amount:1}]},{id:'foreign',type:'venta',date:'2026-11-05',payments:[{method:'efectivo',amount:99}]}];
 const rows=commerceRouteCashRows(records,entries,'r','2026-11-05');assert.equal(rows.length,3);assert.equal(rows.reduce((n,r)=>n+r.amountCents,0),1000);assert.equal(rows.reduce((n,r)=>n+r.bankCents,0),200);
});
test('installments allocate actual invoice debt reductions without generating another credit',()=>{
 const record={entryId:'s',installments:[{due:'2026-12-01',amountCents:500},{due:'2027-01-01',amountCents:500}]},entries=[{id:'s',type:'venta',creditAmount:10,lines:[{a:'1201',d:10,c:0}]},{id:'payment',invoiceId:'s',lines:[{a:'1201',d:0,c:6}]}],rows=commerceInstallmentBalances(record,entries);assert.equal(rows[0].remainingCents,0);assert.equal(rows[1].remainingCents,400);
});
