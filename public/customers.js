'use strict';

const CUSTOMER_STATES={activo:'Activo',suspendido:'Suspendido',inactivo:'Inactivo'};
const customerById=id=>(S.customers||[]).find(customer=>customer.id===id);
const customerMoney=customer=>`${customer.currency} ${customer.creditLimit.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const customerSnapshot=customer=>Object.fromEntries(['name','taxId','phone','email','address','contact','seller','sellerId','routeZone','visitDays','routeOrder','paymentType','creditLimit','creditDays','currency'].map(name=>[name,customer[name]]));
const customerOptions=(selected='')=>(S.customers||[]).filter(customer=>customer.status==='activo'||customer.id===selected).sort((first,second)=>first.name.localeCompare(second.name,'es')).map(customer=>`<option value="${esc(customer.id)}" ${customer.id===selected?'selected':''}>${esc(customer.name)}${customer.taxId?' · '+esc(customer.taxId):''} · ${customer.paymentType==='credito'?'Crédito':'Contado'}${customer.status!=='activo'?' · '+esc(CUSTOMER_STATES[customer.status]):''}</option>`).join('');
const CUSTOMER_CREDIT_DAYS=[1,3,7,15,30,45,60,90,180,365];
const customerCreditTerm=days=>`${days} ${uiT(days===1?'customers.day':'customers.days',days===1?'día':'días')}`;
function saleCustomerFields(entry){
  return `<div class="sale-customer-picker"><label>${esc(uiT("customers.1","Cliente de cartera"))}<select name="customerId"><option value="">${esc(uiT("customers.2","Cliente manual / general"))}</option><option value="__other__">${esc(uiT("customers.other","Otro (escribir nombre)"))}</option>${customerOptions(entry?.customerId)}</select></label><button type="button" class="btn ghost" data-invoice-customers>${esc(uiT("customers.11","Buscar cliente"))}</button></div>`+field('party',uiT("customers.3","Nombre o razón social"),entry?.party||'','text','maxlength="200"')+'<div id="sale-customer-info" class="accounting-notice" hidden></div>';
}
function saleCustomerSnapshot(form){
  const customer=customerById(v(form,'customerId'));
  const previous=S.entries.find(entry=>entry.id===form.dataset.invoiceId);
  return customer?(previous?.customerId===customer.id&&previous.customer?previous.customer:customerSnapshot(customer)):null;
}
function updateSaleCustomer(form,applyConditions=false){
  const customer=customerById(v(form,'customerId'));
  form.elements.party.readOnly=!!customer;
  form.elements.party.required=v(form,'customerId')==='__other__';
  if(applyConditions&&!customer&&form.elements.py&&v(form,'customerId')==='__other__'&&v(form,'py')==='1201')form.elements.py.value='1101';
  const info=form.querySelector('#sale-customer-info');info.hidden=!customer;
  if(!customer)return;
  if(applyConditions){
    form.elements.party.value=customer.name;
    if(form.elements.py)form.elements.py.value=customer.paymentType==='credito'?'1201':'1101';
    updateSaleDue(form);
  }
  const details=saleCustomerSnapshot(form);
  info.textContent=`${details.taxId?'RUC / cédula: '+details.taxId+' · ':''}${customer.paymentType==='credito'?`Crédito: ${customerMoney(customer)} · ${customerCreditTerm(customer.creditDays)}`:'Cliente al contado'} · ${CUSTOMER_STATES[customer.status]}. La venta se registra en ${S.cfg.cur}; el límite de crédito se valida al emitir la factura.`;
}
function updateSaleDue(form){
  const customer=customerById(v(form,'customerId'));
  if(!customer||v(form,'py')!=='1201'||!v(form,'dt'))return;
  const date=new Date(v(form,'dt')+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+customer.creditDays);
  form.elements.due.value=date.toISOString().slice(0,10);
}
MENU[0][1].splice(2,0,['clientes','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></svg>','Cartera de clientes']);
function renderCustomerRows(){
  const query=($('#customer-search')?.value||'').trim().toLocaleLowerCase('es');
  const payment=$('#customer-payment')?.value||'',status=$('#customer-status')?.value||'';
  const customers=(S.customers||[]).filter(customer=>(!payment||customer.paymentType===payment)&&(!status||customer.status===status)&&[customer.name,customer.taxId,customer.phone,customer.email,customer.contact,customer.seller].join(' ').toLocaleLowerCase('es').includes(query)).sort((first,second)=>first.name.localeCompare(second.name,'es'));
  $('#customer-rows').innerHTML=customers.map(customer=>`<tr><td><b>${esc(customer.name)}</b><span class="ledger-sub">${esc(customer.taxId||'Sin RUC / cédula')}${customer.seller?' · '+esc(customer.seller):''}</span></td><td>${esc(customer.phone||'—')}<span class="ledger-sub">${esc(customer.email||'')}</span></td><td>${customer.paymentType==='credito'?'Crédito':'Contado'}${customer.paymentType==='credito'?`<span class="ledger-sub">${esc(customerMoney(customer))} · ${esc(customerCreditTerm(customer.creditDays))}</span>`:''}</td><td><span class="ledger-badge ${customer.status==='activo'?'paid':'pending'}">${esc(CUSTOMER_STATES[customer.status])}</span></td><td>${actionButton('editCustomer',customer.id,'Ver / editar ficha')} ${actionButton('customerHistory',customer.id,'Historial y estado de cuenta')}</td></tr>`).join('')||`<tr><td colspan="5" class="empty-ledger mut">${esc(uiT("customers.4","No hay clientes que coincidan. Registra una ficha o cambia los filtros."))}</td></tr>`;
  $('#customer-count').textContent=`${customers.length} de ${(S.customers||[]).length} clientes`;
  if(typeof enforceAccessUI==='function')enforceAccessUI();
}
V.clientes=()=>{
  const customers=S.customers||[];
  main(pageHead(uiT("customers.5","Cartera de clientes"),`<button class="btn" data-a="newCustomer">${esc(uiT("customers.6","+ Registrar cliente"))}</button>`)+`<div class="customer-overview"><div><span class="access-kicker">${esc(uiT("customers.7","RELACIONES COMERCIALES"))}</span><p>${esc(uiT("customers.8","Una ficha para cada cliente. Elige tu cartera al vender o sigue registrando un nombre manual."))}</p></div><div class="customer-counters"><b>${customers.length}<span>${esc(uiT("customers.9","clientes"))}</span></b><b>${customers.filter(customer=>customer.paymentType==='credito').length}<span>${esc(uiT("customers.10","a crédito"))}</span></b></div></div><div class="customer-filters"><label>${esc(uiT("customers.11","Buscar cliente"))}<input id="customer-search" type="search" placeholder="Nombre, RUC, teléfono o vendedor"></label><label>${esc(uiT("customers.12","Tipo"))}<select id="customer-payment"><option value="">${esc(uiT("customers.13","Todos"))}</option><option value="credito">${esc(uiT("customers.14","Crédito"))}</option><option value="contado">${esc(uiT("customers.15","Contado"))}</option></select></label><label>${esc(uiT("customers.16","Estado"))}<select id="customer-status"><option value="">${esc(uiT("customers.17","Todos"))}</option>${Object.entries(CUSTOMER_STATES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><p id="customer-count" class="mut" aria-live="polite"></p><div class="card"><div class="tw"><table><thead><tr><th>${esc(uiT("customers.18","Cliente / identificación"))}</th><th>${esc(uiT("customers.19","Contacto"))}</th><th>${esc(uiT("customers.20","Condiciones"))}</th><th>${esc(uiT("customers.21","Estado"))}</th><th>${esc(uiT("customers.22","Ficha"))}</th></tr></thead><tbody id="customer-rows"></tbody></table></div></div>`);
  renderCustomerRows();
};
function customerForm(customer,context=null){
  const editable=typeof permission!=='function'||permission('ventas',true);
  const form=modal(customer?'Ficha del cliente':'Registrar cliente',`<h4 class="customer-section">${esc(uiT("customers.31","1. Ficha del cliente"))}</h4><div class="customer-form-grid">${field('name',uiT("customers.23","Nombre o razón social"),customer?.name||'','text','required maxlength="200"')}${field('taxId',uiT("customers.24","RUC o cédula"),customer?.taxId||'','text','maxlength="80"')}${field('phone',uiT("customers.25","Teléfono"),customer?.phone||'','tel','maxlength="80"')}${field('email',uiT("customers.26","Correo"),customer?.email||'','email','maxlength="254"')}</div><label>${esc(uiT("customers.32","Dirección"))}<textarea name="address" rows="2" maxlength="1000">${esc(customer?.address||'')}</textarea></label><div class="customer-form-grid">${field('contact',uiT("customers.27","Persona de contacto"),customer?.contact||'','text','maxlength="200"')}${field('seller','Vendedor anterior / referencia',customer?.seller||'','text','maxlength="200"')}</div>${field('birthday','Cumpleaños (opcional)',customer?.birthday||'','date','max="'+today()+'"')}<h4 class="customer-section">${esc(uiT("customers.33","2. Condiciones comerciales"))}</h4>${customerRouteFields(customer)}<div class="customer-form-grid"><label>${esc(uiT("customers.34","Tipo de cliente"))}<select name="paymentType"><option value="contado">${esc(uiT("customers.35","Al contado"))}</option><option value="credito">${esc(uiT("customers.36","Crédito"))}</option></select></label>${field('currency',uiT("customers.29","Moneda"),customer?.currency||S.cfg.cur||'C$','text','required maxlength="20"')}</div><div class="customer-form-grid" id="customer-credit">${field('creditLimit',uiT("customers.30","Límite de crédito"),customer?.creditLimit||0,'number','required min="0" max="999999999999" step="0.01"')}<label>${esc(uiT("customers.37","Plazo de crédito"))}<select name="creditDays">${CUSTOMER_CREDIT_DAYS.map(days=>`<option value="${days}" ${days===(customer?.creditDays||30)?'selected':''}>${esc(customerCreditTerm(days))}${[7,30,180,365].includes(days)?' ('+esc(uiT("customers.period."+days,({7:"1 semana",30:"1 mes",180:"6 meses",365:"1 año"})[days]))+')':''}</option>`).join('')}<option value="other" ${customer&&!CUSTOMER_CREDIT_DAYS.includes(customer.creditDays)?'selected':''}>${esc(uiT("customers.customTerm","Otro (escribir)"))}</option></select></label><label data-custom-credit hidden>${esc(uiT("customers.termDays","Días de plazo"))}<input name="customCreditDays" type="number" min="1" max="3650" step="1" value="${esc(customer?.creditDays||30)}"></label></div><label>${esc(uiT("customers.38","Estado"))}<select name="status">${Object.entries(CUSTOMER_STATES).map(([value,label])=>`<option value="${value}" ${value===(customer?.status||'activo')?'selected':''}>${label}</option>`).join('')}</select></label><h4 class="customer-section">${esc(uiT("customers.39","3. Notas internas"))}</h4><label>${esc(uiT("customers.40","Notas"))}<textarea name="notes" rows="3" maxlength="4000" placeholder="Acuerdos, referencias e indicaciones para tu equipo">${esc(customer?.notes||'')}</textarea></label>`+notice(uiT("customers.41","Solo los clientes activos se ofrecen para nuevas ventas. Las notas internas no se imprimen. Un límite de crédito mayor que cero se valida al emitir ventas a crédito.")),async fields=>{
    if(!editable)return 'Tu acceso es de solo lectura.';
    const name=v(fields,'name').trim(),taxId=v(fields,'taxId').trim(),creditLimit=Number(v(fields,'creditLimit'));
    if(!name)return 'Escribe el nombre o razón social.';
    if(taxId&&(S.customers||[]).some(record=>record.id!==customer?.id&&record.taxId.toLowerCase()===taxId.toLowerCase()))return 'Ya existe un cliente con ese RUC o cédula.';
    if(!Number.isFinite(creditLimit)||creditLimit<0||creditLimit>999999999999)return 'Revisa el límite de crédito.';
    const creditDays=Number(v(fields,v(fields,'creditDays')==='other'?'customCreditDays':'creditDays'));
    if(!Number.isSafeInteger(creditDays)||creditDays<1||creditDays>3650)return uiT('customers.invalidTerm','Escribe un plazo entero de 1 a 3650 días.');
    const birthday=v(fields,'birthday');
    if(birthday&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||!Number.isFinite(Date.parse(birthday))||new Date(birthday).toISOString().slice(0,10)!==birthday||birthday>today()))return 'Revisa el cumpleaños.';
    const record={...customer,...(birthday?{birthday}:customer?.birthday!==undefined?{birthday:''}:{}),id:customer?.id||uid(),routeZone:v(fields,'routeZone').trim(),visitDays:[...fields.querySelectorAll('[name=visitDays]:checked')].map(i=>Number(i.value)),routeOrder:Number(v(fields,'routeOrder')||0),sellerId:v(fields,'sellerId'),name,taxId,phone:v(fields,'phone').trim(),email:v(fields,'email').trim(),address:v(fields,'address').trim(),contact:v(fields,'contact').trim(),seller:v(fields,'seller').trim(),paymentType:v(fields,'paymentType'),currency:v(fields,'currency').trim(),creditLimit:r2(creditLimit),creditDays,status:v(fields,'status'),notes:v(fields,'notes').trim()};
    if(!record.currency)return 'Escribe la moneda.';
    if(record.sellerId){const worker=customerRouteTeam.find(m=>m.id===record.sellerId);if(worker)record.seller=worker.name;}
    if(CO.routeRole){await operate('routeCustomer',{customer:record,date:today(),confirmed:true});if(context)setTimeout(()=>context.onSaved(record),0);else view();return;}
    if(customer)Object.assign(customer,record);else S.customers.push(record);
    save();if(context)setTimeout(()=>context.onSaved(record),0);else view();
  },'Guardar cliente');
  loadCustomerRouteTeam(form,customer);
  form.elements.paymentType.value=customer?.paymentType||'contado';
  const updateCredit=()=>{form.querySelector('#customer-credit').hidden=form.elements.paymentType.value!=='credito'};
  const updateTerm=()=>{const custom=v(form,'creditDays')==='other';form.querySelector('[data-custom-credit]').hidden=!custom;form.elements.customCreditDays.disabled=!custom;form.elements.customCreditDays.required=custom;};
  updateTerm();form.elements.creditDays.addEventListener('change',updateTerm);
  form.elements.customCreditDays.addEventListener('invalid',()=>form.elements.customCreditDays.setCustomValidity(uiT('customers.invalidTerm','Escribe un plazo entero de 1 a 3650 días.')));
  form.elements.customCreditDays.addEventListener('input',()=>form.elements.customCreditDays.setCustomValidity(''));
  updateCredit();form.elements.paymentType.addEventListener('change',updateCredit);
  if(context)context.onOpen(form);
  if(!editable){for(const control of form.elements)if(control.name)control.disabled=true;form.querySelector('.mf button:last-child').hidden=true}
}
ACT.newCustomer=()=>customerForm(null);
ACT.editCustomer=data=>{const customer=customerById(data.id);if(customer)customerForm(customer)};
// Consulta efímera del documento autorizado; nunca guarda otra copia del libro.
async function customerAccountData(id){
  if(!permission('ventas'))return null;
  const customer=customerById(id);if(!customer)return null;
  const companyId=CO.id,source=S;
  const math=await import('/accounting-math.mjs?v=10d728cb2562503b');
  if(CO.id!==companyId||S!==source||!permission('ventas'))return null;
  const accounting=permission('contabilidad')||permission('finanzas');
  const entries=math.customerAccountEntries(id,S.entries).sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id)));
  let balance=0;
  const rows=entries.map(entry=>{
    const lines=accounting?(entry.lines||[]).filter(line=>line.a==='1201'):[];
    const debit=lines.reduce((sum,line)=>sum+math.moneyCents(line.d||0),0),credit=lines.reduce((sum,line)=>sum+math.moneyCents(line.c||0),0);balance+=debit-credit;
    const items=(entry.items||[]).map(item=>(item.name||prod(item.p)?.name||'Artículo / servicio')+' × '+formatQuantity(item.q)).join('; ');
    return [entry.date,entry.reference||entry.id,entry.type,items||entry.desc||'',entry.due||'',debit/100,credit/100,balance/100];
  });
  return {customer,accounting,rows,balance:accounting?r2(math.customerCreditBalance(id,S.entries)):null};
}
function customerAccountTable(data){
  return accountingTable(['Fecha','Documento','Tipo','Productos / servicios','Vencimiento',...(data.accounting?['Cargo a crédito','Abono / devolución','Saldo']:[])],data.rows.map(row=>'<tr>'+row.slice(0,data.accounting?8:5).map((value,index)=>'<td>'+(index>=5?money(value):esc(value))+'</td>').join('')+'</tr>').join(''));
}
function customerAccountScope(){return CO.branchId?primaryBranches().find(branch=>branch.id===CO.branchId)?.name||CO.branchId:'Consolidado autorizado';}
ACT.customerHistory=async data=>{
  const report=await customerAccountData(data.id);if(!report)return;
  const customer=report.customer;
  main(pageHead('Historial · '+esc(customer.name),actionButton('customerStatementPrint',customer.id,'Imprimir / PDF')+' '+actionButton('customerStatementExport',customer.id,'Descargar Excel')+' <button class="btn ghost" data-a="nav" data-r="clientes">Volver a clientes</button>')+
    notice('Sucursal: '+esc(customerAccountScope())+'. Solo movimientos vinculados a esta ficha por su identificador. Los documentos antiguos con nombre manual no se asignan automáticamente. Abrir o imprimir esta consulta no genera ventas, cobros ni movimientos de inventario.')+
    `<div class="card"><h3>${esc(customer.name)}</h3><p>${esc(customer.taxId||'Sin identificación')} · ${esc(customer.phone||'Sin teléfono')}</p><p>${esc(customer.email||'')} ${esc(customer.address||'')}</p><p>Límite: ${esc(customerMoney(customer))} · ${esc(CUSTOMER_STATES[customer.status])}${customer.birthday?' · Cumpleaños: '+esc(customer.birthday):''}</p>${report.accounting?'<p>Saldo registrado en '+esc(S.cfg.cur)+': <b>'+money(report.balance)+'</b></p>':notice('El saldo y los movimientos de crédito requieren permiso de Contabilidad o Finanzas. El historial muestra únicamente los documentos autorizados.')}<p>Notas internas: ${esc(customer.notes||'Sin notas')}</p></div>`+customerAccountTable(report));
  enforceAccessUI();
};
ACT.customerStatementPrint=async data=>{
  const report=await customerAccountData(data.id);if(!report)return;
  printBusinessDocument(report.accounting?'Estado de cuenta de cliente':'Historial de cliente',`<h3>${esc(report.customer.name)}</h3><p>${esc(report.customer.taxId||'')} · ${esc(report.customer.address||'')}</p><p>Consulta: ${esc(today())} · Sucursal: ${esc(customerAccountScope())} · Moneda de movimientos: ${esc(S.cfg.cur)}</p>${report.accounting?'<p>Saldo: <b>'+money(report.balance)+'</b></p>':''}`+customerAccountTable(report)+'<p>Solo documentos vinculados por identificador en el alcance autorizado. Los movimientos históricos sin vínculo requieren revisión. Verifica con tu contador.</p>');
};
ACT.customerStatementExport=async data=>{
  const companyId=CO.id,report=await customerAccountData(data.id);if(!report)return;
  await loadExportScript('/vendor/xlsx.js?v=cc015130aa8521e7');if(CO.id!==companyId||!permission('ventas'))return;
  // Texto explícito evita interpretar referencias y nombres como fórmulas.
  const grid=[['Empresa',CO.name],['Cliente',report.customer.name],['Sucursal',customerAccountScope()],['Moneda',S.cfg.cur],['Generado',new Date().toISOString()],['Fecha','Documento','Tipo','Productos / servicios','Vencimiento',...(report.accounting?['Cargo a crédito','Abono / devolución','Saldo']:[])],...report.rows.map(row=>row.slice(0,report.accounting?8:5))];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(grid),'Cliente');
  downloadFile(new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'estado-cliente-'+today()+'.xlsx');
};
ACT.printSale=(data,button)=>{
  const form=button.closest('form');if(!form.reportValidity())return;
  const items=readItems();
  if(!items.length||items.some(item=>!prod(item.p)||!Number.isFinite(item.q)||item.q<=0||!Number.isFinite(item.u)||item.u<0||!Number.isFinite(item.vatRate)||item.vatRate<0||item.vatRate>100))throw new Error(uiT("customers.extra.1","Agrega productos válidos antes de imprimir."));
  const totals=taxTotals(items);if(totals.total<=0)throw new Error(uiT("customers.extra.2","El total debe ser mayor que cero."));
  printRcpt({date:v(form,'dt'),due:v(form,'due'),reference:v(form,'reference')||'Borrador sin guardar',party:v(form,'party').trim()||'Cliente general',pay:v(form,'py'),customer:saleCustomerSnapshot(form),items,...totals});
};
document.addEventListener('input',event=>{if(event.target.id==='customer-search')renderCustomerRows()});
document.addEventListener('change',event=>{
  const control=event.target;
  if(['customer-payment','customer-status'].includes(control.id))renderCustomerRows();
  const form=control.closest('form');if(form?.dataset.k!=='venta')return;
  if(control.name==='customerId')updateSaleCustomer(form,true);
  if(['dt','py'].includes(control.name))updateSaleDue(form);
});

const selectedSaleCustomerId=form=>v(form,'customerId')==='__other__'?'':v(form,'customerId');

let customerRouteTeam=[];
const ROUTE_WEEKDAYS=[[1,'Lunes'],[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado'],[0,'Domingo']];
function customerRouteFields(c){return '<div class="customer-form-grid">'+field('routeZone','Ruta / zona',c?.routeZone||'','text','maxlength="100"')+field('routeOrder','Orden en la ruta',c?.routeOrder||0,'number','min="0" max="100000" step="1"')+'<label>Vendedor asignado<select name="sellerId"><option value="">Sin asignar'+(c?.seller?' · '+esc(c.seller):'')+'</option>'+(c?.sellerId?option(c.sellerId,c.seller||'Asignación actual',true):'')+'</select></label></div><fieldset><legend>Días de visita</legend>'+ROUTE_WEEKDAYS.map(([id,name])=>'<label class="ck"><input type="checkbox" name="visitDays" value="'+id+'" '+(c?.visitDays?.includes(id)?'checked':'')+'>'+name+'</label>').join('')+'</fieldset>'}
async function loadCustomerRouteTeam(form,c){
 if(!permission('rutas'))return;
 try{const companyId=CO.id,result=await api('operations?c='+companyId,'POST',{operation:'routeTeam'});if(!form.isConnected||CO.id!==companyId)return;customerRouteTeam=result.members;const select=form.elements.sellerId;select.innerHTML=option('','Sin asignar'+(c?.seller?' · '+c.seller:''))+result.members.map(m=>option(m.id,m.name,m.id===c?.sellerId)).join('')+(c?.sellerId&&!result.members.some(m=>m.id===c.sellerId)?option(c.sellerId,c.seller||'Asignación anterior',true):'');if(CO.routeRole&&CO.routeRole!=='route_supervisor'){select.value=CO.memberId;select.disabled=true;}}
 catch{ /* Keep the historical assignment if team lookup is unavailable. */ }
}
function customerCreditText(customer,p){return 'Tipo: '+(customer.paymentType==='credito'?'Crédito':'Contado')+' · Límite: '+(p.limitCents>0?money(p.limitCents/100):'Sin límite configurado')+' · Saldo pendiente: '+money(p.balanceCents/100)+' · Saldo vencido: '+money(p.overdueCents/100)+' · Crédito disponible: '+(p.availableCents===null?'Sin límite configurado':money(p.availableCents/100))+' · Plazo: '+customer.creditDays+' días';}
