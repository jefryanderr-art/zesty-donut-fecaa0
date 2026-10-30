'use strict';

const OP_ARRAYS=['shifts','cashMovements','pettyFunds','pettyVouchers','cashCounts','costCatalog','costs','suppliers'];
const operationalPrepare=prepareAccounting;
prepareAccounting=function(){operationalPrepare();for(const name of OP_ARRAYS)if(!Array.isArray(S[name]))S[name]=[];S.invoiceSequences||={};for(const account of S.accounts)if(account.code==='1104'||account.code.startsWith('1103-')||['2107','4190','6190'].includes(account.code))if(!PROT.includes(account.code))PROT.push(account.code)};
ACCESS_MODULES.push(['facturacion','Facturación y turnos'],['cajas','Caja general y caja chica'],['costos','Costos'],['proveedores','Cartera de proveedores']);
Object.assign(ROUTE_MODULE,{facturacion:'facturacion',caja:'cajas',cajachica:'cajas',reportescaja:'cajas',costos:'costos',proveedores:'proveedores'});
Object.assign(ACTION_MODULE,{openShift:'facturacion',closeShift:'facturacion',creditNote:'facturacion',posAdd:'facturacion',posRemove:'facturacion',posBalance:'facturacion',newSupplier:'proveedores',editSupplier:'proveedores',supplierPayments:'proveedores',cashIn:'cajas',cashOut:'cajas',bankDeposit:'cajas',cashCount:'cajas',newFund:'cajas',newVoucher:'cajas',replenishFund:'cajas',reverseCash:'cajas',newCostCatalog:'costos',editCostCatalog:'costos',recordCost:'costos',reverseCost:'costos',advanceCreate:'fiscal'});
for(const action of ['searchApply','searchClear','shiftDetails','downloadOperationReceipt','costMonth','suppliersSearch'])READ_ACTIONS.add(action);
MENU[0][1].splice(1,0,['facturacion','▤','Facturación']);
MENU[0][1].push(['proveedores','🏢','Cartera de proveedores'],['costos','◫','Costos']);
MENU.splice(1,0,['Tesorería',[['caja','↔','Caja general'],['cajachica','▣','Caja chica'],['reportescaja','▥','Reportes de caja']]]);
const isSupervisor=()=>CO.owner||String(CO.role).toLowerCase()==='supervisor';
const isCashManager=()=>CO.owner||['contador','supervisor'].includes(String(CO.role).toLowerCase());
const operatorIdentity=()=>CO.memberId||U.email;
const operationalRouteAllowed=routeAllowed;
routeAllowed=function(route){if(['caja','reportescaja'].includes(route)&&!isCashManager())return false;return operationalRouteAllowed(route)};
const previousActionAllowed=actionAllowed;
actionAllowed=function(action,data={}){
  if(['operatingSettings','operatingCostSettings','seriesAdd','seriesRemove','advanceSettings'].includes(action))return !!CO?.owner;
  if(['creditNote','reverseCash','reverseCost','reverseLegacyCash','regularizeFund','voidVoucher'].includes(action)&&!isSupervisor())return false;
  if(['cashIn','cashOut','bankDeposit','cashCount','newFund','replenishFund'].includes(action)&&!isCashManager()&&!(action==='cashCount'&&S.pettyFunds.some(fund=>fund.id===data.id&&fund.responsible===operatorIdentity())))return false;
  if(['delentry','editventa','editcompra','editgasto'].includes(action)){const entry=S?.entries.find(record=>record.id===data.id);if(entry&&(entry.managed||entry.type==='venta'||entry.lines?.some(line=>['1101','1102','1104'].includes(line.a)||line.a.startsWith('1103-'))))return false}
  if(action==='venta')return permission('facturacion',true);
  return previousActionAllowed(action,data);
};
async function operate(operation,body={}){
  if(Array.isArray(body.items))body={...body,items:body.items.filter(item=>!['creditNote','purchaseReturn'].includes(operation)||Number(item.q)!==0).map(item=>Object.hasOwn(item,'q')?{...item,q:inputQuantity(item.q)}:item)};
  if(operationInFlight)return operationInFlight;
  const signature=JSON.stringify({operation,body});
  if(pendingCloudOperation&&pendingCloudOperation.signature!==signature)throw new Error('Primero reintenta la operación pendiente para confirmar si se guardó.');
  if(!pendingCloudOperation){
    if(!await flush())throw new Error('Hay cambios sin guardar. Resuélvelos antes de continuar.');
    pendingCloudOperation={signature,operation,body:copyCloud(body),companyId:CO.id,base:copyCloud(S),request:{...copyCloud(body),operation,revision:REV,operationId:crypto.randomUUID()}};
  }
  operationInFlight=(async()=>{
    const pending=pendingCloudOperation;
    for(let attempt=0;attempt<=6;attempt++){
      try{
        setSt('Guardando operación…');
        let result=await api('operations?c='+pending.companyId,'POST',pending.request);
        if(result.replayed){const current=await api('data?c='+pending.companyId);result={...result,data:current.data,revision:current.revision}}
        if(CO.id!==pending.companyId)throw new Error('La empresa cambió durante la operación.');
        const edits=AcontecSync.diff(pending.base,S),merged=AcontecSync.apply(result.data,edits);
        REV=result.revision;pendingCloudOperation=null;cloudSupportCode='';
        if(merged.conflicts.length){cloudConflict={data:result.data,revision:REV};setSt('Sin guardar · Revisa los registros modificados durante la operación.');return result}
        S=merged.data;cloudBase=copyCloud(result.data);prepareAccounting();setSt(saveVersion===savedVersion?'Guardado en la nube':'Sin guardar · Cambios pendientes');
        return {...result,data:S};
      }catch(error){
        cloudSupportCode=error.supportCode||'';
        if([400,403,404,409,413,422].includes(error.status))pendingCloudOperation=null;
        if(error.status===409){
          try{if(await rebaseCloud())pendingCloudOperation={...pending,base:copyCloud(S),request:{...pending.request,revision:REV,operationId:crypto.randomUUID()}}}catch{pendingCloudOperation=pending}
          error.message='La empresa cambió. Revisa los datos y confirma de nuevo; el formulario conserva tus valores.';
        }
        if(error.status===401)sessionExpired=true;
        setSt('Sin guardar · '+(error.status===401?'La sesión venció. Vuelve a ingresar; la operación sigue pendiente.':error.message));
        if(attempt===6||!navigator.onLine||!(error.status===undefined||error.status===0||[408,429,500,502,503,504].includes(error.status)))throw error;
        await new Promise(resolve=>{
          const resume=()=>{clearTimeout(timer);window.removeEventListener('online',resume);resolve()};
          const timer=setTimeout(resume,Math.min(60000,1500*2**attempt)+Math.random()*1000);
          window.addEventListener('online',resume,{once:true});
        });
      }
    }
  })();
  try{return await operationInFlight}finally{operationInFlight=null;setSt(saveStatus);if(!pendingCloudOperation&&!cloudConflict&&!sessionExpired&&saveVersion>savedVersion)setTimeout(flush,0)}
}
async function retryCloudOperation(){
  if(!pendingCloudOperation||operationInFlight||sessionExpired)return;
  const pending=pendingCloudOperation;
  try{await operate(pending.operation,pending.body);if(!HOME)view()}catch{} // Details remain visible in the cloud status.
}
const selectField=(name,label,options)=>`<label>${esc(label)}<select name="${name}">${options}</select></label>`;
const option=(value,label,selected=false)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;
const smallKpi=(label,value,kind='')=>`<div class="card kpi"><small>${esc(label)}</small><b class="${kind}">${value}</b></div>`;
const stateBalance=(account,through='9999')=>r2(S.entries.filter(entry=>entry.date<=through).reduce((total,entry)=>total+(entry.lines||[]).filter(line=>line.a===account).reduce((sum,line)=>sum+line.d-line.c,0),0));
const sourceField=(name='source',selected='1101')=>selectField(name,'Cuenta de origen',option('1101','Caja general',selected==='1101')+option('1102','Banco',selected==='1102'));
const referenceFields=()=>field('date','Fecha',today(),'date','required')+field('reference','Número de comprobante','','text','required maxlength="200"');
const openShifts=()=>S.shifts.filter(shift=>!shift.closedAt&&(shift.operatorId===operatorIdentity()||isSupervisor()));
const shiftLabel=shift=>`Turno de ${String(shift.operatorName||'Usuario').includes('@')?'Usuario':shift.operatorName||'Usuario'} · ${shift.date===today()?'hoy':shift.date} ${new Date(shift.openedAt).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`;
const shiftOptions=selected=>option('','Selecciona un turno')+openShifts().map(shift=>option(shift.id,shiftLabel(shift),shift.id===selected)).join('');
const pillChoices=(name,choices,selected)=>`<div class="invoice-pills" role="group">${choices.map(([value,label])=>`<label><input type="radio" name="${esc(name)}" value="${esc(value)}" ${value===selected?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div>`;
const saleActions=entry=>`<div class="sale-action-menu"><button type="button" class="lk sale-actions-toggle" aria-expanded="false">Acciones</button><div class="sale-actions">${actionButton('discountDetail',entry.id,'Detalle')} ${actionButton('printEntry',entry.id,'Imprimir')} ${isSupervisor()?actionButton('creditNote',entry.id,'Anular'):''}</div></div>`;

const paymentLabels={efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',credito:'Crédito'};
const operationalRound=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const shiftSummary=shift=>{const totals={efectivo:0,tarjeta:0,transferencia:0,credito:0};for(const entry of S.entries.filter(record=>record.shiftId===shift.id&&['venta','nota-credito'].includes(record.type)))for(const payment of entry.payments||[])totals[payment.method]=r2(totals[payment.method]+payment.amount*(entry.type==='nota-credito'?-1:1));return totals};
const pendingVouchers=fund=>S.pettyVouchers.filter(voucher=>voucher.fundId===fund.id&&!voucher.replenishmentId&&!voucher.reversalId);
const fundAvailable=fund=>r2(fund.fixedAmount-pendingVouchers(fund).reduce((total,voucher)=>total+voucher.total,0));
const documentFileField=()=>`<label>Comprobante privado opcional · hasta 1 MB<input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" ${S.cfg.cash?.receiptsEnabled?'':'disabled'}></label>${S.cfg.cash?.receiptsEnabled?'':notice('El dueño puede autorizar adjuntos privados en Configuración de caja. El número de comprobante sigue siendo obligatorio.')}`;
async function formAttachment(form){const file=form.elements.attachment?.files[0];if(!file)return undefined;if(file.size>1048576)throw new Error('El comprobante supera 1 MB.');return {name:file.name,type:file.type,content:await readFileData(file)}}
ACT.downloadOperationReceipt=async data=>{
  const response=await fetch('/api/operation-receipt?c='+CO.id+'&id='+encodeURIComponent(data.id),{credentials:'same-origin'});
  if(!response.ok)throw new Error((await response.json()).error||'No se pudo descargar el comprobante.');
  downloadFile(await response.blob(),'comprobante-'+data.id);
};

const SEARCHES={};
let CASH_BOOK_ACCOUNT='1101';
const SALE_FILTERS={method:'',operator:''};
Object.assign(ACTION_MODULE,{reverseLegacyCash:'cajas',regularizeFund:'cajas',voidVoucher:'cajas'});
READ_ACTIONS.add('supplierPayments');
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function searchPeriod(value){
  const query=normalizeSearch(value).replace(/^fecha:\s*/,''),year=Number(query.match(/\b(?:19|20|21)\d{2}\b/)?.[0]||today().slice(0,4));
  let month=MONTHS.findIndex(name=>new RegExp('^'+name+'(?:\\s+(?:de\\s+)?(?:19|20|21)\\d{2})?$').test(query))+1;
  if(!month&&/^\d{4}-\d{2}$/.test(query))month=Number(query.slice(5));
  if(month>=1&&month<=12){const start=`${year}-${String(month).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);return [start,end]}
  let day=query;if(/^\d{2}\/\d{2}\/\d{4}$/.test(query)){const [date,month,year]=query.split('/');day=`${year}-${month}-${date}`}
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day)return [day,day];
  if(/^\d{4}$/.test(query))return [query+'-01-01',query+'-12-31'];
  return null;
}
function searchBar(placeholder='Factura, fecha o nombre'){
  return `<form class="module-search noprint" id="module-search"><label><span>Buscar</span><input type="search" name="query" value="${esc(SEARCHES[R]||'')}" placeholder="${esc(placeholder)}" autocomplete="off"></label><button class="btn ghost" type="submit">Buscar</button><button class="lk" type="button" data-a="searchClear">Limpiar</button><small id="search-feedback" role="status">${SEARCHES[R]&&searchPeriod(SEARCHES[R])?esc(searchPeriod(SEARCHES[R]).join(' → ')):''}</small></form>`;
}
function matchesEntry(entry,query){if(!query)return true;const period=searchPeriod(query);if(period)return entry.date>=period[0]&&entry.date<=period[1];const words=normalizeSearch(query).replace(/^(nombre|factura):\s*/,'').split(/\s+/);const haystack=normalizeSearch([entry.reference,entry.party,entry.desc,entry.operatorName,entry.actor,entry.documentId,entry.paymentMethod,entry.date,...(entry.items||[]).map(item=>item.name||prod(item.p)?.name)].join(' '));return words.every(word=>haystack.includes(word))}
function matchingEntries(type){const query=SEARCHES[R]||'',[from,to]=rg();return S.entries.filter(entry=>entry.type===type&&(query?matchesEntry(entry,query):entry.date>=from&&entry.date<=to)).filter(entry=>type!=='venta'||((!SALE_FILTERS.method||(entry.payments||[]).some(payment=>payment.method===SALE_FILTERS.method))&&(!SALE_FILTERS.operator||entry.operatorId===SALE_FILTERS.operator))).sort((first,second)=>second.date.localeCompare(first.date))}
const financialSearchRoutes=new Set(['apertura','diario','mayor','balanza','resultados','balance','flujo','auditoria','kardex']);
document.addEventListener('submit',event=>{
  if(event.target.id!=='module-search')return;event.preventDefault();
  const query=v(event.target,'query').trim(),period=searchPeriod(query);
  if(financialSearchRoutes.has(R)&&R!=='kardex'&&query&&!period){$('#search-feedback').textContent='Usa julio 2026, 2026-07, una fecha o un año.';return}
  SEARCHES[R]=query;
  if(period&&!['personal','accesibilidad','cuentas'].includes(R)){P.k='rango';[P.from,P.to]=period}
  if(R==='auditoria')auditPage=0;
  view();
});
ACT.searchClear=()=>{delete SEARCHES[R];if(financialSearchRoutes.has(R)){P.k='mes';P.from=today().slice(0,8)+'01';P.to=today()}if(R==='auditoria')auditPage=0;view()};
function installSearch(){
  if($('#module-search')||!$('#main'))return;
  const searchable=['productos','personal','accesibilidad','cuentas',...financialSearchRoutes];
  if(!searchable.includes(R))return;
  $('#main').insertAdjacentHTML('afterbegin',searchBar(financialSearchRoutes.has(R)?'Mes y año: julio 2026 · o fecha':'Nombre, usuario o código'));
  const query=normalizeSearch(SEARCHES[R]);
  if(query&&!financialSearchRoutes.has(R))for(const row of $$('#main table tbody tr, #main .member-card'))row.hidden=!normalizeSearch(row.textContent).includes(query);
  if(query&&R==='productos'){
    const ids=new Set(S.entries.filter(entry=>matchesEntry(entry,query)).flatMap(entry=>(entry.stock||[]).map(movement=>movement.pid)));
    for(const row of $$('#main table tbody tr')){const id=row.querySelector('[data-id]')?.dataset.id;if(ids.has(id))row.hidden=false}
  }
}
const operationalView=view;
view=function(){
  $('#main')?.classList.remove('billing-sales');operationalView();installSearch();
  if(['ventas','facturacion'].includes(R)){
    const operators=new Map(S.entries.filter(entry=>entry.type==='venta'&&entry.operatorId).map(entry=>[entry.operatorId,entry.operatorName||entry.operatorId]));
    $('#module-search')?.insertAdjacentHTML('beforebegin',`<div class="customer-form-grid noprint">${selectField('saleMethod','Forma de pago',option('','Todas')+Object.entries(paymentLabels).map(([value,label])=>option(value,label,value===SALE_FILTERS.method)).join(''))}${selectField('saleOperator','Cajero / vendedor',option('','Todos')+[...operators].map(([value,label])=>option(value,label,value===SALE_FILTERS.operator)).join(''))}</div>`);
    const notes=matchingEntries('nota-credito');
    $('#main').insertAdjacentHTML('beforeend',`<h3 class="ledger-section">Notas de crédito y devoluciones</h3>`+accountingTable(['Nota','Fecha','Factura original','Motivo','Total','Acciones'],notes.map(note=>`<tr><td>${esc(note.reference)}</td><td>${esc(note.date)}</td><td>${esc(S.entries.find(entry=>entry.id===note.invoiceId)?.reference||note.invoiceId)}</td><td>${esc(note.reason)}</td><td>${money(note.total)}</td><td>${actionButton('printEntry',note.id,'Imprimir nota')}</td></tr>`).join('')));
    $('#main').classList.add('billing-sales');decorateSaleCards();enforceAccessUI();
  }
};
document.addEventListener('change',event=>{
  if(event.target.name==='cashBookAccount'){CASH_BOOK_ACCOUNT=event.target.value;view()}
  if(event.target.name==='saleMethod'){SALE_FILTERS.method=event.target.value;view()}
  if(event.target.name==='saleOperator'){SALE_FILTERS.operator=event.target.value;view()}
});

function decorateSaleCards(){
 for(const menu of document.querySelectorAll('#main .sale-action-menu')){
  const table=menu.closest('table');if(!table||table.classList.contains('sale-table'))continue;
  table.classList.add('sale-table');table.closest('.tw')?.classList.add('sale-table-wrap');table.closest('.card')?.classList.add('sale-table-card');
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent);
  for(const row of table.querySelectorAll('tbody tr'))for(const [index,cell]of [...row.cells].entries())cell.dataset.label=headers[index]||'';
 }
}
document.addEventListener('click',event=>{const button=event.target.closest('.sale-actions-toggle');if(!button)return;const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));button.closest('.sale-action-menu').classList.toggle('is-open',expanded)});
function saleStatus(entry){
 const notes=S.entries.filter(record=>record.type==='nota-credito'&&record.invoiceId===entry.id);
 if(!notes.length)return 'Emitida';
 const sold=new Map(),returned=new Map();for(const item of entry.items||[])sold.set(item.p,(sold.get(item.p)||0)+item.q);
 for(const note of notes)for(const item of note.items||[])returned.set(item.p,(returned.get(item.p)||0)+item.q);
 return sold.size&&[...sold].every(([id,q])=>(returned.get(id)||0)>=q-0.0000001)?'ANULADA':'Devolución parcial';
}
listV=function(type,title,cta,action,extra=''){
  const entries=matchingEntries(type);
  main(pageHead(title,`<button class="btn" data-a="${action}">${esc(cta)}</button> ${pbtn()}`)+extra+searchBar()+pbar()+accountingTable(['Fecha','Factura / detalle','Pago','Base','IVA','Total','Estado','Acciones'],entries.map(entry=>`<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference||entry.id)}<small class="ledger-sub">${esc(entry.party||entry.desc)}${entry.operatorName?'<br>'+esc(entry.operatorName):''}</small></td><td>${esc(entry.payments?entry.payments.map(payment=>paymentLabels[payment.method]).join(' + '):PAY[entry.pay]||'')}</td><td>${money(entry.subtotal??entry.total)}</td><td>${money(entry.vat||0)}</td><td>${money(entry.total)}</td><td>${esc(type==='venta'?saleStatus(entry):'Registrada')}</td><td>${type==='venta'?saleActions(entry):actionButton(type==='compra'?'editcompra':'editgasto',entry.id,'Editar')+' '+actionButton('delentry',entry.id,'Eliminar')}</td></tr>`).join(''))+`<p class="tt">Total mostrado: <b>${money(entries.reduce((total,entry)=>total+entry.total,0))}</b></p>`);
};
V.facturacion=()=>{
  const own=openShifts().find(shift=>shift.operatorId===operatorIdentity()),shifts=S.shifts.slice().sort((first,second)=>second.openedAt.localeCompare(first.openedAt)),entries=matchingEntries('venta');
  main(`<section class="operations-head"><div><span class="section-eyebrow">PUNTO DE TRABAJO</span><h1>Facturación</h1><p>Una factura, un inventario, una contabilidad.</p></div><div class="accounting-actions"><button class="btn" data-a="venta">+ Crear factura</button>${own?`<button class="btn ghost" data-a="closeShift" data-id="${own.id}">Cerrar mi turno</button>`:'<button class="btn ghost" data-a="openShift">Abrir turno</button>'}${CO.owner?'<button class="lk" data-a="operatingSettings">Series y permisos de descuento</button>':''}</div></section>`+`<div class="grid">${smallKpi('Mi turno',own?'Abierto':'Sin abrir',own?'ok':'')}${smallKpi('Fondo inicial',money(own?.opening||0))}${smallKpi('Efectivo esperado',money(own?r2(own.opening+shiftSummary(own).efectivo):0))}${smallKpi('Facturas mostradas',entries.length)}</div>`+notice('Toda venta con pago inmediato necesita un turno abierto, aunque se registre desde Ventas. Las ventas históricas sin turno se conservan y no se suman a cierres nuevos.')+searchBar()+pbar()+accountingTable(['Factura','Fecha','Cliente','Cajero / vendedor','Total','Estado','Acciones'],entries.map(entry=>`<tr><td>${esc(entry.reference||entry.id)}</td><td>${esc(entry.date)}</td><td>${esc(entry.party)}</td><td>${esc(entry.operatorName||'Histórico')}</td><td>${money(entry.total)}</td><td>${esc(saleStatus(entry))}</td><td>${saleActions(entry)}</td></tr>`).join(''))+`<h3 class="ledger-section">Turnos de caja</h3>`+accountingTable(['Apertura','Responsable','Fondo','Estado','Diferencia','Acciones'],shifts.map(shift=>`<tr><td>${esc(shift.date)}</td><td>${esc(shift.operatorName)}</td><td>${money(shift.opening)}</td><td>${shift.closedAt?'Cerrado':'Abierto'}</td><td>${shift.closedAt?money(shift.difference):'—'}</td><td>${actionButton('shiftDetails',shift.id,'Resumen')} ${!shift.closedAt&&(shift.operatorId===operatorIdentity()||isSupervisor())?actionButton('closeShift',shift.id,'Cerrar'):''}</td></tr>`).join('')));
};
ACT.openShift=()=>modal('Apertura de turno',referenceFields()+amountField('opening','Fondo inicial',0)+sourceField()+notice('El fondo se transfiere desde Caja general o Banco. No crea dinero ni ingresos.'),async form=>{await operate('openShift',{date:v(form,'date'),reference:v(form,'reference'),opening:+v(form,'opening'),source:v(form,'source')});view()},'Abrir turno');
ACT.closeShift=data=>{
  const shift=S.shifts.find(record=>record.id===data.id),totals=shiftSummary(shift),expected=r2(shift.opening+totals.efectivo);
  modal('Cierre y arqueo del turno',notice(`${shift.operatorName} · Efectivo esperado: ${money(expected)}. Un supervisor autoriza cualquier sobrante o faltante.`)+accountingTable(['Forma','Ventas netas'],Object.entries(totals).map(([method,total])=>`<tr><td>${paymentLabels[method]}</td><td>${money(total)}</td></tr>`).join(''))+referenceFields()+amountField('counted','Efectivo contado',expected)+selectField('destination','Entrega del efectivo',option('1101','Caja general')+option('1102','Depósito al banco')),async form=>{await operate('closeShift',{id:shift.id,date:v(form,'date'),reference:v(form,'reference'),counted:+v(form,'counted'),destination:v(form,'destination')});view()},'Confirmar cierre');
};
ACT.shiftDetails=data=>{
  const shift=S.shifts.find(record=>record.id===data.id),totals=shift.closedAt?shift.totals:shiftSummary(shift);
  modal('Resumen de turno',notice(`${shift.operatorName} · ${shift.date} · ${shift.closedAt?'Cerrado':'Abierto'}`)+accountingTable(['Concepto','Monto'],[['Fondo inicial',shift.opening],...Object.entries(totals).map(([method,total])=>[paymentLabels[method],total]),['Efectivo esperado',shift.expected??r2(shift.opening+totals.efectivo)],...(shift.closedAt?[['Efectivo contado',shift.counted],['Sobrante / faltante',shift.difference]]:[])].map(([label,total])=>`<tr><td>${esc(label)}</td><td>${money(total)}</td></tr>`).join(''))+notice(shift.closedAt?`Comprobante de entrega: ${shift.closeReference} · Destino: ${shift.destination==='1102'?'Banco':'Caja general'}`:'El resumen cambia con cada factura emitida.'),()=>{},'Cerrar');
};
function posRow(){return `<div class="pos-item"><label>Producto<select name="posProduct" required>${option('','Selecciona un producto')+S.products.map(product=>option(product.id,`${product.name} · ${product.unit||'unidad'} · ${money(product.price)} · ${product.kind==='service'?'Servicio sin inventario':product.stock+' disponibles'}`)).join('')}</select></label>${field('posQuantity','Cantidad',1,'number','required min="0.001" step="any"')}${field('posPrice','Precio unitario',0,'number','required min="0" max="999999999" step="0.01"')}<button class="lk" type="button" data-a="posRemove">Quitar</button></div>`}
function cashDenominations(){
 const currency=String(S.cfg.cur||'C$').toUpperCase();
 if(['C$','NIO','CORDOBA','CÓRDOBA'].includes(currency))return [50,100,200,500,1000];
 if(['$','USD','US$','EUR','€','CAD','AUD'].includes(currency))return [5,10,20,50,100];
 if(['CRC','₡'].includes(currency))return [1000,2000,5000,10000,20000];
 if(['HNL','L'].includes(currency))return [20,50,100,200,500];
 if(['GTQ','Q'].includes(currency))return [10,20,50,100,200];
 if(['MXN','MX$'].includes(currency))return [20,50,100,200,500,1000];
 return [];
}
function updatePosPayments(form,total){
 const selected=[...form.querySelectorAll('[name=usePayment]:checked')].map(i=>i.value);
 form.paymentOrder=(form.paymentOrder||['efectivo']).filter(m=>selected.includes(m));for(const m of selected)if(!form.paymentOrder.includes(m))form.paymentOrder.push(m);
 for(const method of Object.keys(paymentLabels)){const enabled=selected.includes(method),input=form.elements['payment_'+method];input.disabled=!enabled;input.closest('[data-payment]').hidden=!enabled;if(!enabled)input.value=0}
 const last=form.paymentOrder.at(-1);
 if(last&&form.paymentEditing!=='payment_'+last){const rest=selected.filter(m=>m!==last).reduce((sum,m)=>sum+(+v(form,'payment_'+m)||0),0);form.elements['payment_'+last].value=Math.max(0,r2(total-rest))}
 const assigned=selected.reduce((sum,m)=>sum+(+v(form,'payment_'+m)||0),0);
 form.querySelector('#pos-pending').textContent=`Pendiente por asignar: ${money(r2(total-assigned))}`;
 const credit=selected.includes('credito'),customer=customerById(v(form,'customerId'));
 form.querySelector('#pos-due').hidden=!credit;form.elements.due.disabled=!credit;
 const info=form.querySelector('#pos-credit');info.hidden=!credit;
 if(credit){
  if(!customer){info.textContent='Selecciona un cliente real; Cliente general no admite crédito.'}
  else if(form.creditPreview?.customerId===customer.id){const preview=form.creditPreview;info.textContent=`Límite: ${preview.limitCents>0?money(preview.limitCents/100):'Sin límite configurado'} · Crédito disponible: ${preview.availableCents===null?'Sin límite configurado':money(preview.availableCents/100)}`}
  else if(form.creditError?.customerId===customer.id){info.textContent=form.creditError.message}else{info.textContent='Consultando límite y crédito disponible…';loadCustomerCredit(form,customer.id)}
 }
 const cash=selected.includes('efectivo'),net=+v(form,'payment_efectivo')||0;
 form.querySelector('#pos-cash').hidden=!cash;form.elements.cashReceived.disabled=!cash;
 if(!form.receivedEdited)form.elements.cashReceived.value=net;
 form.elements.cashReceived.min=net;
 form.querySelector('#pos-cash-total').textContent=money(net);
 const change=r2((+v(form,'cashReceived')||0)-net);form.querySelector('#pos-change').textContent=change>=0?money(change):`Faltan ${money(-change)}`;
}
async function loadCustomerCredit(form,id){
 if(form.creditRequest===id)return;form.creditRequest=id;
 try{const result=await api('operations?c='+CO.id,'POST',{operation:'customerCredit',customerId:id});if(!form.isConnected||v(form,'customerId')!==id)return;form.creditPreview=result;updatePosPayments(form,+form.dataset.total||0)}
 catch(error){if(form.isConnected&&v(form,'customerId')===id){form.creditError={customerId:id,message:error.message};form.querySelector('#pos-credit').textContent=error.message}}
 finally{if(form.creditRequest===id)form.creditRequest=''}
}
document.addEventListener('input',event=>{const form=event.target.closest('form');if(!form?.querySelector('#pos-cash'))return;form.paymentEditing=event.target.name;if(event.target.name==='cashReceived')form.receivedEdited=true},{capture:true});
document.addEventListener('change',event=>{const form=event.target.closest('form');if(!form?.querySelector('#pos-cash'))return;if(event.target.name==='usePayment'){form.paymentEditing='';previewPos(form)}},{capture:true});
document.addEventListener('click',event=>{const button=event.target.closest('[data-cash]');if(!button)return;const form=button.closest('form');form.receivedEdited=button.dataset.cash!=='exact';form.elements.cashReceived.value=button.dataset.cash==='exact'?v(form,'payment_efectivo'):button.dataset.cash;form.paymentEditing='cashReceived';previewPos(form)});
function saleConfirmation(id){
 const entry=S.entries.find(e=>e.id===id);if(!entry)return;
 $('#main .sale-confirmation')?.remove();
 $('#main').insertAdjacentHTML('afterbegin',`<section class="card sale-confirmation" role="status"><strong>Factura emitida · ${esc(entry.reference)}</strong><div class="sale-actions">${actionButton('printEntry',id,'Imprimir')}<button type="button" class="lk" data-a="venta">Nueva venta</button></div></section>`);if(!$('#main [name=barcodeSearch]')){$('#main').insertAdjacentHTML('afterbegin',scanInput());bindScan($('#main'))}enforceAccessUI();focusScan($('#main'));
}
function previewPos(form){
  const discount=form.discountAuthorization?(+v(form,'discount')||0):0,items=[...form.querySelectorAll('.pos-item')].map(row=>({product:prod(row.querySelector('[name=posProduct]').value),quantity:Math.round(+row.querySelector('[name=posQuantity]').value*1000)/1000,price:+row.querySelector('[name=posPrice]').value}));
  let subtotal=0,vat=0;for(const {product,quantity,price} of items)if(product&&quantity>0&&Number.isFinite(price)&&price>=0){const base=operationalRound(operationalRound(price*(1-discount/100))*quantity);subtotal+=base;vat+=operationalRound(base*(product.vatRate||0)/100)}
  const total=operationalRound(operationalRound(subtotal)+operationalRound(vat));form.dataset.total=total;form.querySelector('#pos-total').innerHTML=`<small>Total a pagar</small><strong>${money(total)}</strong><small>Base ${money(subtotal)} · IVA ${money(vat)}</small>`;if(form.querySelector('[name=usePayment]'))updatePosPayments(form,total);return total;
}
ACT.venta=async()=>{
  const discountPolicy=await api('discounts?c='+CO.id);
  const shifts=openShifts(),own=shifts.find(shift=>shift.operatorId===operatorIdentity()),series=(S.cfg.pos?.series||[{code:'A',name:'Principal',branchId:'principal'}]).filter(record=>(record.branchId||'principal')===CO.branchId),role=CO.owner?'dueno':String(CO.role).toLowerCase(),limit=discountPolicy.maximum;
  const form=modal('Crear factura',field('date','Fecha',today(),'date','required')+selectField('shiftId','Turno de caja',shiftOptions(own?.id))+selectField('series','Serie / sucursal',series.map(record=>option(record.code,`${record.code} · ${record.name||''}`)).join(''))+saleCustomerFields()+'<div id="pos-due" hidden>'+field('due','Vencimiento del crédito',today(),'date','required')+'</div>'+`<div id="pos-items">${posRow()}</div><button class="lk" type="button" data-a="posAdd">+ Agregar producto</button>`+field('discount',`Descuento % · máximo ${limit}%`,0,'number','min="0" max="99" step="0.01" required')+field('discountPassword','Contraseña de autorización','','password','maxlength="128" autocomplete="off"')+'<button type="button" class="lk" data-a="authorizeDiscount">Autorizar descuento</button><p class="discount-feedback" role="status">Todo descuento requiere autorización del dueño.</p>'+`<p id="pos-total" class="pos-total" aria-live="polite"></p><h4>Formas de pago</h4><div class="invoice-pills">${Object.entries(paymentLabels).map(([method,label])=>`<label><input type="checkbox" name="usePayment" value="${method}" ${method==='efectivo'?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="pos-payments">${Object.entries(paymentLabels).map(([method,label])=>`<div data-payment="${method}">${field('payment_'+method,label,0,'number','min="0" step="0.01" required')}</div>`).join('')}</div><p id="pos-pending" role="status"></p><p id="pos-credit" role="status"></p><section id="pos-cash" class="card"><p>Total · <b id="pos-cash-total"></b></p>${field('cashReceived','Recibido',0,'number','min="0" max="999999999" step="0.01" required')}<p>Cambio a dar · <b id="pos-change" aria-live="polite"></b></p><div class="cash-shortcuts"><button type="button" class="lk" data-cash="exact">Exacto</button>${cashDenominations().map(n=>`<button type="button" class="lk" data-cash="${n}">${money(n)}</button>`).join('')}</div></section><button type="button" class="lk" data-a="posBalance">Completar saldo en efectivo</button>`+'<details class="invoice-info"><summary aria-label="Información sobre precios y descuentos">ⓘ</summary><p>El precio unitario se puede ajustar; el IVA y el costo se validan en el servidor. Las rebajas requieren autorización del dueño. La factura emitida se corrige mediante nota de crédito.</p></details>',async form=>{
    const items=[...form.querySelectorAll('.pos-item')].map(row=>({p:row.querySelector('[name=posProduct]').value,q:inputQuantity(row.querySelector('[name=posQuantity]').value),u:+row.querySelector('[name=posPrice]').value})),payments=Object.keys(paymentLabels).map(method=>({method,amount:+v(form,'payment_'+method)})).filter(payment=>payment.amount>0);
    if(+v(form,'discount')>0&&!form.discountAuthorization)throw new Error('Autoriza el descuento con la contraseña del dueño antes de emitir.');
    const cash=payments.find(p=>p.method==='efectivo')?.amount||0,received=+v(form,'cashReceived');
    if(payments.some(p=>p.method==='credito')&&(!v(form,'customerId')||customerById(v(form,'customerId'))?.name.trim().toLowerCase()==='cliente general'))throw new Error('Selecciona un cliente real para el crédito.');
    if(cash&&received<cash)throw new Error('El recibido debe cubrir el efectivo de la venta.');
    const result=await operate('sale',{...(cash?{cashTender:{receivedCents:Math.round(received*100),changeCents:Math.round(received*100)-Math.round(cash*100)}}:{}),serialIds:[...form.querySelectorAll('[name=businessSerial]:checked')].map(i=>i.value),date:v(form,'date'),shiftId:v(form,'shiftId'),series:v(form,'series'),customerId:v(form,'customerId'),party:v(form,'party'),due:v(form,'due'),discount:+v(form,'discount'),discountAuthorization:form.discountAuthorization||'',sourceQuotation:form.dataset.quotationId||'',items,payments,origin:R==='ventas'?'ventas':'facturacion'});view();setTimeout(()=>focusScan($('#main')),0);setSt('Factura emitida · '+(S.entries.find(entry=>entry.id===result.id)?.reference||''));setTimeout(()=>saleConfirmation(result.id),0);
  },'Emitir factura y registrar asiento');
  form.addEventListener('input',event=>{if(['discount','posProduct','posQuantity','posPrice'].includes(event.target.name)){form.discountAuthorization='';form.querySelector('.discount-feedback').textContent='Autoriza el descuento después de revisar productos y precios.'}previewPos(form)});form.addEventListener('change',event=>{form.paymentEditing='';if(event.target.name==='posProduct'){const row=event.target.closest('.pos-item');row.querySelector('[name=posPrice]').value=prod(event.target.value)?.price??0}if(event.target.name==='customerId'){form.creditError=null;const customer=customerById(v(form,'customerId'));if(customer){form.elements.party.value=customer.name;const due=new Date(v(form,'date')+'T12:00:00');due.setDate(due.getDate()+customer.creditDays);form.elements.due.value=iso(due)}}updateSaleCustomer(form);previewPos(form)});previewPos(form);
};
ACT.posAdd=(data,button)=>{const form=button.closest('form');form.querySelector('#pos-items').insertAdjacentHTML('beforeend',posRow());form.discountAuthorization='';previewPos(form)};
ACT.posRemove=(data,button)=>{const form=button.closest('form');button.closest('.pos-item').remove();form.discountAuthorization='';previewPos(form)};
ACT.posBalance=(data,button)=>{const form=button.closest('form');form.querySelector('[name=usePayment][value=efectivo]').checked=true;form.paymentOrder=(form.paymentOrder||[]).filter(m=>m!=='efectivo').concat('efectivo');const total=previewPos(form),other=['tarjeta','transferencia','credito'].reduce((sum,method)=>sum+(+v(form,'payment_'+method)||0),0);form.elements.payment_efectivo.value=Math.max(0,r2(total-other));updatePosPayments(form,total)};
ACT.editventa=()=>{throw new Error('Las facturas emitidas se corrigen mediante nota de crédito.')};
ACT.creditNote=async data=>{
  const math=await import('/accounting-math.mjs?v=57fe6cfecc1bbe03');
  const entry=S.entries.find(record=>record.id===data.id),grouped=new Map();for(const item of entry.items||[])if(!grouped.has(item.p))grouped.set(item.p,{...item,q:0});for(const item of entry.items||[])grouped.get(item.p).q+=item.q;
  for(const note of S.entries.filter(record=>record.type==='nota-credito'&&record.invoiceId===entry.id))for(const item of note.items||[])if(grouped.has(item.p))grouped.get(item.p).q-=item.q;
  const items=[...grouped.values()].filter(item=>item.q>0.000001);
  if(!items.length)throw new Error('Esta factura ya se devolvió completamente.');
  const shifts=openShifts(),own=shifts.find(s=>s.operatorId===operatorIdentity())||shifts[0];
  const form=modal('Anular factura',notice(`${esc(entry.reference||entry.id)} · ${esc(entry.party)}. El supervisor autoriza esta operación.`)+field('date','Fecha',today(),'date','required')+pillChoices('returnMode',[['total','Anulación total'],['partial','Devolución parcial']],'total')+'<h4>Motivo</h4>'+pillChoices('reasonCategory',[['el cliente no la compró','El cliente no la compró'],['error de precio','Error de precio'],['devolución','Devolución'],['otro','Otro']],'el cliente no la compró')+'<div id="return-detail" hidden>'+field('reason','Detalle del motivo','','text','maxlength="1000"')+'</div><div id="return-quantities" hidden>'+items.map(item=>`<label>${esc(item.name||prod(item.p)?.name)} · pendiente ${esc(formatQuantity(item.q))}<input name="return_${esc(item.p)}" type="number" min="0" max="${formatQuantity(item.q)}" step="any" value="${formatQuantity(item.q)}" required></label>`).join('')+'</div>'+(entry.businessVariants?.length?'<h4>Series devueltas</h4>'+entry.businessVariants.filter(s=>S.businessRecords?.some(r=>r.id===s.id&&r.status==='Vendida')).map(s=>`<label class="ck"><input type="checkbox" name="returnSerial_${esc(s.id)}" checked> ${esc(s.serial)}</label>`).join(''):'')+'<p id="return-summary" class="card" aria-live="polite"></p><div id="return-refund"><h4>Devolución del dinero</h4>'+pillChoices('refundMethod',[['efectivo','Efectivo'],['tarjeta','Tarjeta'],['transferencia','Transferencia']],'efectivo')+(shifts.length>1?selectField('shiftId','Turno de devolución',shiftOptions(own?.id)):`<input type="hidden" name="shiftId" value="${esc(own?.id||'')}"><p>${esc(own?shiftLabel(own):'Abre tu turno para devolver dinero.')}</p>` )+'</div>',async form=>{form.returnSubmitting=true;try{await operate('creditNote',{returnSerialIds:(entry.businessVariants||[]).filter(s=>v(form,'returnMode')==='total'?S.businessRecords?.some(r=>r.id===s.id&&r.status==='Vendida'):form.elements['returnSerial_'+s.id]?.checked).map(s=>s.id),id:entry.id,date:v(form,'date'),reasonCategory:v(form,'reasonCategory'),reason:v(form,'reasonCategory')==='otro'?v(form,'reason'):v(form,'reasonCategory'),refundMethod:v(form,'refundMethod'),shiftId:v(form,'shiftId'),items:requested()});view()}finally{form.returnSubmitting=false}},'Autorizar nota de crédito');
  const requested=()=>items.map(item=>({p:item.p,q:v(form,'returnMode')==='total'?item.q:+v(form,'return_'+item.p)}));
  function updateReturn(){
    const partial=v(form,'returnMode')==='partial',other=v(form,'reasonCategory')==='otro';
    form.querySelector('#return-quantities').hidden=!partial;form.querySelector('#return-detail').hidden=!other;form.elements.reason.required=other;form.elements.reason.disabled=!other;
    for(const item of items)form.elements['return_'+item.p].disabled=!partial;
    const summary=form.querySelector('#return-summary');
    try{const notes=S.entries.filter(n=>n.type==='nota-credito'&&n.invoiceId===entry.id),allocation=math.allocateReturnItems(entry.items,notes,requested()),result=math.creditReturnSummary(entry,notes,allocation.items,allocation.finalReturn,S.entries);summary.textContent=`Se reduce la cuenta por cobrar: ${money(result.debtReduction)} · Se devuelve en dinero: ${money(result.refund)}`;form.querySelector('#return-refund').hidden=result.refund===0;form.querySelector('.mf button:last-child').disabled=!!form.returnSubmitting}catch(error){summary.textContent=error.message;form.querySelector('.mf button:last-child').disabled=true}
  }
  form.addEventListener('input',updateReturn);form.addEventListener('change',updateReturn);updateReturn();
};
printRcpt=function(entry){
  const logo=S.cfg.pos?.logo||'',note=entry.type==='nota-credito';
  $('#rcpt')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="rcpt" class="invoice-print">${logo?`<img class="invoice-logo" src="${esc(logo)}" alt="Logo de ${esc(CO.name)}">`:''}${rh(note?'Nota de crédito':'Factura / ticket',esc(entry.date))}<p>Número: <b>${esc(entry.reference||entry.id)}</b><br>Cliente: ${esc(entry.party)}${entry.customer?.taxId?'<br>RUC: '+esc(entry.customer.taxId):''}<br>Cajero / vendedor: ${esc(entry.operatorName||entry.actor||'')}${entry.reason?'<br>Motivo: '+esc(entry.reason):''}</p><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Precio</th><th>IVA %</th><th>Base</th></tr></thead><tbody>${(entry.items||[]).map(item=>`<tr><td>${esc(item.name||prod(item.p)?.name||'Producto')}</td><td>${esc(formatQuantity(item.q))}</td><td>${esc(item.unit||'unidad')}</td><td>${money(item.u)}</td><td>${esc(item.vatRate||0)}</td><td>${money(r2(item.q*item.u))}</td></tr>`).join('')}</tbody></table><p>Descuento: ${esc(entry.discount||0)}%${entry.discountAudit?`<br>Monto descontado (IVA incluido): ${money(entry.discountAudit.amountCents/100)}<br>Autorización: ${esc(entry.discountAudit.actor)} · ${esc(entry.discountAudit.at)}`:''}<br>Base: ${money(entry.subtotal??entry.total)}<br>IVA: ${money(entry.vat||0)}<br><b>Total: ${money(entry.total)}</b></p><p>${(entry.payments||[]).map(payment=>`${paymentLabels[payment.method]}: ${money(payment.amount)}`).join('<br>')||esc(PAY[entry.pay]||'')}${entry.creditAmount?'<br>Vencimiento: '+esc(entry.due):''}</p><small>Conserva este comprobante. La autorización fiscal de la numeración depende de la normativa aplicable.</small></div>`);
  const image=$('#rcpt img');const run=()=>{document.body.classList.add('rc');const done=()=>{document.body.classList.remove('rc');$('#rcpt')?.remove();removeEventListener('afterprint',done)};addEventListener('afterprint',done);print()};if(image&&!image.complete){image.onload=run;image.onerror=run}else run();
};
ACT.printEntry=data=>{const entry=S.entries.find(record=>record.id===data.id);if(entry)printRcpt(entry)};

const unitField=(value='unidad')=>field('unit','Unidad de medida',value,'text','required maxlength="40" list="inventory-units"')+`<datalist id="inventory-units">${['unidad','quintal','medio quintal','cajón','libra','bolsa','media libra','bolsón','kilogramo','litro'].map(unit=>option(unit,unit)).join('')}</datalist>`+notice('Costo, precio y existencia corresponden a esta unidad. Usa un producto separado por presentación; no se convierten cantidades automáticamente.');
ACT.ajuste=data=>{
  const product=prod(data.id);
  modal('Ajustar existencia: '+esc(product.name),notice(`Existencia actual: ${product.stock} ${product.unit||'unidad'}. Usa cantidades positivas para sumar y negativas para restar.`)+field('date','Fecha',today(),'date','required')+selectField('reason','Motivo del ajuste',option('','Selecciona el motivo')+option('error','Corrección de error de ingreso · sin afectar utilidad')+option('conteo-inicial','Conteo inicial · sin afectar utilidad')+option('merma','Merma / pérdida real · gasto')+option('sobrante','Sobrante real · ingreso'))+field('quantity','Cantidad',0,'number','required step="any"')+field('note','Descripción del ajuste','','text','required maxlength="1000"')+notice('Correcciones y conteo inicial usan la cuenta patrimonial 3191. La merma debita 6107 y acredita inventario. Los asientos anteriores se conservan; revisa con tu contador cualquier reclasificación histórica.'),async form=>{await operate('inventoryAdjustment',{id:product.id,date:v(form,'date'),reason:v(form,'reason'),quantity:+v(form,'quantity'),note:v(form,'note')});view()});
};
productForm=function(product){
  if(!product)return operationalNewProduct();
  modal('Editar producto y costo',field('code','Código',product.code)+field('name','Nombre',product.name,'text','required')+unitField(product.unit||'unidad')+amountField('cost','Costo unitario sin IVA',product.cost)+amountField('price','Precio de venta sin IVA',product.price)+field('minimum','Stock mínimo',product.min,'number','min="0" step="any" required')+field('vat','IVA opcional %',product.vatRate||0,'number','min="0" max="100" step="0.01" required')+barcodeFields(product)+field('date','Fecha de revalorización',today(),'date','required')+notice('Cambiar el costo revaloriza solo la existencia actual, con un asiento contra Otros gastos y mermas. No modifica los costos históricos de facturas emitidas.'),async form=>{await operate('product',{id:product.id,barcodes:readBarcodes(form),code:v(form,'code'),name:v(form,'name'),unit:v(form,'unit').trim(),cost:+v(form,'cost'),price:+v(form,'price'),min:+v(form,'minimum'),vatRate:+v(form,'vat'),date:v(form,'date')});view()});
};
function operationalNewProduct(){
  modal('Nuevo producto',barcodeFields()+field('code','Código')+field('name','Nombre','','text','required')+unitField()+amountField('cost','Costo unitario sin IVA')+field('stock','Existencia inicial',0,'number','min="0" step="any" required')+amountField('price','Precio de venta sin IVA')+field('minimum','Stock mínimo',0,'number','min="0" step="any" required')+field('vat','IVA opcional %',0,'number','min="0" max="100" step="0.01" required'),form=>{
    const quantity=+v(form,'stock'),cost=+v(form,'cost'),record={id:uid(),barcodes:readBarcodes(form),code:v(form,'code'),name:v(form,'name').trim(),unit:v(form,'unit').trim(),cost,stock:quantity,price:+v(form,'price'),min:+v(form,'minimum'),vatRate:+v(form,'vat')};if(!record.name)return 'Escribe un nombre.';S.products.push(record);const total=r2(quantity*cost);if(quantity>0)S.entries.push({id:uid(),date:today(),desc:'Inventario inicial - '+record.name,type:'invini',lines:total?[{a:'1301',d:total,c:0},{a:'3101',d:0,c:total}]:[],stock:[{pid:record.id,q:quantity,unit:record.unit,unitCost:cost}],total});save();view();
  });
}
function supplierFields(entry){return selectField('supplierId','Proveedor de cartera',option('','Proveedor manual')+S.suppliers.filter(supplier=>supplier.active||supplier.id===entry?.supplierId).map(supplier=>option(supplier.id,supplier.name,supplier.id===entry?.supplierId)).join(''))+field('party','Nombre / razón social del proveedor',entry?.party||'','text','required')}
function supplierSnapshot(id){const supplier=S.suppliers.find(record=>record.id===id);return supplier?Object.fromEntries(['name','taxId','phone','email','address','currency','creditDays'].map(key=>[key,supplier[key]])):null}
document.addEventListener('change',event=>{
  if(event.target.name!=='supplierId')return;const form=event.target.closest('form'),supplier=S.suppliers.find(record=>record.id===event.target.value);if(!supplier)return;
  if(form.elements.party)form.elements.party.value=supplier.name;
  const payment=form.elements.py||form.elements.pay;if(payment)payment.value=supplier.paymentType==='credito'?'2101':'1101';
  if(form.elements.due){const start=form.elements.dt?.value||form.elements.date?.value||today(),date=new Date(start+'T12:00:00');date.setDate(date.getDate()+supplier.creditDays);form.elements.due.value=iso(date)}
});
function supplierInvoices(supplier){return invoices(false).filter(entry=>entry.supplierId===supplier.id||(!entry.supplierId&&normalizeSearch(entry.party)===normalizeSearch(supplier.name)))}
V.proveedores=()=>{
  const query=normalizeSearch(SEARCHES[R]),suppliers=S.suppliers.filter(supplier=>!query||normalizeSearch([supplier.name,supplier.taxId,supplier.contact,supplier.phone,supplier.seller].join(' ')).includes(query));
  const pending=invoices(false).reduce((total,entry)=>total+invoiceBalance(entry),0);
  main(pageHead('Cartera de proveedores','<button class="btn" data-a="newSupplier">+ Proveedor</button> '+pbtn())+`<div class="grid">${smallKpi('Proveedores registrados',S.suppliers.length)}${smallKpi('Cuentas por pagar · total empresa',money(pending))}</div>`+searchBar('Nombre, RUC, contacto o vendedor')+accountingTable(['Proveedor','Contacto','Condiciones','Facturado a crédito','Abonado','Pendiente','Estado','Acciones'],suppliers.map(supplier=>{
    const records=supplierInvoices(supplier),debt=r2(records.reduce((total,entry)=>total+invoiceBalance(entry),0)),paid=r2(records.reduce((total,entry)=>total+paidInvoice(entry.id),0)),original=r2(records.reduce((total,entry)=>total+invoicePrincipal(entry),0));
    return `<tr><td>${esc(supplier.name)}<small class="ledger-sub">${esc(supplier.taxId)} · ${supplier.active?'Activo':'Inactivo'}</small></td><td>${esc(supplier.contact)}<small class="ledger-sub">${esc(supplier.phone)}<br>${esc(supplier.email)}</small></td><td>${supplier.paymentType==='credito'?`${supplier.creditDays} días · ${esc(supplier.currency)} ${supplier.creditLimit}`:'Contado'}</td><td>${money(original)}</td><td>${money(paid)}</td><td>${money(debt)}</td><td>${esc(debt<=0?'Cancelado':paid>0?'Abonado':'Pendiente')}</td><td>${actionButton('editSupplier',supplier.id,'Ficha')} ${actionButton('supplierPayments',supplier.id,'Facturas y abonos')}</td></tr>`;
  }).join('')));
};
function supplierForm(supplier){
  modal(supplier?'Ficha del proveedor':'Registrar proveedor',field('name','Nombre o razón social',supplier?.name||'','text','required maxlength="200"')+field('taxId','RUC',supplier?.taxId||'')+field('phone','Teléfono / WhatsApp',supplier?.phone||'','tel')+field('email','Correo',supplier?.email||'','email')+field('address','Dirección',supplier?.address||'')+field('contact','Persona de contacto',supplier?.contact||'')+field('seller','Vendedor asignado',supplier?.seller||'')+selectField('paymentType','Condiciones',option('contado','Contado',supplier?.paymentType!=='credito')+option('credito','Crédito',supplier?.paymentType==='credito'))+amountField('creditLimit','Límite de crédito',supplier?.creditLimit||0)+field('creditDays','Plazo de crédito (días)',supplier?.creditDays||30,'number','min="0" max="3650" step="1" required')+field('currency','Moneda',supplier?.currency||S.cfg.cur,'text','required')+field('notes','Notas internas',supplier?.notes||'')+`<label class="ck"><input name="active" type="checkbox" ${supplier?.active!==false?'checked':''}> Proveedor activo</label>`,async form=>{await operate('supplier',{id:supplier?.id,name:v(form,'name'),taxId:v(form,'taxId'),phone:v(form,'phone'),email:v(form,'email'),address:v(form,'address'),contact:v(form,'contact'),seller:v(form,'seller'),paymentType:v(form,'paymentType'),creditLimit:+v(form,'creditLimit'),creditDays:+v(form,'creditDays'),currency:v(form,'currency'),notes:v(form,'notes'),active:form.elements.active.checked});view()});
}
ACT.newSupplier=()=>supplierForm();ACT.editSupplier=data=>supplierForm(S.suppliers.find(record=>record.id===data.id));

debtView=function(receivable){
  const records=invoices(receivable),principal=records.reduce((total,entry)=>total+invoicePrincipal(entry),0),paid=records.reduce((total,entry)=>total+paidInvoice(entry.id),0),pending=records.reduce((total,entry)=>total+invoiceBalance(entry),0),ledger=stateBalance(receivable?'1201':'2101')*(receivable?1:-1);
  main(pageHead(receivable?'Cuentas por cobrar':'Cuentas por pagar',`<button class="btn" data-a="invoiceOpening" data-side="${receivable?'receive':'pay'}">+ Factura / saldo inicial</button> ${pbtn()}`)+`<div class="grid">${smallKpi('Total original a crédito',money(principal))}${smallKpi('Total abonado',money(paid))}${smallKpi('Total pendiente de facturas',money(pending))}${smallKpi('Saldo en el libro mayor',money(ledger))}</div>`+notice('El saldo del mayor puede incluir aperturas y movimientos históricos sin factura vinculada. Las notas de crédito reducen la deuda; las ventas mixtas incluyen solo su parte a crédito.')+accountingTable(['Factura','Fecha','Vencimiento','Cliente / proveedor','Crédito original','Abonado','Deuda','Estado','Acciones'],records.map(entry=>`<tr><td>${esc(entry.reference||entry.id)}</td><td>${esc(entry.date)}</td><td>${esc(entry.due||entry.date)}</td><td>${esc(entry.party)}</td><td>${money(invoicePrincipal(entry))}</td><td>${money(paidInvoice(entry.id))}</td><td>${money(invoiceBalance(entry))}</td><td>${badge(debtStatus(invoiceBalance(entry),entry.due||entry.date))}</td><td>${invoiceBalance(entry)>0?actionButton('invoicePay',entry.id,receivable?'Cobrar / abonar':'Pagar / abonar'):''} ${actionButton('invoiceHistory',entry.id,'Historial')}</td></tr>`).join(''))+`<p class="tt">Total por ${receivable?'cobrar':'pagar'}: <b>${money(pending)}</b></p>`);
};

V.caja=()=>{
  const query=SEARCHES[R]||'',[from,to]=rg(),entries=S.entries.filter(entry=>(entry.lines||[]).some(line=>line.a===CASH_BOOK_ACCOUNT)&&(query?matchesEntry(entry,query):entry.date>=from&&entry.date<=to)).sort((first,second)=>second.date.localeCompare(first.date));
  main(pageHead('Caja general',`<button class="btn" data-a="cashIn">+ Ingreso</button> <button class="btn ghost" data-a="cashOut">Egreso</button> <button class="btn ghost" data-a="bankDeposit">Depositar al banco</button> <button class="btn ghost" data-a="cashCount">Arqueo</button> ${CO.owner?'<button class="lk" data-a="operatingSettings">Configuración</button>':''}`)+`<div class="grid">${smallKpi('Saldo actual · Caja general',money(stateBalance('1101')))}${smallKpi('Bancos',money(stateBalance('1102')))}${smallKpi('Efectivo en turnos',money(stateBalance('1104')))}</div>`+notice('El libro se obtiene de los mismos asientos del mayor. Los cierres entregados a Caja general aparecen como ingresos; los depósitos al banco son transferencias, no ventas.')+selectField('cashBookAccount','Libro de movimientos',option('1101','Caja general',CASH_BOOK_ACCOUNT==='1101')+option('1102','Banco',CASH_BOOK_ACCOUNT==='1102'))+searchBar('Fecha, comprobante, tercero o concepto')+pbar()+accountingTable(['Fecha','Comprobante','Concepto / tercero','Ingreso','Egreso','Registrado por','Acciones'],entries.map(entry=>{const lines=entry.lines.filter(line=>line.a===CASH_BOOK_ACCOUNT),record=S.cashMovements.find(movement=>movement.entryId===entry.id);return `<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference||entry.id)}</td><td>${esc(entry.desc)}<small class="ledger-sub">${esc(record?.party||entry.party||'')}${record?'<br>'+esc(record.currency)+' · TC '+esc(record.exchangeRate)+' · '+esc(record.method)+'<br>Documento: '+esc(record.documentId||'—')+' · Contrapartida: '+esc(record.debit==='1101'?record.credit:record.debit):''}</small></td><td>${money(lines.reduce((total,line)=>total+line.d,0))}</td><td>${money(lines.reduce((total,line)=>total+line.c,0))}</td><td>${esc(entry.actor||record?.actor||'Histórico')}</td><td>${record?.receipt?actionButton('downloadOperationReceipt',record.id,'Comprobante'):''} ${record&&!record.reversalId&&entry.type==='caja'&&!record.shiftId&&!record.debit.startsWith('1103-')&&!record.credit.startsWith('1103-')? actionButton('reverseCash',record.id,'Anular'):''} ${!entry.managed&&!S.entries.some(row=>row.reversalOf===entry.id)&&['manual','gasto','compra','abono','fiscal-pago'].includes(entry.type)?actionButton('reverseLegacyCash',entry.id,'Anular asiento'):''}</td></tr>`}).join('')));
};
function cashMovementForm(direction,deposit=false){
  modal(deposit?'Depósito de Caja general a Banco':direction==='ingreso'?'Ingreso a Caja general':'Egreso de Caja general',referenceFields()+field('concept','Concepto','','text','required')+amountField('total','Monto en moneda del comprobante')+field('currency','Moneda del comprobante',S.cfg.cur,'text','required')+field('exchangeRate','Tipo de cambio a moneda de la empresa',1,'number','min="0.000001" step="0.000001" required')+selectField('method','Forma',option('efectivo','Efectivo')+option('transferencia','Transferencia')+option('cheque','Cheque'))+field('party','Tercero: cliente, proveedor o empleado')+field('documentId','Documento ligado: factura, abono o depósito')+(deposit?'':selectField('contra','Cuenta contrapartida',accOpts('4102',account=>!['1101','1104','2107'].includes(account.code)&&!account.code.startsWith('1103-'))))+documentFileField(),async form=>{await operate(deposit?'deposit':'cashMovement',{direction,date:v(form,'date'),reference:v(form,'reference'),concept:v(form,'concept'),total:+v(form,'total'),currency:v(form,'currency'),exchangeRate:+v(form,'exchangeRate'),method:v(form,'method'),party:v(form,'party'),documentId:v(form,'documentId'),contra:deposit?undefined:v(form,'contra'),file:await formAttachment(form)});view()});
}
ACT.cashIn=()=>cashMovementForm('ingreso');ACT.cashOut=()=>cashMovementForm('egreso');ACT.bankDeposit=()=>cashMovementForm('egreso',true);
ACT.reverseCash=data=>modal('Anular movimiento de caja',referenceFields()+field('reason','Motivo de anulación','','text','required')+notice('No se borra el movimiento original. Se genera un asiento inverso y se verifica que no deje saldos negativos.'),async form=>{await operate('reverseMovement',{id:data.id,date:v(form,'date'),reference:v(form,'reference'),reason:v(form,'reason')});view()},'Anular con asiento inverso');
ACT.cashCount=data=>{
  const fund=S.pettyFunds.find(record=>record.id===data?.id),expected=fund?fundAvailable(fund):stateBalance('1101');
  modal(fund?'Arqueo de caja chica':'Arqueo de Caja general',notice(`Esperado: ${money(expected)}${fund?' · Efectivo + vales debe coincidir con el fondo.':''}. Las diferencias requieren supervisor y generan asiento.`)+referenceFields()+amountField('counted','Efectivo contado',Math.max(0,expected)),async form=>{await operate('cashCount',{fundId:fund?.id,date:v(form,'date'),reference:v(form,'reference'),counted:+v(form,'counted')});view()},'Registrar arqueo');
};
V.cajachica=()=>{
  main(pageHead('Caja chica','<button class="btn" data-a="newFund">+ Constituir fondo</button> '+pbtn())+notice('El fondo fijo conserva su cuenta contable. Los vales documentan el efectivo utilizado; la reposición paga exactamente los pendientes y reconoce cada gasto e IVA una sola vez.')+`<div class="fund-grid">${S.pettyFunds.map(fund=>{const available=fundAvailable(fund),pending=pendingVouchers(fund).reduce((total,voucher)=>total+voucher.total,0);return `<article class="card fund-card ${available<fund.authorizedAmount*.2?'fund-low':''}"><span class="section-eyebrow">FONDO FIJO</span><h3>${esc(fund.name)}</h3><p class="mut">Responsable: ${esc(fund.responsible)}</p><b class="fund-available">${money(available)}</b><small>Disponible ${available<fund.authorizedAmount*.2?'· Alerta: menos del 20%':''}</small><dl><dt>Autorizado</dt><dd>${money(fund.authorizedAmount)}</dd><dt>Vales pendientes</dt><dd>${money(pending)}</dd><dt>Efectivo + vales / mayor</dt><dd>${money(fund.fixedAmount)} / ${money(fund.ledgerBalance??stateBalance(fund.account))}</dd><dt>Límite por gasto</dt><dd>${money(fund.limit)}</dd></dl><div class="accounting-actions">${actionButton('newVoucher',fund.id,'+ Vale')} ${actionButton('replenishFund',fund.id,'Reponer')} ${actionButton('cashCount',fund.id,'Arqueo')} ${fund.fixedAmount!==fund.authorizedAmount?actionButton('regularizeFund',fund.id,'Regularizar fondo'):''}</div></article>`}).join('')||'<div class="card"><h3>Un fondo, cada gasto documentado.</h3><p>Constituye el primer fondo desde Caja general o Banco.</p></div>'}</div>`+`<h3 class="ledger-section">Vales y comprobantes</h3>`+accountingTable(['Fecha','Vale','Fondo','Concepto / categoría','Beneficiario','Autorizó','Base','IVA','Total','Estado','Adjunto'],S.pettyVouchers.map(voucher=>`<tr><td>${esc(voucher.date)}</td><td>${esc(voucher.reference)}</td><td>${esc(S.pettyFunds.find(fund=>fund.id===voucher.fundId)?.name)}</td><td>${esc(voucher.concept)}<small class="ledger-sub">${esc(voucher.category)}</small></td><td>${esc(voucher.beneficiary)}</td><td>${esc(voucher.authorizedBy)}</td><td>${money(voucher.base)}</td><td>${money(voucher.vat)}</td><td>${money(voucher.total)}</td><td>${voucher.reversalId?'Anulado':voucher.replenishmentId?'Repuesto':'Pendiente de reposición'}</td><td>${voucher.receipt?actionButton('downloadOperationReceipt',voucher.id,'Descargar'):''} ${!voucher.reversalId&&!voucher.replenishmentId&&!voucher.accruedEntryId?actionButton('voidVoucher',voucher.id,'Anular'):''}</td></tr>`).join('')));
};

ACT.newVoucher=data=>{
  const fund=S.pettyFunds.find(record=>record.id===data.id);
  modal('Vale de caja chica · '+esc(fund.name),notice(`Disponible ${money(fundAvailable(fund))} · Límite ${money(fund.limit)}`)+referenceFields()+field('concept','Concepto','','text','required')+amountField('base','Monto sin IVA')+field('vatRate','IVA acreditable % (0 = no aplica)',0,'number','min="0" max="100" step="0.01" required')+field('category','Categoría de gasto','','text','required')+selectField('account','Cuenta de gasto',accOpts('6107',account=>['gasto','costo'].includes(account.tipo)))+field('beneficiary','Beneficiario','','text','required')+notice('La autorización queda atribuida al usuario que registra el vale.')+documentFileField(),async form=>{await operate('voucher',{fundId:fund.id,date:v(form,'date'),reference:v(form,'reference'),concept:v(form,'concept'),base:+v(form,'base'),vatRate:+v(form,'vatRate'),category:v(form,'category'),account:v(form,'account'),beneficiary:v(form,'beneficiary'),file:await formAttachment(form)});view()},'Registrar vale');
};
ACT.replenishFund=data=>{const fund=S.pettyFunds.find(record=>record.id===data.id),total=pendingVouchers(fund).reduce((sum,voucher)=>sum+voucher.total,0);modal('Reposición exacta · '+esc(fund.name),notice(`Se agrupan ${pendingVouchers(fund).length} vales por ${money(total)}. No se permiten reposiciones mayores al gasto documentado.`)+referenceFields()+sourceField(),async form=>{await operate('replenish',{fundId:fund.id,date:v(form,'date'),reference:v(form,'reference'),source:v(form,'source')});view()},'Reponer y registrar asiento')};

V.reportescaja=()=>{
  const [from,to]=rg(),vouchers=S.pettyVouchers.filter(voucher=>voucher.date>=from&&voucher.date<=to&&!voucher.reversalId),counts=S.cashCounts.filter(count=>count.date>=from&&count.date<=to),categories=new Map(),people=new Map(),daily=new Map();
  for(const voucher of vouchers){categories.set(voucher.category,r2((categories.get(voucher.category)||0)+voucher.total));people.set(voucher.beneficiary,r2((people.get(voucher.beneficiary)||0)+voucher.total))}
  const cashCodes=new Set(S.accounts.filter(account=>account.sub==='ef').map(account=>account.code));
  for(const entry of S.entries.filter(record=>record.date>=from&&record.date<=to)){const net=r2(entry.lines.filter(line=>cashCodes.has(line.a)).reduce((total,line)=>total+line.d-line.c,0));if(!net)continue;const day=daily.get(entry.date)||{in:0,out:0};if(net>0)day.in+=net;else day.out-=net;daily.set(entry.date,day)}
  const staff=new Map();for(const entry of S.entries.filter(record=>record.date>=from&&record.date<=to&&['venta','nota-credito'].includes(record.type))){const actor=(entry.type==='nota-credito'?entry.originalOperatorName:entry.operatorName)||entry.actor||'Histórico',row=staff.get(actor)||{sales:0,returns:0};if(entry.type==='venta')row.sales+=entry.total;else row.returns+=entry.total;staff.set(actor,row)}
  const summary=(title,map)=>`<h3 class="ledger-section">${esc(title)}</h3>`+accountingTable(['Detalle','Total'],[...map].map(([name,total])=>`<tr><td>${esc(name)}</td><td>${money(total)}</td></tr>`).join(''));
  main(pageHead('Reportes de caja',pbtn())+searchBar('Mes y año, o fecha')+pbar()+`<h3 class="ledger-section">Ventas por cajero / vendedor</h3>`+accountingTable(['Persona','Ventas','Notas de crédito','Venta neta'],[...staff].map(([name,row])=>`<tr><td>${esc(name)}</td><td>${money(row.sales)}</td><td>${money(row.returns)}</td><td>${money(row.sales-row.returns)}</td></tr>`).join(''))+summary('Caja chica por categoría',categories)+summary('Caja chica por persona',people)+`<h3 class="ledger-section">Flujo diario · efectivo y equivalentes</h3>`+notice('Las transferencias entre Caja general, Banco, turnos y fondos no se duplican como ingresos o egresos del flujo.')+accountingTable(['Fecha','Entradas externas','Salidas externas','Flujo neto'],[...daily].sort(([first],[second])=>first.localeCompare(second)).map(([date,row])=>`<tr><td>${esc(date)}</td><td>${money(row.in)}</td><td>${money(row.out)}</td><td>${money(row.in-row.out)}</td></tr>`).join(''))+`<h3 class="ledger-section">Historial de arqueos</h3>`+accountingTable(['Fecha','Caja','Esperado','Contado','Vales','Diferencia','Usuario'],[...counts,...S.shifts.filter(shift=>shift.closedAt&&shift.closeDate>=from&&shift.closeDate<=to).map(shift=>({date:shift.closeDate,account:'Turno · '+shift.operatorName,expected:shift.expected,counted:shift.counted,vouchers:0,difference:shift.difference,actor:shift.closedBy}))].map(count=>`<tr><td>${esc(count.date)}</td><td>${esc(count.account)}</td><td>${money(count.expected)}</td><td>${money(count.counted)}</td><td>${money(count.vouchers)}</td><td class="${count.difference?'bad':'ok'}">${money(count.difference)}</td><td>${esc(count.actor)}</td></tr>`).join('')));
};
financialSearchRoutes.add('reportescaja');

let COST_MONTH=today().slice(0,7);
V.costos=()=>{
  const costs=S.costs.filter(cost=>cost.date.slice(0,7)===COST_MONTH&&!cost.reversalId),previousMonth=new Date(COST_MONTH+'-01T12:00:00');previousMonth.setMonth(previousMonth.getMonth()-1);const previousPeriod=iso(previousMonth).slice(0,7),previous=S.costs.filter(cost=>cost.date.slice(0,7)===previousPeriod&&!cost.reversalId).reduce((total,cost)=>total+cost.base,0);
  const sales=S.entries.filter(entry=>entry.date.slice(0,7)===COST_MONTH&&['venta','nota-credito'].includes(entry.type)),income=r2(sales.reduce((total,entry)=>total+(entry.subtotal??entry.total)*(entry.type==='nota-credito'?-1:1),0)),cogs=r2(sales.reduce((total,entry)=>total+entry.lines.filter(line=>line.a==='5101').reduce((sum,line)=>sum+line.d-line.c,0),0)),fixed=r2(costs.filter(cost=>cost.type==='fijo').reduce((total,cost)=>total+cost.base,0)),variable=r2(costs.filter(cost=>cost.type==='variable').reduce((total,cost)=>total+cost.base,0)),contribution=r2(income-cogs-variable),ratio=income>0?contribution/income:0;
  const recurring=S.costCatalog.filter(cost=>cost.active&&cost.recurring&&cost.startMonth<=COST_MONTH&&!costs.some(record=>record.catalogId===cost.id&&record.recurringPeriod===COST_MONTH)),centers=new Map();for(const cost of costs)centers.set(cost.center,(centers.get(cost.center)||0)+cost.base);
  main(pageHead('Costos',(CO.owner&&S.cfg.pos?.packagingCostId?'<button class="lk" data-a="operatingCostSettings">Costo automático por venta (avanzado)</button> ':'')+'<button class="btn" data-a="recordCost">+ Registrar costo</button> <button class="btn ghost" data-a="newCostCatalog">+ Catálogo</button> '+pbtn())+`<label class="cost-month">Mes de análisis<input id="cost-month" type="month" value="${COST_MONTH}"></label><div class="grid">${smallKpi('Costos fijos',money(fixed))}${smallKpi('Costos variables',money(variable))}${smallKpi('Ventas netas sin IVA',money(income))}${smallKpi('Costo de venta · kardex',money(cogs))}${smallKpi('Margen de contribución',money(contribution))}${smallKpi('Punto de equilibrio · ventas',ratio>0?money(fixed/ratio):'No calculable')}${smallKpi('Contra mes anterior',money(fixed+variable-previous))}${smallKpi('Costos / ventas',income>0?((fixed+variable)/income*100).toFixed(2)+'%':'Sin ventas')}</div>`+notice('El margen resta costo de ventas y costos variables registrados. El punto de equilibrio usa los costos fijos de este catálogo; no incluye gastos ajenos al módulo ni equivale a utilidad neta.')+(recurring.length?`<div class="card"><h3>Pendientes de confirmar · ${esc(COST_MONTH)}</h3><p>Se programan cada mes al abrir esta pantalla, sin generar gastos hasta confirmarlos.</p>${recurring.map(cost=>`<p>${esc(cost.name)} · ${money(cost.amount)} ${actionButton('recordCost',cost.id,'Confirmar este mes')}</p>`).join('')}</div>`:'')+`<h3 class="ledger-section">Registro del mes</h3>`+accountingTable(['Fecha','Costo / centro','Tipo','Comprobante','Base','IVA','Total','Pago','Acciones'],costs.map(cost=>`<tr><td>${esc(cost.date)}</td><td>${esc(cost.name)}<small class="ledger-sub">${esc(cost.center)} · ${cost.direct?'Directo':'Indirecto'}</small></td><td>${esc(cost.type)}</td><td>${esc(cost.reference)}</td><td>${money(cost.base)}</td><td>${money(cost.vat)}</td><td>${money(cost.total)}</td><td>${esc(cost.pay==='2101'?'Crédito':cost.pay==='petty'?'Caja chica':cost.pay==='1101'?'Caja general':'Banco')}</td><td>${cost.receipt?actionButton('downloadOperationReceipt',cost.id,'Comprobante'):''} ${isSupervisor()?actionButton('reverseCost',cost.id,'Anular'):''}</td></tr>`).join(''))+`<h3 class="ledger-section">Costo por área / centro</h3>`+accountingTable(['Centro','Monto sin IVA'],[...centers].map(([name,total])=>`<tr><td>${esc(name)}</td><td>${money(total)}</td></tr>`).join(''))+`<h3 class="ledger-section">Catálogo de costos</h3>`+accountingTable(['Nombre','Tipo','Clasificación','Centro','Cuenta','Recurrente','Acciones'],S.costCatalog.map(cost=>`<tr><td>${esc(cost.name)} ${cost.active?'':'(inactivo)'}</td><td>${esc(cost.type)}</td><td>${cost.direct?'Directo':'Indirecto'}</td><td>${esc(cost.center)}</td><td>${esc(cost.account)}</td><td>${cost.recurring?money(cost.amount)+' / mes':'No'}</td><td>${actionButton('editCostCatalog',cost.id,'Editar')}</td></tr>`).join('')));
};
document.addEventListener('change',event=>{if(event.target.id==='cost-month'&&event.target.value){COST_MONTH=event.target.value;view()}});
function costCatalogForm(cost){modal(cost?'Editar catálogo de costos':'Agregar al catálogo de costos',field('name','Nombre del costo',cost?.name||'','text','required')+selectField('type','Tipo',option('fijo','Fijo',cost?.type!=='variable')+option('variable','Variable',cost?.type==='variable'))+selectField('direct','Clasificación',option('true','Directo',cost?.direct)+option('false','Indirecto',!cost?.direct))+field('center','Área / centro de costo',cost?.center||'General','text','required')+selectField('account','Cuenta contable',accOpts(cost?.account||'6107',account=>['gasto','costo'].includes(account.tipo)))+amountField('amount','Monto previsto / empaque por factura',cost?.amount||0)+field('startMonth','Mes inicial',cost?.startMonth||COST_MONTH,'month','required')+`<label class="ck"><input name="recurring" type="checkbox" ${cost?.recurring?'checked':''}> Recurrente mensual, pendiente de confirmar</label><label class="ck"><input name="active" type="checkbox" ${cost?.active!==false?'checked':''}> Activo</label>`,async form=>{await operate('costCatalog',{id:cost?.id,name:v(form,'name'),type:v(form,'type'),direct:v(form,'direct')==='true',center:v(form,'center'),account:v(form,'account'),amount:+v(form,'amount'),startMonth:v(form,'startMonth'),recurring:form.elements.recurring.checked,active:form.elements.active.checked});view()})}
ACT.newCostCatalog=()=>costCatalogForm();ACT.editCostCatalog=data=>costCatalogForm(S.costCatalog.find(record=>record.id===data.id));
ACT.recordCost=data=>{
  const catalog=S.costCatalog.find(record=>record.id===data?.id),recurring=!!catalog?.recurring;
  modal('Registrar costo y asiento',field('date','Fecha',recurring?COST_MONTH+'-01':today(),'date','required')+field('reference','Recibo / número de comprobante','','text','required')+selectField('catalogId','Costo de catálogo',S.costCatalog.filter(cost=>cost.active).map(cost=>option(cost.id,`${cost.name} · ${cost.center}`,cost.id===catalog?.id)).join(''))+amountField('base','Monto sin IVA',catalog?.amount||0)+field('vatRate','IVA acreditable %',0,'number','min="0" max="100" step="0.01" required')+supplierFields()+selectField('pay','Forma de pago',option('1101','Caja general')+option('1102','Banco')+option('petty','Caja chica')+option('2101','Crédito / cuenta por pagar'))+selectField('fundId','Fondo de caja chica (si aplica)',option('','Selecciona')+S.pettyFunds.map(fund=>option(fund.id,fund.name)).join(''))+field('due','Vencimiento si es crédito',today(),'date','required')+documentFileField(),async form=>{await operate('cost',{date:v(form,'date'),reference:v(form,'reference'),catalogId:v(form,'catalogId'),base:+v(form,'base'),vatRate:+v(form,'vatRate'),supplierId:v(form,'supplierId'),party:v(form,'party'),pay:v(form,'pay'),fundId:v(form,'fundId'),due:v(form,'due'),recurringPeriod:recurring?COST_MONTH:undefined,file:await formAttachment(form)});view()},'Registrar costo');
};
ACT.reverseCost=data=>modal('Anular costo',referenceFields()+field('reason','Motivo','','text','required'),async form=>{await operate('reverseCost',{id:data.id,date:v(form,'date'),reference:v(form,'reference'),reason:v(form,'reason')});view()},'Generar asiento inverso');

function seriesRow(record={}){return `<div class="invoice-series-row" data-branch="${esc(record.branchId||CO.branchId||'principal')}">${field('seriesCode','Código',record.code||'','text','required maxlength="16" pattern="[A-Za-z0-9-]{1,16}"')}${field('seriesName','Nombre',record.name||'','text','maxlength="80"')}${field('seriesNext','Próximo número',(S.invoiceSequences[record.code]||0)+1,'number','required min="1" max="999999999" step="1"')}<button type="button" class="lk" data-a="seriesRemove">Quitar</button></div>`}
ACT.seriesAdd=(data,button)=>button.closest('form').querySelector('#invoice-series-rows').insertAdjacentHTML('beforeend',seriesRow());
ACT.seriesRemove=(data,button)=>button.closest('.invoice-series-row').remove();
ACT.operatingCostSettings=()=>{
 const pos=S.cfg.pos||{};
 modal('Costo automático por venta (avanzado)',selectField('packagingCostId','Costo automático por venta',option('','Sin costo automático')+S.costCatalog.filter(c=>c.active||c.id===pos.packagingCostId).map(c=>option(c.id,`${c.name} · ${money(c.amount)}`,c.id===pos.packagingCostId)).join(''))+selectField('packagingPay','Forma de pago',option('2101','A crédito / cuenta por pagar',pos.packagingPay==='2101')+option('1101','Caja general',pos.packagingPay==='1101')+option('1102','Banco',pos.packagingPay==='1102')),async form=>{await operate('settings',{pos:{...pos,useDimensions:dimensionsEnabled(),series:pos.series||[{code:'A',name:'Principal'}],packagingCostId:v(form,'packagingCostId'),packagingPay:v(form,'packagingPay')}});view()});
};
Object.assign(ACTION_MODULE,{operatingCostSettings:'costos',seriesAdd:'facturacion',seriesRemove:'facturacion'});
ACT.operatingSettings=()=>{
  const pos=S.cfg.pos||{},series=pos.series||[{code:'A',name:'Principal'}];
  modal('Configuración de facturación y cajas',notice('Solo el dueño configura series, descuentos y archivos privados. El próximo número nunca puede retroceder.')+`<fieldset class="invoice-series"><legend>Series y sucursales</legend><div id="invoice-series-rows">${series.map(record=>seriesRow(record)).join('')}</div><button type="button" class="lk" data-a="seriesAdd">Agregar serie</button></fieldset><label class="ck"><input type="checkbox" name="useDimensions" ${dimensionsEnabled()?'checked':''}> Usar centro de costo y proyecto (avanzado)</label>`+notice('La contraseña, los roles y el máximo de descuento se administran en Configuración → Accesibilidad.')+`<label>Logo de facturas (WebP)<input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="ck"><input name="removeLogo" type="checkbox"> Quitar logo de facturas</label><label class="ck"><input name="receiptsEnabled" type="checkbox" ${S.cfg.cash?.receiptsEnabled?'checked':''}> Autorizo comprobantes privados de caja y costos (1 MB; 100 archivos o 50 MB por empresa)</label>`,async form=>{
    const series=[...form.querySelectorAll('.invoice-series-row')].map(row=>({code:row.querySelector('[name=seriesCode]').value.trim().toUpperCase(),name:row.querySelector('[name=seriesName]').value.trim(),next:Number(row.querySelector('[name=seriesNext]').value),branchId:row.dataset.branch||CO.branchId}));
    const file=form.elements.logoFile.files[0];let logo=form.elements.removeLogo.checked?'':pos.logo||'';
    if(file){const image=await shrink(file,700);const result=await api('company-logo?c='+CO.id,'POST',{image,revision:REV});logo=result.logo}
    await operate('settings',{pos:{series,discountLimits:pos.discountLimits||{},useDimensions:form.elements.useDimensions.checked,packagingCostId:pos.packagingCostId||'',packagingPay:pos.packagingPay||'2101',logo},...(billingCan('cajas')?{cash:{receiptsEnabled:form.elements.receiptsEnabled.checked}}:{})});view();
  });
};
let ADVANCE_MONTH=today().slice(0,7),ADVANCE_WITHHOLDINGS=0;
function advanceNumbers(){const settings=S.cfg.advance||{},base=r2(S.entries.filter(entry=>entry.date.slice(0,7)===ADVANCE_MONTH&&['venta','nota-credito'].includes(entry.type)).reduce((total,entry)=>total+(entry.subtotal??entry.total-(entry.vat||0))*(entry.type==='nota-credito'?-1:1),0)),gross=r2(Math.max(0,base)*(settings.rate||0)/100),next=new Date(Date.UTC(+ADVANCE_MONTH.slice(0,4),+ADVANCE_MONTH.slice(5),1)),last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate(),due=next.toISOString().slice(0,7)+'-'+String(Math.min(settings.deadlineDay||1,last)).padStart(2,'0');return {base,gross,total:Math.max(0,r2(gross-ADVANCE_WITHHOLDINGS)),due}}
function advanceSection(){
  const settings=S.cfg.advance||{},numbers=advanceNumbers();
  return `<section class="card advance-panel"><div class="ph"><div><span class="section-eyebrow">OPCIONAL · SEGÚN EL PAÍS</span><h3>Anticipo mensual de IR</h3></div>${CO.owner?'<button class="btn ghost" data-a="advanceSettings">Configurar y confirmar</button>':''}</div>${!settings.enabled?notice('Desactivado. El dueño debe configurar y confirmar país, porcentaje y vencimiento. No se aplican tasas ni fechas por defecto.'):notice(`${settings.country} · Tasa confirmada ${settings.rate}% · Vence el día ${settings.deadlineDay} del mes siguiente (ajustado al último día del mes).`)}<div class="customer-form-grid"><label>Mes<input id="advance-month" type="month" value="${ADVANCE_MONTH}" required></label><label>Retenciones de IR recibidas<input id="advance-withholdings" type="number" min="0" step="0.01" value="${ADVANCE_WITHHOLDINGS}"></label></div><div class="grid">${smallKpi('Ingresos brutos del mes sin IVA',money(numbers.base))}${smallKpi('Anticipo antes de retenciones',settings.enabled?money(numbers.gross):'Sin activar')}${smallKpi('Monto a pagar',settings.enabled?money(numbers.total):'Sin activar')}${smallKpi('Fecha límite',settings.enabled?esc(numbers.due):'Sin configurar')}</div>${settings.enabled?'<button class="btn" data-a="advanceCreate">Crear obligación y asiento</button>':''}<p class="mut">Las retenciones solo reducen el cálculo del anticipo; no se registran de nuevo como gasto. El tratamiento legal y contable debe confirmarse con el asesor de cada empresa. Solo se genera la obligación cuando el mes terminó; las retenciones excedentes no se convierten automáticamente en saldo a favor.</p></section>`;
}
const fiscalWithAdvance=V.fiscal;
V.fiscal=()=>{fiscalWithAdvance();$('#main').insertAdjacentHTML('afterbegin',advanceSection())};
document.addEventListener('change',event=>{if(event.target.id==='advance-month'&&event.target.value){ADVANCE_MONTH=event.target.value;view()}if(event.target.id==='advance-withholdings'){ADVANCE_WITHHOLDINGS=Math.max(0,+event.target.value||0);view()}});
ACT.advanceSettings=()=>{
  const settings=S.cfg.advance||{};
  modal('Anticipo mensual · configuración por empresa',field('country','País',settings.country||'')+field('rate','Porcentaje de anticipo',settings.rate||0,'number','min="0" max="100" step="0.01" required')+field('deadlineDay','Día límite del mes siguiente',settings.deadlineDay||1,'number','min="1" max="31" step="1" required')+`<label class="ck"><input name="enabled" type="checkbox" ${settings.enabled?'checked':''}> Activar el cálculo opcional</label><label class="ck"><input name="confirmed" type="checkbox"> Confirmo que el porcentaje y el vencimiento corresponden a esta empresa y su país</label>`+notice('No es una determinación automática de la ley. La activación requiere confirmación expresa del dueño.'),async form=>{await operate('settings',{advance:{country:v(form,'country'),rate:+v(form,'rate'),deadlineDay:+v(form,'deadlineDay'),enabled:form.elements.enabled.checked,confirmed:form.elements.confirmed.checked}});view()});
};
ACT.advanceCreate=()=>{
  const settings=S.cfg.advance||{},numbers=advanceNumbers();
  modal('Confirmar anticipo mensual',notice(`Período ${ADVANCE_MONTH} · ${settings.country} · Base ${money(numbers.base)} · Tasa ${settings.rate}% · Retenciones ${money(ADVANCE_WITHHOLDINGS)} · Pagar ${money(numbers.total)} · Vence ${numbers.due}`)+`<label class="ck"><input name="confirmed" type="checkbox" required> Confirmo el porcentaje y la fecha límite</label>`+notice('Genera Gasto de IR contra Impuestos por pagar. No mueve dinero hasta registrar el pago fiscal.'),async form=>{await operate('advance',{month:ADVANCE_MONTH,withholdings:ADVANCE_WITHHOLDINGS,confirmed:form.elements.confirmed.checked,rate:settings.rate,due:numbers.due});view()},'Crear obligación y asiento');
};

ACT.reverseLegacyCash=data=>modal('Anular asiento de dinero',referenceFields()+field('reason','Motivo','','text','required')+notice('Conserva el asiento original y registra su inverso. Si incluye inventario, la devolución física y su valor deben seguir disponibles. Las ventas se corrigen exclusivamente mediante nota de crédito.'),async form=>{await operate('reverseLegacyCash',{id:data.id,date:v(form,'date'),reference:v(form,'reference'),reason:v(form,'reason')});view()},'Autorizar asiento inverso');
ACT.regularizeFund=data=>{const fund=S.pettyFunds.find(record=>record.id===data.id);modal('Restablecer fondo autorizado',notice(`Fondo autorizado ${money(fund.authorizedAmount)} · Saldo del fondo ${money(fund.fixedAmount)}. Se transfiere la diferencia exacta; no se vuelve a reconocer el faltante o sobrante.`)+referenceFields()+sourceField(),async form=>{await operate('regularizeFund',{fundId:fund.id,date:v(form,'date'),reference:v(form,'reference'),source:v(form,'source')});view()},'Regularizar fondo')};
ACT.voidVoucher=data=>modal('Anular vale pendiente',field('date','Fecha',today(),'date','required')+field('reason','Motivo','','text','required')+notice('Solo se anulan vales no repuestos y sin un costo ya contabilizado. Se conserva el vale y se registra su anulación; al no haber gasto reconocido no se duplica un asiento de gasto.'),async form=>{await operate('voidVoucher',{id:data.id,date:v(form,'date'),reason:v(form,'reason')});view()},'Autorizar anulación');
ACT.newFund=async()=>{
  let members=[];
  if(permission('accesibilidad')){const result=await api('members?c='+CO.id);members=result.members.filter(member=>member.active)}
  const choices=option(operatorIdentity(),CO.owner?'Dueño de la empresa':U.name||U.email)+members.filter(member=>member.id!==operatorIdentity()).map(member=>option(member.id,member.name+' · '+member.role)).join('');
  modal('Constituir fondo de caja chica',referenceFields()+field('name','Nombre del fondo','','text','required')+selectField('responsible','Responsable',choices)+amountField('fixedAmount','Monto fijo autorizado',2000)+amountField('limit','Límite por gasto',500)+sourceField(),async form=>{await operate('constituteFund',{date:v(form,'date'),reference:v(form,'reference'),name:v(form,'name'),responsible:v(form,'responsible'),fixedAmount:+v(form,'fixedAmount'),limit:+v(form,'limit'),source:v(form,'source')});view()});
};
ACT.invoiceOpening=data=>{
  const receivable=data.side==='receive',account=receivable?'1201':'2101';
  modal('Registrar factura / saldo inicial',notice('Para una factura no registrada en Ventas, Compras o Costos. No mueve inventario ni duplica esos documentos. Elige una contrapartida documentada.')+(receivable?field('party','Cliente','','text','required'):supplierFields())+field('reference','Número de factura','','text','required')+field('date','Fecha',today(),'date','required')+field('due','Vencimiento',today(),'date','required')+amountField('total','Monto total de deuda')+selectField('contra','Cuenta de contrapartida',accOpts('3102',record=>record.code!==account&&record.sub!=='ef')),form=>{
    const total=+v(form,'total');if(total<=0||v(form,'due')<v(form,'date'))return 'Revisa el monto y el vencimiento.';
    const supplierId=receivable?'':v(form,'supplierId');
    addEntry({date:v(form,'date'),due:v(form,'due'),reference:v(form,'reference'),party:v(form,'party'),supplierId,supplier:supplierSnapshot(supplierId),desc:'Factura - '+v(form,'party'),type:'factura',pay:account,total,lines:receivable?[{a:account,d:total,c:0},{a:v(form,'contra'),d:0,c:total}]:[{a:v(form,'contra'),d:total,c:0},{a:account,d:0,c:total}]});view();
  });
};
ACT.supplierPayments=data=>{
  const supplier=S.suppliers.find(record=>record.id===data.id),documents=S.entries.filter(entry=>['compra','gasto','costo','factura'].includes(entry.type)&&entry.total>0&&!entry.reversalOf&&(entry.supplierId===supplier.id||(!entry.supplierId&&normalizeSearch(entry.party)===normalizeSearch(supplier.name))));
  modal('Facturas y abonos · '+esc(supplier.name),notice('Incluye compras al contado y a crédito. Los documentos manuales históricos se muestran cuando el nombre coincide exactamente.')+accountingTable(['Factura','Fecha','Forma de pago','Total','Deuda','Acciones'],documents.map(entry=>`<tr><td>${esc(entry.reference||entry.id)}</td><td>${esc(entry.date)}</td><td>${esc(PAY[entry.pay]||entry.pay)}</td><td>${money(entry.total)}</td><td>${money(entry.pay==='2101'?invoiceBalance(entry):0)}</td><td>${entry.pay==='2101'&&invoiceBalance(entry)>0?actionButton('invoicePay',entry.id,'Abonar'):''} ${entry.pay==='2101'?actionButton('invoiceHistory',entry.id,'Historial'):''}</td></tr>`).join('')),()=>{},'Cerrar');
};
V.kardex=()=>{
  const query=SEARCHES.kardex||'',period=searchPeriod(query),selected=prod(KARDEX_PRODUCT)||S.products[0],[from,to]=period||rg(),allText=!!query&&!period;
  KARDEX_PRODUCT=selected?.id||'';
  const products=allText?S.products:selected?[selected]:[],rows=[];
  const byProduct=new Map();
  for(const entry of [...S.entries].sort((a,b)=>a.date.localeCompare(b.date)))for(const movement of entry.stock||[]){if(!byProduct.has(movement.pid))byProduct.set(movement.pid,[]);byProduct.get(movement.pid).push({entry,movement})}
  for(const product of products){
    const movements=byProduct.get(product.id)||[];
    let balance=quantityRound(product.stock-movements.reduce((total,row)=>total+row.movement.q,0));
    const productMatch=normalizeSearch(product.name+' '+product.code+' '+(product.barcodes||[]).join(' ')).includes(normalizeSearch(query).replace(/^(nombre|factura):\s*/,''));
    for(const {entry,movement} of movements){balance=quantityRound(balance+movement.q);if(allText?!(productMatch||matchesEntry(entry,query)):entry.date<from||entry.date>to)continue;const item=entry.items?.find(item=>item.p===product.id),cost=movement.unitCost??item?.cost??(entry.type==='compra'?item?.u:product.cost);
      rows.push(`<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference||entry.desc)}</td><td>${esc(product.name)}</td><td>${esc(movement.unit||item?.unit||'unidad')}</td><td>${movement.q>0?esc(formatQuantity(movement.q)):'—'}</td><td>${movement.q<0?esc(formatQuantity(-movement.q)):'—'}</td><td>${esc(formatQuantity(balance))}</td><td>${money(cost)}${movement.unitCost===undefined&&!item?.cost?' *':''}</td><td>${money(movement.revaluation??Math.abs(movement.q)*cost)}</td></tr>`);
    }
  }
  main(pageHead('Inventario · Kardex',pbtn())+selectField('kardexPick','Producto (sin búsqueda general)',S.products.map(product=>option(product.id,product.name,product.id===KARDEX_PRODUCT)).join(''))+searchBar('Producto, factura, nombre o fecha')+pbar()+notice('La existencia se calcula desde los movimientos del producto. Las revalorizaciones cambian valor, no cantidad. * Los movimientos históricos sin costo guardado usan un costo referencial actual, no una reconstrucción del costo histórico.')+accountingTable(['Fecha','Documento','Producto','Unidad','Entrada','Salida','Existencia','Costo unitario','Valor'],rows.join('')));
};
document.addEventListener('change',event=>{if(event.target.name==='kardexPick'){KARDEX_PRODUCT=event.target.value;delete SEARCHES.kardex;view()}});
const previousTaxNext=ACT.nextTax;
ACT.nextTax=data=>{const tax=S.taxes.find(record=>record.id===data.id);if(tax?.source==='anticipo'){ADVANCE_MONTH=followingDate(tax.period+'-01','mensual').slice(0,7);R='fiscal';view();return}previousTaxNext(data)};
const finalOperationalActions=actionAllowed;
actionAllowed=function(action,data={}){if(action==='removeTax'&&S?.taxes.find(tax=>tax.id===data.id)?.source==='anticipo')return false;return finalOperationalActions(action,data)};
const productsForOperations=V.productos;
V.productos=()=>{productsForOperations();if(!CO.owner&&['cajero','vendedor'].includes(String(CO.role).toLowerCase())){for(const row of $$('#main table tr')){if(row.parentElement.tagName==='TFOOT'){row.hidden=true;continue}for(const index of [2,5])if(row.cells[index])row.cells[index].hidden=true}}};
const protectedOpeningView=V.apertura;
V.apertura=()=>{protectedOpeningView();if(S.entries.some(entry=>entry.type==='apertura'&&entry.lines.some(line=>['1101','1102'].includes(line.a)))){$('#main [data-a="apertura"]')?.remove();$('#main').insertAdjacentHTML('beforeend',notice('La apertura con saldos de dinero se conserva. Registra las correcciones posteriores como nuevos asientos documentados, sin borrar ni sobrescribir el original.'))}};

READ_ACTIONS.add('authorizeDiscount');READ_ACTIONS.add('discountSettings');READ_ACTIONS.add('discountLog');
const discountItems=form=>[...form.querySelectorAll('.pos-item')].map(row=>({p:row.querySelector('[name=posProduct]').value,q:inputQuantity(row.querySelector('[name=posQuantity]').value),u:+row.querySelector('[name=posPrice]').value}));
ACT.authorizeDiscount=async(data,button)=>{
 const form=button.closest('form'),status=form.querySelector('.discount-feedback'),request={action:'authorize',discount:+v(form,'discount'),items:discountItems(form),password:v(form,'discountPassword')};form.discountAuthorization='';button.disabled=true;
 try{const result=await api('discounts?c='+CO.id,'POST',request);if(request.discount!==+v(form,'discount')||JSON.stringify(request.items)!==JSON.stringify(discountItems(form)))throw new Error('Los productos cambiaron. Autoriza de nuevo.');form.discountAuthorization=result.token;status.textContent='Descuento autorizado. Revisa el pago mixto antes de emitir.'}catch(error){status.textContent=error.message}finally{form.elements.discountPassword.value='';button.disabled=false;previewPos(form)}
};
ACT.discountSettings=async()=>{
 const policy=await api('discounts?c='+CO.id);
 modal('Autorización de descuentos',notice('Todo descuento mayor a 0% requiere la contraseña del dueño. Cuatro fallos seguidos bloquean al usuario durante 5 minutos. La autorización vence en 10 minutos y corresponde a los productos y precios revisados.')+(policy.owner?field('password',policy.configured?'Nueva contraseña (vacío = conservar)':'Contraseña del dueño','','password','minlength="8" maxlength="128" autocomplete="new-password"'):'')+field('maximum','Descuento máximo % (vacío = 99%)',policy.maximum,'number','min="0" max="99" step="0.01"')+`<label>Roles autorizados · uno por línea<textarea name="roles" rows="5">${esc(policy.roles.join('\n'))}</textarea></label><p class="mut">Ejemplos: cajero, vendedor, supervisor, contador. El dueño conserva autorización; cada rol necesita además permiso de escritura en Facturación.</p>`,async form=>{await api('discounts?c='+CO.id,'POST',{action:'settings',version:policy.version,password:form.elements.password?.value||'',maximum:v(form,'maximum'),roles:v(form,'roles').split(/\r?\n/)});setSt('Política de descuentos guardada')});
};
ACT.discountLog=async()=>{
 const result=await api('discounts?c='+CO.id,'POST',{action:'log'});
 modal('Bitácora de descuentos · últimos 200 eventos',accountingTable(['Fecha y hora','Usuario','Evento','Factura','Porcentaje','Monto'],result.events.map(event=>{const detail=event.changes?.[0]||{};return `<tr><td>${esc(event.createdAt)}</td><td>${esc(event.actor)}</td><td>${esc(detail.event)}</td><td>${esc(detail.reference||'—')}</td><td>${esc(detail.percent??'—')}</td><td>${detail.amountCents!=null?money(detail.amountCents/100):'—'}</td></tr>`}).join('')),()=>{},'Cerrar');
};
const discountAccessView=V.accesibilidad;
V.accesibilidad=async()=>{const companyId=CO.id;await discountAccessView();if(R==='accesibilidad'&&CO.id===companyId&&permission('accesibilidad',true))$('#main').insertAdjacentHTML('afterbegin','<div class="accounting-actions"><button class="btn ghost" data-a="discountSettings">Autorización de descuentos</button>'+(CO.owner?'<button class="btn ghost" data-a="discountLog">Bitácora de descuentos</button>':'')+'</div>')};

READ_ACTIONS.add('discountDetail');
ACT.discountDetail=data=>{const entry=S.entries.find(e=>e.id===data.id);if(!entry)return;const detail=entry.discountAudit;modal('Detalle de factura · '+esc(entry.reference||entry.id),notice(entry.party||'Cliente general')+accountingTable(['Concepto','Valor'],[['Usuario',detail?.actor||entry.operatorName||entry.actor||'Histórico'],['Fecha y hora',detail?.at||entry.date],['Descuento',String(entry.discount||0)+'%'],['Monto descontado (IVA incluido)',detail?money(detail.amountCents/100):'Sin registro histórico'],['Base',money(entry.subtotal)],['IVA',money(entry.vat||0)],['Total',money(entry.total)],...(entry.payments||[]).map(payment=>[paymentLabels[payment.method],money(payment.amount)])].map(([label,value])=>`<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')),()=>{},'Cerrar')};
