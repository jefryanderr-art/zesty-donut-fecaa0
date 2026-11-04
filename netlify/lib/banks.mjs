import {randomUUID} from 'node:crypto';
import {canonical} from './accounting-codec.mjs';
import {bankGridRows,bankSuggestions,bankReconciliationTotals,moneyCents,recurringDay} from './accounting-engine.mjs';
// No habilitar hasta cerrar todos los criterios de la fase documentados.
export const BANKS_READY=false;
export const BANK_OPS=['bankLockEnable','bankCreate','bankMapping','bankStatement','bankMatch','bankPost','bankClose'];
const fail=message=>{throw Object.assign(new Error(message),{status:400,publicMessage:message})};
const check=(ok,message)=>{if(!ok)fail(message)};
export const bankBaseCurrency=data=>data.cfg?.cur==='C$'?'NIO':data.cfg?.cur||'NIO';
const records=data=>(data.businessRecords||[]).filter(r=>r.module==='bancos');
const base=(name,date,branchId,kind)=>({id:randomUUID(),module:'bancos',name:text(name),date,branchId,kind,status:'Abierta',events:[]});
const text=(v,max=200)=>String(v??'').trim().slice(0,max);
const int=v=>Number.isSafeInteger(v)&&Math.abs(v)<=99999999900;
export function bankLedger(data,bank,to){
 return (data.entries||[]).filter(e=>e.date<=to&&(e.branchId||'principal')===bank.branchId).flatMap(e=>{
  const amountCents=(e.lines||[]).filter(l=>l.a===bank.account).reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0)*(bank.card?-1:1);
  check(Number.isSafeInteger(amountCents),'Saldo contable fuera de rango.');return amountCents?[{entryId:e.id,date:e.date,reference:e.reference||'',amountCents}]:[];
 });
}
export function bankReport(data,bankId,statementId){
 const all=records(data),bank=all.find(r=>r.id===bankId&&r.kind==='bank');check(bank,'Cuenta bancaria no encontrada.');
 const statement=all.find(r=>r.id===statementId&&r.bankId===bankId&&r.kind==='statement');check(statement,'Extracto no encontrado.');
 if(statement.status==='Cerrada')return structuredClone(statement.snapshot);
 const ledger=bankLedger(data,bank,statement.to),used=new Set(all.filter(r=>r.kind==='statement'&&r.bankId===bankId).flatMap(r=>r.rows||[]).map(r=>r.entryId).filter(Boolean));
 const transit=ledger.filter(e=>e.date>=bank.date&&!used.has(e.entryId)),pendingBank=statement.rows.filter(r=>!r.entryId);
 const bookCents=ledger.reduce((n,r)=>{const total=n+r.amountCents;check(Number.isSafeInteger(total),'Saldo contable fuera de rango.');return total},0),totals=bankReconciliationTotals({bookCents,bankCents:statement.bankCents,pendingBank,transit});
 return {version:1,bank:structuredClone(bank),statement:structuredClone(statement),ledger,transit,pendingBank,totals,suggestions:bankSuggestions(pendingBank,transit,3)};
}
export function bankOperation(data,access,session,body,ctx){
 ctx.permit(access,'bancos',true);check(access.branchId,'Selecciona una sucursal para operar.');
 const date=recurringDay(body.date),reason=text(body.reason,501);check(body.confirmed===true&&reason.length>=3&&reason.length<=500,'Confirma e indica un motivo de 3 a 500 caracteres.');
 const all=data.businessRecords||=[],event={date,at:new Date().toISOString(),actor:session.member?.name||session.email,action:body.operation,reason};
 if(body.operation==='bankLockEnable'){
  check(access.owner&&typeof body.enabled==='boolean','Solo el dueño habilita o deshabilita futuros cierres.');
  data.cfg.bankControls={closingEnabled:body.enabled,events:[...(data.cfg.bankControls?.events||[]),{...event,enabled:body.enabled}]};return null;
 }
 if(body.operation==='bankCreate'){
  check(access.owner,'Solo el dueño registra una cuenta bancaria.');ctx.permit(access,'contabilidad',true);
  const card=body.card===true,account=data.accounts.find(a=>a.code===body.account&&a.tipo===(card?'pasivo':'activo'));
  check(account&&!['1101','1104','1201','2101','2107'].includes(account.code)&&!account.code.startsWith('1103-'),'Selecciona una cuenta contable exclusiva de banco o tarjeta.');
  check(!records(access.company.data).some(b=>b.kind==='bank'&&b.account===account.code),'La cuenta contable ya identifica otro banco o tarjeta; crea una cuenta exclusiva.');
  check(text(body.name)&&text(body.bank)&&/^\d{4}$/.test(body.lastFour||''),'Indica nombre, banco y solo los cuatro últimos dígitos.');
  check(['NIO','USD'].includes(body.currency)&&body.currency===bankBaseCurrency(data),'La conciliación usa la moneda base; registra la conversión en Multimoneda para cuentas en otra moneda.');
  check(!card||[body.cutDay,body.payDay].every(n=>Number.isInteger(n)&&n>=1&&n<=31),'Revisa los días de corte y pago.');
  const r={...base(text(body.name),date,access.branchId,'bank'),bank:text(body.bank),masked:'•••• '+body.lastFour,currency:body.currency,account:account.code,card,cutDay:card?body.cutDay:null,payDay:card?body.payDay:null,events:[event]};
  all.push(r);return r.id;
 }
 const bank=all.find(r=>r.id===body.bankId&&r.module==='bancos'&&r.kind==='bank'&&r.branchId===access.branchId);check(bank,'Cuenta no encontrada en la sucursal activa.');
 if(body.operation==='bankMapping'){
  check(access.owner,'Solo el dueño guarda el mapeo del banco.');
  const m=body.mapping;check(m&&['date','amount','reference'].every(k=>Number.isInteger(m[k])&&m[k]>=0&&m[k]<50)&&new Set([m.date,m.amount,m.reference]).size===3&&['ISO','DMY'].includes(m.dateFormat)&&['.',','].includes(m.decimal),'Mapeo inválido.');
  bank.mapping={date:m.date,amount:m.amount,reference:m.reference,dateFormat:m.dateFormat,decimal:m.decimal};bank.events.push(event);return bank.id;
 }
 if(body.operation==='bankStatement'){
  const from=recurringDay(body.from),to=recurringDay(body.to);check(from>=bank.date&&from<=to&&to<=date,'Revisa el período del extracto y la fecha de confirmación.');
  check(int(body.openingCents)&&int(body.bankCents),'Saldos del extracto inválidos.');
  const existing=all.filter(r=>r.module==='bancos'&&r.kind==='statement'&&r.bankId===bank.id);
  check(!existing.some(r=>r.from<=to&&r.to>=from),'El período se superpone con otro extracto.');
  const previous=existing.sort((a,b)=>a.to.localeCompare(b.to)).at(-1);
  if(previous){check(previous.status==='Cerrada'&&Date.parse(from)-Date.parse(previous.to)===86400000&&body.openingCents===previous.bankCents,'Cierra el extracto anterior y conserva continuidad de fechas y saldo.');}
  else check(from===bank.date,'El primer extracto empieza en la fecha de incorporación del banco.');
  const rows=bankGridRows(body.grid,body.mapping||bank.mapping);check(rows.every(r=>r.date>=from&&r.date<=to),'Hay movimientos fuera del período.');
  const closing=rows.reduce((n,r)=>n+r.amountCents,body.openingCents);check(Number.isSafeInteger(closing)&&closing===body.bankCents,'El saldo inicial más movimientos no coincide con el saldo final.');
  const r={...base(bank.name+' · '+from+' / '+to,date,access.branchId,'statement'),bankId:bank.id,from,to,openingCents:body.openingCents,bankCents:body.bankCents,rows,events:[event]};all.push(r);return r.id;
 }
 const statement=all.find(r=>r.id===body.id&&r.module==='bancos'&&r.kind==='statement'&&r.bankId===bank.id&&r.branchId===access.branchId);check(statement?.status==='Abierta','El extracto no existe o está cerrado.');
 check(date>=statement.to,'La confirmación no puede ser anterior al cierre del extracto.');
 if(body.operation==='bankClose'){
  check(data.cfg.bankControls?.closingEnabled===true,'El dueño debe habilitar expresamente los cierres bancarios de esta empresa.');
  check(access.owner||String(access.member?.role).toLowerCase()==='contador','Solo dueño o contador cierra la conciliación.');
  const report=bankReport(data,bank.id,statement.id);check(!report.pendingBank.length&&report.totals.differenceCents===0,'Resuelve las partidas del banco y la diferencia antes de cerrar.');
  statement.status='Cerrada';statement.closedAt=event.at;statement.events.push(event);report.statement.status='Cerrada';report.statement.closedAt=event.at;report.statement.events=structuredClone(statement.events);statement.snapshot=report;return statement.id;
 }
 const row=statement.rows.find(r=>r.sourceRow===body.sourceRow);check(row&&!row.entryId,'Partida inexistente o ya conciliada.');
 if(body.operation==='bankPost'){
  ctx.permit(access,'contabilidad',true);const counter=data.accounts.find(a=>a.code===body.counterAccount&&a.code!==bank.account&&['gasto','ingreso'].includes(a.tipo));
  check(counter,'Selecciona una contrapartida de gasto o ingreso y verifica con tu contador.');
  const net=row.amountCents*(bank.card?-1:1),value=Math.abs(net)/100;
  const e=ctx.entry(data,session,{date:row.date,type:'banco-conciliacion',desc:reason,reference:row.reference||'BAN-'+statement.id.slice(0,8)+'-'+row.sourceRow,total:value,bankId:bank.id,statementId:statement.id,lines:[{a:bank.account,d:net>0?value:0,c:net<0?value:0},{a:counter.code,d:net<0?value:0,c:net>0?value:0}]});
  row.entryId=e.id;statement.events.push({...event,entryId:e.id,sourceRow:row.sourceRow});return e.id;
 }
 check(body.operation==='bankMatch','Operación bancaria inválida.');
 const used=new Set(all.filter(r=>r.module==='bancos'&&r.kind==='statement').flatMap(r=>r.rows||[]).map(r=>r.entryId).filter(Boolean));
 const e=bankLedger(data,bank,statement.to).find(e=>e.entryId===body.entryId&&e.date>=bank.date);check(e&&!used.has(e.entryId)&&e.amountCents===row.amountCents,'Selecciona un movimiento de igual importe, no conciliado y de esta cuenta.');
 row.entryId=e.entryId;statement.events.push({...event,entryId:e.entryId,sourceRow:row.sourceRow});return statement.id;
}
// Se aplica a todas las escrituras, incluida restauración: no reabre ni modifica lo conciliado.
export function guardBankReconciliations(previous,next,check){
 for(const s of records(previous).filter(r=>r.kind==='statement'&&r.status==='Cerrada')){
  check(canonical(s)===canonical(records(next).find(r=>r.id===s.id)),'La conciliación cerrada es inmutable.');
  const bank=records(previous).find(r=>r.id===s.bankId),old=(previous.entries||[]).filter(e=>(e.branchId||'principal')===s.branchId&&e.date<=s.to&&e.lines?.some(l=>l.a===bank.account)),fresh=(next.entries||[]).filter(e=>(e.branchId||'principal')===s.branchId&&e.date<=s.to&&e.lines?.some(l=>l.a===bank.account));
  const sorted=rows=>canonical([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
  check(sorted(old)===sorted(fresh),'El período bancario está cerrado; registra una corrección en un período posterior.');
 }
 for(const bank of records(previous).filter(r=>r.kind==='bank')){
  check((next.cfg?.cur||'NIO')===(previous.cfg?.cur||'NIO'),'Conserva la moneda base de las cuentas bancarias incorporadas.');
  const account=(next.accounts||[]).find(a=>a.code===bank.account);check(account&&account.tipo===(bank.card?'pasivo':'activo'),'Conserva la cuenta contable y naturaleza del banco o tarjeta.');
 }
 const matched=new Set(records(previous).filter(r=>r.kind==='statement').flatMap(r=>r.rows||[]).map(r=>r.entryId).filter(Boolean));
 for(const id of matched)check(canonical(previous.entries.find(e=>e.id===id))===canonical(next.entries.find(e=>e.id===id)),'El movimiento conciliado no se edita ni se elimina.');
}
export function validateBankRecord(r,data,check){
 check(['bank','statement'].includes(r.kind)&&Array.isArray(r.events),'Registro bancario inválido.');
 if(r.kind==='bank'){check(/^•••• \d{4}$/.test(r.masked)&&!Object.hasOwn(r,'number')&&!Object.hasOwn(r,'cardNumber')&&['NIO','USD'].includes(r.currency)&&data.accounts.some(a=>a.code===r.account),'Cuenta bancaria inválida.');return;}
 check(records(data).some(b=>b.id===r.bankId&&b.kind==='bank'&&b.branchId===r.branchId)&&Array.isArray(r.rows)&&r.rows.length<=1000&&int(r.openingCents)&&int(r.bankCents),'Extracto inválido.');
 for(const row of r.rows)check(int(row.amountCents)&&row.amountCents!==0&&(!row.entryId||data.entries.some(e=>e.id===row.entryId)),'Partida bancaria inválida.');
}
