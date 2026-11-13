import {connectedCostReport} from '../../public/accounting-math.mjs';
import {randomUUID} from 'node:crypto';
import {recurringDay,recurringBoundary,moneyCents} from './accounting-engine.mjs';
export const ORGANIZATION_OPS=['organizationSave','organizationContribution','organizationExpense'];
export const organizationRecord=r=>String(r.kind||'').startsWith('organization-');
const text=(v,n=200)=>String(v??'').trim().slice(0,n);
export function validateOrganization(r,check){
 if(!organizationRecord(r))return;
 check(r.module==='aportes'&&['member','fund','event','volunteer','committee','contribution'].map(k=>'organization-'+k).includes(r.kind),'Ficha de organización inválida.');
 for(const k of ['amountCents','targetCents'])if(r[k]!==undefined)check(Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=99999999900,'Importe de organización inválido.');
 if(r.kind==='organization-member'){recurringDay(r.anchor);check([1,3,6,12].includes(r.months),'Periodicidad de cuota inválida.');}
}
export function organizationOperation(data,access,session,b,ctx){
 const check=ctx.check,permit=m=>ctx.permit(access,m,true),rows=data.businessRecords||=[],date=ctx.date(b.date);permit('aportes');check(access.branchId&&b.confirmed===true&&text(b.reason,501).length>=3&&text(b.reason,501).length<=500,'Selecciona sucursal, confirma y escribe el motivo.');
 const find=(id,kind)=>{const r=rows.find(r=>r.id===id&&r.kind==='organization-'+kind&&r.branchId===access.branchId);check(r,'Selecciona '+kind+' de la sucursal.');return r;};
 const event={date,at:new Date().toISOString(),action:b.operation,reason:text(b.reason,500)};
 if(b.operation==='organizationSave'){
  check(access.owner,'Solo el dueño administra el padrón, fondos y equipos.');check(['member','fund','event','volunteer','committee'].includes(b.kind),'Tipo de ficha inválido.');
  const old=b.id?find(b.id,b.kind):null;check(text(b.name),'Escribe el nombre.');
  const r=old||{id:randomUUID(),module:'aportes',kind:'organization-'+b.kind,date,branchId:access.branchId,status:'Pendiente',events:[]};
  check(date>=r.date,'La fecha precede a la ficha.');r.name=text(b.name);r.note=text(b.note,1000);r.active=b.active!==false;
  if(!old&&b.kind==='member'){r.amountCents=Number(b.amountCents||0);r.months=Number(b.months||1);r.anchor=recurringDay(b.anchor||date);check(r.anchor>=date,'La cuota inicia desde el alta.');r.fundId=find(b.fundId,'fund').id;}
  if(b.kind==='fund')r.targetCents=Number(b.targetCents||0);
  if(b.kind==='event'){r.fundId=find(b.fundId,'fund').id;r.due=ctx.date(b.due||date);}
  if(['volunteer','committee'].includes(b.kind)){check(Array.isArray(b.memberIds)&&b.memberIds.length<=100,'Lista de miembros inválida.');r.memberIds=[...new Set(b.memberIds.map(id=>find(id,'member').id))];r.responsible=text(b.responsible);}
  validateOrganization(r,check);r.events.push(event);if(!old)rows.push(r);return r.id;
 }
 const fund=find(b.fundId,'fund');check(fund.active!==false,'El fondo está inactivo.');const ev=b.eventId?find(b.eventId,'event'):null;check(!ev||ev.fundId===fund.id,'El evento pertenece a otro fondo.');check(date>=fund.date&&(!ev||date>=ev.date),'La operación precede al fondo o evento.');
 if(b.operation==='organizationExpense'){
  permit('costos');permit('contabilidad');permit('cajas');ctx.financialCash(access);check(['1101','1102','2101'].includes(b.pay),'Selecciona Caja general, Banco o Crédito.');
  const cost=ctx.registerCost(data,access,session,{...b,eventId:ev?.id||''}),entry=data.entries.find(e=>e.id===cost.entryId);entry.organizationFundId=fund.id;entry.organizationEventId=ev?.id||'';cost.organizationFundId=fund.id;fund.events.push({...event,entryId:entry.id});return entry.id;
 }
 check(b.operation==='organizationContribution','Operación inválida.');const member=find(b.memberId,'member');check(member.active!==false&&date>=member.date,'El socio o donante no está activo en esa fecha.');const amountCents=Number(b.amountCents);check(Number.isSafeInteger(amountCents)&&amountCents>0&&amountCents<=99999999900,'Importe positivo en centavos requerido.');
 permit('contabilidad');permit('cajas');ctx.financialCash(access);check(['1101','1102'].includes(b.pay)&&data.accounts.some(a=>a.code===b.pay&&a.tipo==='activo')&&data.accounts.some(a=>a.code===b.incomeAccount&&a.tipo==='ingreso'),'Revisa cuenta de dinero e ingreso.');
 let period=null;if(b.period!==''&&b.period!==undefined&&b.period!==null){period=Number(b.period);const due=recurringBoundary(member.anchor,member.months,period);check(member.amountCents>0&&due<=date&&fund.id===member.fundId&&!ev,'La cuota requiere su fondo y un período vencido o actual.');const prior=rows.filter(r=>r.kind==='organization-contribution'&&r.memberId===member.id&&r.period===period).reduce((s,r)=>s+r.amountCents,0);check(prior+amountCents<=member.amountCents,'El aporte supera el saldo de esa cuota.');}
 const r={id:randomUUID(),module:'aportes',kind:'organization-contribution',name:member.name+' · '+fund.name,date,status:'Registrado',branchId:access.branchId,memberId:member.id,fundId:fund.id,eventId:ev?.id||'',amountCents,period,donor:member.name,fund:fund.name,events:[event]};
 const e=ctx.entry(data,session,{date,type:'negocio-aportes',desc:'Aporte · '+member.name+' · '+fund.name,reference:'APO-'+r.id.slice(0,8),businessId:r.id,organizationFundId:fund.id,organizationEventId:ev?.id||'',total:amountCents/100,lines:[{a:b.pay,d:amountCents/100,c:0},{a:b.incomeAccount,d:0,c:amountCents/100}]});r.entryId=e.id;rows.push(r);return r.id;
}
export function organizationReport(data,from,to){
 recurringDay(from);recurringDay(to);if(from>to)throw new Error('Período inválido.');
 const rows=(data.businessRecords||[]).filter(r=>organizationRecord(r)&&r.date<=to),contributions=rows.filter(r=>r.kind==='organization-contribution'),entries=(data.entries||[]).filter(e=>e.date>=from&&e.date<=to),accounts=new Map((data.accounts||[]).map(a=>[a.code,a.tipo]));
 const tagged=(e,key,id)=>(e[key]||(data.entries||[]).find(o=>o.id===e.reversalOf)?.[key])===id;
 const totals=es=>es.reduce((out,e)=>{for(const l of e.lines||[]){const type=accounts.get(l.a);if(type==='ingreso')out.incomeCents+=moneyCents(l.c)-moneyCents(l.d);if(['costo','gasto'].includes(type))out.expenseCents+=moneyCents(l.d)-moneyCents(l.c);}return out;},{incomeCents:0,expenseCents:0});
 const funds=rows.filter(r=>r.kind==='organization-fund').map(r=>({...r,...totals(entries.filter(e=>tagged(e,'organizationFundId',r.id))),progressCents:totals((data.entries||[]).filter(e=>e.date<=to&&tagged(e,'organizationFundId',r.id))).incomeCents}));
 const eventResults=connectedCostReport(data,from,to).groups.eventId;
 const events=rows.filter(r=>r.kind==='organization-event').map(r=>{const c=eventResults.find(c=>c.key===r.id);return {...r,incomeCents:c?.revenueCents||0,expenseCents:(c?.costCents||0)+(c?.cogsCents||0)}});
 const members=rows.filter(r=>r.kind==='organization-member').map(r=>{const history=contributions.filter(c=>c.memberId===r.id&&c.date>=from),dues=[];if(r.amountCents)for(let i=0;i<1200;i++){const due=recurringBoundary(r.anchor,r.months,i);if(due>to)break;const paidCents=contributions.filter(c=>c.memberId===r.id&&c.period===i).reduce((n,c)=>n+c.amountCents,0);if(paidCents<r.amountCents)dues.push({period:i,due,amountCents:r.amountCents,paidCents,remainingCents:r.amountCents-paidCents,late:due<to});}return {...r,history,dues,totalCents:history.reduce((n,c)=>n+c.amountCents,0)};});
 return {from,to,funds,events,members,teams:rows.filter(r=>['organization-volunteer','organization-committee'].includes(r.kind)),contributions:contributions.filter(r=>r.date>=from)};
}
