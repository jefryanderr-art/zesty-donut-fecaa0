import {legalHash} from './legal-templates.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {and,eq,desc,sql,isNull} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {users,companies,subscriptions,servicePlans,billingCheckouts,customerPayments,customerEvents,serviceMessages,siteContent,legalAcceptances,auditEvents,companyBackups} from '../../db/schema.ts';
import {servicePaymentKey,DEFAULT_PLANS,entitlement,moduleIncluded,providerConfig,billingError,managuaDay,addMonths,dayEnd,env} from './billing-rules.mjs';
import {pagadito,safePaymentUrl} from './pagadito.mjs';
import {readAccounting,syncAccounting} from './accounting-storage.mjs';
import {guardPeriods} from './period-controls.mjs';
import {normalizeDocument} from './accounting-codec.mjs';

export async function plans(client=db){const existing=await client.select().from(servicePlans);if(DEFAULT_PLANS.every(p=>existing.some(row=>row.id===p.id)))return existing;for(const p of DEFAULT_PLANS)await client.insert(servicePlans).values(p).onConflictDoNothing();return client.select().from(servicePlans)}
export async function event(client,email,actor,action,details={}){await client.insert(customerEvents).values({email,actor,action,details})}
export async function subscription(email,client=db){
 let [sub]=await client.select().from(subscriptions).where(eq(subscriptions.email,email));if(sub)return sub;if(client===db)return db.transaction(tx=>subscription(email,tx));
 const [user]=await client.select().from(users).where(eq(users.email,email));if(!user)billingError('Cuenta no encontrada.',404);
 const profile=user.profile||{},paid=profile.paidUntil&&Number.isFinite(Date.parse(profile.paidUntil))?dayEnd(profile.paidUntil.slice(0,10)):null;
 const created=await client.insert(subscriptions).values({email,trialEndsAt:new Date(Date.now()+86400000),plan:paid?(DEFAULT_PLANS.find(p=>p.id===String(profile.plan||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^plan\s*/,''))?.id||'pro'):null,paidUntil:paid,state:profile.state==='suspendido'?'suspendido':paid?'activo':'prueba'}).onConflictDoNothing().returning({email:subscriptions.email});
 if(created.length)await event(client,email,email,'Suscripción inicializada',{trialHours:24,preservedLegacyPayment:!!paid,legacyPlan:profile.plan||null});
 [sub]=await client.select().from(subscriptions).where(eq(subscriptions.email,email));if(created.length)await projectProfile(client,sub);return sub;
}
export async function accountAccess(email,admin=false,client=db){const sub=await subscription(email,client),ent=entitlement(sub,admin),list=await plans(client),plan=admin?DEFAULT_PLANS.find(p=>p.id==='pro'):list.find(p=>p.id===ent.plan);return {sub,ent,plan:plan?{...plan,limits:admin?plan.limits:{...plan.limits,...sub.limits}}:null}}
export async function requireBilling(email,admin=false,client=db){const a=await accountAccess(email,admin,client);if(!a.ent.access)billingError('Tu acceso venció. Abre Mi suscripción para elegir un plan.',402);return a}
async function projectProfile(client,sub){const [u]=await client.select().from(users).where(eq(users.email,sub.email));const plan=(await plans(client)).find(p=>p.id===sub.plan);await client.update(users).set({profile:{...u.profile,plan:sub.plan||'',state:entitlement(sub).state,paidUntil:sub.paidUntil?managuaDay(new Date(sub.paidUntil)):'',currency:'USD',monthlyAmountCents:plan?(sub.interval==='anual'?Math.round(plan.annualCents/12):plan.monthlyCents):0},version:u.version+1}).where(eq(users.email,sub.email))}
export async function billingMe(session,admin){
 const a=await accountAccess(session.email,admin);
 const [legal]=await db.select().from(siteContent).where(eq(siteContent.id,'legal'));
 const provider=providerConfig(),legalReady=!!(legal?.content?.approved&&legal.content.version&&legal.content.refunds);
 const checkoutReason=session.member?'Solo el dueño de la empresa puede contratar el plan.':!legalReady?'Los pagos están pendientes de habilitación: el titular debe aprobar y publicar los documentos legales desde Administración de clientes.':!provider.ready?'El servicio de pagos todavía no está configurado. Contacta con Acontec.':null;
 return {checkoutReady:!checkoutReason,checkoutReason,legalVersion:legalReady?legal.content.version:null,billingMonths:Math.max(1,Math.min(24,Number(env('PAGADITO_MONTHS')||12)||1)),billingYears:Math.max(1,Math.min(5,Number(env('PAGADITO_YEARS')||3)||1)),entitlement:a.ent,plan:a.plan,version:a.sub.version,provider,serverNow:new Date().toISOString()};
}
export async function checkout(session,body,request){
 if(session.member)billingError('El dueño contrata el plan.',403);
 if(body.accepted!==true)billingError('Acepta términos, privacidad y reembolsos antes de pagar.');
 if(!['mensual','anual'].includes(body.interval))billingError('Modalidad inválida.');
 const [legal]=await db.select().from(siteContent).where(eq(siteContent.id,'legal'));if(!legal?.content?.approved||!legal.content.refunds)billingError('Los documentos legales todavía requieren aprobación del titular.',409);
 const plan=(await plans()).find(p=>p.id===body.plan&&p.active);if(!plan)billingError('Plan no disponible.');
 const config=providerConfig();if(!config.ready)billingError('Pagadito aún no está configurado. No se inició ningún pago.',503);
 const id=randomUUID().replaceAll('-','').slice(0,16),step=body.interval==='anual'?12:1,amountCents=step===12?plan.annualCents:plan.monthlyCents;
 if(body.planVersion!==plan.version||body.amountCents!==amountCents)billingError('El precio del plan cambió. Vuelve a abrir los planes antes de pagar.',409);
 if(body.legalVersion!==legal.content.version)billingError('Los documentos legales cambiaron. Revisa la versión vigente.',409);
 const count=Math.max(1,Math.min(step===12?5:24,Number(env(step===12?'PAGADITO_YEARS':'PAGADITO_MONTHS')||(step===12?3:12))||1));
 const charges=Array.from({length:count},(_,i)=>({ern:`ACT-${id}-${String(i+1).padStart(2,'0')}`,date:addMonths(managuaDay(),i*step),amountCents,status:'PENDING',months:step}));
 // Resolver antes de bloquear la fila; las consultas remotas no mantienen bloqueos SQL.
 const previous=await db.select().from(billingCheckouts).where(and(eq(billingCheckouts.email,session.email),sql`${billingCheckouts.state} in ('creating','pending','unknown')`));
 for(const row of previous){
  if(row.state==='creating'&&Date.now()-row.createdAt.getTime()<60000)billingError('El enlace se está preparando. Intenta de nuevo en unos segundos.',409);
  const resolved=await resolveCheckout(row.id,'replace');
  if(resolved?.state==='active')return {status:'active'};
 }

 await db.transaction(async client=>{
  await client.select().from(users).where(eq(users.email,session.email)).for('update');
  const [open]=await client.select().from(billingCheckouts).where(and(eq(billingCheckouts.email,session.email),sql`${billingCheckouts.state} in ('creating','pending','unknown')`));
  if(open)billingError('El enlace se está preparando. Intenta de nuevo en unos segundos.',409);
  const [currentLegal]=await client.select().from(siteContent).where(eq(siteContent.id,'legal')).for('share');if(!currentLegal.content.approved||legalHash(currentLegal.content)!==legalHash(legal.content))billingError('Los documentos legales cambiaron. Recarga.',409);
  await client.insert(legalAcceptances).values({email:session.email,version:legal.content.version,contentHash:legalHash(legal.content)}).onConflictDoNothing();
  await client.insert(billingCheckouts).values({id,email:session.email,plan:plan.id,interval:body.interval,environment:config.environment,charges,acceptedTerms:{version:legal.content.version,at:new Date().toISOString(),ip:request.headers.get('x-nf-client-connection-ip')||null,hash:createHash('sha256').update(JSON.stringify(legal.content)).digest('hex')}});
 });
 let definitelyRejected=false;
 try{
  const response=await pagadito('authorization-recurring-payments',{permissions:'initial_payment,automatic_charges',currency:'USD',pending_charges:charges.map(c=>({ern:c.ern,description:`Acontec ${plan.name} ${body.interval}`,date:c.date,amount:(c.amountCents/100).toFixed(2),details:[{quantity:1,description:`Suscripción ${plan.name}`,price:(c.amountCents/100).toFixed(2)}]}))});
  definitelyRejected=!!response.code&&response.code!=='PG1008';
  if(response.code!=='PG1008'||!response.data?.url||!response.data?.token)billingError('No se pudo iniciar el pago con Pagadito.',502);
  const url=safePaymentUrl(response.data.url);
  await db.update(billingCheckouts).set({state:'pending',providerToken:response.data.token,paymentUrl:url}).where(eq(billingCheckouts.id,id));
  await event(db,session.email,session.email,'Checkout iniciado',{checkout:id,plan:plan.id,interval:body.interval,environment:config.environment,count});return {url,count};
 }catch(error){
  // Una respuesta perdida conserva la referencia para conciliación automática; no se duplica la autorización.
  await db.update(billingCheckouts).set({state:definitelyRejected?'failed':'unknown'}).where(eq(billingCheckouts.id,id));throw error;
 }
}
async function queueReceipt(client,payment){await client.insert(serviceMessages).values({email:payment.email,subject:'Recibo de suscripción · Acontec',body:`Pago confirmado: ${payment.currency} ${(payment.amountCents/100).toFixed(2)}. Plan ${payment.plan}. Referencia: ${payment.reference}. Consulta Mi suscripción para ver la vigencia.`,actor:payment.actor,dedupeKey:'receipt:'+payment.id}).onConflictDoNothing()}
export async function bookPayment(client,payment){
 if(payment.journalId)return;
 const [settings]=await client.select().from(siteContent).where(eq(siteContent.id,'platform-accounting'));if(!settings?.content?.enabled)return;
 // Nunca mezclar cobros ficticios de sandbox con los libros reales.
 if(payment.providerKey?.startsWith('sandbox:'))return;
 const [company]=await client.select().from(companies).where(and(eq(companies.isPlatformCompany,true),isNull(companies.archivedAt))).for('update');if(!company)billingError('Configura la empresa de plataforma.',409);
 const data=structuredClone(await readAccounting(client,company));if(!data||data.cfg?.cur!==payment.currency)billingError('La moneda contable de Acontec debe coincidir con el cobro. No se aplican conversiones implícitas.',409);
 const {incomeAccount,cashAccount}=settings.content;
 if(!data.accounts?.some(a=>a.code===incomeAccount&&a.tipo==='ingreso')||!data.accounts.some(a=>a.code===cashAccount&&a.tipo==='activo'))billingError('Revisa las cuentas del asiento automático.',409);
 const journalId='service-'+payment.id;
 if(!(data.entries||[]).some(e=>e.id===journalId)){
  data.entries=data.entries||[];data.entries.push({id:journalId,date:payment.date,type:'manual',desc:'Suscripción Acontec · '+payment.reference,branchId:'principal',lines:[{a:cashAccount,d:payment.amountCents/100,c:0},{a:incomeAccount,d:0,c:payment.amountCents/100}],total:payment.amountCents/100});
  guardPeriods(company.data,data,'Ingreso por suscripción');
  normalizeDocument(company.id,data);
  await client.insert(companyBackups).values({companyId:company.id,name:company.name,description:company.description,data:company.data,revision:company.revision}).onConflictDoNothing();
  const [updated]=await client.update(companies).set({data,revision:company.revision+1,updatedAt:new Date()}).where(eq(companies.id,company.id)).returning();await syncAccounting(client,company,updated);
  await client.insert(auditEvents).values({companyId:company.id,actor:payment.actor,action:'Ingreso por suscripción',revision:updated.revision,changes:[{area:'entries',id:journalId,paymentId:payment.id}]});
 }
 await client.update(customerPayments).set({journalId}).where(eq(customerPayments.id,payment.id));
}
export async function confirmPayment(client,payment,actor,activate=true){
 if(payment.status==='confirmado'){await bookPayment(client,payment);return}
 if(payment.status!=='por_verificar')billingError('El pago ya fue rechazado.',409);
 let paidUntil;
 if(activate){
 await subscription(payment.email,client);const [sub]=await client.select().from(subscriptions).where(eq(subscriptions.email,payment.email)).for('update');
 const base=new Date(Math.max(Date.now(),sub.paidUntil&&!(sub.paidEnvironment==='sandbox'&&!payment.providerKey?.startsWith('sandbox:'))?new Date(sub.paidUntil).getTime():0));
 paidUntil=dayEnd(addMonths(managuaDay(base),payment.interval==='anual'?12:1));
 const patch={recurringCents:payment.amountCents,paidEnvironment:payment.providerKey?.startsWith('sandbox:')?'sandbox':null,plan:payment.plan,interval:payment.interval,paidUntil,state:sub.state==='suspendido'?'suspendido':'activo',canceledAt:null,version:sub.version+1};
 await client.update(subscriptions).set(patch).where(eq(subscriptions.email,payment.email));await projectProfile(client,{...sub,...patch});
 }
 await client.update(customerPayments).set({status:'confirmado',version:payment.version+1}).where(eq(customerPayments.id,payment.id));
 await bookPayment(client,payment);await queueReceipt(client,payment);await event(client,payment.email,actor,'Pago confirmado',{paymentId:payment.id,paidUntil:paidUntil?.toISOString()||null});
}
export async function syncCheckout(id){
 const [snapshot]=await db.select().from(billingCheckouts).where(eq(billingCheckouts.id,id));if(!snapshot?.providerToken)return;
 const response=await pagadito('get-status-recurring-payments',{token:snapshot.providerToken},snapshot.environment);
 const records=response?.data?.pending_charges;if(!Array.isArray(records))billingError('El proveedor todavía no confirmó el pago.',502);
 let activation=false;
 await db.transaction(async client=>{
  // Orden uniforme: cliente, checkout, suscripción y libros.
  await client.select().from(users).where(eq(users.email,snapshot.email)).for('update');
  const [row]=await client.select().from(billingCheckouts).where(eq(billingCheckouts.id,id)).for('update');
  const charges=structuredClone(row.charges);let firstCompleted=false;
  for(const charge of charges){
   const record=records.find(r=>r.ern===charge.ern);if(!record)continue;
   if(record.amount!=null&&Math.round(Number(record.amount)*100)!==charge.amountCents)billingError('El importe confirmado no coincide con el cobro.',409);
   if(record.currency&&record.currency!=='USD')billingError('La moneda confirmada no coincide.',409);
   if(!['PENDING','VERIFYING','COMPLETED','FAILED','EXPIRED','CANCELED','REVOKED','UNCOLLECTABLE'].includes(record.status))continue;
   // No regresar pagos completados a pendiente por una notificación retrasada.
   if(charge.status!=='COMPLETED')charge.status=record.status;
   charge.token=record.token_pending||charge.token;
   if(charge===charges[0]&&charge.status==='COMPLETED')firstCompleted=true;
   const key=servicePaymentKey(row.environment,charge.ern);
   if(charge.status==='COMPLETED'){
    const [created]=await client.insert(customerPayments).values({email:row.email,plan:row.plan,interval:row.interval,amountCents:charge.amountCents,currency:'USD',date:charge.date,reference:String(record.reference||charge.ern).slice(0,200),method:'Pagadito',actor:'Pagadito',providerKey:key,status:'por_verificar'}).onConflictDoNothing().returning();
    if(created){
     // Las pruebas conservan historial sin conceder vigencia de producción.
     if(row.environment==='sandbox'&&providerConfig().environment==='production')billingError('Un pago de pruebas no activa producción.',409);
     await confirmPayment(client,created,'Pagadito',false);
    }
   }
  }
  const [latest]=await client.select({id:billingCheckouts.id,createdAt:billingCheckouts.createdAt}).from(billingCheckouts).where(and(eq(billingCheckouts.email,row.email),sql`${billingCheckouts.state} in ('active','canceled')`)).orderBy(desc(billingCheckouts.createdAt)).limit(1);
  const eligible=!latest||latest.createdAt.getTime()<=row.createdAt.getTime();
  activation=firstCompleted&&!['active','canceled'].includes(row.state)&&eligible;
  if(firstCompleted&&eligible){
   await subscription(row.email,client);const [sub]=await client.select().from(subscriptions).where(eq(subscriptions.email,row.email)).for('update');
   let last;for(const charge of charges){if(charge.status!=='COMPLETED')break;last=charge}
   const coverage=dayEnd(addMonths(last.date,last.months));
   const paidUntil=activation?coverage:new Date(Math.max(coverage.getTime(),sub.paidUntil?new Date(sub.paidUntil).getTime():0));
   if(activation||!sub.paidUntil||paidUntil.getTime()!==new Date(sub.paidUntil).getTime()){
    const patch={plan:row.plan,interval:row.interval,recurringCents:last.amountCents,paidEnvironment:row.environment,paidUntil,state:sub.state==='suspendido'?'suspendido':'activo',canceledAt:activation?null:sub.canceledAt,version:sub.version+1};
    await client.update(subscriptions).set(patch).where(eq(subscriptions.email,row.email));await projectProfile(client,{...sub,...patch});await event(client,row.email,'Pagadito','Vigencia sincronizada',{checkout:row.id,paidUntil:paidUntil.toISOString()});
   }
  }
  await client.update(billingCheckouts).set({charges,state:row.state==='canceled'?'canceled':firstCompleted?'active':['FAILED','EXPIRED','CANCELED','REVOKED','UNCOLLECTABLE'].includes(charges[0]?.status)?'failed':row.state,syncedAt:new Date()}).where(eq(billingCheckouts.id,id));
 });
 if(activation||snapshot.state==='active')await cancelOlderCheckouts(snapshot);
}
async function cancelOlderCheckouts(current){const rows=await db.select().from(billingCheckouts).where(eq(billingCheckouts.email,current.email));for(const row of rows)if(row.id!==current.id&&row.createdAt<=current.createdAt&&['active','pending'].includes(row.state))await cancelCheckout(row)}
async function cancelOtherCheckouts(email,except){const rows=await db.select().from(billingCheckouts).where(eq(billingCheckouts.email,email));for(const row of rows)if(row.id!==except&&['active','pending','unknown','creating'].includes(row.state)){if(!row.providerToken)billingError('Hay una autorización pendiente de conciliación con Pagadito. Revisa el comercio antes de cancelar.',409);await cancelCheckout(row)}}
async function cancelCheckout(row){if(row.charges.some(c=>['PENDING','VERIFYING'].includes(c.status)&&!c.token))billingError('Verifica primero los cobros pendientes; todavía no pueden cancelarse.',409);const tokens=row.charges.filter(c=>['PENDING','VERIFYING'].includes(c.status)&&c.token).map(c=>c.token);if(tokens.length){const r=await pagadito('cancel-pending-payments',{token:tokens},row.environment);if(r.code!=='PG1011')billingError('Pagadito no confirmó la cancelación. Reintenta; los cobros siguen visibles.',502)}else if(row.state==='pending')billingError('Verifica primero el pago pendiente para obtener sus cobros.',409);await db.update(billingCheckouts).set({state:'canceled',charges:row.charges.map(c=>['PENDING','VERIFYING'].includes(c.status)?{...c,status:'CANCELED'}:c)}).where(eq(billingCheckouts.id,row.id))}
// Un estado local terminal no equivale a una cancelación del proveedor. Se siguen
// conciliando autorizaciones con token para reconocer confirmaciones tardías.
export async function resolveCheckout(id,reason='return'){
 const [snapshot]=await db.select().from(billingCheckouts).where(eq(billingCheckouts.id,id));
 if(!snapshot)return null;
 let unavailable=false;
 if(snapshot.providerToken){
  try{await syncCheckout(id)}catch{unavailable=true;console.warn('pagadito_reconcile_deferred',{checkout:id,reason})}
 }
 const [checked]=await db.select().from(billingCheckouts).where(eq(billingCheckouts.id,id));
 if(checked&&['creating','pending','unknown'].includes(checked.state)&&checked.charges[0]?.status!=='COMPLETED'&&(reason==='replace'||Date.now()-checked.createdAt.getTime()>=15*60*1000)){
  const tokens=checked.charges.filter(c=>['PENDING','VERIFYING'].includes(c.status)&&c.token).map(c=>c.token);
  if(tokens.length)try{const response=await pagadito('cancel-pending-payments',{token:tokens},checked.environment);if(response.code!=='PG1011')console.warn('pagadito_cancel_deferred',{checkout:id})}catch{console.warn('pagadito_cancel_deferred',{checkout:id})}
 }
 return db.transaction(async client=>{
  await client.select().from(users).where(eq(users.email,snapshot.email)).for('update');
  const [row]=await client.select().from(billingCheckouts).where(eq(billingCheckouts.id,id)).for('update');
  if(row.state==='active'||row.charges[0]?.status==='COMPLETED')return row;
  if(!['creating','pending','unknown'].includes(row.state))return row;
  const expired=Date.now()-row.createdAt.getTime()>=15*60*1000;
  if(!expired&&reason==='scheduled'&&!unavailable)return row;
  const state=expired?'expired':reason==='replace'?'abandoned':unavailable||!row.providerToken?'failed':null;
  if(!state)return row;
  await client.update(billingCheckouts).set({state,syncedAt:new Date()}).where(eq(billingCheckouts.id,id));
  await event(client,row.email,'Pagadito','Intento resuelto automáticamente',{checkout:id,state,reason,providerUnavailable:unavailable,providerTokenAvailable:!!row.providerToken});
  return {...row,state};
 });
}
export async function reconcilePendingCheckouts(){
 const rows=await db.select({id:billingCheckouts.id}).from(billingCheckouts).where(sql`${billingCheckouts.state} in ('creating','pending','unknown')`).orderBy(billingCheckouts.createdAt).limit(50);
 const results=await Promise.allSettled(rows.map(row=>resolveCheckout(row.id,'scheduled')));
 console.info('pagadito_automatic_resolution',{processed:rows.length,errors:results.filter(r=>r.status==='rejected').length});
}
export async function confirmSubscription(session){
 if(session.member)billingError('Solo el dueño consulta su pago.',403);
 const rows=await db.select().from(billingCheckouts).where(and(eq(billingCheckouts.email,session.email),sql`${billingCheckouts.state} in ('creating','pending','unknown','active','failed','expired','abandoned')`)).orderBy(desc(billingCheckouts.createdAt)).limit(1);
 for(const row of rows)await resolveCheckout(row.id);
 const [latest]=await db.select().from(billingCheckouts).where(eq(billingCheckouts.email,session.email)).orderBy(desc(billingCheckouts.createdAt)).limit(1);
 const a=await accountAccess(session.email);return {status:latest?.state||'none',entitlement:a.ent};
}
export async function cancelSubscription(session,actor=session.email){if(session.member)billingError('Solo el dueño cancela cobros.',403);await cancelOtherCheckouts(session.email,null);await db.transaction(async client=>{const sub=await subscription(session.email,client);await client.update(subscriptions).set({canceledAt:new Date(),version:sub.version+1}).where(eq(subscriptions.email,session.email));await event(client,session.email,actor,'Cobros futuros cancelados',{});await projectProfile(client,{...sub,canceledAt:new Date()})});return {ok:true}}
export async function billingRoute(path,method,body,session,request,admin){
 if(path==='billing/me'&&method==='GET'){if(session.member){const [company]=await db.select({ownerEmail:companies.ownerEmail}).from(companies).where(eq(companies.id,session.member.companyId));return billingMe({...session,email:company.ownerEmail},false)}return billingMe(session,admin);}
 if(path==='checkout'&&method==='POST')return checkout(session,body,request);
 if(path==='billing/confirm'&&method==='POST')return confirmSubscription(session);
 if(path==='cancel'&&method==='POST')return cancelSubscription(session);
 billingError('Método no permitido.',405);
}
