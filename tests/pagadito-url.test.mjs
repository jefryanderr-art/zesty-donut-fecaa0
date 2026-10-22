import test from 'node:test';
import assert from 'node:assert/strict';
import {safePaymentUrl} from '../netlify/lib/pagadito.mjs';

test('el enlace de pago exige HTTPS y el dominio exacto del entorno, sin filtrar datos privados a logs',()=>{
 const previous=process.env.PAGADITO_ENV,info=console.info,warn=console.warn,logs=[];
 console.info=(...args)=>logs.push(args);
 console.warn=(...args)=>logs.push(args);
 try{
  for(const [environment,domain,other] of [
   ['sandbox','sandbox.pagadito.com','pagadito.com'],
   ['production','pagadito.com','sandbox.pagadito.com']
  ]){
   process.env.PAGADITO_ENV=environment;
   const valid='https://'+domain+'/checkout?private=PRIVATE_QUERY#PRIVATE_FRAGMENT';
   assert.equal(safePaymentUrl(valid),valid);
   for(const [value,reason] of [
    ['http://'+domain+'/','https_required'],
    ['https://'+other+'/','domain_not_allowed'],
    ['https://sandbox-connect.pagadito.com/','domain_not_allowed'],
    ['https://connect.pagadito.com/','domain_not_allowed'],
    ['https://www.'+domain+'/','domain_not_allowed'],
    ['https://'+domain+'.example.invalid/','domain_not_allowed'],
    ['https://child.'+domain+'/','domain_not_allowed'],
    ['https://PRIVATE_USER:PRIVATE_PASSWORD@'+domain+'/','embedded_credentials'],
    ['https://'+domain+':8443/','custom_port'],
    ['invalid PRIVATE_QUERY','invalid_url']
   ]){
    assert.throws(()=>safePaymentUrl(value));
    assert.equal(logs.at(-1)[1].reason,reason);
   }
  }
  process.env.PAGADITO_ENV='';
  assert.throws(()=>safePaymentUrl('https://pagadito.com/'));
  assert.equal(logs.at(-1)[1].reason,'invalid_environment');
  const output=JSON.stringify(logs);
  for(const privateValue of ['PRIVATE_QUERY','PRIVATE_FRAGMENT','PRIVATE_USER','PRIVATE_PASSWORD','/checkout'])assert.equal(output.includes(privateValue),false);
  assert.ok(logs.some(([,entry])=>entry.domain==='sandbox.pagadito.com'&&entry.reason==='accepted'));
  assert.ok(logs.some(([,entry])=>entry.domain==='pagadito.com'&&entry.reason==='accepted'));
 }finally{
  if(previous===undefined)delete process.env.PAGADITO_ENV;else process.env.PAGADITO_ENV=previous;
  console.info=info;console.warn=warn;
 }
});
