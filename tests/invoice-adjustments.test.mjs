// Prepared for platform execution; no database, provider or local server required.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {invoicePriceAdjustment,invoiceTotals} from '../public/accounting-math.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
import '../public/invoice-design.js';

test('detecta el sentido y conserva precio original, final, forma y tasa histórica',()=>{
 assert.equal(invoicePriceAdjustment(100,100),null);
 assert.deepEqual(invoicePriceAdjustment(100,90),{type:'discount',mode:'percent',originalCents:10000,finalCents:9000,percent:10});
 assert.deepEqual(invoicePriceAdjustment(100,120,'nio'),{type:'increase',mode:'nio',originalCents:10000,finalCents:12000,amountCents:2000});
 assert.deepEqual(invoicePriceAdjustment(100,60,'usd',40),{type:'discount',mode:'usd',originalCents:10000,finalCents:6000,amountCents:100,exchangeRate:40});
 assert.equal(invoiceTotals([{q:2,u:90,vatRate:15}]).total,207);
});
test('rechaza ceros, negativos, vacíos, fracciones de centavo, descuentos excesivos y dólares sin tasa',()=>{
 for(const price of [0,-1,'',NaN,Infinity,0.001])assert.throws(()=>invoicePriceAdjustment(100,price));
 assert.equal(invoicePriceAdjustment(100,1).percent,99);
 assert.throws(()=>invoicePriceAdjustment(100,0.99));
 assert.throws(()=>invoicePriceAdjustment(100,89,'nio',null,10));
 for(const rate of [null,0,-1,NaN])assert.throws(()=>invoicePriceAdjustment(100,90,'usd',rate));
});
test('la representación relacional conserva los centavos de los ajustes de línea',()=>{
 const adjustment=invoicePriceAdjustment(100,120,'usd',40),data={cfg:{},accounts:[],products:[],customers:[],entries:[{id:'v',date:'2026-11-12',type:'venta',lines:[],items:[{p:'p',q:1,u:120,cost:0,priceAdjustment:adjustment}],total:120}]};
 const packed=normalizeDocument('00000000-0000-4000-8000-000000000001',data);
 assert.deepEqual(restoreDocument(packed).entries[0].items[0].priceAdjustment,adjustment);
});
test('impresión compartida por PDF e impresión revela descuentos y oculta aumentos en los tres formatos',()=>{
 const source=readFileSync(new URL('../public/experience.js',import.meta.url),'utf8'),operations=readFileSync(new URL('../public/operations.js',import.meta.url),'utf8');
 const label=operations.slice(operations.indexOf('function invoiceAdjustmentLabel('),operations.indexOf('function invoiceInternalProducts('));
 const fragment=source.slice(source.indexOf('function invoiceSettings('),source.indexOf('// El selector'));
 const context={uiT:(_key,fallback)=>fallback,saleContextRows:()=>[],saleContextMarkup:()=>'',AcontecInvoiceDesign:globalThis.AcontecInvoiceDesign,S:{cfg:{},entries:[]},CO:{name:'Empresa'},esc:v=>String(v??'').replace(/</g,'&lt;'),r2:n=>Math.round(n*100)/100,operationalRound:n=>Math.round(n*100)/100,customerById:()=>null,prod:()=>null,invoiceDate:v=>v||'',invoiceOperator:()=> 'Usuario',saleStatus:()=> 'Pagada',money:n=>'C$ '+n.toFixed(2),formatQuantity:n=>n,printAmountWords:()=>'',paymentLabels:{},PAY:{}};
 const render=vm.runInNewContext(label+fragment+';invoiceMarkup',context),settings={...globalThis.AcontecInvoiceDesign.defaults({},'Empresa'),copies:1,showDiscount:true};
 for(const format of ['a4','letter','thermal'])for(const mode of ['percent','nio','usd']){
  const invoice=final=>({id:'v',type:'venta',date:'2026-11-12',subtotal:final,total:final,items:[{name:'Producto',q:1,u:final,listPrice:final,priceAdjustment:invoicePriceAdjustment(123.45,final,mode,40)}]});
  const increased=render(invoice(150),format,'color',settings);
  assert.doesNotMatch(increased,/aumento|123\.45|26\.55|21\.51/i);assert.match(increased,/150\.00/);
  const decreased=render(invoice(100),format,'color',settings);
  assert.match(decreased,/Descuento:/);assert.match(decreased,mode==='percent'?/%/:mode==='nio'?/C\$ 23\.45/:/US\$ 0\.59/);
 }
});

test('el servidor exige una autorización vigente de la misma empresa, usuario, sucursal y precios y la consume una sola vez',async()=>{
 const {createHash}=await import('node:crypto');
 const source=readFileSync(new URL('../netlify/lib/discounts.mjs',import.meta.url),'utf8');
 const token='fixture-authorization',key='discount-grant:'+createHash('sha256').update(token).digest('hex');
 let adjustment=invoicePriceAdjustment(100,90),grant;
 const client={select:()=>({from:()=>({where:async()=>grant?[{content:grant}]:[]})}),delete:()=>({where:async()=>{grant=null;}})};
 const session={email:'fixture@example.test'},access={owner:true,branchId:'principal',company:{data:{}}};
 const body={discount:0,discountAuthorization:token,items:[{p:'p',q:1,u:90}]};
 const consume=vm.runInNewContext(source.slice(source.indexOf('export async function consumeDiscount')).replace('export ', '')+';consumeDiscount',{
  read:async()=>({version:1}),invoiceAdjustments:()=>[adjustment],operatorId:(_a,s)=>s.email,
  allowed:()=>true,operationalRole:()=>'',createHash,siteContent:{id:'id'},eq:(_a,b)=>b,
  fingerprint:b=>JSON.stringify(b.items),accessError:(message)=>{throw new Error(message)},
 });
 const reset=()=>{grant={companyId:'company',actor:session.email,branch:'principal',version:1,expires:Date.now()+60000,fingerprint:JSON.stringify(body.items),adjustments:JSON.stringify([adjustment])};};
 for(const patch of [{companyId:'other'},{actor:'other'},{branch:'other'},{version:2},{expires:1},{fingerprint:'changed'},{adjustments:'changed'}]){
  reset();Object.assign(grant,patch);await assert.rejects(()=>consume(client,'company',access,session,body));assert.ok(grant);
 }
 reset();await assert.rejects(()=>consume(client,'company',access,session,{...body,items:[{p:'p',q:2,u:90}]}));
 reset();await consume(client,'company',access,session,body);assert.equal(grant,null);
 await assert.rejects(()=>consume(client,'company',access,session,body));
});
