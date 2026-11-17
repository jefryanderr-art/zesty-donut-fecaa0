// Regresiones contables y de autorización del gasto personal del socio.
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
test('usuario sin permiso ve opción personal deshabilitada y explicación',()=>{const c=uiContext(false);const html=c.personalExpenseChoice();assert.match(html,/<option value="personal" disabled>/);assert.match(html,/Solo el dueño o un socio autorizado puede registrar gastos personales/);});
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

import {partnerGrant,partnerAuthorized,validatePartnerGrant} from '../netlify/lib/partner-access.mjs';
import {annualPreview} from '../netlify/lib/annual-closing.mjs';
const linked=(overrides={})=>({owner:false,branchId:'principal',member:{id:'member-p',active:true,permissions:{partnerAccess:{partnerId:'p',personalExpenses:true,withdrawals:false,statement:false}},...overrides}});
test('el dueño registra a cualquier socio activo, sin usuario vinculado',()=>{
 const d=fixture();d.partners.push({id:'otro',name:'Otra socia',movements:[]});run(d,{partnerId:'otro'});assert.equal(d.partners[1].movements.length,1);assert.equal(d.entries.at(-1).partnerId,'otro');assert.equal(d.partners[1].movements[0].registeredBy,session.email);
});
test('socio vinculado autorizado registra solo sus gastos; audita identidad y destinatario',()=>{
 const d=fixture(),a=linked();run(d,{},a);assert.equal(d.entries.at(-1).registeredBy,'member-p');assert.equal(d.entries.at(-1).partnerId,'p');assert.ok(d.partners[0].movements.at(-1).registeredAt);
 d.partners.push({id:'otro',name:'Otro',movements:[]});assert.throws(()=>run(d,{partnerId:'otro'},a),/propios/);
 for(const kind of ['aporte','dividendo','reserva'])assert.throws(()=>run(fixture(),{kind},a),/dueño/);
});
for(const [name,a] of [
 ['sin permiso',linked({permissions:{partnerAccess:{partnerId:'p'}}})],
 ['colaborador con escritura contable',linked({role:'contador',permissions:{contabilidad:'escritura',gastos:'escritura'}})],
 ['sin vincular',linked({permissions:{partnerAccess:{personalExpenses:true}}})],
 ['usuario inactivo',linked({active:false})]
])test(name+' no puede registrar gasto personal en el servidor',()=>assert.throws(()=>run(fixture(),{},a),/dueño/));
test('retiro propio exige su permiso independiente y permanece ajeno al resultado',()=>{
 assert.throws(()=>run(fixture(),{kind:'retiro'},linked()),/dueño/);
 const d=fixture(),a=linked({permissions:{partnerAccess:{partnerId:'p',withdrawals:true}}}),before=statement(d,'0000','9999');run(d,{kind:'retiro'},a);assert.equal(d.partners[0].movements.at(-1).kind,'retiro');assert.equal(statement(d,'0000','9999').profit,before.profit);
});
test('un socio anula solo lo registrado por él, con permiso vigente y período abierto',()=>{
 const d=fixture(),a=linked(),id=run(d,{},a),body={id,date:'2026-02-01',reason:'Error de socio',reference:'SOC-1'};
 const another=linked({id:'another',permissions:{partnerAccess:{partnerId:'p',personalExpenses:true}}});
 assert.throws(()=>correctEntry(structuredClone(d),another,session,body,{append,date:v=>v}),/Correcciones|propio/);
 const revoked=linked({permissions:{partnerAccess:{partnerId:'p'}}});assert.throws(()=>correctEntry(structuredClone(d),revoked,session,body,{append,date:v=>v}),/Correcciones|propio/);
 const closed=structuredClone(d);closed.cfg.periodLocks={'principal:2026-02':{closed:true}};assert.throws(()=>correctEntry(closed,a,session,body,{append,date:v=>v}),/cerrado/);
 const result=correctEntry(d,a,session,body,{append,date:v=>v});assert.equal(d.partners[0].movements.at(-1).reversalId,result.reversalId);
});
test('permisos desactivados por defecto; solo dueño vincula, concede y revoca; vínculo único',()=>{
 const partners=fixture().partners,validate=(requested,extra={})=>validatePartnerGrant({owner:true,requested,partners,members:[],check,...extra});
 assert.deepEqual(partnerGrant(),{partnerId:'',personalExpenses:false,withdrawals:false,statement:false});
 const granted=validate({partnerId:'p',personalExpenses:true,withdrawals:true,statement:true});assert.equal(granted.personalExpenses,true);
 assert.throws(()=>validate(granted,{owner:false}),/dueño/);
 assert.throws(()=>validate(granted,{members:[{id:'occupied',permissions:{partnerAccess:granted}}]}),/otro usuario/);
 const revoked=validate({partnerId:'p'},{previous:granted});assert.equal(revoked.personalExpenses,false);assert.equal(revoked.withdrawals,false);
 assert.throws(()=>validate({personalExpenses:true}),/Vincula/);
 assert.equal(partnerAuthorized(linked(),partners[0],'gasto_personal'),true);
});
test('patrimonio negativo exige confirmación explícita, no bloquea y conserva utilidad y fiscal',()=>{
 const d=fixture();d.accounts.push({code:'2101',tipo:'pasivo',nat:'C'});d.entries.push({id:'loan',date:'2026-01-02',type:'manual',lines:[{a:'1101',d:2000,c:0},{a:'2101',d:0,c:2000}]});
 const before=structuredClone(d),fiscal=fiscalAnnualTotals(d);assert.throws(()=>run(d,{total:1500}),/patrimonio total.*negativo/);assert.throws(()=>run(d,{total:1500,confirmNegativeEquity:'true'}),/negativo/);assert.deepEqual(d,before);
 run(d,{total:1500,confirmNegativeEquity:true});const report=statement(d,'0000','9999');assert.equal(report.equity+report.profit,-500);assert.equal(report.profit,0);assert.deepEqual(fiscalAnnualTotals(d),fiscal);
});
test('utilidad no cerrada no está disponible como 3102',()=>{
 const d=fixture();d.entries.push({id:'income',date:'2026-01-02',type:'venta',lines:[{a:'1101',d:500,c:0},{a:'4101',d:0,c:500}]});assert.throws(()=>run(d,{source:'3102',total:201}),/Utilidades acumuladas insuficientes/);
});
test('cierre anual cancela 3103 contra 3102 sin modificar el resultado y apertura cuadra',()=>{
 const d=fixture();run(d,{total:150});const p=annualPreview(d,'2026');assert.equal(p.withdrawalsCents,15000);assert.deepEqual(p.transfer.filter(l=>l.a==='3103'),[{a:'3103',d:0,c:150}]);assert.ok(p.transfer.some(l=>l.a==='3102'&&l.d===150));assert.equal(p.opening.some(l=>l.a==='3103'),false);assert.equal(p.opening.reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0),0);assert.equal(p.profitCents,0);assert.match(p.withdrawalsNotice,/sin cambiar el resultado/);
});

function memberPermissionHarness(){
 const memberId='11111111-1111-4111-8111-111111111111',table={id:'id',companyId:'companyId',username:'username',email:'email'},events=[],revoked=[];
 let member={id:memberId,companyId:'c',name:'Socia',role:'contador',email:'socia@example.test',active:true,version:0,permissions:{contabilidad:'escritura'},branchIds:['principal']};
 const client={select(){let filter;const query={from(){return this},where(f){filter=f;return this},limit(){return this},then(resolve){resolve([member].filter(filter||(()=>true)))}};return query},update(){return {set(values){return {where(){member={...member,...values};return {returning:async()=>[member]}}}}}},delete(){return {where(){revoked.push(true);return Promise.resolve()}}}};
 const source=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8'),start=source.indexOf('export async function manageMember('),end=source.indexOf('\n}\n',start)+2;
 const context=vm.createContext({db:{transaction:fn=>fn(client)},companyMembers:table,companyRoles:{},sessions:{memberId:'memberId',email:'email'},
  eq:(key,value)=>row=>row[key]===value,and:(...filters)=>row=>filters.every(fn=>fn(row)),or:(...filters)=>row=>filters.some(fn=>fn(row)),
  companyAccess:async()=>({owner:true,company:{ownerEmail:session.email,data:fixture()}}),allowed:()=>true,accessError:message=>{throw Error(message)},
  companyBranches:()=>[{id:'principal',active:true}],partnerGrant,validatePartnerGrant,equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
  safeMember:m=>({...structuredClone(m),partnerAccess:partnerGrant(m)}),audit:async(_client,_company,_session,action,changes)=>events.push({actor:_session.email,at:new Date().toISOString(),action,changes}),
 });
 vm.runInContext(source.slice(start,end).replace('export ',''),context);
 return {events,revoked,get member(){return member},change:partnerAccess=>context.manageMember('c',session,{id:memberId,version:member.version,name:member.name,role:member.role,email:member.email,active:true,partnerAccess})};
}
test('activar y revocar permisos usa la administración real, audita antes/después y cierra sesiones',async()=>{
 const h=memberPermissionHarness();await h.change({partnerId:'p',personalExpenses:true,withdrawals:true,statement:true});assert.equal(h.member.permissions.partnerAccess.personalExpenses,true);assert.equal(h.events[0].actor,session.email);assert.ok(h.events[0].at);assert.equal(h.events[0].changes[0].before.partnerAccess.personalExpenses,false);assert.equal(h.events[0].changes[0].after.partnerAccess.personalExpenses,true);
 await h.change({partnerId:'p'});assert.equal(h.member.permissions.partnerAccess.personalExpenses,false);assert.equal(h.events[1].changes[0].before.partnerAccess.personalExpenses,true);assert.equal(h.events[1].changes[0].after.partnerAccess.personalExpenses,false);assert.equal(h.revoked.length,2);assert.equal(h.member.version,2);
});

function projectPartners(data,access){
 const source=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 const visible=source.slice(source.indexOf('const visibleEntry ='),source.indexOf('const restrictedPlan ='));
 const project=source.slice(source.indexOf('export function projectData('),source.indexOf('\nfunction validateEntries(')).replace('export ','');
 const ctx=vm.createContext({structuredClone,partnerGrant,partnerAuthorized,allowed:(a,m)=>a.owner||a.permissions?.[m]==='escritura',
  scopeBranch:d=>structuredClone(d),operationalDocument:d=>d,restrictedPlan:()=>false,projectServiceEntry:e=>e,
  OPERATION_ARRAYS:[],ADVANCED_ARRAYS:{},TRADE_ARRAYS:{partners:'contabilidad'},moduleIncluded:()=>true,accountingPermissionModules:[],
 });
 vm.runInContext(visible+project,ctx);return ctx.projectData(data,access);
}
test('proyección de capital muestra todos al dueño y solo los propios al socio',()=>{
 const d=fixture();d.partners.push({id:'otro',name:'Otro socio',movements:[]});const other=run(d,{partnerId:'otro'}),ownByOwner=run(d),ownByMember=run(d,{concept:'Propio'},linked());
 const a=linked({permissions:{partnerAccess:{partnerId:'p',personalExpenses:true,statement:true}}});a.rolePolicy={ownOperations:true};
 const projected=projectPartners(d,a);assert.deepEqual(Array.from(projected.partners,p=>p.id),['p']);assert.equal(projected.entries.some(e=>e.id===other),false);assert.equal(projected.entries.some(e=>e.id===ownByOwner),true);assert.equal(projected.entries.some(e=>e.id===ownByMember),true);
 const noStatement=projectPartners(d,linked());assert.deepEqual(Array.from(noStatement.entries,e=>e.id),[ownByMember]);
 const revoked=projectPartners(d,linked({permissions:{partnerAccess:{partnerId:'p'}}}));assert.equal(revoked.entries.length,0);
 assert.equal(projectPartners(d,owner).partners.length,2);
});
test('selector personal autorizado y socio fijo no ofrecen registrar a otro socio',()=>{
 const c=uiContext(false,[{id:'p',name:'Mi socio'},{id:'otro',name:'Ajeno'}]);c.CO.partnerAccess={partnerId:'p',personalExpenses:true};
 assert.doesNotMatch(c.personalExpenseChoice(),/value="personal" disabled/);const html=c.personalExpenseFields();assert.match(html,/Mi socio/);assert.doesNotMatch(html,/Ajeno|data-register-partner/);
});

test('advertencia del servidor se muestra y exige confirmación antes de reenviar',async()=>{
 for(const accepted of [true,false]){
  const c=uiContext(false),warning={setAttribute(name,value){this[name]=value}},calls=[];c.CO.partnerAccess={partnerId:'p',personalExpenses:true};
  Object.assign(c,{confirm:()=>accepted,operate:async(_op,body)=>{calls.push(body);if(!body.confirmNegativeEquity)throw Error('El patrimonio total quedará negativo. Confirma explícitamente para continuar.');return 'guardado';}});
  vm.runInContext(tradeUI.slice(tradeUI.indexOf('async function registerCapitalMovement('),tradeUI.indexOf('async function confirmPersonalEquity(')),c);
  const promise=c.registerCapitalMovement({querySelector:()=>warning},{kind:'gasto_personal',partnerId:'p',total:100});
  if(accepted){assert.equal(await promise,'guardado');assert.equal(calls[1].confirmNegativeEquity,true);}else{await assert.rejects(promise,/cancelada/);assert.equal(calls.length,1);}
  assert.match(warning.textContent,/negativo/);assert.equal(warning.role,'alert');assert.equal(warning.className,'bad');
 }
});

test('el permiso personal respeta el plan y no concede acceso a otros módulos',()=>{
 const a=linked();a.billingPlan={blockedModules:['gastos']};assert.throws(()=>run(fixture(),{},a),/plan/);
 a.billingPlan={blockedModules:['contabilidad']};assert.doesNotThrow(()=>run(fixture(),{},a));assert.throws(()=>run(fixture(),{kind:'retiro'},a),/plan/);
 assert.throws(()=>run(fixture(),{}, {...owner,billingPlan:{blockedModules:['gastos']}}),/plan/);
});
