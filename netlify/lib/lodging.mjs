import {randomUUID,createHash} from 'node:crypto';
import {operationalType} from './business-profile.mjs';
import {invoiceTotals,moneyCents,businessBillItems,businessDayKey} from './accounting-engine.mjs';
export const LODGING_OPS=['lodgingCancel','lodgingMaintenanceCost','lodgingRequest','lodgingTenant','lodgingShare','lodgingSecurity','lodgingUnit','lodgingBooking','lodgingGuest','lodgingCharge','lodgingTask','lodgingInspection','lodgingPhoto','lodgingTerms','lodgingRenew','lodgingClose','lodgingProspect'];
const text=(v,n=500)=>String(v??'').trim().slice(0,n);
export const lodgingInternal=r=>['lodging-unit','lodging-close','lodging-prospect'].includes(r?.kind);
export function lodgingUnitFor(data,r){return (data.businessRecords||[]).find(u=>u.kind==='lodging-unit'&&u.id===r.unitId&&u.branchId===r.branchId)}
export function lodgingEntry(data,r,check){if(!r.unitId)return;const u=lodgingUnitFor(data,r);check(u&&u.active!==false,'Unidad no disponible.');check(!(data.businessRecords||[]).some(o=>o.id!==r.id&&o.unitId===u.id&&o.branchId===r.branchId&&o.status==='Ocupada'),'La unidad todavía tiene un huésped dentro.');check(!u.tasks?.some(t=>t.blocking&&t.state!=='Completada'),'La unidad tiene mantenimiento pendiente.');if(u.operationalProfile==='hotel')check(u.cleaning==='lista','La habitación debe estar lista antes de la entrada.');}
export function lodgingExit(data,r,day){const u=lodgingUnitFor(data,r);if(u&&u.operationalProfile==='hotel'){u.cleaning='sucia';u.tasks||=[];u.tasks.push({id:randomUUID(),date:day,type:'Limpieza',state:'Pendiente',note:'Salida · '+r.name,blocking:false});}}
export async function lodgingOperation(data,access,session,b,ctx){
 const {check}=ctx,rows=data.businessRecords||=[],profile=operationalType(access.company),day=ctx.date(b.date),permit=m=>ctx.permit(access,m,true);
 check(['hotel','alquiler'].includes(profile)&&access.branchId&&b.confirmed===true,'Selecciona una sucursal de hotel o alquiler y confirma.');
 const r=b.id?rows.find(r=>r.id===b.id&&r.branchId===access.branchId):null;
 const module=r?.module||b.module||'reservas';check(['reservas','contratos'].includes(module),'Módulo inválido.');permit(module);if(r?.unitId)ctx.readPermit(access,'reservas');
 const event=(target,action)=>{target.events||=[];target.events.push({date:day,action,actor:session.email});};
 const cents=v=>{check(Number.isSafeInteger(v)&&v>=0&&v<=99999999900,'Importe en centavos inválido.');return v};
 const unit=id=>{ctx.readPermit(access,'reservas');const u=rows.find(r=>r.id===id&&r.kind==='lodging-unit'&&r.branchId===access.branchId&&r.active!==false);check(u,'Unidad no encontrada.');return u;};
 if(b.operation==='lodgingUnit'){
  check(access.owner&&module==='reservas','Solo el dueño administra unidades.');
  check(!r||r.kind==='lodging-unit','Unidad inválida.');
  const name=text(b.name,200),capacity=Number(b.capacity);check(name&&Number.isInteger(capacity)&&capacity>0&&capacity<=1000,'Nombre o capacidad inválidos.');
  check(!rows.some(o=>o.id!==r?.id&&o.kind==='lodging-unit'&&o.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Ya existe esa unidad.');
  check(['sucia','limpiando','lista'].includes(b.cleaning),'Estado de limpieza inválido.');
  const p=data.products.find(p=>p.id===b.productId&&p.kind==='service');ctx.readPermit(access,'inventario');check(p,'Selecciona un servicio de alojamiento o alquiler.');
  const rules=Array.isArray(b.rules)?b.rules:[];check(rules.length<=30,'Máximo 30 reglas de tarifa.');
  const priceRules=rules.map(t=>{const from=ctx.date(t.from),to=ctx.date(t.to),weekdays=t.weekdays||[0,1,2,3,4,5,6],minOccupancy=Number(t.minOccupancy||0);check(from<=to&&Array.isArray(weekdays)&&weekdays.length&&weekdays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&Number.isFinite(minOccupancy)&&minOccupancy>=0&&minOccupancy<=100,'Regla inválida.');return {from,to,weekdays:[...new Set(weekdays)],minOccupancy,amountCents:cents(t.amountCents),extraPersonCents:cents(t.extraPersonCents||0)};});
  const u=r||{id:randomUUID(),kind:'lodging-unit',module:'reservas',date:day,status:'Reservada',branchId:access.branchId,operationalProfile:profile,events:[]};
  Object.assign(u,{name,capacity,productId:p.id,cleaning:b.cleaning,active:b.active!==false,priceRules,ownerName:text(b.ownerName,200),commissionRate:Number(b.commissionRate||0),nextMaintenance:b.nextMaintenance?ctx.date(b.nextMaintenance):'',meter:text(b.meter,100),rentalTemplate:text(b.rentalTemplate,5000)});
  check(Number.isFinite(u.commissionRate)&&u.commissionRate>=0&&u.commissionRate<=100,'Comisión inválida.');if(!r)rows.push(u);event(u,'Unidad actualizada');return u.id;
 }
 if(b.operation==='lodgingBooking'){
  check(module==='reservas'&&Array.isArray(b.unitIds)&&b.unitIds.length>0&&b.unitIds.length<=50&&new Set(b.unitIds).size===b.unitIds.length,'Selecciona hasta 50 unidades diferentes.');
  const groupId=randomUUID(),ids=[];check(data.customers.some(c=>c.id===b.customerId&&c.status==='activo'),'Selecciona un cliente activo.');
  const start=new Date(b.start),end=new Date(b.end);check(Number.isFinite(+start)&&Number.isFinite(+end)&&end>start&&end-start<=3660*86400000,'Fechas inválidas.');
  const zone=access.company.businessCustomization?.timeZone||'America/Managua',first=businessDayKey(start,zone),last=businessDayKey(end,zone),count=Math.max(1,Math.round((Date.parse(last)-Date.parse(first))/86400000)),available=rows.filter(o=>o.kind==='lodging-unit'&&o.active!==false).length,occupancyByDate={},intervals=rows.filter(o=>!lodgingInternal(o)&&['reservas','contratos'].includes(o.module)&&!['Finalizada','Finalizado','Cancelada'].includes(o.status)&&o.start&&o.end).map(o=>({key:o.unitId||o.resource,from:o.module==='contratos'?o.start.slice(0,10):businessDayKey(o.start,o.timeZone||zone),to:o.module==='contratos'?o.end.slice(0,10):businessDayKey(o.end,o.timeZone||zone)}));
  check(count<=3660,'La reserva supera el plazo permitido.');
  for(let n=0;n<count;n++){const date=new Date(Date.parse(first+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),occupied=new Set(intervals.filter(o=>o.from<=date&&o.to>date).map(o=>o.key)).size;occupancyByDate[date]=available?Math.min(100,Math.round((occupied+b.unitIds.length)*100/available)):0;}
  for(const id of b.unitIds){const u=unit(id),people=Number(b.people);check(Number.isInteger(people)&&people>0&&people<=u.capacity,'Personas por unidad exceden capacidad.');
   check(!u.tasks?.some(t=>t.blocking&&t.state!=='Completada'),'Unidad bloqueada por mantenimiento.');
   check(!rows.some(o=>!lodgingInternal(o)&&['reservas','contratos'].includes(o.module)&&!['Cancelada','Finalizada','Finalizado'].includes(o.status)&&(o.unitId===u.id||o.resource?.toLocaleLowerCase()===u.name.toLocaleLowerCase())&&o.start<end.toISOString()&&o.end>start.toISOString()),'Unidad ocupada en esas fechas.');
   const occupancy=rows.filter(o=>o.kind==='lodging-unit'&&o.active!==false).length,occupied=new Set(rows.filter(o=>o.module==='reservas'&&!lodgingInternal(o)&&o.groupId!==groupId&&!['Cancelada','Finalizada'].includes(o.status)&&o.start<end.toISOString()&&o.end>start.toISOString()).map(o=>o.unitId||o.resource)).size;
   const rec={id:randomUUID(),module:'reservas',kind:'lodging-stay',operationalProfile:profile,branchId:access.branchId,date:day,status:'Reservada',name:text(b.name,200),customerId:b.customerId,unitId:u.id,resource:u.name,start:start.toISOString(),end:end.toISOString(),timeUnit:'noche',timeZone:access.company.businessCustomization?.timeZone||'America/Managua',tariffProductId:u.productId,items:[],events:[],paid:0,people,groupId,origin:text(b.origin,100),lodgingPricing:{people,occupancyByDate,unitCents:moneyCents(data.products.find(p=>p.id===u.productId).price),occupancy:occupancy?Math.min(100,Math.round((occupied+b.unitIds.length)*100/occupancy)):0,rules:structuredClone(u.priceRules||[])}};
   check(rec.name,'Escribe el nombre de la reserva.');rec.total=invoiceTotals(businessBillItems(rec,data.products)).total;rows.push(rec);event(rec,'Reserva de unidad / grupo');ids.push(rec.id);
  }return ids[0];
 }
 if(b.operation==='lodgingClose'){
  check(module==='reservas'&&profile==='hotel'&&day<=businessDayKey(Date.now(),access.company.businessCustomization?.timeZone),'Cierre solo para hotel y fechas no futuras.');ctx.readPermit(access,'ventas');ctx.readPermit(access,'contabilidad');check(!rows.some(r=>r.kind==='lodging-close'&&r.date===day),'El día ya fue cerrado.');
  const u=rows.filter(r=>r.kind==='lodging-unit'&&r.active!==false),stays=rows.filter(r=>r.kind==='lodging-stay'&&r.status!=='Cancelada'&&businessDayKey(r.start,r.timeZone)<=day),occupied=new Set(stays.filter(r=>businessDayKey(r.start,r.timeZone)<=day&&businessDayKey(r.end,r.timeZone)>day).map(r=>r.unitId));
  const invoices=data.entries.filter(e=>e.type==='venta'&&e.date===day&&stays.some(r=>r.id===e.businessId||r.billed?.some(b=>b.entryId===e.id))),incomeCents=invoices.reduce((n,e)=>n+moneyCents(e.total),0),pendingCents=stays.reduce((n,r)=>n+(r.entryId?Math.max(0,data.entries.filter(e=>e.date<=day&&(e.id===r.entryId||e.invoiceId===r.entryId)).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0)):moneyCents(invoiceTotals(businessBillItems(r,data.products)).total)),0);
  const close={id:randomUUID(),module:'reservas',kind:'lodging-close',name:'Cierre hotel · '+day,date:day,status:'Finalizada',branchId:access.branchId,available:u.length,occupied:occupied.size,incomeCents,pendingCents,events:[]};rows.push(close);event(close,'Cierre diario confirmado');return close.id;
 }
 if(b.operation==='lodgingProspect'){
  check(profile==='alquiler'&&module==='reservas','Prospectos solo en alquileres.');const u=unit(b.unitId),rec={id:randomUUID(),module:'reservas',kind:'lodging-prospect',name:text(b.name,200),date:day,status:'Reservada',branchId:access.branchId,unitId:u.id,resource:u.name,visit:b.visit?new Date(b.visit).toISOString():'',note:text(b.note,1000),events:[]};check(rec.name,'Indica nombre.');rows.push(rec);event(rec,'Prospecto / visita');return rec.id;
 }
 check(r&&!['lodging-close','lodging-prospect'].includes(r.kind),'Ficha no encontrada.');
 if(b.operation==='lodgingCancel'){
  check(r.kind==='lodging-stay'&&r.status==='Reservada'&&!r.entryId&&!r.deposit&&!r.securityCents&&text(b.reason),'Devuelve depósitos y explica el motivo antes de cancelar una reserva sin entrada ni factura.');r.status='Cancelada';event(r,'Reserva cancelada · '+text(b.reason));return r.id;
 }
 if(b.operation==='lodgingRequest'){
  const request=r.tenantRequests?.find(x=>x.id===b.requestId);check(request&&['Pendiente','En proceso','Completada'].includes(b.state),'Solicitud inválida.');
  if(b.state==='En proceso'&&!request.taskId){permit('reservas');const u=unit(r.unitId);u.tasks||=[];check(u.tasks.length<2000,'Límite de tareas alcanzado.');const task={id:randomUUID(),date:day,due:day,type:'Mantenimiento',state:'En proceso',note:request.note,blocking:false,amountCents:0};u.tasks.push(task);request.taskId=task.id;}
  if(request.taskId){permit('reservas');const u=unit(r.unitId),task=u.tasks?.find(t=>t.id===request.taskId);check(task,'Tarea no encontrada.');task.state=b.state;}
  request.state=b.state;event(r,'Solicitud del inquilino · '+b.state);return r.id;
 }
 if(b.operation==='lodgingTenant'){
  check(access.owner&&profile==='alquiler'&&['contratos','reservas'].includes(r.module)&&!lodgingInternal(r),'Solo el dueño habilita el acceso del inquilino.');
  const email=text(b.tenantEmail,254).toLowerCase();check(b.enabled===false||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Correo del inquilino inválido.');
  r.tenantEmail=email;r.tenantPhotosAllowed=b.photosAllowed===true;r.tenantEnabled=b.enabled===true;event(r,r.tenantEnabled?'Acceso de inquilino habilitado':'Acceso de inquilino revocado');return r.id;
 }
 if(b.operation==='lodgingShare'){
  check(access.owner&&r.kind==='lodging-unit','Solo el dueño comparte disponibilidad.');
  if(b.revoke===true)delete r.calendarShare;
  else {check(/^[a-f0-9]{64}$/.test(b.shareToken||''),'Enlace inválido.');r.calendarShare={hash:createHash('sha256').update(b.shareToken).digest('hex'),expires:new Date(Date.now()+365*86400000).toISOString()};}
  event(r,b.revoke?'Calendario compartido revocado':'Calendario compartido renovado');return r.id;
 }
 if(b.operation==='lodgingSecurity'){
  check(!lodgingInternal(r)&&['reservas','contratos'].includes(r.module),'Ficha inválida.');permit('contabilidad');permit('cajas');ctx.financialCash(access);
  const total=cents(b.amountCents);check(total>0&&['1101','1102'].includes(b.pay)&&['recibir','devolver','aplicar'].includes(b.action),'Importe o movimiento inválidos.');
  check(data.accounts.some(a=>a.code===b.pay&&a.tipo==='activo'),'Cuenta de dinero inválida.');
  const liability=r.securityAccount||b.liability;check(data.accounts.some(a=>a.code===liability&&a.tipo==='pasivo'&&a.code!=='2107'),'Selecciona una cuenta de pasivo para garantía.');
  const debit=b.action==='recibir'?b.pay:liability,credit=b.action==='recibir'?liability:b.action==='aplicar'?'1201':b.pay;
  if(b.action==='recibir')check(!['Finalizada','Finalizado','Cancelada'].includes(r.status),'Ficha cerrada.');
  else check(total<=(r.securityCents||0),'Excede la garantía pendiente.');
  const invoiceId=b.action==='aplicar'?b.invoiceId:undefined;
  if(invoiceId){check((r.billed||[]).some(x=>x.entryId===invoiceId),'Factura ajena a la ficha.');const balance=data.entries.filter(e=>e.id===invoiceId||e.invoiceId===invoiceId).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);check(total<=balance,'Excede el saldo por cobrar.');}
  check(b.action!=='aplicar'||invoiceId,'Selecciona una factura de daños o alquiler pendiente.');
  const e=ctx.entry(data,session,{date:day,type:'garantia-alquiler',desc:'Garantía · '+b.action+' · '+r.name,total:total/100,businessId:r.id,invoiceId,lines:[{a:debit,d:total/100,c:0},{a:credit,d:0,c:total/100}]});
  r.securityAccount=liability;r.securityCents=cents((r.securityCents||0)+(b.action==='recibir'?total:-total));event(r,'Garantía '+b.action);return e.id;
 }
 if(b.operation==='lodgingMaintenanceCost'){
  check(r.kind==='lodging-unit','Selecciona una unidad.');permit('costos');permit('contabilidad');permit('cajas');ctx.financialCash(access);
  const task=r.tasks?.find(t=>t.id===b.taskId&&t.type==='Mantenimiento');check(task&&!task.entryId,'Selecciona mantenimiento sin costo confirmado.');
  check(['1101','1102','2101'].includes(b.pay),'Cuenta de pago inválida.');
  if(task.supplierId)ctx.readPermit(access,'compras');const cost=ctx.registerCost(data,access,session,{...b,businessId:r.id,supplierId:task.supplierId||''}),entry=data.entries.find(e=>e.id===cost.entryId);entry.businessId=r.id;cost.businessId=r.id;task.entryId=entry.id;task.amountCents=moneyCents(cost.total);event(r,'Costo de mantenimiento confirmado');return entry.id;
 }
 if(b.operation==='lodgingTask'){
  const u=r.kind==='lodging-unit'?r:unit(r.unitId);permit('reservas');u.tasks||=[];
  if(b.taskId){const t=u.tasks.find(t=>t.id===b.taskId);check(t&&['Pendiente','En proceso','Completada'].includes(b.state),'Tarea no encontrada.');t.state=b.state;if(b.supplierId){ctx.readPermit(access,'compras');check(data.suppliers.some(s=>s.id===b.supplierId),'Proveedor inválido.');t.supplierId=text(b.supplierId,80);}if(b.amountCents&&!t.entryId)t.amountCents=cents(b.amountCents);if(b.due)t.due=ctx.date(b.due);if(t.type==='Limpieza'){u.cleaning=b.state==='Completada'?'lista':b.state==='En proceso'?'limpiando':'sucia';}}
  else {check(u.tasks.length<2000&&['Limpieza','Mantenimiento'].includes(b.type)&&text(b.note),'Tarea inválida.');if(b.supplierId){ctx.readPermit(access,'compras');check(data.suppliers.some(s=>s.id===b.supplierId),'Proveedor inválido.');}u.tasks.push({id:randomUUID(),date:day,due:b.due?ctx.date(b.due):day,type:b.type,state:'Pendiente',note:text(b.note,1000),supplierId:text(b.supplierId,80),blocking:b.blocking===true,amountCents:cents(b.amountCents||0)});}
  event(u,'Tarea actualizada');return u.id;
 }
 check(!lodgingInternal(r)||b.operation==='lodgingPhoto','Selecciona una estancia o contrato.');
 if(b.operation==='lodgingGuest'){check(r.kind==='lodging-stay'&&!['Cancelada','Finalizada'].includes(r.status),'Estancia cerrada.');r.guest={document:text(b.document,100),preferences:text(b.preferences,1000)};event(r,'Registro del huésped actualizado');return r.id;}
 if(b.operation==='lodgingCharge'){
  check((r.module==='contratos'||!r.entryId)&&!['Finalizada','Finalizado','Cancelada'].includes(r.status),'La cuenta está facturada o cerrada.');ctx.readPermit(access,'inventario');
  const p=data.products.find(p=>p.id===b.productId),q=Number(b.q);check(p&&Number.isFinite(q)&&q>0&&q<=1000&&Math.round(q*1000)===q*1000,'Producto o cantidad inválidos.');
  check(['Restaurante','Minibar','Lavandería','Daño','Retraso'].includes(b.category),'Tipo de cargo inválido.');if(['Daño','Retraso'].includes(b.category))check(p.kind==='service'&&text(b.note),'Selecciona un servicio y explica el cargo.');
  const target=r.module==='contratos'?(r.rentalCharges||=[]):(r.items||=[]);check(target.length<200,'Máximo 200 consumos.');target.push({p:p.id,q,u:p.price,vatRate:p.vatRate||0,lineId:randomUUID(),note:text(b.category+' · '+text(b.note))});r.total=invoiceTotals(businessBillItems(r,data.products,undefined,r.module==='contratos'?1:undefined)).total;event(r,'Cargo agregado · '+b.category);return r.id;
 }
 if(b.operation==='lodgingInspection'){
  check(['entrada','salida'].includes(b.stage)&&Array.isArray(b.checklist)&&b.checklist.length>0&&b.checklist.length<=30,'Checklist inválido.');r.inspections||=[];check(r.inspections.length<20,'Máximo 20 inspecciones.');r.inspections.push({id:randomUUID(),date:day,stage:b.stage,meter:text(b.meter,100),checklist:b.checklist.map(x=>text(x,300)),note:text(b.note,1000)});event(r,'Inspección de '+b.stage);return r.id;
 }
 if(b.operation==='lodgingPhoto'){
  check(access.owner&&b.authorized===true,'Solo el dueño puede autorizar fotos privadas.');r.receptionPhotos||=[];check(r.receptionPhotos.length<5,'Máximo cinco fotos por ficha.');const photo={...await ctx.storePhoto(b.file),id:randomUUID(),date:day};r.receptionPhotos.push(photo);r.referencePhoto||=photo;event(r,'Foto privada de inspección / mantenimiento');return r.id;
 }
 if(b.operation==='lodgingTerms'){
  check(profile==='alquiler'&&r.module==='contratos'&&r.status==='Activo'&&!r.billed?.length,'Configura las condiciones antes de facturar.');const u=unit(b.unitId);const end=ctx.date(b.renewalDate)+'T00:00:00.000Z',start=r.date+'T00:00:00.000Z';check(end>start,'La renovación debe ser posterior al inicio del contrato.');check(!rows.some(o=>o.id!==r.id&&o.unitId===u.id&&['reservas','contratos'].includes(o.module)&&!['Finalizada','Finalizado','Cancelada'].includes(o.status)&&o.start<end&&o.end>start),'La unidad tiene otro contrato o reserva en ese plazo.');r.unitId=u.id;r.resource=u.name;r.start=start;r.end=end;
  const adjustmentRate=Number(b.adjustmentRate||0),adjustmentEvery=Number(b.adjustmentEvery||12);check(Number.isFinite(adjustmentRate)&&adjustmentRate>=0&&adjustmentRate<=100&&Number.isInteger(adjustmentEvery)&&adjustmentEvery>0&&adjustmentEvery<=120,'Ajuste inválido.');
  r.rentalTerms={template:text(b.template,5000),signature:text(b.signature,200),signedDate:day,adjustmentRate,adjustmentEvery,renewalDate:ctx.date(b.renewalDate),noticeDays:Number(b.noticeDays??30)};check(r.rentalTerms.template&&r.rentalTerms.signature&&Number.isInteger(r.rentalTerms.noticeDays)&&r.rentalTerms.noticeDays>=0&&r.rentalTerms.noticeDays<=365,'Contrato, firma o aviso inválidos.');event(r,'Condiciones y conformidad escrita');return r.id;
 }
 if(b.operation==='lodgingRenew'){
  check(profile==='alquiler'&&r.module==='contratos'&&r.rentalTerms&&r.status==='Activo'&&!r.renewedTo&&!r.deposit&&!r.securityCents&&!r.rentalCharges?.length,'Contrato sin renovación ni anticipo pendiente requerido.');
  check(r.rentalTerms.renewalDate<=day,'La renovación aún no vence.');
  const copy=structuredClone(r);Object.assign(copy,{id:randomUUID(),date:day,entryId:undefined,billed:[],events:[],status:'Activo',paid:0,renewedFrom:r.id,renewedTo:undefined});delete copy.referencePhoto;delete copy.receptionPhotos;copy.inspections=[];copy.tenantRequests=[];copy.rentalTerms.signature=text(b.signature,200);check(copy.rentalTerms.signature,'Confirma la firma escrita de la renovación.');copy.rentalTerms.signedDate=day;copy.start=day+'T00:00:00.000Z';copy.end=ctx.date(b.renewalDate)+'T00:00:00.000Z';check(!rows.some(o=>o.id!==r.id&&o.unitId===r.unitId&&['reservas','contratos'].includes(o.module)&&!['Finalizada','Finalizado','Cancelada'].includes(o.status)&&o.start<copy.end&&o.end>copy.start),'La unidad está comprometida en el nuevo plazo.');copy.items=businessBillItems({...r,rentalCharges:[],serviceRate:0},data.products,undefined,r.periods||1);copy.rentalTerms.renewalDate=ctx.date(b.renewalDate);check(copy.rentalTerms.renewalDate>day,'Indica próximo vencimiento.');r.renewedTo=copy.id;r.status='Finalizado';rows.push(copy);event(r,'Contrato renovado');event(copy,'Renovación confirmada');return copy.id;
 }
 check(false,'Operación no disponible.');
}
