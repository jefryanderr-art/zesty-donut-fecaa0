import {randomUUID} from 'node:crypto';
import {recurringDay,recurringPeriod,recurringPlanPrice,moneyCents,aging} from './accounting-engine.mjs';
export const PLAN_OPS=['recurringPlanSave','recurringChangePlan','recurringUsage','recurringCollection'];
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
export function validatePlan(p,check){
 check(p&&['fixed','tiered','usage'].includes(p.mode)&&[1,3,6,12].includes(p.months),'Selecciona precio y periodicidad del plan.');
 for(const k of ['amountCents','unitCents'])check(Number.isSafeInteger(p[k])&&p[k]>=0&&p[k]<=99999999900,'Precio inválido en centavos.');
 check(p.amountCents>0,'El precio base debe ser positivo.');
 for(const k of ['trialDays','noticeDays','suspendDays','retryDays','maxUnits'])check(Number.isSafeInteger(p[k])&&p[k]>=0&&p[k]<=1000000,'Límite del plan inválido.');
 check(p.retryDays>0&&p.suspendDays>=p.retryDays&&p.trialDays<=365&&p.noticeDays<=365,'Revisa prueba, cancelación y fases de cobranza.');
 check(Array.isArray(p.tiers)&&p.tiers.length<=20,'Escalones inválidos.');let last=0;
 for(const t of p.tiers){check(Number.isSafeInteger(t.upTo)&&t.upTo>last&&t.upTo<=1000000&&Number.isSafeInteger(t.unitCents)&&t.unitCents>=0,'Escalones crecientes e importes enteros requeridos.');last=t.upTo;}
 check(p.mode!=='tiered'||last>=p.maxUnits&&p.tiers.length>0,'Los escalones deben cubrir el límite de uso.');recurringPlanPrice(p,p.maxUnits);
 check(Array.isArray(p.coupons||[])&&(p.coupons||[]).length<=30,'Cupones inválidos.');const codes=new Set();for(const c of p.coupons||[]){check(typeof c.code==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(c.code)&&!codes.has(c.code)&&Number.isFinite(c.discount)&&c.discount>0&&c.discount<=99,'Cupón inválido o repetido.');codes.add(c.code);recurringDay(c.until);}
}
export function planSnapshot(row){return structuredClone(row.plan);}
export function planFor(r,date){return (r.planHistory||[]).filter(h=>h.date<=date).at(-1)?.plan;}
export function recurringDebt(data,r,date){
 const ids=new Set((r.billed||[]).map(b=>b.entryId));return aging((data.entries||[]).filter(e=>ids.has(e.id)||ids.has(e.invoiceId)||e.allocationJournal),'1201',date).rows.filter(e=>ids.has(e.id));
}
export function planOperation(data,access,session,b,ctx){
 const check=ctx.check,date=recurringDay(b.date),rows=data.businessRecords||=[],op=b.operation;
 ctx.permit(access,'suscripciones',true);check(access.branchId&&b.confirmed===true&&txt(b.reason,501).length>=3&&txt(b.reason,501).length<=500,'Confirma sucursal y motivo.');
 if(op==='recurringPlanSave'){
  check(access.owner,'Solo el dueño define planes.');const old=b.id?rows.find(r=>r.id===b.id&&r.kind==='recurring-plan'&&r.branchId===access.branchId):null;check(!b.id||old,'Plan no encontrado.');
  const plan={mode:b.mode,months:Number(b.months),amountCents:Number(b.amountCents),unitCents:Number(b.unitCents||0),trialDays:Number(b.trialDays||0),noticeDays:Number(b.noticeDays||0),suspendDays:Number(b.suspendDays),retryDays:Number(b.retryDays),maxUnits:Number(b.maxUnits),coupons:b.coupons||[],tiers:(b.tiers||[]).map(t=>({upTo:Number(t.upTo),unitCents:Number(t.unitCents)}))};validatePlan(plan,check);check(txt(b.name),'Escribe el nombre del plan.');
  const r=old||{id:randomUUID(),module:'suscripciones',kind:'recurring-plan',branchId:access.branchId,date,status:'Activa',events:[]};r.name=txt(b.name);r.plan=plan;r.events.push({date,action:op,reason:txt(b.reason,500)});if(!old)rows.push(r);return r.id;
 }
 const r=rows.find(r=>r.id===b.id&&r.kind==='subscription'&&r.branchId===access.branchId);check(r&&r.status!=='Cancelada','Suscripción no disponible.');check(date>=(r.events.at(-1)?.date||r.date),'Respeta el orden cronológico.');
 const event={date,action:op,reason:txt(b.reason,500),at:new Date().toISOString()};
 if(op==='recurringChangePlan'){
  check(access.owner,'Solo el dueño cambia planes.');const row=rows.find(x=>x.id===b.planId&&x.kind==='recurring-plan'&&x.branchId===access.branchId);check(row&&row.date<=date,'Plan no encontrado en esa fecha.');const plan=planSnapshot(row);validatePlan(plan,check);
  check(!(r.billed||[]).some(p=>p.to>date),'Corrige primero las facturas del período afectado; el cambio no sobrescribe documentos emitidos.');
  r.planHistory||=[{date:r.date,plan:{mode:'fixed',amountCents:r.amountCents,unitCents:0,months:r.months,maxUnits:1000000}}];
  let activeIndex=0;while(activeIndex<1199&&recurringPeriod(r,activeIndex).to<=date)activeIndex++;check((r.usage||[]).filter(u=>u.period===activeIndex).reduce((n,u)=>n+u.units,0)<=plan.maxUnits,'El nuevo límite es menor al uso registrado.');
  const previous=planFor(r,date),cycle=(r.cycles||[]).at(-1)||{index:0,anchor:r.anchor,months:r.months};
  if(plan.months!==cycle.months){let index=cycle.index;while(index<1199&&recurringPeriod(r,index).to<=date)index++;check(recurringPeriod(r,index).from===date,'El cambio mensual/anual empieza al límite de un período.');r.cycles||=[];r.cycles.push({index,anchor:date,months:plan.months});}
  r.planHistory.push({date,planId:row.id,plan});event.previousPlan=previous;event.planId=row.id;r.events.push(event);return r.id;
 }
 if(op==='recurringUsage'){
  const period=Number(b.period),p=recurringPeriod(r,period),plan=planFor(r,date),units=Number(b.units);check(plan&&date>=p.from&&date<p.to&&!r.billed.some(x=>x.period===period)&&r.status==='Activa','El uso requiere un período abierto y una suscripción activa.');
  check(Number.isSafeInteger(units)&&units>0&&units<=1000000,'Uso entero positivo requerido.');const used=(r.usage||[]).filter(x=>x.period===period).reduce((n,x)=>n+x.units,0);check(used+units<=plan.maxUnits,'El uso supera el límite del plan.');recurringPlanPrice(plan,used+units);r.usage||=[];r.usage.push({id:randomUUID(),date,period,units,note:txt(b.reason,500)});r.events.push(event);return r.id;
 }
 if(op==='recurringCollection'){
  const debt=recurringDebt(data,r,date),overdue=debt.filter(d=>d.days>0&&d.balance>0),plan=planFor(r,date);check(plan&&overdue.length,'No hay deuda vencida.');
  const last=(r.collections||[]).at(-1);check(!last||Date.parse(date)-Date.parse(last.date)>=plan.retryDays*86400000,'Espera el intervalo de reintento configurado.');
  check(['reminder','failed','suspend'].includes(b.stage),'Selecciona la fase.');
  if(b.stage==='suspend'){check(access.owner&&Math.max(...overdue.map(d=>d.days))>=plan.suspendDays,'El dueño puede suspender al alcanzar el umbral.');check(!r.billed.some(x=>x.to>date),'Para suspender servicio ya facturado usa Pausar y confirma su nota de crédito.');r.status='Pausada';event.status='Pausada';}
  r.collections||=[];r.collections.push({...event,stage:b.stage,invoiceIds:overdue.map(d=>d.id)});r.events.push(event);return r.id;
 }
 check(false,'Operación de plan inválida.');
}
