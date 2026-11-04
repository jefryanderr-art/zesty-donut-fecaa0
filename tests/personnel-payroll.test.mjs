import test from 'node:test';
import assert from 'node:assert/strict';
import {personnelOperation} from '../netlify/lib/personnel.mjs';
test('planilla conserva reglas y paga una vez con costo laboral completo',()=>{
 const data={employees:[{id:'e',name:'Empleado',start:'2025-01-01',salary:100}],payrolls:[],entries:[],businessRecords:[{id:'c',module:'planillas_area',kind:'configuration',status:'Activa'},{id:'pc',module:'parametros_laborales',kind:'configuration',status:'Activa'},{id:'params',module:'parametros_laborales',kind:'parameters',version:1,parameters:{country:'País',effective:'2026-01-01',daysPerMonth:30,daysPerYear:365,vacationDays:12,taxBp:0,workerBp:100,employerBp:200,provisionBp:300}}],accounts:[{code:'expense',tipo:'gasto'},{code:'liability',tipo:'pasivo'}]};
 const access={owner:true,branchId:'principal'},session={email:'test@example.test'},ctx={permit(){},financialCash(){},entry(d,s,e){const r={id:'entry',...e};d.entries.push(r);return r}},common={module:'planillas_area',confirmed:true,reason:'Revisión manual',date:'2026-01-31'};
 const id=personnelOperation(data,access,session,{...common,operation:'personnelPayroll',employeeId:'e',from:'2026-01-01',to:'2026-01-31',area:'Administración',baseCents:10000},ctx);
 const r=data.businessRecords.find(r=>r.id===id);assert.equal(r.laborCents,10500);assert.equal(r.netCents,9900);
 const pay={...common,operation:'personnelPay',id,cash:'1102',employerExpense:'expense',employerLiability:'liability',provisionExpense:'expense',provisionLiability:'liability'};
 personnelOperation(data,access,session,pay,ctx);assert.equal(data.entries.length,1);assert.equal(data.payrolls[0].entryId,'entry');assert.throws(()=>personnelOperation(data,access,session,pay,ctx));
});
