import {accountingEntries} from './accounting-engine.mjs';
import {catalog} from './business-profile.mjs';
import {randomUUID} from 'node:crypto';
import {cents} from './accounting-codec.mjs';
export const ANALYSIS_MODULES=['indicadores_financieros','costeo_abc','tableros_rol','notas_financieras'];
export const ANALYSIS_OPS=['analysisEnable','analysisSave'];
export const NOTICE='verifica con tu contador';
export const DEFAULT_MAPPING={sales:['4'],cogs:['5'],expenses:['6'],receivables:['1201'],payables:['2101'],inventory:['13'],currentAssets:['11','12','13'],currentLiabilities:['21'],assets:['1'],liabilities:['2'],equity:['3'],depreciation:[],interest:[],tax:[],fixed:[],cash:['1101','1102','1103','1104'],capex:[]};
const check=(ok,msg)=>{if(!ok)throw Object.assign(new Error(msg),{publicMessage:msg,status:400})};
const text=(v,n=500)=>String(v??'').trim().slice(0,n);
const records=(d,m)=>(d.businessRecords||[]).filter(r=>r.module===m);
export const analysisConfig=(d,m)=>records(d,m).find(r=>r.kind==='configuration');
export function validateAnalysisRecord(r,assert=check){
 assert(r.kind==='configuration'&&Array.isArray(r.events)&&Number.isSafeInteger(r.version)&&r.version>0,'Configuración de análisis inválida.');
 if(r.mapping)assert(Object.keys(r.mapping).length===Object.keys(DEFAULT_MAPPING).length&&Object.keys(DEFAULT_MAPPING).every(k=>Array.isArray(r.mapping[k])&&r.mapping[k].length<=100&&new Set(r.mapping[k]).size===r.mapping[k].length&&r.mapping[k].every(a=>typeof a==='string'&&/^[a-zA-Z0-9-]{1,40}$/.test(a))),'Mapa de cuentas inválido.');
 if(r.pools)assert(Array.isArray(r.pools)&&r.pools.length<=100&&r.pools.every(p=>text(p.name,120)&&['cliente','producto','servicio','empleado','sucursal'].includes(p.dimension)&&Number.isSafeInteger(p.amountCents)&&p.amountCents>=0&&Array.isArray(p.drivers)&&p.drivers.length>0&&p.drivers.length<=500&&new Set(p.drivers.map(d=>d.key)).size===p.drivers.length&&p.drivers.every(d=>typeof d.key==='string'&&d.key.length>0&&d.key.length<=100&&Number.isSafeInteger(d.units)&&d.units>=0)&&p.drivers.some(d=>d.units>0)),'Generadores inválidos: importe en centavos y unidades enteras.');
 if(r.recipient!==undefined)assert(['contador','banco'].includes(r.recipient),'Destinatario inválido.');
 if(r.template!==undefined)assert(typeof r.template==='string'&&r.template.length<=20000,'Plantilla demasiado larga.');
}
export async function analysisOperation(data,access,session,body,ctx){
 const m=body.module;check(ANALYSIS_MODULES.includes(m),'Módulo inválido.');ctx.permit(access,m,true);
 check(access.branchId&&body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Selecciona sucursal, motivo y confirmación.');
 let r=analysisConfig(data,m);const event={action:body.operation,reason:body.reason.trim(),actor:session.member?.name||session.email,at:new Date().toISOString()};
 if(body.operation==='analysisEnable')check(access.owner&&typeof body.enabled==='boolean','Solo el dueño cambia la activación.');else check(r?.status==='Activa','El dueño debe activar el módulo.');
 if(!r){r={id:randomUUID(),module:m,kind:'configuration',name:m,status:'Inactiva',branchId:access.branchId,date:body.date,version:0,events:[]};(data.businessRecords||=[]).push(r)}
 if(body.operation==='analysisEnable')r.status=body.enabled?'Activa':'Inactiva';
 else if(m==='indicadores_financieros'){check(body.mapping&&typeof body.mapping==='object','Mapa requerido.');r.mapping=structuredClone(body.mapping);}
 else if(m==='costeo_abc'){check(Array.isArray(body.pools),'Generadores requeridos.');r.pools=structuredClone(body.pools);}
 else if(m==='notas_financieras'){check(typeof body.template==='string','Plantilla requerida.');r.template=body.template;r.recipient=body.recipient||'contador';}
 else check(false,'El tablero se determina por el rol real.');
 r.version++;r.events.push(event);validateAnalysisRecord(r);return r.id;
}
const div=(a,b)=>b>0?a/b:null;
const sum=values=>{const n=values.reduce((a,b)=>a+b,0);check(Number.isSafeInteger(n),'Importe fuera de rango seguro.');return n};
export function financialSnapshot(data,from,to,mapping=DEFAULT_MAPPING){
 const match=(a,key)=>mapping[key].some(p=>String(a).startsWith(p));
 const balance=(key,until,flow=false)=>sum(accountingEntries(data.entries,until).filter(e=>(!flow||e.date>=from)&&(!flow||!['cierre','cierre-anual'].includes(e.type))).flatMap(e=>(e.lines||[]).filter(l=>match(l.a,key)).map(l=>cents(l.d||0)-cents(l.c||0))));
 const credit=k=>-balance(k,to,true),debit=k=>balance(k,to,true),end=k=>balance(k,to),before=new Date(Date.parse(from)-86400000).toISOString().slice(0,10),avg=k=>(balance(k,before)+end(k))/2;
 const sales=credit('sales'),cogs=debit('cogs'),expenses=debit('expenses'),net=sales-cogs-expenses,days=(Date.parse(to)-Date.parse(from))/86400000+1;
 const dso=div(avg('receivables')*days,sales),dpo=div(-avg('payables')*days,cogs),dio=div(avg('inventory')*days,cogs),margin=div(sales-cogs,sales);
 const values={dso,dpo,dio,cashCycle:dso!==null&&dpo!==null&&dio!==null?dso+dio-dpo:null,grossMargin:margin,netMargin:div(net,sales),breakEven: mapping.fixed.length&&margin>0?Math.ceil(debit('fixed')/margin):null,liquidity:div(end('currentAssets'),-end('currentLiabilities')),debt:div(-end('liabilities'),end('assets')),turnover:div(sales,avg('assets')),inventoryTurnover:div(cogs,avg('inventory')),ebitda:mapping.depreciation.length&&mapping.interest.length&&mapping.tax.length?sum([net,debit('depreciation'),debit('interest'),debit('tax')]):null,freeOperatingFlow:null,roe:div(net,-avg('equity')),roa:div(net,avg('assets'))};
 // Método indirecto; exige clasificación explícita de depreciación e inversión.
 if(mapping.depreciation.length&&mapping.capex.length)values.freeOperatingFlow=sum([net,debit('depreciation'),-(end('receivables')-balance('receivables',before)),-(end('inventory')-balance('inventory',before)),-(end('payables')-balance('payables',before)),-debit('capex')]);
 return {values,statement:{sales,cogs,expenses,net,assets:end('assets'),liabilities:-end('liabilities'),equity:-end('equity')}};
}
export function abcReport(data,pools=[]){
 const groups=new Map();const get=(dimension,key)=>{const id=dimension+':'+key;if(!groups.has(id))groups.set(id,{dimension,key,revenueCents:0,costCents:0,amountCents:0,unknown:false});return groups.get(id)};
 for(const e of data.entries||[]){if(!['venta','nota-credito'].includes(e.type))continue;const sign=e.type==='nota-credito'?-1:1;
  for(const i of e.items||[]){const revenue=sign*cents(Math.round(i.q*i.u*100)/100),cost=Number.isFinite(i.cost)?sign*cents(Math.round(i.q*i.cost*100)/100):0;
   for(const [dim,key]of [['cliente',e.customerId||'sin-asignar'],[i.service?'servicio':'producto',i.p],['empleado',e.operatorId||'sin-asignar'],['sucursal',e.branchId||'principal']]){const r=get(dim,key);r.revenueCents=sum([r.revenueCents,revenue]);r.costCents=sum([r.costCents,cost]);r.unknown||=!Number.isFinite(i.cost)}
  }
 }
 for(const pool of pools){const total=pool.drivers.reduce((s,d)=>s+BigInt(d.units),0n);let left=pool.amountCents;const active=pool.drivers.filter(d=>d.units>0);active.forEach((d,i)=>{const allocated=i===active.length-1?left:Number(BigInt(pool.amountCents)*BigInt(d.units)/total);left-=allocated;const r=get(pool.dimension,d.key);r.amountCents=sum([r.amountCents,allocated])})}
 return [...groups.values()].map(r=>({...r,profitCents:r.unknown?null:sum([r.revenueCents,-r.costCents,-r.amountCents])}));
}
export function analysisReport(data,access,body,canRead){
 const m=body.module,r=analysisConfig(data,m),result={enabled:r?.status==='Activa',notice:NOTICE,templateVersion:r?.version||0,rows:[],settings:{}};
 if(!result.enabled)return result;
 const entries=(data.entries||[]).filter(e=>e.date>=body.from&&e.date<=body.to);
 if(['indicadores_financieros','notas_financieras'].includes(m)){
  check(canRead('contabilidad')&&canRead('finanzas'),'Se requiere lectura de Contabilidad y Finanzas.');
  const mapping=r.mapping||DEFAULT_MAPPING,current=financialSnapshot(data,body.from,body.to,mapping),days=(Date.parse(body.to)-Date.parse(body.from))/86400000+1,previousTo=new Date(Date.parse(body.from)-86400000).toISOString().slice(0,10),previousFrom=new Date(Date.parse(body.from)-days*86400000).toISOString().slice(0,10),previous=financialSnapshot(data,previousFrom,previousTo,mapping);
  const serviceFirst=catalog.get(access.company?.businessType).serviceFirst;
  if(serviceFirst&&!entries.some(e=>(e.items||[]).some(i=>!i.service))){for(const snapshot of [current,previous]){snapshot.values.dio=null;snapshot.values.inventoryTurnover=null;snapshot.values.cashCycle=null}}
  result.settings={mapping,template:r.template||'1. Bases de preparación\n2. Políticas contables\n3. Estimaciones y riesgos\n4. Hechos posteriores\n5. Observaciones'};result.previousFrom=previousFrom;result.previousTo=previousTo;
  result.rows=Object.entries(current.values).map(([key,value])=>({key,value,previous:previous.values[key],change:value!==null&&previous.values[key]!==null?value-previous.values[key]:null}));
  if(m==='notas_financieras'){result.statement=current.statement;result.notes=result.settings.template;result.recipient=r.recipient||'contador';result.settings.recipient=result.recipient;}
 }else if(m==='costeo_abc'){
  check(['ventas','inventario','personal','costos'].every(canRead),'Se requiere lectura de Ventas, Inventario, Personal y Costos.');result.settings={pools:r.pools||[]};result.rows=abcReport({...data,entries},r.pools||[]);
 }else{
  const role=access.owner?'dueño':String(access.member?.role||access.role||'').toLowerCase();check(['dueño','contador','cajero','vendedor'].includes(role),'Rol sin tablero.');result.role=role;
  const operational=['cajero','vendedor'].includes(role),own=operational?entries.filter(e=>e.operatorId===access.member?.id):entries;
  if(canRead('facturacion'))result.rows.push({key:'sales',value:sum(own.filter(e=>['venta','nota-credito'].includes(e.type)).map(e=>(e.type==='nota-credito'?-1:1)*cents(e.subtotal??e.total??0))),unit:'money'});
  if(canRead('cajas')&&role!=='vendedor')result.rows.push({key:'cashCounts',value:(data.cashCounts||[]).filter(c=>c.date>=body.from&&c.date<=body.to&&(!operational||c.responsible===access.member?.id)).length,unit:'count'});
  if(!operational&&canRead('contabilidad')&&canRead('finanzas'))for(const [key,value]of Object.entries(financialSnapshot(data,body.from,body.to).statement))result.rows.push({key,value,unit:'money'});
 }
 return result;
}
