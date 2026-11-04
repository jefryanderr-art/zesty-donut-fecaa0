import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {healthRows,healthAlerts} from '../netlify/lib/system-health-rules.mjs';
import {platformContextAllowed} from '../netlify/lib/billing-rules.mjs';
test('salud exige rol real, empresa plataforma activa y ausencia de colaborador',()=>{
 const context={platformAdmin:true,platformCompany:true,companyId:'p',activeCompanyId:'p'};
 assert.equal(platformContextAllowed(context),true);
 for(const change of [{platformAdmin:false},{member:{id:'m'}},{platformCompany:false},{activeCompanyId:'other'}])assert.equal(platformContextAllowed({...context,...change}),false);
});
test('la proyección elimina datos personales y errores arbitrarios',()=>{
 const row=healthRows([{id:'abcdef12-1234-private',state:'error',createdAt:'2026-01-01',code:'SMTP error for private@example.invalid',email:'private@example.invalid',name:'Privado',body:'Contenido privado',amountCents:99999}],Date.parse('2026-01-02'))[0];
 assert.deepEqual(row,{id:'abcdef12',state:'error',createdAt:'2026-01-01T00:00:00.000Z',ageHours:24,code:'ERROR_REQUIRES_REVIEW'});
 assert.doesNotMatch(JSON.stringify(row),/private|Privado|99999|Contenido/);
});
test('el handler autoriza antes de cualquier lectura y no proyecta columnas privadas',async()=>{
 const source=await readFile(new URL('../netlify/lib/system-health.mjs',import.meta.url),'utf8');
 const stripped=source.replace(/^import .*;\n/gm,'').replaceAll('export ','');
 const load=new Function('requirePlatform','db',stripped+';return systemHealth;');let reads=0;
 const fn=load(async()=>{throw Object.assign(new Error('Denegado'),{status:403})},{execute:async()=>{reads++}});
 await assert.rejects(fn({},'p'),{status:403});assert.equal(reads,0);
 assert.doesNotMatch(source,/select\s+\*|\.select\(\)/i);
});
test('semáforo distingue incertidumbre de normalidad',()=>{
 const base={mail:{issues:[]},payments:{total:0},jobs:[],migrations:{state:'verified',pending:[],failed:[]}};
 assert.equal(healthAlerts(base).level,'verde');assert.equal(healthAlerts({...base,migrations:{...base.migrations,state:'unavailable'}}).level,'amarillo');
 assert.equal(healthAlerts({...base,jobs:[{name:'resolve-payments',state:'failed'}]}).level,'rojo');
});

test('la respuesta completa de salud no contiene datos de clientes',async()=>{
 const {createHash}=await import('node:crypto');const rules=await import('../netlify/lib/system-health-rules.mjs');
 const source=(await readFile(new URL('../netlify/lib/system-health.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export ','');
 const privateFields={email:'persona@privado.invalid',name:'Nombre privado',body:'Texto privado',amountCents:987654};let index=0;
 const results=[[{state:'error',count:1,...privateFields}],[{id:'abcdef12-private',state:'error',createdAt:'2026-01-01',code:'Persona privada SMTP',...privateFields}],[{count:1}],[{count:1,oldest:'2026-01-01'}],[{id:'12345678-private',state:'unknown',createdAt:'2026-01-01',...privateFields}],[{available:false}],[]];
 const db={execute:async()=>results[index++],select:()=>({from:()=>({where:async()=>[{content:{name:'sync-subscriptions',state:'failed',startedAt:'2026-01-01',finishedAt:'2026-01-01',code:'Objeto privado',...privateFields}}]})})};
 const deps={...rules,createHash,db,sql:()=>null,inArray:()=>null,siteContent:{},requirePlatform:async()=>{},EXPECTED_MIGRATIONS:[]};
 const fn=new Function(...Object.keys(deps),source+';return systemHealth;')(...Object.values(deps));
 const report=await fn({email:'administrador@interno.invalid'},'company');const json=JSON.stringify(report);
 assert.doesNotMatch(json,/persona@|Nombre privado|Texto privado|987654|Objeto privado|Persona privada/);
 assert.equal(report.mail.total,1);assert.equal(report.payments.total,1);assert.match(report.generatedBy,/^[a-f0-9]{8}$/);
});
