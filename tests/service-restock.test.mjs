import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreServiceConsumables} from '../netlify/lib/service-restock.mjs';
const fixture=()=>{
 const sale={id:'sale',type:'venta',serviceConsumptionId:'used',items:[{p:'service',q:1,service:true}]},note={id:'note',type:'nota-credito',invoiceId:'sale',date:'2026-11-04',reference:'NC-1',items:[{p:'service',q:1,service:true}]},data={entries:[sale,{id:'used',type:'servicio-consumo',saleId:'sale',serviceConsumption:{rows:[{pid:'ink',q:0.5,costCents:200}]}},note],products:[{id:'ink',cost:4,stock:1}],accounts:[{code:'6199',tipo:'gasto'}],businessRecords:[]};
 return {data,note,body:{restockConsumables:true,restockConfirmed:true,restockReason:'Se recuperó el insumo',varianceAccount:'6199'},ctx:{check:(v,m)=>assert.ok(v,m),permit:(a,m)=>assert.ok(!a.blocked?.includes(m)),entry:(d,s,e)=>{const r={id:'restock',...e};d.entries.push(r);return r}}};
};
test('por defecto la nota conserva exactamente stock y consumo',()=>{const f=fixture(),before=structuredClone(f.data);assert.equal(restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,{},f.ctx),null);assert.deepEqual(f.data,before)});
test('reposición confirmada una sola vez, con asiento independiente y consumo intacto',()=>{const f=fixture(),original=structuredClone(f.data.entries[1]);restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,f.body,f.ctx);assert.equal(f.data.products[0].stock,1.5);assert.deepEqual(f.data.entries[1],original);assert.equal(f.note.serviceRestockId,'restock');assert.throws(()=>restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,f.body,f.ctx),/repusieron/)});
test('cambio de costo conserva catálogo y registra diferencia de valoración',()=>{const f=fixture();f.data.products[0].cost=6;restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,f.body,f.ctx);const e=f.data.entries.at(-1);assert.equal(e.lines.reduce((s,l)=>s+l.d-l.c,0),0);assert.equal(e.lines.find(l=>l.a==='6199').c,1);assert.equal(f.data.products[0].cost,6)});
test('bloquea parcial, trazabilidad, falta de confirmación y permisos',()=>{
 for(const module of ['lotes','produccion','variantes']){const f=fixture();f.data.businessRecords=[{module,productId:'ink',serial:'S1'}];assert.throws(()=>restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,f.body,f.ctx));assert.equal(f.data.products[0].stock,1);}
 const f=fixture();f.note.items[0].q=.5;assert.throws(()=>restoreServiceConsumables(f.data,{branchId:'principal'}, {},f.note,f.body,f.ctx),/todos/);
 for(const module of ['inventario','contabilidad']){const f=fixture();assert.throws(()=>restoreServiceConsumables(f.data,{branchId:'principal',blocked:[module]}, {},f.note,f.body,f.ctx));}
 const other=fixture();assert.throws(()=>restoreServiceConsumables(other.data,{branchId:'principal'}, {},other.note,{...other.body,restockConfirmed:false},other.ctx));
});
