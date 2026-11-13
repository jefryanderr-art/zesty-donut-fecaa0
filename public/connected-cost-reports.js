'use strict';
// La API vuelve a validar permisos y sucursal; no consulta ni cambia documentos ajenos.
const connectedCostsAllowed=()=>['costos','contabilidad','gastos','personal','ventas'].every(m=>permission(m));
const ccMoney=n=>n==null?'No calculable':money2(n/100);
function ccName(d,key){
 if(key==='Sin asignar')return key;
 const rows=d==='catalogId'?S.costCatalog:d==='customerId'?S.customers:d==='productId'?S.products:d==='branchId'?(CO.branches||[]):d==='saleId'?S.entries:S.businessRecords||[];
 const r=(rows||[]).find(r=>r.id===key);return r?.name||r?.reference||key;
}
const CC_DIMENSIONS={catalogId:'Costo de catálogo',type:'Fijo / variable',direct:'Directo / indirecto',center:'Centro de costo',eventId:'Estado por evento',businessId:'Proyecto / lote / reserva / contrato',customerId:'Cliente',productId:'Producto',branchId:'Sucursal',saleId:'Margen por factura'};
function ccTable(r,d){
 const previous=r.previous.groups[d]||[];
 const current=r.groups[d],rows=[...current,...previous.filter(p=>!current.some(c=>c.key===p.key)).map(p=>({...p,revenueCents:0,cogsCents:0,costCents:0,allocatedCents:0,resultCents:0}))].filter(x=>x.revenueCents||x.cogsCents||x.costCents||x.allocatedCents||previous.some(p=>p.key===x.key&&(p.costCents||p.cogsCents)));
 return '<h3>'+esc(CC_DIMENSIONS[d])+'</h3>'+accountingTable([CC_DIMENSIONS[d],'Ingresos','Costo de ventas · 5101','Egresos imputados','Indirectos repartidos','Resultado','Egresos mes anterior','Variación'],rows.map(x=>{const p=previous.find(p=>p.key===x.key),before=(p?.costCents||0)+(p?.cogsCents||0);return '<tr><td>'+esc(ccName(d,x.key))+'</td><td>'+ccMoney(x.revenueCents)+'</td><td>'+ccMoney(x.unknownCogs?null:x.cogsCents)+'</td><td>'+ccMoney(x.costCents)+'</td><td>'+ccMoney(x.allocatedCents)+'</td><td>'+ccMoney(x.unknownCogs?null:x.resultCents)+'</td><td>'+ccMoney(before)+'</td><td>'+ccMoney(x.costCents+x.cogsCents-before)+'</td></tr>'}).join(''));
}
function ccSummary(r,compact=false){
 if(!r.hasData)return notice('Sin datos de resultados en el período.')+smallKpi('Costos pendientes de pago al cierre',ccMoney(r.pendingCents));
 const values=[['Ingresos netos del mayor',r.revenueCents],['Costo de ventas · 5101',r.cogsCents],['Utilidad bruta',r.grossCents],['Costos variables de catálogo',r.variableCents],['Costos fijos de catálogo',r.fixedCents],['Gastos del módulo Gastos',r.expensesCents],['Nómina registrada',r.payrollCents],['Depreciación registrada',r.depreciationCents],['Otros egresos del mayor',r.otherCents],['Utilidad operativa contable',r.operatingCents],['Punto de equilibrio · ventas',r.breakEvenCents],['Costos pendientes de pago al cierre',r.pendingCents],['Variación de egresos contra mes anterior completo',r.outgoingsCents-r.previous.outgoingsCents]];
 return '<div class="grid">'+values.filter(([label])=>!compact||['Utilidad operativa contable','Costos pendientes de pago al cierre','Variación de egresos contra mes anterior completo'].includes(label)).map(([label,n])=>smallKpi(label,ccMoney(n))).join('')+smallKpi('Egresos / ingresos',r.costSalesPct==null?'No calculable':esc(r.costSalesPct.toFixed(2)+'%'))+'</div>'+notice('Base: asientos sin IVA acreditable ni cierres; catálogo, gastos, nómina y depreciación se cuentan una sola vez. Para equilibrio se consideran fijos los egresos fuera del catálogo y variables el 5101 y los costos clasificados variables. Es una hipótesis visible de análisis; revisa su clasificación con tu contador. Los importes no operativos que no estén separados en el catálogo permanecen en Otros egresos. Comparación: '+r.previous.from+' / '+r.previous.to+'.');
}
function ccCatalogLedger(r){
 const rows=new Map();for(const e of r.details)for(const a of e.accountAmounts){const key=(e.links.catalogId||'Sin asignar')+'|'+a.account,old=rows.get(key)||{catalogId:e.links.catalogId,account:a.account,amount:0};old.amount+=a.amountCents;rows.set(key,old)}
 return '<h3>Conciliación con el mayor · todos los costos y gastos</h3>'+accountingTable(['Catálogo','Cuenta','Importe','Mayor'],[...rows.values()].filter(x=>x.amount).map(x=>'<tr><td>'+esc(ccName('catalogId',x.catalogId||'Sin asignar'))+'</td><td>'+esc(accName(x.account))+'</td><td>'+ccMoney(x.amount)+'</td><td><button class="lk" data-a="connectedCostLedger" data-id="'+esc(x.account)+'" data-from="'+esc(r.from)+'" data-to="'+esc(r.to)+'">Abrir mayor</button></td></tr>').join(''));
}
function ccEgress(r){
 const canceled=new Set(r.details.filter(e=>e.costId&&r.details.filter(x=>x.costId===e.costId).reduce((n,x)=>n+x.costCents+x.cogsCents,0)===0).map(e=>e.costId));
 return '<h3>Todos los egresos · sin duplicar asientos</h3>'+accountingTable(['Fecha','Documento','Catálogo','Cuenta','Importe sin IVA'],r.details.filter(e=>!canceled.has(e.costId)).flatMap(e=>e.accountAmounts.filter(a=>a.amountCents).map(a=>'<tr><td>'+esc(e.date)+'</td><td>'+esc(e.reference)+'</td><td>'+esc(ccName('catalogId',e.links.catalogId||'Sin asignar'))+'</td><td>'+esc(accName(a.account))+'</td><td>'+ccMoney(a.amountCents)+'</td></tr>')).join(''));
}
function ccPending(r){
 return '<h3>Costos a crédito pendientes al cierre</h3>'+accountingTable(['Comprobante','Proveedor','Vencimiento','Saldo','Acciones'],r.pending.map(x=>'<tr><td>'+esc(x.reference)+'</td><td>'+esc(x.party)+'</td><td>'+esc(x.due)+'</td><td>'+ccMoney(x.balanceCents)+'</td><td>'+(permission('proveedores')&&x.supplierId?actionButton('supplierPayments',x.supplierId,'Ver proveedor'):'')+' '+(routeAllowed('pagar')?'<button class="lk" data-a="nav" data-r="pagar">Cuentas por pagar</button>':'')+'</td></tr>').join(''));
}
async function ccLoad(host,from,to,compact=false,allocation='none'){
 const company=CO.id,branch=CO.branchId,route=R,request=Symbol();host.ccRequest=request;
 try{
  const r=await api('operations?c='+encodeURIComponent(company),'POST',{operation:'connectedCostReport',from,to,allocation});
  if(CO.id!==company||CO.branchId!==branch||R!==route||!host.isConnected||host.ccRequest!==request)return;
  host.innerHTML='<h3>Costos conectados · '+esc(from+' / '+to)+'</h3>'+ccSummary(r,compact)+(compact?ccTable(r,'center'):'<label>Reparto de indirectos sin destino<select data-cc-allocation><option value="none" '+(allocation==='none'?'selected':'')+'>Sin repartir</option><option value="revenue" '+(allocation==='revenue'?'selected':'')+'>Por ingresos netos positivos de cada destino</option></select></label>'+notice('Cada dimensión es una vista alternativa: no sumes sus filas con las de otra dimensión. Los directos conservan sus vínculos. Los ingresos por producto se distribuyen según las líneas confirmadas; el 5101 según los costos históricos de línea. Si faltan costos históricos se muestra No calculable y el saldo permanece Sin asignar. Solo se reparten indirectos sin destino, por ingresos positivos; el resto queda Sin asignar. No se crean asientos. Las anulaciones compensan en su fecha contable; un costo anulado en otro mes conserva su efecto histórico hasta esa fecha.')+'<div><button class="btn ghost" data-cc-tab="analysis">Análisis y estados</button> <button class="btn ghost" data-cc-tab="egress">Todos los egresos</button></div><div data-cc-analysis>'+Object.keys(CC_DIMENSIONS).map(d=>ccTable(r,d)).join('')+ccCatalogLedger(r)+ccPending(r)+'</div><div data-cc-egress hidden>'+ccEgress(r)+'</div>');
  host.querySelector('[data-cc-allocation]')?.addEventListener('change',e=>ccLoad(host,from,to,compact,e.target.value));
  for(const button of host.querySelectorAll('[data-cc-tab]'))button.onclick=()=>{host.querySelector('[data-cc-analysis]').hidden=button.dataset.ccTab!=='analysis';host.querySelector('[data-cc-egress]').hidden=button.dataset.ccTab!=='egress'};
 }catch(e){if(host.isConnected&&host.ccRequest===request)host.innerHTML=notice(esc(e.message||'No se pudo consultar el análisis.'))}
}
function appendConnectedCosts(from,to,compact=false){
 const host=document.createElement('section');host.className='card';$('#main')?.append(host);
 if(!connectedCostsAllowed()){host.innerHTML=notice('El análisis completo de costos requiere lectura de Costos, Contabilidad, Gastos, Personal y Ventas para evitar totales incompletos.');return}
 host.innerHTML=notice('Consultando costos conectados…');ccLoad(host,from,to,compact);
}
READ_ACTIONS.add('connectedCostLedger');
const ccActionAllowed=actionAllowed;actionAllowed=function(a,d={}){return a==='connectedCostLedger'?permission('contabilidad'):ccActionAllowed(a,d)};
ACT.connectedCostLedger=d=>{MAY=d.id;if(d.from&&d.to)Object.assign(P,{k:'rango',from:d.from,to:d.to});R='mayor';view()};
for(const route of ['costos','resultados','gastos','dimensiones','rentabilidad','pronostico','panel','analisis']){
 const render=V[route];if(!render)continue;
 V[route]=async function(...args){await render(...args);if(R!==route)return;let [from,to]=rg();if(route==='costos'){from=COST_MONTH+'-01';const d=new Date(from+'T12:00:00Z');to=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)}appendConnectedCosts(from,to,!['costos','resultados','dimensiones','rentabilidad'].includes(route))};
}

const ccDailyBoard=ACT.dailyBoard;ACT.dailyBoard=async function(...args){await ccDailyBoard(...args);appendConnectedCosts(today().slice(0,7)+'-01',today(),true)};
let CC_MATH_PROMISE,CC_MATH;
const ccMath=()=>CC_MATH_PROMISE||=(import('/accounting-math.mjs?v=10d728cb2562503b').then(m=>CC_MATH=m));
const ccBusinessMarkup=businessDetailsMarkup;
businessDetailsMarkup=function(r){
 let html=ccBusinessMarkup(r);if(!CC_MATH||!connectedCostsAllowed())return html;
 const [from,to]=rg(),report=CC_MATH.connectedCostReport(S,from,to),dimension=r.kind==='organization-event'?'eventId':'businessId',row=report.groups[dimension].find(x=>x.key===r.id);
 html+='<h4>Resultado contable · '+esc(from+' / '+to)+'</h4>';
 return html+(row?accountingTable(['Ingresos asociados','Costo de ventas','Costos y gastos asociados','Resultado'], '<tr><td>'+ccMoney(row.revenueCents)+'</td><td>'+ccMoney(row.cogsCents)+'</td><td>'+ccMoney(row.costCents)+'</td><td>'+ccMoney(row.resultCents)+'</td></tr>'):notice('Sin datos contables vinculados en el período.'));
};
for(const a of ['businessDetails','businessPrint']){const original=ACT[a];ACT[a]=async function(d){if(connectedCostsAllowed())await ccMath();return original(d)}}

for(const route of ['indicadores_financieros','notas_financieras','tableros_rol']){const render=V[route];V[route]=async function(...args){await render(...args);if(R!==route||!FA_REPORTS[route]?.enabled)return;const period=FA_PERIODS[route]||{from:today().slice(0,4)+'-01-01',to:today()};appendConnectedCosts(period.from,period.to,true)}}
