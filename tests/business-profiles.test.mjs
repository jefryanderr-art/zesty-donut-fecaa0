// Preparadas para la plataforma. No ejecutar en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,validateProfile} from '../netlify/lib/business-profile.mjs';
import {businessLoanSchedule,businessLateCharge,moneyCents} from '../public/accounting-math.mjs';
import {businessOperation,prepareBusinessSale,restoreBusinessReturn} from '../netlify/lib/business.mjs';
import {BLOCKABLE_MODULES,requirePlanModule} from '../netlify/lib/billing-rules.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const context={check,permit:(a,m)=>check(!a.blocked?.includes(m),'Bloqueado: '+m),amount:v=>{moneyCents(Number(v));return Number(v)},date:v=>v,entry:(data,s,record)=>{const e={id:'entry-'+data.entries.length,...record};data.entries.push(e);return e},financialCash:()=>{}};
const access={owner:true,branchId:'principal',company:{businessType:'comercio',onboardingDone:true,data:{businessRecords:[],products:[]}}};
const state=()=>({businessRecords:[],entries:[],products:[],accounts:[],customers:[],employees:[],cfg:{}});
test('32 perfiles únicos y todas las capacidades bloqueables sin cambiar comercio',()=>{
 assert.equal(catalog.profiles.length,32);assert.equal(new Set(catalog.profiles.map(p=>p.id)).size,32);
 assert.equal(catalog.get('comercio').modules,null);assert.deepEqual(catalog.get('comercio').capabilities,[]);
 for(const id of catalog.all){assert.ok(BLOCKABLE_MODULES.includes(id));assert.throws(()=>requirePlanModule({blockedModules:[id]},id));}
 assert.throws(()=>validateProfile('inventado'));assert.throws(()=>validateProfile('comercio',{labels:{customer:' '}}));
});
test('amortización conserva capital en centavos en todos los métodos y frecuencias externas',()=>{
 for(const method of ['frances','capital_constante','plano'])for(const principal of [100.01,1000.03,99999.99]){
  const rows=businessLoanSchedule({principal,rate:1.713,periods:17,method});
  assert.equal(rows.reduce((sum,row)=>sum+moneyCents(row.principal),0),moneyCents(principal));assert.equal(rows.at(-1).balance,0);
  for(const row of rows)assert.equal(moneyCents(row.total),moneyCents(row.principal)+moneyCents(row.interest));
 }
 assert.throws(()=>businessLoanSchedule({principal:0.001,rate:1,periods:12,method:'frances'}));
 assert.equal(businessLateCharge(10.01,0.05,17),0.09);
});
test('cita superpuesta se rechaza dentro del recurso y admite un recurso distinto',async()=>{
 const data=state(),body={operation:'businessSave',module:'agenda',name:'Atención',date:'2026-10-29',resource:'Profesional 1',start:'2026-10-29T09:00:00Z',end:'2026-10-29T10:00:00Z',items:[]};
 await businessOperation(data,access,{},body,context);
 await assert.rejects(businessOperation(data,access,{},body,context),/recurso/);
 await businessOperation(data,access,{}, {...body,resource:'Profesional 2'},context);assert.equal(data.businessRecords.length,2);
});
test('FEFO excluye vencidos, registra procedencia y recupera lote al devolver',()=>{
 const data=state();data.products=[{id:'p',stock:12,price:1,cost:1}];
 for(const [id,due,q]of [['vencido','2026-10-01',3],['b','2026-12-01',5],['a','2026-11-01',4]])data.businessRecords.push({id,module:'lotes',productId:'p',date:'2026-10-01',due,q,status:'Disponible',events:[]});
 const allocations=prepareBusinessSale(data,access,{}, {date:'2026-10-29',items:[{p:'p',q:6}]},context);
 assert.deepEqual(allocations,[{id:'a',q:4},{id:'b',q:2}]);assert.equal(data.businessRecords.find(r=>r.id==='vencido').q,3);
 const original={id:'invoice',businessAllocations:allocations},note={id:'return',date:'2026-10-29',items:[{p:'p',q:2}]};
 restoreBusinessReturn(data,access,original,note,{},context);assert.equal(data.businessRecords.find(r=>r.id==='a').q,2);assert.equal(note.businessReturns[0].q,2);
});
test('plan bloqueado rechaza antes de modificar el catálogo',async()=>{
 const data=state();await assert.rejects(businessOperation(data,{...access,blocked:['inventario']},{},{operation:'businessProduct',name:'Servicio',price:10},context),/Bloqueado/);assert.equal(data.products.length,0);
});
test('una factura de negocio no admite descuento inyectado ni doble conversión',async()=>{
 const data=state();data.products=[{id:'p',price:10,stock:2}];data.businessRecords=[{id:'doc',module:'documentos_venta',name:'Pedido',status:'Pendiente',date:'2026-10-29',items:[{p:'p',q:1,u:10}],events:[]}];
 let calls=0;const ctx={...context,sale:async body=>{calls++;assert.equal(body.discount,0);return {id:'invoice',total:10,date:'2026-10-29',due:'2026-10-29'}}};
 const body={operation:'businessBill',module:'documentos_venta',id:'doc',date:'2026-10-29',confirmed:true,discount:99};
 await businessOperation(data,access,{},body,ctx);await assert.rejects(businessOperation(data,access,{},body,ctx));assert.equal(calls,1);
});
test('arranque no se aplica a empresas históricas y puede omitirse sin sembrar datos',async()=>{
 const data=state();await assert.rejects(businessOperation(data,access,{}, {operation:'businessOnboard',seed:true},context));
 const patch=await businessOperation(data,{...access,company:{...access.company,onboardingDone:false}},{},{operation:'businessOnboard',seed:false},context);assert.deepEqual(patch,{onboardingDone:true});assert.equal(data.products.length,0);
});
test('consignación preparada protege las existencias frente a otra venta',()=>{
 const data=state();data.products=[{id:'p',stock:5}];data.businessRecords=[{id:'ruta',module:'rutas',consignment:true,status:'Preparada',items:[{p:'p',q:4}]}];
 assert.throws(()=>prepareBusinessSale(data,access,{}, {date:'2026-10-29',items:[{p:'p',q:2}]},context),/consignación/);
 assert.doesNotThrow(()=>prepareBusinessSale(data,access,{}, {date:'2026-10-29',items:[{p:'p',q:4}]},{...context,trustedSourceId:'ruta'}));
});
test('devolución de series distingue productos y las unidades ya devueltas',()=>{
 const data=state();data.businessRecords=[['a','p'],['b','p'],['c','other']].map(([id,productId])=>({id,productId,module:'variantes',serial:id,status:'Vendida',events:[]}));
 const original={id:'invoice',businessAllocations:[{id:'a',q:1},{id:'b',q:1},{id:'c',q:1}]};
 data.entries.push({id:'old-return',type:'nota-credito',invoiceId:'invoice',businessReturns:[{id:'a',q:1}]});data.businessRecords[0].status='Disponible';
 const note={id:'new-return',date:'2026-10-29',items:[{p:'p',q:1}]};
 restoreBusinessReturn(data,access,original,note,{},context);
 assert.deepEqual(note.businessReturns,[{id:'b',q:1}]);assert.equal(data.businessRecords[2].status,'Vendida');
});
test('vincular una compra no duplica asiento y rechaza un segundo proyecto',async()=>{
 const data=state();data.entries.push({id:'purchase',type:'compra',total:100});
 data.businessRecords=['project1','project2'].map(id=>({id,module:'proyectos',date:'2026-10-29',events:[]}));
 const before=structuredClone(data.entries),body={operation:'businessPurchase',module:'proyectos',id:'project1',date:'2026-10-29',purchaseId:'purchase',confirmed:true};
 await businessOperation(data,access,{},body,context);assert.deepEqual(data.entries,before);
 await assert.rejects(businessOperation(data,access,{}, {...body,id:'project2'},context),/vinculada/);
});

test('los seis perfiles adicionales solo recomiendan capacidades implementadas y ejemplos sin saldos',()=>{
 for(const id of ['software','recurrentes','comercio_electronico','freelance','inmobiliaria','seguros']){
  const p=catalog.get(id);assert.equal(p.id,id);assert.doesNotThrow(()=>validateProfile(id));
  for(const module of [...p.capabilities,...p.optionalCapabilities])assert.ok(catalog.all.includes(module));
  assert.ok(p.salesFlow&&p.quickQuestions.length&&p.startup.examples.length);
  for(const example of p.startup.examples){
   assert.equal(example.price,undefined);assert.equal(example.stock,undefined);
   assert.equal(example.kind,id==='comercio_electronico'?'stock':'service');
  }
 }
 assert.equal(catalog.all.length,16);
});
test('servicios no consumen lotes, series, consignaciones ni producción aunque haya referencias inconsistentes',()=>{
 const data=state();data.products=[{id:'service',kind:'service',stock:0,cost:0,price:25}];
 data.businessRecords=[
  {id:'lot',module:'lotes',productId:'service',date:'2026-11-01',due:'2026-12-01',q:1,status:'Disponible'},
  {id:'serial',module:'variantes',productId:'service',serial:'S1',status:'Disponible'},
  {id:'recipe',module:'produccion',productId:'service',autoProduce:true,status:'Activa'},
  {id:'route',module:'rutas',consignment:true,status:'Preparada',items:[{p:'service',q:1}]}
 ];
 const before=structuredClone(data);
 const allocations=prepareBusinessSale(data,access,{}, {date:'2026-11-04',items:[{p:'service',q:3}]},{...context,permit(){throw new Error('No debe solicitar permisos de inventario')}});
 assert.deepEqual(allocations,[]);assert.deepEqual(data,before);
});
test('alta de servicio ignora stock/costo inyectados y conserva precio e IVA configurados',async()=>{
 const data=state();
 await businessOperation(data,access,{}, {operation:'businessProduct',name:'Atención',unit:'sesión',price:30,vatRate:15,stock:99,cost:8},context);
 assert.equal(data.products[0].kind,'service');assert.equal(data.products[0].stock,0);assert.equal(data.products[0].cost,0);
 assert.equal(data.products[0].price,30);assert.equal(data.products[0].vatRate,15);assert.deepEqual(data.entries,[]);
});
