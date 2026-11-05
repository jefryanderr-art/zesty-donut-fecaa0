'use strict';
// Read-only reports use only the document already projected by server permissions.
const businessInsightsAllowed=actionAllowed;
actionAllowed=function(action,data={}){
 if(['operatingReport','operatingExport','operatingPrint'].includes(action))return permission('facturacion')||permission('ventas');
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
function operatingTable(){return accountingTable(OPERATING_HEADERS,operatingGrid().map(row=>'<tr>'+row.map((value,i)=>'<td>'+(i===11?money(value):esc(value))+'</td>').join('')+'</tr>').join(''));}
ACT.operatingReport=()=>{
 if(!OPERATING_FILTER.from){OPERATING_FILTER.from=today();OPERATING_FILTER.to=today()}
 const f=OPERATING_FILTER,rows=operatingRows(),sum=rows.reduce((n,e)=>n+(e.type==='nota-credito'?-1:1)*Math.round(e.total*100),0)/100;
 main(pageHead('Ventas por atención',`<button class="btn ghost" data-a="operatingExport">Descargar Excel</button><button class="btn ghost" data-a="operatingPrint">Imprimir / PDF</button>`)+notice('Consulta de ventas y notas de crédito autorizadas. Los documentos históricos conservan su contexto vacío. Los totales incluyen impuestos y restan devoluciones; no equivalen a cobros ni utilidad.')+`<form id="operating-filter" class="module-search">`+field('from','Desde',f.from,'date','required')+field('to','Hasta',f.to,'date','required')+field('resource',AcontecProfiles.resourceLabel(CO.businessType),f.resource)+field('responsible','Quién atendió',f.responsible)+selectField('modality','Modalidad',option('','Todas',!f.modality)+option('local','Consumo en el local',f.modality==='local')+option('llevar','Retiro en el local',f.modality==='llevar')+option('domicilio','Envío a domicilio',f.modality==='domicilio'))+`<button class="btn">Filtrar</button></form><p>Total neto mostrado: <b>${money(sum)}</b> · ${rows.length} documentos</p>`+operatingTable());enforceAccessUI();
};
document.addEventListener('submit',event=>{if(event.target.id!=='operating-filter')return;event.preventDefault();const form=event.target;if(v(form,'from')>v(form,'to')){form.elements.to.setCustomValidity('El fin debe ser posterior al inicio.');form.elements.to.reportValidity();form.elements.to.setCustomValidity('');return}form.elements.to.setCustomValidity('');OPERATING_FILTER=Object.fromEntries(Object.keys(OPERATING_FILTER).map(k=>[k,v(form,k)]));ACT.operatingReport()});
ACT.operatingExport=async()=>{
 await loadExportScript('/vendor/xlsx.js?v=cc015130aa8521e7');
 const companyId=CO.id,rows=operatingGrid(),book=XLSX.utils.book_new();
 const grid=[['Empresa',CO.name],['Período',OPERATING_FILTER.from,OPERATING_FILTER.to],['Generado',new Date().toISOString()],OPERATING_HEADERS,...rows];
 const sheet=XLSX.utils.aoa_to_sheet(grid);XLSX.utils.book_append_sheet(book,sheet,'Ventas por atención');
 if(CO.id!==companyId)return;downloadFile(new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'ventas-atencion-'+OPERATING_FILTER.from+'.xlsx');
};
ACT.operatingPrint=()=>{document.getElementById('rcpt')?.remove();document.body.insertAdjacentHTML('beforeend','<article id="rcpt"><h1>'+esc(CO.name)+'</h1><h2>Ventas por atención</h2><p>'+esc(OPERATING_FILTER.from+' — '+OPERATING_FILTER.to)+'</p>'+operatingTable()+'</article>');return printReceiptDocument()};
for(const route of ['ventas','facturacion']){const original=V[route];V[route]=function(){original();if(permission('facturacion')||permission('ventas'))$('#main .accounting-actions,#main .operations-head>div')?.insertAdjacentHTML('beforeend','<button class="btn ghost" data-a="operatingReport">Ventas por atención</button>')}}
