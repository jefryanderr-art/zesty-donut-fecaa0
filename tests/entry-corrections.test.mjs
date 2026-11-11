// Prepared for platform execution; intentionally not run in the managed editing session.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {correctEntry} from '../netlify/lib/entry-corrections.mjs';
import {scopeBranch,mergeBranch,companyBranches} from '../netlify/lib/branches.mjs';
import {statement} from '../netlify/lib/reporting.mjs';
import {normalizeDocument,restoreDocument,operationalDocument,canonical} from '../netlify/lib/accounting-codec.mjs';
import {OPERATION_ARRAYS} from '../netlify/lib/policies.mjs';
import '../public/fiscal-calculations.js';
const lines=(amount=100)=>[{a:'1101',d:amount,c:0},{a:'3101',d:0,c:amount}];
const owner={owner:true,branchId:'principal'};
const original=()=>({id:'original',type:'apertura',date:'2026-01-01',desc:'Apertura',lines:lines(),total:100});
const state=()=>({cfg:{cur:'C$'},accounts:[['1101','activo'],['1102','activo'],['3101','patrimonio'],['6103','gasto'],['1301','activo'],['1202','activo'],['2101','pasivo']].map(([code,tipo])=>({code,tipo,nat:tipo==='patrimonio'||tipo==='pasivo'?'C':'D',name:code,sub:code.startsWith('11')?'ef':''})),entries:[original()],products:[],taxes:[],suppliers:[],businessRecords:[],fiscalWorkflows:[]});
const date=value=>{assert.match(value,/^\d{4}-\d{2}-\d{2}$/);return value};
const append=(data,session,record)=>{const e={id:randomUUID(),actor:session.email,managed:true,...record};data.entries.push(e);return e};
// Production runs this mutation on a clone inside updateCompany's locked transaction.
function run(data,body={},access=owner){const next=structuredClone(data);const result=correctEntry(next,access,{email:'owner@example.invalid'},{id:'original',date:'2026-01-01',reason:'Comprobante revisado',reference:'COR-1',...body},{append,date});return {data:next,result};}
const replacement={desc:'Apertura corregida',lines:lines(150)};
for(const [label,access,ok]of [['dueño',owner,true],['supervisor sin especial',{owner:false,branchId:'principal',role:'supervisor',rolePolicy:{specials:{}}},false],['contador sin especial',{owner:false,branchId:'principal',role:'contador',rolePolicy:{specials:{}}},false],['contador con especial',{owner:false,branchId:'principal',role:'contador',rolePolicy:{specials:{corrections:true}}},true]])test(label,()=>{
 if(ok)assert.equal(run(state(),{replacement},access).data.entries.length,3);else assert.throws(()=>run(state(),{},access),/Correcciones/);
});
test('apertura corregida conserva original, fecha y un solo saldo inicial, también tras normalizar',()=>{
 const previous=state(),{data,result}=run(previous,{replacement});assert.deepEqual(data.entries[0],previous.entries[0]);assert.equal(data.entries[1].type,'anula-apertura');assert.equal(data.entries[1].reversalOf,'original');assert.equal(data.entries[2].correctionOf,'original');assert.equal(data.entries[2].type,'apertura');assert.ok(data.entries.every(e=>e.date==='2026-01-01'));assert.equal(statement(data,'2026-01-01','2026-12-31').assets,150);assert.equal(result.correctedId,data.entries[2].id);
 const stored=normalizeDocument('11111111-1111-4111-8111-111111111111',data);assert.deepEqual(restoreDocument(stored),data);
});
test('solo se corrige la última versión vigente',()=>{
 const first=run(state(),{replacement});assert.throws(()=>run(first.data),/anulado/);assert.throws(()=>run(first.data,{id:first.result.reversalId}),/anulado/);
 const second=run(first.data,{id:first.result.correctedId,replacement:{...replacement,lines:lines(200)}});assert.equal(second.data.entries.length,5);assert.equal(statement(second.data,'2026-01-01','2026-12-31').assets,200);
});
test('anular apertura que financia un gasto rechaza caja negativa y conserva origen',()=>{
 const data=state();data.entries.push({id:'expense',type:'gasto',date:'2026-01-02',lines:[{a:'6103',d:90,c:0},{a:'1101',d:0,c:90}],total:90});assert.throws(()=>run(data),/negativo/);assert.equal(data.entries.length,2);data.cfg.allowNegativeValues=true;assert.equal(run(data).data.entries.length,3);
});
test('período original cerrado y período de contrasiento cerrado no se eluden',()=>{
 const data=state();data.cfg.periodLocks={'principal:2026-01':{closed:true}};assert.throws(()=>run(data,{date:'2026-02-01'}),/cerrado/);data.cfg.periodLocks={'principal:2026-02':{closed:true}};assert.throws(()=>run(data,{date:'2026-02-01'}),/cerrado/);
});
test('abonos vinculados impiden corregir documento hasta anularlos',()=>{
 const data=state();data.entries.push({id:'payment',type:'abono',invoiceId:'original',date:'2026-01-01',total:10,lines:lines(10)});assert.throws(()=>run(data),/abonos/);data.entries.push({id:'payment-reversal',reversalOf:'payment',date:'2026-01-01',type:'correccion-anulacion',lines:lines(10).map(l=>({...l,d:l.c,c:l.d}))});assert.equal(run(data,{replacement}).data.entries.length,5);
});
for(const type of ['venta','nota-credito','caja','costo','cierre-anual','traspaso-anual','apertura-anual','nomina','liquidacion'])test(type+' conserva su flujo protegido',()=>{const data=state();data.entries[0].type=type;if(['caja','costo'].includes(type))data.entries[0].managed=true;assert.throws(()=>run(data),/nota de crédito|propio|específico/)});
test('motivo, referencia, cuadre, cuentas y fecha se validan',()=>{
 for(const body of [{reason:''},{reference:''},{date:'2025-12-31'},{replacement:{desc:'x',lines:[{a:'1101',d:10,c:0},{a:'3101',d:0,c:9}]}},{replacement:{desc:'x',lines:[{a:'ajena',d:10,c:0},{a:'3101',d:0,c:10}]}}])assert.throws(()=>run(state(),body));
});
test('sucursal y empresa ajenas y consolidado se rechazan',()=>{
 const data=state();assert.throws(()=>run(data,{id:'id-de-otra-empresa'}),/no existe/);assert.throws(()=>run(data,{}, {...owner,branchId:'otra'}),/sucursal/);assert.throws(()=>run(data,{}, {...owner,branchId:null}),/sucursal/);
});
test('merge de sucursal conserva asientos de la otra sucursal',()=>{
 const full=state();full.branches=[{id:'principal',name:'Principal',active:true,main:true},{id:'otra',name:'Otra',active:true}];full.entries.push({...original(),id:'remote',branchId:'otra'});const access={...owner,branches:companyBranches(full)},scoped=scopeBranch(full,access),next=run(scoped,{replacement}).data,merged=mergeBranch(full,scoped,next,access);assert.deepEqual(merged.entries.find(e=>e.id==='remote'),full.entries[1]);assert.equal(statement(merged,'2026-01-01','2026-12-31').assets,250);
});
test('fiscal-pago histórico se anula y la obligación recupera saldo sin cambiar su historial',()=>{
 const data=state();data.entries[0]={id:'original',type:'fiscal-pago',taxId:'tax',date:'2026-01-01',total:10,lines:[{a:'2101',d:10,c:0},{a:'1102',d:0,c:10}]};data.cfg.allowNegativeValues=true;data.taxes=[{id:'tax',amount:10}];const next=run(data).data;assert.deepEqual(next.taxes,data.taxes);assert.equal(next.entries.filter(e=>e.type==='fiscal-pago'&&!next.entries.some(r=>r.reversalOf===e.id)).length,0);data.fiscalWorkflows=[{kind:'declaration',payment:{entryId:'original'}}];assert.throws(()=>run(data),/rectificativa/);
});
test('movimiento conciliado se bloquea aunque el original no se reescriba',()=>{const data=state();data.businessRecords=[{module:'bancos',kind:'statement',rows:[{entryId:'original'}]}];assert.throws(()=>run(data),/concilia/)});
test('invini invierte cantidad y costo; rechaza stock consumido, valoración y PEPS',()=>{
 const data=state();data.entries[0]={...original(),type:'invini',lines:[{a:'1301',d:100,c:0},{a:'3101',d:0,c:100}],stock:[{pid:'p',q:10,unitCost:10}]};data.products=[{id:'p',name:'Producto',stock:10,cost:10}];const next=run(data).data;assert.equal(next.products[0].stock,0);assert.equal(next.products[0].cost,0);assert.equal(next.entries[1].stock[0].q,-10);data.products[0].stock=5;assert.throws(()=>run(data),/existencias|valoración/);data.products[0].stock=20;data.products[0].cost=1;assert.throws(()=>run(data),/valoración/);data.cfg.costing={method:'fifo'};assert.throws(()=>run(data),/PEPS/);
});
test('gasto corregido recalcula importe e IVA sin aceptar líneas del navegador',()=>{
 const data=state();data.entries[0]={id:'original',type:'gasto',date:'2026-01-01',total:10,subtotal:10,pay:'1101',lines:[{a:'6103',d:10,c:0},{a:'1101',d:0,c:10}]};data.cfg.allowNegativeValues=true;const next=run(data,{replacement:{reference:'DOC-1',party:'Servicio',pay:'1102',expenseAccount:'6103',subtotal:20,vatRate:10,lines:lines(999)}}).data;assert.equal(next.entries[2].total,22);assert.equal(next.entries[2].vat,2);assert.equal(next.entries[2].type,'gasto');assert.equal(next.entries[2].lines[0].a,'6103');
});
test('compra corregida aplica diferencias de stock, costo e IVA y conserva original',()=>{
 const data=state();data.cfg.allowNegativeValues=true;data.entries[0]={id:'original',type:'compra',date:'2026-01-01',total:100,pay:'1102',lines:[{a:'1301',d:100,c:0},{a:'1102',d:0,c:100}],items:[{p:'p',q:10,u:10}],stock:[{pid:'p',q:10,unitCost:10}]};data.products=[{id:'p',name:'Producto',stock:10,cost:10}];const next=run(data,{replacement:{reference:'DOC-2',party:'Proveedor',pay:'1102',items:[{p:'p',q:5,u:20,vatRate:10}]}}).data;assert.equal(next.products[0].stock,5);assert.equal(next.products[0].cost,20);assert.equal(next.entries[2].total,110);assert.deepEqual(next.entries[0],data.entries[0]);assert.equal(globalThis.AcontecFiscalMath.vat(next,'2026-01-01','2026-01-31').basePurchases,100);
});
test('guardado genérico continúa rechazando cambios y borrado de dinero',()=>{
 const source=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8'),start=source.indexOf('export function guardLedgerMutation'),end=source.indexOf('function movement(',start),check=(ok,msg)=>{if(!ok)throw new Error(msg)};
 const context={operationalDocument,equal:(a,b)=>canonical(a)===canonical(b),requireValue:check,OPERATION_ARRAYS,companyProfileFields:[],commerceRecord:()=>false,workflowRecord:()=>false,deliveryZoneRecord:()=>false,bakeryCounterRecord:()=>false,diningRecord:()=>false,benefitRecord:()=>false};
 const ctx=vm.createContext(context);vm.runInContext(source.slice(start,end).replace('export ',''),ctx);
 for(const mutate of [d=>d.entries.splice(0,1),d=>d.entries[0].lines[0].d=50]){const before=state();before.entries[0].type='manual';const after=structuredClone(before);mutate(after);assert.throws(()=>ctx.guardLedgerMutation(before,after,{owner:true,company:{}}),/dinero/);}
});
test('abono corregido conserva factura, revierte el pago previo y valida el saldo',()=>{
 const data=state();data.entries.push({id:'invoice',type:'factura',date:'2026-01-01',pay:'2101',total:100,lines:[{a:'6103',d:100,c:0},{a:'2101',d:0,c:100}]});data.entries[0]={id:'original',type:'abono',invoiceId:'invoice',date:'2026-01-01',desc:'Pago',total:40,lines:[{a:'2101',d:40,c:0},{a:'1102',d:0,c:40}]};data.cfg.allowNegativeValues=true;
 const body={replacement:{desc:'Pago corregido',lines:[{a:'2101',d:60,c:0},{a:'1102',d:0,c:60}]}};const next=run(data,body).data;assert.equal(next.entries[3].type,'abono');assert.equal(next.entries[3].invoiceId,'invoice');assert.equal(next.entries.filter(e=>e.invoiceId==='invoice').flatMap(e=>e.lines).filter(l=>l.a==='2101').reduce((n,l)=>n+l.d-l.c,0),60);
 data.cfg.allowNegativeValues=false;body.replacement.lines=[{a:'2101',d:110,c:0},{a:'1102',d:0,c:110}];assert.throws(()=>run(data,body),/supera la deuda/);
});
test('un centavo negativo en caja no pasa el control estricto de correcciones',()=>{const data=state();data.entries.push({id:'g',type:'gasto',date:'2026-01-02',total:0.01,lines:[{a:'6103',d:0.01,c:0},{a:'1101',d:0,c:0.01}]});assert.throws(()=>run(data),/negativo/)});
test('el actor nuevo corresponde a quien corrige y no al autor anterior',()=>{const data=state();data.entries[0].actor='Autor anterior';const next=run(data,{replacement}).data;assert.equal(next.entries[0].actor,'Autor anterior');assert.equal(next.entries[2].actor,'owner@example.invalid')});
