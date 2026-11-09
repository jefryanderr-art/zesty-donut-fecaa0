import {accountingEntries} from './accounting-engine.mjs';
import { randomUUID } from 'node:crypto';
import { canonical } from './accounting-codec.mjs';
import { branchStock, companyBranches, recordBranch } from './branches.mjs';
import { moneyCents,inventoryLineCostCents,inventoryShareCents } from './accounting-engine.mjs';

const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{status:400,publicMessage:message})};
const same=(a,b)=>canonical(a)===canonical(b);
const inventoryHistory=data=>(data.entries||[]).filter(e=>(e.stock||[]).length||(e.lines||[]).some(l=>l.a==='1301')).sort((a,b)=>a.id.localeCompare(b.id));
const layersByBranch=data=>[...(data?.inventoryLayers||[])].sort((a,b)=>recordBranch(a).localeCompare(recordBranch(b)));
const qty=n=>Math.round(n*1e6)/1e6;
const validQty=n=>Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*1e6))&&Math.abs(n-qty(n))<1e-9;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export const fifoEnabled=data=>data?.cfg?.costing?.method==='fifo';
const activeLayers=data=>(data.inventoryLayers||[]).filter(l=>l.epoch===data.cfg?.costing?.epoch);
const inventoryCents=(data,branch)=>accountingEntries(data.entries).filter(e=>recordBranch(e)===branch).flatMap(e=>e.lines||[]).filter(l=>l.a==='1301').reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0);
const unsupported=data=>{
 const records=data.businessRecords||[];
 check(!records.some(r=>r.module==='lotes'),'PEPS no admite lotes: la salida física actual usa FEFO y no enlaza cada lote con su capa de costo.');
 check(!records.some(r=>r.module==='variantes'&&r.serial),'PEPS no admite series: la selección individual aún no enlaza la serie con su capa de costo.');
 check(!records.some(r=>r.module==='produccion'),'PEPS no admite recetas o producción: el motor actual revaloriza el terminado y distribuye diferencias sin trazabilidad por capa de insumo.');
 check(!(data.stockTransfers||[]).some(t=>t.status==='enviado'),'Recibe los traslados pendientes antes de activar PEPS; no tienen capas de origen.');
};
function layer(data,{pid,branchId,date,q,unitCostCents,valueCents,entryId,sourceLayerId}){
 check(validQty(q)&&q>0&&safe(unitCostCents)&&safe(valueCents),'Capa PEPS inválida.');
 const l={id:randomUUID(),epoch:data.cfg.costing.epoch,productId:pid,branchId,date,q,originalQuantity:q,unitCostCents,valueCents,originalValueCents:valueCents,entryId,...(sourceLayerId?{sourceLayerId}:{})};
 (data.inventoryLayers||=[]).push(l);return l;
}
export function validateFifo(data){
 if(!fifoEnabled(data))return;
 unsupported(data);
 const ids=new Set(),layers=activeLayers(data),branches=companyBranches(data);
 for(const l of layers){
  check(!ids.has(l.id)&&typeof l.id==='string'&&data.products.some(p=>p.id===l.productId&&p.kind!=='service')&&branches.some(b=>b.id===l.branchId),'Referencia de capa PEPS inválida.');ids.add(l.id);
  check((validQty(l.q)||(l.negativeAdvance===true&&l.q<0&&validQty(-l.q)))&&validQty(l.originalQuantity)&&l.q<=l.originalQuantity&&(safe(l.valueCents)||(l.negativeAdvance===true&&Number.isSafeInteger(l.valueCents)&&l.valueCents<=0))&&safe(l.originalValueCents)&&safe(l.unitCostCents)&&l.valueCents<=l.originalValueCents&&(l.q!==0||l.valueCents===0),'Cantidad o valor de capa PEPS inválido.');
 }
 const byId=new Map(layers.map(l=>[l.id,l])),used=new Map();
 for(const e of data.entries||[])for(const row of e.stock||[]){
  const allocations=row.fifoAllocations||[];
  if(!allocations.some(a=>byId.has(a.layerId)))continue;
  check(allocations.every(a=>{const l=byId.get(a.layerId);return l&&l.productId===row.pid&&l.branchId===recordBranch(e)&&validQty(a.q)&&a.q>0&&safe(a.costCents)&&a.unitCostCents===l.unitCostCents}),'Asignación de capa PEPS inválida.');
  check(qty(allocations.reduce((s,a)=>s+a.q,0))===Math.abs(row.q)&&allocations.reduce((s,a)=>s+a.costCents,0)===row.costCents,'La salida o entrada PEPS no coincide con sus asignaciones.');
  for(const a of allocations)if(row.q<0){const u=used.get(a.layerId)||{q:0,valueCents:0};u.q=qty(u.q+a.q);u.valueCents+=a.costCents;used.set(a.layerId,u)}
 }
 for(const l of layers){const u=used.get(l.id)||{q:0,valueCents:0};check(qty(l.originalQuantity-u.q)===l.q&&l.originalValueCents-u.valueCents===l.valueCents,'El saldo de la capa PEPS no coincide con su historial de consumos.');}
 for(const b of branches){
  for(const p of data.products.filter(p=>p.kind!=='service')){
   const q=qty(layers.filter(l=>l.branchId===b.id&&l.productId===p.id).reduce((s,l)=>s+l.q,0));
   check(q===branchStock(data,p,b.id),'PEPS: las capas no coinciden con las existencias de la sucursal. No se guardó la operación.');
  }
  const value=layers.filter(l=>l.branchId===b.id).reduce((s,l)=>s+l.valueCents,0);
  check(Number.isSafeInteger(value)&&value===inventoryCents(data,b.id),'PEPS: las capas no coinciden con la cuenta 1301 de la sucursal. No se guardó la operación.');
 }
}
export function guardFifoOperation(data,body){
 if(!fifoEnabled(data))return;
 check(!['stockTransfer','stockReceive'].includes(body.operation),'PEPS bloquea traslados: el inventario en tránsito todavía no conserva asignaciones de capas de origen y destino.');
 check(!['businessProduce','sectorStart','sectorFinish','sectorHarvest'].includes(body.operation),'PEPS bloquea producción: el terminado requiere distribuir costos por capa de insumo.');
 check(body.operation!=='product'||Number(body.cost)===data.products.find(p=>p.id===body.id)?.cost,'PEPS no admite revalorización manual de capas.');
}
export function configureCosting(data,access,session,body,permit){
 check(access.owner&&!access.member&&!access.support,'Solo el dueño puede cambiar el método de costeo.');
 permit(access,'ajustes');permit(access,'inventario');permit(access,'contabilidad');
 const reason=String(body.reason||'').trim();
 check(body.confirmed===true&&reason.length>=3&&reason.length<=500,'Confirma el cambio de costeo e indica un motivo de 3 a 500 caracteres.');
 check(['average','fifo'].includes(body.method),'Método de costeo inválido.');
 check(body.method!==(data.cfg?.costing?.method||'average'),'El método de costeo ya está seleccionado.');
 const at=new Date().toISOString(),date=at.slice(0,10),previous=data.cfg?.costing?.method||'average';
 if(body.method==='fifo'){
  check(!(data.entries||[]).some(e=>e.date>date&&(e.stock||[]).length),'No actives PEPS con movimientos futuros de inventario.');
  unsupported(data);
  const epoch=randomUUID();data.cfg.costing={method:'fifo',epoch,date,at,reason,actor:session.email};
  for(const b of companyBranches(data))for(const p of data.products.filter(p=>p.kind!=='service')){
   const q=branchStock(data,p,b.id);check(validQty(q),'Existencia inicial PEPS inválida.');
   if(q)layer(data,{pid:p.id,branchId:b.id,date,q,unitCostCents:moneyCents(p.cost),valueCents:inventoryLineCostCents(q,p.cost),entryId:'initial:'+epoch});
  }
  validateFifo(data);
 }else{
  validateFifo(data);
  for(const p of data.products.filter(p=>p.kind!=='service')){
   const value=activeLayers(data).filter(l=>l.productId===p.id).reduce((s,l)=>s+l.valueCents,0);
   const cost=p.stock?Math.round(value/p.stock):moneyCents(p.cost);
   for(const b of companyBranches(data))check((branchStock(data,p,b.id)?inventoryLineCostCents(branchStock(data,p,b.id),cost/100):0)===activeLayers(data).filter(l=>l.productId===p.id&&l.branchId===b.id).reduce((s,l)=>s+l.valueCents,0),'El retorno a promedio produciría diferencias de centavos por producto o sucursal. Conserva PEPS hasta agotar esas existencias.');
   p.cost=cost/100;
  }
  data.cfg.costing={method:'average',date,at,reason,actor:session.email};
 }
 (data.cfg.costingHistory||=[]).push({previous,method:body.method,at,reason,actor:session.email});
 return data.cfg.costing.epoch||at;
}
function consume(data,pid,branchId,q,entry){
 let remaining=q;const allocations=[];
 for(const l of activeLayers(data).filter(l=>l.productId===pid&&l.branchId===branchId&&l.q>0).sort((a,b)=>a.date.localeCompare(b.date)||(data.inventoryLayers.indexOf(a)-data.inventoryLayers.indexOf(b)))){
  const used=Math.min(remaining,l.q);if(!used)break;
  const costCents=used===l.q?l.valueCents:inventoryShareCents(l.valueCents,used,l.q);
  allocations.push({layerId:l.id,q:used,costCents,unitCostCents:l.unitCostCents});
  l.q=qty(l.q-used);l.valueCents-=costCents;remaining=qty(remaining-used);
 }
 if(remaining>0&&data.cfg?.allowNegativeValues===true){
  const p=data.products.find(p=>p.id===pid),unitCostCents=moneyCents(p.cost),costCents=inventoryLineCostCents(remaining,p.cost);
  const l={id:randomUUID(),epoch:data.cfg.costing.epoch,productId:pid,branchId,date:entry.date,q:-remaining,originalQuantity:0,unitCostCents,valueCents:-costCents,originalValueCents:0,entryId:entry.id,negativeAdvance:true};
  data.inventoryLayers.push(l);allocations.push({layerId:l.id,q:remaining,costCents,unitCostCents});remaining=0;
 }
 check(remaining===0,'Capas PEPS insuficientes en la sucursal.');return allocations;
}
function restoreSale(data,entry,row){
 const sale=data.entries.find(e=>e.id===entry.invoiceId&&e.type==='venta');
 check(sale&&recordBranch(sale)===recordBranch(entry),'La devolución PEPS requiere la venta de la misma sucursal.');
 const sources=(sale.stock||[]).filter(r=>r.pid===row.pid).flatMap(r=>r.fifoAllocations||[]);
 check(sources.length,'Esta venta es anterior a PEPS y no tiene capas de origen; su devolución automática queda bloqueada.');
 let skipped=qty(data.entries.filter(e=>e.id!==entry.id&&e.type==='nota-credito'&&e.invoiceId===sale.id).flatMap(e=>e.stock||[]).filter(r=>r.pid===row.pid).reduce((s,r)=>s+r.q,0));
 let remaining=row.q;const allocations=[];
 for(const source of sources){
  const skip=Math.min(skipped,source.q);skipped=qty(skipped-skip);
  const take=Math.min(remaining,qty(source.q-skip));if(!take)continue;
  const costCents=inventoryShareCents(source.costCents,qty(skip+take),source.q)-inventoryShareCents(source.costCents,skip,source.q);
  const l=layer(data,{pid:row.pid,branchId:recordBranch(entry),date:entry.date,q:take,unitCostCents:source.unitCostCents,valueCents:costCents,entryId:entry.id,sourceLayerId:source.layerId});
  allocations.push({layerId:l.id,sourceLayerId:source.layerId,q:take,costCents,unitCostCents:source.unitCostCents});remaining=qty(remaining-take);
 }
 check(remaining===0,'La devolución excede las unidades de las capas originales.');return allocations;
}
// Procesa únicamente asientos nuevos del recorrido de runOperation, nunca históricos.
export function applyFifo(previous,data){
 if(!fifoEnabled(previous))return;
 unsupported(data);
 const old=new Map(previous.entries.map(e=>[e.id,e]));
 for(const e of previous.entries.filter(e=>(e.stock||[]).length||(e.lines||[]).some(l=>l.a==='1301')))check(same(e,data.entries.find(n=>n.id===e.id)),'PEPS conserva todos los asientos históricos.');
 const fresh=data.entries.filter(e=>!old.has(e.id));
 for(const entry of fresh){
  if(!(entry.stock||[]).length)continue;
  check(entry.date>=data.cfg.costing.date,'PEPS solo admite operaciones desde su activación.');
  check(['venta','nota-credito','ajuste','conteo','compra'].includes(entry.type),'PEPS bloquea esta operación de inventario: su recorrido no conserva capas de origen (traslados, producción, consumibles o anulaciones).');
  const branch=recordBranch(entry);
  check(!activeLayers(data).some(l=>l.branchId===branch&&l.date>entry.date),'PEPS no admite movimientos anteriores a una capa existente.');
  check(!data.entries.some(e=>e.id!==entry.id&&recordBranch(e)===branch&&e.date>entry.date&&(e.stock||[]).length),'PEPS no admite movimientos anteriores al último Kardex de la sucursal.');
  check(new Set(entry.stock.map(r=>r.pid)).size===entry.stock.length,'PEPS requiere una sola línea por producto; combina las cantidades repetidas antes de guardar.');
  let incoming=0,outgoing=0;
  for(const row of entry.stock){
   check(validQty(Math.abs(row.q))&&row.q!==0,'Cantidad PEPS inválida.');
   const p=data.products.find(p=>p.id===row.pid);check(p&&p.kind!=='service','Producto PEPS inválido.');
   let allocations;
   if(row.q<0)allocations=consume(data,row.pid,branch,-row.q,entry);
   else if(entry.type==='nota-credito')allocations=restoreSale(data,entry,row);
   else{
    const unitCostCents=moneyCents(row.unitCost??p.cost),valueCents=inventoryLineCostCents(row.q,row.unitCost??p.cost);
    const l=layer(data,{pid:row.pid,branchId:branch,date:entry.date,q:row.q,unitCostCents,valueCents,entryId:entry.id});
    allocations=[{layerId:l.id,q:row.q,costCents:valueCents,unitCostCents}];
   }
   row.fifoAllocations=allocations;row.costCents=allocations.reduce((s,a)=>s+a.costCents,0);
   row.unitCost=Math.round(row.costCents/Math.abs(row.q))/100;
   if(row.q>0)incoming+=row.costCents;else outgoing+=row.costCents;
  }
  const value=incoming-outgoing;
  if(entry.type==='compra')check(value===moneyCents(entry.subtotal),'La compra PEPS no coincide con el valor de entrada.');
  else{
   const counterpart=['venta','nota-credito'].includes(entry.type)?'5101':null;
   if(counterpart){
    entry.lines=entry.lines.filter(l=>!['1301',counterpart].includes(l.a));
    if(value)entry.lines.push({a:'1301',d:Math.max(0,value)/100,c:Math.max(0,-value)/100},{a:counterpart,d:Math.max(0,-value)/100,c:Math.max(0,value)/100});
   }else{
    // Conteos mixtos requieren las contrapartidas separadas, nunca compensación oculta.
    const positive=entry.lines.find(l=>l.a!=='1301'&&l.c>0)?.a||(entry.type==='ajuste'&&['error','conteo-inicial'].includes(entry.adjustmentReason)?'3191':entry.type==='ajuste'?'4102':null),negative=entry.lines.find(l=>l.a!=='1301'&&l.d>0)?.a||(entry.type==='ajuste'&&['error','conteo-inicial'].includes(entry.adjustmentReason)?'3191':entry.type==='ajuste'?'6107':null);
    check((!incoming||positive)&&(!outgoing||negative),'El ajuste PEPS requiere una contrapartida explícita por dirección.');
    entry.lines=[];
    if(incoming)entry.lines.push({a:'1301',d:incoming/100,c:0},{a:positive,d:0,c:incoming/100});
    if(outgoing)entry.lines.push({a:negative,d:outgoing/100,c:0},{a:'1301',d:0,c:outgoing/100});
    entry.total=(incoming+outgoing)/100;
   }
  }
  for(const item of entry.items||[]){const rows=entry.stock.filter(r=>r.pid===item.p);if(rows.length===1){item.costCents=rows[0].costCents;item.cost=rows[0].unitCost;}}
 }
 // El costo visible es informativo; el saldo exacto procede de las capas.
 const affected=new Set(fresh.flatMap(e=>(e.stock||[]).map(r=>r.pid)));
 for(const p of data.products.filter(p=>p.kind!=='service'&&affected.has(p.id))){
  const ls=activeLayers(data).filter(l=>l.productId===p.id),q=ls.reduce((s,l)=>s+l.q,0),value=ls.reduce((s,l)=>s+l.valueCents,0);
  if(q&&value/q>=0)p.cost=Math.round(value/q)/100;
 }
}
export function guardFifoMutation(previous,next,action){
 const operation=action.startsWith('Operación: '),configure=action==='Operación: costingMethod';
 if(!configure){
  check(same(previous?.cfg?.costing,next.cfg?.costing)&&same(previous?.cfg?.costingHistory,next.cfg?.costingHistory),'Cambia PEPS solo desde Método de costeo.');
  if(!operation)check(same(layersByBranch(previous),layersByBranch(next)),'Las capas PEPS solo se modifican desde operaciones autorizadas.');
 }
 if(fifoEnabled(previous)&&!operation){
  check(same(inventoryHistory(previous),inventoryHistory(next))&&previous.products.every(p=>next.products.some(n=>n.id===p.id&&n.stock===p.stock&&n.cost===p.cost))&&next.products.every(p=>previous.products.some(o=>o.id===p.id)||p.stock===0),'PEPS exige compras y ajustes desde sus operaciones; no admite edición, borrado, inventario inicial ni restauración de históricos. Crea productos sin existencias y usa Ajustar.');
 }
 validateFifo(next);
 if(operation&&fifoEnabled(next)&&!configure)for(const p of next.products){const ls=activeLayers(next).filter(l=>l.productId===p.id);const value=ls.reduce((s,l)=>s+l.valueCents,0);if(p.stock>0&&value>=0)p.cost=Math.round(value/p.stock)/100;}
}
