import { documentHash } from './accounting-codec.mjs';
const fail=(message,status=400)=>{const error=new Error(message);error.publicMessage=message;error.status=status;throw error};
export function guardPeriods(previous,next,action){
 const before=previous?.cfg?.periodLocks||{},after=next.cfg?.periodLocks||{};
 if(documentHash(before)!==documentHash(after)&&!['Operación: closePeriod','Operación: reopenPeriod','Operación: closeYear'].includes(action))fail('Los cierres solo cambian desde Control de períodos.',403);
 const old=new Map((previous?.entries||[]).map(e=>[e.id,e])),incoming=new Map((next.entries||[]).map(e=>[e.id,e]));
 for(const id of new Set([...old.keys(),...incoming.keys()])){
  const a=old.get(id),b=incoming.get(id);if(documentHash(a?{...a,branchId:a.branchId||'principal'}:null)===documentHash(b?{...b,branchId:b.branchId||'principal'}:null))continue;
  for(const entry of [a,b].filter(Boolean))if((before[(entry.branchId||'principal')+':'+entry.date?.slice(0,7)]||before[entry.date?.slice(0,7)])?.closed)fail('El período '+entry.date.slice(0,7)+' está cerrado. Solo el dueño puede reabrirlo.',409);
 }
}
