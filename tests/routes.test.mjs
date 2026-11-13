import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {routeOperation,routeOperationGuard,routeSaleGuard,routeCustomerAllowed,routeOrderPriceLines,routeCommissionReturn} from '../netlify/lib/routes.mjs';
import {routeNoticeAllowed,routeNoticeContext} from '../netlify/lib/route-notices.mjs';
import {commerceReserved,commerceLoadSale,commerceCheckStock} from '../netlify/lib/commerce.mjs';
import '../public/role-permissions.js';
import {invoiceTotals} from '../public/accounting-math.mjs';
import {commerceRouteCashRows,commerceRouteProfit,commerceRouteApprovalMatches} from '../public/commerce-math.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message)};
const owner={owner:true,branchId:'principal',company:{businessType:'comercio'}};
const worker=(id,role='route_driver')=>({owner:false,branchId:'principal',routeRole:role,member:{id,name:id}});
const team=[{id:'seller',name:'Vendedor',active:true,branchIds:['principal'],routeRole:'route_seller'},{id:'driver',name:'Entregador',active:true,branchIds:['principal'],routeRole:'route_driver'}];
const fixture=()=>({cfg:{},products:[{id:'p',name:'Producto',stock:10,price:2,cost:1,vatRate:0}],customers:[{id:'c',name:'Cliente',currency:'C$',status:'activo',sellerId:'seller',routeZone:'Norte',paymentType:'contado',creditLimit:0,creditDays:30}],businessRecords:[{id:'r',module:'rutas',kind:'route-definition',name:'Ruta norte',route:'Norte',date:'2026-11-12',branchId:'principal',status:'Activa',events:[]}],entries:[],employees:[]});
const context=d=>({check,permit(){},date:v=>v,team,adjust:async()=>assert.fail('No se esperaba ajuste'),sale:async b=>{const e={id:randomUUID(),reference:'A-1',date:b.date,items:b.items,customerId:b.customerId,...invoiceTotals(b.items)};commerceLoadSale(d,b,e,check,()=>{});d.products[0].stock-=b.items.reduce((n,i)=>n+i.q,0);d.entries.push(e);return e}});
const run=(d,operation,body={},access=owner,hooks={})=>routeOperation(d,access,{email:'owner@example.test',member:access.member},{operation,operationId:randomUUID(),confirmed:true,date:'2026-11-12',...body},{...context(d),...hooks});
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
 const d=fixture(),{id:orderId,loadId}=await prepare(d);const id=await run(d,'routeSettle',{id:loadId,orderReasons:[{orderId,reason:'Cliente ausente'}],items:[{p:'p',q:3}],countedCents:0,reason:'Falta una unidad'},worker('driver'));
 assert.equal(d.businessRecords.find(r=>r.id===id).status,'Pendiente');assert.equal(d.businessRecords.find(r=>r.id===loadId).closed,false);assert.equal(d.products[0].stock,10);
});

test('cash settlement spans days, preserves dates, scopes loads and excludes consumed movements',()=>{
 const records=[{id:'r',module:'rutas',route:'Norte'},{id:'l',kind:'commerce-load',routeId:'r',sales:['a','b']},{id:'other',kind:'commerce-load',routeId:'r',sales:['x']}];
 const sale=(id,date,load='l')=>({id,date,type:'venta',commerceLoadId:load,operatorId:'driver',payments:[{method:'efectivo',amount:10}]});
 const entries=[sale('a','2026-11-10'),sale('b','2026-11-11'),sale('x','2026-11-11','other'),{id:'g',date:'2026-11-10',type:'gasto',operatorId:'driver',routeMovement:true,commerceLoadId:'l',lines:[{a:'1104',d:0,c:2}]}];
 const result=commerceRouteCashRows(records,entries,'r','2026-11-12','driver','l');
 assert.deepEqual(result.map(e=>e.entryId).sort(),['a','b','g']);assert.equal(result.reduce((n,e)=>n+e.amountCents,0),1800);assert.equal(result[0].date,'2026-11-10');
 records.push({kind:'route-settlement',status:'Aprobada',entryIds:result.map(e=>e.entryId)});
 assert.equal(commerceRouteCashRows(records,entries,'r','2026-11-13','driver','l').length,0);
});
test('profit uses posted FIFO cost and reverses credit notes without duplicating entries',()=>{
 const sale={id:'v',type:'venta',subtotal:100,total:115,lines:[{a:'5101',d:63,c:0}]};
 const note={id:'n',type:'nota-credito',subtotal:20,total:23,lines:[{a:'5101',d:0,c:12}]};
 assert.deepEqual(commerceRouteProfit([sale,note,sale]),{salesNetCents:10000,salesGrossCents:11500,returnsNetCents:2000,returnsGrossCents:2300,costSoldCents:5100,grossProfitCents:2900});
});
test('pending settlement blocks deliveries, sales and reloads; rejection requires supervisor and reason',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);
 const settlement=await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:4}],countedCents:1,reason:'Revisar efectivo',orderReasons:[{orderId:id,reason:'Ausente'}]},worker('driver'));
 await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1}]},worker('driver')),/pendiente/);
 await assert.rejects(run(d,'routeReload',{id:loadId,items:[{p:'p',q:1}]}),/pendiente/);
 assert.throws(()=>routeSaleGuard(d,owner,{operationId:randomUUID(),customerId:'c',commerceLoadId:loadId},check),/pendiente/);
 await assert.rejects(run(d,'routeRejectSettlement',{id:settlement,reason:'Recontar'},worker('driver')));
 await assert.rejects(run(d,'routeRejectSettlement',{id:settlement}));
 await run(d,'routeRejectSettlement',{id:settlement,reason:'Recontar al regreso'});
 assert.equal(d.businessRecords.find(r=>r.id===settlement).status,'Rechazada');
 await run(d,'routeReload',{id:loadId,items:[{p:'p',q:1}]});
});
test('settlement requires a reason per remainder and preserves quantities and invoice history',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);
 await assert.rejects(run(d,'routeSettle',{id:loadId,items:[{p:'p',q:4}],countedCents:0}),/motivo por cada/);
 const settlement=await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:4}],countedCents:0,orderReasons:[{orderId:id,reason:'Cliente cerrado'}]});
 const order=d.businessRecords.find(r=>r.id===id);assert.equal(order.status,'Por reprogramar');assert.equal(order.remaining[0].q,4);assert.equal(order.events.at(-1).reason,'Cliente cerrado');
 assert.equal(d.businessRecords.find(r=>r.id===settlement).grossProfitCents,0);
});

test('reschedule changes only due and status, preserving delivered history and quantities',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);
 await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1}]},worker('driver'));
 await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:3}],countedCents:0,orderReasons:[{orderId:id,reason:'Entrega parcial por cierre'}]});
 const order=d.businessRecords.find(r=>r.id===id),before=structuredClone({items:order.items,remaining:order.remaining,deliveries:order.deliveries,entries:d.entries});
 await run(d,'routeReschedule',{id,due:'2026-11-14',reason:'Cliente confirma sábado'});
 assert.equal(order.status,'Enviado');assert.equal(order.due,'2026-11-14');assert.equal(order.events.at(-1).previousDue,'2026-11-12');assert.equal(order.events.at(-1).reason,'Cliente confirma sábado');
 assert.deepEqual({items:order.items,remaining:order.remaining,deliveries:order.deliveries,entries:d.entries},before);
});
test('reschedule enforces role, branch, reason, date, confirmation and operation UUID',async()=>{
 const d=fixture(),id=await run(d,'routeOrder',{customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:2,u:2}]});
 for(const role of ['route_preseller','route_seller','route_driver'])await assert.rejects(run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Nueva visita'},worker('seller',role)));
 for(const values of [{reason:''},{due:'2026-11-11'},{confirmed:false},{operationId:'incorrecto'}])await assert.rejects(run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Nueva visita',...values}));
 await assert.rejects(run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Nueva visita'},{...owner,branchId:'otra'}));
 const supervisor=worker('supervisor','route_supervisor');await run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Cliente confirma'},supervisor);
 assert.equal(d.businessRecords.find(r=>r.id===id).due,'2026-11-13');
});
test('active loads and completed or cancelled orders cannot be rescheduled',async()=>{
 const d=fixture(),{id}=await prepare(d);
 await assert.rejects(run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Otra fecha'}));
 const order=d.businessRecords.find(r=>r.id===id);for(const status of ['Entregado','Cancelado','Borrador']){order.status=status;order.reserved=false;order.loadId='';await assert.rejects(run(d,'routeReschedule',{id,due:'2026-11-13',reason:'Otra fecha'}))}
});
async function overdueOrder(d,q=2){return run(d,'routeOrder',{customerId:'c',date:'2026-11-10',due:'2026-11-10',status:'Enviado',payment:'efectivo',items:[{p:'p',q,u:2}]})}
test('preparation explicitly reschedules overdue selected orders and leaves other orders unchanged',async()=>{
 const d=fixture(),id=await overdueOrder(d),other=await overdueOrder(d);
 const loadId=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte',reschedules:[{orderId:id,reason:'Cliente acepta nueva fecha'}]});
 const order=d.businessRecords.find(r=>r.id===id);assert.equal(order.due,'2026-11-12');assert.equal(order.status,'Preparado');assert.equal(order.events.at(-2).action,'routeReschedule');
 assert.equal(d.businessRecords.find(r=>r.id===other).due,'2026-11-10');assert.equal(d.businessRecords.find(r=>r.id===loadId).remaining[0].q,2);
});
test('overdue preparation rejects missing reasons, mixed routes and unselected reschedules',async()=>{
 const d=fixture(),id=await overdueOrder(d),body={orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'};
 await assert.rejects(run(d,'routePrepare',body));
 await assert.rejects(run(d,'routePrepare',{...body,reschedules:[{orderId:id,reason:''}]}));
 await assert.rejects(run(d,'routePrepare',{...body,zone:'Sur',reschedules:[{orderId:id,reason:'Confirmado'}]}));
 await assert.rejects(run(d,'routePrepare',{...body,reschedules:[{orderId:'ajeno',reason:'Confirmado'}]}));
 assert.equal(d.businessRecords.find(r=>r.id===id).due,'2026-11-10');
});
test('shortage suggestions do not reschedule or reserve overdue orders',async()=>{
 const d=fixture(),id=await overdueOrder(d,12),result=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte',reschedules:[{orderId:id,reason:'Nueva visita'}]});
 assert.equal(d.businessRecords.find(r=>r.id===result).kind,'route-purchase-suggestion');const order=d.businessRecords.find(r=>r.id===id);assert.equal(order.due,'2026-11-10');assert.equal(order.status,'Enviado');assert.equal(commerceReserved(d,'p'),0);
});

test('preparation can reschedule a released remainder in the same transaction',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);
 await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:4}],countedCents:0,orderReasons:[{orderId:id,reason:'No entregado: ausente'}]});
 const newLoad=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-13',zone:'Norte',reschedules:[{orderId:id,reason:'Cliente confirma mañana'}]});
 const order=d.businessRecords.find(r=>r.id===id);assert.equal(order.loadId,newLoad);assert.equal(order.due,'2026-11-13');assert.equal(order.remaining[0].q,4);assert.equal(order.events.at(-2).action,'routeReschedule');assert.equal(d.entries.length,0);
});

test('route credit policy is optional, holds over-limit credit orders and requires approval with reason',async()=>{
 const d=fixture();d.customers[0].creditLimit=3;
 const body={customerId:'c',due:'2026-11-12',status:'Enviado',payment:'credito',items:[{p:'p',q:2,u:2}]};
 const warn=await run(d,'routeOrder',body);assert.equal(d.businessRecords.find(r=>r.id===warn).status,'Enviado');
 await run(d,'routePolicy',{id:'r',requireCreditApproval:true,allowSaleWithoutLoad:true});
 const id=await run(d,'routeOrder',body),order=d.businessRecords.find(r=>r.id===id);assert.equal(order.status,'Pendiente de aprobación');
 await assert.rejects(run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'}));
 await assert.rejects(run(d,'routeApproveOrder',{id,reason:'Solicitado'},worker('seller','route_preseller')));
 await assert.rejects(run(d,'routeApproveOrder',{id}));
 await run(d,'routeApproveOrder',{id,reason:'Revisado con cliente'});assert.equal(order.status,'Enviado');assert.equal(order.creditApproval.totalCents,400);
 await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'});assert.equal(order.status,'Preparado');
 assert.equal(d.customers[0].creditLimit,3);assert.equal(d.entries.length,0);
});
test('credit approval is invalidated when the order is edited and draft/send cannot bypass policy',async()=>{
 const d=fixture();d.customers[0].creditLimit=3;await run(d,'routePolicy',{requireCreditApproval:true,allowSaleWithoutLoad:true});
 const body={customerId:'c',due:'2026-11-12',status:'Borrador',payment:'credito',items:[{p:'p',q:2,u:2}]};
 const id=await run(d,'routeOrder',body),order=d.businessRecords.find(r=>r.id===id);await run(d,'routeOrderState',{id,status:'Enviado'});assert.equal(order.status,'Pendiente de aprobación');
 await run(d,'routeApproveOrder',{id,reason:'Revisado'});await run(d,'routeOrder',{...body,id,status:'Enviado',items:[{p:'p',q:3,u:2}]});assert.equal(order.creditApproval,null);assert.equal(order.status,'Pendiente de aprobación');
});
test('special prices use the injected normal invoice price, require approval, and reject combined discounts',async()=>{
 const d=fixture(),body={customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:2,u:1.5}]};
 const lines=routeOrderPriceLines(d,body,()=>1.75);assert.equal(lines[0].normalPriceCents,175);assert.equal(lines[0].specialPrice,true);
 const id=await run(d,'routeOrder',body),order=d.businessRecords.find(r=>r.id===id);assert.equal(order.status,'Pendiente de aprobación');assert.equal(order.priceLines[0].unitPriceCents,150);
 await assert.rejects(run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'}));
 await assert.rejects(run(d,'routeOrder',{...body,discount:5}));
 await assert.rejects(run(d,'routeApproveOrder',{id,reason:'Precio negociado'}));
 let consumed=0;await run(d,'routeApproveOrder',{id,reason:'Precio negociado',discountAuthorization:'grant'},owner,{approveOrderPrices:async r=>{consumed++;return {id:randomUUID(),orderId:r.id}}});
 assert.equal(consumed,1);assert.equal(order.status,'Enviado');assert.ok(order.priceApproval);
 const loadId=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'},owner,{checkOrderPrices:async r=>assert.ok(r.priceApproval)});
 await run(d,'routeDispatch',{id:loadId});await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1,u:1.4}]},worker('driver')),/precio/);
 await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1,u:1.5}]},worker('driver'));assert.equal(d.entries[0].items[0].u,1.5);
});
test('delivery preserves order price, rejects altered prices, forces zero discount and supplies the trusted order internally',async()=>{
 const d=fixture(),{id}=await prepare(d),order=d.businessRecords.find(r=>r.id===id);let issued=0;
 await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1,u:1.99}]},worker('driver')),/precio/);
 await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1,u:2}],discount:50,loyalty:true,previousDay:true},worker('driver'),{sale:async (body,source,trusted)=>{issued++;assert.equal(body.discount,0);assert.equal(body.loyalty,false);assert.equal(body.previousDay,false);assert.equal(body.items[0].u,2);assert.equal(trusted,order);return context(d).sale(body)}});
 assert.equal(issued,1);assert.equal(d.entries[0].items[0].u,2);
});
test('server-loaded price approvals bind order, customer, branch, policy, price and quantity',()=>{
 const order={id:'o'},body={customerId:'c',items:[{p:'p',q:1,u:1.5}]},approval={orderId:'o',customerId:'c',branchId:'principal',policyVersion:2,lines:[{productId:'p',q:4,unitPriceCents:150}]};
 assert.equal(commerceRouteApprovalMatches(approval,order,body,'principal',2),true);
 for(const bad of [{...body,customerId:'other'},{...body,items:[{p:'p',q:1,u:1.4}]},{...body,items:[{p:'p',q:5,u:1.5}]},{...body,items:[{p:'other',q:1,u:1.5}]}])assert.equal(commerceRouteApprovalMatches(approval,order,bad,'principal',2),false);
 assert.equal(commerceRouteApprovalMatches(approval,order,body,'other',2),false);assert.equal(commerceRouteApprovalMatches(approval,order,body,'principal',3),false);assert.equal(commerceRouteApprovalMatches(approval,{id:'other'},body,'principal',2),false);assert.equal(commerceRouteApprovalMatches(null,order,body,'principal',2),false);
});
test('sales without load require explicit company/route permission',async()=>{
 const d=fixture(),seller=worker('seller','route_seller'),body={operationId:randomUUID(),customerId:'c'};
 assert.throws(()=>routeSaleGuard(d,seller,body,check),/sin carga/);
 await run(d,'routePolicy',{requireCreditApproval:false,allowSaleWithoutLoad:false});assert.throws(()=>routeSaleGuard(d,seller,body,check),/sin carga/);
 await run(d,'routePolicy',{id:'r',requireCreditApproval:null,allowSaleWithoutLoad:true});assert.doesNotThrow(()=>routeSaleGuard(d,seller,body,check));
 await run(d,'routePolicy',{id:'r',requireCreditApproval:null,allowSaleWithoutLoad:null});assert.throws(()=>routeSaleGuard(d,seller,body,check));
 await assert.rejects(run(d,'routePolicy',{id:'r',requireCreditApproval:false,allowSaleWithoutLoad:true},seller));
 await assert.rejects(run(d,'routePolicy',{requireCreditApproval:false,allowSaleWithoutLoad:true},worker('supervisor','route_supervisor')));
});

test('acknowledging a notice records the server actor/time once without changing its source',async()=>{
 const d=fixture(),id=await overdueOrder(d),source=d.businessRecords.find(r=>r.id===id),n=d.businessRecords.find(r=>r.kind==='route-notice'&&r.sourceId===id),before=structuredClone(source),operationId=randomUUID();
 await run(d,'routeNoticeAck',{id:n.id,operationId},owner);assert.equal(n.status,'Atendido');assert.equal(n.acknowledgedBy,'owner@example.test');assert.ok(Number.isFinite(Date.parse(n.acknowledgedAt)));
 const ack=structuredClone(n);await run(d,'routeNoticeAck',{id:n.id,operationId},owner);assert.deepEqual(n,ack);assert.deepEqual(source,before);assert.equal(d.entries.length,0);
});
test('notice attention enforces UUID, confirmation, branch and source scope for all route roles',async()=>{
 const d=fixture(),id=await overdueOrder(d),source=d.businessRecords.find(r=>r.id===id),n=d.businessRecords.find(r=>r.kind==='route-notice'&&r.sourceId===id);source.operatorId='seller';
 await assert.rejects(run(d,'routeNoticeAck',{id:n.id},worker('stranger','route_seller')));
 await assert.rejects(run(d,'routeNoticeAck',{id:n.id},{...owner,branchId:'otra'}));
 for(const invalid of [{operationId:'no-es-uuid'},{confirmed:false}])await assert.rejects(run(d,'routeNoticeAck',{id:n.id,...invalid}));
 for(const role of ['route_seller','route_driver','route_preseller','route_supervisor'])assert.doesNotThrow(()=>routeOperationGuard(worker('seller',role),{operation:'routeNoticeAck'},check));
 await run(d,'routeNoticeAck',{id:n.id},worker('seller','route_preseller'));assert.equal(n.acknowledgedBy,'seller');
});
test('notice visibility follows current order/truck assignments and rejects missing or foreign sources',()=>{
 const order={id:'o',module:'rutas',kind:'route-order',branchId:'principal',operatorId:'seller',assignedMemberId:'new-driver'},delivery={id:'d',module:'rutas',kind:'route-delivery',branchId:'principal',operatorId:'old-driver',assignedMemberId:'old-driver',orderId:'o'},n={id:'n',module:'rutas',kind:'route-notice',branchId:'principal',operatorId:'old-driver',assignedMemberId:'old-driver',sourceId:'d'},rows=[order,delivery,n];
 assert.equal(routeNoticeAllowed(rows,worker('old-driver'),n),false);assert.equal(routeNoticeAllowed(rows,worker('new-driver'),n),true);assert.equal(routeNoticeAllowed(rows,worker('seller','route_preseller'),n),true);assert.equal(routeNoticeContext(rows,n).authority.id,'o');
 assert.equal(routeNoticeAllowed(rows,worker('stranger'),n),false);assert.equal(routeNoticeAllowed(rows,worker('new-driver'),{...n,branchId:'otra'}),false);assert.equal(routeNoticeAllowed(rows,worker('new-driver'),{...n,sourceId:'missing'}),false);
 const load={id:'l',module:'rutas',kind:'commerce-load',branchId:'principal',assignedMemberId:'new-driver'},settlement={id:'s',module:'rutas',kind:'route-settlement',branchId:'principal',assignedMemberId:'old-driver',loadId:'l'};const cashNotice={...n,sourceId:'s'};
 assert.equal(routeNoticeAllowed([load,settlement],worker('old-driver'),cashNotice),false);assert.equal(routeNoticeAllowed([load,settlement],worker('new-driver'),cashNotice),true);
});
test('overdue refresh creates one durable notice per order/due, even after acknowledgement and retries',async()=>{
 const d=fixture(),id=await overdueOrder(d),order=d.businessRecords.find(r=>r.id===id);order.operatorId='seller';
 await run(d,'routeNoticeRefresh',{date:'2099-01-01'},worker('seller','route_preseller'),{today:()=> '2026-11-12'});
 const late=()=>d.businessRecords.filter(r=>r.kind==='route-notice'&&r.type==='atraso');assert.equal(late().length,1);assert.equal(late()[0].overdueDue,'2026-11-10');
 await run(d,'routeNoticeAck',{id:late()[0].id},worker('seller','route_preseller'));
 await run(d,'routeNoticeRefresh',{},worker('seller','route_preseller'),{today:()=> '2026-11-12'});assert.equal(late().length,1);
 order.due='2026-11-11';await run(d,'routeNoticeRefresh',{},worker('seller','route_preseller'),{today:()=> '2026-11-12'});assert.equal(late().length,2);
 assert.equal(d.entries.length,0);assert.equal(order.status,'Enviado');
});
test('overdue refresh excludes other assignments/branches, future orders, and closed orders',async()=>{
 const d=fixture(),id=await overdueOrder(d),r=d.businessRecords.find(r=>r.id===id);r.operatorId='foreign';r.assignedMemberId='foreign';
 await run(d,'routeNoticeRefresh',{},worker('seller','route_preseller'),{today:()=> '2026-11-12'});assert.equal(d.businessRecords.filter(r=>r.type==='atraso').length,0);
 r.operatorId='seller';for(const values of [{status:'Entregado',branchId:'principal',due:'2026-11-10'},{status:'Enviado',branchId:'otra',due:'2026-11-10'},{status:'Enviado',branchId:'principal',due:'2026-11-13'}]){Object.assign(r,values);await run(d,'routeNoticeRefresh',{},worker('seller','route_preseller'),{today:()=> '2026-11-12'})}
 assert.equal(d.businessRecords.filter(r=>r.type==='atraso').length,0);
});

import {usualProducts,nearbyOrder,pickingRows,scheduledDays} from '../public/route-field-math.mjs';
test('usual products ignore cancelled orders and keep deterministic frequency suggestions',()=>{
 const orders=[{customerId:'c',items:[{p:'a'},{p:'b'}]},{customerId:'c',items:[{p:'b'}]},{customerId:'c',status:'Cancelado',items:[{p:'z'}]},{customerId:'other',items:[{p:'z'}]}];assert.deepEqual(usualProducts(orders,'c'),['b','a']);
});
test('nearby suggestion uses latest captured locations, preserves start and includes unlocated clients',()=>{
 const clients=['a','b','c','d'].map((id,i)=>({id,routeOrder:i+1})),visits=[{customerId:'a',date:'2026-11-11',location:{latitude:0,longitude:0}},{customerId:'b',date:'2026-11-11',location:{latitude:0,longitude:1}},{customerId:'c',date:'2026-11-11',location:{latitude:0,longitude:10}},{customerId:'c',date:'2026-11-12',location:{latitude:0,longitude:0.1}}];assert.deepEqual(nearbyOrder(clients,visits),['a','c','b','d']);assert.deepEqual(clients.map(c=>c.id),['a','b','c','d']);
});
test('supervisor confirms customer visit order without changing assignments or commercial terms',async()=>{
 const d=fixture();d.customers.push({...d.customers[0],id:'c2'});const original=d.customers.map(c=>({...c}));await run(d,'routeVisitOrder',{zone:'Norte',customerIds:['c2','c'],reason:'Recorrido confirmado'});assert.equal(d.customers[0].routeOrder,2);assert.equal(d.customers[1].routeOrder,1);for(let i=0;i<2;i++)assert.deepEqual({...d.customers[i],routeOrder:undefined},{...original[i],routeOrder:undefined});
 await assert.rejects(run(d,'routeVisitOrder',{zone:'Norte',customerIds:['c'],reason:'Cambio'},worker('seller','route_seller')));await assert.rejects(run(d,'routeVisitOrder',{zone:'Norte',customerIds:['c','c'],reason:'Cambio'}));await assert.rejects(run(d,'routeVisitOrder',{zone:'Otra',customerIds:['c'],reason:'Cambio'}));
});
test('picking freezes original remaining quantities and delivery order at departure',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d,4),l=d.businessRecords.find(r=>r.id===loadId);assert.equal(pickingRows(l)[0].q,4);await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1}]},worker('driver'));assert.equal(d.businessRecords.find(r=>r.id===id).remaining[0].q,3);assert.equal(pickingRows(l)[0].q,4);assert.equal(pickingRows(l)[0].deliveryOrder,1);
});
test('delivery photo is stored through trusted attachment hook and keeps one invoice',async()=>{
 const d=fixture(),{id}=await prepare(d);let uploads=0;await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:4}],photo:{content:'payload'}},worker('driver'),{storePhoto:async file=>{uploads++;assert.equal(file.content,'payload');return {key:'company/private',type:'image/jpeg',size:100}}});assert.equal(uploads,1);assert.equal(d.entries.length,1);assert.equal(d.businessRecords.find(r=>r.kind==='route-delivery').proof.photo.key,'company/private');
});
test('archive preserves records and invoice history and excludes open orders, pending notices and active partial deliveries',async()=>{
 const d=fixture(),old='2020-01-01',base={module:'rutas',date:old,branchId:'principal',events:[{at:old}]};d.businessRecords.push({...base,id:'closed',kind:'route-order',status:'Entregado',items:[{p:'p',q:1}],deliveries:['delivery']},{...base,id:'open',kind:'route-order',status:'Parcial'},{...base,id:'delivery',kind:'route-delivery',orderId:'closed'},{...base,id:'partial',kind:'route-delivery',orderId:'open'},{...base,id:'visit',kind:'commerce-visit'},{...base,id:'notice',kind:'route-notice',status:'Atendido',acknowledgedAt:old},{...base,id:'pending',kind:'route-notice',status:'Pendiente'},{...base,id:'foreign',kind:'commerce-visit',branchId:'otra'});const count=d.businessRecords.length;await run(d,'routeArchive',{days:90,reason:'Archivo confirmado'});assert.equal(d.businessRecords.length,count);for(const id of ['closed','delivery','visit','notice'])assert.ok(d.businessRecords.find(r=>r.id===id).archivedAt);for(const id of ['open','partial','pending','foreign'])assert.equal(d.businessRecords.find(r=>r.id===id).archivedAt,undefined);const history=d.businessRecords.find(r=>r.id==='closed').events.length;await run(d,'routeArchive',{days:90,reason:'Archivo confirmado'});assert.equal(d.businessRecords.find(r=>r.id==='closed').events.length,history);assert.deepEqual(d.businessRecords.find(r=>r.id==='closed').deliveries,['delivery']);await assert.rejects(run(d,'routeArchive',{days:0,reason:'No'}));await assert.rejects(run(d,'routeArchive',{days:90,reason:'No'},worker('seller','route_preseller')));
});
test('worker targets store integer cents and require manager, active worker and reason',async()=>{
 const d=fixture();await run(d,'routeTargets',{id:'r',targets:[{memberId:'seller',targetCents:12500}],reason:'Meta acordada'});assert.deepEqual(d.businessRecords[0].workerTargets,[{memberId:'seller',targetCents:12500}]);await assert.rejects(run(d,'routeTargets',{id:'r',targets:[{memberId:'seller',targetCents:1.5}],reason:'Cambio'}));await assert.rejects(run(d,'routeTargets',{id:'r',targets:[{memberId:'unknown',targetCents:100}],reason:'Cambio'}));await assert.rejects(run(d,'routeTargets',{id:'r',targets:[],reason:'Cambio'},worker('seller','route_seller')));
});
test('scheduled visit counts handle whole weeks, leap day and invalid intervals without daily loops',()=>{
 assert.equal(scheduledDays([0,1,2,3,4,5,6],'2026-11-01','2026-11-30'),30);assert.equal(scheduledDays([1],'2026-11-01','2026-11-30'),5);assert.equal(scheduledDays([4],'2024-02-29','2024-02-29'),1);assert.equal(scheduledDays([1],'2026-11-30','2026-11-01'),0);
});
import {routePhotoAllowed} from '../netlify/lib/routes.mjs';
test('private delivery photo enforces branch and current order plus delivery assignment',()=>{
 const order={id:'order',kind:'route-order',branchId:'principal',assignedMemberId:'driver'},delivery={id:'delivery',kind:'route-delivery',branchId:'principal',orderId:'order',assignedMemberId:'driver'},records=[order,delivery];assert.equal(routePhotoAllowed(records,worker('driver'),delivery),true);assert.equal(routePhotoAllowed(records,worker('other'),delivery),false);order.assignedMemberId='other';assert.equal(routePhotoAllowed(records,worker('driver'),delivery),false);assert.equal(routePhotoAllowed([],owner,delivery),false);order.branchId='other';assert.equal(routePhotoAllowed(records,owner,delivery),false);
});

import {queuePayload,queueScope,durableRoutePayload,validateQueueRow} from '../public/route-queue.mjs';
import {replayOperationReceipt} from '../netlify/lib/operation-replay.mjs';
import {createHash} from 'node:crypto';
import {routeCommission} from '../netlify/lib/routes.mjs';
test('device queue accepts only confirmed pre-sale drafts/sent orders and visits, without fiscal fields',()=>{
 const source={customerId:'c',date:'2026-11-12',due:'2026-11-13',status:'Enviado',payment:'credito',confirmed:true,items:[{p:'p',q:2,u:3,authorization:'ignored'}],invoiceId:'NEVER',photo:{content:'NEVER'},password:'NEVER',signature:[[1,2]]},id=randomUUID(),p=queuePayload('routeOrder',source,id);
 assert.equal(p.operationId,id);assert.equal(p.id,'');assert.deepEqual(p.items,[{p:'p',q:2,u:3}]);for(const key of ['invoiceId','photo','password','signature'])assert.equal(p[key],undefined);source.items[0].q=99;assert.equal(p.items[0].q,2);
 for(const operation of ['sale','routeDelivery','routeCollect','routeExpense','routeSettle','creditNote'])assert.throws(()=>queuePayload(operation,source,randomUUID()));for(const status of ['Entregado','Preparado','Parcial','Pendiente de aprobación'])assert.throws(()=>queuePayload('routeOrder',{...source,status},randomUUID()));assert.throws(()=>queuePayload('routeOrder',{...source,confirmed:false},id));assert.throws(()=>queuePayload('routeVisit',{...source,confirmed:true},'bad'));
 const visit=queuePayload('routeVisit',{confirmed:true,customerId:'c',result:'Realizada',location:{latitude:0,longitude:0,accuracy:10},invoiceId:'NEVER'},randomUUID());assert.equal(visit.invoiceId,undefined);assert.deepEqual(visit.location,{latitude:0,longitude:0,accuracy:10});
});
test('queue scope isolates user, member, company and branch without credentials',()=>{
 const user={email:'a@example.test'},company={id:'company',memberId:'seller',branchId:'principal'},scope=queueScope(user,company);for(const changed of [{id:'other'},{memberId:'other'},{branchId:'other'}])assert.notEqual(scope,queueScope(user,{...company,...changed}));assert.notEqual(scope,queueScope({email:'b@example.test'},company));assert.throws(()=>queueScope(user,{id:'company'}));
});
test('durable payload preserves original UUID/content across revision envelopes and rejects fiscal replay',()=>{
 const id=randomUUID(),payload={...queuePayload('routeOrder',{confirmed:true,status:'Enviado',customerId:'c',date:'2026-11-12',due:'2026-11-13',items:[{p:'p',q:1,u:2}]},id),branchId:'principal'},row={operationId:id,branchId:'principal',payload};assert.equal(validateQueueRow(row),row);
 const one=durableRoutePayload({...payload,revision:1}),two=durableRoutePayload({...payload,revision:999});assert.deepEqual(one,two);assert.equal(one.operationId,id);assert.deepEqual(payload.items,[{p:'p',q:1,u:2}]);assert.throws(()=>validateQueueRow({...row,payload:{...payload,operation:'sale'}}));assert.throws(()=>validateQueueRow({...row,payload:{...payload,invoiceId:'forged'}}));assert.throws(()=>validateQueueRow({...row,branchId:'other'}));assert.throws(()=>durableRoutePayload({...payload,operation:'routeDelivery'}));const normal={operation:'sale',revision:3};assert.equal(durableRoutePayload(normal),normal);
});
test('transaction receipt replay with the same operationId returns the first order without another mutation',async()=>{
 const d=fixture(),operationId=randomUUID(),body={operation:'routeOrder',operationId,confirmed:true,durableRoute:true,branchId:'principal',customerId:'c',due:'2026-11-12',date:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:2,u:2}]},hash=b=>createHash('sha256').update(JSON.stringify(durableRoutePayload(b))).digest('hex'),actor='owner@example.test::principal',operation={id:operationId,hash:hash({...body,revision:1})};
 assert.equal(replayOperationReceipt(null,operation,actor,check),null);const id=await run(d,'routeOrder',body);const before=structuredClone(d),stored={actor,payloadHash:operation.hash,revision:2,resultId:id};const result=replayOperationReceipt(stored,{id:operationId,hash:hash({...body,revision:2})},actor,(message)=>{throw Error(message)});assert.deepEqual(result,{revision:2,replayed:true,resultId:id});assert.deepEqual(d,before);assert.equal(d.businessRecords.filter(r=>r.kind==='route-order').length,1);
 assert.throws(()=>replayOperationReceipt(stored,{hash:hash({...body,note:'Contenido cambiado'})},actor,(message)=>{throw Error(message)}));assert.throws(()=>replayOperationReceipt(stored,operation,'otro actor',(message)=>{throw Error(message)}));
});
test('durable route writes still enforce branch, UUID, confirmation and ordinary order validation',async()=>{
 const d=fixture(),body={durableRoute:true,branchId:'principal',customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:1,u:2}]};await assert.rejects(run(d,'routeOrder',{...body,branchId:'other'}));await assert.rejects(run(d,'routeOrder',{...body,confirmed:false}));await assert.rejects(run(d,'routeOrder',{...body,operationId:'bad'}));await assert.rejects(run(d,'routeOrder',{...body,items:[{p:'missing',q:1,u:2}]}));assert.equal(d.businessRecords.filter(r=>r.kind==='route-order').length,0);
});
test('route collection rejects overpayment and presellers and records an authorized collection once',async()=>{
 const d=fixture();d.entries.push({id:'invoice',type:'venta',customerId:'c',date:'2026-11-10',reference:'A-1',pay:'1201',creditAmount:10,lines:[{a:'1201',d:10,c:0}]});const body={invoiceId:'invoice',amountCents:1001,method:'efectivo',shiftId:'shift'};await assert.rejects(run(d,'routeCollect',body,worker('seller','route_seller')));await assert.rejects(run(d,'routeCollect',{...body,amountCents:100},worker('seller','route_preseller')));
 const hooks={shift:()=>({id:'shift'}),entry:e=>{const record={id:randomUUID(),...e};d.entries.push(record);return record}};await run(d,'routeCollect',{...body,amountCents:400},worker('seller','route_seller'),hooks);assert.equal(d.businessRecords.filter(r=>r.kind==='route-collection').length,1);assert.equal(d.entries.at(-1).total,4);await assert.rejects(run(d,'routeCollect',{...body,amountCents:601},worker('seller','route_seller'),hooks));
});
test('damaged and expired returns go only to loss while saleable returns replenish the selected truck',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d,4);await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:4}]},worker('driver'));const invoice=d.entries[0];invoice.type='venta';invoice.reference='A-1';const body={invoiceId:invoice.id,items:[{p:'p',q:1}],loadId};for(const reason of ['dañado','vencido'])for(const destination of ['camion','inventario'])await assert.rejects(run(d,'routeReturnRequest',{...body,reason,destination},worker('driver')));
 const returnId=await run(d,'routeReturnRequest',{...body,reason:'error de pedido',destination:'camion'},worker('driver')),load=d.businessRecords.find(r=>r.id===loadId),before=load.remaining[0].q;await run(d,'routeReturnApprove',{id:returnId},{...owner},{credit:async b=>{const note={id:randomUUID(),invoiceId:b.id,items:b.items};d.entries.push(note);return note}});assert.equal(load.remaining[0].q,before+1);assert.equal(load.customerReturns.length,1);await assert.rejects(run(d,'routeReturnApprove',{id:returnId}));
 for(const reason of ['dañado','vencido']){const request=await run(d,'routeReturnRequest',{...body,reason,destination:'merma'},worker('driver'));let removed=0;await run(d,'routeReturnApprove',{id:request},owner,{credit:async b=>({id:randomUUID(),items:b.items}),adjust:async b=>{assert.equal(b.delta,-1);removed++}});assert.equal(removed,1)}
});
test('supervisor approval closes pending settlement differences and preserves the audit reason',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d,4),body={id:loadId,orderReasons:[{orderId:id,reason:'Cliente ausente'}],items:[{p:'p',q:3}],countedCents:0,reason:'Falta una unidad'};const pending=await run(d,'routeSettle',body,worker('driver'));await assert.rejects(run(d,'routeApproveSettlement',body,worker('driver')));let adjusted=0;const approved=await run(d,'routeApproveSettlement',body,owner,{adjust:async b=>{assert.equal(b.delta,-1);adjusted++}});assert.equal(adjusted,1);assert.equal(d.businessRecords.find(r=>r.id===pending).approvalId,approved);assert.equal(d.businessRecords.find(r=>r.id===approved).reason,'Falta una unidad');assert.equal(d.businessRecords.find(r=>r.id===loadId).closed,true);assert.equal(d.businessRecords.find(r=>r.id===id).status,'Por reprogramar');
});
test('truck reassignment carries open deliveries and blocks the old worker',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);await assert.rejects(run(d,'routeAssign',{id,memberId:'seller',deliveryOrder:1}));await run(d,'routeReassignLoad',{id:loadId,memberId:'seller',reason:'Cambio de turno'});assert.equal(d.businessRecords.find(r=>r.id===id).assignedMemberId,'seller');await run(d,'routeAssign',{id,memberId:'seller',deliveryOrder:2});assert.equal(d.businessRecords.find(r=>r.id===id).deliveryOrder,2);await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1}]},worker('driver')));
});
test('cancelling a prepared order releases reservation without stock or invoice movement',async()=>{
 const d=fixture(),id=await run(d,'routeOrder',{customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:4,u:2}]}),loadId=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'});assert.equal(commerceReserved(d,'p'),4);await run(d,'routeOrderState',{id,status:'Cancelado',reason:'Cliente cancela antes de salir'});assert.equal(commerceReserved(d,'p'),0);assert.equal(d.products[0].stock,10);assert.equal(d.entries.length,0);assert.equal(d.businessRecords.find(r=>r.id===loadId).orderIds.length,0);assert.equal(d.businessRecords.find(r=>r.id===id).status,'Cancelado');
});
test('commission proposals do not duplicate a sale/employee on retry',()=>{
 const d=fixture();d.employees.push({id:'employee',active:true});d.businessRecords[0].commissions=[{memberId:'seller',employeeId:'employee',rate:3}];const entry={id:'sale',date:'2026-11-12',route:'Norte',reference:'A-1',branchId:'principal'};routeCommission(d,entry,['seller']);routeCommission(d,entry,['seller']);assert.equal(d.businessRecords.filter(r=>r.module==='comisiones'&&r.saleId==='sale').length,1);
});
test('closing a multi-day load on the following day consumes every pending movement and stores route profit',async()=>{
 const d=fixture(),load={id:'load',module:'rutas',kind:'commerce-load',branchId:'principal',date:'2026-11-09',routeId:'r',route:'Norte',assignedMemberId:'driver',status:'En reparto',closed:false,items:[{p:'p',q:1}],remaining:[{p:'p',q:1}],orderIds:[],sales:['sale'],events:[]};d.businessRecords.push(load);
 d.entries.push({id:'sale',type:'venta',commerceLoadId:'load',date:'2026-11-09',operatorId:'driver',subtotal:100,total:115,payments:[{method:'efectivo',amount:115}],lines:[{a:'5101',d:60,c:0}]},{id:'expense',type:'gasto',commerceLoadId:'load',routeMovement:true,routeCashCents:-500,date:'2026-11-10',operatorId:'driver',total:5,lines:[{a:'6104',d:5,c:0},{a:'1104',d:0,c:5}]},{id:'collection',type:'abono',commerceLoadId:'load',routeMovement:true,routeCashCents:1000,date:'2026-11-11',operatorId:'driver',total:10,lines:[{a:'1104',d:10,c:0},{a:'1201',d:0,c:10}]});
 const id=await run(d,'routeSettle',{id:'load',date:'2026-11-12',items:[{p:'p',q:1}],countedCents:12000,reason:'Cierre al día siguiente'}),settlement=d.businessRecords.find(r=>r.id===id);assert.equal(settlement.amountCents,12000);assert.deepEqual(settlement.entryIds.sort(),['collection','expense','sale']);assert.deepEqual(settlement.cashRows.map(r=>r.date).sort(),['2026-11-09','2026-11-10','2026-11-11']);assert.equal(settlement.salesNetCents,10000);assert.equal(settlement.salesGrossCents,11500);assert.equal(settlement.costSoldCents,6000);assert.equal(settlement.grossProfitCents,4000);assert.equal(commerceRouteCashRows(d.businessRecords,d.entries,'r','2026-11-13','driver','load').length,0);await assert.rejects(run(d,'routeSettle',{id:'load',items:[],countedCents:0}));
});
test('ordinary fiscal operations keep revision in their idempotency hash',()=>{
 const hash=b=>createHash('sha256').update(JSON.stringify(durableRoutePayload(b))).digest('hex'),body={operation:'sale',operationId:randomUUID(),revision:1};assert.notEqual(hash(body),hash({...body,revision:2}));assert.throws(()=>durableRoutePayload({...body,durableRoute:true}));
});
test('pending settlement keeps authorized collections and shift expenses available',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);await run(d,'routeSettle',{id:loadId,items:[{p:'p',q:3}],orderReasons:[{orderId:id,reason:'No entregado'}],countedCents:0,reason:'Diferencia pendiente'},worker('driver'));
 d.entries.push({id:'credit',type:'venta',date:'2026-11-10',customerId:'c',pay:'1201',creditAmount:5,reference:'CR-1',lines:[{a:'1201',d:5,c:0}]});const hooks={shift:()=>({id:'shift'}),cashAvailable:()=>1000,entry:e=>{const row={id:randomUUID(),...e};d.entries.push(row);return row}};
 await run(d,'routeCollect',{invoiceId:'credit',method:'efectivo',amountCents:200,shiftId:'shift'},worker('driver'),hooks);await run(d,'routeExpense',{amountCents:100,reason:'Estacionamiento',shiftId:'shift'},worker('driver'),hooks);assert.equal(d.businessRecords.filter(r=>r.kind==='route-collection').length,1);assert.equal(d.businessRecords.filter(r=>r.kind==='route-expense').length,1);assert.equal(d.businessRecords.find(r=>r.kind==='route-settlement').status,'Pendiente');assert.equal(d.businessRecords.find(r=>r.id===loadId).closed,false);
});

import {commerceOperation} from '../netlify/lib/commerce.mjs';
import {projectRouteSettlement} from '../netlify/lib/routes.mjs';
test('delivery skips a zero line, leaves its remainder and invoices only positive quantities',async()=>{
 const d=fixture();d.products.push({...d.products[0],id:'p2',unit:'libra'});
 const id=await run(d,'routeOrder',{customerId:'c',due:'2026-11-12',status:'Enviado',payment:'efectivo',items:[{p:'p',q:2,u:2},{p:'p2',q:1.125,u:2}]},worker('seller','route_preseller'));
 const loadId=await run(d,'routePrepare',{orderIds:[id],memberId:'driver',deliveryDate:'2026-11-12',zone:'Norte'});await run(d,'routeDispatch',{id:loadId});
 await run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:1},{p:'p2',q:0}]},worker('driver'));
 assert.equal(d.entries.length,1);assert.deepEqual(d.entries[0].items.map(i=>i.p),['p']);const order=d.businessRecords.find(r=>r.id===id);assert.equal(order.remaining.find(i=>i.p==='p2').q,1.125);assert.equal(order.status,'Parcial');
});
test('all-zero delivery issues no invoice and preserves pending quantities',async()=>{
 const d=fixture(),{id}=await prepare(d);await assert.rejects(run(d,'routeDelivery',{id,deliveryId:randomUUID(),items:[{p:'p',q:0}]},worker('driver')),/Entrega no realizada/);assert.equal(d.entries.length,0);assert.equal(d.businessRecords.find(r=>r.id===id).remaining[0].q,4);
});
test('departure and reload ignore zeros but require a positive product',async()=>{
 const d=fixture();d.products.push({...d.products[0],id:'p2',unit:'quintal'});
 const load=b=>commerceOperation(d,owner,{email:'owner@example.test'},{operation:'commerceLoad',operationId:randomUUID(),confirmed:true,date:'2026-11-12',routeId:'r',...b},context(d));
 await assert.rejects(load({items:[{p:'p',q:0}]}),/mayor que cero/);
 const id=await load({items:[{p:'p',q:0},{p:'p2',q:1.125}]}),l=d.businessRecords.find(r=>r.id===id);assert.deepEqual(l.items.map(i=>[i.p,i.q]),[['p2',1.125]]);
 await assert.rejects(run(d,'routeReload',{id,items:[{p:'p',q:0}]}),/mayor que cero/);await run(d,'routeReload',{id,items:[{p:'p',q:0},{p:'p2',q:0.125}]});assert.equal(l.items[0].q,1.25);assert.equal(l.items.length,1);
});
test('zero truck return is valid and shortage keeps supervisor approval and reason',async()=>{
 const d=fixture(),{id,loadId}=await prepare(d);const body={id:loadId,items:[{p:'p',q:0}],countedCents:0,orderReasons:[{orderId:id,reason:'Ausente'}],reason:'No regresó mercadería'};const pending=await run(d,'routeSettle',body,worker('driver'));assert.equal(d.businessRecords.find(r=>r.id===pending).counts[0].q,0);await run(d,'routeApproveSettlement',body,owner,{adjust:async b=>assert.equal(b.delta,-4)});assert.equal(d.businessRecords.find(r=>r.id===loadId).returnedItems[0].q,0);
});
test('settlement projection exposes cost and profit exclusively to owner and route supervisor',()=>{
 const r={kind:'route-settlement',costSoldCents:120,grossProfitCents:80,amountCents:200};for(const a of [worker('seller','route_seller'),worker('driver'),{owner:false}]){const view=projectRouteSettlement(a,r);assert.equal(view.costSoldCents,undefined);assert.equal(view.grossProfitCents,undefined);assert.equal(view.amountCents,200)}for(const a of [owner,worker('boss','route_supervisor')])assert.equal(projectRouteSettlement(a,r).grossProfitCents,80);assert.equal(r.costSoldCents,120);
});
test('delivery receipt retry with same operationId returns invoice without another mutation',async()=>{
 const d=fixture(),{id}=await prepare(d),operationId=randomUUID(),body={id,operationId,deliveryId:randomUUID(),items:[{p:'p',q:1}]};const invoice=await run(d,'routeDelivery',body,worker('driver')),before=structuredClone(d);const result=replayOperationReceipt({actor:'driver',payloadHash:'same',revision:2,resultId:invoice},{id:operationId,hash:'same'},'driver',check);assert.equal(result.resultId,invoice);assert.equal(result.replayed,true);assert.deepEqual(d,before);assert.equal(d.entries.length,1);
});

test('owner sales resolve the only load by zone and reject ambiguous or foreign loads',async()=>{
 const d=fixture(),{loadId}=await prepare(d);const b={routeSale:true,customerId:'c',operationId:randomUUID()};
 routeSaleGuard(d,owner,b,check);assert.equal(b.commerceLoadId,loadId);assert.equal(b.route,'Norte');assert.equal(b.routeWorkerId,'driver');
 d.businessRecords.push({...structuredClone(d.businessRecords.find(r=>r.id===loadId)),id:'second'});
 assert.throws(()=>routeSaleGuard(d,owner,{routeSale:true,customerId:'c',operationId:randomUUID()},check),/varias cargas/);
 const second=d.businessRecords.find(r=>r.id==='second');second.branchId='otra';
 assert.throws(()=>routeSaleGuard(d,owner,{routeSale:true,commerceLoadId:'second',customerId:'c',operationId:randomUUID()},check),/sucursal/);
});
test('authorized loadless sale keeps zone and selected worker',()=>{
 const d=fixture();d.cfg.routePolicy={allowSaleWithoutLoad:true};const body={routeSale:true,customerId:'c',routeWorkerId:'seller',operationId:randomUUID()};
 routeSaleGuard(d,owner,body,check);assert.equal(body.route,'Norte');assert.equal(body.routeWorkerId,'seller');
});
test('direct sales cannot consume goods committed to other preorders',async()=>{
 const d=fixture(),{loadId}=await prepare(d);assert.throws(()=>commerceLoadSale(d,{commerceLoadId:loadId},{id:'sale',date:'2026-11-12',items:[{p:'p',q:1}]},check,()=>{}),/reservado/);
 assert.equal(d.businessRecords.find(r=>r.id===loadId).remaining[0].q,4);
});
test('negative stock policy returns product shortages instead of suppressing them',()=>{
 const d=fixture();assert.throws(()=>commerceCheckStock(d,{items:[{p:'p',q:12}]},check),/faltan 2/);
 d.cfg.allowNegativeValues=true;assert.deepEqual(commerceCheckStock(d,{items:[{p:'p',q:12}]},check),[{p:'p',name:'Producto',q:2}]);
});
test('route credit notes reverse accrued commission only once and preserve payment history',()=>{
 const d=fixture(),sale={id:'sale',subtotal:100},note={id:'note',type:'nota-credito',invoiceId:'sale',subtotal:40,date:'2026-11-12',reference:'NC-1'};
 d.entries=[sale,note];const r={id:'commission',module:'comisiones',kind:'ruta',saleId:'sale',entryId:'accrual',total:10,paid:10,rate:10,expenseAccount:'6101',liabilityAccount:'2101',events:[]};d.businessRecords.push(r);
 const posted=[];const post=e=>{posted.push(e);return {...e,id:'reversal'}};
 routeCommissionReturn(d,sale,note,post,check);assert.equal(r.total,6);assert.equal(r.paid,10);assert.equal(posted[0].total,4);assert.deepEqual(posted[0].lines,[{a:'2101',d:4,c:0},{a:'6101',d:0,c:4}]);
 routeCommissionReturn(d,sale,note,post,check);assert.equal(posted.length,1);
});
