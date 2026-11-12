import {routeNoticeAllowed} from './route-notices.mjs';
import {randomUUID} from 'node:crypto';
import {invoiceTotals,moneyCents,normalizeItemQuantity,customerCreditBalance,invoiceLinkedEntries} from './accounting-engine.mjs';
import {commerceRouteCashRows,commerceRouteProfit,commerceQuantity as qty} from '../../public/commerce-math.mjs';
import {commerceReserved,commerceCheckStock} from './commerce.mjs';
export const ROUTE_OPS=['routeTargets','routeArchive','routeVisitOrder','routeNoticeAck','routeNoticeRefresh','routeDefinition','routePolicy','routeApproveOrder','routeCustomer','routeOrder','routeOrderState','routeReschedule','routePrepare','routeDispatch','routeDelivery','routeNotDelivered','routeVisit','routeReload','routeSettle','routeApproveSettlement','routeRejectSettlement','routeReturnRequest','routeReturnApprove','routeCollect','routeExpense','routeAssign','routeReassignLoad'];
export const routeWorker=a=>!!a.routeRole&&a.routeRole!=='route_supervisor';
export const routeManager=a=>a.owner||a.routeRole==='route_supervisor'||!a.routeRole&&(a.rolePolicy?.specials?.salesAdmin===true||a.rolePolicy?.specials?.corrections===true||a.member?.role?.toLowerCase()==='supervisor');
export const routeCustomerAllowed=(data,a,id)=>!routeWorker(a)||(data.customers||[]).some(c=>c.id===id&&c.sellerId===a.member.id)||(data.businessRecords||[]).some(r=>r.customerId===id&&r.assignedMemberId===a.member.id);
export const routeRecordAllowed=(a,r)=>!routeWorker(a)||r.operatorId===a.member.id||r.assignedMemberId===a.member.id;
export function routePhotoAllowed(records,a,r){const order=records.find(o=>o.id===r.orderId&&o.kind==='route-order');return r.kind==='route-delivery'&&r.branchId===a.branchId&&!!order&&order.branchId===a.branchId&&routeRecordAllowed(a,r)&&routeRecordAllowed(a,order);}
const text=(v,n=200)=>String(v??'').trim().slice(0,n);
export function routeOperationGuard(a,b,check){
 if(!a.routeRole)return;
 const common=['routeNoticeAck','routeNoticeRefresh','customerCredit','routeVisit','routeCustomer','routeOrder','routeOrderState'];
 const selling=['sale','openShift','closeShift','invoiceDownload','routeCollect','routeExpense','routeSettle','routeReturnRequest'];
 const driver=['routeDelivery','routeNotDelivered'];
 const supervisor=[...ROUTE_OPS,'sale','openShift','closeShift','creditNote','commerceLoad','commerceLoadReturn','commerceRouteClose','commerceVisit','invoiceDownload'];
 const list=a.routeRole==='route_supervisor'?supervisor:a.routeRole==='route_preseller'?common:a.routeRole==='route_driver'?[...common.filter(x=>!['routeOrder','routeOrderState'].includes(x)),...selling.filter(x=>x!=='sale'),...driver]:[...common,...selling];
 check(list.includes(b.operation),'Esta operación no corresponde a tu rol en ruta.');
}
export function routePolicy(data,zone){const route=(data.businessRecords||[]).find(r=>r.kind==='route-definition'&&r.route===zone);return {requireCreditApproval:false,allowSaleWithoutLoad:true,...data.cfg?.routePolicy,...route?.routePolicy};}
export function routeOrderPriceLines(data,body,normalPrice=(d,p)=>p.price){return body.items.map(i=>{const p=data.products.find(p=>p.id===i.p),normalPriceCents=moneyCents(normalPrice(data,p,body)),unitPriceCents=moneyCents(i.u);return {productId:i.p,normalPriceCents,unitPriceCents,specialPrice:normalPriceCents!==unitPriceCents}})}
export function routeSaleGuard(data,a,body,check){
 if(a.routeRole||body.commerceLoadId||body.routeOrderId)check(body.operationId,'La venta de ruta requiere identificador único.');
 if(body.commerceLoadId)check(!(data.businessRecords||[]).some(r=>r.kind==='route-settlement'&&r.loadId===body.commerceLoadId&&r.status==='Pendiente'),'La carga tiene una liquidación pendiente.');
 const zone=(data.businessRecords||[]).find(r=>r.id===body.commerceLoadId)?.route||(data.customers||[]).find(c=>c.id===body.customerId)?.routeZone;
 if((a.routeRole||body.routeOrderId||body.routeSale)&&!body.commerceLoadId)check(routePolicy(data,zone).allowSaleWithoutLoad!==false,'Esta ruta no permite vender del inventario general sin carga.');
 if(!a.routeRole)return;
 check(a.routeRole!=='route_preseller','El preventista no factura ni cobra.');
 check(routeCustomerAllowed(data,a,body.customerId),'Cliente fuera de tu ruta.');
 const loads=(data.businessRecords||[]).filter(r=>r.kind==='commerce-load'&&!r.closed&&r.assignedMemberId===a.member?.id);
 if(routeWorker(a)&&loads.length){check(body.commerceLoadId&&loads.some(l=>l.id===body.commerceLoadId),'Selecciona tu carga activa; no puedes vender del inventario mientras tienes carga.');}
 if(body.commerceLoadId){const l=(data.businessRecords||[]).find(r=>r.id===body.commerceLoadId);check(l&&routeRecordAllowed(a,l),'Carga fuera de tu asignación.');}
}
export function routeReserved(data,pid,exceptId=''){
 return (data.businessRecords||[]).filter(r=>r.id!==exceptId&&r.kind==='route-order'&&r.reserved&&!r.loadId&&!['Cancelado','Entregado'].includes(r.status)).flatMap(r=>r.remaining||r.items||[]).filter(i=>i.p===pid).reduce((n,i)=>n+i.q,0);
}
export async function routeOperation(data,a,session,b,h){
 const check=h.check,permit=m=>h.permit(a,m),manager=routeManager(a),worker=routeWorker(a),actor=a.member?.id||session.email;
 permit('rutas');routeOperationGuard(a,b,check);
 if(b.durableRoute===true)check(b.branchId===a.branchId,'La sucursal del envío pendiente no coincide con la sesión.');
 check(b.confirmed===true&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.operationId||'')&&a.branchId,'Confirma la operación en una sucursal.');
 const date=h.date(b.date),at=new Date().toISOString(),rows=data.businessRecords||=[],event={date,at,actor:session.member?.name||session.email,operatorId:actor,action:b.operation,reason:text(b.reason,1000)};
 const byId=new Map(rows.map(r=>[r.id,r])),byKind=new Map();for(const r of rows){if(!byKind.has(r.kind))byKind.set(r.kind,[]);byKind.get(r.kind).push(r)}
 const ofKind=kind=>byKind.get(kind)||[];
 const add=(kind,values)=>{const r={id:randomUUID(),module:'rutas',kind,name:kind,date,status:'Pendiente',branchId:a.branchId,operatorId:actor,events:[event],...values,name:text(values.name||kind)};rows.push(r);byId.set(r.id,r);if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push(r);return r};
 const get=(kind,id=b.id)=>{const r=byId.get(id);check(r&&r.kind===kind&&r.branchId===a.branchId&&(kind==='route-notice'?routeNoticeAllowed(rows,a,r):routeRecordAllowed(a,r)),'Registro fuera de tu asignación o sucursal.');return r};
 const manage=()=>check(manager,'Requiere supervisor de ruta, administrador o dueño.');
 const unlocked=l=>check(!ofKind('route-settlement').some(r=>r.loadId===l.id&&r.status==='Pendiente'),'La carga tiene una liquidación pendiente.');
 const customer=id=>{const c=data.customers.find(c=>c.id===id&&c.status==='activo');check(c&&routeCustomerAllowed(data,a,id),'Cliente fuera de tu asignación o inactivo.');return c};
 const location=value=>{if(!value)return null;const {latitude,longitude,accuracy}=value;check(Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)&&Math.abs(longitude)<=180&&Number.isFinite(accuracy)&&accuracy>=0,'Ubicación inválida.');return {latitude,longitude,accuracy}};
 const assigned=id=>{const m=h.team.find(m=>m.id===id&&m.active&&m.branchIds.includes(a.branchId));check(m&&['route_seller','route_preseller','route_driver','route_supervisor'].includes(m.routeRole),'Selecciona un trabajador de ruta activo de esta sucursal.');return m};
 const items=source=>{check(Array.isArray(source)&&source.length&&source.length<=200,'Agrega de 1 a 200 productos.');const seen=new Set();return source.map(i=>{const p=data.products.find(p=>p.id===i.p),q=normalizeItemQuantity(i.q),u=Number(i.u??p?.price);check(p&&p.kind!=='service'&&!seen.has(i.p)&&q>0&&q<=1e6&&Number.isFinite(u)&&u>0&&moneyCents(u)/100===u,'Producto repetido, precio o cantidad inválidos.');seen.add(i.p);return {p:p.id,name:p.name,q,u,vatRate:Number(p.vatRate||0)}})};
 const quantities=source=>{check(Array.isArray(source)&&source.length<=200,'Cantidades inválidas.');const seen=new Set();return source.map(i=>{const q=qty(i.q);check(data.products.some(p=>p.id===i.p&&p.kind!=='service')&&!seen.has(i.p)&&q>=0&&q<=1e6,'Producto repetido o cantidad inválida.');seen.add(i.p);return {p:i.p,q,u:0}})};
 const movementLoad=()=>{const loads=ofKind('commerce-load').filter(r=>!r.closed&&r.branchId===a.branchId&&(r.assignedMemberId||r.operatorId)===actor);check(loads.length<=1||loads.some(l=>l.id===b.loadId),'Selecciona la carga del movimiento.');const l=b.loadId?get('commerce-load',b.loadId):loads[0];return l?{commerceLoadId:l.id,route:l.route}:{};};
 const notice=(type,id,message)=>{const source=byId.get(id);return add('route-notice',{name:message,type,sourceId:id,route:source?.route||'',customerId:source?.customerId||'',operatorId:source?.operatorId||actor,assignedMemberId:source?.assignedMemberId||'',status:'Pendiente'})};
 if(b.operation==='routeTargets'){
  manage();const r=get('route-definition');check(Array.isArray(b.targets)&&b.targets.length<=100&&new Set(b.targets.map(t=>t.memberId)).size===b.targets.length&&text(b.reason),'Indica metas únicas y motivo.');
  r.workerTargets=b.targets.map(t=>{assigned(t.memberId);check(Number.isSafeInteger(t.targetCents)&&t.targetCents>=0&&t.targetCents<=99999999900,'Meta inválida.');return {memberId:t.memberId,targetCents:t.targetCents}});r.events.push(event);return r.id;
 }
 if(b.operation==='routeVisitOrder'){
  manage();check(text(b.reason)&&Array.isArray(b.customerIds)&&b.customerIds.length>0&&b.customerIds.length<=500&&new Set(b.customerIds).size===b.customerIds.length,'Indica clientes únicos y motivo.');
  const clients=b.customerIds.map(customer);check(clients.every(c=>c.routeZone===text(b.zone,100)),'Los clientes deben pertenecer a la misma ruta.');
  clients.forEach((c,i)=>{c.routeOrder=i+1});return add('route-visit-order',{name:'Orden de visita · '+text(b.zone,100),route:text(b.zone,100),customerIds:clients.map(c=>c.id),status:'Confirmado',reason:text(b.reason,1000)}).id;
 }
 if(b.operation==='routeArchive'){
  manage();const days=Number(b.days);check(Number.isInteger(days)&&days>=1&&days<=36500&&text(b.reason),'Indica antigüedad de 1 a 36500 días y motivo.');
  const cutoff=new Date(at);cutoff.setUTCDate(cutoff.getUTCDate()-days);
  const closed=r=>r&&['Entregado','Cancelado'].includes(r.status);
  for(const r of rows){if(r.module!=='rutas'||r.branchId!==a.branchId||r.archivedAt)continue;
   const eligible=r.kind==='route-order'?closed(r):r.kind==='commerce-visit'?true:r.kind==='route-notice'?r.status==='Atendido':r.kind==='route-delivery'?closed(byId.get(r.orderId)):false;
   const last=r.acknowledgedAt||r.events?.at(-1)?.at||r.date;if(!eligible||!last||!Number.isFinite(Date.parse(last))||new Date(last)>=cutoff)continue;
   r.archivedAt=at;r.archivedBy=actor;r.archivedReason=text(b.reason,1000);r.events||=[];r.events.push(event);
  }return 'route-archive';
 }
 if(b.operation==='routeNoticeAck'){
  const r=get('route-notice');check(['Pendiente','Atendido'].includes(r.status),'El aviso no admite atención.');
  if(r.status==='Atendido')return r.id;
  r.status='Atendido';r.acknowledgedBy=actor;r.acknowledgedByName=event.actor;r.acknowledgedAt=at;r.events||=[];r.events.push(event);return r.id;
 }
 if(b.operation==='routeNoticeRefresh'){
  const day=h.today?.()||new Date().toISOString().slice(0,10);
  for(const r of ofKind('route-order').filter(r=>r.branchId===a.branchId&&r.status==='Enviado'&&r.due<day&&routeRecordAllowed(a,r))){
   if(!ofKind('route-notice').some(n=>n.sourceId===r.id&&n.type==='atraso'&&n.overdueDue===r.due)){const n=notice('atraso',r.id,'Pedido atrasado · '+r.name);n.overdueDue=r.due;n.date=day;}
  }
  return 'route-notices';
 }
 const priceLines=r=>routeOrderPriceLines(data,{items:r.items,customerId:r.customerId,date},h.normalPrice);
 const creditExceeded=r=>{const c=data.customers.find(c=>c.id===r.customerId);return r.payment!=='efectivo'&&c?.creditLimit>0&&moneyCents(r.total)>Math.max(0,moneyCents(c?.creditLimit||0)-moneyCents(customerCreditBalance(r.customerId,data.entries)))};
 const creditApproved=r=>r.creditApproval?.customerId===r.customerId&&r.creditApproval?.totalCents===moneyCents(r.total)&&r.creditApproval?.payment===r.payment;
 const creditPending=r=>routePolicy(data,r.route).requireCreditApproval&&creditExceeded(r)&&!creditApproved(r);
 const checkOrderReady=async r=>{check(!creditPending(r),'El crédito del pedido requiere aprobación del supervisor.');await h.checkOrderPrices?.(r);check(!priceLines(r).some(i=>i.specialPrice)||r.priceApproval,'Autoriza el precio especial del pedido antes de prepararlo.');};
 if(b.operation==='routePolicy'){
  manage();if(!b.id)check(a.owner,'Solo el dueño cambia la política general de la empresa.');
  const policy={};for(const key of ['requireCreditApproval','allowSaleWithoutLoad']){check(typeof b[key]==='boolean'||b.id&&b[key]===null,'Política de ruta inválida.');if(b[key]!==null)policy[key]=b[key];}
  if(b.id){const r=get('route-definition');r.routePolicy=policy;r.events.push(event);return r.id}
  data.cfg.routePolicy=policy;return 'route-policy';
 }
 if(b.operation==='routeApproveOrder'){
  manage();const r=get('route-order');check(!['Entregado','Cancelado'].includes(r.status)&&text(b.reason),'Selecciona un pedido abierto e indica el motivo.');
  const lines=priceLines({...r,date});if(lines.some(i=>i.specialPrice)||r.priceApproval){check(h.approveOrderPrices,'No está disponible la autorización de precios.');r.priceApproval=await h.approveOrderPrices(r);}r.priceLines=lines;
  r.creditApproval={id:randomUUID(),customerId:r.customerId,totalCents:moneyCents(r.total),payment:r.payment,approvedBy:actor,at,reason:text(b.reason,1000)};
  if(r.status==='Pendiente de aprobación')r.status='Enviado';r.events.push(event);return r.id;
 }
 if(b.operation==='routeDefinition'){
  manage();check(text(b.name)&&text(b.zone,100),'Indica nombre y ruta/zona.');
  const targetCents=Number(b.targetCents||0);check(Number.isSafeInteger(targetCents)&&targetCents>=0&&targetCents<=99999999900,'Meta inválida.');
  const config=Array.isArray(b.commissions)?b.commissions:[];check(config.length<=100,'Demasiadas comisiones.');
  if(config.length){permit('comisiones');permit('personal');}
  const commissions=config.map(c=>{assigned(c.memberId);check(data.employees.some(e=>e.id===c.employeeId&&e.active!==false),'Vincula un empleado activo de Personal.');const rate=Number(c.rate);check(Number.isFinite(rate)&&rate>=0&&rate<=100,'Porcentaje de comisión inválido.');return {memberId:c.memberId,employeeId:c.employeeId,rate}});
  check(new Set(commissions.map(c=>c.memberId)).size===commissions.length,'Trabajador duplicado en comisiones.');
  const existing=ofKind('route-definition').find(r=>r.route===text(b.zone,100));if(existing){existing.name=text(b.name);existing.targetCents=targetCents;if(b.commissions!==undefined)existing.commissions=commissions;existing.events.push(event);return existing.id}
  return add('route-definition',{name:text(b.name),route:text(b.zone,100),targetCents,commissions,status:'Activa'}).id;
 }
 if(b.operation==='routeCustomer'){
  const source=b.customer||{},id=source.id||randomUUID();check(/^[a-z0-9-]{1,80}$/.test(id),'Identificador de cliente inválido.');const previous=data.customers.find(c=>c.id===id);check(!previous||routeCustomerAllowed(data,a,id),'Cliente fuera de tu ruta.');
  if(worker&&previous)check(previous.sellerId===actor,'Solo puedes editar tus propios clientes.');
  const record={...previous,id};for(const [key,max] of Object.entries({name:200,taxId:80,phone:80,email:254,address:1000,contact:200,notes:4000,routeZone:100,currency:20}))record[key]=text(source[key]??previous?.[key],max);
  check(record.name&&record.currency&&(!record.email||/^\S+@\S+\.\S+$/.test(record.email)),'Revisa nombre, moneda y correo.');
  record.visitDays=source.visitDays||previous?.visitDays||[];record.routeOrder=Number(source.routeOrder??previous?.routeOrder??0);record.sellerId=worker?actor:source.sellerId||previous?.sellerId||'';
  if(record.sellerId){const m=assigned(record.sellerId);record.seller=m.name}else record.seller=text(source.seller??previous?.seller);
  if(worker){record.paymentType=previous?.paymentType||'contado';record.creditLimit=previous?.creditLimit||0;record.creditDays=previous?.creditDays||30;record.status=previous?.status||'activo'}else{record.paymentType=source.paymentType;record.creditLimit=Number(source.creditLimit||0);record.creditDays=Number(source.creditDays||30);record.status=source.status||'activo'}
  check(Array.isArray(record.visitDays)&&record.visitDays.length<=7&&new Set(record.visitDays).size===record.visitDays.length&&record.visitDays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&Number.isSafeInteger(record.routeOrder)&&record.routeOrder>=0&&record.routeOrder<=100000,'Días de visita u orden inválidos.');
  check(['contado','credito'].includes(record.paymentType)&&['activo','suspendido','inactivo'].includes(record.status)&&Number.isSafeInteger(record.creditDays)&&record.creditDays>=1&&record.creditDays<=3650&&Number.isFinite(record.creditLimit)&&record.creditLimit>=0&&record.creditLimit<=999999999999,'Condiciones comerciales inválidas.');moneyCents(record.creditLimit);
  check(!record.taxId||!data.customers.some(c=>c.id!==id&&c.taxId?.toLowerCase()===record.taxId.toLowerCase()),'Identificación ya registrada.');
  if(previous)Object.assign(previous,record);else data.customers.push(record);return id;
 }
 if(b.operation==='routeOrder'){
  check(!worker||['route_seller','route_preseller'].includes(a.routeRole),'Tu rol no toma pedidos.');
  const old=b.id?get('route-order'):null;check(!old||['Borrador','Enviado','Pendiente de aprobación'].includes(old.status)&&!(old.deliveries||[]).length,'Solo se editan pedidos sin facturar en Borrador o Enviado.');
  check(!Number(b.discount||0),'Indica las rebajas en el precio por línea; requieren autorización del supervisor.');
  const c=customer(b.customerId),list=items(b.items),due=h.date(b.due);check(due>=date&&['Borrador','Enviado'].includes(b.status)&&['efectivo','credito','mixto'].includes(b.payment),'Revisa fecha, estado y pago previsto.');
  const values={name:text(b.name)||'Pedido · '+c.name,customerId:c.id,route:c.routeZone||text(b.zone,100),due,items:list,remaining:structuredClone(list),...invoiceTotals(list),status:b.status,payment:b.payment,note:text(b.note,1000),reserved:false};
  values.priceLines=priceLines({...values,date});values.priceApproval=null;values.creditApproval=null;if(values.status==='Enviado'&&(creditPending(values)||values.priceLines.some(i=>i.specialPrice)))values.status='Pendiente de aprobación';
  if(old){Object.assign(old,values);old.events.push(event)}const r=old||add('route-order',{...values,deliveries:[]});
  if(r.priceLines?.some(i=>i.specialPrice))notice('precio-especial',r.id,'Precio especial pendiente · '+c.name);
  if(r.status==='Enviado')notice('pedido',r.id,'Pedido enviado · '+c.name);if(c.creditLimit>0&&moneyCents(r.total)>Math.max(0,moneyCents(c.creditLimit)-moneyCents(customerCreditBalance(c.id,data.entries))))notice('credito',r.id,'Crédito disponible excedido · '+c.name);return r.id;
 }
 if(b.operation==='routeOrderState'){
  const r=get('route-order');const cancelPrepared=manager&&r.status==='Preparado'&&b.status==='Cancelado'&&!(r.deliveries||[]).length;
  check(cancelPrepared||['Borrador','Enviado','Pendiente de aprobación'].includes(r.status)&&!(r.deliveries||[]).length&&['Enviado','Cancelado'].includes(b.status),'El pedido ya fue preparado, facturado o cancelado.');
  if(cancelPrepared){const load=get('commerce-load',r.loadId);check(!load.closed&&load.status==='Preparada','La carga ya salió; registra el regreso en su liquidación.');for(const i of r.remaining.filter(i=>i.q>0)){const left=load.remaining.find(x=>x.p===i.p);check(left&&left.q>=i.q,'Saldo de carga insuficiente para liberar el pedido.');left.q=qty(left.q-i.q)}load.unloaded||=[];load.unloaded.push({...event,orderId:r.id,items:structuredClone(r.remaining)});load.orderIds=(load.orderIds||[]).filter(id=>id!==r.id);load.events.push(event);r.reserved=false;r.loadId='';}

  check(b.status!=='Cancelado'||text(b.reason),'Indica el motivo de cancelación.');r.status=b.status;if(r.status==='Enviado'&&(creditPending(r)||priceLines(r).some(i=>i.specialPrice)&&!r.priceApproval))r.status='Pendiente de aprobación';r.events.push(event);if(b.status==='Enviado')notice('pedido',r.id,'Pedido enviado · '+r.name);return r.id;
 }
 const reschedulePlan=(r,due,reason)=>{
  check(['Enviado','Por reprogramar','No entregado','Parcial'].includes(r.status)&&!r.reserved&&!ofKind('commerce-load').some(l=>l.id===r.loadId&&!l.closed),'Liquida la carga antes de reprogramar el remanente.');
  check(r.remaining?.some(i=>i.q>0),'El pedido no tiene cantidades pendientes.');
  const next=h.date(due),why=text(reason,1000);check(next>=date&&why,'Indica una fecha vigente y un motivo de reprogramación.');
  return {r,due:next,reason:why};
 };
 const applyReschedule=({r,due,reason})=>{const previousDue=r.due;r.due=due;r.status=creditPending(r)||priceLines(r).some(i=>i.specialPrice)&&!r.priceApproval?'Pendiente de aprobación':'Enviado';r.events.push({...event,action:'routeReschedule',previousDue,due,reason,operationId:b.operationId});};
 if(b.operation==='routeReschedule'){
  manage();const plan=reschedulePlan(get('route-order'),b.due,b.reason);applyReschedule(plan);return plan.r.id;
 }
 if(b.operation==='routeReassignLoad'){
  manage();const l=get('commerce-load'),m=assigned(b.memberId);check(!l.closed&&['route_driver','route_seller'].includes(m.routeRole),'Carga o trabajador inválido.');l.assignedMemberId=m.id;l.receivedBy=m.name;l.events.push(event);for(const order of ofKind('route-order').filter(r=>r.loadId===l.id&&!['Entregado','Cancelado'].includes(r.status))){order.assignedMemberId=m.id;order.events.push(event)}return l.id;
 }
 if(b.operation==='routeAssign'){
  manage();const m=assigned(b.memberId);if(b.customerId){const c=customer(b.customerId);c.sellerId=m.id;c.seller=m.name;return c.id}
  const r=get('route-order');check(!['Entregado','Cancelado'].includes(r.status),'El pedido está cerrado.');check(['route_driver','route_seller'].includes(m.routeRole),'Asigna un entregador o vendedor de ruta.');if(r.loadId){const l=get('commerce-load',r.loadId);check(l.assignedMemberId===m.id,'La carga pertenece a otro trabajador. Reasigna primero la carga completa.');}r.assignedMemberId=m.id;r.deliveryOrder=Number(b.deliveryOrder||0);check(Number.isSafeInteger(r.deliveryOrder)&&r.deliveryOrder>=0,'Orden inválido.');r.events.push(event);return r.id;
 }
 if(b.operation==='routePrepare'){
  manage();const m=assigned(b.memberId);check(['route_driver','route_seller'].includes(m.routeRole),'Asigna un entregador o vendedor.');
  check(Array.isArray(b.orderIds)&&b.orderIds.length&&b.orderIds.length<=200&&new Set(b.orderIds).size===b.orderIds.length,'Selecciona pedidos enviados.');
  const deliveryDate=h.date(b.deliveryDate);check(deliveryDate>=date,'La fecha de entrega debe estar vigente.');
  const orders=b.orderIds.map(id=>get('route-order',id)),changes=b.reschedules||[];
  check(Array.isArray(changes)&&changes.length<=200&&new Set(changes.map(c=>c.orderId)).size===changes.length&&changes.every(c=>b.orderIds.includes(c.orderId)),'Reprogramaciones inválidas o repetidas.');
  const plans=[];
  for(const r of orders){
   check(r.route===b.zone&&!r.reserved&&!ofKind('commerce-load').some(l=>l.id===r.loadId&&!l.closed),'Selecciona pedidos libres de la misma ruta.');
   const change=changes.find(c=>c.orderId===r.id);
   if(change){check(r.due<date||r.status==='Por reprogramar','Reprograma por separado los pedidos que todavía no están atrasados.');plans.push(reschedulePlan(r,deliveryDate,change.reason));}
   else check(r.status==='Enviado'&&r.due===deliveryDate,'Incluye un motivo para reprogramar cada pedido atrasado o remanente.');
  }
  for(const r of orders)await checkOrderReady(r);
  const demand=new Map();for(const r of orders)for(const i of r.remaining.filter(i=>i.q>0))demand.set(i.p,normalizeItemQuantity((demand.get(i.p)||0)+i.q));
  const shortages=[...demand].map(([p,q])=>({p,q:Math.max(0,qty(Math.max(0,q+commerceReserved(data,p)-data.products.find(x=>x.id===p).stock)))})).filter(i=>i.q>0);
  if(shortages.length){const existing=ofKind('route-purchase-suggestion').find(r=>r.due===b.deliveryDate&&r.route===b.zone&&r.status==='Pendiente');if(existing){existing.items=shortages.map(i=>({...i,u:0}));existing.events.push(event);return existing.id}return add('route-purchase-suggestion',{name:'Sugerencia de compra · '+b.zone,due:h.date(b.deliveryDate),route:text(b.zone,100),items:shortages.map(i=>({...i,u:0}))}).id;}
  const route=ofKind('route-definition').find(r=>r.route===b.zone);check(route,'Registra primero la ruta/zona.');
  for(const plan of plans)applyReschedule(plan);
  const load=add('commerce-load',{name:'Salida · '+b.zone,status:'Preparada',routeId:route.id,route:text(b.zone,100),assignedMemberId:m.id,receivedBy:m.name,handedBy:event.actor,loadType:'Entregas de preventa',items:[...demand].map(([p,q])=>({p,q,u:0})),remaining:[...demand].map(([p,q])=>({p,q,u:0})),sales:[],closed:false,reloads:[],pickingOrders:orders.map((r,i)=>({orderId:r.id,customerId:r.customerId,deliveryOrder:i+1,items:r.remaining.filter(i=>i.q>0).map(i=>({p:i.p,q:i.q}))})),orderIds:orders.map(r=>r.id)});
  for(const [index,r] of orders.entries()){r.status='Preparado';r.assignedMemberId=m.id;r.deliveryOrder=index+1;r.loadId=load.id;r.reserved=true;r.events.push(event);notice('listo',r.id,'Pedido listo · '+r.name)}return load.id;
 }
 if(b.operation==='routeDispatch'){
  manage();const l=get('commerce-load');unlocked(l);check(!l.closed&&l.status==='Preparada','La salida ya está en reparto o cerrada.');l.status='En reparto';l.departedAt=at;l.events.push(event);for(const id of l.orderIds||[]){const r=get('route-order',id);if(r.status==='Preparado'){r.status='En reparto';r.events.push(event)}}return l.id;
 }
 if(b.operation==='routeReload'){
  manage();const l=get('commerce-load');check(!l.closed,'Carga cerrada.');unlocked(l);const list=quantities(b.items).filter(i=>i.q>0);check(list.length,'Agrega productos a la recarga.');commerceCheckStock(data,{items:list},check);
  for(const i of list){for(const field of ['items','remaining']){const row=l[field].find(x=>x.p===i.p);if(row)row.q=normalizeItemQuantity(row.q+i.q);else l[field].push({...i,u:0})}}
  l.reloads||=[];l.reloads.push({...event,items:list});l.events.push(event);return l.id;
 }
 if(b.operation==='routeDelivery'){
  check(!worker||['route_driver','route_seller'].includes(a.routeRole),'Tu rol no realiza entregas.');const r=get('route-order');check(['En reparto','Parcial'].includes(r.status)&&r.reserved,'El pedido no está en reparto.');
  const deliveryId=text(b.deliveryId,80);check(/^[a-f0-9-]{36}$/.test(deliveryId),'Identificador de entrega inválido.');check(!ofKind('route-delivery').some(x=>x.deliveryId===deliveryId),'Esta entrega ya está registrada; recarga sus documentos.');
  const actual=quantities(b.items).filter(i=>i.q>0);check(actual.length,'Indica lo recibido.');const list=actual.map(i=>{const pending=r.remaining.find(x=>x.p===i.p);check(pending&&i.q<=pending.q,'La entrega supera lo pendiente.');const submitted=b.items.find(x=>x.p===i.p);check(submitted.u===undefined||moneyCents(submitted.u)===moneyCents(pending.u),'El precio de entrega no coincide con el precio del pedido.');return {...pending,q:i.q}});
  const proof={at,signedBy:text(b.signedBy,160)};if(b.signature){check(Array.isArray(b.signature)&&b.signature.length<=100&&b.signature.flat().length<=1200&&b.signature.every(stroke=>Array.isArray(stroke)&&stroke.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=600&&p[1]>=0&&p[1]<=160)),'Firma inválida.');proof.signature=structuredClone(b.signature);}if(b.location){const {latitude,longitude,accuracy}=b.location;check(Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)&&Math.abs(longitude)<=180&&Number.isFinite(accuracy)&&accuracy>=0,'Ubicación inválida.');proof.location={latitude,longitude,accuracy}}
  const l=r.loadId?get('commerce-load',r.loadId):null;check(!l||!l.closed,'La carga fue cerrada; prepara una nueva salida.');
  if(l)unlocked(l);
  const bill=await h.sale({...b,items:list,customerId:r.customerId,commerceLoadId:l?.id||'',discount:0,loyalty:false,previousDay:false,commercePresentations:[],routeOrderId:r.id},l?null:r.id,r);
  if(b.photo){check(h.storePhoto,'No está disponible el adjunto privado.');proof.photo=await h.storePhoto(b.photo);}
  const d=add('route-delivery',{name:'Entrega · '+r.name,deliveryId,orderId:r.id,customerId:r.customerId,route:r.route,assignedMemberId:r.assignedMemberId,entryId:bill.id,items:list,proof,status:'Entregado',...invoiceTotals(list)});
  bill.routeOrderId=r.id;bill.routeDeliveryId=d.id;bill.route=r.route;for(const i of actual){const left=r.remaining.find(x=>x.p===i.p);left.q=qty(left.q-i.q)}r.deliveries||=[];r.deliveries.push(d.id);r.status=r.remaining.some(i=>i.q>0)?'Parcial':'Entregado';r.reserved=r.status==='Parcial';r.events.push({...event,entryId:bill.id,deliveryId:d.id});return bill.id;
 }
 if(b.operation==='routeNotDelivered'){
  const r=get('route-order');check(['En reparto','Parcial'].includes(r.status)&&['ausente','rechazó','sin dinero','dirección incorrecta'].includes(b.reason),'Indica un motivo válido.');const d=add('route-delivery',{name:'No entregado · '+r.name,orderId:r.id,customerId:r.customerId,route:r.route,assignedMemberId:r.assignedMemberId,status:'No entregado',reason:b.reason,proof:{at}});r.events.push(event);notice('no-entregado',d.id,d.name+' · '+b.reason);return d.id;
 }
 if(b.operation==='routeVisit'){
  const c=customer(b.customerId);check(['Sin compra','Realizada','No visitado'].includes(b.result),'Estado de visita inválido.');check(b.result!=='Sin compra'||['cerrado','sin dinero','tiene stock','otro'].includes(b.reason),'Indica el motivo de no compra.');return add('commerce-visit',{name:c.name,customerId:c.id,zone:c.routeZone||'',seller:event.actor,...(b.location?{location:location(b.location)}:{}),result:b.result,note:text(b.reason,500),status:b.result}).id;
 }
 if(b.operation==='routeCollect'){
  check(a.routeRole!=='route_preseller','El preventista no cobra.');const e=data.entries.find(e=>e.id===b.invoiceId&&['venta','factura'].includes(e.type)&&(e.creditAmount>0||e.pay==='1201'));check(e,'Factura de crédito inexistente.');customer(e.customerId);const balance=invoiceLinkedEntries(data.entries,e.id).flatMap(x=>x.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0),amount=Number(b.amountCents);check(Number.isSafeInteger(amount)&&amount>0&&amount<=balance&&['efectivo','transferencia','tarjeta'].includes(b.method),'Revisa importe y forma de cobro.');
  const shift=h.shift(b.shiftId);const entry=h.entry({date,type:'abono',routeMovement:true,routeCashCents:b.method==='efectivo'?amount:0,invoiceId:e.id,customerId:e.customerId,operatorId:actor,shiftId:shift.id,route:e.route||data.customers.find(c=>c.id===e.customerId)?.routeZone||'',...movementLoad(),reference:'REC-'+b.operationId.slice(0,8),desc:'Cobro en ruta · '+e.reference,total:amount/100,pay:b.method==='efectivo'?'1104':'1102',lines:[{a:b.method==='efectivo'?'1104':'1102',d:amount/100,c:0},{a:'1201',d:0,c:amount/100}]});return add('route-collection',{name:entry.reference,entryId:entry.id,invoiceId:e.id,invoiceReference:e.reference,customerId:e.customerId,route:entry.route,amountCents:amount,method:b.method,status:'Cobrado'}).id;
 }
 if(b.operation==='routeExpense'){
  check(a.routeRole!=='route_preseller','El preventista no opera caja.');const n=Number(b.amountCents);check(Number.isSafeInteger(n)&&n>0&&n<=99999999900&&text(b.reason),'Indica gasto y motivo.');const shift=h.shift(b.shiftId);check(h.cashAvailable(shift)>=n,'Efectivo insuficiente en tu turno.');const entry=h.entry({date,type:'gasto',...movementLoad(),routeMovement:true,routeCashCents:-n,operatorId:actor,shiftId:shift.id,desc:'Gasto de ruta · '+text(b.reason),total:n/100,pay:'1104',lines:[{a:'6104',d:n/100,c:0},{a:'1104',d:0,c:n/100}]});return add('route-expense',{name:text(b.reason),entryId:entry.id,amountCents:n,route:text(b.zone,100),status:'Registrado'}).id;
 }
 if(b.operation==='routeRejectSettlement'){
  manage();const r=get('route-settlement');check(r.status==='Pendiente'&&text(b.reason),'Selecciona una liquidación pendiente e indica el motivo.');r.status='Rechazada';r.rejectedBy=event.actor;r.rejectedAt=at;r.events.push(event);get('commerce-load',r.loadId).events.push(event);return r.id;
 }
 if(b.operation==='routeSettle'||b.operation==='routeApproveSettlement'){
  const approval=b.operation==='routeApproveSettlement';if(approval)manage();const l=get('commerce-load');check(!l.closed,'La carga ya fue liquidada.');
  const pending=ofKind('route-settlement').find(r=>r.loadId===l.id&&r.status==='Pendiente');check(approval?!!pending:!pending,approval?'No hay liquidación pendiente.':'La carga tiene una liquidación pendiente.');
  const unfinished=(l.orderIds||[]).map(id=>byId.get(id)).filter(r=>r&&!['Entregado','Cancelado'].includes(r.status)&&r.remaining?.some(i=>i.q>0));
  const orderReasons=unfinished.map(r=>({orderId:r.id,reason:text(b.orderReasons?.find(x=>x.orderId===r.id)?.reason,1000)}));check(orderReasons.every(r=>r.reason),'Indica un motivo por cada pedido no entregado o parcial.');
  const counted=quantities(b.items);check(counted.length===l.remaining.length&&l.remaining.every(i=>counted.some(x=>x.p===i.p)),'Cuenta todos los productos del camión.');
  const differences=counted.map(i=>({...i,expected:l.remaining.find(x=>x.p===i.p).q,difference:Math.round((i.q-l.remaining.find(x=>x.p===i.p).q)*1000)/1000}));
  const financial=Number(b.countedCents);check(Number.isSafeInteger(financial)&&financial>=0,'Efectivo contado inválido.');
  const memberId=l.assignedMemberId||l.operatorId,cashRows=commerceRouteCashRows(rows,data.entries,l.routeId,date,memberId,l.id);
  const expectedCents=cashRows.reduce((n,r)=>n+r.amountCents,0),differenceCents=financial-expectedCents;
  check(!differences.some(i=>i.difference)||text(b.reason),'Explica diferencias de mercadería.');
  if(!manager&&(differences.some(i=>i.difference)||differenceCents)){const r=add('route-settlement',{name:'Liquidación pendiente · '+l.name,loadId:l.id,assignedMemberId:memberId,route:l.route,orderReasons,cashRows,counts:differences,amountCents:expectedCents,receivedCents:financial,differenceCents,reason:text(b.reason),status:'Pendiente'});notice('diferencia',r.id,r.name);return r.id;}
  check(!differenceCents&&!differences.some(i=>i.difference)||text(b.reason),'Indica motivo y confirma las diferencias.');
  // The truck is a reservation. Only actual shortages/surpluses change branch stock.
  for(const i of differences.filter(i=>i.difference)){await h.adjust({productId:i.p,delta:i.difference,date,reason:text(b.reason)})}
  l.returnedItems=structuredClone(counted);l.remaining=[];l.closed=true;l.status='Entregada';l.events.push(event);
  for(const order of unfinished){order.loadId='';order.reserved=false;order.status='Por reprogramar';order.events.push({...event,action:'Por reprogramar',loadId:l.id,reason:orderReasons.find(r=>r.orderId===order.id).reason})}
  const r=add('route-settlement',{name:'Liquidación · '+l.name,loadId:l.id,assignedMemberId:memberId,route:l.route,orderReasons,...commerceRouteProfit((l.sales||[]).flatMap(id=>invoiceLinkedEntries(data.entries,id))),counts:differences,entryIds:cashRows.map(e=>e.entryId),cashRows,bankCents:cashRows.reduce((n,e)=>n+e.bankCents,0),creditCents:cashRows.reduce((n,e)=>n+(e.creditCents||0),0),collectionCents:cashRows.reduce((n,e)=>n+(e.collectionCents||0),0),expenseCents:cashRows.reduce((n,e)=>n+(e.expenseCents||0),0),amountCents:expectedCents,receivedCents:financial,differenceCents,status:'Aprobada',approvedBy:event.actor,reason:text(b.reason)});for(const pending of ofKind('route-settlement').filter(x=>x.loadId===l.id&&x.status==='Pendiente')){pending.status='Aprobada';pending.approvalId=r.id}return r.id;
 }
 if(b.operation==='routeReturnRequest'){
  const e=data.entries.find(e=>e.id===b.invoiceId&&e.type==='venta');check(e,'Factura inexistente.');customer(e.customerId);check(['dañado','vencido','error de pedido','otro'].includes(b.reason)&&['camion','inventario','merma'].includes(b.destination),'Indica motivo y destino.');check(!['dañado','vencido'].includes(b.reason)||b.destination==='merma','Dañados y vencidos no vuelven a existencias vendibles.');const list=quantities(b.items).filter(i=>i.q>0);check(list.length&&list.every(i=>e.items.some(x=>x.p===i.p&&x.q>=i.q)),'Cantidades de devolución inválidas.');
  const l=b.loadId?get('commerce-load',b.loadId):null;check(b.destination!=='camion'||l&&!l.closed,'Selecciona tu carga activa.');return add('route-return',{name:'Devolución · '+e.reference,invoiceId:e.id,customerId:e.customerId,route:e.route||'',items:list,destination:b.destination,loadId:l?.id||'',reason:b.reason,status:'Pendiente'}).id;
 }
 if(b.operation==='routeReturnApprove'){
  manage();const r=get('route-return');check(r.status==='Pendiente'&&!r.entryId,'Devolución ya procesada.');const note=await h.credit({...b,id:r.invoiceId,items:r.items,reason:r.reason,reasonCategory:'devolución'});
  if(r.destination==='merma')for(const i of note.items.filter(i=>!i.service))await h.adjust({productId:i.p,delta:-i.q,date,reason:'Devolución '+r.reason});
  if(r.destination==='camion'){const l=get('commerce-load',r.loadId);check(!l.closed,'La carga está cerrada.');for(const i of note.items.filter(i=>!i.service)){const left=l.remaining.find(x=>x.p===i.p);if(left)left.q=normalizeItemQuantity(left.q+i.q);else l.remaining.push({p:i.p,q:i.q,u:0});}l.customerReturns||=[];l.customerReturns.push({entryId:note.id,items:r.items});}
  r.status='Aprobada';r.entryId=note.id;r.events.push(event);note.routeReturnId=r.id;note.route=r.route;note.commerceLoadId=data.entries.find(e=>e.id===r.invoiceId)?.commerceLoadId||'';return r.id;
 }
 check(false,'Operación de ruta desconocida.');
}

// Proposals use the established Comisiones collection; accrual/payment remain explicit.
export function routeCommission(data,entry,memberIds){
 const route=(data.businessRecords||[]).find(r=>r.kind==='route-definition'&&r.route===entry.route);
 for(const config of route?.commissions||[]){if(!memberIds.includes(config.memberId)||!config.rate||!data.employees.some(e=>e.id===config.employeeId&&e.active!==false))continue;
  if(data.businessRecords.some(r=>r.module==='comisiones'&&r.saleId===entry.id&&r.employeeId===config.employeeId))continue;
  data.businessRecords.push({id:randomUUID(),module:'comisiones',kind:'ruta',name:'Comisión · '+entry.reference,date:entry.date,status:'Pendiente',branchId:entry.branchId,employeeId:config.employeeId,saleId:entry.id,routeMemberId:config.memberId,rate:config.rate,paid:0,events:[{date:entry.date,action:'Propuesta de comisión de ruta',entryId:entry.id}]});
 }
}
