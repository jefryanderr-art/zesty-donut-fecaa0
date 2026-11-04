// Pruebas escritas para la plataforma; no ejecutadas en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bankRateMicros,bankConvertCents} from '../public/accounting-math.mjs';
import {bankOperation,bankLedger,bankReport,guardBankReconciliations,validateBankRecord} from '../netlify/lib/banks.mjs';
const check=(ok,message)=>assert.ok(ok,message);
const mapping={date:0,amount:1,reference:2,dateFormat:'ISO',decimal:'.'};
function fixture(currency='NIO',card=false){
 const data={cfg:{cur:currency},accounts:[{code:'1190',tipo:card?'pasivo':'activo'},{code:'5101',tipo:'gasto'},{code:'4101',tipo:'ingreso'}],businessRecords:[],entries:[{id:'historical',branchId:'principal',date:'2026-10-31',reference:'Sin detalle original histórico',lines:[{a:'1190',d:card?0:3662.43,c:card?3662.43:0}]}]};
 const access={owner:true,branchId:'principal',company:{data}},session={email:'owner@example.test'};
 const ctx={permit:(a,m)=>check(!a.blocked?.includes(m),'Permiso '+m),entry:(d,s,e)=>{e={id:'entry-'+d.entries.length,...e};d.entries.push(e);return e}};
 const op=(operation,body={})=>bankOperation(data,access,session,{operation,date:'2026-11-30',confirmed:true,reason:'Operación expresamente revisada',...body},ctx);
 op('bankEnable',{enabled:true});
 const bankId=op('bankCreate',{name:'Banco extranjero',bank:'Ejemplo',lastFour:'1234',currency:currency==='USD'?'NIO':'USD',account:'1190',card,cutDay:1,payDay:10,date:'2026-11-01',openingCents:10000,baseOpeningCents:366243,rate:'36.6243',rateDate:'2026-11-01',rateSource:'Tasa de incorporación documentada'});
 return {data,access,op,bankId};
}
const rate={rate:'36.6243',rateDate:'2026-11-20',rateSource:'Archivo revisado por el dueño'};
test('conversiones con enteros, signos y redondeo simétrico',()=>{
 assert.equal(bankRateMicros('36.6243'),36624300);
 assert.equal(bankConvertCents(10000,36624300),366243);
 assert.equal(bankConvertCents(-10000,36624300),-366243);
 assert.equal(bankConvertCents(1,500000),1);assert.equal(bankConvertCents(-1,500000),-1);
 for(const r of ['0','-1','1e2','36,6','1.1234567','NaN','Infinity'])assert.throws(()=>bankRateMicros(r));
 assert.throws(()=>bankConvertCents(0.1,1000000));assert.throws(()=>bankConvertCents(99999999900,999999999999));
});
test('apertura conserva el libro histórico y no deduce moneda original',()=>{
 const f=fixture(),bank=f.data.businessRecords.find(r=>r.id===f.bankId);
 assert.equal(f.data.entries.length,1);assert.equal(bank.openingCents,10000);assert.equal(bank.baseOpeningCents,366243);
 assert.deepEqual(bankLedger(f.data,bank,'2026-11-30'),[]);
 validateBankRecord(bank,f.data,check);guardBankReconciliations(f.data,structuredClone(f.data),check);
});
test('conciliación extranjera, asiento convertido y cierre original',()=>{
 const f=fixture(),before=structuredClone(f.data.entries[0]);
 const id=f.op('bankStatement',{bankId:f.bankId,from:'2026-11-01',to:'2026-11-30',openingCents:10000,bankCents:9900,mapping,grid:[['fecha','importe','referencia'],['2026-11-20','-1.00','Comisión']]});
 let report=bankReport(f.data,f.bankId,id);assert.equal(report.currency,'USD');assert.equal(report.totals.bookCents,10000);assert.equal(report.baseBookCents,366243);assert.equal(report.totals.differenceCents,0);
 assert.throws(()=>f.op('bankPost',{bankId:f.bankId,id,sourceRow:2,counterAccount:'5101',...rate,rateDate:'2026-11-21'}),/fecha/);
 const e=f.op('bankPost',{bankId:f.bankId,id,sourceRow:2,counterAccount:'5101',...rate});
 assert.equal(f.data.entries.find(r=>r.id===e).lines[0].c,36.62);
 report=bankReport(f.data,f.bankId,id);assert.equal(report.totals.bookCents,9900);assert.equal(report.baseBookCents,362581);
 assert.equal(report.pendingBank.length,0);assert.deepEqual(f.data.entries[0],before);
 for(const record of f.data.businessRecords)validateBankRecord(record,f.data,check);
 f.op('bankLockEnable',{enabled:true});f.op('bankClose',{bankId:f.bankId,id});
 const frozen=structuredClone(f.data),changed=structuredClone(f.data);changed.entries[1].lines[0].c=10;
 assert.throws(()=>guardBankReconciliations(frozen,changed,check));assert.equal(bankReport(f.data,f.bankId,id).totals.bookCents,9900);
 f.op('bankEnable',{enabled:false});guardBankReconciliations(frozen,f.data,check);
});
test('movimientos futuros explícitos y rechazo transversal de movimientos sin moneda original',()=>{
 const f=fixture(),before=structuredClone(f.data);
 f.op('bankEntry',{bankId:f.bankId,date:'2026-11-20',counterAccount:'5101',amountCents:-100,reference:'Gasto',...rate});
 guardBankReconciliations(before,f.data,check);
 const after=structuredClone(f.data);after.entries.push({id:'injected',date:'2026-11-21',branchId:'principal',lines:[{a:'1190',d:1,c:0}]});
 assert.throws(()=>guardBankReconciliations(f.data,after,check));
 const altered=structuredClone(f.data);altered.businessRecords.find(r=>r.kind==='movement').amountCents=-101;
 assert.throws(()=>guardBankReconciliations(f.data,altered,check));
 const deleted=structuredClone(f.data);deleted.businessRecords=deleted.businessRecords.filter(r=>r.id!==f.bankId);assert.throws(()=>guardBankReconciliations(f.data,deleted,check));
 const zeroNet=structuredClone(f.data);zeroNet.entries.push({id:'zero-net',date:'2026-11-21',branchId:'principal',lines:[{a:'1190',d:1,c:0},{a:'1190',d:0,c:1}]});assert.throws(()=>guardBankReconciliations(f.data,zeroNet,check));
});
test('otra sucursal, permisos y tasa sin fuente se rechazan',()=>{
 const f=fixture();const body={bankId:f.bankId,counterAccount:'5101',amountCents:-100,...rate};
 f.access.branchId='otra';assert.throws(()=>f.op('bankEntry',body));f.access.branchId='principal';
 f.access.blocked=['contabilidad'];assert.throws(()=>f.op('bankEntry',body));f.access.blocked=['bancos'];assert.throws(()=>f.op('bankEntry',body));f.access.blocked=[];
 assert.throws(()=>f.op('bankEntry',{...body,rateSource:''}));assert.throws(()=>f.op('bankEntry',{...body,rate:'0'}));
});
test('tarjetas concilian deuda positiva y conservan naturaleza pasiva',()=>{
 const f=fixture('NIO',true),before=structuredClone(f.data);
 f.op('bankEntry',{bankId:f.bankId,date:'2026-11-20',counterAccount:'5101',amountCents:100,...rate});
 assert.equal(f.data.entries[1].lines[0].c,36.62);guardBankReconciliations(before,f.data,check);
 const bank=f.data.businessRecords.find(r=>r.id===f.bankId);assert.equal(bankLedger(f.data,bank,'2026-11-30')[0].amountCents,100);
});
test('base USD y original NIO no dependen de un sentido fijo de conversión',()=>{
 const f=fixture('USD');f.op('bankEntry',{bankId:f.bankId,date:'2026-11-20',counterAccount:'5101',amountCents:-3662,rate:'0.027305',rateDate:'2026-11-20',rateSource:'Fuente revisada'});
 assert.equal(f.data.entries[1].lines[0].c,1);
});
test('metadatos monetarios nuevos se declaran en el codec y exportación incluye tasas',()=>{
 const codec=readFileSync(new URL('../netlify/lib/accounting-codec.mjs',import.meta.url),'utf8'),ui=readFileSync(new URL('../public/banks.js',import.meta.url),'utf8');
 for(const name of ['baseOpeningCents','baseBookCents'])assert.ok(codec.includes("'"+name+"'"));
 assert.match(ui,/report.ledger/);assert.match(ui,/r.rateSource,r.rateDate/);assert.match(ui,/bankMoney/);
});

test('contrapartidas de cartera y turnos no eluden sus operaciones específicas',()=>{
 const f=fixture();for(const code of ['1201','2101','1301','1104','2107']){
  f.data.accounts.push({code,tipo:'activo'});
  assert.throws(()=>f.op('bankEntry',{bankId:f.bankId,date:'2026-11-20',counterAccount:code,amountCents:-100,...rate}),/módulos específicos/);
 }
});

test('desactivar conserva informe, apertura y cierre sin admitir escrituras',()=>{
 const f=fixture(),id=f.op('bankStatement',{bankId:f.bankId,from:'2026-11-01',to:'2026-11-30',openingCents:10000,bankCents:9900,mapping,grid:[['f','i','r'],['2026-11-20','-1.00','Comisión']]});
 const before=bankReport(f.data,f.bankId,id);f.op('bankEnable',{enabled:false});
 assert.deepEqual(bankReport(f.data,f.bankId,id),before);
 assert.throws(()=>f.op('bankPost',{bankId:f.bankId,id,sourceRow:2,counterAccount:'5101',...rate}),/activar/);
});

test('apertura original y movimientos previos no se reescriben para adoptar la moneda',()=>{
 const f=fixture(),prior=structuredClone(f.data);
 const altered=structuredClone(f.data);altered.businessRecords.find(r=>r.id===f.bankId).openingCents=9999;
 assert.throws(()=>guardBankReconciliations(prior,altered,check));
 const moved=structuredClone(f.data);moved.entries[0].date='2026-10-30';assert.throws(()=>guardBankReconciliations(prior,moved,check));
 assert.throws(()=>f.op('bankStatement',{bankId:f.bankId,from:'2026-11-01',to:'2026-11-30',openingCents:9999,bankCents:9899,mapping,grid:[['f','i','r'],['2026-11-20','-1.00','Comisión']]}),/apertura original/);
});
