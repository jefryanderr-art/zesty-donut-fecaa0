// Preparadas para la plataforma; no ejecutar en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixedBusinessProfile,restoredBusinessProfile,validateProfile} from '../netlify/lib/business-profile.mjs';
const customization={shown:['agenda'],hidden:['ventas'],labels:{customer:'Paciente'},timeZone:'America/Managua'};
test('dueño recibe 403 al cambiar tipo y puede guardar personalización con el mismo tipo',()=>{
 const company={businessType:'comercio'};
 assert.throws(()=>fixedBusinessProfile(company,{businessType:'inventado',businessCustomization:customization},false),error=>error.status===403&&error.publicMessage==='El tipo de negocio queda fijo. Para cambiarlo, contacta a Acontec.');
 assert.deepEqual(fixedBusinessProfile(company,{businessType:'comercio',businessCustomization:customization},false),{businessType:'comercio',businessCustomization:customization});
});
test('restauración conserva el tipo actual para el dueño y restaura su personalización',()=>{
 const company={businessType:'comercio'},backup={businessType:'inventado',businessCustomization:customization};
 assert.deepEqual(restoredBusinessProfile(company,backup,false),{businessType:'comercio',businessCustomization:customization});
});
test('corrección administrativa exige plataforma, revisión y tipo anterior, conserva datos y personalización y audita',async()=>{
 const source=await readFile(new URL('../netlify/lib/platform.mjs',import.meta.url),'utf8');
 const route=source.slice(source.indexOf('export async function correctBusinessTypes')).replace('export ','');
 const company={id:'00000000-0000-0000-0000-000000000001',ownerEmail:'cliente@example.invalid',businessType:'comercio',revision:9,data:{entries:[{id:'historico'}]},businessCustomization:structuredClone(customization)};
 const original=structuredClone(company),audits=[],events=[],patches=[];let authorized=true;
 const client={select:()=>({from(){return this},where(){return this},for:async()=>[{...company}]}),update:()=>({set(patch){patches.push(patch);return {where:async()=>Object.assign(company,patch)}}})};
 const dependencies={db:{transaction:fn=>fn(client)},requirePlatform:async()=>{if(!authorized)throw Object.assign(new Error('Prohibido'),{status:403})},clean:value=>String(value||'').trim(),billingError:(message,status=400)=>{throw Object.assign(new Error(message),{status})},companies:{},eq:()=>{},and:()=>{},validateProfile,audit:async(...args)=>audits.push(args),event:async(...args)=>events.push(args)};
 const run=new Function(...Object.keys(dependencies),route+';return correctBusinessTypes')(...Object.values(dependencies));
 const session={email:'admin@example.invalid',activeCompanyId:'platform'},body={email:company.ownerEmail,confirmed:true,reason:'Corrección solicitada',companies:[{id:company.id,revision:9,previousType:'comercio',businessType:'comercio'}]};
 const {catalog}=await import('../netlify/lib/business-profile.mjs');body.companies[0].businessType=catalog.profiles.find(p=>p.id!=='comercio').id;
 authorized=false;await assert.rejects(run(session,body),error=>error.status===403);assert.equal(patches.length,0);
 authorized=true;await assert.rejects(run(session,{...body,companies:[{...body.companies[0],revision:8}]}),error=>error.status===409);
 await run(session,body);
 assert.equal(company.businessType,body.companies[0].businessType);assert.deepEqual(company.data,original.data);assert.deepEqual(company.businessCustomization,original.businessCustomization);assert.equal(company.revision,9);
 assert.deepEqual(Object.keys(patches[0]).sort(),['businessType','updatedAt']);
 assert.equal(audits[0][1],company.id);assert.equal(audits[0][2].email,session.email);assert.equal(audits[0][4][0].before,'comercio');assert.equal(audits[0][4][0].after,company.businessType);assert.equal(events.length,1);
 await assert.rejects(run(session,body),error=>error.status===409);
});
test('API conecta el candado y ambas restauraciones a las políticas de servidor',async()=>{
 const source=await readFile(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
 assert.ok(source.includes('return fixedBusinessProfile(company,body,isAdmin)'));
 assert.ok(source.includes('profilePatch=restoredBusinessProfile(company,body.profile,isAdmin)'));
 assert.ok(source.includes('profilePatch=restoredBusinessProfile(company,backup,isAdmin)'));
});
