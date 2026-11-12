import { createHash, randomBytes } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { siteContent, auditEvents } from '../../db/schema.ts';
import { companyAccess, allowed, accessError, passwordDigest, verifyPassword, audit } from './access.mjs';
import { invoicePriceAdjustment } from './accounting-engine.mjs';
import { effectiveFoodPrice } from './food-workflows.mjs';
import { commercePrice } from './commerce.mjs';
import { scopeBranch } from './branches.mjs';
import { operatorId, operationalRole } from './policies.mjs';
const key = id => 'discount-policy:' + id;
const admin = access => access.owner || allowed(access, 'accesibilidad', true);
const fingerprint = body => {
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>200||body.items.some(i=>!i||typeof i.p!=='string'||typeof i.q!=='number'||!Number.isFinite(i.q)||i.q<=0||typeof i.u!=='number'||!Number.isFinite(i.u)||i.u<0))accessError('Revisa productos, cantidades y precios antes de autorizar.',400);
 return createHash('sha256').update(JSON.stringify({discount:Number(body.discount),date:body.date||'',customerId:body.customerId||'',commercePresentations:body.commercePresentations||[],items:body.items.map(i=>({p:i.p,q:i.q,u:i.u}))})).digest('hex');
};
export const normalInvoicePrice=(data,product,body)=>{const price=commercePrice(data,product,body.customerId,(body.commercePresentations||[]).find(i=>i.p===product.id)?.code||'base');return price!==product.price?price:effectiveFoodPrice(data,product,body.date)};
const usdRate=(data,date)=>data?.exchangeRates?.filter(r=>r.currency==='USD'&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.rate;
export function invoiceAdjustments(data,body,policy={}){
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>200)accessError('Agrega productos.',400);
 return body.items.map(item=>{const product=data?.products?.find(p=>p.id===item.p);if(!product)accessError('Producto inexistente.',400);const normal=normalInvoicePrice(data,product,body);return invoicePriceAdjustment(normal,item.u===undefined?normal:item.u,policy.adjustmentMode||'percent',usdRate(data,body.date)||policy.exchangeRate,policy.maximum??99)});
}
const safe = policy => ({configured:!!policy.hash,maximum:policy.maximum ?? 99,roles:policy.roles || [],version:policy.version||0,adjustmentMode:policy.adjustmentMode||'percent',exchangeRate:policy.exchangeRate||null});
async function read(client,id){return (await client.select().from(siteContent).where(eq(siteContent.id,key(id))))[0]?.content || {};}
async function save(client,id,content){await client.insert(siteContent).values({id:key(id),content}).onConflictDoUpdate({target:siteContent.id,set:{content,updatedAt:new Date()}});}
export async function discountRoute(id,session,method,body={}){
 const result=await db.transaction(async client=>{
  const access=await companyAccess(client,id,session,true,true);
  if(!allowed(access,'facturacion')&&!allowed(access,'accesibilidad'))accessError('Sin permiso para descuentos.');
  const policy=await read(client,id);
  if(method==='GET')return {...safe(policy),existingExchangeRate:usdRate(access.company.data,new Date().toISOString().slice(0,10))||null,canManage:admin(access),owner:access.owner};
  if(access.support||access.readOnlyLimit)accessError('Este acceso es de solo lectura.');
  if(body.action==='settings'){
   if(!admin(access))accessError('Solo el dueño o administrador configura los descuentos.');
   if(body.version!==(policy.version||0))accessError('La configuración cambió. Ábrela de nuevo.',409);
   if(body.password){if(!access.owner)accessError('Solo el dueño cambia la contraseña.');policy.hash=await passwordDigest(body.password);}
   const maximum=body.maximum===''?99:Number(body.maximum);
   if(!Number.isFinite(maximum)||maximum<0||maximum>99)accessError('El máximo debe estar entre 0 y 99%.',400);
   if(!Array.isArray(body.roles)||body.roles.length>30||body.roles.some(r=>typeof r!=='string'||r.length>60))accessError('Roles inválidos.',400);
   const adjustmentMode=body.adjustmentMode??policy.adjustmentMode??'percent',exchangeRate=Number(body.exchangeRate||policy.exchangeRate||0);
   if(!['percent','nio','usd'].includes(adjustmentMode)||!Number.isFinite(exchangeRate)||exchangeRate<0||exchangeRate>1e6||adjustmentMode==='usd'&&!usdRate(access.company.data,new Date().toISOString().slice(0,10))&&exchangeRate<=0)accessError('Revisa la forma de ajuste y la tasa de cambio.',400);
   Object.assign(policy,{adjustmentMode,exchangeRate:exchangeRate||null,maximum,roles:[...new Set(body.roles.map(r=>r.trim().toLowerCase()).filter(Boolean))],version:(policy.version||0)+1});
   await save(client,id,policy);await audit(client,id,session,'Configuración de descuentos',[{area:'descuentos',maximum,roles:policy.roles,passwordChanged:!!body.password,adjustmentMode,exchangeRate:policy.exchangeRate}]);return safe(policy);
  }
  if(body.action==='log'){
   if(!access.owner)accessError('Solo el dueño consulta la bitácora de descuentos.');
   return {events:await client.select().from(auditEvents).where(and(eq(auditEvents.companyId,id),eq(auditEvents.action,'Descuentos'))).orderBy(desc(auditEvents.createdAt)).limit(200)};
  }
  if(body.action!=='authorize'||!allowed(access,'facturacion',true))accessError('Sin permiso para aplicar descuentos.');
  if(!access.owner&&(access.rolePolicy?access.rolePolicy.specials?.discounts!==true:!policy.roles?.includes(operationalRole(access))))accessError('Tu rol no tiene autorización para descuentos.');
  const discount=Number(body.discount);
  if(!access.branchId)accessError('Selecciona una sucursal.',400);
  const adjustments=invoiceAdjustments(scopeBranch(access.company.data,access),body,policy);
  if(!Number.isFinite(discount)||discount<0||discount>(policy.maximum??99)||!discount&&!adjustments.some(Boolean))accessError(`El descuento máximo es ${policy.maximum??99}%.`,400);
  const actor=operatorId(access,session), attemptKey='discount-attempt:'+id+':'+actor;
  const attempt=(await client.select().from(siteContent).where(eq(siteContent.id,attemptKey)))[0]?.content||{count:0};
  const persistAttempt=async()=>client.insert(siteContent).values({id:attemptKey,content:attempt}).onConflictDoUpdate({target:siteContent.id,set:{content:attempt,updatedAt:new Date()}});
  if(attempt.until>Date.now())return {error:'Descuentos bloqueados durante 5 minutos. Intenta más tarde.',status:429};
  if(attempt.until){attempt.count=0;delete attempt.until;}
  if(!policy.hash)accessError('El dueño debe definir la contraseña de descuentos.',400);
  if(typeof body.password!=='string'||!await verifyPassword(body.password,policy.hash)){
   attempt.count++;if(attempt.count>=4)attempt.until=Date.now()+300000;
   await persistAttempt();await audit(client,id,session,'Descuentos',[{area:'descuentos',event:attempt.until?'Bloqueo por cuatro contraseñas incorrectas':'Contraseña incorrecta',until:attempt.until||null}]);
   return {error:attempt.until?'Descuentos bloqueados durante 5 minutos.':'Contraseña incorrecta. El descuento no se aplicó.',status:attempt.until?429:400};
  }
  attempt.count=0;delete attempt.until;await persistAttempt();
  if(discount>0&&adjustments.some(Boolean))accessError('No combines un ajuste de precio con otro descuento.',400);
  const token=randomBytes(32).toString('hex'),grantId='discount-grant:'+createHash('sha256').update(token).digest('hex');
  await client.insert(siteContent).values({id:grantId,content:{companyId:id,actor,branch:access.branchId,version:policy.version||0,fingerprint:fingerprint(body),adjustments:JSON.stringify(adjustments),expires:Date.now()+600000}});
  return {token,adjustments};
 });
 if(result.error)accessError(result.error,result.status);return result;
}
export async function consumeDiscount(client,id,access,session,body,data=access.company.data){
 const policy=await read(client,id),adjustments=invoiceAdjustments(data,body,policy);
 if(!Number(body.discount)&&!adjustments.some(Boolean))return adjustments;
 if(Number(body.discount)>0&&adjustments.some(Boolean))accessError('No combines un ajuste de precio con otro descuento.',400);
 const attemptKey='discount-attempt:'+id+':'+operatorId(access,session);
 const attempt=(await client.select().from(siteContent).where(eq(siteContent.id,attemptKey)))[0]?.content;
 if(attempt?.until>Date.now())accessError('Descuentos bloqueados durante 5 minutos. Intenta más tarde.',429);
 if(!access.owner&&(access.rolePolicy?access.rolePolicy.specials?.discounts!==true:!policy.roles?.includes(operationalRole(access))))accessError('Tu rol no tiene autorización para descuentos.');
 if(Number(body.discount)>(policy.maximum??99))accessError(`El descuento máximo es ${policy.maximum??99}%.`,400);
 const grantId='discount-grant:'+createHash('sha256').update(String(body.discountAuthorization||'')).digest('hex');
 const grant=(await client.select().from(siteContent).where(eq(siteContent.id,grantId)))[0]?.content;
 if(!grant||grant.companyId!==id||grant.actor!==operatorId(access,session)||grant.branch!==access.branchId||grant.version!==(policy.version||0)||grant.expires<Date.now()||grant.fingerprint!==fingerprint(body)||grant.adjustments!==JSON.stringify(adjustments))accessError('Autoriza de nuevo el descuento con la contraseña del dueño.',400);
 await client.delete(siteContent).where(eq(siteContent.id,grantId));
 return adjustments;
}
