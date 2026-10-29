import {randomUUID} from 'node:crypto';
import {catalog} from './business-profile.mjs';
import {invoiceTotals,normalizeItemQuantity,businessLoanSchedule,businessCommission,businessLateCharge,businessBillItems,businessContractLateItems,moneyCents} from './accounting-engine.mjs';
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const round=v=>Math.round(v*100)/100;
const qty=v=>Number(v)===0?0:normalizeItemQuantity(v);
const sameDay=(day,delta)=>new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);
function nextDate(day,frequency,n){if(frequency==='mensual'){const d=new Date(day+'T12:00:00Z'),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n+1,0)).getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);d.setUTCDate(Math.min(+day.slice(8),last));return d.toISOString().slice(0,10)}return sameDay(day,n*({diaria:1,semanal:7,quincenal:15}[frequency]||0))}
const flows={cuentas_abiertas:['Abierta','Cerrada'],agenda:['Pendiente','Confirmada','Atendida','Cancelada'],proyectos:['Recibida','Diagnóstico','Presupuestada','En proceso','Entregada','Cancelada'],lotes:['Disponible','Agotado'],variantes:['Disponible','Vendida'],produccion:['Activa','Inactiva'],medidas:['Pendiente','Facturada'],cartera:['Borrador','Vigente','Liquidada'],contratos:['Activo','Suspendido','Finalizado'],reservas:['Reservada','Ocupada','Finalizada','Cancelada'],rutas:['Preventa','Preparada','Entregada','Cancelada'],despacho:['Recibido','Preparando','Listo','Entregado','Cancelado'],comisiones:['Pendiente','Liquidada'],aportes:['Pendiente','Registrado'],documentos_venta:['Pendiente','Convertido','Cancelado'],comprobantes:['Pendiente']};
export const BUSINESS_OPS=['businessProduct','businessCost','businessPurchase','businessConsume','businessSave','businessState','businessBill','businessAdvance','businessRefund','businessMove','businessMerge','businessSplit','businessProduce','businessDisburse','businessCollect','businessAccrue','businessGenerate','businessCheckin','businessCheckout','businessCommission','businessLiquidate','businessDonate','businessRelease','businessOnboard'];
export function validateBusinessRecords(data,check){
 if(data.businessRecords===undefined)return;
 check(Array.isArray(data.businessRecords)&&data.businessRecords.length<=20000,'Registros de negocio inválidos.');const ids=new Set();
 for(const r of data.businessRecords){
  check(r&&typeof r.id==='string'&&/^[a-z0-9-]{1,80}$/.test(r.id)&&!ids.has(r.id)&&catalog.all.includes(r.module),'Registro de negocio inválido o duplicado.');ids.add(r.id);
  check(typeof r.name==='string'&&r.name.trim()&&r.name.length<=200&&flows[r.module].includes(r.status),'Nombre o estado de negocio inválido.');
  check(/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&Number.isFinite(Date.parse(r.date)),'Fecha de negocio inválida.');
  for(const k of ['total','principal','interest','penalty','paid','deposit','valuation','cost','price'])if(r[k]!==undefined)check(moneyCents(r[k])>=0,'Importe de negocio negativo.');
  if(r.q!==undefined)check(Number.isFinite(r.q)&&r.q>=0&&r.q<=1e9,'Cantidad de negocio inválida.');
  for(const key of ['items','ingredients'])if(r[key]!==undefined){check(Array.isArray(r[key])&&r[key].length<=200,'Líneas de negocio inválidas.');for(const i of r[key])check(data.products.some(p=>p.id===i.p)&&Number.isFinite(i.q)&&i.q>0&&moneyCents(i.u)>=0,'Producto o línea de negocio inválidos.');}
  if(r.entryId)check(data.entries.some(e=>e.id===r.entryId),'Conserva el asiento vinculado al registro de negocio.');
  if(r.schedule)for(const row of r.schedule){for(const key of ['principal','interest','total','paid','penalty','balance','interestPaid'])if(row[key]!==undefined)check(moneyCents(row[key])>=0,'Cuota inválida.');check(moneyCents(row.total)===moneyCents(row.principal)+moneyCents(row.interest),'La cuota no coincide con capital e interés.');}
 }
}
function makeItems(data,items,ctx){ctx.check(Array.isArray(items)&&items.length<=200,'Lista de consumos inválida.');return items.map(i=>{const p=data.products.find(p=>p.id===i.p),q=qty(i.q);ctx.check(p&&q>0&&q<=1e6,'Producto o cantidad inválida.');return {p:p.id,q,u:ctx.amount(i.u??p.price,true),vatRate:p.vatRate||0,unit:p.unit||'unidad',name:p.name}})}
function ensureResource(data,r,ctx){
 if(!['agenda','reservas'].includes(r.module))return;
 ctx.check(r.resource&&r.start&&r.end&&Date.parse(r.end)>Date.parse(r.start),'Revisa recurso, inicio y fin.');
 ctx.check(!data.businessRecords.some(o=>o.id!==r.id&&o.module===r.module&&o.resource.toLowerCase()===r.resource.toLowerCase()&&!['Cancelada','Finalizada'].includes(o.status)&&o.start<r.end&&o.end>r.start),'El recurso ya tiene una reserva o cita en ese horario.');
}
function produce(data,access,session,recipe,n,ctx){
 ctx.permit(access,'produccion',true);ctx.permit(access,'inventario',true);ctx.check(recipe.status==='Activa'&&n>0,'Receta o cantidad inválida.');
 const output=data.products.find(p=>p.id===recipe.productId);ctx.check(output&&output.kind!=='service','Selecciona un producto inventariable.');
 const stock=[],amounts=[];for(const i of recipe.ingredients){const p=data.products.find(p=>p.id===i.p),q=qty(i.q*n/recipe.yield*(1+recipe.waste/100));ctx.check(p&&p.id!==output.id&&p.kind!=='service'&&p.stock>=q,'Insumo inexistente o insuficiente.');const lots=data.businessRecords.filter(r=>r.module==='lotes'&&r.productId===p.id);if(lots.length){ctx.permit(access,'lotes',true);let remaining=q;for(const lot of lots.filter(r=>r.status==='Disponible'&&r.due>=ctx.body.date).sort((a,b)=>a.due.localeCompare(b.due))){const used=Math.min(lot.q,remaining);if(used>0){lot.q=qty(lot.q-used);remaining=qty(remaining-used);if(!lot.q)lot.status='Agotado';recipe.events.push({date:ctx.body.date,action:'Insumo de lote',lotId:lot.id,q:used});}}ctx.check(remaining===0,'No hay lotes vigentes suficientes para producir.');}ctx.check(!data.businessRecords.some(r=>r.module==='variantes'&&r.serial&&r.productId===p.id),'Los insumos con serie requieren selección individual y no se consumen automáticamente.');p.stock=qty(p.stock-q);stock.push({pid:p.id,q:-q,unit:p.unit||'unidad',unitCost:p.cost});amounts.push(round(q*p.cost))}
 const cost=round(amounts.reduce((s,v)=>s+v,0));const oldValue=round(output.stock*output.cost),newStock=qty(output.stock+n);ctx.check(newStock>0,'Producción inválida.');const newCost=round((oldValue+cost)/newStock);ctx.check(newCost===output.cost||(access.company.data.products.find(p=>p.id===output.id)?.stock??output.stock)===output.stock,'El costo del terminado también afecta otras sucursales; revisa la producción con el contador.');const valuation=round(newStock*newCost-oldValue),difference=round(cost-valuation);
 output.stock=newStock;output.cost=newCost;stock.push({pid:output.id,q:n,unit:output.unit||'unidad',unitCost:newCost,productionAdjustment:{amountCents:moneyCents(round(valuation-round(n*newCost))),reason:'Diferencia de valoración del saldo anterior'}});
 const lines=[{a:'1301',d:valuation,c:0},{a:'1301',d:0,c:cost}];
 if(difference){ctx.check(data.accounts.some(a=>a.code===recipe.varianceAccount&&['costo','gasto','ingreso'].includes(a.tipo)),'Configura la cuenta de diferencia de costo.');lines.push({a:recipe.varianceAccount,d:difference>0?difference:0,c:difference<0?-difference:0})}
 return ctx.entry(data,session,{date:ctx.date(ctx.body.date),type:'produccion',desc:'Producción · '+recipe.name,total:cost,stock,lines,businessId:recipe.id,project:ctx.body.project||recipe.project||''});
}
// Solo se ejecuta para productos expresamente configurados; los históricos no cambian.
export function prepareBusinessSale(data,access,session,body,ctx){
 const records=data.businessRecords||[],allocations=[];const demand=new Map();for(const i of body.items||[])demand.set(i.p,qty((demand.get(i.p)||0)+qty(i.q)));
 for(const [pid,q]of demand){
  const p=data.products.find(p=>p.id===pid);const reserved=records.filter(r=>r.id!==ctx.trustedSourceId&&r.module==='rutas'&&r.consignment&&r.status==='Preparada'&&!r.entryId).flatMap(r=>r.items||[]).filter(i=>i.p===pid).reduce((s,i)=>s+i.q,0);if(p&&p.kind!=='service'){ctx.check(p.stock-reserved>=q||records.some(r=>r.module==='produccion'&&r.productId===pid&&r.autoProduce&&r.status==='Activa'),'La existencia disponible está comprometida en consignación.');}

  const recipe=records.find(r=>r.module==='produccion'&&r.productId===pid&&r.autoProduce&&r.status==='Activa');if(recipe){const missing=qty(Math.max(0,q+reserved-(data.products.find(p=>p.id===pid)?.stock||0)));if(missing)produce(data,access,session,recipe,missing,{...ctx,body});}
  const lots=records.filter(r=>r.module==='lotes'&&r.productId===pid&&r.status==='Disponible'&&(!r.due||r.due>=body.date)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.date.localeCompare(b.date));
  if(records.some(r=>r.module==='lotes'&&r.productId===pid)){ctx.permit(access,'lotes',true);let remaining=q;for(const r of lots){const used=Math.min(remaining,r.q);if(used>0){r.q=qty(r.q-used);remaining=qty(remaining-used);allocations.push({id:r.id,q:used});if(!r.q)r.status='Agotado';r.events||=[];r.events.push({date:body.date,action:'Salida FEFO',q:used})}}ctx.check(remaining<=0,'No hay lotes vigentes suficientes para la venta.');}
  const serials=records.filter(r=>r.module==='variantes'&&r.productId===pid&&r.serial);
  if(serials.length){ctx.permit(access,'variantes',true);const chosen=(Array.isArray(body.serialIds)?body.serialIds:[]).filter(id=>serials.some(r=>r.id===id));ctx.check(Number.isInteger(q)&&new Set(chosen).size===q,'Selecciona una serie disponible por cada unidad.');for(const id of chosen){const r=serials.find(r=>r.id===id);ctx.check(r.status==='Disponible','Una serie ya fue vendida.');r.status='Vendida';r.events||=[];r.events.push({date:body.date,action:'Serie vendida'});allocations.push({id:r.id,q:1})}}
 }
 return allocations;
}
export async function businessOperation(data,access,session,body,context){
 const ctx={...context,body},op=body.operation,check=ctx.check,permit=m=>ctx.permit(access,m,true),records=data.businessRecords||=[];
 if(op==='businessProduct'){
  { ctx.permit(access,'inventario',true);check(access.branchId&&txt(body.name),'Selecciona sucursal y nombre.');data.products.push({id:randomUUID(),code:txt(body.code,80),name:txt(body.name),unit:txt(body.unit,40)||'servicio',kind:'service',category:txt(body.category,100),stock:0,min:0,cost:0,price:ctx.amount(body.price||0,true),vatRate:Number(body.vatRate||0)});const p=data.products.at(-1);check(Number.isFinite(p.vatRate)&&p.vatRate>=0&&p.vatRate<=100,'IVA inválido.');return p.id;}
 }
 if(op==='businessOnboard'){
  check(access.owner&&!access.company.onboardingDone&&(!body.seed||(!data.entries.length&&!data.products.length)),'El arranque solo se aplica a empresas nuevas sin catálogo ni movimientos.');permit('ajustes');
  if(body.seed){permit('inventario');const p=catalog.get(access.company.businessType);for(const example of p.startup.examples)data.products.push({id:randomUUID(),code:'EJ-'+String(data.products.length+1),name:example.name,unit:example.unit,category:example.category,kind:example.kind,cost:0,price:0,stock:0,min:0,vatRate:0});data.cfg.businessCategories=p.startup.categories;data.cfg.businessUnits=p.startup.units;}
  return {onboardingDone:true};
 }
 const module=body.module,existing=body.id?records.find(r=>r.id===body.id):null;
 check(catalog.all.includes(module)&&(!body.id||existing?.module===module),'Registro no encontrado.');permit(module);
 if(op!=='businessSave')check(existing,'Registro no encontrado.');
 if(body.date&&op!=='businessSave')check(ctx.date(body.date)>=existing.date,'La operación no puede ser anterior al registro.');
 const r=existing,confirmed=()=>check(body.confirmed===true,'Confirma la operación y su efecto contable.');
 const post=(lines,total,description,extra={})=>{check(ctx.date(body.date)>=r.date,'La operación no puede ser anterior al registro.');permit('contabilidad');permit('cajas');ctx.financialCash(access);confirmed();check(lines.every(l=>data.accounts.some(a=>a.code===l.a)),'Selecciona cuentas existentes.');check(lines.every(l=>!['1104','2107'].includes(l.a)&&!l.a.startsWith('1103-')),'Los turnos y caja chica se operan desde sus módulos.');check(moneyCents(lines.reduce((s,l)=>s+l.d,0))===moneyCents(lines.reduce((s,l)=>s+l.c,0)),'Asiento descuadrado.');return ctx.entry(data,session,{date:ctx.date(body.date),type:'negocio-'+module,desc:description,total,reference:txt(body.reference)||'NEG-'+r.id.slice(0,8),businessId:r.id,project:r.project||r.fund||'',lines,...extra})};
 const acct=(code,type)=>{check(data.accounts.some(a=>a.code===code&&(!type||a.tipo===type)),'Selecciona una cuenta de '+(type||'contabilidad')+' válida.');return code};
 const cash=()=>{check(['1101','1102'].includes(body.pay),'Selecciona Caja general o Banco.');return acct(body.pay,'activo')};
 if(op==='businessSave'){
  check(module!=='comprobantes','Usa este módulo para imprimir registros existentes.');
  check(!existing||(!existing.entryId&&!existing.billed?.length&&!existing.events?.length&&!['Vigente','Liquidada','Cerrada','Convertido','Registrado','Vendida','Agotado','Finalizada'].includes(existing.status)),'Este registro ya tiene operaciones; conserva su historial.');
  const rec={id:existing?.id||randomUUID(),module,name:txt(body.name),date:ctx.date(body.date),kind:txt(body.kind||module,40),status:existing?.status||flows[module][0],branchId:access.branchId,customerId:txt(body.customerId,80),productId:txt(body.productId,80),resource:txt(body.resource),responsible:txt(body.responsible),project:txt(body.project),fund:txt(body.fund),note:txt(body.note,3000),due:body.due?ctx.date(body.due):'',events:existing?.events||[],paid:existing?.paid||0};
  check(rec.name&&access.branchId,'Escribe el nombre y selecciona una sucursal.');
  if(rec.customerId)check(data.customers.some(c=>c.id===rec.customerId),'Cliente inexistente.');
  if(rec.productId)check(data.products.some(p=>p.id===rec.productId),'Producto inexistente.');
  if(['cuentas_abiertas','agenda','proyectos','contratos','reservas','rutas','despacho','documentos_venta','medidas'].includes(module)){
   rec.items=makeItems(data,body.items||[],ctx);rec.total=invoiceTotals(rec.items).total;
   rec.serviceRate=Number(body.serviceRate||0);rec.serviceProductId=txt(body.serviceProductId,80);check(Number.isFinite(rec.serviceRate)&&rec.serviceRate>=0&&rec.serviceRate<=100,'Porcentaje de servicio inválido.');
   if(rec.serviceRate)check(data.products.some(p=>p.id===rec.serviceProductId&&p.kind==='service'),'Configura un producto de servicio para el cargo.');
   rec.serialIds=Array.isArray(body.serialIds)?body.serialIds.map(i=>txt(i,80)):[];
  }
  if(['agenda','reservas'].includes(module)){for(const key of ['start','end']){const t=new Date(body[key]);check(Number.isFinite(t.getTime()),'Horario inválido.');rec[key]=t.toISOString()}rec.timeZone=access.company.businessCustomization?.timeZone||'America/Managua';rec.reminder=txt(body.reminder,500);ensureResource(data,rec,ctx);rec.tariffs=Array.isArray(body.tariffs)?body.tariffs.slice(0,30).map(t=>({from:ctx.date(t.from),to:ctx.date(t.to),price:ctx.amount(t.price,true)})):[];check(rec.tariffs.every(t=>t.from<=t.to),'Temporada inválida.');rec.timeUnit=txt(body.timeUnit||'noche',20);rec.tariffProductId=txt(body.tariffProductId,80);}
  if(module==='proyectos'){rec.diagnosis=txt(body.diagnosis,2000);rec.stages=txt(body.stages,1000);rec.materials=txt(body.materials,2000);rec.labor=txt(body.labor,1000);rec.subcontractors=txt(body.subcontractors,1000);rec.vehicle=txt(body.vehicle,120);}
  if(module==='lotes'){
   permit('inventario');check(rec.productId&&rec.due,'Indica producto y vencimiento.');rec.lot=txt(body.lot);rec.q=qty(body.q);check(rec.lot&&rec.q>0,'Lote y cantidad inválidos.');rec.prescription=txt(body.prescription,1000);rec.cycle=txt(body.cycle,200);
   const assigned=records.filter(o=>o.module==='lotes'&&o.productId===rec.productId&&o.id!==rec.id).reduce((s,o)=>s+o.q,0);check(assigned+rec.q<=data.products.find(p=>p.id===rec.productId).stock,'El lote excede la existencia disponible. Registra la compra o producción primero.');
  }
  if(module==='variantes'){permit('inventario');check(rec.productId,'Selecciona producto.');for(const k of ['size','color','model','serial','warranty'])rec[k]=txt(body[k],200);check(!rec.serial||!(access.company.data.businessRecords||[]).some(o=>o.module===module&&(o.serial||'').toLowerCase()===rec.serial.toLowerCase()&&o.id!==rec.id),'La serie ya está registrada.');}
  if(module==='produccion'){
   permit('inventario');rec.status=existing?.status||'Activa';check(rec.productId,'Selecciona el producto terminado.');rec.yield=qty(body.yield);rec.waste=Number(body.waste||0);check(rec.yield>0&&Number.isFinite(rec.waste)&&rec.waste>=0&&rec.waste<=100,'Rendimiento o merma inválidos.');rec.autoProduce=body.autoProduce===true;rec.varianceAccount=txt(body.varianceAccount,80);rec.ingredients=makeItems(data,body.ingredients||[],ctx).map(i=>({...i,u:data.products.find(p=>p.id===i.p).cost}));check(data.products.find(p=>p.id===rec.productId)?.kind!=='service','El terminado debe manejar inventario.');check(rec.ingredients.length&&rec.ingredients.every(i=>i.p!==rec.productId&&data.products.find(p=>p.id===i.p)?.kind!=='service'),'Define insumos diferentes al producto terminado.');check(!records.some(o=>o.id!==rec.id&&o.module==='produccion'&&o.productId===rec.productId&&o.status==='Activa'),'Ya hay una receta activa para ese producto.');
  }
  if(module==='medidas'){rec.gross=qty(body.gross);rec.tare=qty(body.tare||0);check(rec.gross>rec.tare&&rec.tare>=0&&rec.productId,'Peso bruto, tara o producto inválidos.');const p=data.products.find(p=>p.id===rec.productId);rec.items=makeItems(data,[{p:p.id,q:qty(rec.gross-rec.tare),u:body.price??p.price}],ctx);rec.total=invoiceTotals(rec.items).total;}
  if(module==='cartera'){
   rec.principal=ctx.amount(body.principal);rec.rate=Number(body.rate);rec.periods=Number(body.periods);rec.method=txt(body.method);rec.frequency=txt(body.frequency);check(['diaria','semanal','quincenal','mensual'].includes(rec.frequency),'Frecuencia inválida.');rec.lateRate=Number(body.lateRate||0);check(Number.isFinite(rec.lateRate)&&rec.lateRate>=0&&rec.lateRate<=100,'Tasa diaria de mora inválida.');
   rec.schedule=businessLoanSchedule(rec).map(row=>({...row,due:nextDate(rec.date,rec.frequency,row.number)}));rec.total=round(rec.schedule.reduce((s,row)=>s+row.total,0));
   for(const k of ['principalAccount','interestAccount'])rec[k]=acct(body[k],'activo');for(const k of ['incomeAccount','lateAccount'])rec[k]=acct(body[k],'ingreso');check(!['1101','1102','1104','1201','1301','1202'].includes(rec.principalAccount)&&!['1101','1102','1104','1201','1301','1202'].includes(rec.interestAccount),'Crea subcuentas de activo exclusivas para cartera e intereses por cobrar; no uses caja, clientes ni inventario.');check(new Set([rec.principalAccount,rec.interestAccount,rec.incomeAccount,rec.lateAccount]).size===4,'Usa cuentas distintas para capital, interés e ingresos.');
   rec.collateral=txt(body.collateral,1000);rec.valuation=ctx.amount(body.valuation||0,true);rec.collateralDue=body.collateralDue?ctx.date(body.collateralDue):'';
  }
  if(module==='contratos'){rec.frequency=txt(body.frequency);check(['diaria','semanal','quincenal','mensual'].includes(rec.frequency),'Frecuencia inválida.');rec.periods=Number(body.periods);check(Number.isInteger(rec.periods)&&rec.periods>0&&rec.periods<=600,'Plazo inválido.');check(rec.items.length,'Agrega el concepto de cobro.');rec.lateRate=Number(body.lateRate||0);check(Number.isFinite(rec.lateRate)&&rec.lateRate>=0&&rec.lateRate<=100,'Mora inválida.');rec.reminder=txt(body.reminder,500);rec.lateProductId=txt(body.lateProductId,80);rec.suspendAfter=Number(body.suspendAfter||0);check(Number.isInteger(rec.suspendAfter)&&rec.suspendAfter>=0&&rec.suspendAfter<=3650,'Días para suspensión inválidos.');}
  if(module==='rutas'){rec.employeeId=txt(body.employeeId,80);rec.route=txt(body.route);rec.seller=txt(body.seller);rec.consignment=body.consignment===true;rec.commissionRate=Number(body.commissionRate||0);check(Number.isFinite(rec.commissionRate)&&rec.commissionRate>=0&&rec.commissionRate<=100,'Comisión inválida.');}
  if(module==='despacho'){rec.delivery=txt(body.delivery,1000);rec.kind=['llevar','domicilio','local'].includes(body.kind)?body.kind:'llevar';rec.ticket=existing?.ticket||Math.max(0,...records.filter(o=>o.module===module).map(o=>o.ticket||0))+1;}
  if(module==='comisiones'){rec.employeeId=txt(body.employeeId,80);check(data.employees.some(e=>e.id===rec.employeeId&&e.active!==false),'Selecciona un empleado activo.');rec.rate=Number(body.rate);rec.saleId=txt(body.saleId,80);check(Number.isFinite(rec.rate)&&rec.rate>=0&&rec.rate<=100,'Comisión inválida.');}
  if(module==='aportes'){rec.total=ctx.amount(body.total);rec.donor=txt(body.donor);check(rec.donor&&rec.fund,'Indica donante o socio y fondo/proyecto.');rec.incomeAccount=acct(body.incomeAccount,'ingreso');}
  if(existing)Object.assign(existing,rec);else records.push(rec);return rec.id;
 }
 if(op==='businessState'){
  const next=txt(body.status);check(flows[module].includes(next),'Estado inválido.');
  const states=({agenda:['Pendiente','Confirmada','Atendida','Cancelada'],proyectos:['Recibida','Diagnóstico','Presupuestada','En proceso','Entregada','Cancelada'],produccion:['Activa','Inactiva'],contratos:['Activo','Suspendido','Finalizado'],rutas:['Preventa','Preparada','Entregada','Cancelada'],despacho:['Recibido','Preparando','Listo','Entregado','Cancelado'],documentos_venta:['Pendiente','Cancelado']})[module];check(states&&states.includes(next),'Usa la acción específica para este estado.');check(!r.deposit||!['Cancelada','Cancelado','Finalizado'].includes(next),'Devuelve o aplica el depósito antes de cerrar.');check(!r.entryId||!['Cancelada','Cancelado'].includes(next),'Corrige primero el documento contable con su operación de anulación o devolución.');
  if(module==='rutas'&&next==='Entregada')check(r.entryId,'Factura la entrega antes de marcarla entregada.');
  if(['Finalizado','Cancelada','Cancelado'].includes(r.status))check(false,'El registro está finalizado.');
  if(module==='contratos'&&next==='Activo'&&r.status==='Finalizado')check(false,'Contrato finalizado.');
  if(module==='rutas'&&next==='Preparada'&&r.consignment){const allItems=records.filter(o=>o.module==='rutas'&&o.consignment&&(o.id===r.id||o.status==='Preparada')&&!o.entryId).flatMap(o=>o.items||[]);for(const p of data.products.filter(p=>p.kind!=='service'))check(allItems.filter(i=>i.p===p.id).reduce((s,i)=>s+i.q,0)<=p.stock,'La consignación excede la existencia disponible.');}
  r.status=next;if(module==='agenda'&&next!=='Cancelada')ensureResource(data,r,ctx);r.events.push({date:new Date().toISOString(),action:next,actor:session.email});return r.id;
 }
 if(op==='businessProduce'){confirmed();check(module==='produccion','Receta inválida.');const n=qty(body.q);check(n>0&&n<=1e6,'Cantidad inválida.');const e=produce(data,access,session,r,n,ctx);r.events.push({date:e.date,action:'Producción',entryId:e.id,q:n});return e.id;}
 if(op==='businessPurchase'){
  check(module==='proyectos','Selecciona una obra o proyecto.');confirmed();permit('compras');const purchase=data.entries.find(e=>e.id===body.purchaseId&&e.type==='compra');check(purchase,'Compra no encontrada.');check(!records.some(o=>(o.purchaseIds||[]).includes(purchase.id)),'La compra ya está vinculada a un proyecto.');r.purchaseIds||=[];r.purchaseIds.push(purchase.id);r.events.push({date:ctx.date(body.date),action:'Compra vinculada',entryId:purchase.id});return purchase.id;
 }
 if(op==='businessCost'){
  check(['proyectos','lotes','produccion','reservas','contratos','rutas','aportes'].includes(module),'Este registro no admite costos asociados.');confirmed();permit('costos');check(['1101','1102','2101'].includes(body.pay),'Usa Caja general, Banco o Crédito.');const cost=ctx.registerCost(data,access,session,body),entry=data.entries.find(e=>e.id===cost.entryId);entry.businessId=r.id;entry.project=r.project||r.fund||r.id;cost.businessId=r.id;r.events.push({date:entry.date,action:'Costo asociado',entryId:entry.id,total:cost.total});return entry.id;
 }
 if(op==='businessConsume'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId,'Cuenta cerrada.');const added=makeItems(data,body.items||[],ctx);check(added.length&&r.items.length+added.length<=200,'Agrega consumos (máximo 200 líneas por cuenta).');r.items.push(...added);r.total=invoiceTotals(r.items).total;r.events.push({date:new Date().toISOString(),action:'Consumo agregado'});return r.id;
 }
 if(op==='businessMove'){check(module==='cuentas_abiertas'&&r.status==='Abierta','Cuenta no disponible.');r.resource=txt(body.resource);r.responsible=txt(body.responsible);check(r.resource,'Indica destino.');r.events.push({date:new Date().toISOString(),action:'Traslado',resource:r.resource,responsible:r.responsible});return r.id;}
 if(op==='businessMerge'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId&&!r.deposit,'Cuenta no disponible para unir.');const other=records.find(o=>o.id===body.targetId&&o.module===module&&o.id!==r.id);check(other&&other.status==='Abierta'&&!other.entryId&&!other.deposit&&other.serviceRate===r.serviceRate&&other.serviceProductId===r.serviceProductId,'Selecciona otra cuenta abierta sin anticipos y con el mismo cargo por servicio.');other.items.push(...r.items);other.total=invoiceTotals(other.items).total;r.items=[];r.total=0;r.status='Cerrada';r.mergedInto=other.id;r.events.push({date:new Date().toISOString(),action:'Unión',targetId:other.id});return other.id;
 }
 if(op==='businessSplit'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId&&!r.deposit,'Cuenta no disponible para dividir.');
  const requested=Array.isArray(body.splitItems)?body.splitItems:(Array.isArray(body.indices)?body.indices.map(index=>({index,q:r.items[index]?.q})):[]),seen=new Set(),moved=[];
  for(const request of requested){const index=request.index,q=qty(request.q);check(Number.isInteger(index)&&index>=0&&index<r.items.length&&!seen.has(index),'Línea de división inválida.');seen.add(index);if(!q)continue;const item=r.items[index];check(q<=item.q,'La cantidad supera el consumo.');moved.push({...item,q});item.q=qty(item.q-q);}
  check(moved.length&&r.items.some(i=>i.q>0),'Conserva consumos en ambas cuentas.');r.items=r.items.filter(i=>i.q>0);const target={...structuredClone(r),id:randomUUID(),name:txt(body.name)||r.name+' · separada',items:moved,events:[]};r.total=invoiceTotals(r.items).total;target.total=invoiceTotals(target.items).total;records.push(target);r.events.push({date:new Date().toISOString(),action:'División',targetId:target.id});return target.id;
 }
 if(op==='businessRefund'){
  check(r.deposit>0&&r.depositAccount,'No hay depósito por devolver.');const total=ctx.amount(body.total);check(moneyCents(total)<=moneyCents(r.deposit),'La devolución supera el depósito pendiente.');const e=post([{a:r.depositAccount,d:total,c:0},{a:cash(),d:0,c:total}],total,'Devolución de depósito · '+r.name);r.deposit=round(r.deposit-total);r.events.push({date:e.date,action:'Depósito devuelto',entryId:e.id,total});return e.id;
 }
 if(op==='businessAdvance'){
  check(['cuentas_abiertas','agenda','proyectos','reservas','documentos_venta'].includes(module)&&!r.entryId&&!['Cancelada','Cancelado','Cerrada','Finalizada'].includes(r.status),'No admite anticipos.');const total=ctx.amount(body.total),liability=acct(body.liability,'pasivo');check(!r.depositAccount||r.depositAccount===liability,'Conserva la cuenta del anticipo original.');const e=post([{a:cash(),d:total,c:0},{a:liability,d:0,c:total}],total,'Anticipo / depósito · '+r.name);r.deposit=round((r.deposit||0)+total);r.depositAccount=liability;r.events.push({date:e.date,action:'Anticipo',entryId:e.id,total});return e.id;
 }
 if(op==='businessBill'||op==='businessGenerate'){
  check(['cuentas_abiertas','agenda','proyectos','contratos','reservas','rutas','despacho','documentos_venta','medidas','variantes'].includes(module),'Registro no facturable.');confirmed();
  check(!['Cancelada','Cancelado','Cerrada','Finalizada','Finalizado','Suspendido'].includes(r.status),'Registro cerrado, suspendido o cancelado.');
  check(module==='proyectos'||module==='contratos'||!r.entryId,'Este registro ya está facturado.');
  let items=structuredClone(r.items||[]),key='final',period;if(module==='variantes')check(r.status==='Disponible','Serie no disponible.');
  if(module==='contratos'){
   check(op==='businessGenerate'&&r.status==='Activo','Contrato no disponible.');period=Number(body.period);check(Number.isInteger(period)&&period>=1&&period<=r.periods,'Período inválido.');key='periodo-'+period;const due=nextDate(r.date,r.frequency,period);check(body.date>=due,'No genera períodos futuros.');
   if(r.suspendAfter)check(!(r.billed||[]).some(b=>b.due&&body.date>sameDay(b.due,r.suspendAfter)&&data.entries.filter(e=>e.id===b.entryId||e.invoiceId===b.entryId).reduce((s,e)=>s+e.lines.filter(l=>l.a==='1201').reduce((s,l)=>s+l.d-l.c,0),0)>0.005),'El contrato supera la mora configurada; revisa los cobros y la suspensión.');
  }
  if(module==='proyectos'){key=txt(body.milestone,80);check(key,'Indica la etapa de facturación.');items=makeItems(data,body.items||[],ctx);}
  check(!(r.billed||[]).some(b=>b.key===key),'Este período o etapa ya fue facturado.');
  items=businessBillItems(r,data.products,module==='proyectos'?items:undefined);
  const late=businessContractLateItems(r,data.entries,data.products,body.date),lateUpdates=late.updates;items.push(...late.items);
  const bill=await ctx.sale({...body,discount:0,sourceQuotation:undefined,items,serialIds:module==='variantes'&&r.serial?[r.id]:(Array.isArray(body.serialIds)?body.serialIds:r.serialIds||[]),date:ctx.date(body.date),due:module==='contratos'?nextDate(r.date,r.frequency,period):body.due||body.date,customerId:r.customerId,party:r.name},r.id);
  for(const billed of lateUpdates)billed.lateThrough=body.date;
  r.billed||=[];r.billed.push({key,entryId:bill.id,total:bill.total,due:bill.due});r.entryId=bill.id;
  if(r.deposit){check(bill.pay==='1201'&&moneyCents(r.deposit)<=moneyCents(bill.creditAmount),'Para aplicar el anticipo factura a crédito; el anticipo no puede superar el crédito de esta factura.');const e=post([{a:r.depositAccount,d:r.deposit,c:0},{a:'1201',d:0,c:r.deposit}],r.deposit,'Aplicación de anticipo · '+r.name,{invoiceId:bill.id});r.events.push({date:e.date,action:'Aplicación de anticipo',entryId:e.id,total:r.deposit});r.deposit=0;}
  if(module==='rutas'&&r.commissionRate){permit('comisiones');permit('personal');check(data.employees.some(e=>e.id===r.employeeId&&e.active!==false),'Asigna al vendedor como empleado antes de generar la comisión.');records.push({id:randomUUID(),module:'comisiones',kind:'ruta',name:'Comisión · '+r.name,date:bill.date,status:'Pendiente',branchId:access.branchId,employeeId:r.employeeId,saleId:bill.id,rate:r.commissionRate,events:[],paid:0});}
  if(['cuentas_abiertas','documentos_venta','medidas','variantes'].includes(module))r.status=({cuentas_abiertas:'Cerrada',documentos_venta:'Convertido',medidas:'Facturada',variantes:'Vendida'})[module];return bill.id;
 }
 if(op==='businessCheckin'){check(module==='reservas'&&r.status==='Reservada','Reserva no disponible.');ensureResource(data,r,ctx);r.status='Ocupada';r.events.push({date:new Date().toISOString(),action:'Entrada'});return r.id;}
 if(op==='businessCheckout'){check(module==='reservas'&&r.status==='Ocupada'&&r.entryId&&!r.deposit,'Factura y aplica el depósito antes de cerrar.');r.status='Finalizada';r.events.push({date:new Date().toISOString(),action:'Salida'});return r.id;}
 if(op==='businessDisburse'){
  check(module==='cartera'&&r.status==='Borrador'&&!r.entryId,'Crédito ya desembolsado.');check(body.date===r.date,'El desembolso debe tener la fecha del plan; corrige el borrador si cambia.');const e=post([{a:r.principalAccount,d:r.principal,c:0},{a:cash(),d:0,c:r.principal}],r.principal,'Desembolso · '+r.name);r.entryId=e.id;r.status='Vigente';return e.id;
 }
 if(op==='businessAccrue'){
  check(module==='cartera'&&r.status==='Vigente','Crédito no vigente.');const when=ctx.date(body.date);let totalCents=0;const lines=[];
  for(const row of r.schedule.filter(row=>row.due<=when&&moneyCents(row.total+row.penalty)>moneyCents(row.paid))){const interest=row.accrued?0:row.interest,days=Math.max(0,Math.floor((Date.parse(when)-Date.parse(row.due))/86400000)),penalty=Math.max(0,businessLateCharge(row.principal,r.lateRate,days)-row.penalty);if(interest){lines.push({a:r.interestAccount,d:interest,c:0},{a:r.incomeAccount,d:0,c:interest});totalCents+=moneyCents(interest)}if(penalty){lines.push({a:r.interestAccount,d:penalty,c:0},{a:r.lateAccount,d:0,c:penalty});totalCents+=moneyCents(penalty)}row.accrued=true;row.penalty=round(row.penalty+penalty);}
  check(totalCents>0,'No hay intereses o mora nuevos para devengar.');const e=post(lines,totalCents/100,'Devengo de cartera · '+r.name);r.events.push({date:when,action:'Devengo',entryId:e.id,total:totalCents/100});return e.id;
 }
 if(op==='businessCollect'){
  check(module==='cartera'&&r.status==='Vigente','Crédito no vigente.');const when=ctx.date(body.date),index=r.schedule.findIndex(row=>moneyCents(row.paid)<moneyCents(row.total+row.penalty));check(index>=0,'No hay cuotas pendientes.');const row=r.schedule[index];check(when>=r.date,'Cobro anterior al desembolso.');check(!r.lastPaidDate||when>=r.lastPaidDate,'Registra los cobros en orden cronológico.');
  const days=Math.max(0,Math.floor((Date.parse(when)-Date.parse(row.due))/86400000));const desired=businessLateCharge(row.principal,r.lateRate,days),extra=round(desired-row.penalty);const penalty=Math.max(0,extra);const accruedInterest=row.accrued?0:row.interest;
  const available=round(row.total+row.penalty+penalty-row.paid),total=ctx.amount(body.total);check(moneyCents(total)<=moneyCents(available),'El cobro supera el saldo de la primera cuota pendiente.');
  if(accruedInterest||penalty){const lines=[];if(accruedInterest)lines.push({a:r.interestAccount,d:accruedInterest,c:0},{a:r.incomeAccount,d:0,c:accruedInterest});if(penalty)lines.push({a:r.interestAccount,d:penalty,c:0},{a:r.lateAccount,d:0,c:penalty});const e=post(lines,round(accruedInterest+penalty),'Devengo de interés / mora · '+r.name);row.accrued=true;row.penalty=round(row.penalty+penalty);row.accrualIds||=[];row.accrualIds.push(e.id);}
  const interestRemaining=Math.max(0,moneyCents(row.interest+row.penalty)-moneyCents(row.interestPaid||0)),interestPaid=Math.min(moneyCents(total),interestRemaining)/100,capital=round(total-interestPaid),lines=[{a:cash(),d:total,c:0}];if(interestPaid)lines.push({a:r.interestAccount,d:0,c:interestPaid});if(capital)lines.push({a:r.principalAccount,d:0,c:capital});const e=post(lines,total,'Cobro de cuota '+row.number+' · '+r.name);row.paid=round(row.paid+total);row.interestPaid=round((row.interestPaid||0)+interestPaid);r.paid=round(r.paid+total);r.lastPaidDate=when;r.events.push({date:when,action:'Cobro',entryId:e.id,total,principal:capital,interest:interestPaid,number:row.number});if(r.schedule.every(row=>moneyCents(row.paid)>=moneyCents(row.total+row.penalty)))r.status='Liquidada';return e.id;
 }
 if(op==='businessRelease'){
  check(module==='cartera'&&r.collateral&&r.status==='Liquidada'&&!r.collateralReleased,'Liquida el crédito antes de liberar la garantía.');confirmed();r.collateralReleased=true;r.events.push({date:ctx.date(body.date),action:'Garantía liberada',note:txt(body.note,1000)});return r.id;
 }
 if(op==='businessCommission'){
  check(module==='comisiones'&&!r.entryId,'Comisión ya calculada.');permit('personal');const sale=data.entries.find(e=>e.id===r.saleId&&e.type==='venta');check(sale&&!records.some(o=>o.id!==r.id&&o.module===module&&o.saleId===r.saleId&&o.employeeId===r.employeeId&&o.entryId),'Venta inexistente o comisión duplicada.');const returned=data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===sale.id).reduce((s,e)=>s+e.subtotal,0),total=businessCommission(Math.max(0,round(sale.subtotal-returned)),r.rate);check(total>0,'No hay comisión positiva.');r.expenseAccount=acct(body.expenseAccount,'gasto');r.liabilityAccount=acct(body.liabilityAccount,'pasivo');const e=post([{a:r.expenseAccount,d:total,c:0},{a:r.liabilityAccount,d:0,c:total}],total,'Comisión devengada · '+r.name);r.total=total;r.entryId=e.id;return e.id;
 }
 if(op==='businessLiquidate'){
  check(module==='comisiones'&&r.entryId&&r.status==='Pendiente','Comisión no liquidable.');permit('personal');const e=post([{a:r.liabilityAccount,d:r.total,c:0},{a:cash(),d:0,c:r.total}],r.total,'Liquidación de comisión · '+r.name);r.status='Liquidada';r.paid=r.total;r.events.push({date:e.date,action:'Liquidación',entryId:e.id,total:r.total});return e.id;
 }
 if(op==='businessDonate'){
  check(module==='aportes'&&r.status==='Pendiente'&&!r.entryId,'Aporte ya registrado.');const e=post([{a:cash(),d:r.total,c:0},{a:r.incomeAccount,d:0,c:r.total}],r.total,'Aporte · '+r.donor+' · '+r.fund);r.status='Registrado';r.entryId=e.id;r.paid=r.total;return e.id;
 }
 check(false,'Operación no disponible.');
}

export function restoreBusinessReturn(data,access,original,note,body,ctx){
 const allocations=original.businessAllocations||[];if(!allocations.length)return;
 const previous=data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===original.id&&e.id!==note.id).flatMap(e=>e.businessReturns||[]),saved=[];
 for(const item of note.items){
  let lotRemaining=item.q,serialRemaining=item.q;
  for(const a of allocations){const r=data.businessRecords?.find(r=>r.id===a.id);if(!r||r.productId!==item.p)continue;const already=previous.filter(p=>p.id===a.id).reduce((s,p)=>s+p.q,0)+saved.filter(p=>p.id===a.id).reduce((s,p)=>s+p.q,0),available=qty(Math.max(0,a.q-already));if(!available)continue;
   ctx.permit(access,r.module,true);
   if(r.module==='lotes'&&lotRemaining>0){const q=Math.min(available,lotRemaining);r.q=qty(r.q+q);r.status='Disponible';lotRemaining=qty(lotRemaining-q);saved.push({id:r.id,q});r.events.push({date:note.date,action:'Devolución al lote',entryId:note.id,q})}
   if(r.module==='variantes'&&serialRemaining>0){const candidate=(Array.isArray(body.returnSerialIds)?body.returnSerialIds:[]).includes(r.id);if(!candidate&&item.q!==allocations.filter(a=>{const serial=data.businessRecords.find(r=>r.id===a.id);return serial?.module==='variantes'&&serial.productId===item.p}).reduce((n,a)=>n+Math.max(0,a.q-previous.filter(p=>p.id===a.id).reduce((s,p)=>s+p.q,0)),0))continue;r.status='Disponible';serialRemaining=qty(serialRemaining-1);saved.push({id:r.id,q:1});r.events.push({date:note.date,action:'Serie devuelta',entryId:note.id})}
  }
  if(allocations.some(a=>data.businessRecords.find(r=>r.id===a.id)?.productId===item.p&&data.businessRecords.find(r=>r.id===a.id)?.module==='variantes'))ctx.check(serialRemaining===0,'Selecciona todas las series que se devuelven.');
 }
 note.businessReturns=saved;
}
