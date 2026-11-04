import {randomUUID,createHash} from 'node:crypto';
import {and,eq,sql,or,isNull} from 'drizzle-orm';
import {auditEvents,companyMembers} from '../../db/schema.ts';
import {db} from '../../db/index.ts';
import {companyAccess,requireModule,allowed,updateCompany,audit,actorName,accessError,equal} from './access.mjs';
import {scopeBranch} from './branches.mjs';
import {auditReview,AUDIT_DEFAULTS} from './audit-review-rules.mjs';
export const REVIEW_OPS=['auditReviewRun','auditReviewSettings','auditReviewFollowup'];
const MODULE='auditoria_revision',closed=['justificado','confirmado','descartado'];
const check=(ok,msg)=>{if(!ok)accessError(msg,400)};
const text=(v,max=1000)=>String(v??'').trim().slice(0,max);
const records=d=>(d.businessRecords||[]).filter(r=>r.module===MODULE);
const guard=(access,write=false)=>{requireModule(access,MODULE,write);check(!access.support&&access.branchId,'Selecciona una sucursal; soporte temporal no accede a estos informes.');};

const evidenceFor=(data,access)=>Object.entries({taxes:'fiscal',pettyVouchers:'cajas',cashMovements:'cajas',costs:'costos'}).flatMap(([collection,module])=>allowed(access,module)?(data[collection]||[]).filter(r=>r.receipt).map(r=>({id:r.id,module,entryId:r.entryId||null})):[]);
const scopeModules=access=>['ventas','facturacion','cajas','inventario','gastos','proveedores','contabilidad','personal','bancos','accesibilidad','fiscal','costos'].filter(m=>allowed(access,m));
async function eventsFor(client,companyId,access,from,to){
 const filters=[eq(auditEvents.companyId,companyId),sql`${auditEvents.createdAt}>=${from}::date and ${auditEvents.createdAt}<${to}::date+interval '1 day'`];
 filters.push(access.branchId==='principal'?or(eq(auditEvents.branchId,'principal'),isNull(auditEvents.branchId)):eq(auditEvents.branchId,access.branchId));
 const events=await client.select({id:auditEvents.id,actor:auditEvents.actor,action:auditEvents.action,createdAt:auditEvents.createdAt}).from(auditEvents).where(and(...filters)).limit(10001);
 check(events.length<=10000,'El período supera 10000 eventos; elige un período más corto.');
 return events.map(e=>({...e,createdAt:e.createdAt.toISOString()}));
}
function thresholds(body){
 const t={...AUDIT_DEFAULTS,...body};check(Object.keys(body).every(k=>Object.hasOwn(AUDIT_DEFAULTS,k)),'Umbral desconocido.');
 for(const k of ['amountCents','approvalCents','roundCents','salaryMinCents','salaryMaxCents'])check(Number.isSafeInteger(t[k])&&t[k]>0&&t[k]<=99999999900,'Los montos deben ser centavos enteros positivos.');
 for(const [k,min,max] of [['nearPercent',1,20],['discountPercent',1,99],['repetitions',2,100],['adjustmentQuantity',1,1000000],['costFactor',2,20],['oldDays',1,3650],['startHour',0,23],['endHour',1,24]])check(Number.isInteger(t[k])&&t[k]>=min&&t[k]<=max,'Umbral fuera de rango: '+k);
 check(t.startHour<t.endHour&&t.salaryMinCents<=t.salaryMaxCents,'Revisa horario y rango salarial.');
 try{new Intl.DateTimeFormat('es',{timeZone:t.timezone}).format()}catch{check(false,'Zona IANA inválida.')}
 check(Array.isArray(t.holidays)&&t.holidays.length<=366&&t.holidays.every(validDay)&&typeof t.monthlyReminder==='boolean','Feriados o recordatorio inválidos.');return t;
}
function validDay(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v}
function visibleReport(r,access){return r.kind==='report'&&r.scope.every(m=>allowed(access,m));}
export async function auditReviewOperation(companyId,session,body){
 if(body.operation==='auditReviewView')return db.transaction(async client=>{
  const access=await companyAccess(client,companyId,session,true);guard(access);const data=scopeBranch(access.company.data,access);
  const reports=records(data).filter(r=>visibleReport(r,access)).sort((a,b)=>b.generatedAt.localeCompare(a.generatedAt));
  const report=body.id?reports.find(r=>r.id===body.id):null;if(body.id)check(report,'Informe no disponible con los permisos actuales.');
  const format=body.format||'VIEW';check(['VIEW','CSV','PDF'].includes(format),'Formato inválido.');
  if(format!=='VIEW'){check(report,'Selecciona un informe.');await audit(client,companyId,session,'Descarga informe de auditoría '+format,[{area:MODULE,id:report.id,version:report.version,from:report.from,to:report.to}]);}
  const followups=report?records(data).filter(r=>r.kind==='followup'&&r.reportId===report.id):[];
  const members=await client.select({id:companyMembers.id,name:companyMembers.name,role:companyMembers.role,branchIds:companyMembers.branchIds}).from(companyMembers).where(and(eq(companyMembers.companyId,companyId),eq(companyMembers.active,true)));
  const owners=[{id:'owner',name:'Dueño'},...members.filter(m=>m.role==='contador'||(m.branchIds||[]).includes(access.branchId)).map(m=>({id:m.id,name:m.name}))];
  return {company:access.company.name,branchId:access.branchId,version:1,generatedAt:new Date().toISOString(),generatedBy:actorName(access.member?{...session,member:access.member}:session),settings:data.cfg?.auditReview||AUDIT_DEFAULTS,reports:reports.map(r=>({id:r.id,from:r.from,to:r.to,generatedAt:r.generatedAt,generatedBy:r.generatedBy,count:r.findings.length})),report,followups,responsibles:owners,evidence:evidenceFor(data,access),reminderDue:!!data.cfg?.auditReview?.monthlyReminder&&!reports.some(r=>r.generatedAt.slice(0,7)===new Date().toISOString().slice(0,7))};
 });
 check(REVIEW_OPS.includes(body.operation),'Operación inválida.');check(typeof body.operationId==='string'&&/^[a-f0-9-]{36}$/i.test(body.operationId),'Identificador de operación requerido.');
 return updateCompany(companyId,session,body.revision,async(company,access,client)=>{
  guard(access,true);const data=structuredClone(company.data);check(data&&Array.isArray(data.entries),'Abre primero la contabilidad.');data.businessRecords||=[];
  const actor=actorName(access.member?{...session,member:access.member}:session),now=new Date().toISOString();
  const base={id:randomUUID(),module:MODULE,name:'Revisión interna',status:'Conservado',branchId:access.branchId,date:now.slice(0,10)};
  if(body.operation==='auditReviewSettings'){
   check(access.owner&&body.confirmed===true&&text(body.reason).length>=3,'Solo el dueño ajusta umbrales con confirmación y motivo.');
   const settings=thresholds(body.settings||{});data.cfg||={};data.cfg.auditReview=settings;
   data.businessRecords.push({...base,kind:'settings',generatedAt:now,generatedBy:actor,reason:text(body.reason),before:company.data.cfg?.auditReview||AUDIT_DEFAULTS,after:settings});
  }else if(body.operation==='auditReviewRun'){
   check(validDay(body.from)&&validDay(body.to)&&body.from<=body.to&&(Date.parse(body.to)-Date.parse(body.from))/86400000<=366,'Selecciona un período válido de hasta 367 días.');
   check(data.entries.length<=50000,'La empresa supera el alcance de 50000 asientos para esta revisión.');
   const events=await eventsFor(client,companyId,access,body.from,body.to),scope=scopeModules(access),result=auditReview(data,{from:body.from,to:body.to,settings:data.cfg?.auditReview,events,canRead:m=>scope.includes(m)});
   check(result.findings.length<=5000,'Demasiados hallazgos; reduce el período.');
   data.businessRecords.push({...base,kind:'report',version:1,from:body.from,to:body.to,scope,sourceRevision:company.revision,generatedAt:now,generatedBy:actor,...result});
  }else{
   const report=records(data).find(r=>r.id===body.reportId&&visibleReport(r,access));check(report,'Informe no disponible.');check(report.findings.some(f=>f.id===body.findingId),'Hallazgo no encontrado.');
   const history=records(data).filter(r=>r.kind==='followup'&&r.reportId===report.id&&r.findingId===body.findingId),last=history.at(-1);check(!closed.includes(last?.state),'El hallazgo ya está cerrado; su historial se conserva.');
   check(['nuevo','en revisión',...closed].includes(body.state),'Estado inválido.');check(!closed.includes(body.state)||text(body.comment).length>=3,'Comentario obligatorio al cerrar.');
   const responsible=text(body.responsible,100);if(responsible!=='owner'){const [member]=await client.select({id:companyMembers.id,branchIds:companyMembers.branchIds,role:companyMembers.role}).from(companyMembers).where(and(eq(companyMembers.companyId,companyId),eq(companyMembers.id,responsible),eq(companyMembers.active,true)));check(member&&(member.role==='contador'||(member.branchIds||[]).includes(access.branchId)),'Selecciona un responsable activo de esta sucursal.');}
   const evidenceIds=body.evidenceIds||[];check(Array.isArray(evidenceIds)&&evidenceIds.length<=10&&new Set(evidenceIds).size===evidenceIds.length&&evidenceIds.every(id=>evidenceFor(data,access).some(r=>r.id===id)),'Selecciona comprobantes existentes de esta sucursal.');
   data.businessRecords.push({...base,kind:'followup',reportId:report.id,findingId:body.findingId,state:body.state,responsible,comment:text(body.comment),evidenceIds,generatedAt:now,generatedBy:actor});
  }
  check(data.businessRecords.length<=20000,'Se alcanzó el límite de historial de la empresa.');
  // No initializers or monetary operations: the only changes are own records and settings.
  return {data};
 },'Operación: '+body.operation,{id:body.operationId,actor:session.email+':'+(session.memberId||''),hash:createHash('sha256').update(JSON.stringify(body)).digest('hex')});
}
export function guardAuditHistory(previous,next,action){
 const old=records(previous||{}),current=records(next||{});
 for(const r of old)check(current.some(n=>n.id===r.id&&equal(n,r)),'El historial de auditoría es inmutable y no puede eliminarse ni restaurarse a una versión anterior.');
 if(!REVIEW_OPS.some(op=>action==='Operación: '+op)){
  check(equal(old,current),'Usa las operaciones propias de auditoría.');check(equal(previous?.cfg?.auditReview,next?.cfg?.auditReview),'Usa la configuración de auditoría.');
 }
}

// Preserve the exact full accounting document, including array order and legacy
// branch assignments. A review may append only its own records/settings.
export function mergeAuditReviewPatch(full,scoped,next,access,action){
 check(REVIEW_OPS.some(op=>action==='Operación: '+op),'Operación de auditoría inválida.');
 const withoutOwn=d=>{const copy=structuredClone(d);delete copy.businessRecords;if(copy.cfg)delete copy.cfg.auditReview;return copy};
 check(equal(withoutOwn(scoped),withoutOwn(next)),'La auditoría no puede modificar datos contables.');
 const before=scoped.businessRecords||[],after=next.businessRecords||[],known=new Set((full.businessRecords||[]).map(r=>r.id));
 check(before.every(r=>after.some(n=>equal(n,r))),'La auditoría conserva todos los registros existentes.');
 const added=after.filter(r=>!known.has(r.id));check(added.length===1&&added.every(r=>r.module===MODULE&&r.branchId===access.branchId),'Solo se admite un registro propio por operación.');
 const result={...full,businessRecords:[...(full.businessRecords||[]),...added]};
 if(action==='Operación: auditReviewSettings')result.cfg={...full.cfg,auditReview:structuredClone(next.cfg.auditReview)};
 else check(equal(scoped.cfg?.auditReview,next.cfg?.auditReview),'El informe no modifica los umbrales.');
 return result;
}
