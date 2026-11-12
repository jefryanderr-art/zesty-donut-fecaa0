'use strict';
// Keep the existing invoice rows and calculation contract; edit a detached draft.
ACT.posAdd=(data,button)=>openInvoiceProducts(button.closest('form'),button);
ACTION_MODULE.purchaseProducts='compras';
ACT.purchaseProducts=(data,button)=>openInvoiceProducts(button.closest('form'),button,'compra');
function preparePurchaseProductRow(row){
 const select=row.querySelector('[name=p]'),product=prod(select.value);
 select.hidden=true;select.tabIndex=-1;
 let name=row.querySelector('.purchase-product-name');
 if(!name){name=document.createElement('b');name.className='purchase-product-name';row.prepend(name);}
 name.textContent=product?product.name+' · '+(product.unit||'unidad'):'';
 row.querySelector('[name=u]').setAttribute('aria-label','Costo unitario');
 row.querySelector('[name=u]').placeholder='Costo unitario';
}
function openInvoiceProducts(form,opener,mode='factura'){
 const purchase=mode==='compra',container=form.querySelector(purchase?'.items':'#pos-items'),rowSelector=purchase?'.item':'.pos-item';
 const productField=purchase?'p':'posProduct',quantityField=purchase?'q':'posQuantity',priceField=purchase?'u':'posPrice';
 const priceLabel=purchase?'Costo':'Precio',totalLabel=purchase?'Total compra':'Total';
 const dialog=document.createElement('dialog');dialog.className='invoice-products';dialog.dataset.mode=mode;dialog.setAttribute('aria-label',purchase?'Selección de productos para la compra':'Selección de productos para la factura');
 const draft=document.createElement('div');draft.append(...[...container.children].map(row=>row.cloneNode(true)));
 // innerHTML does not include edited input values.
 [...container.querySelectorAll(rowSelector)].forEach((row,i)=>{for(const input of row.querySelectorAll('input,select')){const copy=draft.children[i].querySelector(`[name="${input.name}"]`);if(copy){copy.value=input.value;if(input.type==='checkbox')copy.checked=input.checked;}}});
 let sort='name',direction=1,cursor=-1,visible=[],page=0;const pageSize=40;
 dialog.innerHTML=`<header><h2>Agregar productos</h2><button type="button" class="lk" data-cancel aria-label="Cerrar selector">Cerrar</button></header><div class="product-tools"><label>Buscar producto<input type="search" autocomplete="off" maxlength="200" placeholder="Nombre, código o código de barras" aria-label="Buscar producto" aria-controls="invoice-catalog"></label><button type="button" class="btn ghost" data-scan>Escanear código de barras</button></div><p class="product-feedback" role="status" aria-live="polite"></p><label class="product-mobile-sort">Ordenar por<select data-mobile-sort><option value="name">Nombre</option><option value="code">Código</option><option value="barcodes">Código de barras</option><option value="unit">Unidad</option><option value="price">${priceLabel}</option><option value="stock">Existencias</option></select><button type="button" data-direction>Invertir orden</button></label><div class="product-workspace"><section class="product-results"><div class="product-catalog"><table id="invoice-catalog"><thead><tr>${[['code','Código'],['name','Nombre'],['barcodes','Código de barras'],['unit','Unidad'],['price',priceLabel],['stock','Existencias']].map(([key,title])=>`<th scope="col"><button type="button" data-sort="${key}">${title}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div><nav class="product-pages" aria-label="Páginas de productos"><button type="button" data-prev>Anterior</button><span></span><button type="button" data-next>Siguiente</button></nav></section><section class="product-selected"><h3>${purchase?'En la compra':'En la factura (editable)'}</h3><div></div></section></div><footer><strong aria-live="polite"></strong><div><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn" data-done>Listo</button></div></footer>`;
 document.body.append(dialog);const input=dialog.querySelector('input'),feedback=dialog.querySelector('.product-feedback');
 const rows=()=>[...draft.querySelectorAll(rowSelector)].filter(r=>r.querySelector(`[name=${productField}]`).value);
 const find=id=>rows().find(r=>r.querySelector(`[name=${productField}]`).value===id);
 const coarse=matchMedia('(any-pointer:coarse)').matches;
 const readerMode=bindBluetoothSearch(input,dialog.querySelector('.product-tools'));
 const focus=()=>readerMode.focus();
 const viewport=window.visualViewport;
 const fit=()=>{dialog.style.setProperty('--picker-height',(viewport?.height||innerHeight)+'px');dialog.style.setProperty('--picker-top',(viewport?.offsetTop||0)+'px');dialog.classList.toggle('keyboard-open',coarse&&!!viewport&&viewport.height<innerHeight-100);};
 viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);
 dialog.addEventListener('focusin',fit);fit();
 const tell=message=>{feedback.textContent=message;if(SCANNER?.host)SCANNER.host.querySelector('#camera-status').textContent=message;};
 function renderCatalog(){
  const query=normalizeSearch(input.value);visible=S.products.filter(p=>normalizeSearch([p.name,p.code,...p.barcodes||[]].join(' ')).includes(query)).sort((a,b)=>direction*(typeof a[sort]==='number'?(purchase&&sort==='price'?a.cost:a[sort])-(purchase&&sort==='price'?b.cost:b[sort]):String(a[sort]||'').localeCompare(String(b[sort]||''),'es',{numeric:true})));
  page=Math.max(0,Math.min(page,Math.ceil(visible.length/pageSize)-1));cursor=-1;
  dialog.querySelector('tbody').innerHTML=visible.slice(page*pageSize,(page+1)*pageSize).map(p=>`<tr data-product="${esc(p.id)}" tabindex="0" aria-label="Agregar ${esc(p.name)}"><td data-label="Código">${esc(p.code||'—')}</td><td data-label="Nombre">${esc(p.name)}</td><td data-label="Barras">${esc((p.barcodes||[]).join(', ')||'—')}</td><td data-label="Unidad">${esc(p.unit||'unidad')}</td><td data-label="${priceLabel}">${esc(money(purchase?p.cost:p.price))}</td><td data-label="Existencias" class="${p.kind==='service'||p.stock>0?'ok':'bad'}">${p.kind==='service'?'Servicio':esc(p.stock)}</td></tr>`).join('')||'<tr><td colspan="6">No se encontraron productos.</td></tr>';
  dialog.querySelector('.product-pages span').textContent=`${visible.length} productos · Página ${page+1} de ${Math.max(1,Math.ceil(visible.length/pageSize))}`;
  dialog.querySelector('[data-prev]').disabled=page===0;dialog.querySelector('[data-next]').disabled=(page+1)*pageSize>=visible.length;
  for(const th of dialog.querySelectorAll('th'))th.setAttribute('aria-sort',th.querySelector('button').dataset.sort===sort?(direction===1?'ascending':'descending'):'none');
 }
 const lineAmount=(q,u)=>purchase?q*u:operationalRound(q*u);
 const roundedTotal=total=>purchase?r2(total):operationalRound(total);
 function renderSelected(){
  dialog.querySelector('.product-selected>div').innerHTML=rows().map((r,index)=>{const p=prod(r.querySelector(`[name=${productField}]`).value),q=+r.querySelector(`[name=${quantityField}]`).value,u=+r.querySelector(`[name=${priceField}]`).value;return `<div class="product-choice" data-chosen="${index}"><b>${esc(p.name)} <small>· ${esc(p.unit||'unidad')}</small></b><div class="product-quantity"><button type="button" data-delta="-1" aria-label="Restar ${esc(p.name)}">−</button><input type="text" inputmode="decimal" data-decimal autocomplete="off" value="${esc(q)}" aria-label="Cantidad de ${esc(p.name)}"><button type="button" data-delta="1" aria-label="Sumar ${esc(p.name)}">+</button></div>${purchase?`<label class="product-cost">Costo<input type="number" data-cost min="0" step="0.01" required value="${esc(u)}" aria-label="Costo de ${esc(p.name)}"></label>`:''}<span data-line-total>${esc(money(roundedTotal(lineAmount(q,u))))}</span><button type="button" class="lk" data-remove>Quitar</button></div>`}).join('')||`<p class="mut">Agrega productos a la ${purchase?'compra':'factura'}.</p>`;
  let total=0,count=0;for(const r of rows()){const q=+r.querySelector(`[name=${quantityField}]`).value;count+=q;total+=lineAmount(q,+r.querySelector(`[name=${priceField}]`).value);}
  const insufficient=!purchase&&rows().some(r=>{const p=prod(r.querySelector(`[name=${productField}]`).value);return p?.kind!=='service'&&p?.stock<+r.querySelector(`[name=${quantityField}]`).value;});if(insufficient)tell('Existencias insuficientes'+(S.cfg.allowNegativeValues===true?' · se permite saldo negativo':''));
  dialog.querySelector('footer strong').textContent=`${formatQuantity(count)} productos · ${totalLabel} ${money(roundedTotal(total))}`;
 }
 const stepFor=(p,current)=>{
  if(purchase||p.kind==='service'||S.cfg.allowNegativeValues===true)return 1;
  const remaining=quantityRound(p.stock-current);
  return remaining>0?Math.min(1,remaining):0;
 };
 function add(product){
  let row=find(product.id);const current=row?+row.querySelector(`[name=${quantityField}]`).value:0,step=stepFor(product,current);
  if(step===0){tell('Existencias insuficientes: '+product.name);focus();return;}
  const q=quantityRound(current+step);
  if(!row){draft.insertAdjacentHTML('beforeend',purchase?itemRow({p:product.id,q:1,u:product.cost},true):posRow());row=draft.lastElementChild;row.querySelector(`[name=${productField}]`).value=product.id;if(!purchase){row.querySelector(`[name=${priceField}]`).value=form.foodMath?.businessSeasonPrice(product,S.businessRecords,v(form,'date'))??product.price;if(typeof commerceActive==='function'&&commerceActive()&&typeof cmConfig==='function'){const list=cmConfig(product.id)?.customerPrices.find(l=>l.customerIds.includes(v(form,'customerId')));if(list)row.querySelector(`[name=${priceField}]`).value=list.unitCents/100;}}else preparePurchaseProductRow(row);}
  row.querySelector(`[name=${quantityField}]`).value=quantityRound(q);renderSelected();tell(!purchase&&product.kind!=='service'&&q>product.stock?'Existencias insuficientes · se permite saldo negativo':product.name+' agregado');input.value='';renderCatalog();focus();
 }
 function scan(code){const p=S.products.find(p=>(p.barcodes||[]).includes(String(code).trim())||p.code===String(code).trim());if(p)add(p);else{tell('El código escaneado no existe.');input.value='';renderCatalog();focus();}}
 function close(){viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);if(SCANNER)closeScanner();dialog.close();dialog.remove();form.inert=false;opener?.focus();}
 input.addEventListener('input',()=>{page=0;renderCatalog();});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.target===input&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const list=[...dialog.querySelectorAll('[data-product]')];cursor=Math.max(0,Math.min(list.length-1,cursor+(e.key==='ArrowDown'?1:-1)));list.forEach((r,i)=>r.classList.toggle('selected',i===cursor));list[cursor]?.scrollIntoView({block:'nearest'});}
  if(e.key==='Enter'&&(e.target===input||e.target.matches('[data-product]'))){e.preventDefault();e.stopPropagation();if(e.target.dataset.product)add(prod(e.target.dataset.product));else if(cursor>=0){const row=dialog.querySelectorAll('[data-product]')[cursor];if(row)add(prod(row.dataset.product));}else scan(input.value);}
 },{capture:true});
 dialog.addEventListener('click',async e=>{
  const b=e.target.closest('button'),product=e.target.closest('[data-product]');if(product){add(prod(product.dataset.product));return;}if(!b)return;
  if(b.hasAttribute('data-cancel'))close();
  else if(b.hasAttribute('data-done')){
   if(purchase){for(const field of dialog.querySelectorAll('.product-selected input'))if(!field.reportValidity())return;}
   for(const row of [...draft.children])if(!row.querySelector(`[name=${productField}]`).value)row.remove();container.replaceChildren(...draft.children);if(purchase){container.querySelectorAll('.item').forEach(preparePurchaseProductRow);close();return;}form.dispatchEvent(new Event('input',{bubbles:true}));form.discountAuthorization='';form.querySelector('.discount-feedback').textContent='Autoriza el descuento después de revisar productos y precios.';previewPos(form);close();
  }else if(b.hasAttribute('data-scan')){await openScanner(scan);if(SCANNER){dialog.append(SCANNER.host);const physical=SCANNER.host.querySelector('#physical-scan');if(physical){physical.inputMode=coarse?'none':'search';physical.addEventListener('pointerdown',()=>{physical.inputMode='search';});if(!coarse||readerMode.bluetooth)physical.focus();else SCANNER.host.querySelector('button')?.focus();}}}
  else if(b.hasAttribute('data-direction')){direction=-direction;renderCatalog();focus();}
  else if(b.dataset.sort){direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort;renderCatalog();focus();}
  else if(b.hasAttribute('data-prev')||b.hasAttribute('data-next')){page+=b.hasAttribute('data-prev')?-1:1;renderCatalog();focus();}
  else if(b.closest('[data-chosen]')){const choice=b.closest('[data-chosen]'),row=rows()[Number(choice.dataset.chosen)];if(b.hasAttribute('data-remove'))row.remove();else{const p=prod(row.querySelector(`[name=${productField}]`).value),current=+row.querySelector(`[name=${quantityField}]`).value,step=Number(b.dataset.delta)>0?stepFor(p,current):-1;if(step===0){tell('Existencias insuficientes: '+p.name);focus();return;}const next=quantityRound(current+step);if(!purchase&&next>p.stock&&p.kind!=='service'&&S.cfg.allowNegativeValues!==true){tell('Existencias insuficientes: '+p.name);focus();return;}if(next<=0)row.remove();else row.querySelector(`[name=${quantityField}]`).value=next;}renderSelected();focus();}
 });
 dialog.addEventListener('input',e=>{
  const choice=e.target.closest('[data-chosen]');if(!choice)return;
  const row=rows()[Number(choice.dataset.chosen)];if(e.target.hasAttribute('data-cost')){if(!e.target.checkValidity())return;row.querySelector(`[name=${priceField}]`).value=e.target.value;updateSummary(choice,row);return;}const q=Number(e.target.value);if(purchase)e.target.setCustomValidity(Number.isFinite(q)&&q>=0.001?'':'La cantidad mínima es 0.001.');if(!Number.isFinite(q)||q<=0)return;
  try{row.querySelector(`[name=${quantityField}]`).value=inputQuantity(q);}catch(error){tell(error.message);return;}
  updateSummary(choice,row);
  if(!purchase&&prod(row.querySelector(`[name=${productField}]`).value).kind!=='service'&&q>prod(row.querySelector(`[name=${productField}]`).value).stock)tell('Existencias insuficientes'+(S.cfg.allowNegativeValues===true?' · se permite saldo negativo':''));
 });
 function updateSummary(choice,row){
  const q=+row.querySelector(`[name=${quantityField}]`).value;choice.querySelector('[data-line-total]').textContent=money(roundedTotal(lineAmount(q,+row.querySelector(`[name=${priceField}]`).value)));
  const count=rows().reduce((s,r)=>s+Number(r.querySelector(`[name=${quantityField}]`).value),0),total=rows().reduce((s,r)=>s+lineAmount(+r.querySelector(`[name=${quantityField}]`).value,+r.querySelector(`[name=${priceField}]`).value),0);
  dialog.querySelector('footer strong').textContent=`${formatQuantity(count)} productos · ${totalLabel} ${money(roundedTotal(total))}`;
 }
 dialog.addEventListener('change',e=>{if(e.target.hasAttribute('data-mobile-sort')){sort=e.target.value;direction=1;renderCatalog();focus();return;}if(!e.target.closest('[data-chosen]'))return;if(e.target.hasAttribute('data-cost'))return;if(purchase&&!e.target.checkValidity())return;const row=rows()[Number(e.target.closest('[data-chosen]').dataset.chosen)],q=Number(e.target.value);try{if(Number.isFinite(q)&&q>0)row.querySelector(`[name=${quantityField}]`).value=inputQuantity(q);else tell('Indica una cantidad mayor que cero.');}catch(error){tell(error.message);}renderSelected();focus();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});form.inert=true;dialog.querySelector('[data-cancel]').autofocus=true;dialog.showModal();renderCatalog();renderSelected();focus();
}
const negativeSettingsView=V.ajustes;
V.ajustes=async function(){await negativeSettingsView();if(R!=='ajustes'||!CO.owner||CO.support||!permission('ajustes',true))return;
 const card=document.createElement('section');card.className='card';card.innerHTML=`<h3>Respaldo / Inventario</h3><form><label class="ck"><input type="checkbox" name="allowNegativeValues" role="switch" ${CO.allowNegativeValues?'checked':''}> Permitir valores negativos (existencias, efectivo, utilidad y saldos)</label><p class="mut">Permite movimientos sin existencias o fondos suficientes solo en esta empresa. Los asientos siguen debiendo cuadrar. Desactivado por defecto; verifica con tu contador.</p><p role="status" class="negative-warning" ${CO.allowNegativeValues?'':'hidden'}>Valores negativos permitidos. Revisa las existencias y los saldos reales antes de registrar movimientos.</p><p class="err" role="status"></p><button class="btn">Guardar configuración</button></form>`;$('#main').append(card);
 card.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=card.querySelector('button');button.disabled=true;try{const enabled=card.querySelector('input').checked;await operate('settings',{allowNegativeValues:enabled});CO.allowNegativeValues=enabled;S.cfg.allowNegativeValues=enabled;view();}catch(error){card.querySelector('.err').textContent=error.message;}finally{button.disabled=false;}};
};
// Mark rendered signed figures without changing money strings, exports or accounting math.
let negativePaintPending=false;
function paintNegativeFigures(){
 negativePaintPending=false;
 for(const el of document.querySelectorAll('#main td,#main .kpi b,#main .kpi strong,#main .grid b,#main .grid strong,#modal td,#modal .pos-line-total')){
  const text=el.textContent.trim();el.classList.toggle('negative-value',!el.querySelector('[data-money]')&&(/^(?:[-−][^\d]*|[^\d−-]{0,12}[-−]\s*)\d/.test(text)));
 }
 const main=document.querySelector('#main');
 if(main&&CO?.id&&S?.cfg?.allowNegativeValues===true&&!main.querySelector('[data-negative-notice]')){const warning=document.createElement('p');warning.dataset.negativeNotice='';warning.className='negative-warning';warning.textContent='Valores negativos permitidos en esta empresa. Existencias o fondos insuficientes no bloquean los movimientos; revisa los saldos reales.';main.prepend(warning);}
 else if(main&&S?.cfg?.allowNegativeValues!==true)main.querySelector('[data-negative-notice]')?.remove();
}
new MutationObserver(()=>{if(!negativePaintPending){negativePaintPending=true;requestAnimationFrame(paintNegativeFigures);}}).observe(document.body,{childList:true,subtree:true,characterData:true});

// All settings extensions keep their own permission checks; only move their existing nodes.
const orderedSettingsView=V.ajustes;
V.ajustes=async function(){
 const companyId=CO.id;await orderedSettingsView();
 if(R!=='ajustes'||CO?.id!==companyId)return;
 const root=$('#main'),history=$('#settings-backups');if(!history)return;
 const backup=document.createElement('section');backup.className='card settings-backups';
 const details=document.createElement('details'),summary=document.createElement('summary');
 summary.textContent=uiT('settings.backups','Versiones y respaldos');details.append(summary);
 const companyCard=root.querySelector('[data-a="cfg"]')?.closest('.card')||root.querySelector('.backup-actions')?.closest('.card');
 const actions=companyCard?.querySelector('.backup-actions');
 if(actions){
  const cfg=actions.querySelector('[data-a="cfg"]');if(cfg)companyCard.insertBefore(cfg,actions);
  backup.append(actions);
  for(const selector of ['#rf','#export-status']){const node=companyCard.querySelector(selector);if(node)backup.append(node)}
 }
 const fullPdf=root.querySelector('[data-a="fullDataPdf"]')?.closest('.card');
 if(fullPdf){backup.append(fullPdf);fullPdf.classList.remove('card')}
 details.append(...history.childNodes);history.remove();backup.append(details);root.append(backup);
 const priorities=['discountSettings','serviceSector','specializedChart'];
 const heading=root.querySelector('.ph');let anchor=heading;
 for(const action of priorities){
  const button=root.querySelector('[data-a="'+action+'"]'),card=button?.closest('.card');if(!card)continue;
  if(!card.querySelector('h3')){const title=document.createElement('h3');title.textContent=button.textContent;card.prepend(title)}
  if(anchor)anchor.after(card);else root.prepend(card);anchor=card;
 }
 if(heading)root.prepend(heading);
};
