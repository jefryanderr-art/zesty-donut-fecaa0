import test from 'node:test';
import assert from 'node:assert/strict';
import {auditReview,AUDIT_RULES} from '../netlify/lib/audit-review-rules.mjs';
const period={from:'2026-01-01',to:'2026-01-31'};
const entry=(id,extra={})=>({id,date:'2026-01-15',type:'venta',total:123.45,operatorId:'u1',...extra});
const many=(extra,n=3)=>Array.from({length:n},(_,i)=>entry('e'+i,extra));
const cases={
 'sales-reversals':[{entries:many({type:'nota-credito'})},{entries:many({type:'venta'})}],
 'sales-discounts':[{entries:[entry('e',{discount:25})]},{entries:[entry('e',{discount:0})]}],
 'sales-prices':[{entries:[entry('e',{items:[{originalPrice:10,listPrice:9}]})]},{entries:[entry('e',{items:[{originalPrice:10,listPrice:10,u:8}]})]}],
 'document-sequence':[{entries:[entry('a',{sequence:1,series:'A'}),entry('b',{sequence:3,series:'A'})]},{entries:[entry('a',{sequence:1,series:'A'}),entry('b',{sequence:3,series:'B'})]}],
 'document-hours':[{entries:[entry('e',{issuedAt:'2026-01-15T03:00:00Z'})]},{entries:[entry('e',{issuedAt:'2026-01-15T18:00:00Z'})]}],
 'document-round':[{entries:many({total:100})},{entries:many({total:100.01})}],
 'document-limit':[{entries:many({total:4900})},{entries:many({total:5000})}],
 'document-duplicate':[{entries:many({reference:'same'},2)},{entries:[entry('a',{reference:'same',customerId:'a'}),entry('b',{reference:'same',customerId:'b'})]}],
 'cash-shortage':[{cashCounts:many({difference:-1})},{cashCounts:many({difference:1})}],
 'stock-adjustment':[{entries:[entry('e',{type:'ajuste',stock:[{pid:'p',q:-12}]})]},{entries:[entry('e',{type:'ajuste',stock:[{pid:'p',q:-1}]})]}],
 'stock-negative':[{products:[{id:'p',stock:-1}]},{products:[{id:'p',kind:'service',stock:-1}]}],
 'stock-cost':[{entries:[...many({date:'2025-12-20',items:[{p:'p',cost:10}]}),entry('outlier',{items:[{p:'p',cost:25}]})]},{entries:[...many({date:'2025-12-20',items:[{p:'p',cost:10}]}),entry('normal',{items:[{p:'p',cost:15}]})]}],
 'expense-receipt':[{entries:[entry('e',{type:'gasto'})]},{entries:[entry('e',{type:'gasto',reference:'INV-1'})]}],
 'expense-new-supplier':[{entries:[entry('e',{type:'gasto',supplierId:'s',total:1000})]},{entries:[entry('prev',{type:'gasto',supplierId:'s',total:1,date:'2025-12-01'}),entry('e',{type:'gasto',supplierId:'s',total:1000})]}],
 'ledger-month-end':[{entries:[entry('e',{type:'manual',date:'2026-01-31'})]},{entries:[entry('e',{type:'manual'})]}],
 'ledger-reopen':[{events:[{id:'a',action:'Operación: reopenPeriod',createdAt:'2026-01-15T18:00:00Z'}]},{events:[{id:'a',action:'Operación: closePeriod'}]}],
 'ledger-closed':[{cfg:{periodLocks:{'principal:2026-01':{closed:true,at:'2026-01-15T00:00:00Z'}}},entries:[entry('e',{issuedAt:'2026-01-16T00:00:00Z'})]},{cfg:{periodLocks:{'principal:2026-01':{closed:true,at:'2026-01-15T00:00:00Z'}}},entries:[entry('e',{issuedAt:'2026-01-14T00:00:00Z'})]}],
 'ledger-document':[{entries:[entry('e',{type:'manual'})]},{entries:[entry('e',{type:'manual',reference:'DOC'})]}],
 'bank-old':[{cfg:{bankControls:{enabled:true}},businessRecords:[{id:'b',module:'bancos',kind:'statement',rows:[{date:'2025-01-01'}]}]},{cfg:{bankControls:{enabled:true}},businessRecords:[{id:'b',module:'bancos',kind:'statement',rows:[{date:'2025-01-01',entryId:'e'}]}]}],
 'access-hours':[{events:[{id:'a',action:'Ingreso de colaborador',createdAt:'2026-01-15T03:00:00Z'}]},{events:[{id:'a',action:'Ingreso de colaborador',createdAt:'2026-01-15T18:00:00Z'}]}],
 'access-permissions':[{events:[{id:'a',action:'Acceso modificado'}]},{events:[{id:'a',action:'Consulta de auditoría'}]}],
 'access-separation':[{entries:[entry('sale'),entry('cancel',{type:'nota-credito',invoiceId:'sale'}),entry('pay',{type:'abono',invoiceId:'sale'})]},{entries:[entry('sale'),entry('cancel',{type:'nota-credito',invoiceId:'sale',operatorId:'u2'}),entry('pay',{type:'abono',invoiceId:'sale'})]}],
 'customer-overdue-discount':[{entries:[entry('old',{date:'2025-12-01',due:'2025-12-15',pay:'1201',customerId:'c'}),entry('new',{customerId:'c',discount:10})]},{entries:[entry('old',{date:'2025-12-01',due:'2025-12-15',pay:'1201',customerId:'c'}),entry('paid',{type:'abono',invoiceId:'old',date:'2025-12-20'}),entry('new',{customerId:'c',discount:10})]}],
 'employee-third-party':[{employees:[{id:'e',document:'AB-123'}],suppliers:[{id:'s',taxId:'AB123'}]},{employees:[{id:'e',name:'Mismo nombre',document:'AB123'}],suppliers:[{id:'s',name:'Mismo nombre',taxId:'CD123'}]}],
 'employee-duplicate':[{employees:[{id:'a',document:'AB123'},{id:'b',document:'AB-123'}]},{employees:[{id:'a',name:'Mismo'},{id:'b',name:'Mismo'}]}],
 'salary-range':[{employees:[{id:'e',salary:11000}]},{employees:[{id:'e',salary:1000}]}],
 'payroll-file':[{payrolls:[{id:'p',employeeId:'missing',date:'2026-01-15',status:'Cerrada'}]},{employees:[{id:'e',start:'2025-01-01'}],payrolls:[{id:'p',employeeId:'e',date:'2026-01-15',status:'Cerrada'}]}]
};
for(const rule of AUDIT_RULES)test(rule.id+': hallazgo y falso positivo',()=>{
 const [positive,negative]=cases[rule.id];
 const evaluate=fixture=>{const {events=[],...data}=structuredClone(fixture);return auditReview(data,{...period,events}).findings.filter(f=>f.ruleId===rule.id)};
 assert.ok(evaluate(positive).length>0);assert.equal(evaluate(negative).length,0);
});
test('la revisión no modifica datos contables y conserva resultados deterministas',()=>{
 const data={entries:many({discount:30}),employees:[{id:'e',salary:1000}],cfg:{cur:'NIO'}};const before=structuredClone(data);
 const first=auditReview(data,period);assert.deepEqual(data,before);assert.deepEqual(auditReview(data,period),first);
});
test('sin permiso no se evalúa ni se filtra información del área',()=>{
 const report=auditReview({employees:[{id:'privado',salary:99999}],entries:many({discount:25})},{...period,canRead:()=>false});assert.equal(report.findings.length,0);assert.ok(report.coverage.every(r=>r.state==='no-evaluable'));
});
test('puntajes usan pesos explícitos y tope de 100',()=>{
 const report=auditReview({entries:many({discount:30},40)},period);assert.ok(report.scores.areas.every(s=>s.score<=100));assert.match(report.scores.method,/alta 20, media 10, baja 3/);
});

// Exercise the real mutation boundary without a database or local server.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
async function loadReviewService(overrides={}){
 const source=(await readFile(new URL('../netlify/lib/audit-review.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
 const deps={randomUUID,createHash,auditReview,AUDIT_DEFAULTS:(await import('../netlify/lib/audit-review-rules.mjs')).AUDIT_DEFAULTS,equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),accessError:(m,status)=>{throw Object.assign(new Error(m),{status})},requireModule:()=>{},allowed:()=>true,actorName:s=>s.email,and:()=>null,eq:()=>null,or:()=>null,isNull:()=>null,sql:()=>null,auditEvents:{},...overrides};
 return new Function(...Object.keys(deps),source+';return {auditReviewOperation,guardAuditHistory,mergeAuditReviewPatch};')(...Object.values(deps));
}
test('ejecutar informe solo añade historial propio; conserva asientos, salarios y configuración',async()=>{
 const before={entries:many({discount:25}),employees:[{id:'employee',salary:1000}],cfg:{cur:'NIO'},businessRecords:[]};let saved;
 const chain={from(){return this},where(){return this},limit:async()=>[]};
 const {auditReviewOperation}=await loadReviewService({updateCompany:async(id,session,revision,mutate)=>{saved=await mutate({data:structuredClone(before),revision:7},{owner:true,branchId:'principal'},{select:()=>chain});return saved}});
 await auditReviewOperation('company',{email:'requester@internal.invalid'},{operation:'auditReviewRun',revision:7,operationId:randomUUID(),...period});
 assert.equal(saved.data.businessRecords.length,1);assert.equal(saved.data.businessRecords[0].kind,'report');
 const {businessRecords,...after}=saved.data;const {businessRecords:old,...original}=before;assert.deepEqual(after,original);assert.equal(old.length,0);
});
test('el historial no puede editarse, eliminarse ni reemplazarse mediante restauración',async()=>{
 const {guardAuditHistory}=await loadReviewService();const previous={businessRecords:[{id:'r',module:'auditoria_revision',kind:'report',findings:[]}]};
 assert.doesNotThrow(()=>guardAuditHistory(previous,structuredClone(previous),'Otros datos'));
 assert.throws(()=>guardAuditHistory(previous,{businessRecords:[]},'Restaurar'));
 assert.throws(()=>guardAuditHistory(previous,{businessRecords:[{...previous.businessRecords[0],findings:[1]}]},'Operación: auditReviewFollowup'));
});

test('la integración conserva orden, importes y asignaciones históricas de todas las sucursales',async()=>{
 const {mergeAuditReviewPatch}=await loadReviewService();
 const full={entries:[entry('other',{branchId:'b'}),entry('legacy')],products:[{id:'p',stock:1.000001}],cfg:{cur:'NIO'},businessRecords:[]};
 const scoped={entries:[entry('legacy')],products:[{id:'p',stock:0.1}],cfg:{cur:'NIO'},businessRecords:[],branches:[]};
 const next=structuredClone(scoped);next.businessRecords.push({id:'report',module:'auditoria_revision',kind:'report',branchId:'principal'});
 const result=mergeAuditReviewPatch(full,scoped,next,{branchId:'principal'},'Operación: auditReviewRun');
 const {businessRecords,...rest}=result;const {businessRecords:old,...original}=full;assert.deepEqual(rest,original);assert.equal(old.length,0);assert.equal(businessRecords.length,1);
 next.entries[0].total=999;assert.throws(()=>mergeAuditReviewPatch(full,scoped,next,{branchId:'principal'},'Operación: auditReviewRun'));
});

test('cerrar exige comentario y un hallazgo cerrado no admite otra escritura',async()=>{
 const report={id:'r',module:'auditoria_revision',kind:'report',scope:['ventas'],findings:[{id:'f'}],branchId:'principal'};
 let previous={entries:[],businessRecords:[report]};
 const {auditReviewOperation}=await loadReviewService({updateCompany:async(id,session,revision,mutate)=>mutate({data:structuredClone(previous),revision:1},{owner:true,branchId:'principal'},{})});
 const body={operation:'auditReviewFollowup',operationId:randomUUID(),revision:1,reportId:'r',findingId:'f',state:'confirmado',responsible:'owner',comment:''};
 await assert.rejects(auditReviewOperation('c',{email:'admin@internal.invalid'},body),/Comentario obligatorio/);
 previous.businessRecords.push({id:'closed',module:'auditoria_revision',kind:'followup',reportId:'r',findingId:'f',state:'confirmado'});
 await assert.rejects(auditReviewOperation('c',{email:'admin@internal.invalid'},{...body,comment:'Confirmado por revisión documental'}),/ya está cerrado/);
});
