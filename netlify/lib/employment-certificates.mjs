import {randomUUID} from 'node:crypto';
import {recurringDay,employmentIncomeCents} from './accounting-engine.mjs';
export const CERTIFICATE_OPS=['certificateConfigure'];
const check=(v,message)=>{if(!v)throw Object.assign(new Error(message),{status:400,publicMessage:message})};
export const certificateConfig=(data,branchId)=>(data.businessRecords||[]).find(r=>r.module==='constancias_laborales'&&r.branchId===branchId);
export function validateCertificateRecord(r,check){
 check(r.kind==='configuration'&&typeof r.enabled==='boolean'&&Array.isArray(r.events),'Configuración de constancias inválida.');
 for(const key of ['workText','incomeText'])check(typeof r[key]==='string'&&r[key].trim().length>0&&r[key].length<=3000,'Escribe ambos textos de hasta 3000 caracteres.');
}
export function configureCertificates(data,access,session,body,ctx){
 ctx.permit(access,'constancias_laborales',true);ctx.permit(access,'personal',true);
 check(access.owner&&access.branchId&&!access.support&&!access.readOnlyLimit,'Solo el dueño con escritura y sucursal configura constancias.');
 check(body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Confirma e indica un motivo de hasta 500 caracteres.');
 const date=recurringDay(body.date),r={id:randomUUID(),module:'constancias_laborales',kind:'configuration',name:'Constancias laborales',branchId:access.branchId,date,status:body.enabled?'Activa':'Inactiva',enabled:body.enabled,workText:body.workText,incomeText:body.incomeText,events:[]};validateCertificateRecord(r,check);
 const previous=certificateConfig(data,access.branchId);r.events=[...(previous?.events||[]),{date,reason:body.reason.trim(),actor:session.email,at:new Date().toISOString()}];r.version=(previous?.version||0)+1;
 if(previous){r.id=previous.id;Object.assign(previous,r)}else(data.businessRecords||=[]).push(r);return r.id;
}
export function employmentCertificate(data,access,body){
 const config=certificateConfig(data,access.branchId);check(config?.enabled,'El dueño debe activar las constancias para esta sucursal.');
 check(['work','income'].includes(body.kind),'Tipo de constancia inválido.');
 const employee=(data.employees||[]).find(e=>e.id===body.employeeId);check(employee,'Empleado no encontrado en la sucursal.');
 const from=recurringDay(body.from),to=recurringDay(body.to);check(from<=to,'Período inválido.');
 const incomeCents=body.kind==='income'?employmentIncomeCents(data.payrolls||[],employee.id,from,to):null;
 return {kind:body.kind,text:body.kind==='income'?config.incomeText:config.workText,employee:{name:employee.name,position:employee.position||'',start:employee.start||''},incomeCents,from,to,templateVersion:config.version,notice:'Documento interno con texto definido por la empresa; verifica con tu contador.'};
}
