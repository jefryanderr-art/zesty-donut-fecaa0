'use strict';
// Read-only reports use only the document already projected by server permissions.
const businessInsightsAllowed=actionAllowed;
actionAllowed=function(action,data={}){
 if(['operatingReport','operatingExport','operatingPrint','dailyBoard','dailyBoardExport','dailyBoardPrint'].includes(action))return permission('facturacion')||permission('ventas');
 if(action==='dailyBoardGoal')return !!CO.owner&&!!CO.branchId&&permission('ajustes',true)&&!CO.support&&!CO.readOnlyLimit;
 return businessInsightsAllowed(action,data);
};
for(const action of ['operatingReport','operatingExport','operatingPrint'])READ_ACTIONS.add(action);
let OPERATING_FILTER={from:'',to:'',resource:'',responsible:'',modality:''};
function operatingRows(){
 const f=OPERATING_FILTER,contains=(value,query)=>normalizeSearch(value||'').includes(normalizeSearch(query));
 return S.entries.filter(e=>['venta','nota-credito'].includes(e.type)&&e.date>=f.from&&e.date<=f.to&&contains(e.saleContext?.resource,f.resource)&&contains(e.saleContext?.responsible,f.responsible)&&(!f.modality||e.saleContext?.modality===f.modality));
}
function operatingGrid(){return operatingRows().map(e=>[e.date,e.reference,e.type,e.party,e.branchId||'principal',e.saleContext?.resourceLabel||'',e.saleContext?.resource||'',e.saleContext?.responsible||'',({local:'Consumo en el local',llevar:'Retiro en el local',domicilio:'Envío a domicilio'})[e.saleContext?.modality]||'',e.saleContext?.ticket||'',e.saleContext?.sourceName||'',e.type==='nota-credito'?-e.total:e.total]);}
const OPERATING_HEADERS=['Fecha','Documento','Tipo','Cliente','Sucursal','Recurso: etiqueta','Recurso','Atendió','Modalidad','Ticket','Origen','Total neto'];
function operatingTable(){return accountingTable(OPERATING_HEADERS,operatingGrid().map(row=>'<tr>'+row.map((value,i)=>'<td>'+(i===11?money2(value):esc(value))+'</td>').join('')+'</tr>').join(''));}
ACT.operatingReport=()=>{
 if(!OPERATING_FILTER.from){OPERATING_FILTER.from=today();OPERATING_FILTER.to=today()}
 const f=OPERATING_FILTER,rows=operatingRows(),sum=rows.reduce((n,e)=>n+(e.type==='nota-credito'?-1:1)*Math.round(e.total*100),0)/100;
 main(pageHead('Ventas por atención',`<button class="btn ghost" data-a="operatingExport">Descargar Excel</button><button class="btn ghost" data-a="operatingPrint">Imprimir / PDF</button>`)+notice('Consulta de ventas y notas de crédito autorizadas. Los documentos históricos conservan su contexto vacío. Los totales incluyen impuestos y restan devoluciones; no equivalen a cobros ni utilidad.')+`<form id="operating-filter" class="module-search">`+field('from','Desde',f.from,'date','required')+field('to','Hasta',f.to,'date','required')+field('resource',AcontecProfiles.resourceLabel(businessOperationalType()),f.resource)+field('responsible','Quién atendió',f.responsible)+selectField('modality','Modalidad',option('','Todas',!f.modality)+option('local','Consumo en el local',f.modality==='local')+option('llevar','Retiro en el local',f.modality==='llevar')+option('domicilio','Envío a domicilio',f.modality==='domicilio'))+`<button class="btn">Filtrar</button></form><p>Total neto mostrado: <b>${money2(sum)}</b> · ${rows.length} documentos</p>`+operatingTable());enforceAccessUI();
};
document.addEventListener('submit',event=>{if(event.target.id!=='operating-filter')return;event.preventDefault();const form=event.target;if(v(form,'from')>v(form,'to')){form.elements.to.setCustomValidity('El fin debe ser posterior al inicio.');form.elements.to.reportValidity();form.elements.to.setCustomValidity('');return}form.elements.to.setCustomValidity('');OPERATING_FILTER=Object.fromEntries(Object.keys(OPERATING_FILTER).map(k=>[k,v(form,k)]));ACT.operatingReport()});
ACT.operatingExport=async()=>{
 await loadExportScript('/vendor/xlsx.js?v=cc015130aa8521e7');
 const companyId=CO.id,rows=operatingGrid(),book=XLSX.utils.book_new();
 const grid=[['Empresa',CO.name],['Período',OPERATING_FILTER.from,OPERATING_FILTER.to],['Generado',new Date().toISOString()],OPERATING_HEADERS,...rows];
 const sheet=formatSpreadsheetNumbers(XLSX.utils.aoa_to_sheet(grid));XLSX.utils.book_append_sheet(book,sheet,'Ventas por atención');
 if(CO.id!==companyId)return;downloadFile(new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'ventas-atencion-'+OPERATING_FILTER.from+'.xlsx');
};
ACT.operatingPrint=()=>{document.getElementById('rcpt')?.remove();document.body.insertAdjacentHTML('beforeend','<article id="rcpt"><h1>'+esc(CO.name)+'</h1><h2>Ventas por atención</h2><p>'+esc(OPERATING_FILTER.from+' — '+OPERATING_FILTER.to)+'</p>'+operatingTable()+'</article>');return printReceiptDocument()};
for(const route of ['ventas','facturacion']){const original=V[route];V[route]=function(){original();if(permission('facturacion')||permission('ventas'))$('#main .accounting-actions,#main .operations-head>div')?.insertAdjacentHTML('beforeend','<button class="btn ghost" data-a="operatingReport">Ventas por atención</button>')}}

// El tablero deriva los datos ya autorizados; no emite documentos ni reserva stock.
function dailyBoardData(){
 const day=today(),date=new Date(day+'T00:00:00Z'),previous=new Date(date);previous.setUTCDate(previous.getUTCDate()-1);
 const month=day.slice(0,7)+'-01',previousStart=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1));
 const lastPrevious=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),0));
 const previousEnd=new Date(previousStart);previousEnd.setUTCDate(Math.min(date.getUTCDate(),lastPrevious.getUTCDate()));
 const priorStart=previousStart.toISOString().slice(0,10),priorEnd=previousEnd.toISOString().slice(0,10),priorDay=previous.toISOString().slice(0,10);
 const sum=(from,to)=>S.entries.filter(entry=>['venta','nota-credito'].includes(entry.type)&&entry.date>=from&&entry.date<=to).reduce((total,entry)=>total+(entry.type==='nota-credito'?-1:1)*Math.round(entry.total*100),0)/100;
 const sales=sum(day,day),yesterday=sum(priorDay,priorDay),monthSales=sum(month,day),priorMonth=sum(priorStart,priorEnd);
 const count=S.entries.filter(entry=>entry.type==='venta'&&entry.date===day).length;
 const canAccount=permission('contabilidad')||permission('finanzas');
 const debt=canAccount?invoices(true).filter(entry=>entry.date<=day).map(entry=>({entry,balance:invoiceBalance(entry)})).filter(row=>row.balance>0):[];
 const alerts=[],add=(type,name,detail,route)=>alerts.push([type,name,detail,route]);
 if(permission('inventario'))for(const product of S.products)if(product.kind!=='service'&&product.stock<=product.min)add('Inventario bajo',product.name,formatQuantity(product.stock)+' '+(product.unit||'unidad')+' · mínimo '+formatQuantity(product.min),'productos');
 const until=new Date(date);until.setUTCDate(until.getUTCDate()+30);const expiryEnd=until.toISOString().slice(0,10);
 if(permission('lotes'))for(const record of S.businessRecords||[])if(record.module==='lotes'&&record.status==='Disponible'&&record.q>0&&record.due&&record.due<=expiryEnd)add(record.due<day?'Lote vencido':'Vence en 30 días',record.name,record.due+' · '+formatQuantity(record.q),'lotes');
 if(permission('agenda'))for(const record of S.businessRecords||[])if(record.module==='agenda'&&(record.start?iso(new Date(record.start)):record.date)===day&&!['Atendida','Cancelada','Finalizada'].includes(record.status))add('Cita del día',record.name,(record.start||record.date)+' · '+(record.responsible||record.resource||record.status),'agenda');
 for(const row of debt)if((row.entry.due||row.entry.date)<day)add('Cuenta vencida',row.entry.party||row.entry.reference,(row.entry.reference||row.entry.id)+' · '+money(row.balance)+' · '+(row.entry.due||row.entry.date),'cobrar');
 const goal=CO.branchId?(S.cfg.operatingDailyGoals||[]).find(goal=>goal.branchId===CO.branchId)?.targetCents:null;
 const metrics=[['Ventas netas de hoy',sales],['Ventas netas de ayer',yesterday],['Variación diaria',r2(sales-yesterday)],['Ventas del mes a hoy',monthSales],['Mes anterior, mismo tramo ('+priorStart+' a '+priorEnd+')',priorMonth],['Variación mensual',r2(monthSales-priorMonth)],['Facturas de hoy',count],['Ticket promedio neto de devoluciones',count?r2(sales/count):0],...(canAccount?[['Cobros pendientes vinculados',r2(debt.reduce((sum,row)=>sum+row.balance,0))]]:[]),...(goal!=null?[['Meta diaria',goal/100],['Falta para la meta',Math.max(0,r2(goal/100-sales))]]:[])];
 return {day,metrics,alerts,goal,canAccount};
}
function dailyBoardTables(data,links=false){
 return accountingTable(['Indicador','Valor'],data.metrics.map(([label,value])=>'<tr><td>'+esc(label)+'</td><td>'+(label==='Facturas de hoy'?esc(value):money2(value))+'</td></tr>').join(''))+
 '<h3>Alertas y agenda</h3>'+accountingTable(['Tipo','Ficha','Detalle',...(links?['Abrir']:[])],data.alerts.map(([type,name,detail,route])=>'<tr><td>'+esc(type)+'</td><td>'+esc(name)+'</td><td>'+esc(detail)+'</td>'+(links?'<td>'+(routeAllowed(route)?'<button class="lk" data-a="nav" data-r="'+esc(route)+'">Abrir módulo</button>':'')+'</td>':'')+'</tr>').join(''));
}
ACT.dailyBoard=()=>{
 if(!actionAllowed('dailyBoard'))return;
 const data=dailyBoardData();
 main(pageHead('Tablero del día · '+esc(businessProfile().name),'<button class="btn ghost" data-a="dailyBoardExport">Descargar Excel</button><button class="btn ghost" data-a="dailyBoardPrint">Imprimir / PDF</button><button class="btn ghost" data-a="dailyBoardGoal">Configurar meta diaria</button><button class="btn ghost" data-a="nav" data-r="panel">Volver al panel</button>')+
 notice(esc(data.day+' · '+customerAccountScope())+'. Ventas con impuestos, menos notas de crédito; no equivalen a cobros ni utilidad. Solo se incluyen datos autorizados de la sucursal consultada. El mes anterior compara los mismos días transcurridos, hasta su último día disponible. No se generan cobros, descuentos ni asientos al consultar.')+
 (!data.canAccount?notice('Cobros pendientes y cuentas vencidas requieren permiso de Contabilidad o Finanzas.'):'')+
 (data.goal==null?notice('Sin meta configurada para esta sucursal. El dueño puede definir una meta de ventas diaria opcional.'):'')+dailyBoardTables(data,true));enforceAccessUI();
};
ACT.dailyBoardGoal=()=>{
 if(!actionAllowed('dailyBoardGoal'))return;
 const companyId=CO.id,branchId=CO.branchId,previous=(S.cfg.operatingDailyGoals||[]).find(goal=>goal.branchId===branchId);
 modal('Meta diaria de ventas',notice('Meta interna opcional para esta sucursal en '+esc(S.cfg.cur)+'. Cero quita la meta. No cambia precios, descuentos ni facturas.')+field('goal','Meta diaria',previous?previous.targetCents/100:0,'number','required min="0" max="999999999999" step="0.01"'),async form=>{
  if(CO.id!==companyId||CO.branchId!==branchId||!actionAllowed('dailyBoardGoal'))return 'Reabre la configuración en la sucursal actual.';
  const value=Number(v(form,'goal')),targetCents=Math.round(value*100);
  if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(targetCents)||Math.abs(value*100-targetCents)>0.000001)return 'Usa un importe válido con hasta dos decimales.';
  S.cfg.operatingDailyGoals=(S.cfg.operatingDailyGoals||[]).filter(goal=>goal.branchId!==branchId);
  if(targetCents)S.cfg.operatingDailyGoals.push({branchId,targetCents});
  save();if(!await flush())return 'La meta sigue pendiente de guardado; revisa el aviso de sincronización.';ACT.dailyBoard();
 },'Guardar meta');
};
ACT.dailyBoardPrint=()=>{if(!actionAllowed('dailyBoardPrint'))return;const data=dailyBoardData();printBusinessDocument('Tablero del día · '+businessProfile().name,'<p>'+esc(data.day+' · '+customerAccountScope())+'</p><p>Ventas netas de notas de crédito, con impuestos. Comparación mensual al mismo día disponible. Consulta autorizada; no equivale a utilidad ni a cobros.</p>'+dailyBoardTables(data));};
ACT.dailyBoardExport=async()=>{
 if(!actionAllowed('dailyBoardExport'))return;
 const companyId=CO.id,data=dailyBoardData();await loadExportScript('/vendor/xlsx.js?v=cc015130aa8521e7');if(CO.id!==companyId||!actionAllowed('dailyBoardExport'))return;
 const book=XLSX.utils.book_new(),metadata=[['Empresa',CO.name],['Sucursal',customerAccountScope()],['Fecha',data.day],['Moneda',S.cfg.cur],['Generado',new Date().toISOString()],['Criterio','Ventas con impuestos menos notas de crédito; mes anterior al mismo día disponible; solo alcance autorizado.']];
 XLSX.utils.book_append_sheet(book,formatSpreadsheetNumbers(XLSX.utils.aoa_to_sheet([...metadata,['Indicador','Valor'],...data.metrics])),'Tablero');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([...metadata,['Tipo','Ficha','Detalle'],...data.alerts.map(row=>row.slice(0,3))]),'Alertas');
 downloadFile(new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'tablero-'+data.day+'.xlsx');
};
const dailyBoardPanel=V.panel;
V.panel=function(){dailyBoardPanel();if(!CO||HOME||!actionAllowed('dailyBoard'))return;$('#main').insertAdjacentHTML('afterbegin','<section class="card"><h3>Operación de hoy</h3><p>Ventas, comparación, meta y alertas según tus permisos.</p><button class="btn" data-a="dailyBoard">Abrir tablero del día</button></section>');};
