import {serviceLineCostCents,serviceCommissionCents,normalizeItemQuantity,moneyCents} from './accounting-engine.mjs';

const fail=message=>{throw Object.assign(new Error(message),{status:422,publicMessage:message})};
const ensure=(value,message)=>{if(!value)fail(message)};
const quantity=value=>{ensure(typeof value==='number'&&Number.isFinite(value)&&value>=0.001&&value<=1000000,'Usa cantidades positivas con hasta tres decimales.');const normalized=normalizeItemQuantity(value);ensure(Math.abs(normalized-value)<0.000000001,'Usa cantidades positivas con hasta tres decimales.');return normalized};
const id=value=>typeof value==='string'&&/^[a-z0-9-]{1,80}$/.test(value);
const bps=value=>{ensure(Number.isInteger(value)&&value>=0&&value<=10000,'La comisión debe estar entre 0 y 10000 puntos básicos.');return value};

// Solo los servicios configurados explícitamente usan este contrato; no se infieren datos históricos.
export function validateServiceDefinition(data,productId,input){
 const product=data.products.find(p=>p.id===productId);
 ensure(product?.kind==='service','Selecciona un servicio existente.');
 ensure(input&&typeof input==='object'&&!Array.isArray(input)&&input.version===1&&typeof input.enabled==='boolean','Configuración de servicio inválida.');
 ensure(Number.isInteger(input.durationMinutes)&&input.durationMinutes>=0&&input.durationMinutes<=525600,'Duración inválida.');
 ensure(['hora','sesión','mes','visita','servicio'].includes(input.billingUnit),'Selecciona la unidad de cobro.');
 ensure(['gravado','exento','tasa_cero'].includes(input.taxMode),'Declara el tratamiento del IVA.');
 const taxReason=String(input.taxReason||'').trim();ensure(taxReason.length<=500&&(input.taxMode!=='exento'||taxReason.length>=3),'La exención requiere un motivo; verifica con tu contador.');
 ensure(typeof input.vatRate==='number'&&Number.isFinite(input.vatRate)&&input.vatRate>=0&&input.vatRate<=100&&(input.taxMode==='gravado'?input.vatRate>0:input.vatRate===0),'El IVA no coincide con el tratamiento declarado.');
 const employeeCommissions=input.employeeCommissions||[];
 ensure(Array.isArray(employeeCommissions)&&employeeCommissions.length<=200,'Comisiones por empleado inválidas.');
 const employees=new Set();const overrides=employeeCommissions.map(row=>{
  ensure(row&&id(row.employeeId)&&!employees.has(row.employeeId)&&data.employees?.some(e=>e.id===row.employeeId),'Empleado inexistente o duplicado.');employees.add(row.employeeId);
  return {employeeId:row.employeeId,basisPoints:bps(row.basisPoints)};
 });
 const readRows=(rows,service)=>{
  ensure(Array.isArray(rows)&&rows.length<=100,'Componentes o consumibles inválidos.');const seen=new Set();
  return rows.map(row=>{
   ensure(row&&id(row.p)&&row.p!==productId&&!seen.has(row.p),'Componente inexistente, repetido o autorreferente.');seen.add(row.p);
   const p=data.products.find(p=>p.id===row.p);ensure(p&&(service?p.kind==='service':p.kind!=='service'),'El paquete solo admite servicios; el consumible debe manejar inventario.');
   if(service)ensure(!p.serviceDefinition?.components?.length,'No se admiten paquetes anidados.');
   return {p:row.p,q:quantity(row.q)};
  });
 };
 const result={version:1,enabled:input.enabled,durationMinutes:input.durationMinutes,billingUnit:input.billingUnit,taxMode:input.taxMode,taxReason,vatRate:input.vatRate,commissionBasisPoints:bps(input.commissionBasisPoints),employeeCommissions:overrides,components:readRows(input.components||[],true),consumables:readRows(input.consumables||[],false)};
 // Impide que convertir un componente en paquete cree un ciclo en otro servicio.
 ensure(!result.components.length||!data.products.some(p=>p.id!==productId&&p.serviceDefinition?.components?.some(c=>c.p===productId)),'Este servicio es componente de otro paquete; no puede convertirse en paquete anidado.');
 return result;
}

export function configureService(data,access,body,ctx){
 ctx.permit(access,'inventario',true);
 ensure(access.branchId,'Selecciona una sucursal.');
 ensure(body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Confirma el cambio e indica un motivo.');
 const current=data.products.find(p=>p.id===body.id),definition=validateServiceDefinition(data,body.id,body.definition);
 if(definition.employeeCommissions.length||current?.serviceDefinition?.employeeCommissions?.length)ctx.permit(access,'personal',true);
 const hiddenCommissions=(current.serviceDefinition?.employeeCommissions||[]).filter(row=>!data.employees?.some(e=>e.id===row.employeeId));
 definition.employeeCommissions.push(...structuredClone(hiddenCommissions));
 if(body.name!==undefined){ensure(typeof body.name==='string'&&body.name.trim()&&body.name.length<=200,'Nombre de servicio inválido.');current.name=body.name.trim();}
 if(body.code!==undefined){ensure(typeof body.code==='string'&&body.code.length<=80,'Código inválido.');current.code=body.code.trim();}
 if(body.price!==undefined){ensure(typeof body.price==='number'&&moneyCents(body.price)>=0&&body.price<=999999999,'Precio inválido.');current.price=body.price;}
 // Los consumibles se declaran aquí; su existencia se valida al prestar el servicio, en la sucursal de la sesión.
 current.serviceDefinition={...definition,changeReason:body.reason.trim(),changedAt:new Date().toISOString()};
 if(definition.enabled){current.vatRate=definition.vatRate;current.unit=definition.billingUnit;}
 return current.id;
}

export function validateConfiguredServices(data,employees=data.employees){
 for(const product of data.products||[])if(product.serviceDefinition!==undefined){
  const definition=validateServiceDefinition({...data,employees},product.id,product.serviceDefinition);
  ensure(!definition.enabled||(product.vatRate===definition.vatRate&&product.unit===definition.billingUnit),'Edita el IVA y la unidad desde la configuración del servicio.');
 }
}

// Calcula un plan antes de alterar stock. Una venta mixta comparte el mismo control de disponibilidad.
export function serviceConsumptionPlan(data,items){
 if(!(items||[]).some(row=>data.products.find(p=>p.id===row.p&&p.kind==='service')?.serviceDefinition?.enabled))return {rows:[],totalCents:0,services:[]};
 const demand=new Map(),serviceQuantities=new Map(),sold=new Map();
 for(const row of items||[]){const q=quantity(Number(row.q));sold.set(row.p,(sold.get(row.p)||0)+q);}
 const add=(pid,q)=>demand.set(pid,(demand.get(pid)||0)+Math.round(q*1000));
 const visit=(p,q)=>{
  const def=p?.serviceDefinition;if(p?.kind!=='service'||!def?.enabled)return;
  ensure(def.version===1,'Versión de servicio no admitida.');
  serviceQuantities.set(p.id,(serviceQuantities.get(p.id)||0)+q);
  for(const row of def.consumables||[])add(row.p,quantity(row.q*q));
  for(const row of def.components||[]){const component=data.products.find(p=>p.id===row.p);ensure(component?.kind==='service'&&!component.serviceDefinition?.components?.length,'Componente inválido o paquete anidado.');visit(component,quantity(row.q*q));}
 };
 for(const [pid,q]of sold)visit(data.products.find(p=>p.id===pid),quantity(Math.round(q*1000)/1000));
 const rows=[];let totalCents=0;
 for(const [pid,milli]of demand){
  const p=data.products.find(p=>p.id===pid),q=milli/1000;
  ensure(p&&p.kind!=='service'&&Number.isSafeInteger(milli)&&q<=1000000,'Consumible inválido.');
  const soldQuantity=sold.get(pid)||0;
  const reserved=(data.businessRecords||[]).filter(r=>r.module==='rutas'&&r.consignment&&r.status==='Preparada'&&!r.entryId).flatMap(r=>r.items||[]).filter(i=>i.p===pid).reduce((s,i)=>s+i.q,0);
  ensure(p.stock+0.000000001>=q+soldQuantity+reserved,'No hay existencias libres suficientes para los consumibles del servicio.');
  ensure(!(data.businessRecords||[]).some(r=>r.productId===pid&&(['lotes','produccion'].includes(r.module)||(r.module==='variantes'&&r.serial))),'No se permite usar como consumible un artículo con lotes, series o producción. Selecciona un insumo libre de esa trazabilidad; no se descontó inventario.');
  const costCents=serviceLineCostCents(p.cost,q);totalCents+=costCents;ensure(Number.isSafeInteger(totalCents),'El costo supera el rango seguro.');
  rows.push({pid,q,unit:p.unit||'unidad',unitCost:p.cost,costCents});
 }
 return {rows,totalCents,services:[...serviceQuantities].map(([p,q])=>({p,q}))};
}

export function serviceSaleSnapshot(data,items,employeeId){
 if(employeeId)ensure(data.employees?.some(e=>e.id===employeeId&&e.active!==false),'Selecciona un empleado de la sucursal.');
 return items.filter(i=>i.service&&data.products.find(p=>p.id===i.p)?.serviceDefinition?.enabled).map(i=>{
  const definition=structuredClone(data.products.find(p=>p.id===i.p).serviceDefinition);
  const basisPoints=employeeId?(definition.employeeCommissions.find(e=>e.employeeId===employeeId)?.basisPoints??definition.commissionBasisPoints):definition.commissionBasisPoints;
  const baseCents=serviceLineCostCents(i.u,i.q);
  return {productId:i.p,q:i.q,definition,...(employeeId?{employeeId}:{}),commissionCents:serviceCommissionCents(baseCents,basisPoints),baseCents};
 });
}

export function projectServiceProduct(product,personal,employeeIds=null){
 const copy=structuredClone(product);
 if(!personal&&copy.serviceDefinition)delete copy.serviceDefinition.employeeCommissions;
 else if(employeeIds&&copy.serviceDefinition?.employeeCommissions)copy.serviceDefinition.employeeCommissions=copy.serviceDefinition.employeeCommissions.filter(row=>employeeIds.has(row.employeeId));
 return copy;
}
export function projectServiceEntry(entry,personal,employeeIds=null){
 if(!entry.serviceSnapshots||(personal&&!employeeIds))return entry;
 const copy=structuredClone(entry);
 for(const row of copy.serviceSnapshots){
  if(!personal){delete row.employeeId;delete row.commissionCents;delete row.definition.employeeCommissions;delete row.definition.commissionBasisPoints;}
  else {
   if(row.definition.employeeCommissions)row.definition.employeeCommissions=row.definition.employeeCommissions.filter(e=>employeeIds.has(e.employeeId));
   if(row.employeeId&&!employeeIds.has(row.employeeId)){delete row.employeeId;delete row.commissionCents;}
  }
 }
 return copy;
}
