// Preparadas para la plataforma. No ejecutar localmente en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bankAmountCents,bankGridRows,bankSuggestions,bankReconciliationTotals} from '../public/accounting-math.mjs';
import {BANKS_READY,bankBaseCurrency,bankOperation,bankReport,guardBankReconciliations} from '../netlify/lib/banks.mjs';
import {businessOperation} from '../netlify/lib/business.mjs';
import {catalog} from '../netlify/lib/business-profile.mjs';
import {DEFAULT_PLANS,moduleIncluded} from '../netlify/lib/billing-rules.mjs';
const check=(ok,msg)=>assert.ok(ok,msg);
const mapping={date:0,amount:1,reference:2,dateFormat:'ISO',decimal:'.'};
const fixture=()=>{
 const data={cfg:{cur:'NIO'},accounts:[{code:'1102',tipo:'activo'},{code:'2109',tipo:'pasivo'},{code:'5101',tipo:'gasto'},{code:'4101',tipo:'ingreso'}],entries:[{id:'initial',date:'2026-10-31',branchId:'principal',reference:'Apertura',lines:[{a:'1102',d:1000,c:0}]}],businessRecords:[]};
 const access={owner:true,branchId:'principal',company:{data}},ctx={permit:(a,m)=>check(!a.blocked?.includes(m),'Permiso '+m),entry:(d,s,r)=>{const e={id:'entry-'+d.entries.length,branchId:access.branchId,...r};d.entries.push(e);return e}};
 return {data,access,ctx};
};
const common={date:'2026-11-30',reason:'Conciliación revisada por el responsable',confirmed:true};
const op=(f,operation,body={})=>bankOperation(f.data,f.access,{email:'contador@example.test'},{...common,operation,...body},f.ctx);
const create=f=>{op(f,'bankEnable',{enabled:true});return op(f,'bankCreate',{date:'2026-11-01',name:'Cuenta de operación',bank:'Banco de ejemplo',lastFour:'1234',currency:'NIO',account:'1102'});};
const statement=(f,bankId,extra={})=>op(f,'bankStatement',{bankId,from:'2026-11-01',to:'2026-11-30',openingCents:100000,bankCents:99000,mapping,grid:[['fecha','importe','referencia'],['2026-11-20','-10.00','Comisión']],...extra});
test('importación monetaria exacta con separadores, signos y rechazo de fracciones',()=>{
 assert.equal(bankAmountCents('1,234.50'),123450);assert.equal(bankAmountCents('(1.234,50)',','),-123450);assert.equal(bankAmountCents('-0.01'),-1);
 for(const v of ['1.005','NaN','1e3','1,23.00','USD 10','9999999999.99'])assert.throws(()=>bankAmountCents(v));
 assert.throws(()=>bankGridRows([['f','a','r'],['2026-02-30','1.00','x']],mapping));
 assert.throws(()=>bankGridRows([['f','a','r'],['2026-11-01','1','x']],{...mapping,reference:1}));
 assert.equal(bankGridRows([['f','a','r'],['21/11/2026','1,00','R']],{...mapping,dateFormat:'DMY',decimal:','})[0].amountCents,100);
});
test('sugerencias deterministas por importe, fecha y referencia nunca emparejan',()=>{
 const rows=[{date:'2026-11-20',amountCents:100,sourceRow:2,reference:'AbC'}],ledger=[{entryId:'a',date:'2026-11-20',amountCents:100,reference:'otra'},{entryId:'b',date:'2026-11-21',amountCents:100,reference:'abc'},{entryId:'c',date:'2026-11-20',amountCents:101,reference:'abc'},{entryId:'d',date:'2026-10-20',amountCents:100,reference:'abc'}],before=structuredClone({rows,ledger});
 const suggestions=bankSuggestions(rows,ledger);assert.deepEqual(suggestions[0].candidates.map(c=>c.entryId),['b','a']);assert.deepEqual({rows,ledger},before);
});
test('importar requiere confirmación, período válido, saldos y no solapamiento',()=>{
 const f=fixture(),bankId=create(f);assert.throws(()=>statement(f,bankId,{confirmed:false}));assert.throws(()=>statement(f,bankId,{bankCents:99001}));
 const id=statement(f,bankId);assert.ok(id);assert.equal(f.data.entries.length,1);assert.throws(()=>statement(f,bankId));
 assert.throws(()=>statement(f,bankId,{from:'2026-12-01',to:'2026-12-31',date:'2026-12-31'}),/anterior/);
});
test('asiento confirmado de gasto, cierre inmutable y correcciones futuras',()=>{
 const f=fixture(),bankId=create(f),id=statement(f,bankId),before=structuredClone(f.data);
 const report=bankReport(f.data,bankId,id);assert.equal(report.pendingBank.length,1);assert.equal(report.totals.differenceCents,0);assert.deepEqual(f.data,before);
 assert.throws(()=>op(f,'bankClose',{bankId,id}),/habilitar/);
 op(f,'bankLockEnable',{enabled:true});assert.throws(()=>op(f,'bankClose',{bankId,id}),/Resuelve/);
 const entryId=op(f,'bankPost',{bankId,id,sourceRow:2,counterAccount:'5101'});assert.equal(f.data.entries.at(-1).lines[0].c,10);
 assert.throws(()=>op(f,'bankPost',{bankId,id,sourceRow:2,counterAccount:'5101'}));
 op(f,'bankClose',{bankId,id});const frozen=structuredClone(f.data),snapshot=bankReport(f.data,bankId,id);assert.equal(snapshot.totals.bookCents,99000);
 assert.throws(()=>op(f,'bankMatch',{bankId,id,sourceRow:2,entryId}));
 guardBankReconciliations(frozen,f.data,check);
 const changed=structuredClone(frozen);changed.entries.find(e=>e.id===entryId).reference='Cambiada';assert.throws(()=>guardBankReconciliations(frozen,changed,check));
 const prior=structuredClone(frozen);prior.entries[0].lines[0].d=999;assert.throws(()=>guardBankReconciliations(frozen,prior,check));
 const next=structuredClone(frozen);next.entries.push({id:'future',date:'2026-12-01',branchId:'principal',lines:[{a:'1102',d:1,c:0}]});assert.doesNotThrow(()=>guardBankReconciliations(frozen,next,check));assert.deepEqual(bankReport(next,bankId,id),snapshot);
});
test('empareja solo importes iguales de la cuenta/sucursal y una sola vez',()=>{
 const f=fixture(),bankId=create(f);f.data.entries.push({id:'payment',date:'2026-11-20',branchId:'principal',reference:'Comisión',lines:[{a:'1102',d:0,c:10}]});
 const id=statement(f,bankId);assert.throws(()=>op(f,'bankMatch',{bankId,id,sourceRow:2,entryId:'initial'}));
 op(f,'bankMatch',{bankId,id,sourceRow:2,entryId:'payment'});assert.equal(bankReport(f.data,bankId,id).pendingBank.length,0);assert.throws(()=>op(f,'bankMatch',{bankId,id,sourceRow:2,entryId:'payment'}));
});
test('permisos, dueño, plan, sucursal, tarjeta y máscara sin número completo',async()=>{
 assert.equal(catalog.capabilities.bancos.letter,'R');for(const p of DEFAULT_PLANS)assert.equal(moduleIncluded(p,'bancos'),p.id!=='facturacion');
 for(const blocked of ['bancos','contabilidad']){const f=fixture();f.access.blocked=[blocked];assert.throws(()=>create(f));assert.equal(f.data.businessRecords.length,0)}
 const f=fixture();f.access.owner=false;assert.throws(()=>create(f));f.access.owner=true;const bankId=create(f);assert.equal(f.data.businessRecords[0].masked,'•••• 1234');assert.ok(!Object.hasOwn(f.data.businessRecords[0],'lastFour'));
 const id=statement(f,bankId);f.access.branchId='otra';assert.throws(()=>op(f,'bankPost',{bankId,id,sourceRow:2,counterAccount:'5101'}));
 f.access.branchId='principal';assert.throws(()=>op(f,'bankCreate',{name:'Tarjeta',bank:'Emisor',lastFour:'1234567890123456',currency:'NIO',account:'2109',card:true,cutDay:1,payDay:10}));
 const card=op(f,'bankCreate',{name:'Tarjeta',bank:'Emisor',lastFour:'9876',currency:'NIO',account:'2109',card:true,cutDay:31,payDay:10});assert.ok(card);
 await assert.rejects(businessOperation(f.data,f.access,{}, {operation:'businessSave',module:'bancos'}, {check,permit:()=>{}}));
});
test('diferencia conciliatoria usa enteros y conserva partidas en tránsito',()=>{
 const t=bankReconciliationTotals({bookCents:900,bankCents:1000,transit:[{amountCents:-100}],pendingBank:[]});assert.equal(t.differenceCents,0);assert.equal(t.adjustedBankCents,900);
 assert.throws(()=>bankReconciliationTotals({bookCents:1.1,bankCents:0}));
});
test('rutas bancarias y PDF completo conservan autenticación, permiso y auditoría',()=>{
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8'),access=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 assert.match(ops,/bankReport'[\s\S]*companyAccess\(client,companyId,session,true\);requireModule\(access,'bancos'\)/);
 assert.match(ops,/BANK_OPS.includes\(body.operation\)[\s\S]*!body.operationId/);assert.match(access,/guardBankReconciliations\(fullCompany.data,patch.data/);
 assert.match(ops,/fullDataPdf'[\s\S]*allData\(access\)/);assert.match(ops,/Descarga de respaldo PDF completo/);
});

test('referencias importadas no conservan números largos de tarjeta',()=>{
 const row=bankGridRows([['f','a','r'],['2026-11-01','1.00','Pago 1234 5678 9012 3456']],mapping)[0];
 assert.equal(row.reference,'Pago •••• 3456');
});

test('símbolo histórico C$ identifica NIO sin cambiar la configuración',()=>{
 const f=fixture();f.data.cfg.cur='C$';assert.equal(bankBaseCurrency(f.data),'NIO');assert.ok(create(f));assert.equal(f.data.cfg.cur,'C$');
});

test('interruptor de cierre nace apagado y solo el dueño lo cambia',()=>{
 const f=fixture();assert.equal(f.data.cfg.bankControls,undefined);f.access.owner=false;
 assert.throws(()=>op(f,'bankLockEnable',{enabled:true}));assert.equal(f.data.cfg.bankControls,undefined);
 f.access.owner=true;op(f,'bankEnable',{enabled:true});op(f,'bankLockEnable',{enabled:true});assert.equal(f.data.cfg.bankControls.closingEnabled,true);
 op(f,'bankLockEnable',{enabled:false});assert.equal(f.data.cfg.bankControls.closingEnabled,false);assert.equal(f.data.cfg.bankControls.events.length,2);
});

test('bancos requiere activación del dueño por empresa, confirmación y motivo',()=>{
 assert.equal(BANKS_READY,true);const f=fixture();
 assert.throws(()=>op(f,'bankLockEnable',{enabled:true}),/activar/);
 f.access.owner=false;assert.throws(()=>op(f,'bankEnable',{enabled:true}));
 f.access.owner=true;assert.throws(()=>op(f,'bankEnable',{enabled:true,confirmed:false}));
 assert.throws(()=>op(f,'bankEnable',{enabled:true,reason:''}));
 op(f,'bankEnable',{enabled:true});assert.equal(f.data.cfg.bankControls.enabled,true);
 op(f,'bankEnable',{enabled:false});assert.equal(f.data.cfg.bankControls.enabled,false);
 assert.throws(()=>op(f,'bankCreate',{name:'Banco',bank:'Banco',lastFour:'1234',currency:'NIO',account:'1102'}),/activar/);
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 assert.match(ops,/BANKS_READY&&\(access.company.data\?\.cfg\?\.bankControls\?\.enabled===true/);
});

test('una restauración no habilita bancos ni inyecta conciliaciones',()=>{
 const ops=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 assert.match(ops,/for\(const module of \['suscripciones','bancos'\]\)requireValue\(equal/);
 assert.match(ops,/requireValue\(equal\(previous\?\.cfg\?\.bankControls,next.cfg\?\.bankControls\)/);
});
