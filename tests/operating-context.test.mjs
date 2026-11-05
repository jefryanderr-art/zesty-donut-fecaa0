// Preparadas para la plataforma; no ejecutadas en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {saleContext} from '../netlify/lib/sale-context.mjs';
import {businessOperation} from '../netlify/lib/business.mjs';
import {businessRecipePlan} from '../public/accounting-math.mjs';
import {catalog} from '../netlify/lib/business-profile.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const context={check,permit:(access,module)=>check(!access.blocked?.includes(module),'Sin permiso'),date:v=>v};
const session={email:'operador@example.test'};
const account=()=>({id:'account-1',module:'cuentas_abiertas',name:'Mesa terraza',resource:'T1',responsible:'Mesero',status:'Abierta',date:'2026-11-05',items:[{lineId:'line-1',p:'p1',q:3,u:5,note:'Sin cebolla'}],events:[]});
const state=()=>({businessRecords:[account()],products:[{id:'p1',name:'Plato',stock:10,cost:2,price:5}],entries:[]});
const access={owner:true,branchId:'principal',company:{businessType:'restaurante'}};
const request={operation:'businessDispatch',operationId:'request-1',confirmed:true,date:'2026-11-05',module:'cuentas_abiertas',id:'account-1',station:'cocina',lineIds:['line-1']};
test('contexto opcional y validación estricta sin campos monetarios arbitrarios',()=>{
 assert.equal(saleContext(undefined,check),undefined);
 assert.equal(saleContext({},check),undefined);
 assert.deepEqual(saleContext({resource:' T1 ',ticket:'14',total:100},check),{resource:'T1',ticket:'14'});
 for(const invalid of [[],{modality:'inventada'},{resource:'x'.repeat(201)},{ticket:14},{resource:'a\nb'}])assert.throws(()=>saleContext(invalid,check));
});
test('alimentos conserva identificadores y capacidades compartidas; panadería es independiente',()=>{
 for(const id of ['restaurante','comida_rapida','catering'])for(const module of ['cuentas_abiertas','despacho','produccion','comisiones','documentos_venta'])assert.ok(catalog.get(id).capabilities.includes(module));
 assert.equal(catalog.get('panaderia').id,'panaderia');assert.equal(catalog.get('comida_rapida').id,'comida_rapida');
});
test('ronda solo prepara: no hay factura, asiento ni consumo y no se reenvía la línea',async()=>{
 const data=state();await businessOperation(data,access,session,{...request},context);
 assert.equal(data.entries.length,0);assert.equal(data.products[0].stock,10);
 const dispatch=data.businessRecords[1];assert.equal(dispatch.sourceAccountId,'account-1');assert.equal(dispatch.items[0].note,'Sin cebolla');assert.equal(dispatch.station,'cocina');
 await assert.rejects(businessOperation(data,access,session,{...request,operationId:'request-2'},context),/ya fue enviada/);
 await assert.rejects(businessOperation(data,access,session,{operation:'businessBill',operationId:'bill-1',confirmed:true,module:'despacho',id:dispatch.id,date:request.date},context),/cuenta de origen/);
});
test('el envío exige permisos de ambos módulos y una selección válida',async()=>{
 await assert.rejects(businessOperation(state(),{...access,blocked:['despacho']},session,{...request},context),/Sin permiso/);
 await assert.rejects(businessOperation(state(),access,session,{...request,lineIds:['otra-linea']},context),/no pertenece/);
});
test('dividir conserva consumos enviados en ambas cuentas sin permitir un reenvío',async()=>{
 const data=state();await businessOperation(data,access,session,{...request},context);
 const id=await businessOperation(data,access,session,{operation:'businessSplit',module:'cuentas_abiertas',id:'account-1',splitItems:[{index:0,q:1}],name:'Persona 2'},context);
 const original=data.businessRecords[0],split=data.businessRecords.find(r=>r.id===id);
 assert.equal(original.items[0].q,2);assert.equal(original.items[0].dispatchedQ,2);assert.equal(split.items[0].q,1);assert.equal(split.items[0].dispatchedQ,1);
});
test('escalado usa rendimiento y merma sin cambiar existencias',()=>{
 const products=[{id:'harina',name:'Harina',unit:'kg',stock:2}];
 const plan=businessRecipePlan({yield:12,waste:10,ingredients:[{p:'harina',q:1}]},36,products);
 assert.equal(plan[0].q,3.3);assert.equal(plan[0].missing,1.3);assert.equal(products[0].stock,2);
 assert.throws(()=>businessRecipePlan({yield:0,ingredients:[]},1,products));
});
test('una ronda vinculada no se convierte en despacho independiente mediante edición',async()=>{
 const data=state();await businessOperation(data,access,session,{...request},context);
 await assert.rejects(businessOperation(data,access,session,{operation:'businessSave',module:'despacho',id:data.businessRecords[1].id},context),/conserva sus consumos/);
});
test('anular un consumo enviado conserva trazabilidad sin mover inventario',async()=>{
 const data=state();await businessOperation(data,access,session,{...request},context);
 const op={operation:'businessVoidLine',module:'cuentas_abiertas',id:'account-1',confirmed:true,index:0,reason:'Cliente cancela el plato'};
 await assert.rejects(businessOperation(data,{...access,owner:false},session,op,context),/supervisor/);
 await businessOperation(data,access,session,op,context);
 assert.equal(data.businessRecords[0].items.length,0);assert.equal(data.businessRecords[1].items[0].voidedQ,3);
 assert.equal(data.businessRecords[1].total,0);assert.equal(data.products[0].stock,10);assert.equal(data.entries.length,0);
});
