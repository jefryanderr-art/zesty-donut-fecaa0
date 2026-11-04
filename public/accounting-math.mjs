export class AccountingValidationError extends Error { constructor(message){super(message);this.publicMessage=message;this.status=422;} }
// Validar antes de redondear: 0.0009 no se acepta como 0.001.
export function normalizeItemQuantity(value){const q=Number(value);if(!Number.isFinite(q)||q<0.001)throw new AccountingValidationError('La cantidad mínima es 0.001.');return Math.round(q*1000)/1000}
// Cálculos puros en centavos; usados por Functions y por las verificaciones de la plataforma.
export function moneyCents(value){const n=Number(value),c=Math.round(n*100);if(!Number.isFinite(n)||!Number.isSafeInteger(c)||Math.abs(n*100-c)>0.000001)throw new AccountingValidationError('Usa importes seguros con un máximo de dos decimales.');return c}
// Costos de consumibles y comisiones: aritmética entera, sin modificar el precio del servicio.
export function serviceLineCostCents(unitCost,quantity){
 const cost=moneyCents(unitCost),q=normalizeItemQuantity(quantity),milli=Math.round(q*1000);
 if(cost<0||q!==Number(quantity)||!Number.isSafeInteger(milli)||!Number.isSafeInteger(cost*milli))throw new AccountingValidationError('Costo o cantidad de consumible inválidos.');
 return Number((BigInt(cost)*BigInt(milli)+500n)/1000n);
}
export function serviceCommissionCents(baseCents,basisPoints){
 if(!Number.isSafeInteger(baseCents)||baseCents<0||!Number.isInteger(basisPoints)||basisPoints<0||basisPoints>10000)throw new AccountingValidationError('Base o comisión inválida.');
 return Number((BigInt(baseCents)*BigInt(basisPoints)+5000n)/10000n);
}
export function amortization(principal,annualRate,months){
 const initial=moneyCents(principal);if(initial<=0||!Number.isInteger(months)||months<1||months>600||!Number.isFinite(annualRate)||annualRate<0||annualRate>100)throw new AccountingValidationError('Revisa capital, tasa anual y plazo (1 a 600 meses).');
 const rate=annualRate/1200,payment=Math.round(rate?initial*rate/(1-Math.pow(1+rate,-months)):initial/months);let balance=initial;const rows=[];
 for(let n=1;n<=months;n++){const interest=Math.round(balance*rate),capital=n===months?balance:Math.min(balance,Math.max(0,payment-interest));if(capital<=0)throw new AccountingValidationError('El capital es demasiado pequeño para ese plazo y tasa.');balance-=capital;rows.push({number:n,principal:capital/100,interest:interest/100,total:(capital+interest)/100,balance:balance/100})}return rows;
}
export function monthlyDepreciation(asset){
 const cost=moneyCents(asset.cost),residual=moneyCents(asset.residual),accumulated=moneyCents(asset.accumulated||0),remaining=cost-residual-accumulated;
 if(cost<0||residual<0||residual>cost||!Number.isInteger(asset.lifeMonths)||asset.lifeMonths<1||asset.lifeMonths>1200||remaining<0)throw new AccountingValidationError('Costo, residual o vida útil inválidos.');
 if(!remaining)return 0;
 const posted=(asset.depreciations||[]).length,charge=posted+1>=asset.lifeMonths?remaining:asset.method==='declining'?Math.round((cost-accumulated)*2/asset.lifeMonths):Math.round((cost-residual)/asset.lifeMonths);
 return Math.min(remaining,charge)/100;
}
export function balancedLines(lines,accounts){
 if(!Array.isArray(lines)||lines.length<2||lines.length>100)throw new AccountingValidationError('El asiento requiere de 2 a 100 líneas.');
 let debit=0,credit=0;const codes=new Set(accounts.map(a=>a.code));
 const result=lines.map(line=>{const d=moneyCents(line.d||0),c=moneyCents(line.c||0);if(!codes.has(line.a)||d<0||c<0||d&&c)throw new AccountingValidationError('Cuenta o importe inválido.');debit+=d;credit+=c;return {a:line.a,d:d/100,c:c/100}});
 if(debit!==credit||!debit||!Number.isSafeInteger(debit))throw new AccountingValidationError('El debe y el haber deben ser iguales y mayores que cero.');return result;
}
export function yearClosing(entries,accounts,year){
 const selected=globalThis.AcontecAnnualLedger?.select(entries,year+'-12-31')||entries.filter(e=>e.date<=year+'-12-31');
 const balances=new Map();for(const e of selected)for(const l of e.lines||[])balances.set(l.a,(balances.get(l.a)||0)+moneyCents(l.d)-moneyCents(l.c));
 const lines=[];let result=0;for(const account of accounts.filter(a=>['ingreso','gasto','costo'].includes(a.tipo))){const net=balances.get(account.code)||0;if(net){lines.push({a:account.code,d:net<0?-net/100:0,c:net>0?net/100:0});result+=net}}
 if(result)lines.push({a:'3102',d:result>0?result/100:0,c:result<0?-result/100:0});return lines;
}
export function aging(entries,account,asOf){
 const receivable=account==='1201',buckets=[0,0,0,0,0];const rows=[];
 for(const entry of entries.filter(e=>e.date<=asOf&&e.lines?.some(l=>l.a===account&&(receivable?l.d:l.c)>0)&&e.pay===account)){
  const linked=invoiceLinkedEntries(entries,entry.id).filter(e=>e.date<=asOf);const cents=linked.reduce((sum,e)=>sum+e.lines.filter(l=>l.a===account).reduce((s,l)=>s+(receivable?moneyCents(l.d)-moneyCents(l.c):moneyCents(l.c)-moneyCents(l.d)),0),0);
  if(cents<=0)continue;const days=Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(entry.due||entry.date))/86400000)),index=(entry.due||entry.date)>=asOf?0:days<=30?1:days<=60?2:days<=90?3:4;buckets[index]+=cents;rows.push({id:entry.id,party:entry.party,reference:entry.reference||entry.id,due:entry.due||entry.date,days,balance:cents/100,bucket:index});
 }return {buckets:buckets.map(c=>c/100),rows};
}
export function invoiceTotals(items){
 let base=0,tax=0;for(const item of items){const price=moneyCents(item.u);if(!Number.isFinite(item.q)||item.q<=0||!Number.isFinite(item.vatRate||0)||item.vatRate<0||item.vatRate>100)throw new AccountingValidationError('Cantidad o IVA inválido.');const line=Math.round((item.q*(price/100)+Number.EPSILON)*100);base+=line;tax+=Math.round(line*(item.vatRate||0)/100)}
 if(!Number.isSafeInteger(base+tax))throw new AccountingValidationError('El total supera el rango seguro.');return {subtotal:base/100,vat:tax/100,total:(base+tax)/100};
}
export function payrollTotals(record){const amount=name=>moneyCents(record[name]||0),gross=amount('base')+amount('overtime')+amount('bonus')+amount('commission'),net=gross-amount('tax')-amount('social')-amount('loan');if(gross<0||net<0)throw new AccountingValidationError('La nómina tiene importes negativos.');return {gross:gross/100,net:net/100}}
export function integrityReport(data){
 const issues=[],ids=new Set(),used=new Set(),accounts=new Set((data.accounts||[]).map(a=>a.code));
 for(const e of data.entries||[]){if(ids.has(e.id))issues.push({kind:'duplicado',id:e.id,message:'Identificador de asiento duplicado'});ids.add(e.id);try{let debit=0,credit=0;for(const l of e.lines||[]){debit+=moneyCents(l.d);credit+=moneyCents(l.c);used.add(l.a);if(!accounts.has(l.a))issues.push({kind:'cuenta_inexistente',id:e.id,message:'Cuenta inexistente: '+l.a})}if(debit!==credit)issues.push({kind:'descuadrado',id:e.id,message:'Debe y haber diferentes'});if(['venta','compra'].includes(e.type)&&!e.lines?.length)issues.push({kind:'sin_asiento',id:e.id,message:'Factura sin líneas contables'})}catch{issues.push({kind:'importe_invalido',id:e.id,message:'Importe con fracción de centavo o fuera del rango seguro'})}}
 for(const a of data.accounts||[])if(!used.has(a.code))issues.push({kind:'sin_movimiento',id:a.code,message:a.name});
 for(const p of data.products||[])if(p.stock<0)issues.push({kind:'stock_negativo',id:p.id,message:p.name});
 return {issues,entries:(data.entries||[]).length,debitCents:(data.entries||[]).flatMap(e=>e.lines||[]).reduce((s,l)=>s+Math.round(l.d*100),0),creditCents:(data.entries||[]).flatMap(e=>e.lines||[]).reduce((s,l)=>s+Math.round(l.c*100),0)};
}
export function allocateCents(total,weights){const cents=moneyCents(total),sum=weights.reduce((s,n)=>s+n,0);if(cents<0||!Number.isFinite(sum)||sum<=0||weights.some(n=>!Number.isFinite(n)||n<0))throw new AccountingValidationError('Pesos de prorrateo inválidos.');const rows=weights.map((n,index)=>{const exact=cents*n/sum,floor=Math.floor(exact);return {index,cents:floor,remainder:exact-floor}});let left=cents-rows.reduce((s,r)=>s+r.cents,0);for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder||a.index-b.index)){if(left--<=0)break;row.cents++}return rows.map(r=>r.cents/100)}
export function allocateReturnItems(originalItems,previousNotes,requested){
 const original=new Map(),returned=new Map(),wanted=new Map();for(const row of originalItems)original.set(row.p,(original.get(row.p)||0)+row.q);
 for(const note of previousNotes)for(const row of note.items||[])returned.set(row.p,(returned.get(row.p)||0)+row.q);
 for(const row of requested||[]){if(Number(row.q)===0)continue;const q=normalizeItemQuantity(row.q);wanted.set(row.p,(wanted.get(row.p)||0)+q)}
 const items=[];for(const [id,q]of wanted){if(!q)continue;if(!original.has(id)||q>(original.get(id)-(returned.get(id)||0))+1e-6)throw new AccountingValidationError('La cantidad supera lo pendiente de devolución.');let skip=returned.get(id)||0,remaining=q;for(const row of originalItems.filter(i=>i.p===id)){const consumed=Math.min(skip,row.q);skip-=consumed;const take=Math.min(remaining,row.q-consumed);if(take>0){items.push({...row,q:take});remaining=Math.round((remaining-take)*1e6)/1e6}if(remaining<=0)break}}
 if(!items.length)throw new AccountingValidationError('Indica al menos un producto a devolver.');return {items,finalReturn:[...original].every(([id,q])=>(returned.get(id)||0)+(wanted.get(id)||0)>=q-1e-6)};
}
export function investmentMetrics(initial,cashflows,annualRate){
 const cost=moneyCents(initial)/100;if(cost<=0||!Array.isArray(cashflows)||!cashflows.length||cashflows.length>100||!cashflows.every(Number.isFinite)||!Number.isFinite(annualRate)||annualRate<=-100)throw new AccountingValidationError('Revisa inversión, flujos y tasa de descuento.');
 const npv=rate=>-cost+cashflows.reduce((s,v,i)=>s+v/Math.pow(1+rate,i+1),0);let low=-.9999,high=10,irr=null;
 if(npv(low)*npv(high)<=0){for(let i=0;i<200;i++){const mid=(low+high)/2;if(npv(low)*npv(mid)<=0)high=mid;else low=mid}irr=(low+high)/2*100}
 let balance=-cost,payback=null;for(let i=0;i<cashflows.length;i++){const before=balance;balance+=cashflows[i];if(balance>=0&&payback===null&&cashflows[i]>0)payback=i+(-before/cashflows[i])}
 return {npv:Math.round(npv(annualRate/100)*100)/100,irr,payback};
}
export function leaseSchedule(principal,residual,annualRate,months){
 const initial=moneyCents(principal),end=moneyCents(residual);if(initial<=0||end<0||end>initial||!Number.isInteger(months)||months<1||months>600||!Number.isFinite(annualRate)||annualRate<0||annualRate>100)throw new AccountingValidationError('Revisa capital, residual, tasa y plazo.');
 const rate=annualRate/1200,payment=Math.round(rate?(initial-end/Math.pow(1+rate,months))*rate/(1-Math.pow(1+rate,-months)):(initial-end)/months);let balance=initial;const rows=[];
 for(let n=1;n<=months;n++){const interest=Math.round(balance*rate),capital=n===months?balance-end:Math.min(balance-end,Math.max(0,payment-interest));balance-=capital;rows.push({number:n,principal:capital/100,interest:interest/100,total:(capital+interest)/100,balance:balance/100})}return rows;
}

// Cartera otorgada: tasas por período configuradas, nunca reglas legales implícitas.
export function businessLoanSchedule({principal,rate,periods,method}) {
 const initial=moneyCents(principal);
 if(initial<periods||!Number.isInteger(periods)||periods<1||periods>600||!Number.isFinite(rate)||rate<0||rate>100||!['frances','capital_constante','plano'].includes(method))throw new AccountingValidationError('Revisa capital, tasa por período, cuotas y método.');
 const r=rate/100,annuity=Math.round(r?initial*r/(1-Math.pow(1+r,-periods)):initial/periods);let balance=initial;const rows=[];
 for(let n=1;n<=periods;n++){
  const interest=Math.round((method==='plano'?initial:balance)*r);
  const capital=n===periods?balance:Math.min(balance,method==='frances'?Math.max(0,annuity-interest):Math.floor(initial/periods));
  if(capital<1)throw new AccountingValidationError('Las condiciones no amortizan el capital en centavos.');
  balance-=capital;rows.push({number:n,principal:capital/100,interest:interest/100,total:(capital+interest)/100,balance:balance/100,paid:0,penalty:0});
 }
 return rows;
}
export function businessCommission(base,rate){const c=moneyCents(base);if(c<0||!Number.isFinite(rate)||rate<0||rate>100)throw new AccountingValidationError('Base o porcentaje inválido.');return Math.round(c*rate/100)/100}
export function businessLateCharge(principal,dailyRate,days){if(!Number.isInteger(days)||days<0||days>36500||!Number.isFinite(dailyRate)||dailyRate<0||dailyRate>100)throw new AccountingValidationError('Días o tasa de mora inválidos.');const result=Math.round(moneyCents(principal)*dailyRate/100*days);if(!Number.isSafeInteger(result))throw new AccountingValidationError('La mora supera el rango seguro.');return result/100}
export function businessBillItems(record,products,projectItems){
 const find=id=>{const p=products.find(p=>p.id===id);if(!p)throw new AccountingValidationError('Producto inexistente.');return p};
 let items=structuredClone(projectItems??record.items??[]);
 if(record.module==='variantes'){const p=find(record.productId);items=[{p:p.id,q:1,u:p.price}]}
 if(record.module==='reservas'&&record.tariffProductId){
  const p=find(record.tariffProductId),unit=record.timeUnit==='hora'?3600000:86400000,zone=record.timeZone||'America/Managua',dayKey=t=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)),firstDay=dayKey(record.start),lastDay=dayKey(record.end),count=record.timeUnit==='hora'?Math.ceil((Date.parse(record.end)-Date.parse(record.start))/unit):Math.max(1,Math.round((Date.parse(lastDay)-Date.parse(firstDay))/86400000));
  if(p.kind!=='service'||!['hora','día','noche'].includes(record.timeUnit)||!Number.isInteger(count)||count<1||count>3660)throw new AccountingValidationError('Revisa servicio, unidad y duración de la tarifa.');
  const charges=new Map();for(let n=0;n<count;n++){const day=record.timeUnit==='hora'?dayKey(Date.parse(record.start)+n*unit):new Date(Date.parse(firstDay+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),tariffs=(record.tariffs||[]).filter(t=>t.from<=day&&t.to>=day);if(tariffs.length>1)throw new AccountingValidationError('Hay temporadas superpuestas.');const u=tariffs[0]?.price??p.price;charges.set(u,(charges.get(u)||0)+1)}items.push(...[...charges].map(([u,q])=>({p:p.id,q,u})));
 }
 items=items.map(i=>({...i,vatRate:find(i.p).vatRate||0}));
 if(record.serviceRate){const p=find(record.serviceProductId);if(p.kind!=='service')throw new AccountingValidationError('Configura el producto de servicio.');items.push({p:p.id,q:1,u:businessCommission(invoiceTotals(items).subtotal,record.serviceRate),vatRate:p.vatRate||0})}
 return items;
}
export function businessContractLateItems(record,entries,products,day){
 if(record.module!=='contratos'||!record.lateRate)return {items:[],updates:[]};
 const p=products.find(p=>p.id===record.lateProductId);if(p?.kind!=='service')throw new AccountingValidationError('Configura un servicio para la mora.');
 let cents=0;const updates=[];
 for(const billed of record.billed||[]){const balanceCents=entries.filter(e=>e.id===billed.entryId||e.invoiceId===billed.entryId).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0),from=billed.lateThrough||billed.due;if(balanceCents>0&&day>from){const days=Math.floor((Date.parse(day)-Date.parse(from))/86400000);cents+=moneyCents(businessLateCharge(balanceCents/100,record.lateRate,days));updates.push(billed)}}
 if(!Number.isSafeInteger(cents))throw new AccountingValidationError('La mora supera el rango seguro.');return {items:cents?[{p:p.id,q:1,u:cents/100,vatRate:p.vatRate||0}]:[],updates};
}

export function creditReturnSummary(original, previousNotes, items, finalReturn, entries) {
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  let subtotal = round(items.reduce((sum, item) => sum + round(item.q * item.u), 0)), vat = round(items.reduce((sum, item) => sum + round(round(item.q * item.u) * (item.vatRate || 0) / 100), 0));

  if (finalReturn) {
    subtotal = round((original.subtotal ?? original.total - (original.vat || 0)) - previousNotes.reduce((sum, note) => sum + note.subtotal, 0));
    vat = round((original.vat || 0) - previousNotes.reduce((sum, note) => sum + note.vat, 0));
  }
  const total = round(subtotal + vat);
  const debt = round(invoiceLinkedEntries(entries,original.id).reduce((sum, entry) => sum + (entry.lines || []).filter(line => line.a === '1201').reduce((value, line) => value + line.d - line.c, 0), 0));
  const debtReduction = Math.min(Math.max(0, debt), total), refund = round(total - debtReduction);
  return {subtotal, vat, total, debtReduction, refund};
}

export function customerCreditBalance(customerId, entries){
 const invoices=new Set(entries.filter(entry=>entry.customerId===customerId).map(entry=>entry.id));
 return entries.reduce((sum,entry)=>sum+(entry.allocationJournal?(entry.lines||[]).filter(l=>invoices.has(l.invoiceId)):invoices.has(entry.id)||invoices.has(entry.invoiceId)?entry.lines||[]:[]).filter(line=>line.a==='1201').reduce((total,line)=>total+line.d-line.c,0),0);
}

// Recurrentes: fechas civiles con fin exclusivo e importes nativos en centavos.
export function recurringDay(day) {
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw new AccountingValidationError('Fecha recurrente inválida.');
 return day;
}
export function recurringBoundary(anchor,months,index){
 recurringDay(anchor);if(![1,3,6,12].includes(months)||!Number.isInteger(index)||index<0||index>1200)throw new AccountingValidationError('Periodicidad o período inválidos.');
 const [y,m,d]=anchor.split('-').map(Number),target=new Date(Date.UTC(y,m-1+months*index,1));target.setUTCDate(Math.min(d,new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));return recurringDay(target.toISOString().slice(0,10));
}
export function recurringRatio(cents,numerator,denominator){
 if(!Number.isSafeInteger(cents)||cents<0||!Number.isSafeInteger(numerator)||numerator<0||!Number.isSafeInteger(denominator)||denominator<=0)throw new AccountingValidationError('Prorrateo inválido.');
 const n=(BigInt(cents)*BigInt(numerator)*2n+BigInt(denominator))/(BigInt(denominator)*2n),value=Number(n);if(!Number.isSafeInteger(value))throw new AccountingValidationError('Importe fuera de rango.');return value;
}
export function recurringActiveDays(record,from,to){
 recurringDay(from);recurringDay(to);let activeDays=0;const changes=[{date:record.date,status:'Activa'},...(record.events||[]).filter(e=>e.status)].sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<changes.length;i++){const e=changes[i],start=[from,e.date].sort().at(-1),end=[to,changes[i+1]?.date||to].sort()[0];if(e.status==='Activa'&&start<end)activeDays+=(Date.parse(end)-Date.parse(start))/86400000;}return activeDays;
}
export function recurringPeriod(record,index){
 const from=recurringBoundary(record.anchor,record.months,index),to=recurringBoundary(record.anchor,record.months,index+1),days=(Date.parse(to)-Date.parse(from))/86400000;
 const activeDays=recurringActiveDays(record,from,to);
 return {from,to,days,activeDays,baseCents:recurringRatio(record.amountCents,activeDays,days)};
}
export function recurringMetrics(records,entries,from,to){
 recurringDay(from);recurringDay(to);if(from>to)throw new AccountingValidationError('Período inválido.');
 const active=(r,day)=>r.date<=day&&([{date:r.date,status:'Activa'},...(r.events||[]).filter(e=>e.status)].filter(e=>e.date<=day).at(-1)?.status==='Activa');
 const opening=records.filter(r=>active(r,from)),canceled=opening.filter(r=>(r.events||[]).some(e=>e.status==='Cancelada'&&e.date>=from&&e.date<=to));
 const mrrCents=records.filter(r=>active(r,to)).reduce((s,r)=>s+recurringRatio(r.amountCents,1,r.months),0),arrCents=mrrCents*12;
 if(!Number.isSafeInteger(arrCents))throw new AccountingValidationError('Métricas fuera de rango.');
 const ids=new Set(records.flatMap(r=>(r.billed||[]).map(b=>b.entryId))),portfolio=aging(entries.filter(e=>ids.has(e.id)||ids.has(e.invoiceId)),'1201',to);
 return {mrrCents,arrCents,opening:opening.length,canceled:canceled.length,churnBps:opening.length?recurringRatio(10000,canceled.length,opening.length):0,portfolio};
}
// Dos tarifas diarias enteras reparten exactamente el precio sin modificar el emisor.
export function recurringInvoiceItems(record,period){
 const low=Math.floor(record.amountCents/period.days),highDays=period.baseCents-low*period.activeDays,lowDays=period.activeDays-highDays;
 if(!Number.isSafeInteger(low)||!Number.isInteger(highDays)||highDays<0||lowDays<0)throw new AccountingValidationError('Distribución diaria inválida.');
 return [...(lowDays?[{p:record.productId,q:lowDays,u:low/100}]:[]),...(highDays?[{p:record.roundingProductId,q:highDays,u:(low+1)/100}]:[])];
}

// Tesorería: importación y conciliación puras. Los saldos nuevos son centavos enteros.
export function bankAmountCents(value,decimal='.') {
 if(!['.',','].includes(decimal))throw new AccountingValidationError('Selecciona el separador decimal.');
 let s=String(value??'').trim(),negative=false;
 if(/^\(.*\)$/.test(s)){negative=true;s=s.slice(1,-1);}
 if(s.startsWith('-')){negative=!negative;s=s.slice(1);}else if(s.startsWith('+'))s=s.slice(1);
 const sep=decimal==='.'?'\\.':',',group=decimal==='.'?',':'\\.';
 if(!new RegExp('^(?:\\d+|\\d{1,3}(?:'+group+'\\d{3})+)(?:'+sep+'\\d{1,2})?$').test(s))throw new AccountingValidationError('Importe inválido o con fracciones de centavo.');
 s=s.split(decimal==='.'?',':'.').join('');const parts=s.split(decimal),n=BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0'));
 if(n>99999999900n)throw new AccountingValidationError('Importe fuera de rango.');return Number(n)*(negative?-1:1);
}
export function bankGridRows(grid,mapping){
 if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))throw new AccountingValidationError('Configura el mapeo de columnas antes de importar.');
 if(!Array.isArray(grid)||grid.length<2||grid.length>1001)throw new AccountingValidationError('Importa entre 1 y 1000 movimientos.');
 const headers=grid[0];if(!Array.isArray(headers)||headers.length>50||headers.some(c=>typeof c!=='string'||c.length>500))throw new AccountingValidationError('Encabezados inválidos.');
 const indexes=['date','amount','reference'].map(k=>mapping[k]);
 if(indexes.some(i=>!Number.isInteger(i)||i<0||i>=headers.length)||new Set(indexes).size!==3||!['ISO','DMY'].includes(mapping.dateFormat))throw new AccountingValidationError('Revisa el mapeo de columnas y fechas.');
 return grid.slice(1).map((r,i)=>{
  if(!Array.isArray(r)||r.length>50||r.some(c=>typeof c!=='string'||c.length>500))throw new AccountingValidationError('Fila inválida: '+(i+2));
  let date=r[mapping.date]?.trim();if(mapping.dateFormat==='DMY'){const m=/^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(date);if(!m)throw new AccountingValidationError('Fecha inválida: '+(i+2));date=m[3]+'-'+m[2]+'-'+m[1];}
  recurringDay(date);const amountCents=bankAmountCents(r[mapping.amount],mapping.decimal);
  if(!amountCents)throw new AccountingValidationError('Movimiento sin importe: '+(i+2));
  return {date,amountCents,reference:String(r[mapping.reference]||'').trim().slice(0,200).replace(/(?:\d[ -]?){12,19}/g,n=>'•••• '+n.replace(/\D/g,'').slice(-4)),sourceRow:i+2};
 });
}
export function bankSuggestions(rows,ledger,maxDays=3){
 if(!Number.isInteger(maxDays)||maxDays<0||maxDays>30)throw new AccountingValidationError('Tolerancia de fecha inválida.');
 const ref=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase('es');
 return rows.map(row=>({sourceRow:row.sourceRow,candidates:ledger.filter(e=>e.amountCents===row.amountCents&&Math.abs(Date.parse(e.date)-Date.parse(row.date))<=maxDays*86400000).map(e=>({entryId:e.entryId,days:Math.abs(Date.parse(e.date)-Date.parse(row.date))/86400000,referenceMatch:!!ref(row.reference)&&ref(row.reference)===ref(e.reference)})).sort((a,b)=>Number(b.referenceMatch)-Number(a.referenceMatch)||a.days-b.days||a.entryId.localeCompare(b.entryId))}));
}
export function bankReconciliationTotals({bookCents,bankCents,pendingBank=[],transit=[]}){
 const sum=rows=>rows.reduce((n,r)=>{if(!Number.isSafeInteger(r.amountCents))throw new AccountingValidationError('Saldo inválido.');const next=n+r.amountCents;if(!Number.isSafeInteger(next))throw new AccountingValidationError('Saldo fuera de rango.');return next},0);
 const pendingCents=sum(pendingBank),transitCents=sum(transit),adjustedBookCents=bookCents+pendingCents,adjustedBankCents=bankCents+transitCents,differenceCents=adjustedBookCents-adjustedBankCents;
 if(![bookCents,bankCents,adjustedBookCents,adjustedBankCents,differenceCents].every(Number.isSafeInteger))throw new AccountingValidationError('Saldo fuera de rango.');
 return {bookCents,bankCents,pendingCents,transitCents,adjustedBookCents,adjustedBankCents,differenceCents};
}

// Tasa expresa unidades de moneda base por unidad original, hasta seis decimales.
export function bankRateMicros(value){
 const s=String(value??'').trim();
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(s))throw new AccountingValidationError('Tasa inválida: usa hasta seis decimales sin separadores.');
 const [whole,fraction='']=s.split('.'),n=Number(BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0')));
 if(!Number.isSafeInteger(n)||n<=0)throw new AccountingValidationError('La tasa debe ser positiva.');return n;
}
export function bankConvertCents(originalCents,rateMicros){
 if(!Number.isSafeInteger(originalCents)||Math.abs(originalCents)>99999999900||!Number.isSafeInteger(rateMicros)||rateMicros<=0||rateMicros>999999999999)throw new AccountingValidationError('Conversión fuera de rango.');
 const sign=originalCents<0?-1:1,n=Number((BigInt(Math.abs(originalCents))*BigInt(rateMicros)+500000n)/1000000n)*sign;
 if(!Number.isSafeInteger(n)||Math.abs(n)>99999999900)throw new AccountingValidationError('Conversión fuera de rango.');return n;
}

// F2: las líneas nuevas pueden identificar facturas dentro de un único asiento.
// Los asientos anteriores, sin allocationJournal, mantienen su interpretación.
export function invoiceLinkedEntries(entries,id){
 return entries.flatMap(e=>e.allocationJournal?((e.lines||[]).some(l=>l.invoiceId===id)?[{...e,invoiceId:id,lines:e.lines.filter(l=>l.invoiceId===id)}]:[]):e.id===id||e.invoiceId===id||e.reversalOf===id?[e]:[]);
}
export function treasuryDebt(entries,invoice,through='9999-12-31'){
 const sign=invoice.pay==='1201'?1:-1;
 return treasurySum(invoiceLinkedEntries(entries,invoice.id).filter(e=>e.date<=through).flatMap(e=>e.lines||[]).filter(l=>l.a===invoice.pay).map(l=>sign*(moneyCents(l.d)-moneyCents(l.c))));
}
export function treasurySum(values){const n=values.reduce((s,v)=>{if(!Number.isSafeInteger(v)||!Number.isSafeInteger(s+v))throw new AccountingValidationError('Centavos fuera del rango seguro.');return s+v},0);return n}
export const treasuryDayAdd=(day,n)=>{recurringDay(day);if(!Number.isInteger(n)||Math.abs(n)>3660)throw new AccountingValidationError('Plazo inválido.');return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)};
export function treasuryForecast({from,to,openingCents,events,scenarios,frequency='month',reserveCents=0}){
 recurringDay(from);recurringDay(to);if(to<from||Date.parse(to)-Date.parse(from)>366*86400000||!['week','month'].includes(frequency)||!Number.isSafeInteger(reserveCents)||reserveCents<0)throw new AccountingValidationError('Revisa período, frecuencia y reserva.');
 const defaults={optimista:{delayDays:0,badDebtBps:0},base:{delayDays:7,badDebtBps:200},pesimista:{delayDays:30,badDebtBps:1000}};
 return Object.entries(defaults).map(([name,defaultValue])=>{
  const assumption={...defaultValue,...scenarios?.[name]};if(!Number.isInteger(assumption.delayDays)||assumption.delayDays<0||assumption.delayDays>365||!Number.isInteger(assumption.badDebtBps)||assumption.badDebtBps<0||assumption.badDebtBps>10000)throw new AccountingValidationError('Supuestos inválidos.');
  const adjusted=events.map(e=>({...e,date:e.amountCents>0?treasuryDayAdd(e.date,assumption.delayDays):e.date,amountCents:e.amountCents>0?recurringRatio(e.amountCents,10000-assumption.badDebtBps,10000):e.amountCents})).filter(e=>e.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  let balanceCents=treasurySum([openingCents]),firstShortfall=balanceCents<0?from:null;const buckets=new Map();
  for(let day=from;day<=to;day=treasuryDayAdd(day,1)){
   const key=frequency==='month'?day.slice(0,7):treasuryDayAdd(from,Math.floor((Date.parse(day)-Date.parse(from))/604800000)*7);
   const rows=adjusted.filter(e=>(e.date<from?from:e.date)===day),netCents=treasurySum(rows.map(e=>e.amountCents));balanceCents=treasurySum([balanceCents,netCents]);if(balanceCents<0&&!firstShortfall)firstShortfall=day;
   const b=buckets.get(key)||{period:key,inCents:0,outCents:0};b.inCents=treasurySum([b.inCents,...rows.filter(e=>e.amountCents>0).map(e=>e.amountCents)]);b.outCents=treasurySum([b.outCents,...rows.filter(e=>e.amountCents<0).map(e=>-e.amountCents)]);b.balanceCents=balanceCents;buckets.set(key,b);
  }
  return {name,assumption,openingCents,firstShortfall,liquidity:firstShortfall?'rojo':balanceCents<reserveCents?'amarillo':'verde',balanceCents,buckets:[...buckets.values()]};
 });
}
export function treasuryIndirect(data,from,to){
 recurringDay(from);recurringDay(to);const cash=new Set(data.accounts.filter(a=>a.sub==='ef').map(a=>a.code)),accounts=new Map(data.accounts.map(a=>[a.code,a])),entries=(data.entries||[]).filter(e=>e.date>=from&&e.date<=to&&e.type!=='apertura');
 let profitCents=0,adjustmentCents=0,directCents=0,exchangeEffectCents=0;const adjustments=[];
 for(const e of entries){
  if(e.revaluation)exchangeEffectCents=treasurySum([exchangeEffectCents,...e.lines.filter(l=>cash.has(l.a)).map(l=>moneyCents(l.d)-moneyCents(l.c))]);
  directCents=treasurySum([directCents,...e.lines.filter(l=>cash.has(l.a)).map(l=>moneyCents(l.d)-moneyCents(l.c))]);
  for(const l of e.lines){const a=accounts.get(l.a),net=moneyCents(l.c)-moneyCents(l.d);if(['ingreso','gasto','costo'].includes(a?.tipo))profitCents=treasurySum([profitCents,net]);else if(!cash.has(l.a)){adjustmentCents=treasurySum([adjustmentCents,net]);adjustments.push({entryId:e.id,account:l.a,amountCents:net,classification:!e.lines.some(l=>cash.has(l.a))&&(a?.sub==='fijo'||a?.sub==='fin'||a?.tipo==='patrimonio')?'no_monetario':a?.sub==='fijo'?'inversion':a?.sub==='fin'||a?.tipo==='patrimonio'?'financiacion':'capital_trabajo'})}}
 }
 const indirectCents=treasurySum([profitCents,adjustmentCents]),differenceCents=treasurySum([directCents,-indirectCents]);
 const investmentCents=treasurySum(adjustments.filter(a=>a.classification==='inversion').map(a=>a.amountCents)),financingCents=treasurySum(adjustments.filter(a=>a.classification==='financiacion').map(a=>a.amountCents)),operatingCents=treasurySum([indirectCents,-investmentCents,-financingCents,-exchangeEffectCents]);
 return {profitCents,adjustmentCents,adjustments,operatingCents,investmentCents,financingCents,exchangeEffectCents,indirectCents,directCents,differenceCents,explanation:differenceCents?'Diferencia entre efectivo y resultado ajustado: revisa asientos descuadrados, cuentas sin clasificación y aperturas excluidas; verifica con tu contador.':'Resultado más variaciones no monetarias, de capital de trabajo, inversión y financiación; aperturas excluidas igual que en el método actual. Verifica con tu contador.'};
}
export function treasuryRateRows(grid,existing=[],baseCurrency='NIO'){
 if(!Array.isArray(grid)||!grid.length||grid.length>1000)throw new AccountingValidationError('Importa de 1 a 1000 tasas.');const seen=new Set(existing.map(r=>r.currency+'-'+r.date));
 return grid.map(row=>{if(!Array.isArray(row)||row.length!==4)throw new AccountingValidationError('Usa fecha, moneda, tasa y fuente sin encabezado.');const [date,currency,rate,source]=row.map(v=>String(v).trim());recurringDay(date);const rateMicros=bankRateMicros(rate),key=currency+'-'+date;if(!['NIO','USD'].includes(currency)||currency===baseCurrency||seen.has(key)||source.length<3||source.length>200)throw new AccountingValidationError('Moneda, fuente o fecha duplicada inválida.');seen.add(key);return {id:key,date,currency,rateMicros,rate:rateMicros/1000000,source,rateDate:date}});
}
export function treasuryDiscountUsed(entries,invoiceId){return treasurySum(invoiceLinkedEntries(entries,invoiceId).filter(e=>e.allocationJournal).flatMap(e=>e.lines).filter(l=>l.a==='4192').map(l=>moneyCents(l.c)-moneyCents(l.d)))}

// Condiciones futuras: descuento financiero sobre la base, sin modificar IVA ni históricos.
export function customerPaymentQuote({balanceCents,baseCents,discountBps=0,date,deadline,alreadyPaid=false}) {
 if(![balanceCents,baseCents,discountBps].every(Number.isSafeInteger)||balanceCents<0||baseCents<0||discountBps<0||discountBps>10000)throw new Error('Condición monetaria inválida.');
 const eligible=!alreadyPaid&&date<=deadline;
 const discountCents=eligible?Math.min(balanceCents,Number((BigInt(baseCents)*BigInt(discountBps)+5000n)/10000n)):0;
 return {balanceCents,discountCents,payableCents:balanceCents-discountCents};
}

// Constancias: suma histórica por fecha de pago, sin recalcular nóminas cerradas.
export function employmentIncomeCents(payrolls,employeeId,from,to){
 let total=0;
 for(const p of payrolls)if(p.employeeId===employeeId&&p.entryId&&p.date>=from&&p.date<=to){const cents=moneyCents(p.gross);if(cents<0||!Number.isSafeInteger(total+cents))throw new AccountingValidationError('Ingreso fuera de rango.');total+=cents}
 return total;
}

// Reparto PEPS: el último consumo recibe el residuo, sin perder centavos.
export function inventoryLineCostCents(quantity,unitCost){return moneyCents(invoiceTotals([{q:quantity,u:unitCost,vatRate:0}]).subtotal)}
export function inventoryShareCents(valueCents,quantity,totalQuantity){
 const q=Math.round(quantity*1e6),total=Math.round(totalQuantity*1e6);
 if(!Number.isSafeInteger(valueCents)||valueCents<0||!Number.isSafeInteger(q)||!Number.isSafeInteger(total)||q<0||total<=0||q>total)throw new AccountingValidationError('Reparto de capas PEPS inválido.');
 return Number((BigInt(valueCents)*BigInt(q)*2n+BigInt(total))/(BigInt(total)*2n));
}
