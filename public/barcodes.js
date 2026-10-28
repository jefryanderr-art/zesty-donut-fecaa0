'use strict';
const barcodeFields=(product={})=>`<label>Códigos de barras · uno por línea<textarea name="barcodes" rows="2" maxlength="3900">${esc((product.barcodes||[]).join('\n'))}</textarea></label><button type="button" class="lk" data-a="scanAssign">Escanear para asignar código</button>`;
const readBarcodes=form=>[...new Set(v(form,'barcodes').split(/\r?\n/).map(code=>code.trim()).filter(Boolean))];
ACTION_MODULE.scanAssign='inventario';READ_ACTIONS.add('scanOpen');READ_ACTIONS.add('barcodeManage');
let SCANNER=null,SCANNER_LOAD=null;
const barcodeProduct=code=>typeof findCatalogCode==='function'?findCatalogCode(code):S.products.find(p=>(p.barcodes||[]).includes(code)||p.code===code);
const scanInput=()=>'<div class="barcode-search"><label>Escanear o buscar<input name="barcodeSearch" type="search" autocomplete="off" maxlength="128" placeholder="Código de barras o nombre · Enter"></label><button type="button" class="btn ghost" data-a="scanOpen">Escanear productos</button><p class="scan-feedback" role="status" aria-live="polite"></p></div>';
function barcodeFeedback(message,form){const target=form?.querySelector('.scan-feedback')||$('.scan-feedback');if(target)target.textContent=message;const status=$('#camera-status');if(status)status.textContent=message}
function focusScan(form){if(window.matchMedia('(pointer: coarse)').matches)return;const input=form?.querySelector('[name=barcodeSearch]')||$('#main [name=barcodeSearch]');if(input&&!SCANNER&&(!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||document.activeElement===input))input.focus()}
async function quickBarcodeProduct(code,callback){
 const dialog=document.createElement('dialog');dialog.className='quick-product-dialog';dialog.innerHTML=`<form><h3>Producto no registrado</h3><p>Código: ${esc(code)}</p>${field('name','Nombre','','text','required maxlength="200"')}${field('unit','Unidad','unidad','text','required maxlength="40"')}${amountField('cost','Costo',0)}${amountField('price','Precio',0)}<p class="err" role="status"></p><div class="accounting-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn">Crear producto</button></div></form>`;document.body.append(dialog);dialog.showModal();
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button:last-child');button.disabled=true;try{const result=await operate('quickProduct',{code:'',barcodes:[code],name:v(form,'name'),unit:v(form,'unit'),cost:+v(form,'cost'),price:+v(form,'price')});dialog.close();callback(prod(result.id))}catch(error){form.querySelector('.err').textContent=error.message}finally{button.disabled=false}};
}
function refreshProductOptions(form,product){for(const select of form?.querySelectorAll('[name=posProduct],[name=p]')||[])if(![...select.options].some(o=>o.value===product.id)){const item=document.createElement('option');item.value=product.id;item.textContent=product.name;item.dataset.pr=product.price;item.dataset.co=product.cost;item.dataset.vat=product.vatRate||0;select.append(item)}}
async function scanProduct(code,form){
 code=String(code||'').trim();if(!code)return;
 if(!form?.closest?.('#modal')&&['facturacion','compras'].includes(R)){if(!$('#modal form')?.querySelector('#pos-items,.items')){if(R==='facturacion')await ACT.venta();else ACT.compra()}form=$('#modal form')}
 let product=barcodeProduct(code);
 if(!product){const matches=S.products.filter(p=>normalizeSearch(p.name).includes(normalizeSearch(code)));if(matches.length===1)product=matches[0]}
 if(!product){
  scanTone(false);barcodeFeedback('Producto no registrado'+(permission('inventario',true)?'. Puedes crearlo sin salir de este flujo.':'. Solicita su registro al responsable de inventario.'),form);
  if(permission('inventario',true)){
   const host=SCANNER?.host.querySelector('footer')||form?.querySelector('.barcode-search')||$('#main .barcode-search');host?.querySelector('[data-quick-product]')?.remove();
   if(host){const button=document.createElement('button');button.type='button';button.className='lk';button.dataset.quickProduct='';button.textContent='Crear producto con este código';button.onclick=()=>{closeScanner();quickBarcodeProduct(code,p=>{refreshProductOptions(form,p);barcodeFeedback('Producto creado. Registra existencias antes de vender.',form);focusScan(form)})};host.append(button)}
  }return;
 }
 if(form?.dataset.scanMode==='count'){const input=[...form.querySelectorAll('[data-count-product]')].find(i=>i.dataset.countProduct===product.id);if(input)input.value=quantityRound((+input.value||0)+1);updateCountPreview(form);
 }else if(form?.querySelector('#pos-items')){
  const rows=[...form.querySelectorAll('.pos-item')],existing=rows.find(row=>row.querySelector('[name=posProduct]').value===product.id),total=rows.filter(row=>row.querySelector('[name=posProduct]').value===product.id).reduce((sum,row)=>sum+Number(row.querySelector('[name=posQuantity]').value),0);
  if(product.stock<total+1){scanTone(false);barcodeFeedback('Sin existencias suficientes: '+product.name,form);return}
  refreshProductOptions(form,product);let row=existing||rows.find(row=>!row.querySelector('[name=posProduct]').value);
  if(!row){form.querySelector('#pos-items').insertAdjacentHTML('beforeend',posRow());row=form.querySelector('.pos-item:last-child')}
  if(existing)row.querySelector('[name=posQuantity]').value=quantityRound(+row.querySelector('[name=posQuantity]').value+1);
  else{row.querySelector('[name=posProduct]').value=product.id;row.querySelector('[name=posQuantity]').value=1;row.querySelector('[name=posPrice]').value=product.price}
  form.discountAuthorization='';if(form.querySelector('.discount-feedback'))form.querySelector('.discount-feedback').textContent='Revisa y autoriza de nuevo el descuento al cambiar productos.';previewPos(form);
 }else if(form?.querySelector('.items')){
  refreshProductOptions(form,product);const rows=[...form.querySelectorAll('.item')];let row=rows.find(row=>row.querySelector('[name=p]').value===product.id),existing=!!row;
  if(!row)row=rows.find(row=>!row.querySelector('[name=p]').value);
  if(!row){form.querySelector('.items').insertAdjacentHTML('beforeend',itemRow({},true));row=form.querySelector('.item:last-child')}
  row.querySelector('[name=p]').value=product.id;
  if(existing)row.querySelector('[name=q]').value=quantityRound(+row.querySelector('[name=q]').value+1);
  else{row.querySelector('[name=q]').value=1;row.querySelector('[name=u]').value=form.dataset.documentKind==='sale'?product.price:product.cost;row.querySelector('[name=vatRate]').value=product.vatRate||0;row.querySelector('[name=taxed]').checked=!!product.vatRate}
 }else{
  SEARCHES[R]=product.name;if(R==='kardex')KARDEX_PRODUCT=product.id;view();
 }
 scanTone(true);barcodeFeedback(product.name+' · producto seleccionado',form);const input=form?.querySelector('[name=barcodeSearch]')||$('#main [name=barcodeSearch]');if(input)input.value='';focusScan(form);
}
const barcodeModal=modal;
modal=function(...args){const form=barcodeModal(...args);if(form.querySelector('#pos-items,.items')){form.querySelector('.mb').insertAdjacentHTML('afterbegin',scanInput());bindScan(form);setTimeout(()=>focusScan(form),50)}return form};
function bindScan(form){form.querySelector('[name=barcodeSearch]')?.addEventListener('keydown',async event=>{if(event.key!=='Enter')return;event.preventDefault();try{await scanProduct(event.target.value,form)}catch(error){barcodeFeedback(error.message,form)}finally{event.target.value='';focusScan(form)}})}
const barcodeView=view;view=function(){barcodeView();if(['productos','kardex','facturacion','compras'].includes(R)){$('#main')?.insertAdjacentHTML('afterbegin',scanInput());bindScan($('#main'));focusScan($('#main'))}if(R==='productos'&&permission('inventario',true)){$('#main .ph')?.insertAdjacentHTML('beforeend','<button class="btn ghost" data-a="physicalCount">Conteo físico</button>');}if(R==='productos'&&permission('inventario',true))for(const row of $$('#main tbody tr')){const id=row.querySelector('[data-id]')?.dataset.id;if(id){const button=document.createElement('button');button.type='button';button.className='lk';button.dataset.a='barcodeManage';button.dataset.id=id;button.textContent='Códigos de barras';row.lastElementChild?.append(button)}}};
ACT.barcodeManage=data=>{const product=prod(data.id);if(!product)return;modal('Códigos de '+esc(product.name),barcodeFields(product)+notice('Los códigos son únicos por empresa. Cambiar un código no cambia el inventario ni los asientos.'),async form=>{await operate('product',{...product,id:product.id,date:today(),barcodes:readBarcodes(form)});view()})};
const barcodeAllowed=actionAllowed;actionAllowed=function(action,data={}){if(action==='barcodeManage')return permission('inventario',true);return barcodeAllowed(action,data)};
ACT.scanOpen=(data,button)=>openScanner(code=>scanProduct(code,button.closest('form')||$('#main')));
ACT.scanAssign=(data,button)=>openScanner(code=>{const existing=barcodeProduct(code);if(existing){closeScanner();productForm(existing);return}const field=button.closest('form').elements.barcodes;field.value=[...new Set([...field.value.split(/\r?\n/),code].filter(Boolean))].join('\n');closeScanner()});
function closeScanner(){if(!SCANNER)return;SCANNER.closed=true;cancelAnimationFrame(SCANNER.frame);SCANNER.controls?.stop();SCANNER.video.srcObject?.getTracks().forEach(track=>track.stop());SCANNER.host.remove();SCANNER=null;focusScan($('#modal form')||$('#main'));document.removeEventListener('keydown',scannerEscape,{capture:true})}
function scannerEscape(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeScanner()}}
function loadZxing(){if(window.ZXingBrowser)return Promise.resolve();if(!SCANNER_LOAD)SCANNER_LOAD=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/zxing-browser.js?v=b5ad3df920738ca7';script.onload=resolve;script.onerror=()=>{SCANNER_LOAD=null;script.remove();reject(new Error('No se pudo cargar el lector. Usa un lector físico o escribe el código.'))};document.head.append(script)});return SCANNER_LOAD}
async function openScanner(onCode){
 closeScanner();const host=document.createElement('section');host.className='camera-overlay physical-ready';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Escáner de códigos de barras');host.innerHTML='<header><b>Escanear productos</b><button type="button" class="btn ghost" id="camera-close">Cerrar</button></header><video autoplay muted playsinline hidden></video><div class="camera-guide" aria-hidden="true" hidden></div><footer><p id="camera-status" role="status">Lector físico listo, escanee un producto</p><label>Código de barras<input id="physical-scan" autocomplete="off" autofocus maxlength="128"></label><p>Bluetooth: empareja el lector en modo teclado (HID). Si el manual incluye un código de configuración, escanéalo para activar ese modo.</p><button type="button" class="btn ghost" id="use-camera" hidden>Usar cámara</button><button type="button" class="btn ghost" id="camera-torch" hidden>Linterna</button></footer>';document.body.append(host);
 const state={host,video:host.querySelector('video'),closed:false,lastCode:'',lastTime:0,busy:false};SCANNER=state;host.querySelector('#camera-close').onclick=closeScanner;state.onCode=onCode;host.querySelector('#physical-scan').focus();host.querySelector('#physical-scan').addEventListener('keydown',async event=>{if(event.key!=='Enter')return;event.preventDefault();event.stopPropagation();const input=event.target;try{await onCode(input.value)}catch(error){scanTone(false);barcodeFeedback(error.message)}finally{input.value='';if(!state.closed)input.focus()}});document.addEventListener('keydown',scannerEscape,{capture:true});
 const read=async code=>{if(state.closed||state.busy||!code||code===state.lastCode&&Date.now()-state.lastTime<1000)return;state.lastCode=code;state.lastTime=Date.now();state.busy=true;try{await onCode(code)}catch(error){barcodeFeedback(error.message)}finally{state.busy=false}};
 host.querySelector('#camera-torch').onclick=async()=>{try{const track=state.video.srcObject?.getVideoTracks()[0];if(!track?.getCapabilities?.().torch){barcodeFeedback('Este dispositivo no permite encender la linterna.');return}state.torch=!state.torch;await track.applyConstraints({advanced:[{torch:state.torch}]})}catch{barcodeFeedback('No se pudo encender la linterna.')}};
 const startCamera=async()=>{
 try{
  host.classList.remove('physical-ready');state.video.hidden=false;host.querySelector('.camera-guide').hidden=false;host.querySelector('#camera-torch').hidden=false;
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara requiere HTTPS y un navegador compatible. Usa el campo de búsqueda o un lector físico.');
  const supported=window.BarcodeDetector?await BarcodeDetector.getSupportedFormats():[];
  if(['ean_13','upc_a','code_128'].every(format=>supported.includes(format))){
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(state.closed){stream.getTracks().forEach(track=>track.stop());return}state.video.srcObject=stream;await state.video.play();const detector=new BarcodeDetector({formats:supported.filter(format=>['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'].includes(format))});
   const frame=async()=>{if(state.closed)return;try{if(state.video.readyState>=2){const results=await detector.detect(state.video);if(results[0])await read(results[0].rawValue)}}catch{}if(!state.closed)state.frame=requestAnimationFrame(frame)};frame();
  }else{await loadZxing();if(state.closed)return;const reader=new ZXingBrowser.BrowserMultiFormatReader();state.controls=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},state.video,result=>{if(result)read(result.getText())});if(state.closed)state.controls.stop()}
 }catch(error){state.video.srcObject?.getTracks().forEach(track=>track.stop());barcodeFeedback(['NotAllowedError','PermissionDeniedError'].includes(error.name)?'Permiso de cámara denegado. En los ajustes de este sitio, permite la cámara y vuelve a abrir el escáner. También puedes escribir el código o usar un lector USB.':error.name==='NotFoundError'?'Lector físico listo, escanee un producto':error.message||'No se pudo abrir la cámara. Usa un lector físico.');host.classList.add('physical-ready');state.video.hidden=true;host.querySelector('.camera-guide').hidden=true;host.querySelector('#camera-torch').hidden=true}
 };
 try{const devices=await navigator.mediaDevices?.enumerateDevices();if(!state.closed&&devices?.some(device=>device.kind==='videoinput')){const button=host.querySelector('#use-camera');button.hidden=false;button.onclick=async()=>{button.disabled=true;await startCamera();button.hidden=!state.video.hidden;button.disabled=false}}}catch{}
}

ACTION_MODULE.physicalCount='inventario';
function updateCountPreview(form){const rows=[...form.querySelectorAll('[data-count-product]')].filter(i=>i.value!=='').map(i=>{const p=prod(i.dataset.countProduct),count=+i.value;return `<tr><td>${esc(p.name)}</td><td>${esc(p.stock)}</td><td>${esc(count)}</td><td>${esc(quantityRound(count-p.stock))}</td></tr>`});form.querySelector('#count-preview').innerHTML=accountingTable(['Producto','Existencia','Contado','Diferencia'],rows.join(''))}
ACT.physicalCount=()=>{const form=modal('Conteo físico de inventario',scanInput()+field('date','Fecha',today(),'date','required')+selectField('reason','Tratamiento contable',option('correccion','Corrección de registro · patrimonio')+option('real','Diferencia real · ingreso o gasto'))+notice('Escanear suma uno al conteo. Los campos vacíos se omiten; un cero explícito ajusta a cero. Revisa las diferencias antes de confirmar.')+S.products.map(p=>`<label>${esc(p.name)} · sistema: ${esc(p.stock)}<input data-count-product="${esc(p.id)}" type="number" min="0" max="1000000000" step="0.000001" placeholder="Sin contar"></label>`).join('')+'<div id="count-preview"></div><label class="ck"><input type="checkbox" name="confirmed" required>Revisé el resumen y confirmo las diferencias</label>',async form=>{const items=[...form.querySelectorAll('[data-count-product]')].filter(i=>i.value!=='').map(i=>({p:i.dataset.countProduct,count:+i.value,expected:prod(i.dataset.countProduct).stock}));await operate('stockCount',{date:v(form,'date'),reason:v(form,'reason'),confirmed:form.elements.confirmed.checked,items});view()},'Confirmar ajustes');form.dataset.scanMode='count';bindScan(form);form.addEventListener('input',()=>updateCountPreview(form));updateCountPreview(form);focusScan(form)};

let BARCODE_AUDIO=null,physicalBuffer='',physicalTime=0,physicalBusy=false;
function scanTone(success){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;BARCODE_AUDIO||=new Audio();BARCODE_AUDIO.resume().catch(()=>{});const oscillator=BARCODE_AUDIO.createOscillator(),gain=BARCODE_AUDIO.createGain();oscillator.connect(gain);gain.connect(BARCODE_AUDIO.destination);gain.gain.value=.05;oscillator.frequency.value=success?880:180;oscillator.start();oscillator.stop(BARCODE_AUDIO.currentTime+(success ? .08 : .22))}catch{}}
document.addEventListener('keydown',async event=>{
 const target=event.target,editable=target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 if(editable||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.repeat){physicalBuffer='';physicalTime=0;return}
 const form=$('#modal form')||$('#main');if(!SCANNER&&!form?.querySelector('[name=barcodeSearch]'))return;
 const now=performance.now();if(now-physicalTime>=50)physicalBuffer='';physicalTime=now;
 if(event.key==='Enter'){
  const code=physicalBuffer;physicalBuffer='';if(code.length<3||physicalBusy)return;event.preventDefault();event.stopImmediatePropagation();physicalBusy=true;
  try{if(SCANNER)await SCANNER.onCode(code);else await scanProduct(code,form)}catch(error){scanTone(false);barcodeFeedback(error.message,form)}finally{physicalBusy=false;if(SCANNER)SCANNER.host.querySelector('#physical-scan')?.focus();else focusScan(form)}
 }else if(event.key.length===1){physicalBuffer=(physicalBuffer+event.key).slice(-128)}else physicalBuffer='';
},{capture:true});
