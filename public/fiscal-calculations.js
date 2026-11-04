'use strict';
// Contrato puro compartido: IVA, renta, anticipos y lectura de saldos por ejercicio.
(() => {
 const cents=n=>{const x=Math.round(Number(n||0)*100);if(!Number.isSafeInteger(x)||Math.abs(Number(n||0)*100-x)>0.00001)throw new Error('Importe fuera de centavos seguros.');return x;};
 const sum=values=>{const n=values.reduce((s,x)=>s+x,0);if(!Number.isSafeInteger(n))throw new Error('Total fuera del rango seguro.');return n;};
 const vat=(data,from,to)=>{
  let output=0,input=0,baseSales=0,basePurchases=0;
  const origins=[];
  for(const e of data.entries||[]){
   if(e.date<from||e.date>to||['fiscal','fiscal-pago','apertura-anual'].includes(e.type))continue;
   let used=false;
   for(const l of e.lines||[]){if(l.a==='2106'){output+=cents(l.c)-cents(l.d);used=true}if(l.a==='1202'){input+=cents(l.d)-cents(l.c);used=true}}
   if(['venta','nota-credito'].includes(e.type))baseSales+=cents(e.subtotal??e.total)*(e.type==='nota-credito'?-1:1);
   if(['compra','gasto','costo'].includes(e.type)&&!e.reversalOf)basePurchases+=cents(e.subtotal??e.total);
   if(used)origins.push(e.id);
  }
  return {from,to,output:output/100,input:input/100,baseSales:baseSales/100,basePurchases:basePurchases/100,net:(output-input)/100,origins};
 };
 const taxCents=(base,rateBps)=>{const n=Math.round(Math.max(0,base)*rateBps/10000);if(!Number.isSafeInteger(n))throw new Error('Impuesto fuera del rango seguro.');return n;};
 const annual=(data,year)=>{
  const accounts=new Map((data.accounts||[]).map(a=>[a.code,a]));let income=0,cost=0,expense=0;const origins=[];
  for(const e of data.entries||[]){if(e.date.slice(0,4)!==year||['cierre-anual','traspaso-anual','apertura-anual','reapertura-anual'].includes(e.type))continue;
   for(const l of e.lines||[]){const a=accounts.get(l.a);if(!a)continue;const n=cents(l.d)-cents(l.c);if(a.tipo==='ingreso')income-=n;if(a.tipo==='costo')cost+=n;if(a.tipo==='gasto'&&a.code!=='6108')expense+=n;}origins.push(e.id);
  }
  const profit=income-cost-expense,tax=taxCents(profit,Number(data.cfg?.fiscal?.incomeRate||0)*100);
  return {income:income/100,cost:cost/100,expense:expense/100,profit:profit/100,tax:tax/100,origins};
 };
 const advance=(data,month,rate,withholdings=0)=>{const base=sum((data.entries||[]).filter(e=>e.date.slice(0,7)===month&&['venta','nota-credito'].includes(e.type)).map(e=>cents(e.subtotal??e.total-(e.vat||0))*(e.type==='nota-credito'?-1:1))),gross=taxCents(base,rate*100);const next=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),1)),last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate(),due=next.toISOString().slice(0,7)+'-'+String(Math.min(data.cfg?.advance?.deadlineDay||1,last)).padStart(2,'0');return {base:base/100,grossAdvance:gross/100,total:Math.max(0,gross-cents(withholdings))/100,due};};
 const effectiveDeclarations=data=>{const all=(data.fiscalWorkflows||[]).filter(r=>r.kind==='declaration'&&r.frozen);return all.filter(r=>!all.some(n=>n.parentId===r.id));};
 const vatCreditAvailable=(data,period)=>{
  const prior=(data.taxes||[]).filter(t=>t.source==='iva'&&t.period<period),ids=new Set(prior.map(t=>t.id));
  const reserved=!data.fiscalCreditReservations?sum(effectiveDeclarations(data).flatMap(r=>r.frozen.credits||[]).filter(c=>ids.has(c.taxId)).map(c=>c.amountCents)):sum((data.fiscalCreditReservations||[]).filter(r=>r.period<period).map(r=>r.amountCents));
  return Math.max(0,sum(prior.map(t=>cents(t.credit)-cents(t.usedCredit)))-reserved)/100;
 };
 const lateCharges=(definition,amountCents,due,date,to)=>{const daysLate=due?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(due))/86400000)):0,configured=!!definition.late&&definition.late.effectiveFrom<=to;return {daysLate,configured,penaltyCents:daysLate&&configured?definition.late.fixedCents:0,interestCents:daysLate&&configured?taxCents(amountCents,definition.late.dailyBps*daysLate):0};};
 globalThis.AcontecFiscalMath=Object.freeze({cents,sum,vat,annual,advance,taxCents,effectiveDeclarations,vatCreditAvailable,lateCharges});
})();
