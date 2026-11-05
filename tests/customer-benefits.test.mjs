import test from 'node:test';
import assert from 'node:assert/strict';
import {benefitOperation,giftPayment,redeemGift,giftReturn,loyaltyOffer,validateBenefit} from '../netlify/lib/customer-benefits.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const context={check,permit(){},financialCash(){},date:v=>v,amount:v=>{check(Number.isFinite(v)&&v>0,'Importe');return v},entry(data,session,row){const e={id:'entry-'+data.entries.length,...row};data.entries.push(e);return e}};
const access={owner:true,branchId:'principal'},session={email:'owner@example.test'};
function fixture(){return {businessRecords:[],entries:[],customers:[],accounts:[{code:'1101',tipo:'activo'},{code:'2209',tipo:'pasivo',nat:'C'}]};}
test('gift sale credits liability; partial mixed redemption and credit restoration retain cents',()=>{
 const d=fixture(),id=benefitOperation(d,access,session,{operation:'giftIssue',operationId:'test',confirmed:true,date:'2026-11-05',pay:'1101',liability:'2209',name:'VALE-1',total:100},context);
 const r=d.businessRecords[0];validateBenefit(r,check);assert.equal(id,r.id);assert.deepEqual(d.entries[0].lines,[{a:'1101',d:100,c:0},{a:'2209',d:0,c:100}]);
 const gift=giftPayment(d,{giftId:id,payments:[{method:'vale',amount:25},{method:'efectivo',amount:5}]},'2026-11-05',check),invoice={id:'invoice-1',date:'2026-11-05'};redeemGift(gift,invoice);assert.equal(r.balanceCents,7500);
 const restored=giftReturn(d,invoice,[],10,check);assert.equal(restored.amountCents,1000);
 assert.equal(giftReturn(d,invoice,[{giftRestoration:{amountCents:1000}}],50,check).amountCents,1500);
 assert.equal(giftReturn(d,invoice,[{giftRestoration:{amountCents:2500}}],10,check),null);
 assert.throws(()=>giftPayment(d,{giftId:id,payments:[{method:'vale',amount:76}]},'2026-11-05',check));
});
test('expiry prevents redemption and refund never recognizes income',()=>{
 const d=fixture();benefitOperation(d,access,session,{operation:'giftIssue',operationId:'test',confirmed:true,date:'2026-11-05',due:'2026-11-06',pay:'1101',liability:'2209',name:'V1',total:10},context);
 const r=d.businessRecords[0];assert.throws(()=>giftPayment(d,{giftId:r.id,payments:[{method:'vale',amount:1}]},'2026-11-07',check));
 benefitOperation(d,access,session,{operation:'giftRefund',operationId:'test',confirmed:true,id:r.id,pay:'1101',date:'2026-11-07'},context);
 assert.equal(r.balanceCents,0);assert.equal(r.status,'Devuelta');assert.ok(d.entries.every(e=>e.lines.every(l=>!l.a.startsWith('4'))));
});
test('frequency benefit excludes fully returned invoices and consumes a separate purchase',()=>{
 const config={id:'cfg',kind:'loyalty-settings',enabled:true,date:'2026-11-01',every:2,percent:5};
 const d={businessRecords:[config],entries:[{id:'a',type:'venta',customerId:'c',date:'2026-11-02',total:10},{id:'b',type:'venta',customerId:'c',date:'2026-11-03',total:10}]};
 assert.equal(loyaltyOffer(d,'c','2026-11-05').available,1);
 d.entries.push({id:'reward',type:'venta',customerId:'c',date:'2026-11-04',total:9.5,loyalty:{configId:'cfg'}});assert.equal(loyaltyOffer(d,'c','2026-11-05').available,0);
 d.entries.push({id:'nc',type:'nota-credito',invoiceId:'a',total:10});assert.equal(loyaltyOffer(d,'c','2026-11-05').available,0);
 config.enabled=false;assert.equal(loyaltyOffer(d,'c','2026-11-05'),null);
});

test('voucher shift totals and native card cents survive the relational codec',async()=>{
 const {normalizeDocument,restoreDocument}=await import('../netlify/lib/accounting-codec.mjs');
 const data={shifts:[{id:'s1',totals:{vale:12.34,efectivo:3.21}}],businessRecords:[{id:'gift1',module:'facturacion',kind:'gift-card',balanceCents:1234,originalCents:2000,events:[{amountCents:766}]}]};
 const encoded=normalizeDocument('company-test',data);assert.deepEqual(restoreDocument(encoded),data);
 assert.throws(()=>normalizeDocument('company-test',{shifts:[{id:'s1',totals:{vale:12.345}}]}));
});
