import test from 'node:test';
import assert from 'node:assert/strict';
import {foodOperation} from '../netlify/lib/food-service.mjs';
import {deliveryOperation} from '../netlify/lib/delivery.mjs';
import {bakeryOperation} from '../netlify/lib/bakery.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const ctx={check,permit(){},date:v=>v},access={owner:true,branchId:'principal'},session={email:'owner@example.test'};
const call=(fn,data,body)=>fn(data,access,session,{operationId:'test',confirmed:true,date:'2026-11-05',...body},ctx);
test('arrival opens one account, preserves table and rejects duplicate arrival and overcapacity',()=>{
 const d={businessRecords:[]};const tableId=call(foodOperation,d,{operation:'foodTable',name:'Mesa 1',zone:'Terraza',capacity:4});
 const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString();
 const id=call(foodOperation,d,{operation:'foodReserve',tableId,name:'Reserva',guests:3,start,end});
 assert.throws(()=>call(foodOperation,d,{operation:'foodReserve',tableId,name:'Solapada',guests:2,start,end}));
 const accountId=call(foodOperation,d,{operation:'foodArrive',id});const a=d.businessRecords.find(r=>r.id===accountId);assert.equal(a.tableId,tableId);assert.equal(a.resource,'Mesa 1');assert.equal(a.guests,3);assert.equal(a.total,0);
 assert.throws(()=>call(foodOperation,d,{operation:'foodArrive',id}));assert.throws(()=>call(foodOperation,d,{operation:'foodSeat',tableId,guests:5}));
});
test('delivery fee replaces its prior line and uses the catalog service',()=>{
 const d={products:[{id:'fee',kind:'service',name:'Envío',price:5,vatRate:0}],businessRecords:[{id:'order',module:'despacho',status:'Recibido',items:[],events:[]}]};
 const zoneId=call(deliveryOperation,d,{operation:'deliveryZone',name:'Centro',productId:'fee'});
 const b={operation:'deliveryDetails',id:'order',mode:'domicilio',phone:'555',address:'Dirección',promised:new Date().toISOString(),zoneId,paymentMode:'cod',commissionRate:10};
 call(deliveryOperation,d,b);call(deliveryOperation,d,b);const r=d.businessRecords[0];assert.equal(r.items.length,1);assert.equal(r.total,5);
 r.entryId='invoice';assert.throws(()=>call(deliveryOperation,d,b));
});
test('counter keeps immutable observation without changing inventory',()=>{
 const d={products:[{id:'bread',kind:'stock',stock:12}],businessRecords:[]};
 const b={operation:'bakeryCounter',zone:'Vitrina',phase:'cierre',counts:[{productId:'bread',q:10}]};call(bakeryOperation,d,b);
 assert.equal(d.products[0].stock,12);assert.equal(d.businessRecords[0].counts[0].expectedQ,12);assert.throws(()=>call(bakeryOperation,d,b));
});
