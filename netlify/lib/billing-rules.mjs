// Importes de plataforma exclusivamente en centavos enteros.
export const DEFAULT_PLANS = [
 {id:'basico',name:'Básico',monthlyCents:3500,annualCents:31400,currency:'USD',limits:{companies:1,branches:1},blockedModules:['personal','fiscal','control_personal','decisiones','sucursales']},
 {id:'estandar',name:'Estándar',monthlyCents:7000,annualCents:63000,currency:'USD',limits:{companies:1,branches:1},blockedModules:['sucursales']},
 {id:'pro',name:'Pro',monthlyCents:20000,annualCents:190000,currency:'USD',limits:{companies:null,branches:null},blockedModules:[]},
];
export const env = name => globalThis.Netlify?.env?.get(name) ?? process.env[name];
export function billingError(message,status=400){throw Object.assign(new Error(message),{publicMessage:message,status})}
export function providerConfig(){
 const mode=env('PAGADITO_ENV') || 'sandbox';
 if(!['sandbox','production'].includes(mode))billingError('Configura un entorno válido de Pagadito.',503);
 return {environment:mode,ready:!!env('PAGADITO_UID')&&!!env('PAGADITO_WSK')&&!!env('PAGADITO_ENV'),base:mode==='production'?'https://connect.pagadito.com':'https://sandbox-connect.pagadito.com'};
}
export const managuaDay = (now=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function addMonths(day,count){const [y,m,d]=day.split('-').map(Number),t=new Date(Date.UTC(y,m-1+count,1)),last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
export const dayEnd=day=>new Date(day+'T23:59:59.999-06:00');
export function entitlement(sub,admin=false,now=Date.now()){
 if(admin)return {access:true,state:'admin',plan:'pro'};
 if(!sub)return {access:false,state:'sin_plan',plan:null};
 if(sub.state==='suspendido')return {access:false,state:'suspendido',plan:sub.plan};
 if(sub.paidEnvironment==='sandbox'&&providerConfig().environment==='production')return {access:false,state:'vencido',plan:sub.plan};
 const paid=sub.paidUntil?new Date(sub.paidUntil).getTime():0;
 const graceDays=Math.min(30,Math.max(0,Number(env('PAGADITO_GRACE_DAYS')||2)));
 if(sub.plan&&paid){const day=managuaDay(new Date(paid));const end=new Date(day+'T12:00:00-06:00');end.setUTCDate(end.getUTCDate()+graceDays);const graceEnd=dayEnd(managuaDay(end)).getTime();
  if(now<=paid || (!sub.canceledAt && now<=graceEnd))return {access:true,plan:sub.plan,interval:sub.interval,state:now<=paid?'activo':'en_gracia',paidUntil:new Date(paid).toISOString(),accessUntil:new Date(sub.canceledAt?paid:graceEnd).toISOString(),canceled:!!sub.canceledAt};
 }
 if(!paid&&now<new Date(sub.trialEndsAt).getTime())return {access:true,state:'prueba',plan:'pro',trialEndsAt:new Date(sub.trialEndsAt).toISOString()};
 return {access:false,state:sub.canceledAt?'cancelado':'vencido',plan:sub.plan};
}
export function moduleIncluded(plan,module){return !!plan&&!(plan.blockedModules||[]).includes(module)}
export function validatePlan(body){
 if(!/^[a-z][a-z0-9_-]{1,40}$/.test(body.id)||!String(body.name||'').trim()||body.currency!=='USD')billingError('Revisa identificador, nombre y moneda USD.');
 for(const key of ['monthlyCents','annualCents'])if(!Number.isSafeInteger(body[key])||body[key]<1||body[key]>999999900)billingError('Usa precios positivos en centavos enteros.');
 for(const key of ['companies','branches'])if(body.limits?.[key]!==null&&(!Number.isInteger(body.limits?.[key])||body.limits[key]<1||body.limits[key]>10000))billingError('Revisa los límites del plan.');
 if(!Array.isArray(body.blockedModules)||body.blockedModules.some(m=>!['personal','fiscal','control_personal','decisiones','sucursales'].includes(m)))billingError('Revisa los módulos del plan.');
 return {id:body.id,name:String(body.name).trim().slice(0,80),currency:'USD',monthlyCents:body.monthlyCents,annualCents:body.annualCents,limits:body.limits,blockedModules:body.blockedModules,active:body.active===true};
}
export function platformContextAllowed({platformAdmin,member,platformCompany,companyId,activeCompanyId}){return platformAdmin===true&&!member&&platformCompany===true&&!!companyId&&companyId===activeCompanyId}
export function supportGrantActive(grant,email,platformAdmin,member=false,now=Date.now()){return !member&&platformAdmin===true&&grant?.email===email&&Number.isFinite(new Date(grant.expiresAt).getTime())&&new Date(grant.expiresAt).getTime()>now}
export function servicePaymentKey(environment,ern){if(!['sandbox','production'].includes(environment)||!/^ACT-[a-f0-9]{16}-\d{2}$/.test(ern))billingError('Referencia de pago inválida.');return environment+':'+ern}
