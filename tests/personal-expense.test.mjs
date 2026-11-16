// Prepared for platform execution. No local execution in the managed session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {tradeOperation} from '../netlify/lib/trade.mjs';
import {correctEntry} from '../netlify/lib/entry-corrections.mjs';
import {statement} from '../netlify/lib/reporting.mjs';
import {moneyCents,partnerCapitalCents,treasuryIndirect} from '../public/accounting-math.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message)};
const owner={owner:true,branchId:'principal'},session={email:'owner@example.test'};
const balance=(d,a,to='9999')=>d.entries.filter(e=>e.date<=to).flatMap(e=>e.lines).filter(l=>l.a===a).reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0)/100;
const append=(d,s,e)=>{check(e.lines.every(l=>d.accounts.some(a=>a.code===l.a)),'Cuenta inexistente');check(e.lines.reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0)===0,'Descuadre');const r={id:randomUUID(),managed:true,branchId:'principal',...e};d.entries.push(r);return r};
const helpers={requireValue:check,requirePermission(){},appendEntry:append,dateValue:v=>v,ledgerBalance:balance,amount:v=>{const c=moneyCents(v);check(c>0,'Importe inválido');return c/100}};
function fixture(){return {cfg:{},accounts:[['1101','activo','D','ef'],['1102','activo','D','ef'],['1301','activo','D',''],['3101','patrimonio','C','fin'],['3102','patrimonio','C',''],['4101','ingreso','C',''],['6103','gasto','D','']].map(([code,tipo,nat,sub])=>({code,name:code,tipo,nat,sub})),entries:[{id:'fund',date:'2026-01-01',type:'capital-socio',branchId:'principal',lines:[{a:'1101',d:1000,c:0},{a:'3101',d:0,c:800},{a:'3102',d:0,c:200}]}],partners:[{id:'p',name:'Socio',movements:[{date:'2026-01-01',kind:'aporte',total:800,entryId:'fund'}]}],products:[],businessRecords:[]};}
// Mirrors the production transaction: publish the working copy only after all validation succeeds.
function run(d,body={},access=owner){const copy=structuredClone(d);const id=tradeOperation(copy,access,session,{operation:'capitalMovement',kind:'gasto_personal',date:'2026-02-01',partnerId:'p',pay:'1101',concept:'Compra familiar',total:10,...body},helpers);Object.assign(d,copy);return id;}
test('personal expenses use only equity and cash; profit and margin components stay unchanged',()=>{
 const d=fixture(),before=statement(d,'2026-01-01','2026-12-31');const id=run(d);const e=d.entries.find(e=>e.id===id),after=statement(d,'2026-01-01','2026-12-31');assert.deepEqual(e.lines,[{a:'3103',d:10,c:0},{a:'1101',d:0,c:10}]);assert.equal(e.type,'capital-socio');assert.equal(e.desc,'Gasto personal · Compra familiar · Socio');for(const key of ['revenue','cost','expense','profit'])assert.equal(after[key],before[key]);assert.equal(after.equity,before.equity-10);assert.equal(after.assets,before.assets-10);const cash=treasuryIndirect(d,'2026-02-01','2026-02-28');assert.equal(cash.financingCents,-1000);assert.equal(cash.operatingCents,0);
});
for(const [label,body,message] of [
 ['capital insuficiente',{source:'3101',total:801},/Capital/],['utilidades insuficientes',{source:'3102',total:201},/Utilidades/],['concepto vacío',{concept:' '},/concepto/],['concepto largo',{concept:'a'.repeat(201)},/concepto/],['caja insuficiente',{total:1001},/Caja/],['banco insuficiente',{pay:'1102'},/Caja/],['socio inexistente',{partnerId:'missing'},/socio/],['origen inválido',{source:'6103'},/origen/],['crédito',{pay:'2101'},/cuenta/],['fracción de centavo',{total:1.005},/decimales/],['cero',{total:0},/Importe/]
])test(label+' leaves no partial entry or movement',()=>{const d=fixture(),before=structuredClone(d);assert.throws(()=>run(d,body),message);assert.deepEqual(d,before)});
test('capital is limited by the partner contributions as well as the ledger',()=>{const d=fixture();d.partners[0].movements[0].total=5;assert.throws(()=>run(d,{source:'3101'}),/socio insuficiente/)});
test('non-owner and inactive partner are rejected',()=>{assert.throws(()=>run(fixture(),{},{...owner,owner:false}),/dueño/);const d=fixture();d.partners[0].active=false;assert.throws(()=>run(d),/activo/)});
test('identical submissions within ten seconds are rejected regardless of operation id',()=>{const d=fixture();run(d);const before=structuredClone(d);assert.throws(()=>run(d,{operationId:randomUUID()}),/acaba/);assert.deepEqual(d,before)});
test('closed period and backdated exhaustion are rejected',()=>{const d=fixture();d.cfg.periodLocks={'principal:2026-02':{closed:true}};assert.throws(()=>run(d),/cerrado/);delete d.cfg.periodLocks;d.entries.push({id:'later',date:'2026-03-01',lines:[{a:'3101',d:995,c:0},{a:'1101',d:0,c:995}]});assert.throws(()=>run(d),/Caja/)});
test('annulment restores balances and partner availability, cannot replace with business expense',()=>{
 for(const source of ['3101','3102','3103']){const d=fixture(),before=statement(d,'2026-01-01','2026-12-31'),id=run(d,{source});const body={id,date:'2026-02-01',reason:'Registro equivocado',reference:'AN-1'};assert.throws(()=>correctEntry(structuredClone(d),owner,session,{...body,replacement:{type:'gasto'}},{append,date:v=>v}),/anula/);const result=correctEntry(d,owner,session,body,{append,date:v=>v});const after=statement(d,'2026-01-01','2026-12-31');for(const key of ['assets','equity','profit'])assert.equal(after[key],before[key]);assert.equal(partnerCapitalCents(d.partners[0],d.entries),80000);assert.equal(d.partners[0].movements.at(-1).reversalId,result.reversalId);}
});
test('cent arithmetic stays balanced through mixed movements and round trips storage',()=>{const d=fixture();run(d,{total:0.1+0.2});run(d,{kind:'aporte',total:15.75});run(d,{source:'3101',total:7.25,concept:'Familia'});run(d,{source:'3102',total:1.01,concept:'Medicina'});run(d,{kind:'dividendo',total:2.99});for(const e of d.entries)assert.equal(e.lines.reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0),0);const report=statement(d,'2026-01-01','2026-12-31');assert.equal(moneyCents(report.assets),moneyCents(report.liabilities)+moneyCents(report.equity)+moneyCents(report.profit));const stored=restoreDocument(normalizeDocument('11111111-1111-4111-8111-111111111111',d));assert.deepEqual(stored,d);});
test('failed posting is not published as a partner movement',()=>{const d=fixture(),before=structuredClone(d),copy=structuredClone(d);assert.throws(()=>tradeOperation(copy,owner,session,{operation:'capitalMovement',kind:'gasto_personal',date:'2026-02-01',partnerId:'p',pay:'1101',concept:'Compra familiar',total:10},{...helpers,appendEntry(){throw Error('Fallo simulado')}}),/simulado/);assert.deepEqual(d,before);assert.equal(copy.partners[0].movements.length,before.partners[0].movements.length);});

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as accountingMath from '../public/accounting-math.mjs';
import {fiscalAnnualTotals} from '../netlify/lib/fiscal-projection.mjs';
const tradeUI=readFileSync(new URL('../public/trade.js',import.meta.url),'utf8');
const accountingUI=readFileSync(new URL('../public/accounting.js',import.meta.url),'utf8');
const appUI=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function uiContext(ownerValue=true,partners=[]){
 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const context=vm.createContext({CO:{owner:ownerValue},S:{partners,entries:[]},esc,
  option:(v,l)=>`<option value="${esc(v)}">${esc(l)}</option>`,selectField:(n,l,o)=>`<label>${l}<select name="${n}">${o}</select></label>`,
  field:(n,l)=>`<label>${l}<input name="${n}"></label>`,money:n=>Number(n).toFixed(2),notice:s=>`<p>${s}</p>`,entryIsAnnulled:e=>!!e.annulled,
  entryCard:e=>`<article>${esc(e.desc)} Personal</article>`,uiT:(_k,t)=>t,math:accountingMath});
 vm.runInContext(tradeUI.slice(tradeUI.indexOf('const personalSourceNames='),tradeUI.indexOf('async function personalExpensePreview')),context);
 return context;
}
for(const partners of [[],[{id:'p',name:'Socio activo'}],[{id:'p',name:'Archivado',status:'archivado'}]])test('new expense selector remains visible with '+partners.length+' partners '+(partners[0]?.status||''),async()=>{
 const c=uiContext(true,partners);let html='';const form={elements:{pay:{value:''}},addEventListener(){}};
 Object.assign(c,{modal:(_t,body)=>{html=body;return form},today:()=> '2026-02-01',amountField:()=>'',accOpts:()=>'',payOpts:()=>'',personalExpensePreview:async()=>{},v:()=> 'business'});
 vm.runInContext(accountingUI.slice(accountingUI.indexOf('async function expenseForm('),accountingUI.indexOf('ACT.gasto=')),c);
 // Keep the test focused on rendering; the toggle needs actual DOM controls in a browser.
 form.addEventListener=()=>{};
 form.elements.base={closest:()=>({firstChild:{}})};for(const n of ['account','vat','reference','due'])form.elements[n]={closest:()=>({})};form.elements.pay.options=[];
 await c.expenseForm();assert.match(html,/¿Quién asume este gasto\?/);assert.match(html,/Gasto personal del socio/);
 if(!partners.length||partners[0]?.status==='archivado'){assert.match(html,/Primero registra un socio/);assert.match(html,/data-register-partner/);}else assert.match(html,/Socio activo/);
});
test('non-owner sees disabled personal option and explanation',()=>{const c=uiContext(false);const html=c.personalExpenseChoice();assert.match(html,/<option value="personal" disabled>/);assert.match(html,/Solo el dueño puede registrar gastos personales/);});
test('personal list has its own total, excludes contributions and annulled amounts, and follows dates',()=>{
 const c=uiContext(true,[{movements:[{entryId:'p1',kind:'gasto_personal'},{entryId:'p2',kind:'gasto_personal'},{entryId:'old',kind:'gasto_personal'}]}]);
 c.S.entries=[{id:'p1',type:'capital-socio',date:'2026-02-01',desc:'Familia',total:12.34},{id:'p2',type:'capital-socio',date:'2026-02-02',desc:'Anulado',total:5,annulled:true},{id:'fund',type:'capital-socio',date:'2026-02-01',desc:'Aporte',total:100},{id:'old',type:'capital-socio',date:'2025-02-01',desc:'Anterior',total:200},{id:'biz',type:'gasto',date:'2026-02-01',desc:'Negocio',total:7}];
 vm.runInContext(tradeUI.slice(tradeUI.indexOf('function personalExpensesSection(')),c);
 const html=c.personalExpensesSection('2026-02-01','2026-02-28');assert.match(html,/Gastos personales del socio/);assert.match(html,/Total personal vigente: <b>12.34/);assert.match(html,/Personal/);assert.match(html,/Anulado/);assert.doesNotMatch(html,/Aporte|Anterior|Negocio/);
 Object.assign(c,{rg:()=>['2026-02-01','2026-02-28'],main:s=>c.rendered=s,pbar:()=>'',PAY:{},entryCorrectionButton:()=>''});
 vm.runInContext(appUI.slice(appUI.indexOf('function listV('),appUI.indexOf('V.ventas=')),c);
 c.listV('gasto','Gastos','Nuevo gasto','gasto');assert.match(c.rendered,/Total: <b>7.00/);assert.match(c.rendered,/Total personal vigente: <b>12.34/);
});
test('preview warns above profit and limits alternative equity sources without blocking withdrawals',async()=>{
 const c=uiContext(true,[{id:'p',movements:[]}]),summary={};
 const source={value:'3103',options:['3103','3101','3102'].map(value=>({value}))};Object.defineProperty(source,'selectedOptions',{get:()=>source.options.filter(o=>o.value===source.value)});
 const form={elements:{source,partnerId:{value:'p'},date:{value:'2026-02-01'},base:{value:'150'},pay:{value:'1101'},assumption:{value:'personal'}},querySelector:s=>s==='[data-personal-summary]'?summary:null,addEventListener(_event,fn){this.update=fn}};
 Object.assign(c,{v:(f,n)=>f.elements[n].value,rg:()=>['2026-02-01','2026-02-28'],bal:()=>({'1101':{d:1000,c:0},'3101':{d:0,c:100},'3102':{d:0,c:200}}),tot:(_b,type)=>type==='ingreso'?100:0});
 vm.runInContext(tradeUI.slice(tradeUI.indexOf('async function personalExpensePreview('),tradeUI.indexOf('async function submitPersonalExpense(')).replace(/await import\([^\n]+\)/,'globalThis.math'),c);
 await c.personalExpensePreview(form,'base');assert.equal(source.value,'3103');assert.equal(source.options.find(o=>o.value==='3101').disabled,true);assert.equal(source.options.find(o=>o.value==='3102').disabled,false);assert.equal(source.options.find(o=>o.value==='3103').disabled,false);assert.match(summary.textContent,/Este gasto es mayor que la utilidad del período; se descontará del patrimonio, no de la utilidad/);
 form.elements.base.value='50';form.update();assert.doesNotMatch(summary.textContent,/Este gasto es mayor/);
});
test('expense exceeding period profit keeps fiscal totals and results intact while balance stays balanced',()=>{
 for(const source of ['3103','3101','3102']){const d=fixture(),fiscalBefore=fiscalAnnualTotals(d),before=statement(d,'2026-01-01','2026-12-31');run(d,{total:150,source});const after=statement(d,'2026-01-01','2026-12-31');assert.ok(150>before.profit);assert.equal(after.profit,before.profit);assert.deepEqual(fiscalAnnualTotals(d),fiscalBefore);assert.equal(after.assets,before.assets-150);assert.equal(after.equity,before.equity-150);assert.equal(after.assets,after.liabilities+after.equity+after.profit);}
});
test('register partner inside expense preserves fields and selects the server-created partner',async()=>{
 const c=uiContext(),nodes={'[data-register-partner]':{},'[data-partner-form]':{hidden:true},'[data-save-partner]':{},'[data-partner-error]':{},'[data-personal-register]':{hidden:false},'[data-personal-summary]':{}};
 const source={value:'3103',options:['3103','3101','3102'].map(value=>({value}))};Object.defineProperty(source,'selectedOptions',{get:()=>source.options.filter(o=>o.value===source.value)});
 const form={elements:{source,partnerId:{value:'',insertAdjacentHTML(_where,html){this.html=html}},personalPartnerName:{value:'Socio <nuevo>',focus(){}},description:{value:'Compra familiar'},base:{value:'12.34'},date:{value:'2026-02-01'},pay:{value:'1101'},assumption:{value:'personal'}},querySelector:s=>nodes[s]||null,addEventListener(){},dispatchEvent(){this.changed=true}};
 Object.assign(c,{Event:class{},v:(f,n)=>f.elements[n].value,rg:()=>['2026-02-01','2026-02-28'],bal:()=>({}),tot:()=>0,operate:async(op,body)=>{assert.equal(op,'partner');assert.equal(body.name,'Socio <nuevo>');c.S.partners.push({id:'created',name:body.name});}});
 vm.runInContext(tradeUI.slice(tradeUI.indexOf('async function personalExpensePreview('),tradeUI.indexOf('async function submitPersonalExpense(')).replace(/await import\([^\n]+\)/,'globalThis.math'),c);
 await c.personalExpensePreview(form,'base');nodes['[data-register-partner]'].onclick();assert.equal(nodes['[data-partner-form]'].hidden,false);
 await nodes['[data-save-partner]'].onclick();assert.equal(form.elements.partnerId.value,'created');assert.match(form.elements.partnerId.html,/&lt;nuevo>/);assert.equal(form.elements.base.value,'12.34');assert.equal(form.elements.description.value,'Compra familiar');assert.equal(form.changed,true);assert.equal(nodes['[data-personal-register]'].hidden,true);
});
