import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedBusinessProfile,initialCompanyDocument,PROFILE_SPACE_SWITCH} from '../netlify/lib/business-profile.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
const change=(c,type)=>{const patch=fixedBusinessProfile(c,{businessType:type,businessCustomization:{}},true);delete patch[PROFILE_SPACE_SWITCH];return {...c,...patch,revision:c.revision+1}};
test('A → B → A conserva todos los datos y la configuración independientes',()=>{
 let c={id:'test',name:'Prueba',businessType:'comercio',testPlan:'pro',revision:1,businessCustomization:{labels:{customer:'Cliente A'}},data:initialCompanyDocument({name:'Prueba',businessType:'comercio'})};
 c.data.products.push({id:'a',name:'Producto A',price:1.25,cost:1,stock:2});c.data.customers.push({id:'ca',name:'Cliente A'});c.data.invoiceSequences={A:9};c.data.cfg.pos.useDimensions=true;
 c.data.entries.push({id:'ea',date:'2026-01-01',lines:[{a:'1101',d:1.25,c:0},{a:'3101',d:0,c:1.25}]});
 const original=structuredClone(c.data);c=change(c,'restaurante');assert.equal(c.businessCustomization.labels,undefined);assert.deepEqual(c.data.products,[]);assert.deepEqual(c.data.customers,[]);assert.deepEqual(c.data.entries,[]);assert.deepEqual(c.data.invoiceSequences,{});
 c.data.products.push({id:'b',name:'Producto B',cost:2,price:3,stock:0});c.data.businessRecords.push({id:'b-record',module:'restaurante',total:3});c.businessCustomization={labels:{customer:'Mesa'}};
 const second=structuredClone(c.data);delete second.profileSpaces;
 c=change(c,'comercio');const active=structuredClone(c.data);delete active.profileSpaces;assert.deepEqual(active,original);assert.equal(c.businessCustomization.labels.customer,'Cliente A');assert.equal(c.testPlan,'pro');
 const encoded=normalizeDocument(c.id,c.data);assert.deepEqual(restoreDocument(encoded),c.data);
 // Stored journal lines also use integer cents, not residual floating amounts.
 assert.equal(encoded.extra.profileSpaces.comercio.document.rows.lines[0].dCents,125);
 c=change(c,'restaurante');const restored=structuredClone(c.data);delete restored.profileSpaces;assert.deepEqual(restored,second);assert.equal(c.businessCustomization.labels.customer,'Mesa');
});
test('empresa normal no puede cambiar de perfil; personalizar no crea espacios',()=>{
 const c={businessType:'comercio',data:initialCompanyDocument({name:'Normal'})},original=structuredClone(c);
 for(const admin of [false,true])assert.throws(()=>fixedBusinessProfile(c,{businessType:'restaurante'},admin),e=>e.status===403);
 assert.equal(fixedBusinessProfile(c,{businessType:'comercio',businessCustomization:{}},false).data,undefined);assert.deepEqual(c,original);
});

test('intercambio transaccional verifica revisión, respalda antes de escribir y conserva otras sucursales',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:vm}=await import('node:vm');
 const source=await readFile(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 let company={id:'test',ownerEmail:'owner@example.invalid',name:'Prueba',testPlan:'pro',businessType:'comercio',businessCustomization:{},revision:5,data:initialCompanyDocument({name:'Prueba'})};
 company.data.entries=[{id:'otra-sucursal',branchId:'segunda',date:'2026-01-01',lines:[]}];
 const events=[],backups=[],session={email:company.ownerEmail};
 const client={update:()=>({set:patch=>({where:()=>({returning:async()=>{events.push('write');company={...company,...patch};return [company]}})})})};
 const identity=x=>structuredClone(x),noOp=()=>{},equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const c=vm.createContext({db:{transaction:async fn=>{events.push('transaction');return fn(client)}},companyAccess:async()=>({owner:true,branchId:'principal',company:structuredClone(company)}),readAccounting:async(_,c)=>identity(c.data),scopeBranch:data=>({...identity(data),entries:[]}),operationalDocument:identity,accountingDocument:identity,performance,structuredClone,Date,console,accessError:(message,status=403)=>{throw Object.assign(new Error(message),{status})},equal,companies:{},eq:noOp,checkpoint:async(_,c)=>{events.push('backup');backups.push(identity(c));return []},syncAccounting:async()=>events.push('sync'),audit:async()=>events.push('audit'),dataChanges:()=>[],syncBarcodes:async()=>events.push('barcodes'),projectData:identity});
 vm.runInContext(source.slice(source.indexOf('export async function updateCompany'),source.indexOf('export function validatePermissions')).replace('export ',''),c);
 const mutate=(scoped,access)=>fixedBusinessProfile({...scoped,data:access.company.data},{businessType:'restaurante',businessCustomization:{}},true);
 await assert.rejects(c.updateCompany('test',session,4,mutate,'Perfil de negocio actualizado'),e=>e.status===409);assert.equal(backups.length,0);assert.equal(company.revision,5);
 const original=identity(company);await c.updateCompany('test',session,5,mutate,'Perfil de negocio actualizado');
 assert.equal(company.revision,6);assert.equal(company.businessType,'restaurante');assert.deepEqual(backups,[original]);assert.ok(events.indexOf('backup')<events.indexOf('write'));assert.ok(events.includes('sync'));assert.ok(events.includes('audit'));
 assert.deepEqual(company.data.profileSpaces.comercio.data.entries,original.data.entries);assert.deepEqual(company.data.entries,[]);
 await assert.rejects(c.updateCompany('test',session,5,mutate,'Perfil de negocio actualizado'),e=>e.status===409);assert.equal(backups.length,1);
});
