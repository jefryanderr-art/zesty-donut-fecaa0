// Prepared for platform execution. No database, providers or local server.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {invoiceDraftOperation} from '../netlify/lib/invoice-drafts.mjs';
import {scopeBranch,mergeBranch} from '../netlify/lib/branches.mjs';
import {invoiceTotals,normalizeItemQuantity,moneyCents} from '../public/accounting-math.mjs';
import {normalizeDocument,restoreDocument} from '../netlify/lib/accounting-codec.mjs';
const check=(value,message)=>{if(!value)throw new Error(message)};
const helpers={requireValue:check,requirePermission:(access,module)=>check(access.write&&module==='facturacion','Sin permiso'),amount:Number,dateValue:v=>v};
const access={branchId:'principal',write:true,branches:[{id:'principal'},{id:'b'}]};
const body={operation:'invoiceDraft',date:'2026-11-11',party:'Cliente',items:[{p:'p',q:2,u:20}]};
const fixture=()=>({cfg:{pos:{}},products:[{id:'p',name:'Artículo',price:20,cost:4,vatRate:15,stock:5}],customers:[],entries:[],shifts:[],invoiceSequences:{},businessRecords:[]});
const register=data=>invoiceDraftOperation(data,access,structuredClone(body),helpers);
const operations=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
const saleSource=operations.slice(operations.indexOf('async function makeSale('),operations.indexOf('function creditNote('));
function saleHarness(){
 const context=vm.createContext({invoiceTotals,normalizeItemQuantity,
  ensurePrintVersions(){},requirePermission:helpers.requirePermission,requireValue:check,
  consumeDiscount:async()=>[],saleContext:()=>null,commerceSaleGuard(){},prepareBusinessSale:()=>[],
  normalInvoicePrice:(_d,p)=>p.price,effectiveFoodPrice:(_d,p)=>p.price,commercePrice:(_d,p)=>p.price,
  serviceConsumptionPlan:()=>({rows:[]}),serviceSaleSnapshot:()=>[],fiscalIssueGuard(){},
  giftPayment:()=>null,redeemGift(){},commerceLoadSale(){},commerceSnapshot:()=>({}),
  dateValue:v=>v,amount:Number,text:v=>String(v||''),round:v=>Math.round(v*100)/100,cents:moneyCents,
  currentShift:()=>({id:'shift',date:'2026-11-11'}),salesAdministrator:()=>true,operatorId:()=> 'owner',actorName:()=> 'Dueño',
  appendEntry:(data,_s,entry)=>{const row={id:'sale-'+data.entries.length,...entry};data.entries.push(row);return row},
  linesBetween:(a,b,v)=>[{a,d:v,c:0},{a:b,d:0,c:v}],audit:async()=>{},
 });
 vm.runInContext(saleSource+';globalThis.sell=makeSale;',context);return context.sell;
}
const applyBody=id=>({...structuredClone(body),sourceInvoiceDraft:id,payments:[{method:'transferencia',amount:46}]});
test('registrar conserva contabilidad, existencias, pagos, turno y secuencia',()=>{
 const data=fixture(),before=structuredClone(data),id=register(data);
 assert.equal(data.invoiceDrafts[0].id,id);assert.equal(data.invoiceDrafts[0].total,46);
 delete data.invoiceDrafts;assert.deepEqual(data,before);
});
test('aplicar usa emisor real, cuadra asiento y rechaza una segunda aplicación',async()=>{
 const data=fixture(),id=register(data),sell=saleHarness(),ctx={...access,company:{data}};
 const entry=await sell(data,ctx,{},applyBody(id));
 assert.equal(entry.total,46);assert.equal(data.products[0].stock,3);
 assert.equal(entry.lines.reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0),0);
 assert.equal(data.invoiceDrafts[0].status,'Aplicada');assert.equal(data.invoiceDrafts[0].entryId,entry.id);
 const before=structuredClone(data);await assert.rejects(sell(data,ctx,{},applyBody(id)),/no está disponible/);assert.deepEqual(data,before);
 assert.throws(()=>invoiceDraftOperation(data,access,{...body,id},helpers),/no está disponible/);
 assert.throws(()=>invoiceDraftOperation(data,access,{operation:'deleteInvoiceDraft',id,confirmed:true},helpers),/no está disponible/);
});
test('registro admite falta de stock; aplicar revalida stock, precio e IVA',async()=>{
 const data=fixture();data.products[0].stock=0;const id=register(data),sell=saleHarness(),ctx={...access,company:{data}};
 await assert.rejects(sell(data,ctx,{},applyBody(id)),/Existencia insuficiente/);
 data.cfg.allowNegativeValues=true;data.products[0].price=21;
 await assert.rejects(sell(data,ctx,{},applyBody(id)),/descuento autorizado/);
 data.products[0].price=20;data.products[0].vatRate=10;
 const request=applyBody(id);request.payments[0].amount=44;
 const entry=await sell(data,ctx,{},request);assert.equal(entry.vat,4);assert.equal(data.products[0].stock,-2);
});
test('permisos y sucursal activa se exigen antes de guardar o aplicar',async()=>{
 for(const ctx of [{...access,write:false},{...access,branchId:null}])assert.throws(()=>invoiceDraftOperation(fixture(),ctx,body,helpers));
 const data=fixture(),id=register(data),sell=saleHarness();
 await assert.rejects(sell(data,{...access,write:false,company:{data}},{},applyBody(id)),/Sin permiso/);
 await assert.rejects(sell(data,{...access,branchId:'b',company:{data}},{},applyBody(id)),/no está disponible/);
 assert.throws(()=>invoiceDraftOperation(data,{...access,branchId:'b'},{...body,id},helpers),/no está disponible/);
});
test('identificadores de otra empresa no permiten editar ni aplicar',async()=>{
 const first=fixture(),id=register(first),other=fixture();
 assert.throws(()=>invoiceDraftOperation(other,access,{...body,id},helpers),/no está disponible/);
 await assert.rejects(saleHarness()(other,{...access,company:{data:other}},{},applyBody(id)),/no está disponible/);
});
test('eliminar exige confirmación y fusionar conserva otras sucursales',()=>{
 const data=fixture(),id=register(data);data.invoiceDrafts.push({...data.invoiceDrafts[0],id:'other',branchId:'b'});
 const scoped=scopeBranch(data,access);assert.deepEqual(scoped.invoiceDrafts.map(r=>r.id),[id]);
 assert.throws(()=>invoiceDraftOperation(scoped,access,{operation:'deleteInvoiceDraft',id},helpers),/Confirma/);
 const next=structuredClone(scoped);invoiceDraftOperation(next,access,{operation:'deleteInvoiceDraft',id,confirmed:true},helpers);
 assert.deepEqual(mergeBranch(data,scoped,next,access).invoiceDrafts.map(r=>r.id),['other']);
});

test('codec relacional conserva borradores e importes anidados en centavos',()=>{
 const data=fixture();register(data);data.accounts=[];
 const packed=normalizeDocument('00000000-0000-4000-8000-000000000001',data);
 assert.equal(packed.rows.invoiceDrafts[0].totalCents,4600);
 assert.deepEqual(restoreDocument(packed).invoiceDrafts,data.invoiceDrafts);
});
