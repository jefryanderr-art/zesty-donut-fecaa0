import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureCosting,applyFifo,validateFifo,guardFifoMutation,guardFifoOperation,fifoEnabled} from '../netlify/lib/fifo.mjs';
import {inventoryLineCostCents,inventoryShareCents} from '../public/accounting-math.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
const day=new Date().toISOString().slice(0,10);
const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
const access={owner:true,branchId:'principal'};
const session={email:'owner@example.test'};
const confirmed={method:'fifo',confirmed:true,reason:'Control de costos futuros'};
const permit=()=>{};
const clone=structuredClone;
const base=()=>({cfg:{cur:'C$'},accounts:[{code:'1301'},{code:'3101'},{code:'5101'},{code:'2101'},{code:'4101'},{code:'1201'},{code:'6107'}],products:[{id:'p',name:'Artículo',stock:5,cost:2,price:9}],entries:[{id:'opening',date:yesterday,type:'invini',stock:[{pid:'p',q:5,unitCost:2}],lines:[{a:'1301',d:10,c:0},{a:'3101',d:0,c:10}]}],businessRecords:[]});
const activate=(d=base())=>{configureCosting(d,access,session,confirmed,permit);return d};
// Emula la propuesta aislada de runOperation y el guard anterior a la escritura.
const transact=(d,mutate)=>{const next=clone(d);mutate(next);applyFifo(d,next);guardFifoMutation(d,next,'Operación: prueba');return next};
const purchase=(d,q,cost,id='purchase')=>transact(d,n=>{n.products[0].stock+=q;n.entries.push({id,type:'compra',date:day,subtotal:inventoryLineCostCents(q,cost)/100,stock:[{pid:'p',q,unitCost:cost}],items:[{p:'p',q,u:cost,cost}],lines:[{a:'1301',d:inventoryLineCostCents(q,cost)/100,c:0},{a:'2101',d:0,c:inventoryLineCostCents(q,cost)/100}]})});
const sale=(d,q,id='sale')=>transact(d,n=>{const cost=n.products[0].cost;n.products[0].stock-=q;n.entries.push({id,type:'venta',date:day,items:[{p:'p',q,u:9,cost}],stock:[{pid:'p',q:-q,unitCost:cost}],lines:[{a:'1201',d:9*q,c:0},{a:'4101',d:0,c:9*q},{a:'5101',d:inventoryLineCostCents(q,cost)/100,c:0},{a:'1301',d:0,c:inventoryLineCostCents(q,cost)/100}]})});
const returned=(d,q,id='return',invoiceId='sale')=>transact(d,n=>{n.products[0].stock+=q;n.entries.push({id,invoiceId,type:'nota-credito',date:day,items:[{p:'p',q,u:9,cost:2}],stock:[{pid:'p',q,unitCost:2}],lines:[{a:'4101',d:9*q,c:0},{a:'1201',d:0,c:9*q},{a:'1301',d:2*q,c:0},{a:'5101',d:0,c:2*q}]})});
const value=d=>d.inventoryLayers.filter(l=>l.epoch===d.cfg.costing.epoch).reduce((s,l)=>s+l.valueCents,0);
test('PEPS apagado: el recorrido promedio no modifica ni un campo',()=>{
 const d=base(),n=clone(d);n.products[0].stock=3;n.products[0].cost=2;
 n.entries.push({id:'average-sale',date:day,type:'venta',stock:[{pid:'p',q:-2,unitCost:2}],lines:[{a:'5101',d:4,c:0},{a:'1301',d:0,c:4}]});
 const expected=clone(n);applyFifo(d,n);guardFifoMutation(d,n,'Operación: sale');assert.deepEqual(n,expected);assert.equal(fifoEnabled(n),false);assert.equal(n.inventoryLayers,undefined);
});
test('activación sin recalcular historia: capa inicial y motivo auditables',()=>{
 const d=base(),history=clone(d.entries);activate(d);assert.deepEqual(d.entries,history);assert.equal(d.inventoryLayers.length,1);assert.equal(value(d),1000);assert.equal(d.inventoryLayers[0].q,5);assert.equal(d.cfg.costingHistory[0].reason,confirmed.reason);validateFifo(d);
});
test('solo dueño, con permisos de módulos, motivo y confirmación',()=>{
 for(const a of [{owner:false},{...access,member:{role:'contador'}},{...access,support:true}])assert.throws(()=>configureCosting(base(),a,session,confirmed,permit),/dueño/);
 for(const b of [{...confirmed,reason:'x'},{...confirmed,confirmed:false},{...confirmed,method:'inventado'}])assert.throws(()=>configureCosting(base(),access,session,b,permit));
 const modules=[];configureCosting(base(),access,session,confirmed,(_,m)=>modules.push(m));assert.deepEqual(modules,['ajustes','inventario','contabilidad']);
 assert.throws(()=>configureCosting(base(),access,session,confirmed,()=>{throw Error('Sin permiso')}),/Sin permiso/);
});
test('activación rechaza diferencias contables sin tocar el original de la transacción',()=>{
 const d=base();d.entries[0].lines[0].d=9;const before=clone(d);assert.throws(()=>activate(clone(d)),/1301/);assert.deepEqual(d,before);
});
test('compra crea capa; venta consume varias capas antiguas antes de la nueva',()=>{
 const d=purchase(activate(),5,4),n=sale(d,7),alloc=n.entries.at(-1).stock[0].fifoAllocations;
 assert.deepEqual(alloc.map(a=>[a.q,a.costCents]),[[5,1000],[2,800]]);assert.equal(n.entries.at(-1).lines.find(l=>l.a==='5101').d,18);assert.equal(value(n),1200);assert.equal(n.products[0].stock,3);validateFifo(n);
});
test('devoluciones parciales consecutivas recuperan costos originales por capa',()=>{
 let d=sale(purchase(activate(),5,4),7);d=returned(d,6,'return1');assert.equal(d.entries.at(-1).stock[0].costCents,1400);d=returned(d,1,'return2');assert.equal(d.entries.at(-1).stock[0].costCents,400);assert.equal(value(d),3000);assert.equal(d.products[0].stock,10);assert.ok(d.inventoryLayers.at(-1).sourceLayerId);validateFifo(d);
});
test('devolución histórica sin asignaciones queda bloqueada',()=>{
 const d=activate();d.entries.push({id:'legacy',date:yesterday,type:'venta',items:[{p:'p',q:1,cost:2}],stock:[],lines:[]});assert.throws(()=>returned(d,1,'r','legacy'),/anterior a PEPS/);
});
test('ajuste negativo consume capas y contabiliza el costo PEPS',()=>{
 const d=purchase(activate(),5,4);const n=transact(d,n=>{n.products[0].stock-=6;n.entries.push({id:'adjust',date:day,type:'ajuste',adjustmentReason:'merma',stock:[{pid:'p',q:-6,unitCost:3}],lines:[{a:'6107',d:18,c:0},{a:'1301',d:0,c:18}]})});
 assert.equal(n.entries.at(-1).lines[0].d,14);assert.equal(value(n),1600);validateFifo(n);
});
test('ajuste positivo crea capa con fecha, costo y sucursal',()=>{
 const n=transact(activate(),n=>{n.products[0].stock+=2;n.entries.push({id:'adjust',date:day,type:'ajuste',stock:[{pid:'p',q:2,unitCost:2}],lines:[{a:'1301',d:4,c:0},{a:'3101',d:0,c:4}]})});
 assert.equal(n.inventoryLayers.at(-1).branchId,'principal');assert.equal(n.inventoryLayers.at(-1).date,day);assert.equal(value(n),1400);
});
test('centavos y cantidades fraccionarias: consumo y devolución recuperan el residuo',()=>{
 const d=base();d.products[0]={...d.products[0],stock:0.003,cost:3};d.entries[0].stock=[{pid:'p',q:0.003,unitCost:3}];d.entries[0].lines=[{a:'1301',d:0.01,c:0},{a:'3101',d:0,c:0.01}];activate(d);
 let n=sale(d,0.001,'s1');n=sale(n,0.002,'s2');assert.equal(value(n),0);n=returned(n,0.001,'r1','s1');n=returned(n,0.002,'r2','s2');assert.equal(value(n),1);validateFifo(n);
 assert.equal(inventoryShareCents(1,1,2),1);assert.equal(inventoryLineCostCents(0.003,3),1);
});
test('no permite existencias, valor, o capa alterados; error no modifica el original',()=>{
 const d=activate(),before=clone(d);
 for(const alter of [n=>n.products[0].stock++,n=>n.inventoryLayers[0].valueCents++,n=>n.inventoryLayers[0].q--,n=>n.inventoryLayers[0].valueCents=1.5]){const n=clone(d);alter(n);assert.throws(()=>validateFifo(n));}
 assert.throws(()=>sale(d,6),/insuficientes/);assert.deepEqual(d,before);
});
test('traslado saliente y entrante quedan apagados con motivo preciso',()=>{
 const d=activate();for(const operation of ['stockTransfer','stockReceive'])assert.throws(()=>guardFifoOperation(d,{operation}),/tránsito.*capas de origen y destino/);
 guardFifoOperation(base(),{operation:'stockTransfer'});
});
test('lotes FEFO y series no se activan sin relación física con capas',()=>{
 for(const r of [{module:'lotes'},{module:'variantes',serial:'S-1'}]){const d=base();d.businessRecords=[r];assert.throws(()=>activate(d),/FEFO|serie/);}
 for(const r of [{module:'lotes'},{module:'variantes',serial:'S-1'}])assert.throws(()=>transact(activate(),n=>n.businessRecords.push(r)),/FEFO|serie/);
});
test('recetas y producción automática o manual quedan bloqueadas',()=>{
 const d=base();d.businessRecords=[{module:'produccion',autoProduce:true}];assert.throws(()=>activate(d),/recetas o producción/);
 assert.throws(()=>guardFifoOperation(activate(),{operation:'businessProduce'}),/capa de insumo/);
 assert.throws(()=>transact(activate(),n=>n.businessRecords.push({module:'produccion'})),/recetas o producción/);
});
test('no revaloriza productos ni procesa movimientos anteriores a activación',()=>{
 assert.throws(()=>guardFifoOperation(activate(),{operation:'product',id:'p',cost:3}),/revalorización/);
 const d=activate();assert.throws(()=>transact(d,n=>{n.entries.push({id:'old',date:yesterday,type:'ajuste',stock:[{pid:'p',q:1}],lines:[]})}),/activación/);
});
test('método y capas no se pueden inyectar por guardado genérico',()=>{
 const d=base(),n=activate(clone(d));assert.throws(()=>guardFifoMutation(d,n,'Datos contables actualizados'),/Método de costeo/);
 const p=activate(),q=clone(p);q.inventoryLayers[0].valueCents++;assert.throws(()=>guardFifoMutation(p,q,'Datos contables actualizados'),/operaciones autorizadas/);
});
test('promedio se puede restaurar hacia adelante si preserva el valor exacto',()=>{
 const d=activate(),entries=clone(d.entries);configureCosting(d,access,session,{...confirmed,method:'average'},permit);assert.equal(fifoEnabled(d),false);assert.deepEqual(d.entries,entries);assert.equal(d.products[0].cost,2);assert.equal(d.inventoryLayers.length,1);
});
test('capas y asignaciones sobreviven exportación JSON y codec relacional',()=>{
 const d=returned(sale(purchase(activate(),5,4),7),1);const exported=JSON.parse(JSON.stringify(d));assert.deepEqual(exported,d);validateFifo(exported);
 const packed=normalizeDocument('00000000-0000-4000-8000-000000000001',d);assert.equal(typeof packed.rows.inventoryLayers[0].valueCents,'number');assert.deepEqual(restoreDocument(packed),d);
});
test('capas iniciales separadas por sucursal y conciliación independiente',()=>{
 const d=base();d.branches=[{id:'principal'},{id:'second'}];d.products[0].stock=7;d.entries.push({id:'other',branchId:'second',date:yesterday,type:'invini',stock:[{pid:'p',q:2,unitCost:2}],lines:[{a:'1301',d:4,c:0},{a:'3101',d:0,c:4}]});activate(d);assert.deepEqual(d.inventoryLayers.map(l=>[l.branchId,l.q]),[['principal',5],['second',2]]);validateFifo(d);d.inventoryLayers[1].valueCents++;assert.throws(()=>validateFifo(d),/1301|historial/);
});
test('integración: costeo precede al checkpoint y mantiene revisión, transacción y permisos',()=>{
 const accessSource=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8'),op=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 assert.ok(accessSource.indexOf('guardFifoMutation(fullCompany.data')<accessSource.indexOf('obsoleteKeys = await checkpoint'));
 assert.match(accessSource,/company.revision !== revision/);assert.match(accessSource,/db.transaction/);assert.match(op,/await updateCompany/);assert.match(op,/applyFifo\(fifoBefore,data\)/);assert.match(op,/requirePermission\(access,'compras'\)/);assert.match(op,/guardFifoOperation\(data,body\)/);
});

test('no permite consumos sin rastro aunque el total agregado cuadre',()=>{
 const d=sale(activate(),2);d.entries.at(-1).stock[0].fifoAllocations=[];assert.throws(()=>validateFifo(d),/historial/);
});
test('una venta en otra sucursal consume exclusivamente sus capas',()=>{
 const d=base();d.branches=[{id:'principal'},{id:'second'}];d.products[0].stock=7;d.entries.push({id:'other',branchId:'second',date:yesterday,type:'invini',stock:[{pid:'p',q:2,unitCost:2}],lines:[{a:'1301',d:4,c:0},{a:'3101',d:0,c:4}]});activate(d);
 const n=transact(d,n=>{n.products[0].stock--;n.entries.push({id:'branchsale',branchId:'second',date:day,type:'venta',stock:[{pid:'p',q:-1,unitCost:2}],lines:[{a:'5101',d:2,c:0},{a:'1301',d:0,c:2}]})});
 assert.equal(n.inventoryLayers.find(l=>l.branchId==='principal').q,5);assert.equal(n.inventoryLayers.find(l=>l.branchId==='second').q,1);validateFifo(n);
});
test('restauración no puede descartar capas ni reescribir Kardex',()=>{
 const d=sale(activate(),2),n=clone(d);delete n.inventoryLayers;assert.throws(()=>guardFifoMutation(d,n,'Respaldo restaurado'),/capas PEPS/);
 assert.doesNotThrow(()=>guardFifoMutation(d,clone(d),'Respaldo restaurado'));
});

test('no vuelve a promedio si el redondeo alteraría el valor por producto',()=>{
 const d=base();d.products[0].cost=0.01;d.entries[0].stock[0].unitCost=0.01;d.entries[0].lines=[{a:'1301',d:0.05,c:0},{a:'3101',d:0,c:0.05}];activate(d);
 const n=purchase(d,1,0.02,'expensive');
 assert.throws(()=>configureCosting(clone(n),access,session,{...confirmed,method:'average'},permit),/diferencias de centavos/);
});

test('negativos por empresa: venta PEPS sin capas suficientes conserva Kardex, costo y asiento',()=>{
 const strict=activate();assert.throws(()=>sale(strict,7),/insuficientes/);
 const flexible=clone(strict);flexible.cfg.allowNegativeValues=true;
 const sold=sale(flexible,7);assert.equal(sold.products[0].stock,-2);assert.equal(value(sold),-400);validateFifo(sold);
 const e=sold.entries.at(-1);assert.equal(e.lines.reduce((s,l)=>s+Math.round(l.d*100)-Math.round(l.c*100),0),0);
 assert.equal(e.stock[0].costCents,1400);
 const replenished=purchase(sold,3,2);assert.equal(replenished.products[0].stock,1);assert.equal(value(replenished),200);validateFifo(replenished);
 const restored=returned(sold,7);assert.equal(restored.products[0].stock,5);assert.equal(value(restored),1000);validateFifo(restored);
 assert.equal(strict.cfg.allowNegativeValues,undefined);assert.equal(strict.products[0].stock,5);
 const restoredDocument=restoreDocument(normalizeDocument('00000000-0000-4000-8000-000000000001',sold));assert.equal(restoredDocument.inventoryLayers.some(l=>l.negativeAdvance===true),true);
});
