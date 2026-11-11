'use strict';
// Keep the existing invoice rows and calculation contract; edit a detached draft.
ACT.posAdd=(data,button)=>openInvoiceProducts(button.closest('form'),button);
function openInvoiceProducts(form,opener){
 const dialog=document.createElement('dialog');dialog.className='invoice-products';dialog.setAttribute('aria-label','Selección de productos para la factura');
 const draft=document.createElement('div');draft.innerHTML=form.querySelector('#pos-items').innerHTML;
 // innerHTML does not include edited input values.
 [...form.querySelectorAll('.pos-item')].forEach((row,i)=>{for(const input of row.querySelectorAll('input,select')){const copy=draft.children[i].querySelector(`[name="${input.name}"]`);if(copy)copy.value=input.value;}});
 let sort='name',direction=1,cursor=-1,visible=[],page=0;const pageSize=40;
 dialog.innerHTML=`<header><h2>Agregar productos</h2><button type="button" class="lk" data-cancel aria-label="Cerrar selector">Cerrar</button></header><div class="product-tools"><label>Buscar producto<input type="search" autocomplete="off" maxlength="200" placeholder="Nombre, código o código de barras" aria-label="Buscar producto" aria-controls="invoice-catalog"></label><button type="button" class="btn ghost" data-scan>Escanear código de barras</button></div><p class="product-feedback" role="status" aria-live="polite"></p><label class="product-mobile-sort">Ordenar por<select data-mobile-sort><option value="name">Nombre</option><option value="code">Código</option><option value="barcodes">Código de barras</option><option value="unit">Unidad</option><option value="price">Precio</option><option value="stock">Existencias</option></select><button type="button" data-direction>Invertir orden</button></label><div class="product-catalog"><table id="invoice-catalog"><thead><tr>${[['code','Código'],['name','Nombre'],['barcodes','Código de barras'],['unit','Unidad'],['price','Precio'],['stock','Existencias']].map(([key,title])=>`<th scope="col"><button type="button" data-sort="${key}">${title}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div><nav class="product-pages" aria-label="Páginas de productos"><button type="button" data-prev>Anterior</button><span></span><button type="button" data-next>Siguiente</button></nav><section class="product-selected"><h3>En la factura (editable)</h3><div></div></section><footer><strong aria-live="polite"></strong><div><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn" data-done>Listo</button></div></footer>`;
 document.body.append(dialog);const input=dialog.querySelector('input'),feedback=dialog.querySelector('.product-feedback');
 const rows=()=>[...draft.querySelectorAll('.pos-item')].filter(r=>r.querySelector('[name=posProduct]').value);
 const find=id=>rows().find(r=>r.querySelector('[name=posProduct]').value===id);
 const coarse=matchMedia('(pointer:coarse)').matches;let bluetooth=false;
 input.inputMode=coarse?'none':'search';
 const focus=()=>{if(!coarse||bluetooth){if(coarse)input.inputMode='none';input.focus({preventScroll:true});}};
 input.addEventListener('pointerdown',()=>{input.inputMode='search';});
 if(coarse){
  const reader=document.createElement('button');reader.type='button';reader.className='lk';reader.textContent=uiT('invoiceProducts.bluetooth','Usar lector Bluetooth');reader.setAttribute('aria-pressed','false');
  reader.addEventListener('click',()=>{bluetooth=!bluetooth;reader.setAttribute('aria-pressed',String(bluetooth));if(bluetooth)focus();else reader.focus();});dialog.querySelector('.product-tools').append(reader);
 }
 const viewport=window.visualViewport;
 const fit=()=>{dialog.style.setProperty('--picker-height',(viewport?.height||innerHeight)+'px');dialog.classList.toggle('keyboard-open',!!viewport&&viewport.height<innerHeight-100);if(dialog.contains(document.activeElement))document.activeElement.scrollIntoView({block:'nearest'});};
 viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);
 dialog.addEventListener('focusin',fit);fit();
 const tell=message=>{feedback.textContent=message;if(SCANNER?.host)SCANNER.host.querySelector('#camera-status').textContent=message;};
 function renderCatalog(){
  const query=normalizeSearch(input.value);visible=S.products.filter(p=>normalizeSearch([p.name,p.code,...p.barcodes||[]].join(' ')).includes(query)).sort((a,b)=>direction*(typeof a[sort]==='number'?a[sort]-b[sort]:String(a[sort]||'').localeCompare(String(b[sort]||''),'es',{numeric:true})));
  page=Math.max(0,Math.min(page,Math.ceil(visible.length/pageSize)-1));cursor=-1;
  dialog.querySelector('tbody').innerHTML=visible.slice(page*pageSize,(page+1)*pageSize).map(p=>`<tr data-product="${esc(p.id)}" tabindex="0" aria-label="Agregar ${esc(p.name)}"><td data-label="Código">${esc(p.code||'—')}</td><td data-label="Nombre">${esc(p.name)}</td><td data-label="Barras">${esc((p.barcodes||[]).join(', ')||'—')}</td><td data-label="Unidad">${esc(p.unit||'unidad')}</td><td data-label="Precio">${esc(money(p.price))}</td><td data-label="Existencias" class="${p.kind==='service'||p.stock>0?'ok':'bad'}">${p.kind==='service'?'Servicio':esc(p.stock)}</td></tr>`).join('')||'<tr><td colspan="6">No se encontraron productos.</td></tr>';
  dialog.querySelector('.product-pages span').textContent=`${visible.length} productos · Página ${page+1} de ${Math.max(1,Math.ceil(visible.length/pageSize))}`;
  dialog.querySelector('[data-prev]').disabled=page===0;dialog.querySelector('[data-next]').disabled=(page+1)*pageSize>=visible.length;
  for(const th of dialog.querySelectorAll('th'))th.setAttribute('aria-sort',th.querySelector('button').dataset.sort===sort?(direction===1?'ascending':'descending'):'none');
 }
 function renderSelected(){
  dialog.querySelector('.product-selected>div').innerHTML=rows().map(r=>{const p=prod(r.querySelector('[name=posProduct]').value),q=+r.querySelector('[name=posQuantity]').value,u=+r.querySelector('[name=posPrice]').value;return `<div class="product-choice" data-chosen="${esc(p.id)}"><b>${esc(p.name)}</b><div class="product-quantity"><button type="button" data-delta="-1" aria-label="Restar ${esc(p.name)}">−</button><input type="number" min="0.001" step="any" value="${esc(q)}" aria-label="Cantidad de ${esc(p.name)}"><button type="button" data-delta="1" aria-label="Sumar ${esc(p.name)}">+</button></div><span>${esc(money(operationalRound(q*u)))}</span><button type="button" class="lk" data-remove>Quitar</button></div>`}).join('')||'<p class="mut">Agrega productos a la factura.</p>';
  let total=0,count=0;for(const r of rows()){const q=+r.querySelector('[name=posQuantity]').value;count+=q;total+=operationalRound(q*(+r.querySelector('[name=posPrice]').value));}
  const insufficient=rows().some(r=>{const p=prod(r.querySelector('[name=posProduct]').value);return p?.kind!=='service'&&p?.stock<+r.querySelector('[name=posQuantity]').value;});if(insufficient)tell('Existencias insuficientes'+(S.cfg.allowNegativeValues===true?' · se permite saldo negativo':''));
  dialog.querySelector('footer strong').textContent=`${formatQuantity(count)} productos · Total ${money(operationalRound(total))}`;
 }
 function add(product){
  let row=find(product.id),q=(row?+row.querySelector('[name=posQuantity]').value:0)+1;
  if(product.kind!=='service'&&q>product.stock&&S.cfg.allowNegativeValues!==true){tell('Existencias insuficientes: '+product.name);focus();return;}
  if(!row){draft.insertAdjacentHTML('beforeend',posRow());row=draft.lastElementChild;row.querySelector('[name=posProduct]').value=product.id;row.querySelector('[name=posPrice]').value=form.foodMath?.businessSeasonPrice(product,S.businessRecords,v(form,'date'))??product.price;if(typeof commerceActive==='function'&&commerceActive()&&typeof cmConfig==='function'){const list=cmConfig(product.id)?.customerPrices.find(l=>l.customerIds.includes(v(form,'customerId')));if(list)row.querySelector('[name=posPrice]').value=list.unitCents/100;}}
  row.querySelector('[name=posQuantity]').value=quantityRound(q);renderSelected();tell(product.kind!=='service'&&q>product.stock?'Existencias insuficientes · se permite saldo negativo':product.name+' agregado');input.value='';renderCatalog();focus();
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
   for(const row of [...draft.children])if(!row.querySelector('[name=posProduct]').value)row.remove();form.querySelector('#pos-items').replaceChildren(...draft.children);form.dispatchEvent(new Event('input',{bubbles:true}));form.discountAuthorization='';form.querySelector('.discount-feedback').textContent='Autoriza el descuento después de revisar productos y precios.';previewPos(form);close();
  }else if(b.hasAttribute('data-scan')){await openScanner(scan);if(SCANNER){dialog.append(SCANNER.host);const physical=SCANNER.host.querySelector('#physical-scan');if(physical){physical.inputMode=coarse?'none':'search';physical.addEventListener('pointerdown',()=>{physical.inputMode='search';});if(!coarse||bluetooth)physical.focus();else SCANNER.host.querySelector('button')?.focus();}}}
  else if(b.hasAttribute('data-direction')){direction=-direction;renderCatalog();focus();}
  else if(b.dataset.sort){direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort;renderCatalog();focus();}
  else if(b.hasAttribute('data-prev')||b.hasAttribute('data-next')){page+=b.hasAttribute('data-prev')?-1:1;renderCatalog();focus();}
  else if(b.closest('[data-chosen]')){const choice=b.closest('[data-chosen]'),row=find(choice.dataset.chosen);if(b.hasAttribute('data-remove'))row.remove();else{const next=quantityRound(+row.querySelector('[name=posQuantity]').value+Number(b.dataset.delta)),p=prod(choice.dataset.chosen);if(next>p.stock&&p.kind!=='service'&&S.cfg.allowNegativeValues!==true){tell('Existencias insuficientes: '+p.name);focus();return;}if(next<=0)row.remove();else row.querySelector('[name=posQuantity]').value=next;}renderSelected();focus();}
 });
 dialog.addEventListener('input',e=>{
  const choice=e.target.closest('[data-chosen]');if(!choice)return;
  const q=Number(e.target.value),row=find(choice.dataset.chosen);if(!Number.isFinite(q)||q<=0)return;
  try{row.querySelector('[name=posQuantity]').value=inputQuantity(q);}catch(error){tell(error.message);return;}
  choice.querySelector('span').textContent=money(operationalRound(q*+row.querySelector('[name=posPrice]').value));
  const count=rows().reduce((s,r)=>s+Number(r.querySelector('[name=posQuantity]').value),0),total=rows().reduce((s,r)=>s+operationalRound(+r.querySelector('[name=posQuantity]').value*+r.querySelector('[name=posPrice]').value),0);
  dialog.querySelector('footer strong').textContent=`${formatQuantity(count)} productos · Total ${money(operationalRound(total))}`;
  const p=prod(choice.dataset.chosen);if(p.kind!=='service'&&q>p.stock)tell('Existencias insuficientes'+(S.cfg.allowNegativeValues===true?' · se permite saldo negativo':''));
 });
 dialog.addEventListener('change',e=>{if(e.target.hasAttribute('data-mobile-sort')){sort=e.target.value;direction=1;renderCatalog();focus();return;}if(!e.target.closest('[data-chosen]'))return;const row=find(e.target.closest('[data-chosen]').dataset.chosen),q=Number(e.target.value);try{if(Number.isFinite(q)&&q>0)row.querySelector('[name=posQuantity]').value=inputQuantity(q);else tell('Indica una cantidad mayor que cero.');}catch(error){tell(error.message);}renderSelected();focus();});
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
  const text=el.textContent.trim();el.classList.toggle('negative-value',S?.cfg?.allowNegativeValues===true&&(/^(?:[^\d−-]{0,12})[-−]\s*\d/.test(text)||/^\([^\d]*\d[\d,. ]*\)$/.test(text)));
 }
 const main=document.querySelector('#main');
 if(main&&CO?.id&&S?.cfg?.allowNegativeValues===true&&!main.querySelector('[data-negative-notice]')){const warning=document.createElement('p');warning.dataset.negativeNotice='';warning.className='negative-warning';warning.textContent='Valores negativos permitidos en esta empresa. Existencias o fondos insuficientes no bloquean los movimientos; revisa los saldos reales.';main.prepend(warning);}
 else if(main&&S?.cfg?.allowNegativeValues!==true)main.querySelector('[data-negative-notice]')?.remove();
}
new MutationObserver(()=>{if(!negativePaintPending){negativePaintPending=true;requestAnimationFrame(paintNegativeFigures);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
