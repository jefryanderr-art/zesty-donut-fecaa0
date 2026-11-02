import {gzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {and,eq,sql,isNull} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {companies,companyBackups,siteContent,users,subscriptions,servicePlans,customerPayments} from '../../db/schema.ts';
import {requirePlatform} from './platform.mjs';
import {billingError} from './billing-rules.mjs';
import {event} from './billing.mjs';
import {readAccounting} from './accounting-storage.mjs';
import {adminEmail} from './policies.mjs';
const registry=id=>'private-exports:'+id;
export async function storageStats(session,id,admin=false){
 const [company]=await db.select().from(companies).where(and(eq(companies.id,id),isNull(companies.archivedAt)));
 if(admin&&company?.ownerEmail!==session.email)await requirePlatform(session,session.activeCompanyId);
 if(!company||!admin&&(session.member||company.ownerEmail!==session.email))billingError('Solo el dueño consulta el uso de su empresa.',403);
 const versions=await db.select({data:companyBackups.data}).from(companyBackups).where(eq(companyBackups.companyId,id));
 const files=new Map();for(const data of [company.data,...versions.map(v=>v.data)])for(const tax of data?.taxes||[])if(tax.receipt?.key)files.set(tax.receipt.key,Number(tax.receipt.size||tax.receipt.bytes||0));
 const images=new Set();
 const findImages=value=>{if(typeof value==='string'){const match=value.match(/^\/api\/image\?key=([a-f0-9-]+\.webp)$/);if(match)images.add(match[1]);}else if(Array.isArray(value))value.forEach(findImages);else if(value&&typeof value==='object')Object.values(value).forEach(findImages)};
 findImages(company.data);versions.forEach(v=>findImages(v.data));
 if(company.isPlatformCompany){const contents=await db.select({content:siteContent.content}).from(siteContent).where(sql`${siteContent.id}='public' OR ${siteContent.id}='ui-textos' OR ${siteContent.id} LIKE 'ui-version:%'`);contents.forEach(c=>findImages(c.content))}
 let imageBytes=0,missingImages=0;for(const key of images){const [cached]=await db.select().from(siteContent).where(eq(siteContent.id,'image-size:'+key));if(cached){imageBytes+=cached.content.bytes;continue}const bytes=await getStore('acontec-images').get(key,{type:'arrayBuffer'});if(!bytes){missingImages++;continue}imageBytes+=bytes.byteLength;await db.insert(siteContent).values({id:'image-size:'+key,content:{bytes:bytes.byteLength}}).onConflictDoNothing()}
 const serviceFiles=await db.select({receipt:customerPayments.receipt}).from(customerPayments).where(and(eq(customerPayments.email,company.ownerEmail),sql`${customerPayments.receipt} IS NOT NULL`));
 const serviceReceiptBytes=serviceFiles.reduce((sum,p)=>sum+Number(p.receipt?.bytes||0),0);
 const rows=await db.execute(sql`SELECT pg_column_size(data)::bigint AS document_bytes,(SELECT coalesce(sum(pg_column_size(b.data)),0)::bigint FROM acontec_company_backups b WHERE b.company_id=${id}) AS version_bytes FROM acontec_companies WHERE id=${id}`);
 const [sub]=await db.select().from(subscriptions).where(eq(subscriptions.email,company.ownerEmail));const [plan]=sub?.plan?await db.select().from(servicePlans).where(eq(servicePlans.id,sub.plan)):[];const limitBytes=plan?.limits?.storageWarningBytes||null;const receiptBytes=[...files.values()].reduce((a,b)=>a+b,0);const documentBytes=Number((rows.rows||rows)[0]?.document_bytes||0);
 const [meta]=await db.select().from(siteContent).where(eq(siteContent.id,registry(id)));
 return {id,name:company.name,...(rows.rows||rows)[0],privateReceiptBytes:[...files.values()].reduce((a,b)=>a+b,0),privateReceiptFiles:files.size,exportBytes:(meta?.content.copies||[]).reduce((n,c)=>n+c.bytes,0),imageBytes,imageFiles:images.size,missingImages,serviceReceiptBytes,limitBytes,warning:!!limitBytes&&(receiptBytes+documentBytes+imageBytes)>=limitBytes*.7,imagesMeasured:missingImages===0,measurement:'Archivos referenciados en documentos y versiones; imágenes del sitio atribuidas a plataforma. Archivos huérfanos sin atribución excluidos. Comprobantes del servicio se muestran por cuenta, no por empresa.',copies:admin?meta?.content.copies||[]:undefined};
}
export async function createPrivateExport(id,actor,reason,revision){
 const store=getStore({name:'acontec-private-exports',consistency:'strong'});let key;
 try{return await db.transaction(async client=>{
  const [company]=await client.select().from(companies).where(and(eq(companies.id,id),isNull(companies.archivedAt))).for('update');if(!company)billingError('Empresa no encontrada.',404);
  if(revision!==undefined&&company.revision!==revision)billingError('La empresa cambió. Recarga antes de respaldar.',409);
  if(reason==='Respaldo semanal del administrador'){const [last]=await client.select().from(siteContent).where(eq(siteContent.id,registry(id)));if(last?.content.copies?.some(c=>Date.now()-Date.parse(c.at)<7*86400000))return {ok:true,replayed:true};}
  const data=await readAccounting(client,company),versions=await client.select().from(companyBackups).where(eq(companyBackups.companyId,id));
  const content={format:'acontec-private-export-v1',createdAt:new Date().toISOString(),company:{id:company.id,name:company.name,description:company.description,businessType:company.businessType,businessCustomization:company.businessCustomization,onboardingDone:company.onboardingDone,revision:company.revision},data,versions};
  const bytes=gzipSync(Buffer.from(JSON.stringify(content)));key=id+'/'+Date.now()+'-'+randomUUID()+'.json.gz';await store.set(key,bytes);
  const [row]=await client.select().from(siteContent).where(eq(siteContent.id,registry(id))).for('update');const copies=[{key,bytes:bytes.byteLength,at:content.createdAt,revision:company.revision},...(row?.content.copies||[])];
  // Retention affects only exports in this new namespace, never existing files or original data.
  const keep=copies.filter((c,i)=>i<5&&Date.now()-Date.parse(c.at)<30*86400000),retired=copies.filter(c=>!keep.includes(c));
  await client.insert(siteContent).values({id:registry(id),content:{copies:keep,retired:[...(row?.content.retired||[]),...retired]}}).onConflictDoUpdate({target:siteContent.id,set:{content:{copies:keep,retired:[...(row?.content.retired||[]),...retired]},updatedAt:new Date()}});
  await event(client,company.ownerEmail,actor,'Respaldo privado exportado',{companyId:id,revision:company.revision,bytes:bytes.byteLength,reason});return {ok:true,copies:keep};
 })}catch(error){if(key)await store.delete(key);throw error}
}
export async function backupRoute(session,method,body,url){
 await requirePlatform(session,session.activeCompanyId);const id=body.companyId||url.searchParams.get('company');if(!/^[a-f0-9-]{36}$/.test(id||''))billingError('Empresa inválida.');
 if(method==='GET')return storageStats(session,id,true);
 if(method!=='POST')billingError('Método no permitido.',405);
 if(body.confirmed!==true||String(body.reason||'').trim().length<3)billingError('Confirma e indica el motivo.');
 return createPrivateExport(id,session.email,String(body.reason).slice(0,1000),body.revision);
}
export async function weeklyPrivateExports(){
 const email=adminEmail();if(!email)return;
 const [admin]=await db.select().from(users).where(and(eq(users.email,email),eq(users.platformAdmin,true)));if(!admin)return;
 const owned=await db.select({id:companies.id}).from(companies).where(and(eq(companies.ownerEmail,email),isNull(companies.archivedAt)));
 // One bounded weekly copy per company. Existing copies make retries harmless.
 for(const c of owned){const [row]=await db.select().from(siteContent).where(eq(siteContent.id,registry(c.id)));if(row?.content.copies?.some(copy=>Date.now()-Date.parse(copy.at)<7*86400000))continue;await createPrivateExport(c.id,email,'Respaldo semanal del administrador')}
}
export async function prunePrivateExports(){
 const entries=await db.select({id:siteContent.id}).from(siteContent).where(sql`${siteContent.id} LIKE 'private-exports:%'`);
 for(const entry of entries)await db.transaction(async client=>{
  const [row]=await client.select().from(siteContent).where(eq(siteContent.id,entry.id)).for('update'),id=entry.id.slice('private-exports:'.length),content=row.content;
  const keep=(content.copies||[]).filter((c,i)=>i<5&&Date.now()-Date.parse(c.at)<30*86400000),retired=[...(content.retired||[]),...(content.copies||[]).filter(c=>!keep.includes(c))];
  const store=getStore('acontec-private-exports');for(const copy of retired)if(copy.key.startsWith(id+'/'))await store.delete(copy.key);
  await client.update(siteContent).set({content:{...content,copies:keep,retired:[]}}).where(eq(siteContent.id,entry.id));
 });
}

export async function downloadPrivateExport(session,url){
 await requirePlatform(session,session.activeCompanyId);const id=url.searchParams.get('company'),key=url.searchParams.get('key');
 if(!/^[a-f0-9-]{36}$/.test(id||'')||!key?.startsWith(id+'/'))billingError('Respaldo no encontrado.',404);
 const [row]=await db.select().from(siteContent).where(eq(siteContent.id,registry(id)));if(!row?.content.copies?.some(c=>c.key===key))billingError('Respaldo no encontrado.',404);
 const file=await getStore('acontec-private-exports').get(key,{type:'stream'});if(!file)billingError('Archivo no disponible.',404);
 await event(db,session.email,session.email,'Respaldo privado descargado',{companyId:id,key});
 return new Response(file,{headers:{'content-type':'application/gzip','content-disposition':'attachment; filename="acontec-'+id+'.json.gz"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
