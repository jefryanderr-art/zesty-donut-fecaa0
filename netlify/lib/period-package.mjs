import {collections,children} from '../../db/accounting-model.mjs';
import {accountingEntries,moneyCents,aging} from './accounting-engine.mjs';
import {booksReport,withholdingSummary,fiscalCheck as check} from './fiscal-rules.mjs';
import {documentHash} from './accounting-codec.mjs';
import '../../public/fiscal-calculations.js';
export const WORK_NOTICE='Borrador de apoyo, no es un documento oficial. Verificar con tu contador';
const {cents,sum}=globalThis.AcontecFiscalMath;
const monetaryKeys=new Set([...Object.values(collections),...Object.values(children)].flatMap(d=>d.money||[]).concat(['employerSocial','inatec','accumulated','residual','amount','balance','revaluation']));
const reportCents=value=>Array.isArray(value)?value.map(reportCents):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>typeof item==='number'&&monetaryKeys.has(key)?[key+'Cents',cents(item)]:[key,reportCents(item)])):value;
export function periodRange(period){
 check(typeof period==='string'&&/^(20\d{2})(?:-(0[1-9]|1[0-2])|-T([1-4]))?$/.test(period),'Período inválido (AAAA, AAAA-MM o AAAA-T1 a T4).');
 const year=+period.slice(0,4),month=period.includes('-T')?(+period.at(-1)-1)*3+1:period.length===7?+period.slice(5):1,count=period.includes('-T')?3:period.length===7?1:12;
 return {period,from:`${year}-${String(month).padStart(2,'0')}-01`,to:new Date(Date.UTC(year,month-1+count,0)).toISOString().slice(0,10),months:Array.from({length:count},(_,i)=>`${year}-${String(month+i).padStart(2,'0')}`)};
}
export function financialReports(data,from,to){
 const entries=accountingEntries(data.entries,to),codes=new Set(data.accounts.map(a=>a.code)),journal=[],warnings=[];
 for(const e of entries)for(const [i,l]of (e.lines||[]).entries()){
  if(!codes.has(l.a))warnings.push(`Cuenta inexistente ${l.a} en ${e.id}.`);
  if(e.date>=from)journal.push({entryId:e.id,line:i,date:e.date,type:e.type,reference:e.reference||'',description:e.desc||'',account:l.a,debitCents:cents(l.d),creditCents:cents(l.c)});
 }
 const accounts=new Map(data.accounts.filter(a=>!a.introducedByAnnualCloseOn||a.introducedByAnnualCloseOn<=to).map(a=>[a.code,{account:a.code,name:a.name,type:a.tipo,nature:a.nat,sub:a.sub,openingCents:0,debitCents:0,creditCents:0,closingCents:0,movements:[]}]));
 for(const e of entries)for(const l of e.lines||[]){const a=accounts.get(l.a);if(!a)continue;const d=cents(l.d),c=cents(l.c);if(e.date<from)a.openingCents+=d-c;else{a.debitCents+=d;a.creditCents+=c;a.movements.push({entryId:e.id,date:e.date,debitCents:d,creditCents:c})}}
 const ledger=[...accounts.values()].map(a=>({...a,closingCents:a.openingCents+a.debitCents-a.creditCents}));
 const balance=type=>sum(ledger.filter(a=>a.type===type).map(a=>a.closingCents))*(type==='activo'?1:-1);
 const activity=type=>sum(journal.filter(l=>data.accounts.find(a=>a.code===l.account)?.tipo===type&&!['apertura','apertura-importada','anula-apertura','cierre','cierre-anual','traspaso-anual','apertura-anual','reapertura-anual'].includes(l.type)).map(l=>l.debitCents-l.creditCents));
 const profitCents=-activity('ingreso')-activity('costo')-activity('gasto'),unclosedCents=-sum(ledger.filter(a=>['ingreso','costo','gasto'].includes(a.type)).map(a=>a.closingCents));
 const assetsCents=balance('activo'),liabilitiesCents=balance('pasivo'),equityCents=balance('patrimonio')+unclosedCents;
 const cashCodes=new Set(data.accounts.filter(a=>a.sub==='ef').map(a=>a.code));
 const cash=ledger.filter(a=>cashCodes.has(a.account)).map(a=>({account:a.account,name:a.name,openingCents:a.openingCents+sum(journal.filter(l=>l.account===a.account&&['apertura','apertura-importada','anula-apertura','apertura-anual'].includes(l.type)).map(l=>l.debitCents-l.creditCents)),debitCents:a.debitCents-sum(journal.filter(l=>l.account===a.account&&['apertura','apertura-importada','anula-apertura','apertura-anual'].includes(l.type)).map(l=>l.debitCents)),creditCents:a.creditCents-sum(journal.filter(l=>l.account===a.account&&['apertura','apertura-importada','anula-apertura','apertura-anual'].includes(l.type)).map(l=>l.creditCents)),closingCents:a.closingCents}));
 let openingCents=sum(ledger.filter(a=>cashCodes.has(a.account)).map(a=>a.openingCents)),operatingCents=0,investmentCents=0,financingCents=0;const cashMovements=[];
 for(const e of entries.filter(e=>e.date>=from)){
  const net=sum((e.lines||[]).filter(l=>cashCodes.has(l.a)).map(l=>cents(l.d)-cents(l.c)));if(!net)continue;
  if(['apertura','apertura-importada','anula-apertura','apertura-anual'].includes(e.type)){openingCents+=net;continue}
  let op=0,inv=0,fin=0;
  for(const l of (e.lines||[]).filter(l=>!cashCodes.has(l.a))){const a=data.accounts.find(a=>a.code===l.a),n=cents(l.c)-cents(l.d);if(a?.sub==='fijo')inv+=n;else if(a?.sub==='fin'||a?.tipo==='patrimonio')fin+=n;else op+=n;}
  operatingCents+=op;investmentCents+=inv;financingCents+=fin;cashMovements.push({entryId:e.id,date:e.date,description:e.desc,amountCents:net,operatingCents:op,investmentCents:inv,financingCents:fin});
 }
 const closingCents=sum(cash.map(a=>a.closingCents)),flowCents=openingCents+operatingCents+investmentCents+financingCents;
 const checks=[{name:'Activo = pasivo + patrimonio',differenceCents:assetsCents-liabilitiesCents-equityCents},{name:'Efectivo del flujo = caja y bancos del balance',differenceCents:flowCents-closingCents},{name:'Diario = movimientos de la balanza',differenceCents:sum(journal.map(l=>l.debitCents))-sum(ledger.map(a=>a.debitCents))},{name:'Debe = haber del diario',differenceCents:sum(journal.map(l=>l.debitCents-l.creditCents))}];
 const expectedProfit=sum(journal.filter(l=>['cierre','cierre-anual','reapertura-anual'].includes(l.type)&&data.accounts.find(a=>a.code===l.account)?.tipo==='patrimonio').map(l=>l.creditCents-l.debitCents));
 // El resultado trasladado conserva trazabilidad en cierre; no vuelve a sumarse al patrimonio.
 const balanceProfitCents=expectedProfit||unclosedCents;
 const openingProfit=-sum(ledger.filter(a=>['ingreso','costo','gasto'].includes(a.type)).map(a=>a.openingCents));
 checks.push({name:'Resultado del período = resultado en balance (descontando acumulado inicial)',differenceCents:profitCents-(balanceProfitCents-openingProfit)});
 for(const c of checks)if(c.differenceCents)warnings.push(`${c.name}: diferencia de ${c.differenceCents} centavos.`);
 for(const e of entries){const diff=sum(e.lines.map(l=>cents(l.d)-cents(l.c)));if(diff)warnings.push(`Asiento ${e.id}: diferencia de ${diff} centavos.`)}
 return {balance:[{assetsCents,liabilitiesCents,equityCents,profitCents:balanceProfitCents}],results:[{incomeCents:-activity('ingreso'),costCents:activity('costo'),expenseCents:activity('gasto'),profitCents}],equity:ledger.filter(a=>a.type==='patrimonio'),trial:ledger.map(({movements,...a})=>a),ledger,journal,cash,cashMovements,flow:[{openingCents,operatingCents,investmentCents,financingCents,closingCents:flowCents}],checks,warnings};
}
export function periodPackage(data,period,meta={}){
 const {from,to}=periodRange(period),financial=financialReports(data,from,to),inPeriod=r=>(r.date||r.to||'')>=from&&(r.date||r.to||'')<=to;
 const fiscalStatus=new Map((data.businessRecords||[]).filter(r=>r.kind==='document').map(r=>[r.entryId,r]));
 const books=Object.fromEntries(['ventas','compras','retenciones'].map(book=>[book,booksReport(data,{book,from,to,signed:true},id=>fiscalStatus.get(id))]));
 const payable=aging(data.entries||[],'2101',to),receivable=aging(data.entries||[],'1201',to);
 const ageRows=r=>r.rows.map(({balance,...row})=>({...row,balanceCents:cents(balance),aging:row.bucket===0?'vigente':row.bucket===1?'30':row.bucket===2?'60':'90+'}));
 const rows=(name)=>structuredClone((data[name]||[]).filter(inPeriod));
 const reports={...financial,ventas:books.ventas.rows,compras:books.compras.rows,retenciones:withholdingSummary(data,from,to).rows,nomina:rows('payrolls'),cxc:ageRows(receivable),cxp:ageRows(payable),arqueos:rows('cashCounts'),activos:(data.assets||[]).filter(a=>a.date<=to),impuestos:rows('taxes'),conciliaciones:(data.businessRecords||[]).filter(r=>r.module==='bancos'&&inPeriod(r)),constancias:(data.businessRecords||[]).filter(r=>r.kind==='certificate'&&inPeriod(r))};
 // Inventario a fecha por movimientos; no atribuir stock actual a un cierre histórico.
 reports.inventario=data.products.filter(p=>p.kind!=='service').map(p=>{
  const moves=(data.entries||[]).filter(e=>e.date<=to).flatMap(e=>(e.stock||[]).filter(m=>m.pid===p.id).map(m=>({entryId:e.id,date:e.date,...m})));
  const futureMicro=sum((data.entries||[]).filter(e=>e.date>to).flatMap(e=>(e.stock||[]).filter(m=>m.pid===p.id).map(m=>Math.round(m.q*1e6))));
  return {productId:p.id,name:p.name,q:Math.round((p.stock-futureMicro/1e6)*1e6)/1e6,movements:moves,notice:'Valor contable al cierre: cuenta 1301 de la balanza. No se utiliza el costo actual para inventar costos unitarios históricos.'};
 });
 reports.activos=(data.assets||[]).filter(a=>a.date<=to).map(a=>{const all=a.depreciations||[],initial=moneyCents(a.accumulated)-sum(all.map(d=>moneyCents(d.amount))),prior=all.filter(d=>d.date<=to);return {...a,active:!a.disposedAt||a.disposedAt>to,accumulated:(initial+sum(prior.map(d=>moneyCents(d.amount))))/100,depreciations:prior}});
 reports.impuestos=(data.taxes||[]).filter(t=>inPeriod(t)||/^(20\d{2})(?:-(0[1-9]|1[0-2]))?$/.test(t.period||'')&&periodRange(t.period).from<=to&&periodRange(t.period).to>=from||(data.entries||[]).some(e=>inPeriod(e)&&e.type==='fiscal-pago'&&e.taxId===t.id));
 reports.pagosImpuestos=(data.entries||[]).filter(e=>inPeriod(e)&&e.type==='fiscal-pago');
 reports.retenciones=reports.retenciones.map(r=>{const w=data.withholdings?.find(w=>w.id===r.id),invoice=data.entries.find(e=>e.id===w?.invoiceId),party=(w?.side==='practicada'?data.suppliers:data.customers)?.find(p=>p.id===(invoice?.supplierId||invoice?.customerId));return {...r,taxId:w?.taxId||w?.ruc||party?.taxId||'',taxIdStatus:w?.taxId||w?.ruc||party?.taxId?'registrado':'RUC no registrado'}});
 reports.facturas=(data.entries||[]).filter(e=>inPeriod(e)&&['venta','compra','nota-credito','nota-credito-compra','gasto','costo'].includes(e.type)).map(e=>{const party=(e.supplierId?data.suppliers:data.customers)?.find(p=>p.id===(e.supplierId||e.customerId));return {id:e.id,number:e.reference||e.id,date:e.date,party:e.party||'',taxId:party?.taxId||party?.ruc||'',baseCents:cents(e.subtotal??e.total-(e.vat||0)),vatCents:cents(e.vat),totalCents:cents(e.total),type:e.type,status:fiscalStatus.get(e.id)?.fiscalState||'contabilizado',taxCategory:e.taxCategory||e.exemptionType||'Sin clasificación registrada',items:e.items||[],lines:e.lines}});
 const attachments=[];for(const name of ['taxes','costs','pettyVouchers','cashMovements','entries'])for(const r of (data[name]||[]).filter(inPeriod))if(r.receipt)attachments.push({type:name,id:r.id,...r.receipt});
 for(const r of (data.fiscalWorkflows||[]).filter(r=>r.kind==='declaration'&&periodRange(r.period).from>=from&&periodRange(r.period).to<=to))for(const type of ['filing','payment'])if(r[type]?.receipt)attachments.push({type,id:r.id,...r[type].receipt});
 for(const [key,value]of Object.entries(reports))reports[key]=reportCents(value);
 const total=(name,key)=>sum((reports[name]||[]).map(r=>Number.isSafeInteger(r[key])?r[key]:0));
 const summaries=[
  {report:'ventas',name:'Ventas',...books.ventas.totals},
  {report:'compras',name:'Compras',...books.compras.totals},
  {report:'facturas',name:'Gastos y servicios registrados',baseCents:sum(reports.facturas.filter(r=>['gasto','costo'].includes(r.type)&&r.status!=='anulado').map(r=>r.baseCents))},
  {report:'retenciones',name:'Retenciones practicadas',amountCents:sum(reports.retenciones.filter(r=>r.side==='practicada').map(r=>r.totalCents))},
  {report:'retenciones',name:'Retenciones sufridas',amountCents:sum(reports.retenciones.filter(r=>r.side==='recibida').map(r=>r.totalCents))},
  {report:'cxc',name:'Cuentas por cobrar',amountCents:total('cxc','balanceCents')},
  {report:'cxp',name:'Cuentas por pagar',amountCents:total('cxp','balanceCents')},
  {report:'nomina',name:'Planilla registrada',grossCents:total('nomina','grossCents'),socialCents:total('nomina','socialCents'),taxCents:total('nomina','taxCents')},
  {report:'cash',name:'Caja y bancos al cierre',amountCents:total('cash','closingCents')},
  {report:'inventario',name:'Inventario contable al cierre',amountCents:reports.trial.find(r=>r.account==='1301')?.closingCents||0},
  {report:'activos',name:'Activos registrados',costCents:total('activos','costCents'),accumulatedCents:total('activos','accumulatedCents')},
  {report:'impuestos',name:'Saldos a favor registrados',creditCents:total('impuestos','creditCents')},
  {report:'pagosImpuestos',name:'Pagos de impuestos del período',amountCents:total('pagosImpuestos','totalCents')}
 ];
 reports.resumenTotales=summaries;
 const content={version:1,notice:WORK_NOTICE,meta:{...meta,ruc:data.cfg?.ruc||'',currency:data.cfg?.cur||'NIO',period,from,to},reports,totals:{ventas:books.ventas.totals,compras:books.compras.totals},warnings:financial.warnings,attachments};
 return {...content,hash:documentHash(content)};
}
