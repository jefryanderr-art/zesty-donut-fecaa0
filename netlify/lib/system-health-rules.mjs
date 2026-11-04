// Whitelist projection: never return raw exceptions or customer fields.
export const JOBS=['sync-subscriptions','platform-maintenance','resolve-payments'];
export const healthId=value=>String(value||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,8);
export const healthCode=value=>['SMTP_AMBIGUOUS_REVIEW_REQUIRED','DELIVERY_FAILED','TASK_FAILED','PARTIAL_FAILURE'].includes(value)?value:value?'ERROR_REQUIRES_REVIEW':null;
export function healthRows(rows,now=Date.now()){
 return rows.map(r=>({id:healthId(r.id),state:['pending','sending','sent','error','creating','unknown','active','failed','expired','abandoned','por_verificar','confirmado'].includes(r.state)?r.state:'other',createdAt:new Date(r.createdAt).toISOString(),ageHours:Math.max(0,Math.floor((now-new Date(r.createdAt))/3600000)),code:healthCode(r.code)}));
}
export function healthAlerts({mail,payments,jobs,migrations}){
 const alerts=[];const add=(level,code)=>alerts.push({level,code});
 if(mail.issues.length)add(mail.issues.some(x=>x.ageHours>=24||x.state==='error')?'rojo':'amarillo','mail');
 if(payments.total)add(payments.oldestHours>=24?'rojo':'amarillo','payments');
 for(const j of jobs)if(!j.finishedAt||j.state!=='success'||j.stale)add(j.state==='failed'?'rojo':'amarillo',j.name);
 if(migrations.state!=='verified'||migrations.pending.length||migrations.failed?.length)add(migrations.failed?.length?'rojo':'amarillo','migrations');
 return {level:alerts.some(a=>a.level==='rojo')?'rojo':alerts.length?'amarillo':'verde',alerts};
}
