export class AccountingValidationError extends Error { constructor(message){super(message);this.publicMessage=message;this.status=422;} }
// Cálculos puros en centavos; usados por Functions y por las verificaciones de la plataforma.
export function moneyCents(value){const n=Number(value),c=Math.round(n*100);if(!Number.isFinite(n)||!Number.isSafeInteger(c)||Math.abs(n*100-c)>0.000001)throw new AccountingValidationError('Usa importes seguros con un máximo de dos decimales.');return c}
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
 const balances=new Map();for(const e of entries.filter(e=>e.date<=year+'-12-31'))for(const l of e.lines||[])balances.set(l.a,(balances.get(l.a)||0)+moneyCents(l.d)-moneyCents(l.c));
 const lines=[];let result=0;for(const account of accounts.filter(a=>['ingreso','gasto','costo'].includes(a.tipo))){const net=balances.get(account.code)||0;if(net){lines.push({a:account.code,d:net<0?-net/100:0,c:net>0?net/100:0});result+=net}}
 if(result)lines.push({a:'3102',d:result>0?result/100:0,c:result<0?-result/100:0});return lines;
}
export function aging(entries,account,asOf){
 const receivable=account==='1201',buckets=[0,0,0,0,0];const rows=[];
 for(const entry of entries.filter(e=>e.date<=asOf&&e.lines?.some(l=>l.a===account&&(receivable?l.d:l.c)>0)&&e.pay===account)){
  const linked=entries.filter(e=>e.date<=asOf&&(e.id===entry.id||e.invoiceId===entry.id));const cents=linked.reduce((sum,e)=>sum+e.lines.filter(l=>l.a===account).reduce((s,l)=>s+(receivable?moneyCents(l.d)-moneyCents(l.c):moneyCents(l.c)-moneyCents(l.d)),0),0);
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
 for(const row of requested||[]){const q=Number(row.q);if(!Number.isFinite(q)||q<0||Math.abs(q*1e6-Math.round(q*1e6))>1e-5)throw new AccountingValidationError('Cantidad a devolver inválida.');wanted.set(row.p,(wanted.get(row.p)||0)+q)}
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
