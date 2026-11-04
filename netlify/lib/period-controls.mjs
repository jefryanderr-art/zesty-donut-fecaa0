import {documentHash} from './accounting-codec.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{publicMessage:message,status})};
export function guardPeriods(previous,next,action){
 const before=previous?.cfg?.periodLocks||{},after=next.cfg?.periodLocks||{};
 const lockOps=['closePeriod','reopenPeriod','closeYear','fiscalPeriodClose','workflowPresent','workflowClose','workflowReopen'];
 if(documentHash(before)!==documentHash(after)&&!lockOps.some(op=>action==='Operación: '+op))fail('Los cierres solo cambian desde Control de períodos.',403);
 for(const [key,lock]of Object.entries(before))if(lock.source==='annual'&&lock.closed&&documentHash(lock)!==documentHash(after[key]||null)&&action!=='Operación: workflowReopen')fail('Reabre el ejercicio desde Cierre anual.',403);
 const old=new Map((previous?.entries||[]).map(e=>[e.id,e])),incoming=new Map((next.entries||[]).map(e=>[e.id,e]));
 for(const id of new Set([...old.keys(),...incoming.keys()])){
  const a=old.get(id),b=incoming.get(id);if(documentHash(a?{...a,branchId:a.branchId||'principal'}:null)===documentHash(b?{...b,branchId:b.branchId||'principal'}:null))continue;
  for(const entry of [a,b].filter(Boolean)){
   const annualNew=!a&&(action==='Operación: workflowClose'&&['cierre-anual','traspaso-anual','apertura-anual'].includes(entry.type)||action==='Operación: workflowReopen'&&['reapertura-anual','anula-apertura-anual'].includes(entry.type));
   if(!annualNew&&(before[(entry.branchId||'principal')+':'+entry.date?.slice(0,7)]||before[entry.date?.slice(0,7)])?.closed)fail('El período '+entry.date.slice(0,7)+' está cerrado. Solo el dueño puede reabrirlo.',409);
  }
 }
}
