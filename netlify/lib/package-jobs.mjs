import {getStore} from '@netlify/blobs';
import {db} from '../../db/index.ts';
import {companyAccess,requireModule,updateCompany,audit} from './access.mjs';
import {scopeBranch} from './branches.mjs';
import {permitPackage,workflowFileRecord} from './fiscal-workflows.mjs';
import {packageFiles,digest} from './package-files.mjs';
import {fiscalCheck as check} from './fiscal-rules.mjs';
import {documentHash} from './accounting-codec.mjs';
export async function authorizedPackage(session,companyId,id){
 const access=await companyAccess(db,companyId,session,true);check(access.branchId,'Selecciona una sucursal.');const data=scopeBranch(access.company.data,access);
 const record=workflowFileRecord(data,access,id);requireModule(access,record.module);permitPackage(access,(a,m,w)=>requireModule(a,m,w),data);return {access,record};
}
export async function processPackage(session,companyId,id){
 const {record,access}=await authorizedPackage(session,companyId,id);check(record.kind==='packageJob','Paquete no encontrado.');if(record.status==='listo')return;
 check(record.createdBy===session.email&&record.createdMemberId===(session.memberId||null),'Solo quien solicitó el paquete puede procesarlo.');
 const store=getStore({name:'acontec-private-receipts',consistency:'strong'});
 check(record.snapshot.key.startsWith(companyId+'/'),'Paquete inválido.');
 const packet=await store.get(record.snapshot.key,{type:'json'});check(packet,'La instantánea no está disponible.');const {hash,...content}=packet;check(documentHash(content)===hash&&hash===record.packetHash,'La huella del paquete no coincide.');
 const patch=async (values,claim=false)=>{
  // Solo metadatos del trabajo: volver a leer antes de cada actualización evita perder operaciones contables concurrentes.
  for(let i=0;i<3;i++){
   const current=await authorizedPackage(session,companyId,id);
   try{return await updateCompany(companyId,session,current.access.company.revision,(company,a)=>{
    requireModule(a,record.module);permitPackage(a,(x,m,w)=>requireModule(x,m,w),company.data);
    const data=structuredClone(company.data),job=data.fiscalWorkflows.find(r=>r.id===id);check(job?.kind==='packageJob','Trabajo no disponible.');if(claim)check(job.status!=='listo'&&(job.status!=='generando'||Date.now()-Date.parse(job.startedAt||0)>16*60000),'El paquete ya se está procesando.');Object.assign(job,values);return {data};
   },'Paquete fiscal procesado');}catch(error){if(error.status!==409||i===2)throw error}
  }
 };
 await patch({status:'generando',progress:10,error:null,startedAt:new Date().toISOString()},true);
 try{
  let lastProgress=10;const {bytes,manifest}=await packageFiles(packet,async attachment=>attachment.key?.startsWith(companyId+'/')?store.get(attachment.key,{type:'arrayBuffer'}):null,async progress=>{if([25,50,75,95].some(p=>progress>=p&&lastProgress<p)){lastProgress=progress;await patch({progress})}});
  // Clave estable: los reintentos del mismo trabajo producen un solo archivo referenciado.
  const key=companyId+'/paquetes/'+id+'.zip';await store.set(key,bytes);
  await patch({status:'listo',progress:100,receipt:{key,name:'acontec-'+record.period+'.zip',mime:'application/zip',generated:true,size:bytes.byteLength,sha256:digest(bytes)},missing:manifest.missing});
 }catch(error){try{await patch({status:'error',progress:0,error:'No se completó el paquete. Puedes reintentar conservando la instantánea.'});}catch{}throw error;}
}
export async function downloadWorkflowFile(session,companyId,id,type='zip'){
 const {access,record}=await authorizedPackage(session,companyId,id);workflowFileRecord({fiscalWorkflows:[record]},access,id,type);
 const receipt=type==='zip'?record.receipt:type==='filing'?record.filing?.receipt:type==='payment'?record.payment?.receipt:type==='snapshot'?record.package?.receipt:type==='backup'&&access.owner?record.backup:null;
 check(receipt?.key?.startsWith(companyId+'/'),'Archivo no encontrado o sin permiso.');
 const file=await getStore({name:'acontec-private-receipts',consistency:'strong'}).get(receipt.key,{type:'stream'});check(file,'Archivo faltante.');
 await audit(db,companyId,session,'Descarga de paquete o comprobante fiscal',[{id,type,period:record.period,branchId:access.branchId,at:new Date().toISOString()}]);
 return new Response(file,{headers:{'content-type':receipt.mime||'application/octet-stream','content-disposition':"attachment; filename=\"archivo\"; filename*=UTF-8''"+encodeURIComponent(receipt.name),'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
}
