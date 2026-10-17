'use strict';

const CUSTOMER_STATES={activo:'Activo',suspendido:'Suspendido',inactivo:'Inactivo'};
const customerById=id=>(S.customers||[]).find(customer=>customer.id===id);
const customerMoney=customer=>`${customer.currency} ${customer.creditLimit.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const customerSnapshot=customer=>Object.fromEntries(['name','taxId','phone','email','address','contact','seller','paymentType','creditLimit','creditDays','currency'].map(name=>[name,customer[name]]));
const customerOptions=(selected='')=>(S.customers||[]).filter(customer=>customer.status==='activo'||customer.id===selected).sort((first,second)=>first.name.localeCompare(second.name,'es')).map(customer=>`<option value="${esc(customer.id)}" ${customer.id===selected?'selected':''}>${esc(customer.name)}${customer.taxId?' · '+esc(customer.taxId):''} · ${customer.paymentType==='credito'?'Crédito':'Contado'}${customer.status!=='activo'?' · '+esc(CUSTOMER_STATES[customer.status]):''}</option>`).join('');
function saleCustomerFields(entry){
  return `<label>Cliente de cartera<select name="customerId"><option value="">Cliente manual / general</option>${customerOptions(entry?.customerId)}</select></label>`+field('party','Nombre o razón social',entry?.party||'','text','maxlength="200"')+'<div id="sale-customer-info" class="accounting-notice" hidden></div>';
}
function saleCustomerSnapshot(form){
  const customer=customerById(v(form,'customerId'));
  const previous=S.entries.find(entry=>entry.id===form.dataset.invoiceId);
  return customer?(previous?.customerId===customer.id&&previous.customer?previous.customer:customerSnapshot(customer)):null;
}
function updateSaleCustomer(form,applyConditions=false){
  const customer=customerById(v(form,'customerId'));
  form.elements.party.readOnly=!!customer;
  const info=form.querySelector('#sale-customer-info');info.hidden=!customer;
  if(!customer)return;
  if(applyConditions){
    form.elements.party.value=customer.name;
    form.elements.py.value=customer.paymentType==='credito'?'1201':'1101';
    updateSaleDue(form);
  }
  const details=saleCustomerSnapshot(form);
  info.textContent=`${details.taxId?'RUC / cédula: '+details.taxId+' · ':''}${customer.paymentType==='credito'?`Crédito: ${customerMoney(customer)} · ${customer.creditDays} días`:'Cliente al contado'} · ${CUSTOMER_STATES[customer.status]}. La venta se registra en ${S.cfg.cur}; el límite de crédito se valida al emitir la factura.`;
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
  $('#customer-rows').innerHTML=customers.map(customer=>`<tr><td><b>${esc(customer.name)}</b><span class="ledger-sub">${esc(customer.taxId||'Sin RUC / cédula')}${customer.seller?' · '+esc(customer.seller):''}</span></td><td>${esc(customer.phone||'—')}<span class="ledger-sub">${esc(customer.email||'')}</span></td><td>${customer.paymentType==='credito'?'Crédito':'Contado'}${customer.paymentType==='credito'?`<span class="ledger-sub">${esc(customerMoney(customer))} · ${customer.creditDays} días</span>`:''}</td><td><span class="ledger-badge ${customer.status==='activo'?'paid':'pending'}">${esc(CUSTOMER_STATES[customer.status])}</span></td><td>${actionButton('editCustomer',customer.id,'Ver / editar ficha')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-ledger mut">No hay clientes que coincidan. Registra una ficha o cambia los filtros.</td></tr>';
  $('#customer-count').textContent=`${customers.length} de ${(S.customers||[]).length} clientes`;
  if(typeof enforceAccessUI==='function')enforceAccessUI();
}
V.clientes=()=>{
  const customers=S.customers||[];
  main(pageHead('Cartera de clientes','<button class="btn" data-a="newCustomer">+ Registrar cliente</button>')+`<div class="customer-overview"><div><span class="access-kicker">RELACIONES COMERCIALES</span><p>Una ficha para cada cliente. Elige tu cartera al vender o sigue registrando un nombre manual.</p></div><div class="customer-counters"><b>${customers.length}<span>clientes</span></b><b>${customers.filter(customer=>customer.paymentType==='credito').length}<span>a crédito</span></b></div></div><div class="customer-filters"><label>Buscar cliente<input id="customer-search" type="search" placeholder="Nombre, RUC, teléfono o vendedor"></label><label>Tipo<select id="customer-payment"><option value="">Todos</option><option value="credito">Crédito</option><option value="contado">Contado</option></select></label><label>Estado<select id="customer-status"><option value="">Todos</option>${Object.entries(CUSTOMER_STATES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><p id="customer-count" class="mut" aria-live="polite"></p><div class="card"><div class="tw"><table><thead><tr><th>Cliente / identificación</th><th>Contacto</th><th>Condiciones</th><th>Estado</th><th>Ficha</th></tr></thead><tbody id="customer-rows"></tbody></table></div></div>`);
  renderCustomerRows();
};
function customerForm(customer){
  const editable=typeof permission!=='function'||permission('ventas',true);
  const form=modal(customer?'Ficha del cliente':'Registrar cliente',`<h4 class="customer-section">1. Ficha del cliente</h4><div class="customer-form-grid">${field('name','Nombre o razón social',customer?.name||'','text','required maxlength="200"')}${field('taxId','RUC o cédula',customer?.taxId||'','text','maxlength="80"')}${field('phone','Teléfono',customer?.phone||'','tel','maxlength="80"')}${field('email','Correo',customer?.email||'','email','maxlength="254"')}</div><label>Dirección<textarea name="address" rows="2" maxlength="1000">${esc(customer?.address||'')}</textarea></label><div class="customer-form-grid">${field('contact','Persona de contacto',customer?.contact||'','text','maxlength="200"')}${field('seller','Vendedor asignado',customer?.seller||'','text','maxlength="200"')}</div><h4 class="customer-section">2. Condiciones comerciales</h4><div class="customer-form-grid"><label>Tipo de cliente<select name="paymentType"><option value="contado">Al contado</option><option value="credito">Crédito</option></select></label>${field('currency','Moneda',customer?.currency||S.cfg.cur||'C$','text','required maxlength="20"')}</div><div class="customer-form-grid" id="customer-credit">${field('creditLimit','Límite de crédito',customer?.creditLimit||0,'number','required min="0" max="999999999999" step="0.01"')}<label>Plazo de crédito<select name="creditDays">${[15,30,45].map(days=>`<option value="${days}" ${days===(customer?.creditDays||30)?'selected':''}>${days} días</option>`).join('')}</select></label></div><label>Estado<select name="status">${Object.entries(CUSTOMER_STATES).map(([value,label])=>`<option value="${value}" ${value===(customer?.status||'activo')?'selected':''}>${label}</option>`).join('')}</select></label><h4 class="customer-section">3. Notas internas</h4><label>Notas<textarea name="notes" rows="3" maxlength="4000" placeholder="Acuerdos, referencias e indicaciones para tu equipo">${esc(customer?.notes||'')}</textarea></label>`+notice('Solo los clientes activos se ofrecen para nuevas ventas. Las notas internas no se imprimen. Un límite de crédito mayor que cero se valida al emitir ventas a crédito.'),fields=>{
    if(!editable)return 'Tu acceso es de solo lectura.';
    const name=v(fields,'name').trim(),taxId=v(fields,'taxId').trim(),creditLimit=Number(v(fields,'creditLimit'));
    if(!name)return 'Escribe el nombre o razón social.';
    if(taxId&&(S.customers||[]).some(record=>record.id!==customer?.id&&record.taxId.toLowerCase()===taxId.toLowerCase()))return 'Ya existe un cliente con ese RUC o cédula.';
    if(!Number.isFinite(creditLimit)||creditLimit<0||creditLimit>999999999999)return 'Revisa el límite de crédito.';
    const record={id:customer?.id||uid(),name,taxId,phone:v(fields,'phone').trim(),email:v(fields,'email').trim(),address:v(fields,'address').trim(),contact:v(fields,'contact').trim(),seller:v(fields,'seller').trim(),paymentType:v(fields,'paymentType'),currency:v(fields,'currency').trim(),creditLimit:r2(creditLimit),creditDays:Number(v(fields,'creditDays')),status:v(fields,'status'),notes:v(fields,'notes').trim()};
    if(!record.currency)return 'Escribe la moneda.';
    if(customer)Object.assign(customer,record);else S.customers.push(record);
    save();view();
  },'Guardar cliente');
  form.elements.paymentType.value=customer?.paymentType||'contado';
  const updateCredit=()=>{form.querySelector('#customer-credit').hidden=form.elements.paymentType.value!=='credito'};
  updateCredit();form.elements.paymentType.addEventListener('change',updateCredit);
  if(!editable){for(const control of form.elements)if(control.name)control.disabled=true;form.querySelector('.mf button:last-child').hidden=true}
}
ACT.newCustomer=()=>customerForm(null);
ACT.editCustomer=data=>{const customer=customerById(data.id);if(customer)customerForm(customer)};
ACT.printSale=(data,button)=>{
  const form=button.closest('form');if(!form.reportValidity())return;
  const items=readItems();
  if(!items.length||items.some(item=>!prod(item.p)||!Number.isFinite(item.q)||item.q<=0||!Number.isFinite(item.u)||item.u<0||!Number.isFinite(item.vatRate)||item.vatRate<0||item.vatRate>100))throw new Error('Agrega productos válidos antes de imprimir.');
  const totals=taxTotals(items);if(totals.total<=0)throw new Error('El total debe ser mayor que cero.');
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
