import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {collections,completeCompanyDocument} from '../db/accounting-model.mjs';
import {initialCompanyDocument,finishCompanyProfile,validateCompanyDetails} from '../netlify/lib/business-profile.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
import {guardBankReconciliations} from '../netlify/lib/banks.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const options={name:'Taller Umbral',country:'Nicaragua',cur:'C$',ruc:'ID-17',businessType:'software'};

test('el único creador produce documentos iguales para ambos proveedores y normalizables',async()=>{
 const source=read('netlify/lib/access.mjs').split('export async function createOwnedCompany')[1];
 const make=()=>{
  const rows=[];let writes=0;
  const context=vm.createContext({users:{email:1},companies:{ownerEmail:1,archivedAt:1},eq:()=>0,and:()=>0,isNull:()=>0,
   initialCompanyDocument,validateCompanyDetails,validateProfile:()=>({businessType:options.businessType,businessCustomization:{invoiceCountry:options.country}}),
   syncAccounting:async()=>{writes++},audit:async()=>{},accessError:message=>{throw Error(message)}});
  const create=vm.runInContext('(async function createOwnedCompany'+source+')',context);
  const client={select:()=>({from:()=>({where:()=>({for:async()=>[],then:resolve=>Promise.resolve(rows).then(resolve)})})}),
   insert:()=>({values:value=>({returning:async()=>{const row={id:'company',revision:0,...value};rows.push(row);return [row]}})})};
  return {create:()=>create(client,{email:'owner@example.invalid'},{...options,firstOnly:true}),rows,writes:()=>writes};
 };
 const manual=make(),google=make();await manual.create();await google.create();await google.create();
 assert.equal(google.rows.length,1);assert.equal(google.writes(),1);
 assert.deepEqual(manual.rows[0].data,google.rows[0].data);
 for(const key of Object.keys(collections))assert.ok(Array.isArray(google.rows[0].data[key]),key);
 const converted=normalizeDocument('company',google.rows[0].data);
 assert.deepEqual(restoreDocument(converted),google.rows[0].data);
});

test('la validación bancaria acepta el documento nulo histórico sin TypeError',()=>{
 assert.doesNotThrow(()=>guardBankReconciliations(null,initialCompanyDocument(options),(ok,message)=>assert.ok(ok,message)));
});

test('abrir una empresa nueva no programa guardados; Google sin empresa retoma el formulario',async()=>{
 const source=read('public/app.js'),start=source.indexOf('async function openCompany('),end=source.indexOf('\n}',start)+2;
 let saves=0,forms=0,panels=0;
 const context=vm.createContext({CO:null,COS:[],S:null,flush:async()=>true,companyOnboarding:()=>{forms++},
  api:async()=>({data:initialCompanyDocument(options),revision:0}),copyCloud:structuredClone,
  localStorage:{setItem(){}},save:()=>{saves++},shell:()=>{},view:()=>{panels++},seed:()=>{throw Error('No usar inicialización del navegador')},
  R:'',HOME:false,REV:0,saveVersion:0,savedVersion:0,retryCount:0,saveStatus:'',cloudBase:null,pendingSave:null,cloudConflict:null,sessionExpired:false,
  uiT:(_key,text)=>text});
 const open=vm.runInContext(source.slice(start,end)+';openCompany',context);
 await open();await open();assert.equal(forms,2);assert.equal(panels,0);assert.equal(saves,0);
 context.COS=[{id:'company',owner:true,name:options.name}];
 await open('company');assert.equal(panels,1);assert.equal(forms,2);assert.equal(saves,0);
});

test('la reparación es aditiva, repetible, conserva datos y deja intacto un documento completo',()=>{
 const partial={cfg:{cur:'USD',ruc:'CONSERVAR'},accounts:[{code:'A',name:'Propia'}],entries:[],products:[],customValue:{note:'Conservar'}};
 const repaired=completeCompanyDocument(partial,options);
 assert.deepEqual(repaired.accounts,partial.accounts);assert.deepEqual(repaired.customValue,partial.customValue);
 assert.equal(repaired.cfg.cur,'USD');assert.equal(repaired.cfg.ruc,'CONSERVAR');
 assert.deepEqual(completeCompanyDocument(repaired,options),repaired);
 const complete=initialCompanyDocument(options);assert.deepEqual(completeCompanyDocument(complete,options),complete);
});

test('el perfil se completa una vez; con movimientos conserva todas las cuentas',()=>{
 const data=initialCompanyDocument(options);data.cfg.profilePending=true;
 data.entries=[{id:'historic',total:0,lines:[]}];data.accounts=[{code:'H',name:'Histórica'}];
 const company={name:options.name,businessType:'comercio',businessCustomization:{},data};
 const done=finishCompanyProfile(company,{...options,confirmed:true});
 assert.deepEqual(done.data.accounts,data.accounts);assert.deepEqual(done.data.entries,data.entries);
 assert.equal(done.data.cfg.profilePending,false);assert.equal(done.data.cfg.profileChartPreserved,true);
 assert.throws(()=>finishCompanyProfile(done,{...options,confirmed:true}));
 const empty=initialCompanyDocument({...options,businessType:'comercio'});empty.cfg.profilePending=true;
 const selected=finishCompanyProfile({...company,data:empty},{...options,confirmed:true});
 assert.ok(selected.data.accounts.some(a=>a.name.toLowerCase().includes('licencias')));
});

test('Google autentica sin crear empresa y usa el mismo formulario que el alta manual',()=>{
 const api=read('netlify/functions/api.mjs'),ui=read('public/app.js');
 assert.ok(api.includes("isOwnerAdmin ? 'Acontec' : ''"));
 assert.ok(ui.includes('<div class="reg" hidden>${companyFields()}</div>'));
 assert.ok(ui.includes('${companyFields(current)}'));
 assert.ok(ui.includes("api('first-company','POST',body)"));
 assert.ok(read('public/billing.js').includes('if(!U||!CO||S?.cfg?.profilePending)return;'));
 assert.ok(!ui.includes('if(!r.data&&!CO.readOnlyLimit&&!CO.support)save()'));
});

test('el almacenamiento muestra mensajes interpolados y no expresiones crudas',()=>{
 const source=read('public/platform-editor.js');
 assert.ok(source.includes("u.warning?'Aviso: alcanzaste el 70 %"));
 assert.ok(source.includes("'Sin límite configurado. '"));
 assert.ok(!source.includes('uiT("platform-editor.extra.47","${'));
 for(const match of source.matchAll(/uiT\("[^"\n]+",\s*"((?:[^"\\]|\\.)*)"\)/g))assert.ok(!match[1].includes('${'));
});

test('la migración es repetible, excluye plataforma/archivo y no borra documentos',()=>{
 const migration=read('netlify/database/migrations/20261105163711_repair_company_initial_defaults/migration.sql');
 assert.ok(migration.includes('ON CONFLICT(id) DO NOTHING'));
 assert.ok(migration.includes('NOT c.is_platform_company AND c.archived_at IS NULL'));
 assert.ok(!/\b(?:DELETE|TRUNCATE|DROP|UPDATE)\b/i.test(migration));
 assert.ok(migration.includes('c.onboarding_done=false'));
 const api=read('netlify/functions/api.mjs');
 assert.ok(api.includes("if(!task&&current.data!==null)return {}"));
 assert.ok(api.includes("},'Reparación de campos iniciales')"));
});
