'use strict';
// Selección efímera: las condiciones y el vencimiento pertenecen al flujo de la factura.
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-invoice-customers]');
 if(button){event.preventDefault();openInvoiceCustomers(button.closest('form'),button);}
});
function openInvoiceCustomers(form,opener){
 const t=(key,fallback)=>uiT('invoiceCustomers.'+key,fallback);
 const dialog=document.createElement('dialog');dialog.className='invoice-customers';dialog.setAttribute('aria-label',t('title','Buscar cliente'));
 dialog.innerHTML=`<header><h2>${esc(t('title','Buscar cliente'))}</h2><button type="button" class="btn ghost" data-picker-close>${esc(t('close','Cerrar'))}</button></header><div class="invoice-customer-tools"><label>${esc(t('search','Nombre, RUC/cédula o teléfono'))}<input type="search" maxlength="200" autocomplete="off" aria-controls="invoice-customer-list"></label><label>${esc(uiT('customers.12','Tipo'))}<select><option value="">${esc(uiT('customers.13','Todos'))}</option><option value="credito">${esc(uiT('customers.14','Crédito'))}</option><option value="contado">${esc(uiT('customers.15','Contado'))}</option></select></label></div><p role="status" aria-live="polite" data-picker-count></p><div class="invoice-customer-list" id="invoice-customer-list"></div><div class="invoice-customer-actions"><nav aria-label="${esc(t('pages','Páginas de clientes'))}"><button type="button" class="btn ghost" data-prev>${esc(t('previous','Anterior'))}</button><button type="button" class="btn ghost" data-next>${esc(t('next','Siguiente'))}</button></nav>${actionAllowed('newCustomer')?`<footer><button type="button" class="btn" data-picker-new>${esc(t('new','+ Nuevo cliente'))}</button></footer>`:''}</div>`;
 const search=dialog.querySelector('input'),filter=dialog.querySelector('select');let page=0;
 filter.value=form.elements.py?.value==='1201'||form.querySelector('[name=usePayment][value=credito]')?.checked?'credito':'';
 const touchDevice=window.matchMedia('(any-pointer: coarse)').matches;
 const viewport=window.visualViewport;
 function fitViewport(){
  if(!viewport)return;
  dialog.style.setProperty('--picker-visible-height',viewport.height+'px');
  dialog.style.setProperty('--picker-visible-top',viewport.offsetTop+'px');
  dialog.classList.toggle('keyboard-open',touchDevice&&viewport.height<window.innerHeight*0.8);
 }
 function close(){viewport?.removeEventListener('resize',fitViewport);viewport?.removeEventListener('scroll',fitViewport);dialog.close();dialog.remove();form.inert=false;opener?.focus({preventScroll:true});}
 function choose(id){
  const customer=customerById(id);if(customer?.status!=='activo')return;
  const select=form.elements.customerId;
  if(![...select.options].some(option=>option.value===id))select.add(new Option(customer.name,id));
  select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));close();
 }
 function render(){
  const query=normalizeSearch(search.value),rows=(S.customers||[]).filter(c=>c.status==='activo'&&(!filter.value||c.paymentType===filter.value)&&normalizeSearch([c.name,c.taxId,c.phone].join(' ')).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const pages=Math.max(1,Math.ceil(rows.length/40));page=Math.max(0,Math.min(page,pages-1));
  dialog.querySelector('[data-picker-count]').textContent=`${rows.length} ${t('customers','clientes')} · ${t('page','Página')} ${page+1} / ${pages}`;
  dialog.querySelector('[data-prev]').disabled=page===0;dialog.querySelector('[data-next]').disabled=page+1>=pages;
  dialog.querySelector('.invoice-customer-list').innerHTML=rows.length?`<table><thead><tr><th scope="col">${esc(uiT('customers.18','Cliente / identificación'))}</th><th scope="col">${esc(uiT('customers.20','Condiciones'))}</th><th scope="col">${esc(t('selection','Selección'))}</th></tr></thead><tbody>${rows.slice(page*40,(page+1)*40).map(c=>`<tr data-choose="${esc(c.id)}"><td><b>${esc(c.name)}</b><span class="ledger-sub">${esc(c.taxId||t('noTaxId','Sin RUC / cédula'))}</span></td><td>${esc(uiT(c.paymentType==='credito'?'customers.14':'customers.15',c.paymentType==='credito'?'Crédito':'Contado'))}${c.paymentType==='credito'?`<span class="ledger-sub">${esc(customerCreditTerm(c.creditDays))} · ${esc(t('limit','Límite'))}: ${esc(customerMoney(c))}</span>`:''}</td><td><button type="button" class="btn ghost" data-choose="${esc(c.id)}" aria-label="${esc(t('choose','Elegir')+' '+c.name)}">${esc(t('choose','Elegir'))}</button></td></tr>`).join('')}</tbody></table>`:`<p class="mut">${esc(t('empty','No se encontraron clientes activos.'))}</p>`;
 }
 function create(){
  if(!actionAllowed('newCustomer'))return;
  // modal() reutiliza #modal: separar sus nodos conserva listeners, valores y borrador.
  const host=document.querySelector('#modal'),saved=document.createElement('div');saved.hidden=true;dialog.append(saved);saved.append(...host.childNodes);
  const sheet=document.createElement('dialog');sheet.className='invoice-customer-editor';sheet.setAttribute('aria-label',uiT('customers.6','Registrar cliente'));document.body.append(sheet);
  const restore=()=>{sheet.close();sheet.remove();host.replaceChildren(...saved.childNodes);saved.remove();dialog.querySelector('[data-picker-new]')?.focus();};
  try{customerForm(null,{
   onOpen(customerForm){sheet.append(customerForm.closest('.mo'));sheet.showModal();customerForm.elements.name.focus();},
   onSaved(record){restore();render();choose(record.id);}
  });}catch(error){restore();throw error;}
  sheet.addEventListener('click',event=>{if(event.target.closest('[data-a=close]')){event.preventDefault();event.stopImmediatePropagation();restore();}},{capture:true});
  sheet.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();restore();}},{capture:true});
  sheet.addEventListener('cancel',event=>{event.preventDefault();restore();});
 }
 search.addEventListener('input',()=>{page=0;render();});filter.addEventListener('change',()=>{page=0;render();});
 dialog.addEventListener('click',event=>{const choice=event.target.closest('[data-choose]');if(choice){choose(choice.dataset.choose);return;}const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-picker-close'))close();else if(button.dataset.choose)choose(button.dataset.choose);else if(button.hasAttribute('data-picker-new'))create();else if(button.hasAttribute('data-prev')||button.hasAttribute('data-next')){page+=button.hasAttribute('data-prev')?-1:1;render();}});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},{capture:true});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 // El foco inicial explícito evita que showModal abra el teclado táctil.
 const initialFocus=touchDevice?dialog.querySelector('[data-picker-close]'):search;
 initialFocus.setAttribute('autofocus','');
 document.body.append(dialog);form.inert=true;fitViewport();dialog.showModal();render();initialFocus.focus({preventScroll:true});
 viewport?.addEventListener('resize',fitViewport);viewport?.addEventListener('scroll',fitViewport);
}
