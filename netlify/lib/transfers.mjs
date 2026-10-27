import { normalizeItemQuantity } from './accounting-engine.mjs';
import { randomUUID } from 'node:crypto';
import { scopeBranch, branchStock, recordBranch } from './branches.mjs';
export const CROSS_BRANCH_OPS=['stockTransfer','stockReceive','moneyTransfer'];
export function transferOperation(data,access,session,body,h){
 const {requireValue:check,requirePermission:permit,appendEntry:append,dateValue:date,amount,ledgerBalance}=h,round=n=>Math.round((n+Number.EPSILON)*100)/100,when=date(body.date);
 permit(access,'sucursales');
 const source=access.branchId;check(source,'Selecciona una sucursal.');
 const posting=(branchId,record)=>append(data,session,{branchId,...record});
 if(body.operation==='moneyTransfer'){
  permit(access,'cajas');check(access.owner||['contador','supervisor'].includes(String(access.member?.role).toLowerCase()),'Solo responsables de caja autorizados transfieren dinero.');
  const destination=access.branches.find(b=>b.id===body.destinationId&&b.id!==source);check(destination,'Selecciona una sucursal de destino autorizada distinta.');const total=amount(body.total);check(['1101','1102'].includes(body.account),'Selecciona caja o banco.');
  const local=scopeBranch(data,access);check(ledgerBalance(local,body.account,when)>=total,'Saldo insuficiente en la sucursal de origen.');
  if(!data.accounts.some(a=>a.code==='1199'))data.accounts.push({code:'1199',name:'Transferencias entre sucursales',tipo:'activo',nat:'D',sub:''});
  const reference=String(body.reference||'').trim().slice(0,200);check(reference,'Escribe la referencia del traslado.');const id=randomUUID();
  posting(source,{date:when,type:'transferencia-dinero',transferId:id,desc:'Envío a sucursal '+destination.name,reference,total,lines:[{a:'1199',d:total,c:0},{a:body.account,d:0,c:total}]});
  posting(destination.id,{date:when,type:'transferencia-dinero',transferId:id,desc:'Recepción desde sucursal',reference,total,lines:[{a:body.account,d:total,c:0},{a:'1199',d:0,c:total}]});h.guardCash(local,scopeBranch(data,access));return id;
 }
 permit(access,'inventario');data.stockTransfers||=[];
 if(!data.accounts.some(a=>a.code==='1302'))data.accounts.push({code:'1302',name:'Inventario en tránsito entre sucursales',tipo:'activo',nat:'D',sub:''});
 if(body.operation==='stockTransfer'){
  const destination=access.branches.find(b=>b.id===body.destinationId&&b.id!==source);check(destination,'Selecciona una sucursal de destino autorizada distinta.');check(Array.isArray(body.items)&&body.items.length&&body.items.length<=200,'Agrega productos al traslado.');
  const used=new Set(),items=body.items.map(row=>{const p=data.products.find(p=>p.id===row.p),q=normalizeItemQuantity(row.q);check(p&&!used.has(p.id)&&Number.isFinite(q)&&q>0&&q<=1e6,'Producto duplicado o cantidad inválida.');used.add(p.id);check(branchStock(data,p,source)>=q,'Existencias insuficientes en origen.');return {p:p.id,name:p.name,q,cost:p.cost,unit:p.unit||'unidad'}}),total=round(items.reduce((s,i)=>s+round(i.q*i.cost),0)),id=randomUUID();
  const e=posting(source,{date:when,type:'traslado-enviado',transferId:id,desc:'Traslado enviado a '+destination.name,total,stock:items.map(i=>({pid:i.p,q:-i.q,unit:i.unit,unitCost:i.cost})),lines:total?[{a:'1302',d:total,c:0},{a:'1301',d:0,c:total}]:[]});
  for(const i of items){const p=data.products.find(p=>p.id===i.p);p.stock=Math.round((p.stock-i.q)*1e6)/1e6}
  data.stockTransfers.push({id,date:when,branchId:source,sourceId:source,destinationId:destination.id,items,total,status:'enviado',entryId:e.id});return id;
 }
 const transfer=data.stockTransfers.find(t=>t.id===body.id);check(transfer&&transfer.destinationId===source&&transfer.status==='enviado','Traslado no disponible para recibir en esta sucursal.');check(when>=transfer.date&&body.confirmed===true,'Confirma recepción y fecha.');
 const e=posting(source,{date:when,type:'traslado-recibido',transferId:transfer.id,desc:'Recepción de traslado',total:transfer.total,stock:transfer.items.map(i=>({pid:i.p,q:i.q,unit:i.unit,unitCost:i.cost})),lines:transfer.total?[{a:'1301',d:transfer.total,c:0},{a:'1302',d:0,c:transfer.total}]:[]});
 for(const i of transfer.items){const p=data.products.find(p=>p.id===i.p);check(p,'El producto del traslado ya no existe.');const value=p.stock*p.cost+i.q*i.cost;p.stock=Math.round((p.stock+i.q)*1e6)/1e6;p.cost=round(value/p.stock)}transfer.status='recibido';transfer.receivedAt=when;transfer.receivedEntryId=e.id;return transfer.id;
}
