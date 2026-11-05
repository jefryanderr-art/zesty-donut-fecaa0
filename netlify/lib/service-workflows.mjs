import {operationalType} from './business-profile.mjs';
import {randomUUID} from 'node:crypto';
import {SERVICE_PROFILES,SERVICE_MODULES,serviceFields} from '../../public/service-model.mjs';
import {invoiceTotals,moneyCents,normalizeItemQuantity} from './accounting-engine.mjs';
export const SERVICE_OPS=['businessServicesDetails','businessServicesTime','businessServicesProgress','businessServicesAttendance','businessServicesRenew','businessServicesQuote','businessServicesPackage','businessServicesFeedback','businessServicesLaundry','businessServicesPhoto','businessServicesPayments'];
const text=(v,n=500)=>String(v??'').trim().slice(0,n);
export async function serviceWorkflow(data,access,session,b,ctx){
 const {check}=ctx,rows=data.businessRecords||=[],profile=rows.find(r=>r.id===b.id)?.operationalProfile||operationalType(access.company),permit=m=>ctx.permit(access,m,true);
 check(SERVICE_PROFILES.includes(profile)&&access.branchId&&b.confirmed===true,'Selecciona una sucursal de servicios y confirma.');
 const r=rows.find(r=>r.id===b.id&&r.module===b.module);
 check(r&&r.branchId===access.branchId&&SERVICE_MODULES.includes(r.module),'Ficha de servicios no encontrada.');permit(r.module);
 check(!['Cancelada','Cancelado','Finalizada','Finalizado'].includes(r.status),'La ficha está cerrada.');
 const day=ctx.date(b.date||new Date().toISOString().slice(0,10));
 const event=(action,note='',extra={})=>{r.events||=[];r.events.push({date:day,action,actor:session.email,note:text(note,1000),...extra});};
 if(b.operation==='businessServicesDetails'){
  const s={...r.service};
  for(const f of serviceFields(profile)){
   const value=b.details?.[f.key];if(value===undefined)continue;
   if(f.type==='customer'){(ctx.readPermit||ctx.permit)(access,'ventas');check(!value||data.customers.some(c=>c.id===value&&c.status==='activo'),'Responsable de pago inválido.');s[f.key]=value||'';}
   else if(f.type==='date')s[f.key]=value?ctx.date(value):'';
   else if(f.type==='integer'){check(Number.isInteger(value)&&value>=0&&value<=1000000,'Cantidad o plazo inválido.');s[f.key]=value;}
   else if(f.type==='boolean'){check(typeof value==='boolean','Opción inválida.');s[f.key]=value;}
   else s[f.key]=text(value,1000);
  }
  if(profile==='salud')check(b.noSensitiveData===true,'Confirma que no incluyes datos clínicos sensibles.');
  if(profile==='educacion'&&(text(s.scholarship)!==text(r.service?.scholarship)||text(s.siblings)!==text(r.service?.siblings)))check(access.owner&&text(b.reason).length>=3,'Becas y condiciones de hermanos requieren autorización del dueño y motivo.');
  if(s.capacity)check((r.serviceReservations||[]).filter(x=>!x.cancelled).length<=s.capacity,'El cupo es menor a las reservas vigentes.');
  if(profile==='belleza'&&s.suggestedDays&&!s.nextDate)s.nextDate=new Date(Date.parse(day+'T12:00:00Z')+s.suggestedDays*86400000).toISOString().slice(0,10);
  checkServiceSchedule({...r,service:s},rows,check,profile);
  r.service=s;event('Ficha de servicios actualizada',b.reason);return r.id;
 }
 if(b.operation==='businessServicesTime'){
  check(r.module==='proyectos'&&r.customerId&&!r.servicePackage,'Registra tiempo en un proyecto con cliente.');
  const start=new Date(b.start),end=new Date(b.end);check(Number.isFinite(+start)&&Number.isFinite(+end)&&end>start&&end-start<=86400000,'El registro debe durar hasta 24 horas.');
  check(start.toISOString().slice(0,10)>=r.date,'El tiempo precede al proyecto.');
  const employeeId=text(b.employeeId,80);if(employeeId){permit('personal');check(data.employees.some(e=>e.id===employeeId&&e.active!==false),'Empleado inválido.');}
  check(!rows.some(x=>(x.serviceTime||[]).some(t=>(employeeId?t.employeeId===employeeId:!t.employeeId&&t.actor===session.email)&&t.start<end.toISOString()&&t.end>start.toISOString())),'El registro se solapa con otro registro de tiempo.');
  r.serviceTime||=[];check(r.serviceTime.length<2000,'Límite de registros de tiempo alcanzado.');
  r.serviceTime.push({id:randomUUID(),start:start.toISOString(),end:end.toISOString(),minutes:(end-start)/60000,employeeId,actor:session.email,note:text(b.note)});event('Tiempo registrado',b.note);return r.id;
 }
 if(b.operation==='businessServicesProgress'){
  const progress=Number(b.progress);check(r.module==='proyectos'&&Number.isInteger(progress)&&progress>=0&&progress<=100,'Avance inválido.');
  r.serviceProgress=progress;event('Avance '+progress+'%',b.note);return r.id;
 }
 if(b.operation==='businessServicesAttendance'){
  (ctx.readPermit||ctx.permit)(access,'ventas');const c=data.customers.find(c=>c.id===b.customerId&&c.status==='activo');check(c,'Selecciona un cliente autorizado.');
  check(['agenda','reservas','contratos'].includes(r.module),'Usa una clase, cita o membresía.');
  const mode=b.mode;check(['reservar','cancelar','asistencia'].includes(mode),'Acción inválida.');
  r.serviceReservations||=[];const reservations=r.serviceReservations;
  if(mode==='reservar'){
   check(['agenda','reservas'].includes(r.module)&&r.service?.capacity>0,'Configura un cupo de clase.');
   check(!reservations.some(x=>x.customerId===c.id&&!x.cancelled)&&reservations.filter(x=>!x.cancelled).length<r.service.capacity,'Sin cupo o cliente ya reservado.');
   check(reservations.length<2000,'Límite de reservas alcanzado.');reservations.push({id:randomUUID(),customerId:c.id,date:day});
  }else if(mode==='cancelar'){
   const reservation=reservations.find(x=>x.customerId===c.id&&!x.cancelled);check(reservation,'Reserva no encontrada.');reservation.cancelled=true;
  }else{
   check(day>=r.date&&!r.service?.paused&&(!r.service?.expires||day<=r.service.expires),'Membresía pausada o vencida.');
   if(r.module==='contratos')check(r.status==='Activo'&&r.customerId===c.id,'Membresía no disponible para este cliente.');
   if(r.service?.capacity)check(reservations.some(x=>x.customerId===c.id&&!x.cancelled),'Reserva primero un cupo.');
   r.serviceAttendance||=[];check(!r.serviceAttendance.some(x=>x.date===day&&x.customerId===c.id),'Asistencia ya registrada hoy.');
   check(!r.service?.visitLimit||r.serviceAttendance.filter(x=>x.customerId===c.id).length<r.service.visitLimit,'Pase sin visitas disponibles.');
   check(r.serviceAttendance.length<2000,'Límite de asistencias alcanzado.');
   r.serviceAttendance.push({date:day,customerId:c.id,actor:session.email});
  }event('Clase / membresía: '+mode,c.name);return r.id;
 }
 if(b.operation==='businessServicesRenew'){
  check(r.module==='contratos'&&r.status==='Activo'&&!r.renewedTo,'Contrato no renovable o ya renovado.');
  const date=ctx.date(b.newDate),due=ctx.date(b.due);check(date>r.date&&(!(r.service?.renewalDate||r.due)||date>=(r.service?.renewalDate||r.due))&&due>=date,'Revisa las fechas de renovación.');
  const copy={...structuredClone(r),id:randomUUID(),date,due,entryId:undefined,billed:[],deposit:0,paid:0,events:[],servicePaymentPlans:[],serviceAttendance:[],serviceReservations:[],renewedFrom:r.id};
  delete copy.renewedTo;delete copy.referencePhoto;delete copy.receptionPhotos;copy.service={...copy.service,renewalDate:due,expires:due,paused:false};rows.push(copy);r.renewedTo=copy.id;event('Renovación confirmada',b.reason,{targetId:copy.id});return copy.id;
 }
 if(b.operation==='businessServicesQuote'){
  check(day>=r.date,'La conversión precede a la cotización.');
  check(r.module==='documentos_venta'&&r.status==='Pendiente'&&!r.entryId&&!r.convertedProjectId&&r.items?.length,'Selecciona una cotización pendiente con líneas.');permit('proyectos');
  const project={id:randomUUID(),module:'proyectos',kind:'service-project',name:r.name,date:day,status:'Recibida',branchId:access.branchId,customerId:r.customerId,items:structuredClone(r.items),total:r.total,paid:0,events:[],service:structuredClone(r.service||{}),sourceServiceQuoteId:r.id,resource:r.resource||'',responsible:r.responsible||'',project:r.project||'',serviceRate:r.serviceRate||0,serviceProductId:r.serviceProductId||'',deposit:r.deposit||0,depositAccount:r.depositAccount};
  rows.push(project);r.deposit=0;r.convertedProjectId=project.id;r.status='Convertido';event('Cotización convertida a proyecto','',{targetId:project.id});return project.id;
 }
 if(b.operation==='businessServicesPackage'){
  check(r.module==='proyectos'&&r.customerId&&!r.entryId&&!r.billed?.length&&!r.deposit,'Configura el bono antes de anticipos o facturas en un proyecto con cliente.');
  check(!r.serviceRate,'El bono conserva sus precios sin cargo porcentual adicional.');
  check(r.items?.length&&r.items.every(i=>data.products.find(p=>p.id===i.p)?.kind==='service'),'El bono solo admite servicios.');
  r.servicePackage=true;event('Bono / tratamiento por sesiones configurado');return r.id;
 }
 if(b.operation==='businessServicesFeedback'){
  check(r.service?.surveyEnabled===true,'La encuesta no está habilitada.');const score=Number(b.score);check(Number.isInteger(score)&&score>=1&&score<=5,'Selecciona de 1 a 5.');event('Satisfacción '+score+'/5',b.note);return r.id;
 }
 if(b.operation==='businessServicesLaundry'){
  check(profile==='lavanderia'&&['cuentas_abiertas','proyectos','despacho','medidas'].includes(r.module),'Orden de lavado inválida.');
  const states=['Recibido','Lavando','Listo','Entregado'],index=states.indexOf(r.serviceLaundryState||'Recibido');check(states[index+1]===b.status,'Sigue el orden Recibido, Lavando, Listo y Entregado.');
  if(b.status==='Entregado')check(r.entryId,'Factura antes de entregar.');r.serviceLaundryState=b.status;event('Lavado: '+b.status,b.note);return r.id;
 }
 if(b.operation==='businessServicesPayments'){
  permit('contabilidad');(ctx.readPermit||ctx.permit)(access,'ventas');
  const e=data.entries.find(e=>e.id===b.entryId&&e.type==='venta');
  const invoiceIds=[r.entryId,...(r.billed||[]).map(b=>b.entryId)];
  check(e&&invoiceIds.includes(e.id)&&e.customerId&&e.creditAmount>0&&!r.servicePaymentPlans?.some(p=>p.entryId===e.id),'Selecciona una factura de esta ficha con crédito y sin calendario.');
  check(Array.isArray(b.installments)&&b.installments.length>0&&b.installments.length<=60,'Agrega de 1 a 60 cuotas.');
  let sum=0;const installments=b.installments.map((i,n)=>{const due=ctx.date(i.due),amountCents=i.amountCents;check(Number.isSafeInteger(amountCents)&&amountCents>0&&due>=e.date&&(!n||due>b.installments[n-1].due),'Las cuotas requieren centavos enteros, fechas crecientes y posteriores a la factura.');sum+=amountCents;check(Number.isSafeInteger(sum),'Importe fuera de rango.');return {due,amountCents};});
  check(sum===moneyCents(e.creditAmount),'Las cuotas deben sumar el crédito original; los abonos ya registrados se aplican por antigüedad.');
  r.servicePaymentPlans||=[];check(r.servicePaymentPlans.length<600,'Límite de calendarios alcanzado.');r.servicePaymentPlans.push({entryId:e.id,installments});event('Plan de pago registrado','',{entryId:e.id});return r.id;
 }
 if(b.operation==='businessServicesPhoto'){
  check(profile==='taller'&&r.module==='proyectos'&&b.photoConsent===true,'Confirma la autorización para las fotos privadas de recepción.');
  r.receptionPhotos||=r.referencePhoto?[{...r.referencePhoto,id:randomUUID()}]:[];check(r.receptionPhotos.length<5,'La recepción admite hasta cinco fotos privadas.');const photo={...await ctx.storePhoto(b.photo),id:randomUUID()};r.receptionPhotos.push(photo);r.referencePhoto||=photo;event('Foto privada de recepción adjunta');return r.id;
 }
 check(false,'Operación de servicios no disponible.');
}
// Solo limita fichas que optaron por bono; conserva la venta y aplicación contable existentes.
export function checkServiceBilling(r,items,data,check,profile){
 if(r.servicePackage){
  check(r.deposit>0,'Registra el prepago como anticipo antes de usar el bono.');
  const used=(r.billed||[]).flatMap(b=>data.entries.find(e=>e.id===b.entryId)?.items||[]),demand=new Map();
  for(const i of items){check(r.items.some(q=>q.p===i.p&&moneyCents(q.u)===moneyCents(i.u)),'Conserva servicio y precio del bono.');demand.set(i.p,(demand.get(i.p)||0)+i.q);}
  for(const [p,q]of demand)check(normalizeItemQuantity(q+used.filter(i=>i.p===p).reduce((n,i)=>n+i.q,0))<=normalizeItemQuantity(r.items.filter(i=>i.p===p).reduce((n,i)=>n+i.q,0)),'La sesión supera el bono pendiente.');
  check(moneyCents(invoiceTotals(items).total)<=moneyCents(r.deposit),'El anticipo disponible no cubre estas sesiones.');
 }
 if(r.service&&profile==='taller'&&r.module==='proyectos')check(r.service.approvalReference&&r.service.approvedDate,'Registra la aprobación del presupuesto antes de facturar.');
}
export function serviceTimeBilling(r,items,body,check){
 const ids=body.serviceTimeIds;
 if(!ids?.length)return [];
 check(r.module==='proyectos'&&!r.servicePackage&&Array.isArray(ids)&&new Set(ids).size===ids.length,'Selección de tiempo inválida.');
 const times=ids.map(id=>(r.serviceTime||[]).find(t=>t.id===id));check(times.every(t=>t&&!t.entryId),'Tiempo inexistente o ya facturado.');
 const hours=times.reduce((n,t)=>n+t.minutes,0)/60;
 check(Math.abs(hours*1000-Math.round(hours*1000))<1e-7,'Las horas deben caber en tres decimales; registra intervalos de tres minutos.');
 check(items.length===1&&Math.abs(items[0].q-hours)<1e-8,'Factura una línea de servicio por las horas exactas seleccionadas.');return times;
}
export function checkServiceSchedule(r,rows,check,profile){
 if(profile&&!SERVICE_PROFILES.includes(profile))return;
 if(!['agenda','reservas'].includes(r.module)||r.service?.waiting||['Cancelada','Finalizada'].includes(r.status))return;
 const staff=text(r.service?.professional||r.service?.doctor||r.responsible).toLocaleLowerCase('es');if(!staff||!r.start||!r.end)return;
 check(!rows.some(o=>o.id!==r.id&&o.branchId===r.branchId&&['agenda','reservas'].includes(o.module)&&!o.service?.waiting&&!['Cancelada','Finalizada'].includes(o.status)&&text(o.service?.professional||o.service?.doctor||o.responsible).toLocaleLowerCase('es')===staff&&o.start<r.end&&o.end>r.start),'El profesional ya tiene una atención en ese horario.');
}
export function validateServiceRecord(r,check){
 if(r.service!==undefined){
  check(r.service&&typeof r.service==='object'&&!Array.isArray(r.service),'Ficha de servicios inválida.');
  const definitions=new Map(SERVICE_PROFILES.flatMap(p=>serviceFields(p)).map(f=>[f.key,f]));
  for(const [key,value]of Object.entries(r.service)){
   const f=definitions.get(key);check(f,'Campo de servicios desconocido.');
   check(f.type==='boolean'?typeof value==='boolean':f.type==='integer'?Number.isInteger(value)&&value>=0&&value<=1000000:typeof value==='string'&&value.length<=1000,'Dato de servicios inválido.');
   if(f.type==='date'&&value)check(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value)),'Fecha de servicios inválida.');
  }
 }
 for(const key of ['serviceTime','serviceAttendance','serviceReservations'])if(r[key]!==undefined)check(Array.isArray(r[key])&&r[key].length<=2000,'Historial de servicios inválido.');
 if(r.receptionPhotos!==undefined)check(Array.isArray(r.receptionPhotos)&&r.receptionPhotos.length<=5&&r.receptionPhotos.every(p=>typeof p.id==='string'&&typeof p.key==='string'&&Number.isInteger(p.size)&&p.size>0&&p.size<=1048576),'Fotos de recepción inválidas.');
 if(r.serviceProgress!==undefined)check(Number.isInteger(r.serviceProgress)&&r.serviceProgress>=0&&r.serviceProgress<=100,'Avance inválido.');
 if(r.servicePackage!==undefined)check(typeof r.servicePackage==='boolean'&&r.module==='proyectos','Bono inválido.');
}
