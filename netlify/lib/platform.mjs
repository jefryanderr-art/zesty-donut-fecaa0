import {and,eq,desc,sql,isNull} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {users,companies,subscriptions,customerPayments,customerEvents,servicePlans,serviceMessages,siteContent,supportGrants,auditEvents} from '../../db/schema.ts';
import {mailReady} from './service-mail.mjs';
import {isPlatformAdmin} from './customer-admin.mjs';
import {platformContextAllowed,billingError,entitlement,validatePlan,providerConfig,env,managuaDay,dayEnd} from './billing-rules.mjs';
import {plans,subscription,event,confirmPayment,bookPayment,cancelSubscription} from './billing.mjs';
export async function requirePlatform(session,companyId,client=db){
 if(!await isPlatformAdmin(session))billingError('Acceso exclusivo del super administrador de plataforma.',403);
 if(!session.activeCompanyId||companyId!==session.activeCompanyId)billingError('Abre primero la empresa de plataforma.',403);
 const [company]=await client.select({id:companies.id}).from(companies).where(and(eq(companies.id,companyId),eq(companies.isPlatformCompany,true),isNull(companies.archivedAt)));
 if(!platformContextAllowed({platformAdmin:true,member:session.member,platformCompany:!!company,companyId,activeCompanyId:session.activeCompanyId}))billingError('El Centro de control solo está disponible en la empresa de plataforma.',403);
 return company;
}
export async function platformSummary(url){
 const period=url.searchParams.get('period')||'mes',days={dia:1,sem:7,mes:31,ano:366,todo:36500}[period];if(!days)billingError('Periodo inválido.');
 let since=new Date(managuaDay()+'T00:00:00-06:00');if(period==='sem')since.setUTCDate(since.getUTCDate()-((since.getUTCDay()+6)%7));if(period==='mes')since=new Date(managuaDay().slice(0,7)+'-01T00:00:00-06:00');if(period==='ano')since=new Date(managuaDay().slice(0,4)+'-01-01T00:00:00-06:00');if(period==='todo')since=new Date(0);const rows=await db.select({email:users.email,name:users.name,profile:users.profile,createdAt:users.createdAt,lastAccessAt:users.lastAccessAt,sub:subscriptions}).from(users).leftJoin(subscriptions,eq(users.email,subscriptions.email)).where(sql`${users.platformAdmin}=false AND ${users.email} not like '%@access.acontec.invalid'`).limit(5001);
 const payments=await db.select().from(customerPayments).where(sql`${customerPayments.date} >= ${managuaDay(since)} OR ${customerPayments.status} = 'por_verificar'`).orderBy(desc(customerPayments.createdAt)).limit(10001);
 const list=await plans(),totals={activo:0,prueba:0,vencido:0,cancelado:0,suspendido:0,en_gracia:0,expiring7:0,expiring30:0,newMonth:0,churnMonth:0,inactive:0,mrrCents:0,collectedCents:0,sandboxCollectedCents:0,pendingCents:0,verifying:0},growth={},distribution={};
 const month=managuaDay().slice(0,7),clients=rows.slice(0,5000).map(row=>{const state=row.sub?entitlement(row.sub).state:row.profile?.state||'sin_plan',plan=row.sub?.plan||row.profile?.plan||'',paid=row.sub?.paidUntil||row.profile?.paidUntil,daysLeft=paid?(new Date(paid)-Date.now())/86400000:null;totals[state]=(totals[state]||0)+1;if(daysLeft>=0&&daysLeft<=7)totals.expiring7++;if(daysLeft>=0&&daysLeft<=30)totals.expiring30++;if(managuaDay(row.createdAt).startsWith(month))totals.newMonth++;if(row.sub?.canceledAt&&state!=='cancelado')totals.cancelado++;if(row.sub?.canceledAt&&managuaDay(row.sub.canceledAt).startsWith(month))totals.churnMonth++;if(Date.now()-new Date(row.lastAccessAt||row.createdAt)>30*86400000)totals.inactive++;const p=list.find(p=>p.id===plan);if(['activo','en_gracia'].includes(state)&&p&&!row.sub?.canceledAt)totals.mrrCents+=row.sub?.interval==='anual'?Math.round((row.sub.recurringCents||p.annualCents)/12):(row.sub?.recurringCents||p.monthlyCents);distribution[plan||'sin_plan']=(distribution[plan||'sin_plan']||0)+1;if(row.createdAt>=since){const key=managuaDay(row.createdAt).slice(0,7);growth[key]=growth[key]||{clients:0,incomeCents:0};growth[key].clients++}return {...row,state,plan,paidUntil:paid};});
 for(const p of payments){if(p.currency!=='USD')continue;if(p.status==='confirmado'){if(p.providerKey?.startsWith('sandbox:')){totals.sandboxCollectedCents+=p.amountCents;continue}totals.collectedCents+=p.amountCents;const key=p.date.slice(0,7);growth[key]=growth[key]||{clients:0,incomeCents:0};growth[key].incomeCents+=p.amountCents}else if(p.status==='por_verificar'){totals.verifying++;totals.pendingCents+=p.amountCents}}
 const debtRows=await db.execute(sql`SELECT coalesce(sum((c->>'amountCents')::bigint),0)::bigint AS cents FROM acontec_billing_checkouts b CROSS JOIN LATERAL jsonb_array_elements(b.charges) c WHERE b.state IN ('pending','active') AND b.environment=${providerConfig().environment} AND c->>'status' IN ('PENDING','VERIFYING','FAILED','UNCOLLECTABLE') AND c->>'date'<=${managuaDay()}`);totals.pendingCents+=Number((debtRows.rows||debtRows)[0].cents);
 const usage=await db.execute(sql`SELECT c.owner_email AS email, count(*)::int AS companies, array_agg(c.name) AS company_names, sum(greatest(1,CASE WHEN jsonb_typeof(c.data->'branches')='array' THEN jsonb_array_length(c.data->'branches') ELSE 0 END))::int AS branches, sum(pg_column_size(c.data))::bigint AS storage_bytes, (SELECT count(*)::int FROM acontec_company_members m JOIN acontec_companies co ON co.id=m.company_id WHERE co.owner_email=c.owner_email AND m.active=true) AS collaborators FROM acontec_companies c WHERE c.archived_at IS NULL GROUP BY c.owner_email`);
 const use=usage.rows||usage;
 for(const row of clients){row.usage=use.find(u=>u.email===row.email)||{companies:0,branches:0,collaborators:0,storage_bytes:0,company_names:[]};row.usage.aiMessages=null;const p=list.find(p=>p.id===row.plan),limits={...p?.limits,...row.sub?.limits};row.nearLimit=!!p&&['companies','branches'].some(k=>limits[k]!=null&&row.usage[k]>=limits[k]*.8)}
 const alertRows=await db.execute(sql`SELECT count(*) FILTER (WHERE state='unknown')::int AS unresolved, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(charges) c WHERE c->>'status' IN ('FAILED','EXPIRED','UNCOLLECTABLE')))::int AS failed FROM acontec_billing_checkouts`);const alerts=(alertRows.rows||alertRows)[0];
 const [legal]=await db.select().from(siteContent).where(eq(siteContent.id,'legal'));
 const paymentSetup={missingVariables:['PAGADITO_UID','PAGADITO_WSK','PAGADITO_ENV'].filter(name=>!env(name)),legalReady:!!(legal?.content?.approved&&legal.content.version&&legal.content.refunds)};
 const [settings]=await db.select().from(siteContent).where(eq(siteContent.id,'platform-accounting'));
 const [templateRow]=await db.select().from(siteContent).where(eq(siteContent.id,'platform-mail-templates'));const templates=templateRow?.content||{revision:0,reminder:{subject:'Tu suscripción de Acontec',text:'Hola {{nombre}}. Tu plan está pagado hasta {{pagadoHasta}}. Revisa Mi suscripción para consultar o renovar tu servicio.'},announcement:{subject:'Novedades de Acontec',text:'Hola {{nombre}}. Tenemos novedades para tu negocio.'}};
 const messages=await db.select({id:serviceMessages.id,email:serviceMessages.email,subject:serviceMessages.subject,state:serviceMessages.state,createdAt:serviceMessages.createdAt}).from(serviceMessages).orderBy(desc(serviceMessages.createdAt)).limit(50);
 return {paymentSetup,templates,alerts,clients,totals,growth,distribution,payments:payments.slice(0,10000),plans:list,provider:providerConfig(),mailReady:mailReady(),settings:settings?.content||{enabled:false,revision:0},messages,truncated:rows.length>5000||payments.length>10000,period,churnRate:clients.length?totals.churnMonth/clients.length*100:0};
}
const clean=(value,max=200)=>String(value||'').trim().slice(0,max);
export async function platformAction(session,body){
 if(body.confirmed!==true||clean(body.reason,1000).length<3)billingError('Confirma la acción e indica el motivo.');
 if(body.operation==='cancelSubscription'){const email=clean(body.email,254).toLowerCase();const sub=await subscription(email);if(sub.version!==body.version)billingError('La suscripción cambió. Recarga.',409);await cancelSubscription({email},session.email);await event(db,email,session.email,'Baja de suscripción',{reason:clean(body.reason,1000)});return {ok:true};}
 return db.transaction(async client=>{
  const reason=clean(body.reason,1000),email=clean(body.email,254).toLowerCase();
  if(body.operation==='plan'){
   const p=validatePlan(body),[old]=await client.select().from(servicePlans).where(eq(servicePlans.id,p.id)).for('update');if(old&&old.version!==body.version)billingError('El plan cambió. Recarga.',409);
   await client.insert(servicePlans).values(p).onConflictDoUpdate({target:servicePlans.id,set:{...p,version:(old?.version||0)+1}});await event(client,session.email,session.email,'Plan actualizado',{id:p.id,before:old,after:p,reason});return {ok:true};
  }
  if(body.operation==='accounting'){
   await client.insert(siteContent).values({id:'platform-accounting',content:{enabled:false,revision:0}}).onConflictDoNothing();const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'platform-accounting')).for('update');if(row.content.revision!==body.version)billingError('La configuración cambió. Recarga.',409);
   const content={enabled:body.enabled===true,incomeAccount:clean(body.incomeAccount,30),cashAccount:clean(body.cashAccount,30),revision:row.content.revision+1};if(content.enabled){const [ledger]=await client.select({data:companies.data}).from(companies).where(eq(companies.isPlatformCompany,true));if(ledger?.data?.cfg?.cur!=='USD'||!ledger.data.accounts?.some(a=>a.code===content.incomeAccount&&a.tipo==='ingreso')||!ledger.data.accounts?.some(a=>a.code===content.cashAccount&&a.tipo==='activo'))billingError('Configura Acontec en USD y selecciona cuentas válidas de ingreso y cobro.');}await client.update(siteContent).set({content,updatedAt:new Date()}).where(eq(siteContent.id,row.id));await event(client,session.email,session.email,'Contabilidad automática configurada',{...content,reason});return {ok:true};
  }
  if(body.operation==='template'){
   if(!['reminder','announcement'].includes(body.template))billingError('Plantilla inválida.');
   await client.insert(siteContent).values({id:'platform-mail-templates',content:{revision:0}}).onConflictDoNothing();const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'platform-mail-templates')).for('update');if(row.content.revision!==body.version)billingError('Las plantillas cambiaron. Recarga.',409);
   const subject=clean(body.subject,200),text=clean(body.text,10000);if(!subject||!text)billingError('Completa la plantilla.');const content={...row.content,revision:row.content.revision+1,[body.template]:{subject,text}};await client.update(siteContent).set({content,updatedAt:new Date()}).where(eq(siteContent.id,row.id));await event(client,session.email,session.email,'Plantilla de correo editada',{template:body.template,reason});return {ok:true};
  }
  if(body.operation==='message'){
   const subject=clean(body.subject,200),text=clean(body.text,10000);if(!subject||!text)billingError('Completa asunto y mensaje.');
   const recipients=email?await client.select({email:users.email,name:users.name,profile:users.profile}).from(users).where(eq(users.email,email)):await client.select({email:users.email,name:users.name,profile:users.profile}).from(users).leftJoin(subscriptions,eq(users.email,subscriptions.email)).where(and(eq(users.platformAdmin,false),sql`${users.email} not like '%@access.acontec.invalid'`,body.segment?eq(subscriptions.plan,clean(body.segment,40)):sql`true`)).limit(1000);if(!recipients.length)billingError('No hay destinatarios para este mensaje.');
   for(const r of recipients){await client.insert(serviceMessages).values({email:r.email,subject,body:text.replaceAll('{{nombre}}',r.name||r.email).replaceAll('{{correo}}',r.email).replaceAll('{{pagadoHasta}}',r.profile?.paidUntil||'sin vigencia registrada'),actor:session.email});await event(client,r.email,session.email,'Correo en cola',{subject,reason})}return {ok:true,queued:recipients.length};
  }
  if(body.operation==='verifyPayment'||body.operation==='bookPayment'){
   // Bloquear el usuario antes del pago mantiene el mismo orden que los webhooks.
   const [initial]=await client.select().from(customerPayments).where(eq(customerPayments.id,body.id));if(!initial)billingError('Pago no encontrado.',404);
   await client.select().from(users).where(eq(users.email,initial.email)).for('update');
   const [payment]=await client.select().from(customerPayments).where(eq(customerPayments.id,body.id)).for('update');if(payment.version!==body.version)billingError('El pago cambió. Recarga.',409);
   if(body.operation==='bookPayment'){if(payment.status!=='confirmado')billingError('Confirma primero el pago.');await bookPayment(client,{...payment,actor:session.email});await event(client,payment.email,session.email,'Contabilización solicitada',{paymentId:payment.id,reason});return {ok:true}}
   if(payment.status!=='por_verificar')billingError('Este pago ya fue revisado.',409);
   if(body.approved===true)await confirmPayment(client,payment,session.email);else{await client.update(customerPayments).set({status:'rechazado',version:payment.version+1}).where(eq(customerPayments.id,payment.id));await event(client,payment.email,session.email,'Pago rechazado',{paymentId:payment.id,reason})}await event(client,payment.email,session.email,'Revisión de pago',{id:payment.id,approved:body.approved===true,reason});return {ok:true};
  }
  const [user]=await client.select().from(users).where(eq(users.email,email)).for('update');if(!user||user.platformAdmin)billingError('Cliente no disponible.',404);
  const sub=await subscription(email,client);if(sub.version!==body.version)billingError('La suscripción cambió. Recarga.',409);
  const patch={version:sub.version+1};
  if(body.operation==='subscription'){
   if(!['activo','prueba','suspendido','cancelado'].includes(body.state))billingError('Estado inválido.');
   if(body.plan&&!(await plans(client)).some(p=>p.id===body.plan))billingError('Plan inválido.');
   patch.plan=body.plan||sub.plan;if(body.state==='prueba'){patch.paidUntil=null;patch.canceledAt=null}patch.state=body.state==='cancelado'?sub.state:body.state;
   if(body.state==='cancelado')billingError('La baja debe cancelar primero los cobros desde Mi suscripción; suspender no cancela cargos del proveedor.',409);
   if(body.trialEndsAt){const date=new Date(body.trialEndsAt);if(!Number.isFinite(date.getTime()))billingError('Fecha de prueba inválida.');patch.trialEndsAt=date}
   if(body.paidUntil&&body.state!=='prueba'){if(!/^\d{4}-\d{2}-\d{2}$/.test(body.paidUntil)||!Number.isFinite(Date.parse(body.paidUntil)))billingError('Fecha inválida.');patch.paidUntil=dayEnd(body.paidUntil)}
   if(body.limits){for(const key of ['companies','branches'])if(body.limits[key]!==null&&(!Number.isInteger(body.limits[key])||body.limits[key]<1||body.limits[key]>10000))billingError('Límites inválidos.');patch.limits=body.limits}
  }else billingError('Operación no encontrada.',404);
  await client.update(subscriptions).set(patch).where(eq(subscriptions.email,email));
  const effective={...sub,...patch};await client.update(users).set({profile:{...user.profile,plan:effective.plan,state:entitlement(effective).state,paidUntil:effective.paidUntil?managuaDay(new Date(effective.paidUntil)):''},version:user.version+1}).where(eq(users.email,email));
  await event(client,email,session.email,'Suscripción ajustada',{before:sub,after:effective,reason});return {ok:true};
 });
}
export async function supportAction(session,companyId,method,body){
 const [company]=await db.select({id:companies.id,ownerEmail:companies.ownerEmail}).from(companies).where(and(eq(companies.id,companyId),isNull(companies.archivedAt)));
 if(session.member||company?.ownerEmail!==session.email)billingError('Solo el dueño concede o revoca soporte.',403);
 if(method==='GET'){const [grant]=await db.select().from(supportGrants).where(eq(supportGrants.companyId,companyId));return {grant:grant||null}}
 if(method!=='POST')billingError('Método no permitido.',405);
 if(body.confirmed!==true||clean(body.reason,1000).length<3)billingError('Confirma e indica el motivo.');
 const email=clean(body.email,254).toLowerCase();const [admin]=await db.select().from(users).where(and(eq(users.email,email),eq(users.platformAdmin,true)));if(!body.revoke&&!admin)billingError('Elige un super administrador de plataforma.');
 await db.transaction(async client=>{if(body.revoke)await client.delete(supportGrants).where(eq(supportGrants.companyId,companyId));else await client.insert(supportGrants).values({companyId,email,grantedBy:session.email,expiresAt:new Date(Date.now()+24*3600000)}).onConflictDoUpdate({target:supportGrants.companyId,set:{email,grantedBy:session.email,expiresAt:new Date(Date.now()+24*3600000),createdAt:new Date()}});await client.insert(auditEvents).values({companyId,actor:session.email,action:body.revoke?'Soporte revocado':'Soporte autorizado por 24 horas · solo lectura',changes:[{area:'support',email,reason:clean(body.reason,1000)}]})});return {ok:true};
}
