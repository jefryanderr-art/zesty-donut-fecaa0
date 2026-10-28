import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Isolate the real route from the database/TypeScript entrypoint; model only
// its database boundary, so the test observes the actual UPDATE payload.
test('cambiar y quitar test_plan conserva el documento y la revisión contable', async () => {
 const source = await readFile(new URL('../netlify/lib/platform.mjs', import.meta.url), 'utf8');
 const route = source.slice(source.indexOf('export async function testCompaniesRoute')).replace('export ', '');
 const company = {id:'00000000-0000-0000-0000-000000000001',ownerEmail:'admin@example.invalid',testPlan:'pro',revision:7,data:{accounts:[]},isPlatformCompany:false};
 const originalData = structuredClone(company.data);
 const storage = {revision:7};
 const session = {email:company.ownerEmail,activeCompanyId:company.id};
 const auditRows = [];
 let selection;
 const client = {
  select: () => ({from(table){selection=table;return this},where(){return this},for(){return this},then(resolve){resolve(selection==='plans'?[{id:'facturacion'}]:[{...company}])}}),
  update: () => ({set(patch){this.patch=patch;return this},where(){return this},returning(){Object.assign(company,this.patch);return [{id:company.id}]}})
 };
 const dependencies = {
  db:{transaction:callback=>callback(client)},isPlatformAdmin:async()=>true,
  requirePlatform:async()=>{},clean:value=>String(value||''),
  billingError(message,status){throw Object.assign(new Error(message),{status})},
  servicePlans:'plans',companies:{id:'id',testPlan:'test_plan'},
  eq:()=>{},and:()=>{},sql:()=>{},
  audit:async(...args)=>auditRows.push(args)
 };
 const run = new Function(...Object.keys(dependencies),route+'; return testCompaniesRoute;')(...Object.values(dependencies));
 for (const plan of ['facturacion',null]) {
  if (plan===null) session.activeCompanyId='platform';
  await run(session,'POST','set',{companyId:company.id,plan,previousPlan:company.testPlan,confirmed:true,reason:'Prueba de regresión'});
  assert.equal(company.testPlan,plan);
  assert.equal(company.revision,7);
  assert.equal(storage.revision,company.revision);
  assert.deepEqual(company.data,originalData);
 }
 assert.equal(auditRows.length,2);
});
