import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {routeOperation,routeOperationGuard,routeSaleGuard,routeCustomerAllowed} from '../netlify/lib/routes.mjs';
import {commerceReserved,commerceLoadSale} from '../netlify/lib/commerce.mjs';
import '../public/role-permissions.js';
const check=(ok,message)=>{if(!ok)throw Error(message)};
const owner={owner:true,branchId:'principal',company:{businessType:'comercio'}};
const worker=(id,role='route_driver')=>({owner:false,branchId:'principal',routeRole:role,member:{id,name:id}});
const team=[{id:'seller',name:'Vendedor',active:true,branchIds:['principal'],routeRole:'route_seller'},{id:'driver',name:'Entregador',active:true,branchIds:['principal'],routeRole:'route_driver'}];
const fixture=()=>({cfg:{},products:[{id:'p',name:'Producto',stock:10,price:2,cost:1,vatRate:0}],customers:[{id:'c',name:'Cliente',currency:'C$',status:'activo',sellerId:'seller',routeZone:'Norte',paymentType:'contado',creditLimit:0,creditDays:30}],businessRecords:[{id:'r',module:'rutas',kind:'route-definition',name:'Ruta norte',route:'Norte',date:'2026-11-12',branchId:'principal',status:'Activa',events:[]}],entries:[],employees:[]});
const context=d=>({check,permit(){},date:v=>v,team,adjust:async()=>assert.fail('No se esperaba ajuste'),sale:async b=>{const e={id:randomUUID(),reference:'A-1',date:b.date,items:b.items,customerId:b.customerId};commerceLoadSale(d,b,e,check,()=>{});d.products[0].stock-=b.items.reduce((n,i)=>n+i.q,0);d.entries.push(e);return e}});
const run=(d,operation,body={},access=owner)=>routeOperation(d,access,{email:'owner@example.test',member:access.member},{operation,operationId:randomUUID(),confirmed:true,date:'2026-11-12',...body},context(d));
async function prepare(d,q=4){const id=await run(d,'routeOrder',{customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q,u:2}]},worker('seller','route_preseller'));const loadId=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'});await run(d,'routeDispatch',{id:loadId});return {id,loadId}}
test('route roles exclude financial administration and presellers cannot issue sales',()=>{
 const policy=globalThis.AcontecRoles.preset('route_preseller',['panel','rutas','facturacion','contabilidad','compras','ajustes','ventas','inventario']);
 assert.equal(policy.modules.rutas.create,true);for(const m of ['contabilidad','compras','ajustes','facturacion'])assert.equal(policy.modules[m].create,false);
 assert.throws(()=>routeOperationGuard(worker('seller','route_preseller'),{operation:'sale'},check));
 assert.throws(()=>routeOperationGuard(worker('driver'),{operation:'routeOrder'},check));
});
test('pre-sale does not reserve stock; preparing reserves once in the assigned truck',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);assert.equal(d.products[0].stock,10);assert.equal(d.entries.length,0);assert.equal(commerceReserved(d,'p'),4);
 assert.equal(d.businessRecords.find(r=>r.id===id).assignedMemberId,'driver');assert.equal(d.businessRecords.find(r=>r.id===loadId).remaining[0].q,4);
 assert.equal(routeCustomerAllowed(d,worker('driver'),'c'),true);assert.equal(routeCustomerAllowed(d,worker('stranger'),'c'),false);
});
test('partial deliveries invoice only actual quantities and reject duplicate delivery ids',async()=>{
 const d=fixture(),{id}=await prepare(d),driver=worker('driver'),deliveryId=randomUUID();
 await run(d,'routeDelivery',{id,deliveryId,items:[{p:'p',q:1}]},driver);assert.equal(d.products[0].stock,9);assert.equal(commerceReserved(d,'p'),3);
 assert.equal(d.businessRecords.find(r=>r.id===id).status,'Parcial');
 await assert.rejects(run(d,'routeDelivery',{id,deliveryId,items:[{p:'p',q:1}]},driver));
 await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:3}]},driver);assert.equal(d.products[0].stock,6);assert.equal(commerceReserved(d,'p'),0);assert.equal(d.entries.length,2);
 await assert.rejects(run(d,'routeOrder',{id,customerId:'c',items:[{p:'p',q:4,u:2}],due:'2026-11-12',status:'Enviado',payment:'efectivo'},driver));
});
test('foreign assignments and sales bypassing the active truck are rejected',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);
 await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1}]},worker('stranger')));
 assert.throws(()=>routeSaleGuard(d,worker('driver'),{customerId:'c'},check));
 assert.doesNotThrow(()=>routeSaleGuard(d,worker('driver'),{operationId:randomUUID(),customerId:'c',commerceLoadId:loadId},check));
});
test('shortages create a review suggestion without reserving or buying stock',async()=>{
 const d=fixture();const id=await run(d,'routeOrder',{customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:12,u:2}]});
 const suggestion=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'});
 assert.equal(d.businessRecords.find(r=>r.id===suggestion).kind,'route-purchase-suggestion');assert.equal(commerceReserved(d,'p'),0);assert.equal(d.products[0].stock,10);assert.equal(d.entries.length,0);
});
test('a worker cannot close inventory differences without approval',async()=>{
 const d=fixture(),{loadId}=await prepare(d);const id=await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:3}],countedCents:0,reason:'Falta una unidad'},worker('driver'));
 assert.equal(d.businessRecords.find(r=>r.id===id).status,'Pendiente');assert.equal(d.businessRecords.find(r=>r.id===loadId).closed,false);assert.equal(d.products[0].stock,10);
});
