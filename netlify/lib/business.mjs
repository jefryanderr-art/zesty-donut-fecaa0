import {LENDING_OPS,lendingOperation} from './lending.mjs';
import {LODGING_OPS,lodgingOperation,lodgingInternal,lodgingEntry,lodgingExit} from './lodging.mjs';
import {operationalType} from './business-profile.mjs';
import {ORGANIZATION_OPS,organizationOperation,organizationRecord,validateOrganization} from './organizations.mjs';
import {SERVICE_OPS,serviceWorkflow,checkServiceBilling,serviceTimeBilling,checkServiceSchedule,validateServiceRecord} from './service-workflows.mjs';
import {commerceRecord,commerceReserve} from './commerce.mjs';
import {FOOD_WORKFLOW_OPS,foodWorkflow,foodAvailability} from './food-workflows.mjs';
import {deliveryZoneRecord} from './delivery.mjs';
import {diningRecord} from './food-service.mjs';
import {benefitRecord,validateBenefit} from './customer-benefits.mjs';
import {supervisor} from './policies.mjs';
import {saleContext} from './sale-context.mjs';
import {PERSONNEL_MODULES,validatePersonnelRecord} from './personnel.mjs';
import {ANALYSIS_MODULES,validateAnalysisRecord} from './analysis.mjs';
import {validateCertificateRecord} from './employment-certificates.mjs';
import {CLIENT_MODULES,validateClientRecord} from './client-rules.mjs';
import {TREASURY_MODULES,validateTreasuryRecord} from './treasury.mjs';
import {validateBankRecord} from './banks.mjs';
import {validateRecurringRecord} from './recurring.mjs';
import {FISCAL_MODULES,validateFiscalRecord} from './fiscal-rules.mjs';
import {INVENTORY_MODULES,validateInventoryRecord} from './inventory-advanced.mjs';
import {BUDGET_MODULES,validateBudgetRecord} from './budgets.mjs';
import {randomUUID} from 'node:crypto';
import {catalog} from './business-profile.mjs';
import {invoiceTotals,businessRecipePlan,normalizeItemQuantity,businessLoanSchedule,businessCommission,businessLateCharge,businessBillItems,businessContractLateItems,moneyCents} from './accounting-engine.mjs';
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const round=v=>Math.round(v*100)/100;
const qty=v=>Number(v)===0?0:normalizeItemQuantity(v);
const sameDay=(day,delta)=>new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);
function nextDate(day,frequency,n){if(frequency==='mensual'){const d=new Date(day+'T12:00:00Z'),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n+1,0)).getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);d.setUTCDate(Math.min(+day.slice(8),last));return d.toISOString().slice(0,10)}return sameDay(day,n*({diaria:1,semanal:7,quincenal:15}[frequency]||0))}
const flows={...Object.fromEntries(PERSONNEL_MODULES.map(m=>[m,['Activa','Inactiva','Pendiente','Aprobada','Rechazada','Pagada','Liquidada','Cancelada']])),...Object.fromEntries(ANALYSIS_MODULES.map(m=>[m,['Activa','Inactiva']])),constancias_laborales:['Activa','Inactiva'],presupuestos:['Activa','Inactiva','Archivada'],...Object.fromEntries(INVENTORY_MODULES.map(m=>[m,['Activa','Inactiva','Aplicado','Abierto','Abierta','Cerrada']])),...Object.fromEntries(CLIENT_MODULES.map(m=>[m,['Activa','Inactiva']])),...Object.fromEntries(FISCAL_MODULES.map(m=>[m,['Activa','Inactiva','Borrador','Emitido','Aceptado','Rechazado','Anulado','Abierta','Cerrada']])),...Object.fromEntries(TREASURY_MODULES.map(m=>[m,['Abierta','Cerrada','Aprobada','Rechazada','Pagada','Revertida']])),bancos:['Abierta','Cerrada'],suscripciones:['Activa','Pausada','Cancelada'],cuentas_abiertas:['Abierta','Cerrada'],agenda:['Pendiente','Confirmada','Atendida','Cancelada'],proyectos:['Recibida','Diagnóstico','Presupuestada','En proceso','Entregada','Cancelada'],lotes:['Disponible','Agotado'],variantes:['Disponible','Vendida','Baja'],produccion:['Activa','Inactiva'],medidas:['Pendiente','Facturada'],cartera:['Borrador','Vigente','Liquidada'],contratos:['Activo','Suspendido','Finalizado'],reservas:['Reservada','Ocupada','Finalizada','Cancelada'],rutas:['Preventa','Preparada','Entregada','Cancelada'],despacho:['Recibido','Preparando','Listo','Entregado','Cancelado','En camino','No entregado'],comisiones:['Pendiente','Liquidada'],aportes:['Pendiente','Registrado'],documentos_venta:['Pendiente','Convertido','Cancelado'],comprobantes:['Pendiente']};
export const BUSINESS_OPS=[...LENDING_OPS,...LODGING_OPS,...ORGANIZATION_OPS,...SERVICE_OPS,...FOOD_WORKFLOW_OPS,'businessVoidLine','businessDispatch','businessProduct','businessCost','businessPurchase','businessConsume','businessSave','businessState','businessBill','businessAdvance','businessRefund','businessMove','businessMerge','businessSplit','businessProduce','businessDisburse','businessCollect','businessAccrue','businessGenerate','businessCheckin','businessCheckout','businessCommission','businessLiquidate','businessDonate','businessRelease','businessOnboard'];
export function validateBusinessRecords(data,check){
 if(data.businessRecords===undefined)return;
 check(Array.isArray(data.businessRecords)&&data.businessRecords.length<=20000,'Registros de negocio inválidos.');const ids=new Set();
 for(const r of data.businessRecords){
  check(r&&typeof r.id==='string'&&/^[a-z0-9-]{1,80}$/.test(r.id)&&!ids.has(r.id)&&(catalog.all.includes(r.module)||r.module==='auditoria_revision'||benefitRecord(r)),'Registro de negocio inválido o duplicado.');ids.add(r.id);
  check(typeof r.name==='string'&&r.name.trim()&&r.name.length<=200&&(r.module==='auditoria_revision'?r.status==='Conservado':benefitRecord(r)?['Activa','Agotada','Devuelta'].includes(r.status):flows[r.module].includes(r.status)),'Nombre o estado de negocio inválido.');
  check(/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&Number.isFinite(Date.parse(r.date)),'Fecha de negocio inválida.');
  for(const k of ['total','principal','interest','penalty','paid','deposit','valuation','cost','price'])if(r[k]!==undefined)check(moneyCents(r[k])>=0,'Importe de negocio negativo.');
  validateOrganization(r,check);
  if(benefitRecord(r))validateBenefit(r,check);
  validateServiceRecord(r,check);
  if(r.q!==undefined)check(Number.isFinite(r.q)&&r.q>=0&&r.q<=1e9,'Cantidad de negocio inválida.');
  for(const key of ['items','ingredients'])if(!TREASURY_MODULES.includes(r.module)&&r[key]!==undefined){check(Array.isArray(r[key])&&r[key].length<=200,'Líneas de negocio inválidas.');for(const i of r[key])check(data.products.some(p=>p.id===i.p)&&Number.isFinite(i.q)&&i.q>0&&moneyCents(i.u)>=0,'Producto o línea de negocio inválidos.');}
  if(TREASURY_MODULES.includes(r.module))validateTreasuryRecord(r,data,check);
  if(CLIENT_MODULES.includes(r.module))validateClientRecord(r,check);
  if(FISCAL_MODULES.includes(r.module))validateFiscalRecord(r,check);
  if(INVENTORY_MODULES.includes(r.module))validateInventoryRecord(r,check);
  if(r.module==='constancias_laborales')validateCertificateRecord(r,check);
  if(PERSONNEL_MODULES.includes(r.module))validatePersonnelRecord(r);
  if(ANALYSIS_MODULES.includes(r.module))validateAnalysisRecord(r,check);
  if(BUDGET_MODULES.includes(r.module))validateBudgetRecord(r,check);
  if(r.module==='bancos')validateBankRecord(r,data,check);
  if(r.module==='suscripciones')validateRecurringRecord(r,data,check);
  if(r.entryId)check(data.entries.some(e=>e.id===r.entryId),'Conserva el asiento vinculado al registro de negocio.');
  if(r.schedule)for(const row of r.schedule){for(const key of ['principal','interest','total','paid','penalty','balance','interestPaid'])if(row[key]!==undefined)check(moneyCents(row[key])>=0,'Cuota inválida.');check(moneyCents(row.total)===moneyCents(row.principal)+moneyCents(row.interest),'La cuota no coincide con capital e interés.');}
 }
}
function makeItems(data,items,ctx){ctx.check(Array.isArray(items)&&items.length<=200,'Lista de consumos inválida.');return items.map(i=>{const p=data.products.find(p=>p.id===i.p),q=qty(i.q);ctx.check(p&&q>0&&q<=1e6,'Producto o cantidad inválida.');return {lineId:randomUUID(),note:txt(i.note,500),p:p.id,q,u:ctx.amount(i.u??p.price,true),vatRate:p.vatRate||0,unit:p.unit||'unidad',name:p.name}})}
function ensureResource(data,r,ctx){
 checkServiceSchedule(r,data.businessRecords||[],ctx.check,r.operationalProfile||operationalType(ctx.access?.company));
 if(!['agenda','reservas'].includes(r.module))return;
 ctx.check(r.resource&&r.start&&r.end&&Date.parse(r.end)>Date.parse(r.start),'Revisa recurso, inicio y fin.');
 ctx.check(!data.businessRecords.some(o=>o.id!==r.id&&o.module===r.module&&(o.resource||'').toLowerCase()===r.resource.toLowerCase()&&!['Cancelada','Finalizada'].includes(o.status)&&o.start<r.end&&o.end>r.start),'El recurso ya tiene una reserva o cita en ese horario.');
}
function produce(data,access,session,recipe,n,ctx){
 ctx.permit(access,'produccion',true);ctx.permit(access,'inventario',true);ctx.check(recipe.status==='Activa'&&n>0,'Receta o cantidad inválida.');
 const output=data.products.find(p=>p.id===recipe.productId);ctx.check(output&&output.kind!=='service','Selecciona un producto inventariable.');
 const stock=[],amounts=[];for(const i of businessRecipePlan(recipe,n,data.products)){const p=data.products.find(p=>p.id===i.p),q=i.q;ctx.check(p&&p.id!==output.id&&p.kind!=='service'&&p.stock>=q,'Insumo inexistente o insuficiente.');const lots=data.businessRecords.filter(r=>r.module==='lotes'&&r.productId===p.id);if(lots.length){ctx.permit(access,'lotes',true);let remaining=q;for(const lot of lots.filter(r=>r.status==='Disponible'&&r.due>=ctx.body.date).sort((a,b)=>a.due.localeCompare(b.due))){const used=Math.min(lot.q,remaining);if(used>0){lot.q=qty(lot.q-used);remaining=qty(remaining-used);if(!lot.q)lot.status='Agotado';recipe.events.push({date:ctx.body.date,action:'Insumo de lote',lotId:lot.id,q:used});}}ctx.check(remaining===0,'No hay lotes vigentes suficientes para producir.');}ctx.check(!data.businessRecords.some(r=>r.module==='variantes'&&r.serial&&r.productId===p.id),'Los insumos con serie requieren selección individual y no se consumen automáticamente.');p.stock=qty(p.stock-q);stock.push({pid:p.id,q:-q,unit:p.unit||'unidad',unitCost:p.cost});amounts.push(round(q*p.cost))}
 const cost=round(amounts.reduce((s,v)=>s+v,0));const oldValue=round(output.stock*output.cost),newStock=qty(output.stock+n);ctx.check(newStock>0,'Producción inválida.');const newCost=round((oldValue+cost)/newStock);ctx.check(newCost===output.cost||(access.company.data.products.find(p=>p.id===output.id)?.stock??output.stock)===output.stock,'El costo del terminado también afecta otras sucursales; revisa la producción con el contador.');const valuation=round(newStock*newCost-oldValue),difference=round(cost-valuation);
 output.stock=newStock;output.cost=newCost;stock.push({pid:output.id,q:n,unit:output.unit||'unidad',unitCost:newCost,productionAdjustment:{amountCents:moneyCents(round(valuation-round(n*newCost))),reason:'Diferencia de valoración del saldo anterior'}});
 const lines=[{a:'1301',d:valuation,c:0},{a:'1301',d:0,c:cost}];
 if(difference){ctx.check(data.accounts.some(a=>a.code===recipe.varianceAccount&&['costo','gasto','ingreso'].includes(a.tipo)),'Configura la cuenta de diferencia de costo.');lines.push({a:recipe.varianceAccount,d:difference>0?difference:0,c:difference<0?-difference:0})}
 return ctx.entry(data,session,{date:ctx.date(ctx.body.date),type:'produccion',desc:'Producción · '+recipe.name,total:cost,stock,lines,businessId:recipe.id,project:ctx.body.project||recipe.project||''});
}
// Solo se ejecuta para productos expresamente configurados; los históricos no cambian.
export function prepareBusinessSale(data,access,session,body,ctx){
 const records=data.businessRecords||[],allocations=[];foodAvailability(data,body.items,ctx.check);
 for(const i of body.items||[]){const recipe=records.find(r=>r.module==='produccion'&&r.productId===i.p&&r.status==='Activa');if(recipe?.foodSettings?.menuDate)ctx.check(recipe.foodSettings.menuDate===body.date,'El menú no está disponible en esta fecha.');if(recipe?.kind==='food-combo')ctx.check(recipe.foodSettings?.bundle?.length&&!data.products.find(p=>p.id===i.p)?.serviceDefinition?.enabled,'Configura los componentes del combo y conserva su servicio sin consumibles.');if(recipe?.foodSettings?.bundle?.length)ctx.check(ctx.trustedSourceId&&records.find(r=>r.id===ctx.trustedSourceId)?.items?.some(x=>x.p===i.p&&x.bundleComponents?.length),'Agrega el combo desde Plato / presentación / extras para incluir todos sus componentes.');}const demand=new Map();for(const i of body.items||[])demand.set(i.p,qty((demand.get(i.p)||0)+qty(i.q)));
 for(const [pid,q]of demand){
  const p=data.products.find(p=>p.id===pid);if(p?.kind==='service')continue;const reserved=records.filter(r=>r.id!==ctx.trustedSourceId&&r.module==='rutas'&&r.consignment&&r.status==='Preparada'&&!r.entryId).flatMap(r=>r.items||[]).filter(i=>i.p===pid).reduce((s,i)=>s+i.q,0);if(p&&p.kind!=='service'){ctx.check(p.stock-reserved>=q||records.some(r=>r.module==='produccion'&&r.productId===pid&&r.autoProduce&&r.status==='Activa'),'La existencia disponible está comprometida en consignación.');}

  const recipe=records.find(r=>r.module==='produccion'&&r.productId===pid&&r.autoProduce&&r.status==='Activa');if(recipe){const missing=qty(Math.max(0,q+reserved-(data.products.find(p=>p.id===pid)?.stock||0)));if(missing)produce(data,access,session,recipe,missing,{...ctx,body});}
  const lots=records.filter(r=>r.module==='lotes'&&r.productId===pid&&r.status==='Disponible'&&(!r.due||r.due>=body.date)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.date.localeCompare(b.date));
  if(records.some(r=>r.module==='lotes'&&r.productId===pid)){ctx.permit(access,'lotes',true);let remaining=q;for(const r of lots){const used=Math.min(remaining,r.q);if(used>0){r.q=qty(r.q-used);remaining=qty(remaining-used);allocations.push({id:r.id,q:used});if(!r.q)r.status='Agotado';r.events||=[];r.events.push({date:body.date,action:'Salida FEFO',q:used})}}ctx.check(remaining<=0,'No hay lotes vigentes suficientes para la venta.');}
  const serials=records.filter(r=>r.module==='variantes'&&r.productId===pid&&r.serial);
  if(serials.length){ctx.permit(access,'variantes',true);const chosen=(Array.isArray(body.serialIds)?body.serialIds:[]).filter(id=>serials.some(r=>r.id===id));ctx.check(Number.isInteger(q)&&new Set(chosen).size===q,'Selecciona una serie disponible por cada unidad.');for(const id of chosen){const r=serials.find(r=>r.id===id);ctx.check(r.status==='Disponible','Una serie ya fue vendida.');r.status='Vendida';r.events||=[];r.events.push({date:body.date,action:'Serie vendida'});allocations.push({id:r.id,q:1})}}
 }
 return allocations;
}
export async function businessOperation(data,access,session,body,context){
 const ctx={...context,body,access},op=body.operation,check=ctx.check,permit=m=>ctx.permit(access,m,true),records=data.businessRecords||=[];
 if(LODGING_OPS.includes(op))return lodgingOperation(data,access,session,body,ctx);
 if(SERVICE_OPS.includes(op))return serviceWorkflow(data,access,session,body,ctx);
 if(ORGANIZATION_OPS.includes(op))return organizationOperation(data,access,session,body,ctx);
 if(FOOD_WORKFLOW_OPS.includes(op))return foodWorkflow(data,access,session,body,ctx);
 if(op==='businessProduct'){
  { ctx.permit(access,'inventario',true);check(access.branchId&&txt(body.name),'Selecciona sucursal y nombre.');data.products.push({id:randomUUID(),code:txt(body.code,80),name:txt(body.name),unit:txt(body.unit,40)||'servicio',kind:'service',category:txt(body.category,100),stock:0,min:0,cost:0,price:ctx.amount(body.price||0,true),vatRate:Number(body.vatRate||0)});const p=data.products.at(-1);check(Number.isFinite(p.vatRate)&&p.vatRate>=0&&p.vatRate<=100,'IVA inválido.');return p.id;}
 }
 if(op==='businessOnboard'){
  check(access.owner&&!access.company.onboardingDone&&(!body.seed||(!data.entries.length&&!data.products.length)),'El arranque solo se aplica a empresas nuevas sin catálogo ni movimientos.');permit('ajustes');
  if(body.seed){permit('inventario');const p=catalog.get(operationalType(access.company));for(const example of p.startup.examples)data.products.push({id:randomUUID(),code:'EJ-'+String(data.products.length+1),name:example.name,unit:example.unit,category:example.category,kind:example.kind,cost:0,price:0,stock:0,min:0,vatRate:0});data.cfg.businessCategories=p.startup.categories;data.cfg.businessUnits=p.startup.units;}
  return {onboardingDone:true};
 }
 const module=body.module,existing=body.id?records.find(r=>r.id===body.id):null;
 check(![...PERSONNEL_MODULES,...CLIENT_MODULES,...FISCAL_MODULES,...INVENTORY_MODULES,...BUDGET_MODULES,...ANALYSIS_MODULES,...TREASURY_MODULES,'constancias_laborales','suscripciones','bancos'].includes(module),'Usa las operaciones específicas de Suscripciones.');
 check(catalog.all.includes(module)&&(!body.id||existing?.module===module),'Registro no encontrado.');permit(module);
 if(op!=='businessSave')check(existing,'Registro no encontrado.');
 if(body.date&&op!=='businessSave')check(ctx.date(body.date)>=existing.date,'La operación no puede ser anterior al registro.');
 check(!organizationRecord(existing||{})&&!String(body.kind||'').startsWith('organization-'),'Usa las operaciones de organizaciones.');
 check(!deliveryZoneRecord(existing||{})&&body.kind!=='delivery-zone','Usa la configuración de zonas.');
 check(existing?.kind!=='bakery-counter'&&body.kind!=='bakery-counter','Usa las operaciones de mostrador.');
 check(!diningRecord(existing||{})&&!['dining-table','table-reservation'].includes(body.kind),'Usa el tablero de mesas y reservas.');
 check(!commerceRecord(existing||{})||existing.kind==='commerce-order'&&['businessBill','businessAdvance','businessRefund'].includes(op),'Usa las operaciones específicas de comercio.');
 check(!String(body.kind||'').startsWith('commerce-'),'Usa las operaciones específicas de comercio.');
 check(!lodgingInternal(existing)&&!String(body.kind||'').startsWith('lodging-'),'Usa las operaciones de hotel y alquiler.');
 check(!existing?.unitId||op!=='businessSave','Conserva la unidad y su historial desde Hotel y alquileres.');
 const r=existing,confirmed=()=>check(body.confirmed===true,'Confirma la operación y su efecto contable.');
 const post=(lines,total,description,extra={})=>{check(ctx.date(body.date)>=r.date,'La operación no puede ser anterior al registro.');permit('contabilidad');permit('cajas');ctx.financialCash(access);confirmed();check(lines.every(l=>data.accounts.some(a=>a.code===l.a)),'Selecciona cuentas existentes.');check(lines.every(l=>!['1104','2107'].includes(l.a)&&!l.a.startsWith('1103-')),'Los turnos y caja chica se operan desde sus módulos.');check(moneyCents(lines.reduce((s,l)=>s+l.d,0))===moneyCents(lines.reduce((s,l)=>s+l.c,0)),'Asiento descuadrado.');return ctx.entry(data,session,{date:ctx.date(body.date),type:'negocio-'+module,desc:description,total,reference:txt(body.reference)||'NEG-'+r.id.slice(0,8),businessId:r.id,project:r.project||r.fund||'',lines,...extra})};
 const acct=(code,type)=>{check(data.accounts.some(a=>a.code===code&&(!type||a.tipo===type)),'Selecciona una cuenta de '+(type||'contabilidad')+' válida.');return code};
 const cash=()=>{check(['1101','1102'].includes(body.pay),'Selecciona Caja general o Banco.');return acct(body.pay,'activo')};
 if(LENDING_OPS.includes(op))return lendingOperation(data,access,session,body,ctx,r,post,b=>businessOperation(data,access,session,b,context));
 if(op==='businessSave'){
  check(module!=='comprobantes','Usa este módulo para imprimir registros existentes.');
  check(!existing?.deliveryDetails,'Conserva la entrega desde su operación específica.');
  check(!existing?.sourceAccountId,'Un despacho vinculado conserva sus consumos y cuenta de origen.');
  check(!existing||(!existing.entryId&&!existing.billed?.length&&!existing.events?.length&&!['Vigente','Liquidada','Cerrada','Convertido','Registrado','Vendida','Agotado','Finalizada'].includes(existing.status)),'Este registro ya tiene operaciones; conserva su historial.');
  const rec={operationalProfile:existing?.operationalProfile||operationalType(access.company),id:existing?.id||randomUUID(),module,name:txt(body.name),date:ctx.date(body.date),kind:txt(body.kind||module,40),status:existing?.status||flows[module][0],branchId:access.branchId,customerId:txt(body.customerId,80),productId:txt(body.productId,80),resource:txt(body.resource),responsible:txt(body.responsible),project:txt(body.project),fund:txt(body.fund),note:txt(body.note,3000),due:body.due?ctx.date(body.due):'',events:existing?.events||[],paid:existing?.paid||0};
  check(rec.name&&access.branchId,'Escribe el nombre y selecciona una sucursal.');
  if(rec.customerId)check(data.customers.some(c=>c.id===rec.customerId),'Cliente inexistente.');
  if(rec.productId)check(data.products.some(p=>p.id===rec.productId),'Producto inexistente.');
  if(['cuentas_abiertas','agenda','proyectos','contratos','reservas','rutas','despacho','documentos_venta','medidas'].includes(module)){
   rec.modality=['local','llevar','domicilio'].includes(body.modality)?body.modality:(existing?.modality||'');
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
   rec.requiresAssessment=true;rec.collateral=txt(body.collateral,1000);rec.valuation=ctx.amount(body.valuation||0,true);rec.collateralDue=body.collateralDue?ctx.date(body.collateralDue):'';
  }
  if(module==='contratos'){rec.frequency=txt(body.frequency);check(['diaria','semanal','quincenal','mensual'].includes(rec.frequency),'Frecuencia inválida.');rec.periods=Number(body.periods);check(Number.isInteger(rec.periods)&&rec.periods>0&&rec.periods<=600,'Plazo inválido.');check(rec.items.length,'Agrega el concepto de cobro.');rec.lateRate=Number(body.lateRate||0);check(Number.isFinite(rec.lateRate)&&rec.lateRate>=0&&rec.lateRate<=100,'Mora inválida.');rec.reminder=txt(body.reminder,500);rec.lateProductId=txt(body.lateProductId,80);rec.suspendAfter=Number(body.suspendAfter||0);check(Number.isInteger(rec.suspendAfter)&&rec.suspendAfter>=0&&rec.suspendAfter<=3650,'Días para suspensión inválidos.');}
  if(module==='rutas'){rec.employeeId=txt(body.employeeId,80);rec.route=txt(body.route);rec.seller=txt(body.seller);rec.consignment=body.consignment===true;rec.commissionRate=Number(body.commissionRate||0);check(Number.isFinite(rec.commissionRate)&&rec.commissionRate>=0&&rec.commissionRate<=100,'Comisión inválida.');}
  if(module==='cuentas_abiertas'&&rec.resource)check(body.sharedResourceConfirmed===true||!records.some(o=>o.id!==rec.id&&o.module===module&&o.status==='Abierta'&&o.resource?.toLowerCase()===rec.resource.toLowerCase()),'Ya hay una cuenta abierta en este recurso. Confirma que deseas compartirlo.');
  if(module==='despacho'){rec.delivery=txt(body.delivery,1000);rec.kind=['llevar','domicilio','local'].includes(body.kind)?body.kind:'llevar';rec.ticket=existing?.ticket||Math.max(0,...records.filter(o=>o.module===module).map(o=>o.ticket||0))+1;}
  if(module==='comisiones'){rec.employeeId=txt(body.employeeId,80);check(data.employees.some(e=>e.id===rec.employeeId&&e.active!==false),'Selecciona un empleado activo.');rec.rate=Number(body.rate);rec.saleId=txt(body.saleId,80);check(Number.isFinite(rec.rate)&&rec.rate>=0&&rec.rate<=100,'Comisión inválida.');}
  if(module==='aportes'){rec.total=ctx.amount(body.total);rec.donor=txt(body.donor);check(rec.donor&&rec.fund,'Indica donante o socio y fondo/proyecto.');rec.incomeAccount=acct(body.incomeAccount,'ingreso');}
  if(existing)Object.assign(existing,rec);else records.push(rec);return rec.id;
 }
 if(op==='businessState'){
  const next=txt(body.status);check(flows[module].includes(next),'Estado inválido.');
  if(r.kind==='food-event'&&next==='Entregada'){check(!r.deposit,'Aplica o devuelve el anticipo remanente antes de entregar.');const billed=(r.billed||[]).flatMap(b=>data.entries.find(e=>e.id===b.entryId)?.items||[]);check(r.items.every(i=>billed.filter(x=>x.p===i.p).reduce((n,x)=>n+x.q,0)>=r.items.filter(x=>x.p===i.p).reduce((n,x)=>n+x.q,0)-1e-9),'Factura todos los conceptos antes de marcar el evento entregado.');}
  if(module==='despacho'&&['En camino','No entregado'].includes(next))check(r.deliveryDetails,'Configura primero los datos de entrega.');
  if(module==='despacho'&&r.deliveryDetails){
   const transitions={Recibido:['Preparando','Cancelado'],Preparando:['Listo','Cancelado'],Listo:['En camino','Entregado','Cancelado'],'En camino':['Entregado','No entregado'],'No entregado':['En camino','Cancelado']};
   check(transitions[r.status]?.includes(next),'La entrega debe avanzar una etapa válida.');
   if(next==='En camino'){check(r.deliveryDetails.mode==='domicilio'&&r.deliveryDetails.driver,'Asigna repartidor para salir.');if(r.deliveryDetails.paymentMode==='prepaid')check(r.entryId&&data.entries.filter(e=>e.id===r.entryId||e.invoiceId===r.entryId).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((s,l)=>s+l.d-l.c,0)<=0.005,'Factura y cobra el pedido prepagado antes de salir.');}
   if(next==='Entregado')check(r.entryId&&data.entries.filter(e=>e.id===r.entryId||e.invoiceId===r.entryId).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((s,l)=>s+l.d-l.c,0)<=0.005,'Factura una sola vez y registra el cobro antes de entregar.');
   if(next==='No entregado')check(txt(body.reason,500),'Indica el motivo de no entrega.');
   if(next==='Entregado')r.deliveredAt=new Date().toISOString();
   if(next==='No entregado')r.events.push({date:new Date().toISOString(),action:'Motivo de no entrega',note:txt(body.reason,500),actor:session.email});
  }
  if(module==='despacho'&&r.sourceAccountId){const current=['Recibido','Preparando','Listo','Entregado'];check(next==='Cancelado'||current.indexOf(next)===current.indexOf(r.status)+1,'El despacho vinculado avanza una etapa a la vez.');check(r.status!=='Entregado','El despacho ya fue entregado.');}
  const states=({agenda:['Pendiente','Confirmada','Atendida','Cancelada'],proyectos:['Recibida','Diagnóstico','Presupuestada','En proceso','Entregada','Cancelada'],produccion:['Activa','Inactiva'],contratos:['Activo','Suspendido','Finalizado'],rutas:['Preventa','Preparada','Entregada','Cancelada'],despacho:['Recibido','Preparando','Listo','Entregado','Cancelado','En camino','No entregado'],documentos_venta:['Pendiente','Cancelado']})[module];check(states&&states.includes(next),'Usa la acción específica para este estado.');check(!r.securityCents||!['Cancelada','Cancelado','Finalizado'].includes(next),'Devuelve o aplica la garantía antes de cerrar.');check(!r.deposit||!['Cancelada','Cancelado','Finalizado'].includes(next),'Devuelve o aplica el depósito antes de cerrar.');check(!r.entryId||!['Cancelada','Cancelado'].includes(next),'Corrige primero el documento contable con su operación de anulación o devolución.');
  if(module==='rutas'&&next==='Entregada')check(r.entryId,'Factura la entrega antes de marcarla entregada.');
  if(['Finalizado','Cancelada','Cancelado'].includes(r.status))check(false,'El registro está finalizado.');
  if(module==='contratos'&&next==='Activo'&&r.status==='Finalizado')check(false,'Contrato finalizado.');
  if(module==='rutas'&&next==='Preparada'&&r.consignment){const allItems=records.filter(o=>o.module==='rutas'&&o.consignment&&(o.id===r.id||o.status==='Preparada')&&!o.entryId).flatMap(o=>o.items||[]);for(const p of data.products.filter(p=>p.kind!=='service'))check(allItems.filter(i=>i.p===p.id).reduce((s,i)=>s+i.q,0)<=p.stock,'La consignación excede la existencia disponible.');}
  if(module==='despacho'&&r.sourceAccountId&&next==='Cancelado'){check(supervisor(access)&&txt(body.reason,500),'Anular un pedido enviado exige supervisor y motivo.');r.events.push({date:new Date().toISOString(),action:'Anulación de envío',note:txt(body.reason,500),actor:session.email});}
  r.status=next;if(module==='agenda'&&next!=='Cancelada')ensureResource(data,r,ctx);r.events.push({date:new Date().toISOString(),action:next,actor:session.email});return r.id;
 }
 if(op==='businessProduce'){
  confirmed();check(module==='produccion','Receta inválida.');const n=qty(body.q);check(n>0&&n<=1e6,'Cantidad inválida.');
  const wasteQ=qty(body.wasteQ||0);check(wasteQ>=0&&wasteQ<n,'La merma de terminados debe ser menor que la hornada.');
  if(wasteQ){permit('contabilidad');check(txt(body.reason,500)&&data.accounts.some(a=>a.code===body.wasteAccount&&['gasto','costo'].includes(a.tipo)),'Indica motivo y cuenta de gasto o costo de la merma.');}
  if(r.foodSettings?.shelfDays&&!body.batchName)body.batchName='Hornada '+ctx.date(body.date)+' '+body.operationId.slice(0,8);
  const e=produce(data,access,session,r,n,ctx),output=data.products.find(p=>p.id===r.productId);
  if(body.batchName){e.productionBatch={name:txt(body.batchName,120),recipeId:r.id,productId:r.productId,q:n,goodQ:qty(n-wasteQ),wasteQ,reason:txt(body.reason,500),manufactured:e.date,due:body.due?ctx.date(body.due):(r.foodSettings?.shelfDays?sameDay(e.date,r.foodSettings.shelfDays):''),ingredients:txt(r.labelIngredients,2000),allergens:txt(r.allergens,1000)};check(!e.productionBatch.due||e.productionBatch.due>=e.date,'Vencimiento anterior a la elaboración.');}
  if(wasteQ){const cost=round(wasteQ*output.cost);const loss=ctx.entry(data,session,{date:e.date,type:'produccion-merma',desc:'Merma de hornada · '+txt(body.batchName||r.name),total:cost,businessId:r.id,productionId:e.id,reason:txt(body.reason,500),stock:[{pid:output.id,q:-wasteQ,unit:output.unit||'unidad',unitCost:output.cost}],lines:cost?[{a:body.wasteAccount,d:cost,c:0},{a:'1301',d:0,c:cost}]:[]});output.stock=qty(output.stock-wasteQ);e.wasteEntryId=loss.id;}
  if(e.productionBatch?.due){permit('lotes');records.push({id:randomUUID(),module:'lotes',kind:'lotes',name:e.productionBatch.name,lot:e.productionBatch.name,date:e.date,due:e.productionBatch.due,status:'Disponible',branchId:access.branchId,productId:output.id,q:qty(n-wasteQ),entryId:e.id,events:[]});}
  r.events.push({date:e.date,action:body.batchName?'Hornada':'Producción',entryId:e.id,q:n,...(wasteQ?{wasteQ}:{})});return e.id;
 }
 if(op==='businessPurchase'){
  check(module==='proyectos','Selecciona una obra o proyecto.');confirmed();permit('compras');const purchase=data.entries.find(e=>e.id===body.purchaseId&&e.type==='compra');check(purchase,'Compra no encontrada.');check(!records.some(o=>(o.purchaseIds||[]).includes(purchase.id)),'La compra ya está vinculada a un proyecto.');r.purchaseIds||=[];r.purchaseIds.push(purchase.id);r.events.push({date:ctx.date(body.date),action:'Compra vinculada',entryId:purchase.id});return purchase.id;
 }
 if(op==='businessCost'){
  check(['proyectos','lotes','produccion','reservas','contratos','rutas','aportes'].includes(module),'Este registro no admite costos asociados.');confirmed();permit('costos');check(['1101','1102','2101'].includes(body.pay),'Usa Caja general, Banco o Crédito.');const cost=ctx.registerCost(data,access,session,body),entry=data.entries.find(e=>e.id===cost.entryId);entry.businessId=r.id;entry.project=r.project||r.fund||r.id;cost.businessId=r.id;r.events.push({date:entry.date,action:'Costo asociado',entryId:entry.id,total:cost.total});return entry.id;
 }
 if(op==='businessDispatch'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId,'Cuenta cerrada.');
  permit('despacho');check(body.operationId,'El envío requiere un identificador único.');confirmed();
  const station=txt(body.station,40);check(['cocina','barra','postres'].includes(station),'Selecciona una estación.');
  const chosen=Array.isArray(body.lineIds)?new Set(body.lineIds):new Set();
  check(chosen.size>0&&chosen.size<=200,'Selecciona consumos pendientes.');
  const pending=r.items.filter((i,index)=>chosen.has(i.lineId||String(index))&&i.q>(i.dispatchedQ||0));
  check(pending.length===chosen.size,'Una línea ya fue enviada o no pertenece a esta cuenta.');
  for(const i of pending)i.lineId||=randomUUID();
  const items=pending.map(i=>({...structuredClone(i),lineId:i.dispatchLineId||i.lineId,q:qty(i.q-(i.dispatchedQ||0))}));
  const round=1+Math.max(0,...records.filter(o=>o.sourceAccountId===r.id).map(o=>o.round||0));
  const dispatch={id:randomUUID(),module:'despacho',kind:r.modality||'local',name:r.name,date:ctx.date(body.date),status:'Recibido',branchId:access.branchId,sourceAccountId:r.id,resource:r.resource||'',responsible:r.responsible||'',station,round,ticket:1+Math.max(0,...records.filter(o=>o.module==='despacho').map(o=>o.ticket||0)),items,total:invoiceTotals(items).total,events:[],paid:0};
  records.push(dispatch);r.ticket||=dispatch.ticket;for(const i of pending){i.dispatchedQ=i.q;i.dispatchLineId||=i.lineId;}
  r.events.push({date:new Date().toISOString(),action:'Envío a '+station,targetId:dispatch.id,actor:session.email});return dispatch.id;
 }
 if(op==='businessVoidLine'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId,'Cuenta cerrada.');
  check(supervisor(access)&&txt(body.reason,500),'Anular un consumo exige supervisor y motivo.');confirmed();
  const index=body.index;check(Number.isInteger(index)&&index>=0&&index<r.items.length,'Selecciona un consumo.');
  const item=r.items[index];let remaining=item.dispatchedQ||0;
  if(remaining){permit('despacho');for(const order of records.filter(o=>o.module==='despacho')){let changed=false;
   for(const line of order.items||[]){if(line.lineId!==(item.dispatchLineId||item.lineId)||remaining<=0)continue;const q=Math.min(remaining,line.q-(line.voidedQ||0));if(q<=0)continue;changed=true;line.voidedQ=qty((line.voidedQ||0)+q);remaining=qty(remaining-q);order.events.push({date:new Date().toISOString(),action:'Consumo anulado',note:txt(body.reason,500),actor:session.email});}
   if(changed)order.total=invoiceTotals((order.items||[]).map(i=>({...i,q:qty(i.q-(i.voidedQ||0))})).filter(i=>i.q>0)).total;
  }}
  r.items.splice(index,1);r.total=invoiceTotals(r.items).total;
  r.events.push({date:new Date().toISOString(),action:'Consumo anulado',note:txt(body.reason,500),actor:session.email,items:[structuredClone(item)]});return r.id;
 }
 if(op==='businessConsume'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId,'Cuenta cerrada.');const added=makeItems(data,body.items||[],ctx);check(added.length&&r.items.length+added.length<=200,'Agrega consumos (máximo 200 líneas por cuenta).');r.items.push(...added);r.total=invoiceTotals(r.items).total;r.events.push({date:new Date().toISOString(),action:'Consumo agregado'});return r.id;
 }
 if(op==='businessMove'){check(!r.tableId,'La cuenta conserva su mesa; divide o factura desde la cuenta.');check(module==='cuentas_abiertas'&&r.status==='Abierta','Cuenta no disponible.');check(body.sharedResourceConfirmed===true||!records.some(o=>o.id!==r.id&&o.module===module&&o.status==='Abierta'&&o.resource?.toLowerCase()===txt(body.resource).toLowerCase()),'Ya hay una cuenta abierta en el destino. Confirma que deseas compartirlo.');r.resource=txt(body.resource);r.responsible=txt(body.responsible);check(r.resource,'Indica destino.');r.events.push({date:new Date().toISOString(),action:'Traslado',resource:r.resource,responsible:r.responsible});return r.id;}
 if(op==='businessMerge'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId&&!r.deposit,'Cuenta no disponible para unir.');const other=records.find(o=>o.id===body.targetId&&o.module===module&&o.id!==r.id);check(other&&other.status==='Abierta'&&!other.entryId&&!other.deposit&&other.serviceRate===r.serviceRate&&other.serviceProductId===r.serviceProductId,'Selecciona otra cuenta abierta sin anticipos y con el mismo cargo por servicio.');other.items.push(...r.items);other.total=invoiceTotals(other.items).total;r.items=[];r.total=0;r.status='Cerrada';r.mergedInto=other.id;r.events.push({date:new Date().toISOString(),action:'Unión',targetId:other.id});return other.id;
 }
 if(op==='businessSplit'){
  check(module==='cuentas_abiertas'&&r.status==='Abierta'&&!r.entryId&&!r.deposit,'Cuenta no disponible para dividir.');
  const requested=Array.isArray(body.splitItems)?body.splitItems:(Array.isArray(body.indices)?body.indices.map(index=>({index,q:r.items[index]?.q})):[]),seen=new Set(),moved=[];
  for(const group of new Set(r.items.map(i=>i.optionGroupId).filter(Boolean))){const grouped=r.items.map((i,index)=>({i,index})).filter(x=>x.i.optionGroupId===group),ratios=grouped.map(x=>Number(requested.find(s=>s.index===x.index)?.q||0)/x.i.q);check(ratios.every(n=>Math.abs(n-ratios[0])<1e-8),'Divide juntos el plato y sus extras en la misma proporción.');}
  for(const request of requested){const index=request.index,q=qty(request.q);check(Number.isInteger(index)&&index>=0&&index<r.items.length&&!seen.has(index),'Línea de división inválida.');seen.add(index);if(!q)continue;const item=r.items[index];check(q<=item.q,'La cantidad supera el consumo.');const sent=Math.min(q,item.dispatchedQ||0);moved.push({...item,dispatchLineId:item.dispatchLineId||item.lineId||'',lineId:randomUUID(),q,...(item.dispatchedQ!==undefined?{dispatchedQ:sent}:{})});if(item.dispatchedQ!==undefined)item.dispatchedQ=qty(item.dispatchedQ-sent);item.q=qty(item.q-q);}
  check(moved.length&&r.items.some(i=>i.q>0),'Conserva consumos en ambas cuentas.');r.items=r.items.filter(i=>i.q>0);const target={...structuredClone(r),id:randomUUID(),name:txt(body.name)||r.name+' · separada',person:txt(body.person,80),tableFamilyId:r.tableFamilyId||r.id,items:moved,events:[]};r.tableFamilyId||=r.id;r.total=invoiceTotals(r.items).total;target.total=invoiceTotals(target.items).total;records.push(target);r.events.push({date:new Date().toISOString(),action:'División',targetId:target.id});return target.id;
 }
 if(op==='businessRefund'){
  check(r.deposit>0&&r.depositAccount,'No hay depósito por devolver.');const total=ctx.amount(body.total);check(moneyCents(total)<=moneyCents(r.deposit),'La devolución supera el depósito pendiente.');const e=post([{a:r.depositAccount,d:total,c:0},{a:cash(),d:0,c:total}],total,'Devolución de depósito · '+r.name);r.deposit=round(r.deposit-total);commerceReserve(data,r,check);r.events.push({date:e.date,action:'Depósito devuelto',entryId:e.id,total});return e.id;
 }
 if(op==='businessAdvance'){
  check(['cuentas_abiertas','agenda','proyectos','reservas','documentos_venta',...(data.cfg.treasuryControls?.anticipos?.enabled===true?['contratos']:[])].includes(module)&&!r.entryId&&!['Cancelada','Cancelado','Cerrada','Finalizada'].includes(r.status),'No admite anticipos.');const total=ctx.amount(body.total),liability=acct(body.liability,'pasivo');check(!r.depositAccount||r.depositAccount===liability,'Conserva la cuenta del anticipo original.');const e=post([{a:cash(),d:total,c:0},{a:liability,d:0,c:total}],total,'Anticipo / depósito · '+r.name);r.deposit=round((r.deposit||0)+total);r.depositAccount=liability;check(r.kind!=='commerce-order'||moneyCents(r.deposit)<=moneyCents(r.total),'El anticipo supera el total del pedido.');commerceReserve(data,r,check);r.events.push({date:e.date,action:'Anticipo',entryId:e.id,total});return e.id;
 }
 if(op==='businessBill'||op==='businessGenerate'){
  check(['cuentas_abiertas','agenda','proyectos','contratos','reservas','rutas','despacho','documentos_venta','medidas','variantes'].includes(module),'Registro no facturable.');confirmed();
  check(!['Cancelada','Cancelado','Cerrada','Finalizada','Finalizado','Suspendido'].includes(r.status),'Registro cerrado, suspendido o cancelado.');
  check(!r.convertedProjectId,'La cotización se factura desde el proyecto vinculado.');
  check(!r.sourceAccountId,'Este despacho se cobra exclusivamente desde la cuenta de origen.');
  check(module==='proyectos'||module==='contratos'||!r.entryId,'Este registro ya está facturado.');
  let items=structuredClone(r.items||[]),key='final',period;if(module==='variantes')check(r.status==='Disponible','Serie no disponible.');
  if(module==='contratos'){
   check(op==='businessGenerate'&&r.status==='Activo','Contrato no disponible.');period=Number(body.period);check(Number.isInteger(period)&&period>=1&&period<=r.periods,'Período inválido.');key='periodo-'+period;const due=nextDate(r.date,r.frequency,period);check(body.date>=due,'No genera períodos futuros.');
   if(r.suspendAfter)check(!(r.billed||[]).some(b=>b.due&&body.date>sameDay(b.due,r.suspendAfter)&&data.entries.filter(e=>e.id===b.entryId||e.invoiceId===b.entryId).reduce((s,e)=>s+e.lines.filter(l=>l.a==='1201').reduce((s,l)=>s+l.d-l.c,0),0)>0.005),'El contrato supera la mora configurada; revisa los cobros y la suspensión.');
  }
  if(module==='proyectos'){key=txt(body.milestone,80);check(key,'Indica la etapa de facturación.');items=makeItems(data,body.items||[],ctx);}
  if(r.kind==='food-event'){
   const billedItems=(r.billed||[]).flatMap(b=>data.entries.find(e=>e.id===b.entryId)?.items||[]);
   const chosen=new Map();for(const i of items){check((r.items||[]).some(o=>o.p===i.p&&moneyCents(o.u)===moneyCents(i.u)),'Conserva los productos y precios cotizados del evento.');chosen.set(i.p,(chosen.get(i.p)||0)+i.q);}
   for(const [pid,q]of chosen){const quoted=r.items.filter(i=>i.p===pid).reduce((n,i)=>n+i.q,0),already=billedItems.filter(i=>i.p===pid).reduce((n,i)=>n+i.q,0);check(q+already<=quoted+1e-9,'La etapa supera las cantidades pendientes del evento.');}
  }

  check(!(r.billed||[]).some(b=>b.key===key),'Este período o etapa ya fue facturado.');
  const timeRecords=serviceTimeBilling(r,items,body,check);
  if(timeRecords.length)check(items.every(i=>data.products.find(p=>p.id===i.p)?.kind==='service'),'El tiempo solo se factura como servicio.');
  checkServiceBilling(r,items,data,check,r.operationalProfile||operationalType(access.company));
  items=businessBillItems(r,data.products,module==='proyectos'?items:undefined,period);
  const late=businessContractLateItems(r,data.entries,data.products,body.date),lateUpdates=late.updates;items.push(...late.items);
  const bill=await ctx.sale({...body,discount:body.loyalty===true?Number(body.discount):0,sourceQuotation:undefined,saleContext:saleContext({person:r.person||'',resource:r.resource||'',resourceLabel:catalog.resourceLabel(operationalType(access.company)),responsible:r.responsible||r.seller||'',modality:r.modality||(['local','llevar','domicilio'].includes(r.kind)?r.kind:''),ticket:r.ticket?String(r.ticket):String(records.find(o=>o.sourceAccountId===r.id)?.ticket||''),sourceId:r.id,sourceModule:r.module,sourceName:r.name,project:r.project||''},check),items,serialIds:module==='variantes'&&r.serial?[r.id]:(Array.isArray(body.serialIds)?body.serialIds:r.serialIds||[]),date:ctx.date(body.date),due:module==='contratos'?nextDate(r.date,r.frequency,period):body.due||body.date,customerId:(r.operationalProfile||operationalType(access.company))==='educacion'&&r.service?.guardianId?r.service.guardianId:r.customerId,party:r.name,commercePresentations:items.filter(i=>i.commercePresentation).map(i=>({p:i.p,code:i.commercePresentation}))},r.id);
  for(const t of timeRecords)t.entryId=bill.id;
  if(r.tipShares?.length&&r.serviceRate){const tipItem=bill.items.at(-1),tip=invoiceTotals([tipItem]);bill.tipAllocation={productId:r.serviceProductId,amountCents:moneyCents(tip.subtotal),shares:structuredClone(r.tipShares)};}
  for(const billed of lateUpdates)billed.lateThrough=body.date;
  if(module==='contratos')r.rentalCharges=[];r.billed||=[];r.billed.push({key,entryId:bill.id,total:bill.total,due:bill.due});r.entryId=bill.id;
  if(r.deposit){check(bill.pay==='1201'&&(module==='proyectos'||moneyCents(r.deposit)<=moneyCents(bill.creditAmount)),'Para aplicar el anticipo factura a crédito con saldo suficiente.');const applied=Math.min(moneyCents(r.deposit),moneyCents(bill.creditAmount))/100;check(applied>0,'La factura debe tener crédito para aplicar anticipos.');const e=post([{a:r.depositAccount,d:applied,c:0},{a:'1201',d:0,c:applied}],applied,'Aplicación de anticipo · '+r.name,{invoiceId:bill.id});r.events.push({date:e.date,action:'Aplicación de anticipo',entryId:e.id,total:applied});r.deposit=round(r.deposit-applied);}
  if(module==='rutas'&&r.commissionRate){permit('comisiones');permit('personal');check(data.employees.some(e=>e.id===r.employeeId&&e.active!==false),'Asigna al vendedor como empleado antes de generar la comisión.');records.push({id:randomUUID(),module:'comisiones',kind:'ruta',name:'Comisión · '+r.name,date:bill.date,status:'Pendiente',branchId:access.branchId,employeeId:r.employeeId,saleId:bill.id,rate:r.commissionRate,events:[],paid:0});}
  if(['cuentas_abiertas','documentos_venta','medidas','variantes'].includes(module))r.status=({cuentas_abiertas:'Cerrada',documentos_venta:'Convertido',medidas:'Facturada',variantes:'Vendida'})[module];return bill.id;
 }
 if(op==='businessCheckin'){check(module==='reservas'&&r.status==='Reservada','Reserva no disponible.');lodgingEntry(data,r,check);ensureResource(data,r,ctx);r.status='Ocupada';r.events.push({date:new Date().toISOString(),action:'Entrada'});return r.id;}
 if(op==='businessCheckout'){check(module==='reservas'&&r.status==='Ocupada'&&r.entryId&&!r.deposit&&!r.securityCents,'Factura y aplica el depósito antes de cerrar.');lodgingExit(data,r,ctx.date(body.date));r.status='Finalizada';r.events.push({date:new Date().toISOString(),action:'Salida'});return r.id;}
 if(op==='businessDisburse'){
  check(module==='cartera'&&r.status==='Borrador'&&!r.entryId,'Crédito ya desembolsado.');check(!r.requiresAssessment||r.assessment?.approved===true&&body.date>=r.assessment.date,'Registra y aprueba la evaluación del solicitante antes de desembolsar.');check(body.date===r.date,'El desembolso debe tener la fecha del plan; corrige el borrador si cambia.');const e=post([{a:r.principalAccount,d:r.principal,c:0},{a:cash(),d:0,c:r.principal}],r.principal,'Desembolso · '+r.name);r.entryId=e.id;r.status='Vigente';return e.id;
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
  const interestRemaining=Math.max(0,moneyCents(row.interest+row.penalty)-moneyCents(row.interestPaid||0)),interestPaid=Math.min(moneyCents(total),interestRemaining)/100,capital=round(total-interestPaid),lines=[{a:cash(),d:total,c:0}];if(interestPaid)lines.push({a:r.interestAccount,d:0,c:interestPaid});if(capital)lines.push({a:r.principalAccount,d:0,c:capital});const e=post(lines,total,'Cobro de cuota '+row.number+' · '+r.name);row.paid=round(row.paid+total);row.interestPaid=round((row.interestPaid||0)+interestPaid);r.paid=round(r.paid+total);r.lastPaidDate=when;r.events.push({date:when,action:'Cobro',entryId:e.id,total,principal:capital,interest:interestPaid,number:row.number,collector:r.collector||'',actor:session.email,pay:body.pay,reference:txt(body.reference)});if(r.schedule.every(row=>moneyCents(row.paid)>=moneyCents(row.total+row.penalty)))r.status='Liquidada';return e.id;
 }
 if(op==='businessRelease'){
  check(module==='cartera'&&r.collateral&&r.status==='Liquidada'&&!r.writtenOff&&!r.collateralReleased,'Liquida el crédito antes de liberar la garantía.');confirmed();r.collateralReleased=true;r.events.push({date:ctx.date(body.date),action:'Garantía liberada',note:txt(body.note,1000)});return r.id;
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
