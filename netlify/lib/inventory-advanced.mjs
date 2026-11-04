import {randomUUID} from 'node:crypto';
import {moneyCents,recurringDay} from './accounting-engine.mjs';
import {managuaDay} from './billing-rules.mjs';
import {stockByWarehouse,stockAlerts,transferMovements} from './warehouse-stock.mjs';
import {kitSummary,landedCost,netRealizableValue} from '../../public/advanced-math.mjs';
// Inventario avanzado (Fase 5). Todo nace apagado y por empresa; no toca el costeo ni asientos existentes.
// Las bodegas distribuyen la existencia de la sucursal (informativo): no generan asientos ni cambian costos.
export const INVENTORY_MODULES=['bodegas','kits','conteo_ciclico','consignacion_vnr','desembarque'];
export const INVENTORY_NOTICE='Informe interno de apoyo; no genera asientos automáticos. Verifica con tu contador.';
export const INVENTORY_OPS=['invEnable','invWarehouse','invLimit','invAssign','invTransfer','invKit','invCountOpen','invCountLink','invConsign','invConsignClose','invLanded','invLandedExpense'];
const MODULE_OF={invWarehouse:'bodegas',invLimit:'bodegas',invAssign:'bodegas',invTransfer:'bodegas',invKit:'kits',invCountOpen:'conteo_ciclico',invCountLink:'conteo_ciclico',invConsign:'consignacion_vnr',invConsignClose:'consignacion_vnr',invLanded:'desembarque',invLandedExpense:'desembarque'};
export const inventoryModule=body=>body.operation==='invEnable'?body.module:MODULE_OF[body.operation];
const check=(value,message)=>{if(!value)throw Object.assign(new Error(message),{publicMessage:message,status:400})};
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const rows=(data,module,kind)=>(data.businessRecords||[]).filter(r=>r.module===module&&(!kind||r.kind===kind));
const qtyOk=v=>Number.isFinite(v)&&v>=0&&v<=1e9&&Math.abs(v*1e6-Math.round(v*1e6))<1e-5;
const inventoryProduct=(data,id)=>{const p=data.products.find(p=>p.id===id);check(p&&p.kind!=='service','Selecciona un producto inventariable.');return p};
export function validateInventoryRecord(r,check){
 check(typeof r.kind==='string'&&r.kind.length<=40&&Array.isArray(r.events),'Registro de inventario avanzado inválido.');
 for(const k of ['unitCostCents','amountCents','sellingCostPct'])if(r[k]!==undefined)check(Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=99999999900,'Importe de inventario avanzado inválido; usa centavos enteros.');
}
export async function inventoryOperation(data,access,session,body,ctx){
 const module=inventoryModule(body),op=body.operation,date=recurringDay(body.date),reason=txt(body.reason,501);
 check(INVENTORY_MODULES.includes(module),'Módulo inválido.');ctx.permit(access,module,true);
 check(access.branchId&&body.confirmed===true&&reason.length>=3&&reason.length<=500,'Selecciona sucursal, confirma y explica el motivo.');
 const records=data.businessRecords||=[],event={action:op,date,reason,actor:session.member?.name||session.email,at:new Date().toISOString()};
 const add=(kind,values={})=>{const r={id:randomUUID(),module,kind,name:txt(values.name||reason),status:'Activa',date,branchId:access.branchId,events:[event],...values};records.push(r);return r};
 const mine=(kind)=>rows(data,module,kind).filter(r=>r.branchId===access.branchId);
 const byId=(kind,id)=>{const r=mine(kind).find(r=>r.id===id);check(r,'Registro no encontrado en la sucursal activa.');return r};
 let config=rows(data,module,'configuration')[0];
 if(op==='invEnable'){
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia la activación efectiva hoy.');
  if(!config)config=add('configuration',module==='consignacion_vnr'?{sellingCostPct:0}:{});else config.events.push(event);
  config.status=body.enabled?'Activa':'Inactiva';return config.id;
 }
 check(config?.status==='Activa','El dueño debe activar este módulo.');
 if(op==='invWarehouse'){
  ctx.permit(access,'inventario',true);const name=txt(body.name,80);check(name,'Escribe el nombre de la bodega.');
  const existing=body.id?byId('warehouse',body.id):null;
  check(!mine('warehouse').some(w=>w.id!==existing?.id&&w.status==='Activa'&&w.name.toLowerCase()===name.toLowerCase()),'Ya existe una bodega activa con ese nombre en la sucursal.');
  const values={name,zone:txt(body.zone,80),status:body.active===false?'Inactiva':'Activa'};
  if(existing){
   if(values.status==='Inactiva')check(!mine('balance').some(b=>b.warehouseId===existing.id&&b.qty>0),'Traslada las existencias antes de desactivar la bodega.');
   Object.assign(existing,values);existing.events.push(event);return existing.id;
  }
  return add('warehouse',values).id;
 }
 const activeWarehouse=id=>{const w=byId('warehouse',id);check(w.status==='Activa','La bodega está inactiva.');return w};
 if(op==='invLimit'){
  ctx.permit(access,'inventario',true);activeWarehouse(body.warehouseId);inventoryProduct(data,body.productId);
  const min=body.min==null||body.min===''?null:Number(body.min),max=body.max==null||body.max===''?null:Number(body.max);
  check((min==null||qtyOk(min))&&(max==null||qtyOk(max))&&(min!=null||max!=null)&&(min==null||max==null||max>=min),'Revisa el mínimo y el máximo.');
  const existing=mine('limit').find(l=>l.warehouseId===body.warehouseId&&l.productId===body.productId);
  if(existing){Object.assign(existing,{min,max});existing.events.push(event);return existing.id}
  return add('limit',{warehouseId:body.warehouseId,productId:body.productId,min,max,name:'Límite'}).id;
 }
 const balanceOf=(warehouseId,productId)=>mine('balance').find(b=>b.warehouseId===warehouseId&&b.productId===productId);
 if(op==='invAssign'){
  ctx.permit(access,'inventario',true);activeWarehouse(body.warehouseId);const p=inventoryProduct(data,body.productId),q=Number(body.qty);
  check(qtyOk(q),'Cantidad inválida.');
  const others=mine('balance').filter(b=>b.productId===p.id&&b.warehouseId!==body.warehouseId).reduce((s,b)=>s+b.qty,0);
  check(others+q<=p.stock+1e-6,'La suma asignada a bodegas excede la existencia de la sucursal.');
  const b=balanceOf(body.warehouseId,p.id);
  if(b){b.qty=q;b.events.push(event);return b.id}
  return add('balance',{warehouseId:body.warehouseId,productId:p.id,qty:q,name:'Existencia'}).id;
 }
 if(op==='invTransfer'){
  ctx.permit(access,'inventario',true);activeWarehouse(body.fromWarehouseId);activeWarehouse(body.toWarehouseId);inventoryProduct(data,body.productId);
  const q=Number(body.qty);check(qtyOk(q)&&q>0,'Cantidad inválida.');
  const stock=mine('balance').map(b=>({warehouseId:b.warehouseId,productId:b.productId,qty:b.qty}));
  let moves;try{moves=transferMovements({fromWarehouseId:body.fromWarehouseId,toWarehouseId:body.toWarehouseId,productId:body.productId,qty:q,stock})}catch(e){check(false,e.message)}
  let to=balanceOf(body.toWarehouseId,body.productId);const from=balanceOf(body.fromWarehouseId,body.productId);
  from.qty=Math.round((from.qty+moves[0].qty)*1e6)/1e6;from.events.push(event);
  if(to){to.qty=Math.round((to.qty+moves[1].qty)*1e6)/1e6;to.events.push(event)}else add('balance',{warehouseId:body.toWarehouseId,productId:body.productId,qty:q,name:'Existencia'});
  return add('transfer',{fromWarehouseId:body.fromWarehouseId,toWarehouseId:body.toWarehouseId,productId:body.productId,qty:q,status:'Aplicado',name:'Traslado entre bodegas'}).id;
 }
 if(op==='invKit'){
  ctx.permit(access,'inventario',true);const kitProduct=data.products.find(p=>p.id===body.productId);check(kitProduct&&kitProduct.kind!=='service','Selecciona el producto que representa el kit.');
  const list=Array.isArray(body.components)?body.components:[];check(list.length>=1&&list.length<=50,'Agrega entre 1 y 50 componentes.');
  const seen=new Set(),components=list.map(c=>{const p=inventoryProduct(data,c.p),q=Number(c.q);check(p.id!==kitProduct.id&&!seen.has(p.id)&&qtyOk(q)&&q>0,'Componente duplicado o cantidad inválida.');seen.add(p.id);return {p:p.id,q}});
  const existing=mine('kit').find(k=>k.productId===kitProduct.id&&k.status==='Activa');
  const status=body.active===false?'Inactiva':'Activa';
  if(existing){Object.assign(existing,{components,status,name:kitProduct.name});existing.events.push(event);return existing.id}
  return add('kit',{productId:kitProduct.id,components,status,name:kitProduct.name}).id;
 }
 if(op==='invCountOpen'){
  ctx.permit(access,'inventario',true);const scope=body.scope;check(['zona','categoria'].includes(scope),'Selecciona zona o categoría.');
  const value=txt(body.value,80);check(value,'Indica la zona o categoría.');let ids;
  if(scope==='zona'){const warehouses=mine('warehouse').filter(w=>w.zone===value&&w.status==='Activa').map(w=>w.id);check(warehouses.length,'No hay bodegas activas en esa zona.');ids=[...new Set(mine('balance').filter(b=>warehouses.includes(b.warehouseId)).map(b=>b.productId))]}
  else ids=data.products.filter(p=>p.kind!=='service'&&String(p.category||'').toLowerCase()===value.toLowerCase()).map(p=>p.id);
  check(ids.length&&ids.length<=1000,'No hay productos para contar en ese alcance.');
  const items=ids.map(id=>{const p=data.products.find(p=>p.id===id);return {p:id,name:p.name,expected:p.stock}});
  return add('count',{scope,value,items,status:'Abierto',name:'Conteo '+scope+' · '+value}).id;
 }
 if(op==='invCountLink'){
  ctx.permit(access,'inventario',true);const plan=byId('count',body.id);check(plan.status==='Abierto','El conteo ya fue aplicado.');
  const entry=data.entries.find(e=>e.id===body.entryId&&e.type==='conteo'&&!(data.businessRecords||[]).some(r=>r.module===module&&r.kind==='count'&&r.entryId===e.id));
  check(entry&&entry.date>=plan.date,'Realiza primero el conteo confirmado del inventario y selecciona su asiento.');
  const planned=new Set(plan.items.map(i=>i.p));check((entry.counts||[]).length>0&&entry.counts.every(c=>planned.has(c.p)),'El conteo incluye productos fuera del alcance del plan.');
  plan.status='Aplicado';plan.entryId=entry.id;plan.events.push(event);return plan.id;
 }
 if(op==='invConsign'){
  ctx.permit(access,'inventario',true);const p=inventoryProduct(data,body.productId),q=Number(body.qty),cents=body.unitCostCents;
  check(qtyOk(q)&&q>0&&Number.isSafeInteger(cents)&&cents>=0&&cents<=99999999900&&txt(body.supplier,120),'Revisa proveedor, cantidad y costo (centavos enteros).');
  return add('consignment',{supplier:txt(body.supplier,120),productId:p.id,qty:q,unitCostCents:cents,status:'Abierta',name:'Consignación · '+txt(body.supplier,120)}).id;
 }
 if(op==='invConsignClose'){const r=byId('consignment',body.id);check(r.status==='Abierta','La consignación ya está cerrada.');r.status='Cerrada';r.events.push(event);return r.id}
 if(op==='invLanded'){
  ctx.permit(access,'compras',true);const purchase=data.entries.find(e=>e.id===body.purchaseId&&e.type==='compra');check(purchase?.stock?.length,'Compra con inventario no encontrada en la sucursal activa.');
  check(!mine('landed').some(l=>l.purchaseId===purchase.id),'La compra ya tiene un registro de desembarque.');
  return add('landed',{purchaseId:purchase.id,expenses:[],name:'Desembarque · '+(purchase.reference||purchase.id)}).id;
 }
 if(op==='invLandedExpense'){
  ctx.permit(access,'gastos',true);const r=byId('landed',body.id),cents=body.amountCents;
  check(Number.isSafeInteger(cents)&&cents>0&&cents<=99999999900&&txt(body.supplier,120)&&txt(body.reference,60)&&r.expenses.length<100,'Revisa proveedor, factura e importe (centavos enteros).');
  check(!r.expenses.some(x=>x.reference.toLowerCase()===txt(body.reference,60).toLowerCase()&&x.supplier.toLowerCase()===txt(body.supplier,120).toLowerCase()),'Esa factura de gasto ya está registrada en esta compra.');
  r.expenses.push({id:randomUUID(),supplier:txt(body.supplier,120),reference:txt(body.reference,60),amountCents:cents,date,concept:txt(body.concept,120)});r.events.push(event);return r.id;
 }
 check(false,'Operación no disponible.');
}
export function inventoryReport(data,body,canRead){
 const module=body.module;check(INVENTORY_MODULES.includes(module),'Módulo inválido.');
 const config=rows(data,module,'configuration')[0],result={enabled:config?.status==='Activa',notice:INVENTORY_NOTICE,records:rows(data,module)};
 const product=id=>data.products.find(p=>p.id===id),name=id=>product(id)?.name||id;
 if(module==='bodegas'){
  const balances=rows(data,module,'balance'),limits=rows(data,module,'limit');
  result.stock=stockByWarehouse(balances.map(b=>({warehouseId:b.warehouseId,productId:b.productId,qty:b.qty}))).map(r=>({...r,product:name(r.productId)}));
  result.alerts=stockAlerts(result.stock,limits.map(l=>({warehouseId:l.warehouseId,productId:l.productId,min:l.min,max:l.max}))).map(a=>({...a,product:name(a.productId),warehouse:rows(data,module,'warehouse').find(w=>w.id===a.warehouseId)?.name||a.warehouseId}));
  const allocated=new Map();for(const b of balances)allocated.set(b.productId,(allocated.get(b.productId)||0)+b.qty);
  result.unassigned=[...allocated].map(([id,q])=>({productId:id,product:name(id),stock:product(id)?.stock??0,allocated:q,unassigned:Math.round(((product(id)?.stock??0)-q)*1e6)/1e6}));
 }
 if(module==='kits')result.kits=rows(data,module,'kit').map(k=>({id:k.id,product:k.name,status:k.status,priceCents:moneyCents(product(k.productId)?.price||0),...kitSummary(k.components.map(c=>({qty:c.q,unitCostCents:moneyCents(product(c.p)?.cost||0),stock:product(c.p)?.stock??0})))}));
 if(module==='consignacion_vnr'){
  const pct=config?.sellingCostPct||0;
  result.consignments=rows(data,module,'consignment').map(c=>({id:c.id,supplier:c.supplier,product:name(c.productId),qty:c.qty,unitCostCents:c.unitCostCents,totalCents:Math.round(c.qty*c.unitCostCents),status:c.status}));
  result.nrv=data.products.filter(p=>p.kind!=='service'&&p.stock>0).map(p=>{const price=moneyCents(p.price||0);return {productId:p.id,product:p.name,qty:p.stock,unitCostCents:moneyCents(p.cost||0),...netRealizableValue({qty:p.stock,unitCostCents:moneyCents(p.cost||0),priceCents:price,sellingCostCents:Math.round(price*pct/100)})}}).filter(r=>r.writeDownCents>0);
 }
 if(module==='desembarque')result.landed=rows(data,module,'landed').map(l=>{
  const purchase=data.entries.find(e=>e.id===l.purchaseId),lines=(purchase?.stock||[]).filter(s=>s.q>0).map(s=>({productId:s.pid,product:name(s.pid),q:s.q,costCents:moneyCents(s.q*(s.unitCost||0))}));
  const extra=l.expenses.map(x=>x.amountCents),spread=landedCost(lines,extra);
  return {id:l.id,purchase:purchase?.reference||l.purchaseId,expensesCents:extra.reduce((a,b)=>a+b,0),expenses:l.expenses,lines:spread.map(s=>({...s,unitLandedCents:s.q?Math.round(s.landedCents/s.q):0}))};
 });
 return result;
}
