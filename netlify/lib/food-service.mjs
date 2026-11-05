import {randomUUID} from 'node:crypto';
export const FOOD_OPS=['foodTable','foodReserve','foodArrive','foodSeat','foodAccount','foodCancel'];
export const diningRecord=r=>r.module==='cuentas_abiertas'&&['dining-table','table-reservation'].includes(r.kind);
const text=(v,n=200)=>String(v||'').trim().slice(0,n);
export function foodOperation(data,access,session,b,ctx){
 const {check,permit}=ctx;permit(access,'cuentas_abiertas',true);
 check(access.branchId&&b.operationId&&b.confirmed===true,'Selecciona sucursal y confirma la operación.');
 const rows=data.businessRecords||=[],now=new Date().toISOString();
 const event=action=>({date:now,action,actor:session.email});
 const table=id=>{const r=rows.find(r=>r.id===id&&r.kind==='dining-table'&&r.module==='cuentas_abiertas');check(r,'Mesa no encontrada.');return r;};
 const guests=t=>{const n=Number(b.guests);check(Number.isInteger(n)&&n>0&&n<=t.capacity,'Los comensales exceden la capacidad de la mesa.');return n;};
 if(b.operation==='foodTable'){
  check(access.owner,'Solo el dueño administra mesas.');
  const capacity=Number(b.capacity),zone=text(b.zone,80),name=text(b.name,80);
  check(name&&zone&&Number.isInteger(capacity)&&capacity>0&&capacity<=1000,'Indica mesa, zona y capacidad de 1 a 1000.');
  const old=b.id?table(b.id):null;
  check(!rows.some(r=>r.kind==='dining-table'&&r.id!==old?.id&&r.name.toLowerCase()===name.toLowerCase()),'El nombre de mesa ya existe.');
  if(old)check(!rows.some(r=>r.tableId===old.id&&r.status==='Abierta'),'La mesa tiene una cuenta o reserva activa.');
  const r={id:old?.id||randomUUID(),module:'cuentas_abiertas',kind:'dining-table',name,zone,capacity,status:'Abierta',date:old?.date||ctx.date(b.date),branchId:access.branchId,events:[...(old?.events||[]),event(old?'Mesa actualizada':'Mesa creada')]};
  if(old)Object.assign(old,r);else rows.push(r);return r.id;
 }
 if(b.operation==='foodCancel'){const r=rows.find(r=>r.id===b.id&&r.kind==='table-reservation'&&r.status==='Abierta');check(r&&text(b.reason,500),'Selecciona una reserva activa e indica el motivo.');r.status='Cerrada';r.cancelled=true;r.events.push({...event('Reserva cancelada'),reason:text(b.reason,500)});return r.id;}
 if(b.operation==='foodReserve'){
  const t=table(b.tableId),start=new Date(b.start),end=new Date(b.end);
  check(Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&start<end&&start.getTime()>=Date.now()-60000,'Indica un horario futuro válido.');
  check(!rows.some(r=>r.kind==='table-reservation'&&r.tableId===t.id&&r.status==='Abierta'&&r.start<end.toISOString()&&r.end>start.toISOString()),'La mesa ya está reservada en ese horario.');
  const name=text(b.name);check(name,'Indica el nombre de la reserva.');
  const r={id:randomUUID(),module:'cuentas_abiertas',kind:'table-reservation',name,status:'Abierta',date:ctx.date(b.date),branchId:access.branchId,tableId:t.id,resource:t.name,guests:guests(t),phone:text(b.phone,80),start:start.toISOString(),end:end.toISOString(),responsible:text(b.responsible),events:[event('Reserva creada')]};rows.push(r);return r.id;
 }
 if(b.operation==='foodAccount'){
  const r=rows.find(r=>r.id===b.id&&r.module==='cuentas_abiertas'&&!diningRecord(r));
  check(r&&r.status==='Abierta'&&!r.entryId,'Cuenta cerrada o inexistente.');
  if(r.tableId){const t=table(r.tableId);r.guests=guests(t);}
  r.responsible=text(b.responsible);r.readyToPay=b.readyToPay===true;r.events.push(event(r.readyToPay?'Cuenta por cobrar':'Atención actualizada'));return r.id;
 }
 const reservation=b.operation==='foodArrive'?rows.find(r=>r.id===b.id&&r.kind==='table-reservation'&&r.status==='Abierta'):null;
 check(b.operation!=='foodArrive'||reservation,'Reserva cerrada o inexistente.');
 const t=table(reservation?.tableId||b.tableId);
 check(!rows.some(r=>r.module==='cuentas_abiertas'&&!diningRecord(r)&&r.status==='Abierta'&&(r.tableId===t.id||r.resource?.toLowerCase()===t.name.toLowerCase())),'La mesa ya tiene una cuenta abierta.');
 check(!rows.some(r=>r.kind==='table-reservation'&&r.id!==reservation?.id&&r.tableId===t.id&&r.status==='Abierta'&&r.start<=now&&r.end>now),'La mesa está reservada en este horario.');
 const r={id:randomUUID(),module:'cuentas_abiertas',kind:'cuentas_abiertas',name:reservation?.name||text(b.name)||t.name,status:'Abierta',date:ctx.date(b.date),branchId:access.branchId,resource:t.name,tableId:t.id,zone:t.zone,guests:reservation?.guests||guests(t),responsible:reservation?.responsible||text(b.responsible),openedAt:now,modality:'local',items:[],total:0,serviceRate:0,serviceProductId:'',events:[event('Cuenta abierta en mesa')]};
 rows.push(r);if(reservation){reservation.status='Cerrada';reservation.accountId=r.id;reservation.events.push(event('Cliente recibido'));}return r.id;
}
