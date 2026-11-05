import {createHash,randomUUID} from 'node:crypto';
import {eq,and,isNull,sql} from 'drizzle-orm';
import {companies,users,servicePlans,auditEvents,supportGrants} from '../../db/schema.ts';
import {readAccounting,syncAccounting,retainedCompanyData} from './accounting-storage.mjs';
import {checkpoint,audit,accessError} from './access.mjs';
import {requireBilling} from './billing.mjs';
import {moduleIncluded,internalTestApplies,supportGrantActive} from './billing-rules.mjs';
import {moneyCents} from './accounting-engine.mjs';
import {getStore} from '@netlify/blobs';
const check=(ok,message,status=400)=>{if(!ok)accessError(message,status)};
const txt=(v,n)=>String(v??'').trim().slice(0,n);
// Explicit owner grant, recipient's authenticated email and lease ID are all required.
// This endpoint never returns company documents, module projections or other tenants.
export async function rentalPortal(db,session,b){
 check(!session.member&&/^[a-f0-9-]{36}$/.test(b.companyId||'')&&/^[a-f0-9-]{36}$/.test(b.recordId||''),'Acceso de inquilino no disponible.',403);
 const added=[];
 try{return await db.transaction(async client=>{
  const [company]=await client.select().from(companies).where(eq(companies.id,b.companyId)).for('update');
  check(company&&!company.archivedAt&&!company.isPlatformCompany&&(company.businessType==='alquiler'||company.businessType==='personalizado'&&company.businessCustomization?.operationalProfile==='alquiler'),'Alquiler no disponible.',404);
  company.data=await readAccounting(client,company);
  const r=company.data?.businessRecords?.find(r=>r.id===b.recordId&&['reservas','contratos'].includes(r.module)&&!['lodging-unit','lodging-close','lodging-prospect'].includes(r.kind));
  check(r?.tenantEnabled&&r.tenantEmail===session.email.toLowerCase(),'Alquiler no disponible.',403);
  const [owner]=await client.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,company.ownerEmail));
  const internalTest=internalTestApplies({testPlan:company.testPlan,isPlatformCompany:company.isPlatformCompany,ownerPlatformAdmin:owner?.platformAdmin});
  let billing;if(internalTest){const [plan]=await client.select().from(servicePlans).where(eq(servicePlans.id,company.testPlan));check(plan,'Plan no disponible.',403);billing={plan};}else billing=await requireBilling(company.ownerEmail,owner?.platformAdmin===true,client);
  check(moduleIncluded(billing.plan,r.module),'El módulo del alquiler no está disponible.',403);
  check(!(billing.plan.limits?.branches===1||billing.plan.blockedModules?.includes('sucursales'))||r.branchId==='principal','La sucursal no está disponible en el plan actual.',403);
  const action=b.action||'read',actor={...session,auditBranchId:r.branchId};
  if(action==='photo'){
   const photo=r.receptionPhotos?.find(p=>p.id===b.photoId&&p.tenantRequestId);check(photo?.key?.startsWith(company.id+'/'),'Foto no encontrada.',404);
   const bytes=await getStore({name:'acontec-private-receipts',consistency:'strong'}).get(photo.key,{type:'arrayBuffer'});check(bytes,'Foto no encontrada.',404);
   await audit(client,company.id,actor,'Inquilino · consulta de foto',[{recordId:r.id,photoId:photo.id}]);
   return new Response(bytes,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename=foto.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type]||'bin'),'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  }
  if(action==='request'){
   const [viewer]=await client.select({platformAdmin:users.platformAdmin}).from(users).where(eq(users.email,session.email));
   if(viewer?.platformAdmin){const [grant]=await client.select().from(supportGrants).where(and(eq(supportGrants.companyId,company.id),eq(supportGrants.email,session.email)));check(!supportGrantActive(grant,session.email,true,false),'El soporte es de solo lectura.',403);}
   if(!internalTest&&billing.plan.limits?.companies!=null){const owned=await client.select({id:companies.id}).from(companies).where(and(eq(companies.ownerEmail,company.ownerEmail),isNull(companies.archivedAt))).orderBy(sql`coalesce((select min(${auditEvents.createdAt}) from ${auditEvents} where ${auditEvents.companyId}=${companies.id} and ${auditEvents.action}='Empresa creada'), (select min(${auditEvents.createdAt}) from ${auditEvents} where ${auditEvents.companyId}=${companies.id}), ${companies.updatedAt})`,companies.id);check(owned.findIndex(c=>c.id===company.id)<billing.plan.limits.companies,'La empresa permanece de solo lectura por el límite del plan.',403);}

   check(!['Finalizada','Finalizado','Cancelada','Cancelado'].includes(r.status),'El alquiler ya está cerrado.');
   check(/^[a-f0-9-]{36}$/.test(b.requestId||'')&&txt(b.note,1001).length>=3&&txt(b.note,1001).length<=1000,'Revisa la solicitud.');
   const payloadHash=createHash('sha256').update(JSON.stringify({note:b.note,file:b.file||null})).digest('hex');
   const prior=r.tenantRequests?.find(x=>x.id===b.requestId);if(prior){check(prior.payloadHash===payloadHash,'Identificador reutilizado con otro contenido.');return {ok:true,revision:company.revision,replayed:true};}
   check(Number.isInteger(b.revision)&&b.revision===company.revision,'El alquiler cambió. Recarga antes de enviar.',409);
   check((r.tenantRequests||[]).length<100,'Límite de solicitudes alcanzado.');
   const previous=structuredClone(company),request={id:b.requestId,date:new Date().toISOString().slice(0,10),note:txt(b.note,1000),state:'Pendiente',payloadHash};
   if(b.file){check(r.tenantPhotosAllowed&&b.authorized===true,'La foto requiere autorización del propietario y del inquilino.');
    const f=b.file;check(f&&typeof f.content==='string'&&f.content.length<=1400000&&/^[A-Za-z0-9+/]*={0,2}$/.test(f.content),'Foto inválida.');const bytes=Buffer.from(f.content,'base64');
    const valid=f.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:f.type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):f.type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    check(valid&&bytes.length>0&&bytes.length<=1048576&&(r.receptionPhotos||[]).length<5,'Adjunta JPG, PNG o WebP de hasta 1 MB (máximo cinco fotos por alquiler).');
    const history=await retainedCompanyData(client,company.id),refs=[...new Map([company.data,...history.map(h=>h.data)].flatMap(d=>(d?.businessRecords||[]).flatMap(r=>[r.referencePhoto,...(r.receptionPhotos||[])].filter(Boolean))).map(p=>[p.key,p])).values()];
    check(refs.length<100&&refs.reduce((n,p)=>n+p.size,0)+bytes.length<=50*1048576,'Límite de almacenamiento de fotos alcanzado.');
    const key=company.id+'/'+randomUUID(),photo={id:randomUUID(),key,size:bytes.length,type:f.type,date:request.date,tenantRequestId:request.id};added.push(key);await getStore({name:'acontec-private-receipts',consistency:'strong'}).set(key,bytes);
    r.receptionPhotos||=[];r.receptionPhotos.push(photo);r.referencePhoto||=photo;request.photoId=photo.id;
   }
   r.tenantRequests||=[];r.tenantRequests.push(request);r.events||=[];r.events.push({date:request.date,action:'Solicitud de mantenimiento del inquilino',actor:session.email});
   await checkpoint(client,previous);
   const [updated]=await client.update(companies).set({data:company.data,revision:company.revision+1,updatedAt:new Date()}).where(eq(companies.id,company.id)).returning();
   await syncAccounting(client,previous,updated);
   await audit(client,company.id,actor,'Inquilino · solicitud de mantenimiento',[{recordId:r.id,requestId:request.id}],updated.revision);
   return {ok:true,revision:updated.revision};
  }
  check(action==='read','Operación no disponible.');
  const entries=company.data.entries||[],invoices=(r.billed||[]).map(b=>{const e=entries.find(e=>e.id===b.entryId);if(!e)return null;const movements=entries.filter(x=>x.id===e.id||x.invoiceId===e.id),balanceCents=movements.flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);return {date:e.date,reference:e.reference,totalCents:moneyCents(e.total),balanceCents:Math.max(0,balanceCents),payments:movements.filter(x=>x.id!==e.id).map(x=>({date:x.date,reference:x.reference,amountCents:x.lines.filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.c)-moneyCents(l.d),0)}))};}).filter(Boolean);
  await audit(client,company.id,actor,'Inquilino · consulta de alquiler',[{recordId:r.id}]);
  return {company:company.name,name:r.name,resource:r.resource,status:r.status,photosAllowed:r.tenantPhotosAllowed===true,currency:company.data.cfg?.cur||'C$',revision:company.revision,terms:r.rentalTerms?{template:r.rentalTerms.template,signature:r.rentalTerms.signature,signedDate:r.rentalTerms.signedDate,renewalDate:r.rentalTerms.renewalDate}:null,securityCents:r.securityCents||0,invoices,requests:(r.tenantRequests||[]).map(x=>({id:x.id,date:x.date,note:x.note,state:x.state,photoId:x.photoId}))};
 });}catch(error){for(const key of added)try{await getStore({name:'acontec-private-receipts',consistency:'strong'}).delete(key)}catch{}throw error;}
}
