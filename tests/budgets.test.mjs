import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetOperation,budgetReport,BUDGET_OPS} from '../netlify/lib/budgets.mjs';
import {managuaDay} from '../netlify/lib/billing-rules.mjs';
const ctx={permit(){}};
const access=(o={})=>({owner:true,branchId:'principal',company:{name:'Demo'},...o});
const session={email:'dueno@example.com'};
const body=(operation,extra={})=>({operation,date:managuaDay(),reason:'Motivo de prueba',confirmed:true,...extra});
const base=()=>({businessRecords:[],accounts:[{code:'6101'}],entries:[{id:'e1',date:managuaDay().slice(0,4)+'-02-01',costCenter:'Ventas',branchId:'principal',lines:[{a:'6101',d:50.25,c:0},{a:'1101',d:0,c:50.25}]}]});
const run=(d,op,extra,a=access())=>budgetOperation(d,a,session,body(op,extra),ctx);
test('nace apagado y solo el dueño activa hoy',async()=>{
 const d=base();
 await assert.rejects(()=>run(d,'budCreate',{name:'A'}),/dueño debe activar/);
 await assert.rejects(()=>run(d,'budEnable',{enabled:true},access({owner:false})),/dueño/);
 await assert.rejects(()=>run(d,'budEnable',{enabled:true,confirmed:false}),/confirma/i);
 assert.equal(d.businessRecords.length,0);assert.equal(budgetReport(d,{}).enabled,false);
});
test('presupuesto con versiones, desviación y centavos enteros',async()=>{
 const d=base();await run(d,'budEnable',{enabled:true});const y=Number(managuaDay().slice(0,4));
 await assert.rejects(()=>run(d,'budCreate',{name:'P',year:y,dimension:'cuenta',lines:[{key:'6101',amountCents:10.5}]}),/centavos/);
 await assert.rejects(()=>run(d,'budCreate',{name:'P',year:y,dimension:'cuenta',lines:[{key:'9999',amountCents:100}]}),/cuenta/);
 const id=await run(d,'budCreate',{name:'P',year:y,dimension:'cuenta',lines:[{key:'6101',amountCents:4000}]});
 await run(d,'budRevise',{id,lines:[{key:'6101',amountCents:5000}]});
 assert.equal(d.businessRecords.find(r=>r.id===id).versions.length,2);
 const r=budgetReport(d,{from:y+'-01-01',to:y+'-12-31'}),l=r.budgets[0].lines[0];
 assert.equal(l.actualCents,5025);assert.equal(l.alert,false);
 await run(d,'budCreate',{name:'C',year:y,dimension:'centro',lines:[{key:'Ventas',amountCents:1000}]});
 assert.equal(budgetReport(d,{}).budgets[1].lines[0].alert,true);
});
test('operaciones exigen módulo y archivo conserva datos',async()=>{
 assert.deepEqual(BUDGET_OPS,['budEnable','budCreate','budRevise','budArchive']);
 const d=base();await run(d,'budEnable',{enabled:true});
 const id=await run(d,'budCreate',{name:'P',year:2026,dimension:'sucursal',lines:[{key:'principal',amountCents:1}]});
 await run(d,'budArchive',{id});assert.equal(d.businessRecords.find(r=>r.id===id).status,'Archivada');
 await assert.rejects(()=>run(d,'budRevise',{id,lines:[{key:'principal',amountCents:2}]}),/archivado/);
});
