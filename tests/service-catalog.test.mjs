// Pruebas preparadas para la plataforma; no ejecutadas en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {configureService,validateServiceDefinition,validateConfiguredServices,serviceConsumptionPlan,serviceSaleSnapshot,projectServiceProduct,projectServiceEntry} from '../netlify/lib/service-catalog.mjs';
import {serviceLineCostCents,serviceCommissionCents,moneyCents,normalizeItemQuantity,invoiceTotals,allocateReturnItems,creditReturnSummary} from '../public/accounting-math.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
import {prepareBusinessSale,restoreBusinessReturn} from '../netlify/lib/business.mjs';
const check=(value,message)=>{if(!value)throw new Error(message)};
const definition=()=>({version:1,enabled:true,durationMinutes:45,billingUnit:'sesión',taxMode:'gravado',taxReason:'',vatRate:15,commissionBasisPoints:125,employeeCommissions:[],components:[],consumables:[]});
const state=()=>({products:[{id:'s',name:'Servicio',kind:'service',stock:0,min:0,cost:0,price:10,vatRate:0,unit:'servicio'},{id:'t',name:'Otro servicio',kind:'service',stock:0,min:0,cost:0,price:20,vatRate:0,unit:'servicio'},{id:'p',name:'Insumo',stock:10,min:0,cost:1.17,price:5,unit:'unidad'}],employees:[{id:'emp',name:'Empleado'}],businessRecords:[],entries:[],accounts:[{code:'1301'},{code:'5101'},{code:'1102'},{code:'4101'},{code:'2106'}],cfg:{pos:{}},customers:[],invoiceSequences:{}});
const configure=(data,changes={},access={branchId:'principal'})=>configureService(data,access,{id:'s',confirmed:true,reason:'Configuración autorizada',definition:{...definition(),...changes}},{permit:(a,module)=>check(!a.blocked?.includes(module),'Sin permiso '+module)});

test('configuración exige permiso, sucursal, confirmación y motivo',()=>{
 for(const body of [{confirmed:false},{reason:'x'},{id:'p'}])assert.throws(()=>configureService(state(),{branchId:'principal'},{id:'s',confirmed:true,reason:'Revisión',definition:definition(),...body},{permit(){}}));
 assert.throws(()=>configure(state(),{},{branchId:null}));
 assert.throws(()=>configure(state(),{},{branchId:'principal',blocked:['inventario']}));
});
test('sin activación no cambia IVA, unidad, stock, costo ni documentos',()=>{
 const data=state(),before=structuredClone(data);configure(data,{enabled:false});
 assert.equal(data.products[0].vatRate,before.products[0].vatRate);assert.equal(data.products[0].unit,before.products[0].unit);
 assert.equal(data.products[0].stock,0);assert.equal(data.products[0].cost,0);assert.deepEqual(data.entries,before.entries);
 assert.deepEqual(serviceConsumptionPlan(data,[{p:'s',q:2}]),{rows:[],totalCents:0,services:[]});
});
test('activación conserva precio e historial y registra motivo',()=>{
 const data=state();configure(data);assert.equal(data.products[0].vatRate,15);assert.equal(data.products[0].unit,'sesión');assert.equal(data.products[0].price,10);assert.equal(data.products[0].serviceDefinition.changeReason,'Configuración autorizada');
});
test('duración, IVA explícito, exención y comisiones inválidas se rechazan',()=>{
 for(const input of [{durationMinutes:-1},{durationMinutes:0.5},{billingUnit:'día'},{taxMode:'exento',vatRate:15,taxReason:'Norma'},{taxMode:'exento',vatRate:0,taxReason:''},{taxMode:'tasa_cero',vatRate:15},{taxMode:'gravado',vatRate:0},{commissionBasisPoints:10001},{commissionBasisPoints:0.1}])assert.throws(()=>validateServiceDefinition(state(),'s',{...definition(),...input}));
 assert.equal(validateServiceDefinition(state(),'s',{...definition(),taxMode:'exento',taxReason:'Revisión del contador',vatRate:0}).vatRate,0);
});
test('comisiones individuales requieren Personal y empleado real sin duplicados',()=>{
 const commissions=[{employeeId:'emp',basisPoints:250}];
 assert.throws(()=>configure(state(),{employeeCommissions:commissions},{branchId:'principal',blocked:['personal']}));
 for(const rows of [[{employeeId:'otro',basisPoints:1}],[...commissions,...commissions]])assert.throws(()=>configure(state(),{employeeCommissions:rows}));
 const data=state();configure(data,{employeeCommissions:commissions});assert.equal(data.products[0].serviceDefinition.employeeCommissions[0].basisPoints,250);
});
test('paquetes admiten solo servicios, sin repetidos, autorreferencia, ciclos ni anidación',()=>{
 for(const rows of [[{p:'p',q:1}],[{p:'s',q:1}],[{p:'t',q:1},{p:'t',q:2}],[{p:'t',q:0.0001}]])assert.throws(()=>configure(state(),{components:rows}));
 const data=state();configure(data,{components:[{p:'t',q:2}]});
 assert.throws(()=>validateServiceDefinition(data,'t',{...definition(),components:[{p:'s',q:1}]}));
});
test('servicios históricos sin definición no producen consumo ni se reinterpretan cantidades',()=>{
 const data=state(),before=structuredClone(data);assert.deepEqual(serviceConsumptionPlan(data,[{p:'s',q:1.0001}]),{rows:[],totalCents:0,services:[]});assert.deepEqual(data,before);
});
test('consumibles descuentan solo insumos existentes; la planificación no muta datos',()=>{
 const data=state();configure(data,{consumables:[{p:'p',q:0.125}]});const before=structuredClone(data),plan=serviceConsumptionPlan(data,[{p:'s',q:2}]);
 assert.equal(plan.rows[0].q,0.25);assert.equal(plan.totalCents,29);assert.deepEqual(data,before);assert.equal(data.products[0].stock,0);
});
test('venta mixta, líneas repetidas y reservas comparten disponibilidad del insumo',()=>{
 const data=state();configure(data,{consumables:[{p:'p',q:2}]});
 assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:3},{p:'p',q:5}]),/existencias/);
 assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:3},{p:'s',q:3}]),/existencias/);
 data.businessRecords.push({module:'rutas',consignment:true,status:'Preparada',items:[{p:'p',q:9}]});assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:1}]),/existencias/);
});
test('paquete suma consumibles de sus componentes sin consumir los propios servicios',()=>{
 const data=state();data.products[1].serviceDefinition={...definition(),consumables:[{p:'p',q:0.5}]};
 configure(data,{components:[{p:'t',q:2}],consumables:[{p:'p',q:1}]});
 const plan=serviceConsumptionPlan(data,[{p:'s',q:2}]);assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].pid,'p');assert.equal(plan.rows[0].q,4);assert.equal(plan.totalCents,468);
});
test('consumibles con trazabilidad, inexistentes o que son servicios se rechazan',()=>{
 for(const p of ['inexistente','t'])assert.throws(()=>configure(state(),{consumables:[{p,q:1}]}));
 for(const record of [{module:'lotes'},{module:'variantes',serial:'ABC'},{module:'produccion'}]){
  const data=state();configure(data,{consumables:[{p:'p',q:1}]});data.businessRecords.push({...record,productId:'p'});assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:1}]),/No se permite/);
 }
});
test('cantidades de prestación que producen fracciones de milésima se rechazan sin redondear',()=>{
 const data=state();configure(data,{consumables:[{p:'p',q:0.125}]});assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:0.1}]),/tres decimales/);
 data.products[2].stock=0.1249;assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:1}]),/existencias/);
});
test('comisiones usan centavos enteros y tasa individual sobre base después del descuento',()=>{
 const data=state();configure(data,{employeeCommissions:[{employeeId:'emp',basisPoints:250}]});
 const snapshot=serviceSaleSnapshot(data,[{p:'s',service:true,q:2,u:9}],'emp')[0];assert.equal(snapshot.baseCents,1800);assert.equal(snapshot.commissionCents,45);
 assert.equal(serviceLineCostCents(0.29,0.5),15);assert.equal(serviceCommissionCents(199,250),5);
 assert.throws(()=>serviceLineCostCents(0.001,1));assert.throws(()=>serviceCommissionCents(1.5,100));
});
test('instantánea se mantiene independiente de los siguientes cambios del catálogo',()=>{
 const data=state();configure(data);const snapshot=serviceSaleSnapshot(data,[{p:'s',service:true,q:1,u:10}])[0];data.products[0].serviceDefinition.vatRate=20;assert.equal(snapshot.definition.vatRate,15);
});
test('sin Personal la proyección elimina comisiones individuales e importes por empleado',()=>{
 const data=state();configure(data,{employeeCommissions:[{employeeId:'emp',basisPoints:250}]});
 assert.equal(projectServiceProduct(data.products[0],false).serviceDefinition.employeeCommissions,undefined);
 const entry={serviceSnapshots:serviceSaleSnapshot(data,[{p:'s',service:true,q:1,u:10}],'emp')},view=projectServiceEntry(entry,false);
 assert.equal(view.serviceSnapshots[0].employeeId,undefined);assert.equal(view.serviceSnapshots[0].commissionCents,undefined);assert.equal(view.serviceSnapshots[0].definition.employeeCommissions,undefined);assert.equal(entry.serviceSnapshots[0].employeeId,'emp');
});
test('validación de catálogo conserva empleados de otras sucursales sin exponerlos',()=>{
 const data=state();configure(data,{employeeCommissions:[{employeeId:'emp',basisPoints:250}]});const employees=data.employees;data.employees=[];assert.doesNotThrow(()=>validateConfiguredServices(data,employees));
});
test('proyección y configuración de una sucursal preservan y ocultan comisiones ajenas',()=>{
 const data=state();data.employees.push({id:'otro',branchId:'otra'});configure(data,{employeeCommissions:[{employeeId:'emp',basisPoints:250},{employeeId:'otro',basisPoints:300}]});
 const projected=projectServiceProduct(data.products[0],true,new Set(['emp']));assert.deepEqual(projected.serviceDefinition.employeeCommissions,[{employeeId:'emp',basisPoints:250}]);
 const old=data.products[0].serviceDefinition;data.employees=data.employees.filter(e=>e.id==='emp');configure(data,{employeeCommissions:[{employeeId:'emp',basisPoints:200}]});
 assert.equal(data.products[0].serviceDefinition.employeeCommissions.find(e=>e.employeeId==='otro').basisPoints,300);assert.equal(old.employeeCommissions[0].basisPoints,250);
 const entry={serviceSnapshots:[{employeeId:'otro',commissionCents:100,definition:{employeeCommissions:[{employeeId:'otro',basisPoints:300}]}}]};assert.equal(projectServiceEntry(entry,true,new Set(['emp'])).serviceSnapshots[0].employeeId,undefined);
});
test('configuración y centavos nuevos sobreviven al codec relacional y respaldo sin redondeo',()=>{
 const data=state();configure(data);data.entries=[{id:'e',date:'2026-11-04',lines:[{a:'5101',d:0.29,c:0},{a:'1301',d:0,c:0.29}],serviceConsumption:{costCents:29,totalCents:29},serviceSnapshots:serviceSaleSnapshot(data,[{p:'s',service:true,q:1,u:10}])}];
 const converted=normalizeDocument('11111111-1111-4111-8111-111111111111',data);assert.deepEqual(restoreDocument(converted),data);
 data.entries[0].serviceConsumption.costCents=0.5;assert.throws(()=>normalizeDocument('11111111-1111-4111-8111-111111111111',data),/centavos enteros/);
});

const source=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
function saleHarness(){
 const context=vm.createContext({invoiceTotals,normalizeItemQuantity,prepareBusinessSale,serviceConsumptionPlan,serviceSaleSnapshot,
  ensurePrintVersions(){},requirePermission(){},requireModule(){},requireValue:check,dateValue:v=>v,amount:Number,text:v=>String(v||''),round:v=>Math.round(v*100)/100,cents:moneyCents,currentShift:()=>null,salesAdministrator:()=>true,operatorId:()=> 'owner',actorName:()=> 'Dueño',appendEntry:(data,session,e)=>{const entry={id:'e-'+data.entries.length,...e};data.entries.push(entry);return entry},linesBetween:(a,b,n)=>[{a,d:n,c:0},{a:b,d:0,c:n}],audit:async()=>{},customerCreditBalance:()=>0});
 vm.runInContext(source.slice(source.indexOf('async function makeSale('),source.indexOf('function creditNote('))+';globalThis.sell=makeSale;',context);return context.sell;
}
test('emisor real crea factura y consumo separados con stock y asientos cuadrados',async()=>{
 const data=state();configure(data,{consumables:[{p:'p',q:0.125}]});
 const entry=await saleHarness()(data,{owner:true,branchId:'principal',company:{data}},{},{operationId:'11111111-1111-4111-8111-111111111111',date:'2026-11-04',items:[{p:'s',q:2,u:10}],payments:[{method:'transferencia',amount:23}],serviceConsumptionConfirmed:true});
 assert.equal(entry.stock.length,0);assert.equal(entry.total,23);assert.equal(data.products[0].stock,0);assert.equal(data.products[2].stock,9.75);assert.equal(data.entries.length,2);
 const consumption=data.entries.find(e=>e.type==='servicio-consumo');assert.equal(consumption.saleId,entry.id);assert.equal(consumption.total,0.29);assert.equal(consumption.stock[0].q,-0.25);assert.equal(consumption.lines.reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0),0);assert.ok(entry.lines.every(l=>l.a!=='5101'));
});
test('emisor exige confirmación del consumo e identificador antes de crear asientos',async()=>{
 for(const body of [{operationId:'op'},{serviceConsumptionConfirmed:true}]){
  const data=state();configure(data,{consumables:[{p:'p',q:1}]});await assert.rejects(()=>saleHarness()(data,{owner:true,branchId:'principal',company:{data}},{},{date:'2026-11-04',items:[{p:'s',q:1,u:10}],payments:[{method:'transferencia',amount:11.5}],...body}));assert.equal(data.entries.length,0);assert.equal(data.products[2].stock,10);
 }
});
test('el consumo conserva la precisión del saldo histórico del insumo',async()=>{
 const data=state();data.products[2].stock=1.123456;configure(data,{consumables:[{p:'p',q:0.125}]});
 await saleHarness()(data,{owner:true,branchId:'principal',company:{data}},{},{operationId:'11111111-1111-4111-8111-111111111111',date:'2026-11-04',items:[{p:'s',q:1,u:10}],payments:[{method:'transferencia',amount:11.5}],serviceConsumptionConfirmed:true});assert.equal(data.products[2].stock,0.998456);
});
test('nota de crédito real no repone ni revierte el costo de insumos ya consumidos',async()=>{
 const data=state();configure(data,{consumables:[{p:'p',q:1}]});
 const original=await saleHarness()(data,{owner:true,branchId:'principal',company:{data}},{},{operationId:'11111111-1111-4111-8111-111111111111',date:'2026-11-04',items:[{p:'s',q:1,u:10}],payments:[{method:'transferencia',amount:11.5}],serviceConsumptionConfirmed:true});
 const context=vm.createContext({requirePermission(){},supervisor:()=>true,requireValue:check,text:v=>String(v||''),dateValue:v=>v,allocateReturnItems,creditReturnSummary,round:v=>Math.round(v*100)/100,currentShift:()=>({id:'shift',date:'2026-11-04'}),actorName:()=> 'Dueño',operatorId:()=> 'owner',restoreBusinessReturn,linesBetween:(a,b,n)=>[{a,d:n,c:0},{a:b,d:0,c:n}],appendEntry:(data,session,e)=>{const entry={id:'note',...e};data.entries.push(entry);return entry}});
 vm.runInContext(source.slice(source.indexOf('function creditNote('),source.indexOf('async function saveAttachment('))+';globalThis.credit=creditNote;',context);
 const note=context.credit(data,{owner:true,branchId:'principal'},{},{id:original.id,date:'2026-11-04',reasonCategory:'error de precio',reason:'Corrección confirmada',refundMethod:'transferencia',items:[{p:'s',q:1}]});
 assert.equal(note.total,11.5);assert.equal(note.stock.length,0);assert.ok(note.lines.every(l=>!['1301','5101'].includes(l.a)));assert.equal(data.products[2].stock,9);assert.equal(data.entries.filter(e=>e.type==='servicio-consumo').length,1);
});
test('reintento de interfaz conserva confirmación y empleado sin cambiar la firma pendiente',async()=>{
 const clientSource=readFileSync(new URL('../public/service-catalog.js',import.meta.url),'utf8');
 const fragment=clientSource.slice(clientSource.indexOf('const serviceCatalogOperate=operate;'),clientSource.indexOf('const serviceCatalogSaleForm='));
 const pending={operation:'sale',body:{items:[{p:'s',q:1}],serviceConsumptionConfirmed:true,serviceEmployeeId:'emp'}};
 const context=vm.createContext({pendingCloudOperation:pending,permission:()=>false,serviceText:(k,t)=>t,operate:async(operation,body)=>body});
 vm.runInContext(fragment,context);
 const body=await context.operate('sale',{items:[{p:'s',q:1}]});assert.equal(body.serviceConsumptionConfirmed,true);assert.equal(body.serviceEmployeeId,'emp');
 const altered=await context.operate('sale',{items:[{p:'s',q:2}],serviceEmployeeId:'otro'});assert.equal(altered.serviceEmployeeId,'otro');assert.equal(altered.items[0].q,2);
});
test('guardado genérico conserva el orden de comisiones ocultas y rechaza cambios directos',()=>{
 const accessSource=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 const fragment=accessSource.slice(accessSource.indexOf('function restoreServiceCommissionProjection('),accessSource.indexOf('export function mergeData('));
 const context=vm.createContext({structuredClone,projectServiceEntry,allowed:(a,module)=>module!=='personal'||a.personal,equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),accessError:message=>{throw new Error(message)}});
 vm.runInContext(fragment+';globalThis.rehydrate=restoreServiceCommissionProjection;globalThis.rehydrateEntries=restoreServiceEntryProjections;',context);
 const data=state();data.employees.push({id:'otro'});configure(data,{employeeCommissions:[{employeeId:'otro',basisPoints:300},{employeeId:'emp',basisPoints:250}]});data.employees=data.employees.filter(e=>e.id==='emp');
 const original=structuredClone(data.products[0].serviceDefinition.employeeCommissions),visible=[projectServiceProduct(data.products[0],true,new Set(['emp']))];context.rehydrate(data,visible,{personal:true});assert.deepEqual(visible[0].serviceDefinition.employeeCommissions,original);
 const privateView=[projectServiceProduct(data.products[0],false)];context.rehydrate(data,privateView,{personal:false});assert.deepEqual(privateView[0].serviceDefinition.employeeCommissions,original);
 const altered=[projectServiceProduct(data.products[0],true,new Set(['emp']))];altered[0].serviceDefinition.employeeCommissions[0].basisPoints=900;assert.throws(()=>context.rehydrate(data,altered,{personal:true}));
 const entry={id:'sale',serviceSnapshots:[{employeeId:'emp',commissionCents:25,definition:{employeeCommissions:original}}]};data.entries=[entry];
 const projectedEntry=projectServiceEntry(entry,true,new Set(['emp']));context.rehydrateEntries(data,[projectedEntry],{personal:true});assert.deepEqual(projectedEntry.serviceSnapshots,entry.serviceSnapshots);
});
