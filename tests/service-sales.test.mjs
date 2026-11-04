// Preparadas para ejecución por la plataforma; sin base de datos ni proveedores externos.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {invoiceTotals,normalizeItemQuantity,moneyCents} from '../public/accounting-math.mjs';
import {prepareBusinessSale} from '../netlify/lib/business.mjs';
const source=readFileSync(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
// Se evalúa la implementación real del emisor; solo se sustituyen sus dependencias de infraestructura.
const saleSource=source.slice(source.indexOf('async function makeSale('),source.indexOf('function creditNote('));
const check=(value,message)=>assert.ok(value,message);
function saleHarness(){
 const permissions=[];
 const context=vm.createContext({invoiceTotals,normalizeItemQuantity,prepareBusinessSale,
  ensurePrintVersions(){},requirePermission:(_access,module)=>permissions.push(module),requireValue:check,
  dateValue:value=>value,amount:Number,text:value=>String(value||''),round:value=>Math.round(value*100)/100,cents:moneyCents,
  currentShift:()=>null,salesAdministrator:()=>true,operatorId:()=> 'owner',actorName:()=> 'Dueño',
  appendEntry:(data,_session,entry)=>{const record={id:'sale-'+data.entries.length,...entry};data.entries.push(record);return record},
  linesBetween:(debit,credit,value)=>[{a:debit,d:value,c:0},{a:credit,d:0,c:value}],
  audit:async()=>{},customerCreditBalance:()=>0,
 });
 vm.runInContext(saleSource+';globalThis.sell=makeSale;',context);
 return {sell:context.sell,permissions};
}
for(const kind of ['service','stock'])test('venta real distingue '+kind+' y recalcula costo, precio e IVA',async()=>{
 const {sell}=saleHarness();
 const data={cfg:{pos:{}},products:[{id:'p',name:'Concepto',kind,unit:'sesión',stock:kind==='service'?0:5,cost:kind==='service'?0:4,price:20,vatRate:15}],entries:[],customers:[],invoiceSequences:{},businessRecords:[]};
 const entry=await sell(data,{owner:true,branchId:'principal',company:{data}}, {},{
  date:'2026-11-04',items:[{p:'p',q:2,u:20,cost:999,vatRate:0}],payments:[{method:'transferencia',amount:46}]
 });
 assert.equal(entry.subtotal,40);assert.equal(entry.vat,6);assert.equal(entry.total,46);
 assert.equal(data.products[0].stock,kind==='service'?0:3);
 assert.equal(entry.items[0].cost,kind==='service'?0:4);
 if(kind==='service'){
  assert.equal(entry.stock.length,0);
  assert.ok(entry.lines.every(line=>!['1301','5101'].includes(line.a)));
 }else{
  assert.equal(entry.stock.length,1);assert.equal(entry.stock[0].q,-2);
  assert.ok(entry.lines.some(line=>line.a==='1301'&&line.c===8));
 }
 assert.equal(data.entries.length,1);
});
