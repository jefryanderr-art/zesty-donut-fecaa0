import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir){
 const result=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(['.git','node_modules'].includes(entry.name))continue;
  const target=path.join(dir,entry.name);
  if(entry.isDirectory())result.push(...await files(target));else if(entry.isFile())result.push(target);
 }
 return result;
}
test('no reaparece el correo administrativo histórico fuera de migraciones inmutables',async()=>{
 const migration=await readFile(path.join(root,'netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql'),'utf8');
 const addresses=[...new Set(migration.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]+/g)||[])];
 assert.ok(addresses.length>0);
 for(const file of await files(root)){
  if(file.includes('/netlify/database/migrations/'))continue;
  const text=await readFile(file,'utf8');
  assert.equal(addresses.some(email=>text.toLowerCase().includes(email.toLowerCase())),false,path.relative(root,file));
 }
});
test('código propio no contiene contraseñas de acceso ni claves privadas literales',async()=>{
 for(const dir of ['public','netlify/functions','netlify/lib','scripts'])for(const file of await files(path.join(root,dir))){
  if(file.includes('/vendor/')||!/[.](?:m?js|ts|html)$/.test(file))continue;
  const source=await readFile(file,'utf8');
  assert.equal(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk_live_|sk-ant-)[A-Za-z0-9_-]{16,}/.test(source),false,path.relative(root,file));
  assert.equal(/(?:ADMIN_PASSWORD|adminPassword|password)\s*[:=]\s*['"][^'"\n]{8,}['"]/.test(source),false,path.relative(root,file));
 }
 const source=await readFile(path.join(root,'netlify/functions/api.mjs'),'utf8');
 assert.equal(/same\(candidate,\s*['"]/.test(source),false);
});
