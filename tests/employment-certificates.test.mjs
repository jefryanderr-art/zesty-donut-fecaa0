import test from 'node:test';
import assert from 'node:assert/strict';
import {configureCertificates,employmentCertificate,certificateConfig} from '../netlify/lib/employment-certificates.mjs';
import {employmentIncomeCents} from '../public/accounting-math.mjs';
import {readFileSync} from 'node:fs';
const access={owner:true,branchId:'principal'},session={email:'propietario@example.com'};
const body={date:'2026-11-04',enabled:true,confirmed:true,reason:'Texto revisado',workText:'Relación laboral registrada.',incomeText:'Ingresos brutos del período.'};
const base=()=>({businessRecords:[],employees:[{id:'empleado',name:'Empleado',position:'Contador',start:'2025-01-01'}],payrolls:[{id:'p1',employeeId:'empleado',date:'2026-11-01',entryId:'e1',gross:123.45},{id:'p2',employeeId:'empleado',date:'2026-11-02',gross:500},{id:'p3',employeeId:'otro',date:'2026-11-01',entryId:'e3',gross:99}]});
const ctx={permit(){}};
test('constancias nacen apagadas; solo dueño confirma y activa por sucursal',()=>{
 const data=base();assert.equal(certificateConfig(data,'principal'),undefined);
 assert.throws(()=>employmentCertificate(data,access,{}),/activar/);
 for(const a of [{...access,owner:false},{...access,support:true},{...access,readOnlyLimit:true},{...access,branchId:null}])assert.throws(()=>configureCertificates(data,a,session,body,ctx),/dueño/);
 assert.throws(()=>configureCertificates(data,access,session,{...body,confirmed:false},ctx),/Confirma/);
 assert.throws(()=>configureCertificates(data,access,session,{...body,enabled:'true'},ctx),/inválida/);
 assert.equal(data.businessRecords.length,0);
 configureCertificates(data,access,session,body,ctx);assert.equal(certificateConfig(data,'otra'),undefined);
 const old=structuredClone(data.payrolls);configureCertificates(data,access,session,{...body,workText:'Texto nuevo'},ctx);
 assert.equal(certificateConfig(data,'principal').version,2);assert.equal(certificateConfig(data,'principal').events.length,2);assert.deepEqual(data.payrolls,old);
});
test('ambos permisos se exigen en escritura y datos de otro empleado se rechazan',()=>{
 const data=base(),calls=[];configureCertificates(data,access,session,body,{permit:(...args)=>calls.push(args)});
 assert.deepEqual(calls.map(c=>[c[1],c[2]]),[['constancias_laborales',true],['personal',true]]);
 const report={kind:'income',employeeId:'empleado',from:'2026-11-01',to:'2026-11-30'};
 assert.equal(employmentCertificate(data,access,report).incomeCents,12345);
 assert.throws(()=>employmentCertificate(data,access,{...report,employeeId:'fuera'}),/Empleado/);
 assert.throws(()=>employmentCertificate(data,access,{...report,to:'2026-10-01'}),/Período/);
 assert.equal(employmentCertificate(data,access,{...report,kind:'work'}).incomeCents,null);
 configureCertificates(data,access,session,{...body,enabled:false},ctx);assert.throws(()=>employmentCertificate(data,access,report),/activar/);assert.equal(data.businessRecords.length,1);
});
test('suma centavos solo de pagos del período y rechaza fracciones históricas',()=>{
 const rows=base().payrolls;assert.equal(employmentIncomeCents(rows,'empleado','2026-11-02','2026-11-30'),0);
 assert.throws(()=>employmentIncomeCents([{...rows[0],gross:1.001}],'empleado','2026-11-01','2026-11-30'));
});
test('integración conserva idempotencia, sesión, plan, permisos, sucursal y auditoría',()=>{
 const source=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 const route=source.slice(source.indexOf("if(['certificateView'"),source.indexOf("if(body.operation==='budgetReport')"));
 for(const text of ['companyAccess(client,companyId,session,true)',"requireModule(access,'constancias_laborales')","requireModule(access,'personal')",'scopeBranch(access.company.data,access)','await audit(client'])assert.ok(route.includes(text));
 assert.ok(source.includes('CERTIFICATE_OPS.includes(body.operation)||'));assert.ok(source.includes('configureCertificates(data,access,operationSession,body'));
 const business=readFileSync(new URL('../netlify/lib/business.mjs',import.meta.url),'utf8');assert.ok(business.includes("...TREASURY_MODULES,'constancias_laborales','suscripciones'"));
});
