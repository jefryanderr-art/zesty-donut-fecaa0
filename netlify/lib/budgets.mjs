import {randomUUID} from 'node:crypto';
import {recurringDay} from './accounting-engine.mjs';
import {managuaDay} from './billing-rules.mjs';
import {budgetActuals,budgetVariance} from '../../public/advanced-math.mjs';
// Presupuesto vs real (Fase 6, ítem 1). Nace apagado; informativo: no genera asientos ni cambia datos contables.
export const BUDGET_MODULES=['presupuestos'];
export const BUDGET_NOTICE='Informe interno de apoyo; no es asesoría fiscal. Verifica con tu contador.';
export const BUDGET_OPS=['budEnable','budCreate','budRevise','budArchive'];
export const DIMENSIONS=['cuenta','centro','proyecto','sucursal'];
const check=(value,message)=>{if(!value)throw Object.assign(new Error(message),{publicMessage:message,status:400})};
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const rows=(data,kind)=>(data.businessRecords||[]).filter(r=>r.module==='presupuestos'&&(!kind||r.kind===kind));
const centsOk=v=>Number.isSafeInteger(v)&&v>=0&&v<=99999999900;
export function validateBudgetRecord(r,check){
 check(typeof r.kind==='string'&&r.kind.length<=40&&Array.isArray(r.events),'Registro de presupuesto inválido.');
 if(r.thresholdPct!==undefined)check(Number.isFinite(r.thresholdPct)&&r.thresholdPct>=0&&r.thresholdPct<=1000,'Umbral inválido.');
 if(r.kind==='budget'){check(DIMENSIONS.includes(r.dimension)&&Array.isArray(r.lines)&&r.lines.length<=500&&r.lines.every(l=>centsOk(l.amountCents)&&txt(l.key,100)),'Presupuesto inválido; usa centavos enteros.');}
}
const parseLines=(list,dimension,data)=>{
 check(Array.isArray(list)&&list.length>=1&&list.length<=500,'Agrega entre 1 y 500 líneas.');const seen=new Set();
 return list.map(l=>{const key=txt(l.key,100),cents=l.amountCents;check(key&&!seen.has(key)&&centsOk(cents),'Línea duplicada o importe inválido (centavos enteros).');
  if(dimension==='cuenta')check((data.accounts||[]).some(a=>a.code===key||a.id===key)||!data.accounts,'La cuenta no existe en el catálogo.');seen.add(key);return {key,amountCents:cents}});
};
export async function budgetOperation(data,access,session,body,ctx){
 const op=body.operation,date=recurringDay(body.date),reason=txt(body.reason,501);
 ctx.permit(access,'presupuestos',true);
 check(access.branchId&&body.confirmed===true&&reason.length>=3&&reason.length<=500,'Selecciona sucursal, confirma y explica el motivo.');
 const records=data.businessRecords||=[],event={action:op,date,reason,actor:session.member?.name||session.email,at:new Date().toISOString()};
 let config=rows(data,'configuration')[0];
 if(op==='budEnable'){
  check(access.owner&&typeof body.enabled==='boolean'&&date===managuaDay(),'Solo el dueño cambia la activación efectiva hoy.');
  const pct=body.thresholdPct==null||body.thresholdPct===''?10:Number(body.thresholdPct);check(Number.isFinite(pct)&&pct>=0&&pct<=1000,'Umbral inválido.');
  if(!config){config={id:randomUUID(),module:'presupuestos',kind:'configuration',name:'Presupuestos',date,branchId:access.branchId,events:[event]};records.push(config)}else config.events.push(event);
  config.status=body.enabled?'Activa':'Inactiva';config.thresholdPct=pct;return config.id;
 }
 check(config?.status==='Activa','El dueño debe activar este módulo.');
 const mine=()=>rows(data,'budget').filter(r=>r.branchId===access.branchId);
 const byId=id=>{const r=mine().find(r=>r.id===id);check(r,'Presupuesto no encontrado en la sucursal activa.');return r};
 if(op==='budCreate'){
  const dimension=body.dimension,year=Number(body.year),name=txt(body.name,120);
  check(DIMENSIONS.includes(dimension)&&Number.isInteger(year)&&year>=2000&&year<=2100&&name,'Revisa nombre, año y dimensión.');
  check(!mine().some(b=>b.status==='Activa'&&b.dimension===dimension&&b.year===year&&b.name.toLowerCase()===name.toLowerCase()),'Ya existe un presupuesto activo igual.');
  const lines=parseLines(body.lines,dimension,data),r={id:randomUUID(),module:'presupuestos',kind:'budget',name,dimension,year,status:'Activa',date,branchId:access.branchId,version:1,lines,versions:[{version:1,lines,reason,at:event.at,actor:event.actor}],events:[event]};
  records.push(r);return r.id;
 }
 const r=byId(body.id);check(r.status==='Activa','El presupuesto está archivado.');
 if(op==='budRevise'){const lines=parseLines(body.lines,r.dimension,data);r.version+=1;r.lines=lines;r.versions.push({version:r.version,lines,reason,at:event.at,actor:event.actor});r.events.push(event);return r.id}
 if(op==='budArchive'){r.status='Archivada';r.events.push(event);return r.id}
 check(false,'Operación no disponible.');
}
export function budgetReport(data,body){
 const config=rows(data,'configuration')[0],threshold=config?.thresholdPct??10,from=txt(body.from,10),to=txt(body.to,10);
 const result={enabled:config?.status==='Activa',notice:BUDGET_NOTICE,thresholdPct:threshold,records:rows(data),budgets:[]};
 if(!result.enabled)return result;
 for(const b of rows(data,'budget').filter(b=>b.status==='Activa')){
  const f=from&&from.slice(0,4)===String(b.year)?from:b.year+'-01-01',t=to&&to.slice(0,4)===String(b.year)?to:b.year+'-12-31',actual=budgetActuals(data.entries,b.dimension,f,t);
  result.budgets.push({id:b.id,name:b.name,dimension:b.dimension,year:b.year,version:b.version,from:f,to:t,lines:b.lines.map(l=>({key:l.key,budgetCents:l.amountCents,actualCents:actual.get(l.key)||0,...budgetVariance(l.amountCents,actual.get(l.key)||0,threshold)}))});
 }
 return result;
}
