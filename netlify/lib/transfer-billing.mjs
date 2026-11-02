import {randomBytes} from 'node:crypto';
import {and,eq,desc,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {users,companies,siteContent,billingChannels,transferRequests,customerPayments,billingCheckouts,subscriptions,servicePlans} from '../../db/schema.ts';
import {billingError,providerConfig,managuaDay,entitlement} from './billing-rules.mjs';
import {plans,event,confirmPayment,subscription,bookPayment} from './billing.mjs';
import {requirePlatform} from './platform.mjs';
const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
export async function channelFor(email,client=db){
 const [saved]=await client.select().from(billingChannels).where(eq(billingChannels.email,email));
 if(saved)return saved;
 const [previous]=await client.select({id:customerPayments.id}).from(customerPayments).where(and(eq(customerPayments.email,email),sql`${customerPayments.method}='Pagadito' OR ${customerPayments.providerKey} LIKE 'sandbox:ACT-%' OR ${customerPayments.providerKey} LIKE 'production:ACT-%'`)).limit(1);
 return {email,channel:previous?'pagadito':'unassigned',permit:null,version:0};
}
export async function guardPagaditoChannel(session){
 // A technical lookup failure must not prevent a new customer from paying.
 let channel;try{channel=await channelFor(session.email)}catch{return}
 if(channel.channel==='transfer'&&channel.permit!=='pagadito')billingError('Tu cuenta paga por transferencia. Para cambiar de método, contacta a Acontec.',403);
}
async function settings(client=db){const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'transfer-settings'));return row?.content||{revision:0,enabled:false,accounts:[],whatsapp:'',rateMicros:0,rateDate:''}}
async function owner(session){
 if(session.member)billingError('Solo el dueño puede solicitar transferencias.',403);
 const [company]=await db.select({owner:companies.ownerEmail,testPlan:companies.testPlan}).from(companies).where(eq(companies.id,session.activeCompanyId));
 if(!company||company.owner!==session.email||company.testPlan)billingError('Abre una empresa propia sin prueba interna.',403);
}
export async function transferMe(session){
 await owner(session);const config=await settings(),channel=await channelFor(session.email);
 const open=await db.select().from(transferRequests).where(eq(transferRequests.email,session.email)).orderBy(desc(transferRequests.createdAt)).limit(1);
 const request=open[0]?{...open[0],state:open[0].state==='pending'&&open[0].expiresAt<=new Date()?'expired':open[0].state}:null;
 return {settingsRevision:config.revision,enabled:config.enabled,channel,request,accounts:config.enabled?config.accounts.filter(a=>a.active):[],whatsapp:config.enabled?config.whatsapp:'',rateMicros:config.rateMicros,rateDate:config.rateDate};
}
export async function requestTransfer(session,body){
 await owner(session);
 return db.transaction(async client=>{
  await client.select().from(users).where(eq(users.email,session.email)).for('update');
  const config=await settings(client),channel=await channelFor(session.email,client);
  if(!config.enabled)billingError('Las transferencias no están habilitadas.',403);
  if(channel.channel==='pagadito'&&channel.permit!=='transfer')billingError('Tu cuenta paga por Pagadito. Para cambiar de método, contacta a Acontec.',403);
  if(body.code){const [draft]=await client.select().from(transferRequests).where(and(eq(transferRequests.code,body.code),eq(transferRequests.email,session.email))).for('update');if(!draft||draft.expiresAt<=new Date())billingError('La referencia venció. Solicita otra.',409);if(draft.state==='pending')return {request:draft};if(draft.state!=='draft'||body.confirmed!==true)billingError('Confirma la solicitud.');const [request]=await client.update(transferRequests).set({state:'pending',version:draft.version+1,expiresAt:new Date(Date.now()+7*86400000)}).where(eq(transferRequests.code,draft.code)).returning();await event(client,session.email,session.email,'Transferencia por confirmar',{code:draft.code});return {request};}
  await client.update(transferRequests).set({state:'expired',version:sql`${transferRequests.version}+1`}).where(and(eq(transferRequests.email,session.email),sql`${transferRequests.state} IN ('pending','draft')`,sql`${transferRequests.expiresAt}<=now()`));
  const [open]=await client.select().from(transferRequests).where(and(eq(transferRequests.email,session.email),sql`${transferRequests.state} IN ('pending','draft')`));if(open?.state==='pending')return {request:open};
  if(open?.state==='draft'){if(open.plan===body.plan&&open.interval===body.interval&&open.currency===body.currency)return {request:open};await client.update(transferRequests).set({state:'expired',version:open.version+1}).where(eq(transferRequests.code,open.code));}
  const [plan]=await client.select().from(servicePlans).where(eq(servicePlans.id,body.plan));
  if(!plan?.active||!['mensual','anual'].includes(body.interval))billingError('Plan o periodo inválido.');
  if(!config.accounts.some(a=>a.active&&a.currency===body.currency))billingError('Moneda sin cuenta activa.');
  if(body.settingsRevision!==config.revision||body.planVersion!==plan.version)billingError('Los datos de pago cambiaron. Revisa el importe.',409);
  const usdCents=body.interval==='anual'?plan.annualCents:plan.monthlyCents;
  const expectedCents=body.currency==='USD'?usdCents:Number((BigInt(usdCents)*BigInt(config.rateMicros)+500000n)/1000000n);
  if(!Number.isSafeInteger(expectedCents)||expectedCents<1||expectedCents>2147483647)billingError('Tipo de cambio inválido.');
  const code='ACT-'+randomBytes(8).toString('hex').toUpperCase(),environment=providerConfig().environment;
  if(!['sandbox','production'].includes(environment))billingError('Configura el entorno de pagos antes de habilitar transferencias.',503);
  const [request]=await client.insert(transferRequests).values({state:'draft',code,email:session.email,plan:plan.id,interval:body.interval,currency:body.currency,expectedCents,usdCents,environment,exchange:{rateMicros:config.rateMicros,date:config.rateDate},expiresAt:new Date(Date.now()+7*86400000)}).returning();
  await event(client,session.email,session.email,'Referencia de transferencia preparada',{code,expectedCents,currency:body.currency,environment});return {request};
 });
}
export async function transferAdmin(session,method,body){
 await requirePlatform(session,session.activeCompanyId);
 if(method==='GET')return {settings:await settings(),requests:await db.select().from(transferRequests).orderBy(desc(transferRequests.createdAt)).limit(1000),channels:await db.select().from(billingChannels).limit(5000)};
 if(method!=='POST')billingError('Método no permitido.',405);
 const reason=clean(body.reason,1000);if(body.confirmed!==true||reason.length<3)billingError('Confirma e indica el motivo.');
 return db.transaction(async client=>{
  await requirePlatform(session,session.activeCompanyId,client);
  if(body.operation==='settings'){
   if(body.confirmation!=='CONFIRMAR COBROS')billingError('Escribe CONFIRMAR COBROS para cambiar cuentas o WhatsApp.');
   await client.insert(siteContent).values({id:'transfer-settings',content:{revision:0}}).onConflictDoNothing();const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'transfer-settings')).for('update');if(row.content.revision!==body.version)billingError('La configuración cambió.',409);
   if(!Array.isArray(body.accounts)||body.accounts.length>20)billingError('Máximo 20 cuentas.');
   const accounts=body.accounts.map(a=>{if(!['USD','NIO'].includes(a.currency))billingError('Moneda inválida.');return {bank:clean(a.bank),holder:clean(a.holder),type:clean(a.type,60),number:clean(a.number,80),currency:a.currency,instructions:clean(a.instructions,1000),active:a.active===true}});
   const whatsapp=clean(body.whatsapp,16);if(whatsapp&&!/^\d{8,15}$/.test(whatsapp))billingError('WhatsApp requiere código de país, solo dígitos.');
   if(!Number.isSafeInteger(body.rateMicros)||body.rateMicros<0||body.rateMicros>1000000000)billingError('Tipo de cambio inválido.');
   if(body.enabled&&(!whatsapp||!accounts.some(a=>a.active)||accounts.some(a=>a.active&&(!a.bank||!a.holder||!a.number))||accounts.some(a=>a.active&&a.currency==='NIO')&&(!body.rateMicros||!/^\d{4}-\d{2}-\d{2}$/.test(body.rateDate))))billingError('Completa cuentas, WhatsApp y tipo de cambio fechado.');
   const content={accounts,whatsapp,rateMicros:body.rateMicros,rateDate:clean(body.rateDate,10),enabled:body.enabled===true,revision:row.content.revision+1};await client.update(siteContent).set({content,updatedAt:new Date()}).where(eq(siteContent.id,row.id));await event(client,session.email,session.email,'Configuración de transferencias actualizada',{revision:content.revision,reason});return {ok:true};
  }
  const email=clean(body.email,254).toLowerCase();const [user]=await client.select().from(users).where(eq(users.email,email)).for('update');if(!user||user.platformAdmin)billingError('Cliente no disponible.');
  const ch=await channelFor(email,client);
  if(body.operation==='channel'){
   if(ch.version!==body.version)billingError('El canal cambió.',409);if(!['pagadito','transfer'].includes(body.channel))billingError('Canal inválido.');
   if(body.channel==='transfer')await noRecurring(client,email);
   await client.insert(billingChannels).values({email,channel:ch.channel,permit:body.channel,version:ch.version+1}).onConflictDoUpdate({target:billingChannels.email,set:{permit:body.channel,version:ch.version+1}});
   await event(client,email,session.email,'Cambio de canal autorizado una vez',{from:ch.channel,to:body.channel,reason});return {ok:true};
  }
  let r;
  if(body.operation==='register'){
   const [plan]=await client.select().from(servicePlans).where(eq(servicePlans.id,body.plan)).for('share');const config=await settings(client);
   if(!plan?.active||plan.version!==body.planVersion||!['mensual','anual'].includes(body.interval)||!['USD','NIO'].includes(body.currency))billingError('Revisa el plan, periodo y moneda.',409);
   if(body.currency==='NIO'&&(!config.rateMicros||!config.rateDate))billingError('Configura un tipo de cambio fechado.');
   const usdCents=body.interval==='anual'?plan.annualCents:plan.monthlyCents,expectedCents=body.currency==='USD'?usdCents:Number((BigInt(usdCents)*BigInt(config.rateMicros)+500000n)/1000000n),code='ACT-'+randomBytes(8).toString('hex').toUpperCase(),environment=providerConfig().environment;
   if(!['sandbox','production'].includes(environment))billingError('Configura el entorno de pagos.',503);
   [r]=await client.insert(transferRequests).values({code,email,plan:plan.id,interval:body.interval,currency:body.currency,expectedCents,usdCents,environment,exchange:{rateMicros:config.rateMicros,date:config.rateDate},expiresAt:new Date(Date.now()+7*86400000)}).returning();
  }else [r]=await client.select().from(transferRequests).where(and(eq(transferRequests.code,body.code),eq(transferRequests.email,email))).for('update');
  if(!r)billingError('Solicitud no encontrada.',404);
  if((body.operation!=='register'&&r.version!==body.version)||r.state!=='pending')billingError('La solicitud ya fue revisada o cambió.',409);
  if(r.expiresAt<=new Date())billingError('La solicitud venció. Crea otra solicitud.',409);
  if(body.operation==='reject'){await client.update(transferRequests).set({state:'rejected',reason,version:r.version+1}).where(eq(transferRequests.code,r.code));await event(client,email,session.email,'Transferencia rechazada',{code:r.code,reason});return {ok:true}}
  if(!['approve','register'].includes(body.operation))billingError('Operación inválida.');
  if(ch.channel==='pagadito'&&ch.permit!=='transfer')billingError('Autoriza primero el cambio de canal.',409);
  await noRecurring(client,email);
  if(r.environment!==providerConfig().environment)billingError('La solicitud pertenece a otro entorno.',409);
  const reference=clean(body.reference,150).normalize('NFKC').toUpperCase();if(!reference)billingError('Ingresa referencia bancaria.');
  if(!Number.isSafeInteger(body.receivedCents)||body.receivedCents<1||body.receivedCents>2147483647)billingError('Monto inválido.');
  if(body.receivedCents!==r.expectedCents&&body.differenceConfirmed!==true)billingError('El monto difiere. Confirma expresamente la diferencia y su motivo.');
  await subscription(email,client);const [sub]=await client.select().from(subscriptions).where(eq(subscriptions.email,email)).for('update');if(body.subscriptionVersion!==sub.version)billingError('La suscripción cambió. Recarga.',409);
  const [payment]=await client.insert(customerPayments).values({email,amountCents:body.receivedCents,currency:r.currency,status:'por_verificar',plan:r.plan,interval:r.interval,providerKey:r.environment+':transfer:'+reference,reference,method:'Transferencia',actor:session.email,date:managuaDay()}).onConflictDoNothing().returning();if(!payment)billingError('La referencia bancaria ya fue registrada.',409);
  // Reuse the receipt, accounting and term-extension transaction. Sandbox never activates real access.
  let confirmedSnapshot=payment;
  if(r.currency==='NIO'&&r.environment==='production'){
   const rate=r.exchange?.rateMicros;if(!Number.isSafeInteger(rate)||rate<=0)billingError('La solicitud no tiene un tipo de cambio válido.',409);
   const converted=Number((BigInt(payment.amountCents)*1000000n+BigInt(Math.floor(rate/2)))/BigInt(rate));
   if(!Number.isSafeInteger(converted)||converted<1)billingError('La conversión contable no es válida.');
   // Explicit, dated conversion; receipt and payment retain the actual bank currency.
   await bookPayment(client,{...payment,currency:'USD',amountCents:converted});
   const [booked]=await client.select().from(customerPayments).where(eq(customerPayments.id,payment.id));confirmedSnapshot={...payment,journalId:booked.journalId};
   await event(client,email,session.email,'Conversión explícita de transferencia para asiento USD',{paymentId:payment.id,receivedCents:payment.amountCents,convertedCents:converted,rateMicros:rate,rateDate:r.exchange.date,reason});
  }
  await confirmPayment(client,confirmedSnapshot,session.email,r.environment==='production'||providerConfig().environment==='sandbox');
  await client.update(transferRequests).set({state:'approved',reason,paymentId:payment.id,version:r.version+1}).where(eq(transferRequests.code,r.code));
  await client.insert(billingChannels).values({email,channel:'transfer',version:ch.version+1}).onConflictDoUpdate({target:billingChannels.email,set:{channel:'transfer',permit:null,version:ch.version+1}});
  await event(client,email,session.email,'Transferencia aprobada',{code:r.code,expectedCents:r.expectedCents,receivedCents:body.receivedCents,currency:r.currency,environment:r.environment,paymentId:payment.id,reason});return {ok:true};
 });
}
async function noRecurring(client,email){const [row]=await client.select({id:billingCheckouts.id}).from(billingCheckouts).where(and(eq(billingCheckouts.email,email),sql`${billingCheckouts.state} IN ('creating','pending','unknown','active')`)).limit(1);if(row)billingError('Cancela y concilia primero los cobros recurrentes de Pagadito para evitar doble cobro.',409)}
export async function transferStatusSummary(session){
 await requirePlatform(session,session.activeCompanyId);
 const rows=await db.execute(sql`SELECT u.email,u.name,s.state,s.paid_until,s.trial_ends_at,s.paid_environment,s.canceled_at,s.plan,s.version AS subscription_version,coalesce(ch.channel,'unassigned') AS channel,
 EXISTS(SELECT 1 FROM acontec_transfer_requests r WHERE r.email=u.email AND r.state='pending' AND r.expires_at>now()) AS pending,
 EXISTS(SELECT 1 FROM acontec_customer_payments p WHERE p.email=u.email AND p.status='confirmado' AND p.date>=${managuaDay().slice(0,7)+'-01'} AND p.date<=${managuaDay()} AND CASE WHEN ${providerConfig().environment}='sandbox' THEN p.provider_key LIKE 'sandbox:%' ELSE coalesce(p.provider_key,'') NOT LIKE 'sandbox:%' END) AS paid_month
 FROM acontec_users u LEFT JOIN acontec_subscriptions s ON s.email=u.email LEFT JOIN acontec_billing_channels ch ON ch.email=u.email
 WHERE u.platform_admin=false AND u.email NOT LIKE '%@access.acontec.invalid' LIMIT 5000`);
 return {clients:(rows.rows||rows).map(r=>{const p=r.paid_until?new Date(r.paid_until).getTime():0,sub=entitlement({state:r.state,plan:r.plan,paidUntil:r.paid_until,trialEndsAt:r.trial_ends_at,paidEnvironment:r.paid_environment,canceledAt:r.canceled_at});return {...r,status:r.state==='suspendido'?'Suspendido':r.pending?'Por confirmar':p>Date.now()?(p-Date.now()<=7*86400000?'Vence pronto':'Al día'):sub.state==='en_gracia'?'Pendiente de pago':sub.state==='prueba'?'En prueba':'Suspendido'}})};
}
