import test from 'node:test';
import assert from 'node:assert/strict';
import {foodWorkflow,effectiveFoodPrice,foodAvailability} from '../netlify/lib/food-workflows.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const ctx={check,permit(){},date:v=>v,amount:v=>Number(v),entry(d,s,e){e.id='movement';d.entries.push(e);return e;}};
const access={owner:true,branchId:'principal'},session={email:'owner@example.test'};
const run=(d,b)=>foodWorkflow(d,access,session,{date:'2026-11-05',confirmed:true,operationId:'operation',...b},ctx);
function fixture(){return {products:[{id:'bread',name:'Pan',kind:'stock',price:2,cost:1,stock:30},{id:'flour',name:'Harina',kind:'stock',stock:100,cost:1,price:1},{id:'extra',name:'Extra',kind:'service',price:3}],entries:[],customers:[{id:'customer',status:'activo'}],businessRecords:[{id:'recipe',module:'produccion',status:'Activa',name:'Pan',productId:'bread',yield:1,waste:0,ingredients:[{p:'flour',q:1,u:1}],events:[]},{id:'account',module:'cuentas_abiertas',status:'Abierta',items:[],events:[]}]};}
test('structured options add catalog extras and convert a dozen to base inventory units',async()=>{
 const d=fixture();await run(d,{operation:'foodRecipeSettings',id:'recipe',groups:[{name:'Relleno',required:true,options:[{name:'Especial',productId:'extra'}]}],presentations:[{name:'Docena',factor:12}],blockMissing:true});
 await assert.rejects(run(d,{operation:'foodAddOptions',id:'account',productId:'bread',q:1,presentation:'Docena',options:[]}));
 await run(d,{operation:'foodAddOptions',id:'account',productId:'bread',q:1,presentation:'Docena',person:'Persona 1',options:[{group:'Relleno',name:'Especial'}]});
 const a=d.businessRecords.find(r=>r.id==='account');assert.equal(a.items.length,2);assert.equal(a.items[0].q,12);assert.equal(a.items[1].u,3);assert.equal(a.items[0].optionGroupId,a.items[1].optionGroupId);assert.equal(a.total,60);assert.equal(d.products[0].stock,30);
});
test('table transfer moves open family together and rejects occupied destinations',async()=>{
 const d=fixture();d.businessRecords.push({id:'table',module:'cuentas_abiertas',kind:'dining-table',name:'Terraza',zone:'Exterior',capacity:4},{id:'part',module:'cuentas_abiertas',status:'Abierta',tableFamilyId:'account',events:[]});
 await run(d,{operation:'foodMoveTable',id:'account',tableId:'table'});assert.equal(d.businessRecords.find(r=>r.id==='part').tableId,'table');
 d.businessRecords.push({id:'other',module:'cuentas_abiertas',tableId:'table',status:'Abierta'});await assert.rejects(run(d,{operation:'foodMoveTable',id:'account',tableId:'table'}));
});
test('catering scales recipe ingredients by guests and validates payment calendar totals',async()=>{
 const d=fixture(),b={operation:'foodEventSave',name:'Evento',customerId:'customer',due:'2026-11-06',deliveryAt:'2026-11-06T12:00:00Z',guests:20,menu:[{recipeId:'recipe',perGuest:2}],items:[{p:'bread',q:40,u:2}],paymentCalendar:[{due:'2026-11-05',amountCents:3000},{due:'2026-11-06',amountCents:5000}]};
 const id=await run(d,b),r=d.businessRecords.find(r=>r.id===id);assert.equal(r.total,80);assert.equal(r.eventIngredients[0].q,40);assert.equal(d.products[1].stock,100);assert.equal(d.entries.length,0);
 await assert.rejects(run(d,{...b,paymentCalendar:[{due:'2026-11-05',amountCents:1}]}));
});
test('seasonal catalog price and exhausted recipe checks are opt-in',async()=>{
 const d=fixture();await run(d,{operation:'foodRecipeSettings',id:'recipe',groups:[],blockMissing:true,seasons:[{from:'2026-11-01',to:'2026-11-30',unitCents:250}],presentations:[{name:'Porción',factor:0.125}]});
 assert.equal(effectiveFoodPrice(d,d.products[0],'2026-11-05'),2.5);assert.equal(effectiveFoodPrice(d,d.products[0],'2026-12-01'),2);d.products[1].stock=0;assert.throws(()=>foodAvailability(d,[{p:'bread',q:1}],check));
 await assert.rejects(run(d,{operation:'foodRecipeSettings',id:'recipe',groups:[],presentations:[{name:'Tercio',factor:1/3}]}));
});
test('waste requires reason and sufficient lot, preserves explicit stock and expense linkage',async()=>{
 const d=fixture();d.accounts=[{code:'loss',tipo:'gasto'}];d.businessRecords.push({id:'lot',module:'lotes',productId:'bread',q:5,status:'Disponible',events:[]});
 const b={operation:'foodWaste',kind:'merma',productId:'bread',q:2,lotId:'lot',expenseAccount:'loss',reason:'Producto dañado',zone:'Vitrina'};await run(d,b);assert.equal(d.products[0].stock,28);assert.equal(d.businessRecords.find(r=>r.id==='lot').q,3);assert.equal(d.entries[0].reason,b.reason);assert.equal(d.entries[0].lines[0].a,'loss');
 await assert.rejects(run(d,{...b,reason:''}));await assert.rejects(run(d,{...b,q:4}));
});
