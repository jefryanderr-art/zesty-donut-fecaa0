// Pruebas de humo contra una vista previa ya desplegada; nunca inician un servidor local.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.ACONTEC_TEST_URL;
test('los endpoints privados rechazan visitantes sin sesión',{skip:!origin},async()=>{
 for(const path of ['/api/platform?c=00000000-0000-0000-0000-000000000000','/api/customers-admin','/api/billing/me']){
  const response=await fetch(new URL(path,origin),{redirect:'manual'});assert.equal(response.status,401);
 }
});
test('el webhook rechaza una firma ausente',{skip:!origin},async()=>{
 const response=await fetch(new URL('/api/pagadito-webhook',origin),{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(response.status,401);
});
test('las tres páginas legales son públicas',{skip:!origin},async()=>{
 for(const name of ['privacidad','terminos','reembolsos']){const response=await fetch(new URL('/'+name,origin));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/)}
});
