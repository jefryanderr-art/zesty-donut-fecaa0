import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { siteContent, auditEvents, companyMembers, companyRoles } from '../../db/schema.ts';
import { companyAccess, allowed, accessError, passwordDigest, verifyPassword, audit } from './access.mjs';
import { invoicePriceAdjustment, moneyCents } from './accounting-engine.mjs';
import { effectiveFoodPrice } from './food-workflows.mjs';
import { commercePrice } from './commerce.mjs';
import { commerceRouteApprovalMatches } from '../../public/commerce-math.mjs';
import { scopeBranch } from './branches.mjs';
import { operatorId, operationalRole } from './policies.mjs';
const key = id => 'discount-policy:' + id;
const admin = access => access.owner || allowed(access, 'accesibilidad', true);
const fingerprint = body => {
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>200||body.items.some(i=>!i||typeof i.p!=='string'||typeof i.q!=='number'||!Number.isFinite(i.q)||i.q<=0||typeof i.u!=='number'||!Number.isFinite(i.u)||i.u<0))accessError('Revisa productos, cantidades y precios antes de autorizar.',400);
 return createHash('sha256').update(JSON.stringify({...(body.routeOrderApproval===true?{routeOrderApproval:true,routeOrderId:body.routeOrderId}:{}),discount:Number(body.discount),date:body.date||'',customerId:body.customerId||'',commercePresentations:body.commercePresentations||[],items:body.items.map(i=>({p:i.p,q:i.q,u:i.u}))})).digest('hex');
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
  if(body.routeOrderApproval===true){
   if(!access.owner&&access.routeRole!=='route_supervisor')accessError('Solo el dueño o supervisor autoriza precios de pedidos.');
   if(!allowed(access,'rutas',true)||Number(body.discount)!==0)accessError('Autoriza los precios por línea desde Rutas y preventa.');
   const order=scopeBranch(access.company.data,access).businessRecords?.find(r=>r.id===body.routeOrderId&&r.kind==='route-order'&&r.branchId===access.branchId);
   if(!order||['Entregado','Cancelado'].includes(order.status)||fingerprint(body)!==fingerprint(routeOrderDiscountBody(order,body.date)))accessError('El pedido cambió. Ábrelo de nuevo antes de autorizar.',409);
  }
  let routeApprover=null;
  const supervisorUsername=String(body.routeSupervisor||'').trim().toLowerCase();
  if(access.routeRole&&supervisorUsername){
    const [candidate]=await client.select({id:companyMembers.id,name:companyMembers.name,passwordHash:companyMembers.passwordHash,version:companyMembers.version,branchIds:companyMembers.branchIds,exceptions:companyMembers.permissionExceptions,policy:companyRoles.policy}).from(companyMembers).innerJoin(companyRoles,eq(companyRoles.id,companyMembers.roleId)).where(and(eq(companyMembers.companyId,id),eq(companyMembers.username,supervisorUsername),eq(companyMembers.active,true),eq(companyRoles.key,'route_supervisor')));
    routeApprover=candidate&&candidate.branchIds.includes(access.branchId)&&(candidate.exceptions||candidate.policy)?.specials?.discounts===true?candidate:null;
  }
  if(!routeApprover&&!access.owner&&(access.rolePolicy?access.rolePolicy.specials?.discounts!==true:!policy.roles?.includes(operationalRole(access))))accessError('Tu rol requiere la autorización de un supervisor de ruta.');
  const discount=Number(body.discount);
  if(!access.branchId)accessError('Selecciona una sucursal.',400);
  const adjustments=invoiceAdjustments(scopeBranch(access.company.data,access),body,policy);
  if(!Number.isFinite(discount)||discount<0||discount>(policy.maximum??99)||!discount&&!adjustments.some(Boolean))accessError(`El descuento máximo es ${policy.maximum??99}%.`,400);
  const actor=operatorId(access,session), attemptKey='discount-attempt:'+id+':'+actor;
  const attempt=(await client.select().from(siteContent).where(eq(siteContent.id,attemptKey)))[0]?.content||{count:0};
  const persistAttempt=async()=>client.insert(siteContent).values({id:attemptKey,content:attempt}).onConflictDoUpdate({target:siteContent.id,set:{content:attempt,updatedAt:new Date()}});
  if(attempt.until>Date.now())return {error:'Descuentos bloqueados durante 5 minutos. Intenta más tarde.',status:429};
  if(attempt.until){attempt.count=0;delete attempt.until;}
  if(!policy.hash&&!routeApprover)accessError('El dueño debe definir la contraseña de descuentos.',400);
  if(typeof body.password!=='string'||!await verifyPassword(body.password,routeApprover?.passwordHash||policy.hash)){
   attempt.count++;if(attempt.count>=4)attempt.until=Date.now()+300000;
   await persistAttempt();await audit(client,id,session,'Descuentos',[{area:'descuentos',event:attempt.until?'Bloqueo por cuatro contraseñas incorrectas':'Contraseña incorrecta',until:attempt.until||null}]);
   return {error:attempt.until?'Descuentos bloqueados durante 5 minutos.':'Contraseña incorrecta. El descuento no se aplicó.',status:attempt.until?429:400};
  }
  attempt.count=0;delete attempt.until;await persistAttempt();
  if(discount>0&&adjustments.some(Boolean))accessError('No combines un ajuste de precio con otro descuento.',400);
  const token=randomBytes(32).toString('hex'),grantId='discount-grant:'+createHash('sha256').update(token).digest('hex');
  await client.insert(siteContent).values({id:grantId,content:{companyId:id,actor,branch:access.branchId,version:policy.version||0,fingerprint:fingerprint(body),adjustments:JSON.stringify(adjustments),...(routeApprover?{routeApproverId:routeApprover.id,routeApproverVersion:routeApprover.version}:{}),expires:Date.now()+600000}});
  if(routeApprover)await audit(client,id,session,'Descuentos',[{area:'descuentos',event:'Descuento autorizado por supervisor de ruta',approvedBy:routeApprover.name,approvedById:routeApprover.id,operatorId:actor,branchId:access.branchId}]);
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

 if(Number(body.discount)>(policy.maximum??99))accessError(`El descuento máximo es ${policy.maximum??99}%.`,400);
 const grantId='discount-grant:'+createHash('sha256').update(String(body.discountAuthorization||'')).digest('hex');
 const grant=(await client.select().from(siteContent).where(eq(siteContent.id,grantId)))[0]?.content;
 if(!grant||grant.companyId!==id||grant.actor!==operatorId(access,session)||grant.branch!==access.branchId||grant.version!==(policy.version||0)||grant.expires<Date.now()||grant.fingerprint!==fingerprint(body)||grant.adjustments!==JSON.stringify(adjustments))accessError('Autoriza de nuevo el descuento con la contraseña del dueño.',400);
 if(grant.routeApproverId){const [approver]=await client.select({version:companyMembers.version,branchIds:companyMembers.branchIds,exceptions:companyMembers.permissionExceptions,policy:companyRoles.policy}).from(companyMembers).innerJoin(companyRoles,eq(companyRoles.id,companyMembers.roleId)).where(and(eq(companyMembers.id,grant.routeApproverId),eq(companyMembers.companyId,id),eq(companyMembers.active,true),eq(companyRoles.key,'route_supervisor')));if(!access.routeRole||!approver||approver.version!==grant.routeApproverVersion||!approver.branchIds.includes(access.branchId)||(approver.exceptions||approver.policy)?.specials?.discounts!==true)accessError('La autorización del supervisor venció. Autoriza de nuevo.');}
 else if(!access.owner&&(access.rolePolicy?access.rolePolicy.specials?.discounts!==true:!policy.roles?.includes(operationalRole(access))))accessError('Tu rol no tiene autorización para descuentos.');
 await client.delete(siteContent).where(eq(siteContent.id,grantId));
 return adjustments;
}

export const routeOrderDiscountBody=(order,date=order.date)=>({routeOrderApproval:true,routeOrderId:order.id,customerId:order.customerId,date,discount:0,items:order.items.map(i=>({p:i.p,q:i.q,u:i.u}))});
export async function approveRouteOrderPrices(client,id,access,session,order,authorization,data,pricingDate=order.date){
 if(!access.owner&&access.routeRole!=='route_supervisor')accessError('Solo el dueño o supervisor autoriza precios de pedidos.');
 const policy=await read(client,id),body=routeOrderDiscountBody(order,pricingDate),adjustments=invoiceAdjustments(data,body,policy);
 if(!adjustments.some(Boolean))return null;
 const grant=(await client.select().from(siteContent).where(eq(siteContent.id,'discount-grant:'+createHash('sha256').update(String(authorization||'')).digest('hex'))))[0]?.content;
 await consumeDiscount(client,id,access,session,{...body,discountAuthorization:authorization},data);
 const approval={id:randomUUID(),orderId:order.id,customerId:order.customerId,branchId:access.branchId,policyVersion:policy.version||0,approvedBy:grant?.routeApproverId||operatorId(access,session),requestedBy:operatorId(access,session),approvedByName:grant?.routeApproverId||session.member?.name||session.email,approverVersion:grant?.routeApproverVersion??access.member?.version??null,at:new Date().toISOString(),lines:order.items.map(i=>({productId:i.p,q:i.q,unitPriceCents:moneyCents(i.u),normalPriceCents:moneyCents(normalInvoicePrice(data,data.products.find(p=>p.id===i.p),body))}))};
 await client.insert(siteContent).values({id:'route-price-approval:'+id+':'+approval.id,content:approval});
 await audit(client,id,session,'Descuentos',[{area:'descuentos',event:'Precio especial autorizado en pedido',orderId:order.id,approvalId:approval.id,approvedBy:approval.approvedBy,lines:approval.lines}]);
 return approval;
}
export async function routeOrderPriceAdjustments(client,id,access,session,order,body,data){
 const policy=await read(client,id),adjustments=invoiceAdjustments(data,body,policy);
 if(Number(body.discount||0)!==0)accessError('Las entregas usan el precio autorizado en el pedido, sin descuento adicional.');
 if(body.items.some(i=>!order.items.some(line=>line.p===i.p&&moneyCents(line.u)===moneyCents(i.u))))accessError('El precio de entrega no coincide con el precio del pedido.');
 if(!adjustments.some(Boolean))return adjustments;
 const approval=order.priceApproval?.id?(await client.select().from(siteContent).where(eq(siteContent.id,'route-price-approval:'+id+':'+order.priceApproval.id)))[0]?.content:null;
 if(!commerceRouteApprovalMatches(approval,order,body,access.branchId,policy.version||0))accessError('Autoriza los precios especiales de este pedido antes de preparar o entregar.');
 if(approval.approvedBy!==access.company.ownerEmail){
  const [approver]=await client.select({version:companyMembers.version,branchIds:companyMembers.branchIds,exceptions:companyMembers.permissionExceptions,policy:companyRoles.policy}).from(companyMembers).innerJoin(companyRoles,eq(companyRoles.id,companyMembers.roleId)).where(and(eq(companyMembers.id,approval.approvedBy),eq(companyMembers.companyId,id),eq(companyMembers.active,true),eq(companyRoles.key,'route_supervisor')));
  if(!approver||approver.version!==approval.approverVersion||!approver.branchIds.includes(access.branchId)||(approver.exceptions||approver.policy)?.specials?.discounts!==true)accessError('La autorización del supervisor ya no está vigente. Autoriza otra vez el pedido.');
 }
 const attempt=(await client.select().from(siteContent).where(eq(siteContent.id,'discount-attempt:'+id+':'+operatorId(access,session))))[0]?.content;
 if(attempt?.until>Date.now())accessError('Descuentos bloqueados durante 5 minutos. Intenta más tarde.',429);
 return adjustments;
}
