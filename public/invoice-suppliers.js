'use strict';
// Selección efímera; reutiliza estilos y accesibilidad del buscador de clientes.
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-invoice-suppliers]');
 if(button){event.preventDefault();openInvoiceSuppliers(button.closest('form'),button);}
});
function openInvoiceSuppliers(form,opener){
 if(!form||!form.elements[opener?.dataset.supplierSelect||'supplierId']||opener?.hidden)return;
 const t=(key,fallback)=>uiT('invoiceSuppliers.'+key,fallback);
 const dialog=document.createElement('dialog');dialog.className='invoice-customers';dialog.setAttribute('aria-label',t('title','Buscar proveedor'));
 dialog.innerHTML=`<header><h2>${esc(t('title','Buscar proveedor'))}</h2><button type="button" class="btn ghost" data-picker-close>${esc(t('close','Cerrar'))}</button></header><div class="invoice-customer-tools"><label>${esc(t('search','Nombre, RUC o teléfono'))}<input type="search" maxlength="200" autocomplete="off" aria-controls="invoice-supplier-list"></label><label>${esc(uiT('customers.12','Tipo'))}<select><option value="">${esc(uiT('customers.13','Todos'))}</option><option value="credito">${esc(uiT('customers.14','Crédito'))}</option><option value="contado">${esc(uiT('customers.15','Contado'))}</option></select></label></div><p role="status" aria-live="polite" data-picker-count></p><div class="invoice-customer-list" id="invoice-supplier-list"></div><div class="invoice-customer-actions"><nav aria-label="${esc(t('pages','Páginas de proveedores'))}"><button type="button" class="btn ghost" data-prev>${esc(t('previous','Anterior'))}</button><button type="button" class="btn ghost" data-next>${esc(t('next','Siguiente'))}</button></nav>${actionAllowed('newSupplier')?`<footer><button type="button" class="btn" data-picker-new>${esc(t('new','+ Nuevo proveedor'))}</button></footer>`:''}</div>`;
 const search=dialog.querySelector('input'),filter=dialog.querySelector('select');let page=0;
 filter.value=(form.elements.py||form.elements.pay)?.value==='2101'?'credito':'';
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
  const supplier=S.suppliers.find(record=>record.id===id);if(!supplier?.active)return;
  const select=form.elements[opener?.dataset.supplierSelect||'supplierId'];
  if(![...select.options].some(option=>option.value===id))select.add(new Option(supplier.name,id));
  select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));close();
 }
 function render(){
  const query=normalizeSearch(search.value),rows=(S.suppliers||[]).filter(c=>c.active&&(!filter.value||c.paymentType===filter.value)&&normalizeSearch([c.name,c.taxId,c.phone].join(' ')).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const pages=Math.max(1,Math.ceil(rows.length/40));page=Math.max(0,Math.min(page,pages-1));
  dialog.querySelector('[data-picker-count]').textContent=`${rows.length} ${t('suppliers','proveedores')} · ${t('page','Página')} ${page+1} / ${pages}`;
  dialog.querySelector('[data-prev]').disabled=page===0;dialog.querySelector('[data-next]').disabled=page+1>=pages;
  dialog.querySelector('.invoice-customer-list').innerHTML=rows.length?`<table><thead><tr><th scope="col">${esc(t('identification','Proveedor / identificación'))}</th><th scope="col">${esc(uiT('customers.20','Condiciones'))}</th><th scope="col">${esc(t('selection','Selección'))}</th></tr></thead><tbody>${rows.slice(page*40,(page+1)*40).map(c=>`<tr data-choose="${esc(c.id)}"><td><b>${esc(c.name)}</b><span class="ledger-sub">${esc(c.taxId||t('noTaxId','Sin RUC / cédula'))}</span></td><td>${esc(uiT(c.paymentType==='credito'?'customers.14':'customers.15',c.paymentType==='credito'?'Crédito':'Contado'))}${c.paymentType==='credito'?`<span class="ledger-sub">${esc(String(c.creditDays)+' '+t('days','días'))} · ${esc(t('limit','Límite'))}: ${esc((c.currency||S.cfg.cur)+' '+c.creditLimit)}</span>`:''}</td><td><button type="button" class="btn ghost" data-choose="${esc(c.id)}" aria-label="${esc(t('choose','Elegir')+' '+c.name)}">${esc(t('choose','Elegir'))}</button></td></tr>`).join('')}</tbody></table>`:`<p class="mut">${esc(t('empty','No se encontraron proveedores activos.'))}</p>`;
 }
 function create(){
  if(!actionAllowed('newSupplier'))return;
  // modal() reutiliza #modal: separar sus nodos conserva listeners, valores y borrador.
  const host=document.querySelector('#modal'),saved=document.createElement('div');saved.hidden=true;dialog.append(saved);saved.append(...host.childNodes);
  const sheet=document.createElement('dialog');sheet.className='invoice-customer-editor';sheet.setAttribute('aria-label',t('register','Registrar proveedor'));document.body.append(sheet);
  const restore=()=>{sheet.close();sheet.remove();host.replaceChildren(...saved.childNodes);saved.remove();dialog.querySelector('[data-picker-new]')?.focus();};
  try{supplierForm(null,{
   onOpen(supplierForm){sheet.append(supplierForm.closest('.mo'));sheet.showModal();supplierForm.elements.name.focus();},
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

// Todos los formularios conservan sus selectores y manejadores originales.
const supplierPickerModal=modal;
modal=function(...args){
 const form=supplierPickerModal.apply(this,args);
 function addPicker(select){
  if(!select||select.closest('.sale-customer-picker'))return;
  const label=select.closest('label');if(!label)return;
  const row=document.createElement('div');row.className='sale-customer-picker';label.before(row);row.append(label);
  const button=document.createElement('button');button.type='button';button.className='btn ghost';button.dataset.invoiceSuppliers='';button.dataset.supplierSelect=select.name;button.textContent=uiT('invoiceSuppliers.title','Buscar proveedor');row.append(button);
  if(select.name==='partyId'){
   const update=()=>{button.hidden=form.elements.side.value!=='supplier';};
   form.elements.side.addEventListener('change',update);update();
  }
 }
 addPicker(form.querySelector('select[name="supplierId"]'));
 if(form.elements.side&&form.elements.partyId)addPicker(form.elements.partyId);
 return form;
};
