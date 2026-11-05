import {inventoryLineCostCents,serviceCommissionCents,invoiceLinkedEntries,moneyCents} from './accounting-math.mjs?v=1bfa441d13b0456e';
// Cantidades y cotizaciones compartidas: no redondear equivalencias silenciosamente.
export function commerceQuantity(value){const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e6||Math.abs(n*1000-Math.round(n*1000))>1e-7)throw Error('La cantidad debe ser exacta, con hasta tres decimales.');return Math.round(n*1000)/1000}
export function commerceMeasure({quantity=1,factor=1,gross,tare=0}){const f=commerceQuantity(factor);if(!f)throw Error('La equivalencia debe ser positiva.');const net=gross===undefined?commerceQuantity(quantity):commerceQuantity(commerceQuantity(gross)-commerceQuantity(tare));const q=commerceQuantity(net*f);if(!q)throw Error('La cantidad neta debe ser positiva.');return q}
export function commerceUnitCents(unitCents,factor=1){if(!Number.isSafeInteger(unitCents)||unitCents<0||unitCents>99999999900)throw Error('Precio inválido en centavos.');const milli=Math.round(commerceQuantity(factor)*1000);if(milli<=0)throw Error('Equivalencia inválida.');const numerator=BigInt(unitCents)*1000n,divisor=BigInt(milli);if(numerator%divisor!==0n)throw Error('El precio de la presentación no equivale a centavos exactos por unidad base; configura una unidad base menor.');const result=Number(numerator/divisor);if(!Number.isSafeInteger(result)||result>99999999900)throw Error('Precio por unidad fuera de rango.');return result}
export function commerceSupplierNetCents(unitCents,discount){const bps=Math.round(discount*100);if(!Number.isFinite(discount)||discount<0||discount>=100||Math.abs(discount*100-bps)>1e-7)throw Error('El descuento admite hasta dos decimales.');return serviceCommissionCents(unitCents,10000-bps)}
export function commercePromotion(p,q,date){if(!p||p.from>date||p.to<date||q<p.minimum)return 0;if(p.mode==='2x1'){if(!Number.isInteger(q))return 0;return Math.floor(q/2)/q*100}return p.percent}
export function commerceReplenishment({stock,min,max,pending=0}){return stock+pending<min?commerceQuantity(Math.max(0,Math.round((max-stock-pending)*1000)/1000)):0}
export function commerceABC(products,entries,from,to){const amounts=new Map(),quantities=new Map(),last=new Map();for(const e of entries){if(!['venta','nota-credito'].includes(e.type)||e.date>to)continue;for(const i of e.items||[]){const sign=e.type==='venta'?1:-1;if(e.type==='venta'&&(!last.get(i.p)||last.get(i.p)<e.date))last.set(i.p,e.date);if(e.date<from)continue;amounts.set(i.p,(amounts.get(i.p)||0)+sign*inventoryLineCostCents(i.q,i.u));quantities.set(i.p,(quantities.get(i.p)||0)+sign*i.q)}}const rows=products.filter(p=>p.kind!=='service').map(p=>({productId:p.id,name:p.name,amountCents:Math.max(0,amounts.get(p.id)||0),q:Math.round((quantities.get(p.id)||0)*1000)/1000,stock:p.stock,last:last.get(p.id)||'',idleDays:last.get(p.id)?Math.floor((Date.parse(to)-Date.parse(last.get(p.id)))/86400000):null})).sort((a,b)=>b.amountCents-a.amountCents);const total=rows.reduce((n,r)=>n+r.amountCents,0);let cumulative=0;return rows.map(r=>{const share=total?cumulative/total:1;cumulative+=r.amountCents;return {...r,abc:!r.amountCents?'C':share<0.8?'A':share<0.95?'B':'C'}})}
export function commerceRouteCashRows(records,entries,routeId,date){
 const route=records.find(r=>r.id===routeId&&r.module==='rutas'),ids=new Set([...(route?.billed||[]).map(b=>b.entryId),...records.filter(r=>r.kind==='commerce-load'&&r.routeId===routeId).flatMap(r=>r.sales||[])]);
 const linked=new Map();for(const id of ids)for(const e of invoiceLinkedEntries(entries,id)){if(e.date!==date)continue;const old=linked.get(e.id);if(!old)linked.set(e.id,{...e,lines:[...(e.lines||[])]});else if(e.allocationJournal)old.lines.push(...(e.lines||[]));}
 return [...linked.values()].flatMap(e=>{
  let amountCents=0,bankCents=0;
  if(['venta','nota-credito'].includes(e.type)){const sign=e.type==='nota-credito'?-1:1;amountCents=sign*(e.payments||[]).filter(p=>p.method==='efectivo').reduce((s,p)=>s+moneyCents(p.amount),0);bankCents=sign*(e.payments||[]).filter(p=>['transferencia','tarjeta'].includes(p.method)).reduce((s,p)=>s+moneyCents(p.amount),0);}
  else if(e.lines?.some(l=>l.a==='1201'&&l.c>0)){amountCents=e.lines.filter(l=>['1101','1104'].includes(l.a)).reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0);bankCents=e.lines.filter(l=>l.a==='1102').reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0);}
  return amountCents||bankCents?[{entryId:e.allocationJournal?e.id+'@'+routeId:e.id,journalId:e.id,reference:e.reference||e.desc,date,amountCents,bankCents}]:[];
 });
}

export function commerceInstallmentBalances(record,entries){
 const original=entries.find(e=>e.id===record.entryId&&e.type==='venta');if(!original)return [];
 const balance=invoiceLinkedEntries(entries,original.id).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);let applied=Math.max(0,moneyCents(original.creditAmount)-Math.max(0,balance));
 return record.installments.map(i=>{const appliedCents=Math.min(applied,i.amountCents);applied-=appliedCents;return {...i,appliedCents,remainingCents:i.amountCents-appliedCents}});
}
export function commerceOrderPaymentState(record,entries){
 if(!record.entryId)return record.deposit?(record.reserved?'Anticipo completo':'Anticipo parcial'):'Pendiente';const invoice=entries.find(e=>e.id===record.entryId);if(!invoice)return 'Facturado';
 const balance=invoiceLinkedEntries(entries,invoice.id).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);return balance>0?'Saldo por cobrar':'Pagado / saldo aplicado';
}
