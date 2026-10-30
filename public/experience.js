'use strict';

// Documentos informativos; la aceptación contractual conserva su versión independiente.
const LEGAL_PAGES={
 privacidad:['📜 Política de Privacidad','En Acontec valoramos tu privacidad. Recopilamos información personal (como nombres, correos electrónicos, teléfonos y datos de facturación) estrictamente para la gestión de clientes, emisión de facturas y control contable dentro de la plataforma. Tus datos se almacenan de forma segura en nuestra base de datos en la nube. No compartimos tu información con terceros para fines publicitarios. Puedes solicitar acceso, rectificación o eliminación de tus datos personales al responsable de tu cuenta. La configuración de la cuenta permite administrar tus datos y exportar respaldos.'],
 cookies:['🍪 Política de Cookies','Este sitio web utiliza cookies técnicas y almacenamiento local (localStorage) para garantizar el funcionamiento de la plataforma y recordar tus preferencias. La sesión se mantiene mediante una cookie segura, HttpOnly y SameSite=Strict; los tokens no se guardan en localStorage. No utilizamos cookies publicitarias de terceros. Puedes configurar o bloquear las cookies desde las opciones de tu navegador; bloquear las cookies esenciales impide iniciar sesión.'],
 terminos:['⚖️ Términos y Condiciones','El acceso y uso de la plataforma acontec.company está sujeto a los presentes Términos y Condiciones. El usuario es responsable de la veracidad de los datos contables, inventarios y facturas que registre en el sistema. Queda prohibido el uso indebido de la plataforma para fines ilícitos. Todos los derechos de propiedad intelectual del software, diseño y código pertenecen a los desarrolladores de Acontec. El servicio se proporciona "tal cual" y nos reservamos el derecho de actualizar funciones para mejorar el rendimiento y la seguridad.'],
 devoluciones:['🔄 Política de Devoluciones y Envíos','Debido a que acontec.company es un sistema de gestión administrativa, contable y facturación para comercios:\n\n1. Emisión y Anulación: Las facturas emitidas y asientos registrados deben ser anulados o ajustados mediante notas de crédito internas de acuerdo con las normativas fiscales aplicables del usuario.\n\n2. Servicios y Productos: Si la plataforma se utiliza para gestionar transacciones de productos físicos o digitales, cada comercio o usuario es responsable de definir sus propias políticas de entrega, plazos y reembolsos frente a sus clientes finales.']
};
READ_ACTIONS.add('policy');READ_ACTIONS.add('cookieAccept');
ACT.policy=async data=>{
 const keys={privacidad:'privacy',terminos:'terms',reembolsos:'refunds',cookies:'cookies'};
 const page=LEGAL_PAGES[data.id];if(!page)return;
 const form=modal(page[0],'<article class="legal-text" role="status">Consultando la versión publicada…</article>',()=>{},'Entendido');
 form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.querySelector('.mf button').textContent='Cerrar';form.querySelector('.mh button').focus();
 const article=form.querySelector('article');
 if(!keys[data.id]){article.textContent=SITE.policyNotes?.[data.id]||page[1];return}
 try{const doc=await api('legal');article.style.whiteSpace='pre-wrap';article.textContent=doc.approved?(doc[keys[data.id]]||(data.id==='cookies'?page[1]:'Documento pendiente de publicación.')):'Documento pendiente de aprobación del titular.'}
 catch(error){article.textContent='No se pudo consultar la versión vigente. Cierra y vuelve a abrir el documento.'}
};
LEGAL_PAGES.reembolsos=['Reembolsos y cancelaciones',''];
const contentRouteAllowed=routeAllowed;
routeAllowed=function(route){if(route==='contenido')return !!U?.admin&&!U.worker&&!!CO?.isPlatformCompany;return contentRouteAllowed(route)};
V.contenido=()=>{
 if(!routeAllowed('contenido'))return;
 main(`<section class="operations-head"><div><span class="section-eyebrow">ACONTEC · CONTENIDO GLOBAL</span><h1>Tu página, tus palabras.</h1><p>Administra lo que leen los visitantes y los clientes desde un solo lugar.</p></div></section><section class="card"><h2>Políticas y privacidad</h2><p>Edita términos, privacidad, cookies y reembolsos. Las páginas públicas, la aceptación al ingresar y las consultas desde el panel comparten los documentos publicados.</p><button class="btn" data-a="legalEdit">Editar documentos legales</button><nav class="legal-nav" aria-label="Vista pública"><a href="/terminos" target="_blank" rel="noopener">Términos</a> · <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a> · <a href="/cookies" target="_blank" rel="noopener">Cookies</a> · <a href="/reembolsos" target="_blank" rel="noopener">Reembolsos</a></nav><p class="mut">Cada cambio aprobado requiere una versión nueva y conserva las aceptaciones anteriores.</p></section><section class="card"><h2>Página y panel de los clientes</h2><p>Personaliza nombres del menú, título y descripción del panel, aviso de cookies, portada, marca, contactos y colores.</p><button class="btn ghost" data-a="gear">Editar textos y apariencia</button><p class="mut">Los cambios se cargan al abrir el sitio. Guarda solo cuando termines de editar.</p></section><section class="card"><h2>Devoluciones de los comercios</h2><p>Texto informativo del panel sobre facturas, productos y entregas de cada comercio, separado de los reembolsos del servicio Acontec.</p><button class="btn ghost" data-a="commercePolicyEdit">Editar información de devoluciones</button></section>`);
};
const contentActionAllowed=actionAllowed;
actionAllowed=function(action,data={}){if(action==='commercePolicyEdit')return routeAllowed('contenido');return contentActionAllowed(action,data)};
ACT.commercePolicyEdit=()=>{
 if(!routeAllowed('contenido'))return;
 const revision=SITE_REV;
 modal('Devoluciones de los comercios',`<label>Texto informativo<textarea name="text" rows="12" maxlength="10000" required>${esc(SITE.policyNotes?.devoluciones||LEGAL_PAGES.devoluciones[1])}</textarea></label>`,async form=>{
 const result=await api('site','PUT',{...SITE,revision,policyNotes:{devoluciones:v(form,'text')}});SITE={...DEF,...result.site};SITE_REV=result.siteRevision;view();setSt('Información publicada');
 });
};
const experienceChrome=chrome;
chrome=function(){experienceChrome();if(routeAllowed('contenido'))$('#drawer .bot')?.insertAdjacentHTML('beforebegin',`<button data-a="nav" data-r="contenido" class="${R==='contenido'?'on':''}"><span>✎</span>Contenido y políticas</button>`);$('#drawer .bot')?.insertAdjacentHTML('beforebegin',`<section class="legal-nav"><h4>LEGAL Y CONFIGURACIÓN</h4>${Object.entries(LEGAL_PAGES).map(([id,[title]])=>`<button data-a="policy" data-id="${id}">${esc(title)}</button>`).join('')}</section>`)};
ACT.cookieAccept=()=>{try{localStorage.setItem('acontec.cookies.v1','aceptadas')}catch{}$('#cookie-banner')?.remove()};
function cookieBanner(){let accepted=false;try{accepted=localStorage.getItem('acontec.cookies.v1')==='aceptadas'}catch{}if(accepted)return;document.body.insertAdjacentHTML('beforeend',`<aside id="cookie-banner" class="cookie-banner noprint" aria-label="Cookies esenciales"><div><b>Tu sesión, segura.</b><p data-cookie-notice>${esc(SITE.cookieNotice||'Usamos cookies técnicas y de sesión y almacenamiento local para tus preferencias. Sin cookies publicitarias.')}</p><button class="lk" data-a="policy" data-id="cookies">Leer política de cookies</button></div><button class="btn" data-a="cookieAccept">Aceptar</button></aside>`)}
cookieBanner();
const contentApplyTheme=applyTheme;applyTheme=function(){contentApplyTheme();const notice=$('[data-cookie-notice]');if(notice)notice.textContent=SITE.cookieNotice||'Usamos cookies técnicas y de sesión y almacenamiento local para tus preferencias. Sin cookies publicitarias.'};

const printAmountWords=value=>{
 const units=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
 const spell=n=>{if(n<30)return units[n];if(n<100)return ['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'][Math.floor(n/10)]+(n%10?' y '+spell(n%10):'');if(n===100)return 'cien';if(n<1000)return ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'][Math.floor(n/100)]+(n%100?' '+spell(n%100):'');if(n<1e6)return (n<2000?'mil':spell(Math.floor(n/1000))+' mil')+(n%1000?' '+spell(n%1000):'');if(n<1e12)return (n<2e6?'un millón':spell(Math.floor(n/1e6))+' millones')+(n%1e6?' '+spell(n%1e6):'');return n.toLocaleString('es')};
 const cents=Math.round(Math.abs(value)*100);return `${value<0?'menos ':''}${spell(Math.floor(cents/100))} con ${String(cents%100).padStart(2,'0')}/100 ${S.cfg.cur||'C$'}`;
};
const invoiceDate=value=>String(value||'').replace(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/, '$3/$2/$1');
function invoiceOperator(entry){
 const recorded=String(entry.operatorName||entry.actor||'').trim();
 const name=recorded.replace(/\s+\([^()]+\)$/, '').trim();
 if(name!==recorded&&name)return name;
 if((entry.operatorId===operatorIdentity()||recorded===U.email)&&U.name)return U.name;
 return recorded||'—';
}
function invoiceSettings(entry){return AcontecInvoiceDesign.resolve(S.cfg,CO.name,entry)}
function invoiceMarkup(entry,format,color=format==='thermal'?'bw':'color',draft=null){
 const cfg=draft||invoiceSettings(entry),fiscal=AcontecInvoiceDesign.fiscal(cfg),note=entry.type==='nota-credito',customer=entry.customer||customerById(entry.customerId)||{},base=entry.subtotal??entry.total-(entry.vat||0),gross=r2((entry.items||[]).reduce((sum,item)=>sum+operationalRound(item.q*(item.listPrice??item.u)),0)),discount=r2(gross-base);
 format=['a4','letter','thermal'].includes(format)?format:cfg.format;color=color==='color'?'color':'bw';
 const details=lines=>lines.filter(([,value])=>String(value??'').trim()).map(([label,value])=>esc(label+String(value).trim())).join('<br>');
 const businessDetails=details([['',cfg.tradeName],[fiscal.taxIdLabel+': ',cfg.ruc],['Sucursal: ',cfg.showBranch?((S.branches||CO.branches||[]).find(b=>b.id===(entry.branchId||'principal'))?.name||'Principal'):''],['',cfg.address],['Teléfono: ',cfg.phone],['',cfg.email],['',cfg.website]]);
 const customerDetails=details([[fiscal.taxIdLabel+': ',cfg.showCustomerTaxId?customer.taxId:'']]);
 const observations=String(entry.reason||entry.notes||'').trim(),thermal=format==='thermal',operator=invoiceOperator(entry);
 const isCredit=(entry.creditAmount??(entry.pay==='1201'?entry.total:0))>0||(entry.payments||[]).some(payment=>payment.method==='credito'&&payment.amount>0);
 const linked=S.entries.filter(row=>row.invoiceId===entry.id),paid=r2(linked.filter(row=>row.type==='abono').reduce((sum,row)=>sum+row.total,0)),credits=r2(linked.filter(row=>row.type==='nota-credito').reduce((sum,row)=>sum+(row.debtReduction??(row.payments||[]).filter(p=>p.method==='credito').reduce((s,p)=>s+p.amount,0)),0)),pending=Math.max(0,r2((entry.creditAmount??(entry.pay==='1201'?entry.total:0))-paid-credits));
 const annulled=entry.type==='venta'&&saleStatus(entry)==='ANULADA',accent=/^#[0-9a-f]{6}$/i.test(cfg.accent)?cfg.accent:'#234e40',size=Number.isInteger(cfg.logoSize)?Math.max(24,Math.min(180,cfg.logoSize)):90,position=['left','center','right'].includes(cfg.logoPosition)?cfg.logoPosition:'left';
 const logo=/^\/api\/image\?key=[a-f0-9-]+\.webp$/.test(cfg.logo||'')?`<div class="invoice-logo-box" style="text-align:${position}"><img class="invoice-logo" style="width:${size}px;max-height:${size}px" src="${esc(cfg.logo)}" alt="Logo de factura"></div>`:'';
 const imprint=fiscal.imprint?details([[fiscal.taxIdLabel+' de imprenta: ',cfg.printerRuc],['Orden de trabajo: ',cfg.printerOrder],['Fecha de imprenta: ',invoiceDate(cfg.printerDate)],['Libretas: ',cfg.printerBooks],['Numeración: ',cfg.printerRange]]):'';
 const copies=cfg.copies===2?2:1;
 return finishInvoiceMarkup(`<div id="rcpt" class="invoice-print invoice-${format} invoice-${color}" style="--invoice-accent:${accent}">${Array.from({length:copies},(_,copy)=>`<article class="invoice-copy"><p class="invoice-copy-label">${copy?'Copia: emisor':'Original: cliente'}</p>${annulled?'<div class="invoice-annulled">ANULADA</div>':''}<header class="invoice-heading"><div class="invoice-business">${logo}${invoiceCustomFields(cfg,'header')}<h1>${esc(cfg.legalName)}</h1><p>${businessDetails}</p></div><div class="invoice-number"><strong>${esc(note?'NOTA DE CRÉDITO':cfg.title)}</strong><h2>${esc(entry.reference||entry.id)}</h2><p>Serie: ${esc(entry.series||'—')}${thermal?' · ':'<br>'}Emisión: ${esc(invoiceDate(entry.date))}<br>Vencimiento: ${esc(invoiceDate(entry.due||entry.date))}</p></div></header>${cfg.showCustomerName||cfg.showCustomerTaxId?`<section class="invoice-customer"><small>FACTURAR A</small>${cfg.showCustomerName?`<h3>${esc(entry.party||customer.name||'Cliente general')}</h3>`:''}${customerDetails?`<p>${customerDetails}</p>`:''}</section>`:''}<table class="invoice-lines"><thead><tr>${cfg.showCode?'<th>Código</th>':''}<th>Descripción</th>${cfg.showUnit?'<th>Unidad</th>':''}<th class="n">Cantidad</th><th class="n">P. unitario</th>${cfg.showDiscount?'<th class="n">Descuento</th>':''}<th class="n">Subtotal</th></tr></thead><tbody>${(entry.items||[]).map(item=>`<tr>${cfg.showCode?`<td>${esc(item.code||prod(item.p)?.code||'—')}</td>`:''}<td>${esc(item.name||prod(item.p)?.name||'Producto')}</td>${cfg.showUnit?`<td>${esc(item.unit||'unidad')}</td>`:''}<td class="n">${esc(formatQuantity(item.q))}</td><td class="n">${money(item.listPrice??item.u)}</td>${cfg.showDiscount?`<td class="n">${money(r2(item.q*(item.listPrice??item.u))-r2(item.q*item.u))}</td>`:''}<td class="n">${money(r2(item.q*item.u))}</td></tr>`).join('')}</tbody></table><section class="invoice-summary"><div class="invoice-payment"><h4>${esc(isCredit?cfg.creditLegend:cfg.cashLegend)}</h4>${(entry.payments||[]).map(payment=>`<p>${esc(paymentLabels[payment.method]||payment.method)}: ${money(payment.amount)}</p>`).join('')||`<p>${esc(PAY[entry.pay]||'')}</p>`}${cfg.showCashTender&&entry.cashTender?`<p>Recibido: ${money(entry.cashTender.receivedCents/100)}<br>Cambio: ${money(entry.cashTender.changeCents/100)}</p>`:''}<p><b>${annulled?'ANULADA':pending>0?'A crédito':'Pagada'}</b> · Saldo pendiente: ${money(pending)}</p></div><table class="invoice-totals"><tbody><tr><td>Subtotal</td><td class="n">${money(gross)}</td></tr>${cfg.showDiscount?`<tr><td>Descuento</td><td class="n">${money(discount)}</td></tr>`:''}<tr><td>Base</td><td class="n">${money(base)}</td></tr><tr><td>${esc(fiscal.taxName)}</td><td class="n">${money(entry.vat||0)}</td></tr><tr class="invoice-grand"><th>Total</th><th class="n">${money(entry.total)}</th></tr></tbody></table></section>${cfg.showWords?`<p class="invoice-words">${esc(printAmountWords(entry.total))}</p>`:''}<footer class="invoice-footer">${observations?`<p>Observaciones: ${esc(observations)}</p>`:''}${isCredit&&cfg.creditTerms?.trim()?`<p>Condiciones de crédito: ${esc(cfg.creditTerms)}</p>`:''}${cfg.showCashier?`<p>Cajero / vendedor: ${esc(operator)}</p>`:''}${cfg.showSignature?'<div class="invoice-signatures"><span>Entregado por</span><span>Recibido por</span></div>':''}${cfg.legalText?.trim()?`<p>${esc(cfg.legalText)}</p>`:''}${cfg.notes?.trim()?`<p>${esc(cfg.notes)}</p>`:''}${cfg.thanks?.trim()?`<b>${esc(cfg.thanks)}</b>`:''}${imprint?`<p class="invoice-imprint">${imprint}</p>`:''}${cfg.dgiNumber?.trim()?`<p class="invoice-dgi">${esc(fiscal.authority)}<br>${esc(fiscal.authorizationLabel)}: ${esc(cfg.dgiNumber)}${cfg.dgiDate?'<br>'+esc(fiscal.authorizationDateLabel)+': '+esc(invoiceDate(cfg.dgiDate)):''}</p>`:cfg.printMissingAuthorization&&fiscal.missingAuthorization?.trim()?`<p>${esc(fiscal.missingAuthorization)}</p>`:''}${fiscal.mandatoryLegends?.trim()?`<p>${esc(fiscal.mandatoryLegends)}</p>`:''}${invoiceCustomFields(cfg,'footer')}${true?`<div class="invoice-system"><img src="/acontec-mark${color==='bw'?'-bn':''}-v1.png" alt="Logo de Acontec"><span>Sistema Acontec</span></div>`:''}</footer></article>`).join('')}</div>`,cfg,format,color);
}
function invoiceCustomFields(cfg,position){return (cfg.customFields||[]).filter(f=>f.position===position&&f.value?.trim()).map(f=>`<p>${esc(f.label)}: ${esc(f.value)}</p>`).join('')}
function finishInvoiceMarkup(markup,cfg,format,color){
 if(typeof document==='undefined')return markup.replace(/<(p|b|h4)(?: [^>]*)?>\s*<\/\1>/g,'');
 const box=document.createElement('div');box.innerHTML=markup;
 // Remove whitespace-only text blocks after escaping; user HTML remains plain text.
 box.querySelectorAll('p,b,h4').forEach(el=>{if(!el.textContent.trim()&&!el.children.length)el.remove()});
 const d=AcontecInvoiceDesign.effectiveDesign(cfg,format);if(!d)return box.innerHTML;
 const root=box.firstElementChild,font={helvetica:'Helvetica,Arial,sans-serif',times:'Times New Roman,Times,serif',courier:'Courier New,Courier,monospace'}[d.font],bw=color==='bw',ink=bw?'#000000':d.text;
 root.style.cssText+=`;font-family:${font};font-size:${d.baseSize}pt;color:${ink};--invoice-accent:${bw?'#000000':d.accent}`;
 root.querySelectorAll('*').forEach(el=>{if(el.closest('.invoice-annulled,.invoice-system'))return;el.style.setProperty('font-family',font,'important');el.style.setProperty('font-size',d.baseSize+'pt','important')});root.style.setProperty('font-family',font,'important');
 for(const article of root.querySelectorAll('.invoice-copy')){
  const summary=article.querySelector('.invoice-summary'),totals=summary.querySelector('.invoice-totals'),payment=summary.querySelector('.invoice-payment');summary.replaceWith(totals,payment);
  const nodes={header:article.querySelector('header'),customer:article.querySelector('.invoice-customer'),items:article.querySelector('.invoice-lines'),totals,payment,footer:article.querySelector('footer')};
  for(const key of d.order){const node=nodes[key];if(node){article.append(node);node.style.cssText+=`;margin-top:${d.gap}px;text-align:${d.alignment[key]}`}}
  const h=nodes.header;h.style.display=d.header==='split'?'flex':'block';if(d.header==='center')h.style.textAlign='center';
  h.querySelector('h1').style.setProperty('font-size',d.companySize+'pt','important');h.querySelector('strong').style.setProperty('font-size',d.titleSize+'pt','important');
  totals.style.minWidth='0';totals.style.cssText+=`;width:${d.totals==='full'?'100%':'50%'};margin-left:${d.totals==='right'?'auto':'0'};margin-right:${d.totals==='left'?'auto':'0'}`;
  article.style.cssText+=`;position:relative;border-radius:${d.radius}px`;h.querySelector('.invoice-number').style.borderRadius=d.radius+'px';
  article.querySelectorAll('th,td').forEach(cell=>{cell.style.padding=({compact:3,normal:6,wide:10}[d.density])+'px';cell.style.border=d.lines==='grid'?`${d.borderWidth}px solid ${bw?'#777777':d.border}`:'none';if(d.lines==='horizontal')cell.style.borderBottom=`${d.borderWidth}px solid ${bw?'#777777':d.border}`;cell.style.setProperty('font-weight',cell.tagName==='TH'&&d.boldLabels?'bold':'normal','important')});
  article.querySelectorAll('.invoice-lines thead th').forEach(cell=>{cell.style.background=bw?'#ffffff':d.tableBackground;cell.style.color=bw?'#000000':d.tableText});
  if(d.striped)article.querySelectorAll('.invoice-lines tbody tr:nth-child(even)').forEach(row=>row.style.background=bw?'#eeeeee':d.stripe);
  article.querySelectorAll('.invoice-grand th').forEach(cell=>{cell.style.background=bw?'#ffffff':d.totalBackground;cell.style.setProperty('font-weight',d.boldTotals?'bold':'normal','important')});
  if(d.watermark!=='none'){
   const mark=document.createElement('div');mark.className='invoice-watermark';mark.style.setProperty('opacity',d.opacity,'important');mark.style.cssText=`position:absolute;inset:35% 5% auto;pointer-events:none;opacity:${d.opacity};font-size:32pt;text-align:center;z-index:0`;
   if(d.watermark==='logo'){const logo=h.querySelector('.invoice-logo');if(logo)mark.append(logo.cloneNode())}else mark.textContent=d.watermarkText||cfg.legalName;
   mark.style.setProperty('opacity',d.opacity,'important');article.prepend(mark);
  }
 }
 root.dataset.margin=d.margin;
 return box.innerHTML;
}
// El selector y la impresión de facturas se comparten en printing.js.
printRcpt=entry=>printInvoiceDocument(entry);
ACTION_MODULE.printSettings='diseno_factura';
ROUTE_MODULE.diseno_factura='diseno_factura';
MENU[MENU.length-1][1].push(['diseno_factura','✎','Edición de factura']);
const invoiceSample=()=>({id:'muestra',type:'venta',date:today(),due:today(),reference:'A-00001234',series:'A',party:'Cliente de ejemplo',customer:{name:'Cliente de ejemplo',taxId:'J0310000000000'},operatorName:'Cajero de ejemplo',payments:[{method:'efectivo',amount:287.5}],items:[{code:'P-001',name:'Producto de ejemplo',unit:'unidad',q:2,u:125,listPrice:125,vatRate:15}],subtotal:250,vat:37.5,total:287.5});
V.diseno_factura=()=>{
 const cfg=AcontecInvoiceDesign.settings(S.cfg,CO.name),writable=CO.owner&&permission('diseno_factura',true);
 main(pageHead('Edición de factura')+notice('Personaliza los documentos de esta empresa. Los cambios se aplican al guardar; las facturas emitidas conservan su versión. Verifica con tu contador los requisitos de tu autoridad tributaria.')+`<div class="invoice-editor-layout"><section class="card"><h3>Identidad y formato</h3><p>Diseño vigente · ${esc(CO.name)}</p>${writable?'<button class="btn" data-a="printSettings">Editar diseño</button>':''}<h3>Historial del diseño</h3><p class="mut">La configuración anterior se conserva al guardar por primera vez. No es posible reconstruir cambios anteriores a este historial.</p><ol>${(S.cfg.print?.versions||[]).slice().reverse().map(version=>`<li>${esc(version.legacy?'Configuración inicial · '+invoiceDate(version.recordedAt):invoiceDate(version.at))}<br><small>${esc(version.actor)}</small></li>`).join('')||'<li>Configuración existente, sin versiones nuevas.</li>'}</ol></section><section class="invoice-preview" aria-label="Factura de ejemplo"><p class="mut">EJEMPLO · sin valor fiscal</p><div data-invoice-preview></div></section></div>`);
 invoicePreview($('#main [data-invoice-preview]'),cfg);
};
function invoicePreview(target,cfg,previewLogo=''){
 if(!target)return;
 const sample=invoiceSample(),rate=AcontecInvoiceDesign.fiscal(cfg).taxRate;sample.vat=r2(sample.subtotal*rate/100);sample.total=r2(sample.subtotal+sample.vat);sample.payments[0].amount=sample.total;sample.cashTender={receivedCents:Math.ceil(sample.total/100)*10000,changeCents:Math.ceil(sample.total/100)*10000-Math.round(sample.total*100)};const editor=target.closest('form'),paper=editor?.elements.preview_paper?.value||cfg.format,color=editor?.elements.preview_color?.value||'color';const markup=invoiceMarkup(sample,paper,color,cfg);
 // El iframe aísla la hoja de papel y reutiliza las mismas reglas de impresión.
 const frame=document.createElement('iframe');frame.title='Vista previa de factura de ejemplo';frame.setAttribute('sandbox','allow-same-origin');frame.tabIndex=-1;
 target.replaceChildren(frame);
 const css=[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>`<link rel="stylesheet" href="${esc(link.href)}" media="all">`).join('');
 frame.srcdoc=`<!doctype html><html lang="es"><head><meta charset="utf-8">${css}<style>body{margin:0;padding:18px;background:#fff;color:#21342b}#rcpt{display:block!important;width:100%!important;max-width:none!important}body.rc{padding:18px}body.rc:has(.invoice-thermal){width:80mm}body.rc #rcpt.invoice-thermal{width:72mm!important}.invoice-copy+.invoice-copy{border-top:1px dashed #aaa;margin-top:24px;padding-top:24px}table{width:100%;border-collapse:collapse}img{max-width:100%}</style></head><body class="rc">${markup}</body></html>`;
 frame.onload=()=>{
  const doc=frame.contentDocument;if(!doc)return;
  // Las reglas existentes están bajo @media print; la copia local las activa para la vista previa.
  for(const sheet of doc.styleSheets){try{for(const rule of [...sheet.cssRules])if(rule.type===CSSRule.MEDIA_RULE&&rule.conditionText==='print'){const style=doc.createElement('style');style.textContent=[...rule.cssRules].map(r=>r.cssText).join('\n');doc.head.append(style)}}catch{}}
  const pageWidth=paper==='thermal'?80:paper==='letter'?215.9:210,margin=AcontecInvoiceDesign.effectiveDesign(cfg,paper)?.margin||(paper==='thermal'?4:14);
  const sheet=doc.createElement('style');sheet.textContent=`html{width:${pageWidth}mm}body.rc{box-sizing:content-box!important;width:${pageWidth-2*margin}mm!important;padding:${margin}mm!important;margin:0!important}body.rc #rcpt,body.rc #rcpt.invoice-thermal{width:100%!important}`;doc.head.append(sheet);
  const fit=()=>{
   if(!frame.isConnected||!frame.clientWidth)return;
   const scale=Math.min(1,frame.clientWidth/(pageWidth*96/25.4))*(editor?.invoiceZoom||1);
   doc.documentElement.style.zoom=scale;
   frame.style.height=Math.ceil(Math.max(doc.body.scrollHeight,doc.body.getBoundingClientRect().height/scale)*scale+4)+'px';
   frame.scrolling='no';
   const output=editor?.querySelector('[data-preview-scale]');if(output)output.textContent=Math.round(scale*100)+' %';
  };
  target.invoiceFit=fit;fit();for(const image of doc.images)image.addEventListener('load',fit,{once:true});
  const resize=new ResizeObserver(fit);resize.observe(target);
  const cleanup=new MutationObserver(()=>{if(!frame.isConnected){resize.disconnect();cleanup.disconnect();if(target.invoiceFit===fit)delete target.invoiceFit}});cleanup.observe(target,{childList:true});
  if(previewLogo)for(const business of doc.querySelectorAll('.invoice-business')){let img=business.querySelector('.invoice-logo');if(!img){const box=doc.createElement('div');box.className='invoice-logo-box';box.style.textAlign=cfg.logoPosition;img=doc.createElement('img');img.className='invoice-logo';img.alt='Logo de factura';img.style.width=Math.max(24,Math.min(180,cfg.logoSize||90))+'px';img.style.maxHeight=img.style.width;box.append(img);business.prepend(box)}img.addEventListener('load',fit,{once:true});img.src=previewLogo}
  doc.fonts?.ready.then(()=>{if(frame.isConnected)fit()});
 };
}
ACT.printSettings=()=>{
 let current=ACT.printSettingsDraft||AcontecInvoiceDesign.settings(S.cfg,CO.name);delete ACT.printSettingsDraft;const fiscal=AcontecInvoiceDesign.fiscal(current),canFiscal=CO.owner,canBrand=U?.admin&&!U.worker&&!CO.support;
 const input=key=>{let [label,max]=AcontecInvoiceDesign.fields[key];if(key==='ruc')label=fiscal.taxIdLabel;if(key==='dgiNumber')label=fiscal.authorizationLabel;if(key==='dgiDate')label=fiscal.authorizationDateLabel;return max>=1000?`<label>${esc(label)}<textarea name="${key}" rows="3" maxlength="${max}">${esc(current[key])}</textarea></label>`:field(key,label,current[key],key.endsWith('Date')?'date':key==='email'?'email':key==='website'?'url':'text',`maxlength="${max}"`)};
 const groups=[['Identidad y contacto',['legalName','tradeName','ruc','address','phone','email','website']],['Autorización fiscal',['dgiNumber','dgiDate']],['Pie de imprenta fiscal · opcional',['printerRuc','printerOrder','printerDate','printerBooks','printerRange']],['Textos del documento',['title','cashLegend','creditLegend','creditTerms','legalText','thanks','notes']]];
 const inputs=groups.filter(([,keys])=>fiscal.imprint||!keys.includes('printerRuc')).map(([label,keys])=>`<details><summary>${esc(label)}</summary><fieldset>${keys.map(input).join('')}</fieldset></details>`).join('');
 const form=modal('Edición de factura',`<div class="invoice-editor-layout"><section>${field('country','País de la empresa',current.country,'text',`maxlength="80" ${canFiscal?'':'disabled'}`)}<p class="mut">Perfil: ${esc(AcontecInvoiceDesign.profile(current.country).name)}. Al cambiar el país, los datos fiscales de la versión anterior se conservan en el historial de versiones. Guarda el cambio con los identificadores vacíos y luego completa los del nuevo país.</p><button type="button" class="btn ghost" data-country-apply ${canFiscal?'':'disabled'}>Aplicar país a la vista previa</button><fieldset ${canFiscal?'':'disabled'}><legend>Perfil fiscal</legend>${Object.entries(AcontecInvoiceDesign.fiscalFields).map(([key,[label,max]])=>field('fiscal_'+key,label,fiscal[key],'text',`maxlength="${max}" ${current.country==='Nicaragua'?'readonly':''}`)).join('')}${field('fiscal_taxRate','Tasa por defecto (%)',fiscal.taxRate,'number','min="0" max="100" step="0.01"')}<label class="ck"><input type="checkbox" name="fiscal_electronic" ${fiscal.electronic?'checked':''}> Este país exige facturación electrónica</label><p>Campos requeridos para completar el perfil fiscal:</p>${['legalName','ruc','address','dgiNumber','dgiDate'].map(key=>`<label class="ck"><input type="checkbox" name="required_${key}" ${fiscal.requiredFields.includes(key)?'checked':''} > ${esc(key==='ruc'?fiscal.taxIdLabel:key==='dgiNumber'?fiscal.authorizationLabel:key==='dgiDate'?fiscal.authorizationDateLabel:AcontecInvoiceDesign.fields[key][0])}</label>`).join('')}</fieldset><p>Verifica con tu contador los requisitos de tu autoridad tributaria.</p><p data-fiscal-missing role="status"></p><p data-electronic-notice hidden>Este módulo da formato impreso y no sustituye la facturación electrónica de tu autoridad tributaria.</p>${inputs}${selectField('format','Formato por defecto',option('a4','A4',current.format==='a4')+option('letter','Carta',current.format==='letter')+option('thermal','Ticket de 80 mm',current.format==='thermal'))}${selectField('copies','Copias',option('1','Original: cliente',current.copies===1)+option('2','Original: cliente / Copia: emisor',current.copies===2))}<label>Logo de empresa<input type="file" name="logoFile" accept="image/png,image/jpeg,image/webp"></label><label class="ck"><input name="removeLogo" type="checkbox"> Quitar logo</label>${field('logoSize','Tamaño del logo (px)',current.logoSize,'number','min="24" max="180" step="1"')}${selectField('logoPosition','Posición del logo', ['left','center','right'].map((key,i)=>option(key,['Izquierda','Centro','Derecha'][i],current.logoPosition===key)).join(''))}${field('accent','Color de acento',current.accent,'color')}<fieldset><legend>Información visible</legend>${Object.entries(AcontecInvoiceDesign.toggles).map(([key,label])=>`<label class="ck"><input type="checkbox" name="${key}" ${current[key]?'checked':''}> ${esc(label)}</label>`).join('')}</fieldset><p class="mut">Sistema Acontec y su logo se incluyen siempre.</p><button type="button" class="btn ghost" data-invoice-reset>Restablecer valores por defecto</button><p class="mut">Restablecer prepara el formulario. Guarda para aplicar. Verifica con tu contador los datos fiscales.</p></section><section class="invoice-preview"><h3>Vista previa en vivo</h3><p class="mut">Ejemplo · sin valor fiscal</p><div data-invoice-preview></div></section></div>`,async f=>{
  if(v(f,'country')!==current.country)return 'Aplica el país a la vista previa antes de guardar.';const payload=read();const file=f.elements.logoFile.files[0];
  if(file&&!f.elements.removeLogo.checked){const image=await shrink(file,700);const result=await api('company-logo?c='+CO.id,'POST',{image,revision:REV});payload.logo=result.logo}
  await operate('printSettings',payload);view();
 },'Guardar diseño');
 form.classList.add('invoice-design-dialog');
 mountInvoiceEditor(form,current,canFiscal);
 let logo=current.logo,objectUrl='';const originalCountry=S.cfg.print?.country||S.cfg.invoiceCountry||'Nicaragua';
 const read=()=>({...readInvoiceEditor(form,current),country:current.country,confirmCountryChange:current.country!==originalCountry,fiscalProfile:{...AcontecInvoiceDesign.profile(current.country),...Object.fromEntries(Object.keys(AcontecInvoiceDesign.fiscalFields).map(key=>[key,v(form,'fiscal_'+key)])),taxRate:+v(form,'fiscal_taxRate'),electronic:form.elements.fiscal_electronic.checked,requiredFields:['legalName','ruc','address','dgiNumber','dgiDate'].filter(key=>form.elements['required_'+key].checked)},...Object.fromEntries(Object.keys(AcontecInvoiceDesign.fields).map(key=>[key,form.elements[key]?v(form,key):''])),...Object.fromEntries(Object.keys(AcontecInvoiceDesign.toggles).map(key=>[key,form.elements[key].checked])),format:v(form,'format'),copies:+v(form,'copies'),logo:form.elements.removeLogo.checked?'':logo,logoSize:+v(form,'logoSize'),logoPosition:v(form,'logoPosition'),accent:v(form,'accent'),showAcontec:true});
 form.querySelector('[data-country-apply]').onclick=()=>{
  let name;try{name=AcontecInvoiceDesign.country(v(form,'country'))}catch(error){setSt(error.message);return}
  if(name===current.country)return;
  if(['ruc','dgiNumber','dgiDate'].some(k=>current[k])&&!window.confirm('¿Cambiar de país? Los datos fiscales anteriores quedan en el historial al guardar y se vacían en este borrador.'))return;
 const next=AcontecInvoiceDesign.switchCountry(read(),name);
  // Solo reemplaza el borrador del diálogo; no guarda ni altera el documento contable.
  ACT.printSettingsDraft=next;ACT.printSettings();
 };
 const preview=()=>{try{const cfg=read(),customMissing=(cfg.customFields||[]).filter(f=>f.required&&!f.value).map(f=>f.label),missing=cfg.fiscalProfile.requiredFields.filter(key=>!String(cfg[key]||'').trim());form.querySelector('[data-fiscal-missing]').textContent=missing.length?'Campos fiscales pendientes: '+missing.map(key=>key==='ruc'?cfg.fiscalProfile.taxIdLabel:key==='dgiNumber'?cfg.fiscalProfile.authorizationLabel:key==='dgiDate'?cfg.fiscalProfile.authorizationDateLabel:AcontecInvoiceDesign.fields[key][0]).join(', '):customMissing.length?'Campos personalizados pendientes: '+customMissing.join(', '):'Campos del perfil completos. Verifica su validez con tu contador.';for(const [key,label]of [['ruc',cfg.fiscalProfile.taxIdLabel],['dgiNumber',cfg.fiscalProfile.authorizationLabel],['dgiDate',cfg.fiscalProfile.authorizationDateLabel]]){for(const control of [form.elements[key],form.elements['required_'+key]]){const parent=control?.closest('label');if(parent){const text=[...parent.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=' '+label+' '}}}form.querySelector('[data-electronic-notice]').hidden=!cfg.fiscalProfile.electronic;invoicePreview(form.querySelector('[data-invoice-preview]'),cfg,!form.elements.removeLogo.checked?objectUrl:'')}catch(error){form.querySelector('[data-fiscal-missing]').textContent=error.message}};
 let timer;form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(preview,180)});
 form.elements.logoFile.addEventListener('change',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);const file=form.elements.logoFile.files[0];objectUrl=file?URL.createObjectURL(file):'';if(file)form.elements.removeLogo.checked=false;preview()});
 form.querySelector('[data-invoice-reset]').onclick=()=>{const defaults=AcontecInvoiceDesign.defaults(S.cfg,CO.name);defaults.country=current.country;defaults.fiscalProfile=canFiscal?AcontecInvoiceDesign.profile(current.country):fiscal;defaults.showAcontec=current.showAcontec;defaults.logo='';for(const [key,value] of Object.entries(defaults)){const input=form.elements[key];if(input){if(input.type==='checkbox')input.checked=value;else input.value=value}}for(const [key,value] of Object.entries(defaults.fiscalProfile)){const input=form.elements['fiscal_'+key];if(input){if(input.type==='checkbox')input.checked=value;else input.value=value}}for(const key of ['legalName','ruc','address','dgiNumber','dgiDate'])form.elements['required_'+key].checked=defaults.fiscalProfile.requiredFields.includes(key);logo='';form.elements.logoFile.value='';form.elements.removeLogo.checked=true;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';preview()};
 const observer=new MutationObserver(()=>{if(!form.isConnected){clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);observer.disconnect()}});observer.observe($('#modal'),{childList:true,subtree:true});preview();
};
const experienceSettings=V.ajustes;V.ajustes=async()=>{await experienceSettings();if(R==='ajustes'&&permission('diseno_factura'))$('#main')?.insertAdjacentHTML('afterbegin','<div class="card"><h3>Facturas con tu identidad</h3><p>Identidad fiscal, diseño, copias e historial por empresa.</p><button class="btn ghost" data-a="nav" data-r="diseno_factura">Edición de factura</button></div>')};

function mountInvoiceEditor(form,current,owner){
 const section=form.querySelector('.invoice-editor-layout>section'),D=AcontecInvoiceDesign;

 let design=structuredClone(current.design||D.classic),saved=structuredClone(current.savedDesigns||[]);
 form.invoiceState={design,saved,defaults:{...current.designDefaults}};
 const wrapper=document.createElement('div');wrapper.innerHTML=`<details open><summary>Campos fiscales personalizados</summary><fieldset ${owner?'':'disabled'}>${Array.from({length:5},(_,i)=>{const f=current.customFields?.[i]||{};return `<details><summary>Campo fiscal ${i+1}</summary>${field('custom_label_'+i,'Etiqueta',f.label||'','text','maxlength="200"')}${field('custom_value_'+i,'Valor',f.value||'','text','maxlength="200"')}<label class="ck"><input type="checkbox" name="custom_required_${i}" ${f.required?'checked':''}>Requerido</label>${selectField('custom_position_'+i,'Ubicación',option('header','Encabezado',f.position!=='footer')+option('footer','Pie',f.position==='footer'))}</details>`}).join('')}</fieldset></details><details open><summary>Estilo y estructura</summary><fieldset data-design-controls ${owner?'':'disabled'}></fieldset><p data-design-error role="alert"></p></details>`;
 section.prepend(wrapper);
 const controls=wrapper.querySelector('[data-design-controls]');
 const draw=()=>{
 const d=form.invoiceState.design;
 const selects={template:['Plantilla',{classic:'Clásica',modern:'Moderna',minimal:'Minimalista',formal:'Formal con bordes',ticket:'Ticket compacto'}],font:['Tipografía',{helvetica:'Helvetica',times:'Times',courier:'Courier'}],lines:['Líneas',{none:'Sin líneas',horizontal:'Horizontales',grid:'Cuadrícula'}],density:['Densidad',{compact:'Compacta',normal:'Normal',wide:'Amplia'}],header:['Encabezado',{split:'Logo y datos a la izquierda, número a la derecha',center:'Centrado',stacked:'Apilado'}],totals:['Totales',{left:'Izquierda',right:'Derecha',full:'Ancho completo'}],watermark:['Marca de agua',{none:'Ninguna',text:'Texto',logo:'Logo'}]};
 controls.innerHTML=Object.entries(selects).map(([k,[label,opts]])=>selectField('design_'+k,label,Object.entries(opts).map(([value,text])=>option(value,text,d[k]===value)).join(''))).join('')+`<button type="button" class="btn ghost" data-template-reset>Restablecer a la plantilla</button>`+
 [['baseSize','Tamaño base (pt)',7,14],['titleSize','Tamaño del título (pt)',10,36],['companySize','Tamaño de empresa (pt)',10,36],['borderWidth','Grosor de borde (px)',0,3],['radius','Esquinas (px)',0,12],['margin','Margen (mm)',4,25],['gap','Espacio entre secciones (px)',0,24],['opacity','Transparencia de marca',0.02,0.3]].map(([k,label,min,max])=>field('design_'+k,label,d[k],'number',`min="${min}" max="${max}" step="0.01"`)).join('')+
 [['accent','Acento'],['text','Texto'],['tableBackground','Fondo de encabezado'],['tableText','Texto de encabezado'],['stripe','Filas alternadas'],['border','Bordes'],['totalBackground','Fondo del total']].map(([k,label])=>field('design_'+k,label,d[k],'color')).join('')+
 ['boldLabels','boldTotals','striped'].map((k,i)=>`<label class="ck"><input type="checkbox" name="design_${k}" ${d[k]?'checked':''}>${['Etiquetas en negrita','Totales en negrita','Filas alternadas'][i]}</label>`).join('')+field('design_watermarkText','Texto de marca de agua',d.watermarkText,'text','maxlength="200"')+
 `<details><summary>Orden y alineación de bloques</summary>${d.order.map((k,i)=>`<p>${esc({header:'Encabezado',customer:'Cliente',items:'Productos',totals:'Totales',payment:'Forma de pago',footer:'Pie'}[k])} <button type="button" class="btn ghost" data-move="${i}" data-direction="-1" ${i===0?'disabled':''}>Subir</button> <button type="button" class="btn ghost" data-move="${i}" data-direction="1" ${i===5?'disabled':''}>Bajar</button>${selectField('align_'+k,'Alineación', ['left','center','right'].map((v,i)=>option(v,['Izquierda','Centro','Derecha'][i],d.alignment[k]===v)).join(''))}</p>`).join('')}</details>`+
 `<details><summary>Ajustes por papel</summary>${['a4','letter','thermal'].map(k=>field('size_'+k,k+' · letra (pt)',d.formats[k].baseSize,'number','min="7" max="14"')+field('margin_'+k,k+' · margen (mm)',d.formats[k].margin,'number','min="4" max="25"')).join('')}</details>`+
 `<details><summary>Diseños guardados (máximo 3)</summary>${field('design_name','Nombre del diseño','','text','maxlength="80"')}<button type="button" class="btn ghost" data-save-design>Guardar en colección</button>${form.invoiceState.saved.map((v,i)=>`<p>${esc(v.name)} <button type="button" class="btn ghost" data-load-design="${i}">Cargar</button><button type="button" class="btn ghost" data-delete-design="${i}">Quitar</button></p>`).join('')}${['a4','letter','thermal'].map(k=>selectField('default_'+k,'Diseño para '+k,option('','Diseño actual',!form.invoiceState.defaults?.[k])+form.invoiceState.saved.map(d=>option(d.id,d.name,form.invoiceState.defaults?.[k]===d.id)).join(''))).join('')}</details>`;
 };
 draw();
 controls.addEventListener('input',e=>{if(['design_baseSize','design_margin'].includes(e.target.name)){const prefix=e.target.name==='design_baseSize'?'size_':'margin_';for(const k of ['a4','letter','thermal'])form.elements[prefix+k].value=e.target.value}});
 controls.addEventListener('change',e=>{if(e.target.name==='design_template'){form.invoiceState.design=structuredClone(D.templates[e.target.value]);draw();form.dispatchEvent(new Event('input',{bubbles:true}))}});
 controls.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{readInvoiceEditor(form,current);const state=form.invoiceState;if(b.hasAttribute('data-template-reset'))state.design=structuredClone(D.templates[state.design.template]);if(b.dataset.move!==undefined){const i=+b.dataset.move,j=i+(+b.dataset.direction);[state.design.order[i],state.design.order[j]]=[state.design.order[j],state.design.order[i]]}if(b.hasAttribute('data-save-design')){const name=v(form,'design_name').trim();if(!name)throw new Error('Escribe un nombre.');const existing=state.saved.find(d=>d.name===name);if(!existing&&state.saved.length>=3)throw new Error('Máximo tres diseños.');if(existing)existing.design=structuredClone(state.design);else state.saved.push({id:crypto.randomUUID(),name,design:structuredClone(state.design)})}if(b.dataset.loadDesign!==undefined)state.design=structuredClone(state.saved[+b.dataset.loadDesign].design);if(b.dataset.deleteDesign!==undefined){const [removed]=state.saved.splice(+b.dataset.deleteDesign,1);for(const k of Object.keys(state.defaults))if(state.defaults[k]===removed.id)state.defaults[k]=''}draw();form.dispatchEvent(new Event('input',{bubbles:true}))}catch(error){form.querySelector('[data-design-error]').textContent=error.message}});
 const preview=form.querySelector('.invoice-preview');preview.insertAdjacentHTML('afterbegin',selectField('preview_paper','Vista previa',option('a4','A4',true)+option('letter','Carta')+option('thermal','Ticket 80 mm'))+selectField('preview_color','Color',option('color','Color',true)+option('bw','Blanco y negro')));
 mountInvoiceEditorLayout(form,section,wrapper,controls);
}
// Solo organiza el borrador del editor; no interviene en impresión ni PDF.
function mountInvoiceEditorLayout(form,section,wrapper,controls){
 const preview=form.querySelector('.invoice-preview'),layout=form.querySelector('.invoice-editor-layout');
 const titles=['Datos de la empresa','Datos fiscales','Textos y leyendas','Logo y colores','Columnas y opciones','Campos fiscales personalizados'];
 const groups=titles.map((title,i)=>{const detail=document.createElement('details');detail.className='invoice-editor-group';detail.setAttribute('name','invoice-editor-sections');detail.open=i===0;const summary=document.createElement('summary');summary.textContent=title;detail.append(summary);return detail});
 const add=(i,node)=>groups[i].append(node);
 // Conserva los mismos controles y sus valores, sin reconstruir el formulario.
 const original=[...section.children];
 for(const node of original){
  if(node===wrapper)continue;
  if(node.tagName==='DETAILS'){
   const title=node.querySelector('summary').textContent;
   const fields=node.querySelector('fieldset');
   if(title==='Identidad y contacto')for(const child of [...fields.children])add(child.querySelector('[name="ruc"]')?1:0,child);
   else add(title==='Textos del documento'?2:1,fields);
  }else{
   const name=node.matches('button')?node.dataset.countryApply!==undefined?'country':'reset':node.querySelector('[name]')?.name;
   add(name==='country'||node.hasAttribute('data-fiscal-missing')||node.hasAttribute('data-electronic-notice')||node.tagName==='FIELDSET'&&node.querySelector('[name^="fiscal_"]')?1:
    ['logoFile','removeLogo','logoSize','logoPosition','accent'].includes(name)?3:
    node.tagName==='P'&&node.textContent.includes('Perfil:')?1:4,node);
  }
 }
 const custom=wrapper.firstElementChild,style=custom.nextElementSibling;
 add(5,custom.querySelector('fieldset'));
 // Los cinco campos quedan juntos, sin un segundo acordeón anidado.
 for(const detail of [...groups[5].querySelectorAll('details')]){const heading=document.createElement('h4');heading.textContent=detail.querySelector('summary').textContent;detail.querySelector('summary').remove();detail.replaceWith(heading,...detail.childNodes)}
 add(4,style.querySelector('fieldset'));add(4,style.querySelector('[data-design-error]'));
 wrapper.remove();section.replaceChildren(...groups);
 section.classList.add('invoice-editor-fields');section.id='invoice-editor-fields';preview.id='invoice-editor-preview';
 section.addEventListener('toggle',event=>{const opened=event.target;if(opened.parentElement===section&&opened.open)for(const other of groups)if(other!==opened)other.open=false},true);
 const tabs=document.createElement('div');tabs.className='invoice-editor-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Edición de factura');
 tabs.innerHTML='<button type="button" role="tab" id="invoice-tab-edit" aria-controls="invoice-editor-fields" aria-selected="true" data-editor-tab="edit">Editar</button><button type="button" role="tab" id="invoice-tab-preview" aria-controls="invoice-editor-preview" aria-selected="false" tabindex="-1" data-editor-tab="preview">Vista previa</button>';
 layout.before(tabs);form.dataset.editorTab='edit';
 const setTab=key=>{form.dataset.editorTab=key;for(const button of tabs.children){const selected=button.dataset.editorTab===key;button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1}syncPanels();};
 tabs.addEventListener('click',event=>{const button=event.target.closest('button');if(button)setTab(button.dataset.editorTab)});
 tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const key=event.key==='Home'?'edit':event.key==='End'?'preview':form.dataset.editorTab==='edit'?'preview':'edit';setTab(key);tabs.querySelector('[aria-selected="true"]').focus()});
 const wide=matchMedia('(min-width: 900px), (min-width: 640px) and (orientation: landscape)');
 function syncPanels(){for(const [panel,key] of [[section,'edit'],[preview,'preview']]){panel.hidden=!wide.matches&&form.dataset.editorTab!==key;if(wide.matches){panel.removeAttribute('role');panel.removeAttribute('aria-labelledby')}else{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',key==='edit'?'invoice-tab-edit':'invoice-tab-preview')}}requestAnimationFrame(()=>form.querySelector('[data-invoice-preview]')?.invoiceFit?.())}
 wide.addEventListener('change',syncPanels);syncPanels();
 const zoom=document.createElement('div');zoom.className='invoice-preview-zoom';zoom.setAttribute('role','group');zoom.setAttribute('aria-label','Zoom de vista previa');
 zoom.innerHTML='<button type="button" class="btn ghost" data-zoom="out" aria-label="Reducir vista previa">−</button><output data-preview-scale aria-live="polite">100 %</output><button type="button" class="btn ghost" data-zoom="in" aria-label="Ampliar vista previa">+</button><button type="button" class="btn ghost" data-zoom="fit">Ajustar</button>';
 preview.querySelector('[data-invoice-preview]').before(zoom);form.invoiceZoom=1;
 zoom.addEventListener('click',event=>{const action=event.target.closest('[data-zoom]')?.dataset.zoom;if(!action)return;form.invoiceZoom=action==='fit'?1:Math.max(.4,Math.min(1,Math.round((form.invoiceZoom+(action==='in' ? .1 : -.1))*10)/10));zoom.querySelector('[data-zoom="in"]').disabled=form.invoiceZoom>=1;zoom.querySelector('[data-zoom="out"]').disabled=form.invoiceZoom<=.4;form.querySelector('[data-invoice-preview]')?.invoiceFit?.()});
 zoom.querySelector('[data-zoom="in"]').disabled=true;
 let dirty=false;
 form.addEventListener('input',event=>{if(!event.target.name?.startsWith('preview_'))dirty=true});
 form.addEventListener('change',event=>{if(!event.target.name?.startsWith('preview_'))dirty=true});
 form.addEventListener('click',event=>{if(event.target.closest('[data-invoice-reset],[data-template-reset],[data-load-design],[data-delete-design],[data-save-design],[data-move]'))dirty=true;if(event.target.closest('[data-a="close"]')){event.preventDefault();event.stopPropagation();close()}},true);
 const close=()=>{if(!dirty||window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?'))document.querySelector('#modal').replaceChildren()};
 const keydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}if(event.key==='Tab'){const focusable=[...form.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.tabIndex!==-1&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}};
 document.addEventListener('keydown',keydown,true);
 form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.querySelector('.mh h3').id='invoice-editor-title';form.setAttribute('aria-labelledby','invoice-editor-title');
 const previousFocus=document.activeElement;form.querySelector('.mh button').focus();
 document.body.classList.add('invoice-editor-open');
 const cleanup=new MutationObserver(()=>{if(!form.isConnected){wide.removeEventListener('change',syncPanels);document.removeEventListener('keydown',keydown,true);document.body.classList.remove('invoice-editor-open');cleanup.disconnect();if(previousFocus?.isConnected)previousFocus.focus()}});cleanup.observe(document.querySelector('#modal'),{childList:true,subtree:true});
}

function readInvoiceEditor(form,current){
 const D=AcontecInvoiceDesign,state=form.invoiceState;if(!state)return {};
 const d=state.design;
 for(const key of Object.keys(D.classic)){const input=form.elements['design_'+key];if(input)d[key]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value}
 for(const k of D.blocks)d.alignment[k]=v(form,'align_'+k);
 for(const k of ['a4','letter','thermal'])d.formats[k]={baseSize:+v(form,'size_'+k),margin:+v(form,'margin_'+k)};
 D.validateDesign(d);state.defaults=Object.fromEntries(['a4','letter','thermal'].map(k=>[k,v(form,'default_'+k)]));
 const customFields=D.validateCustom(Array.from({length:5},(_,i)=>({label:v(form,'custom_label_'+i),value:v(form,'custom_value_'+i),required:form.elements['custom_required_'+i].checked,position:v(form,'custom_position_'+i)})).filter(f=>f.label||f.value||f.required));
 return {design:structuredClone(d),customFields,savedDesigns:state.saved,designDefaults:Object.fromEntries(['a4','letter','thermal'].map(k=>[k,v(form,'default_'+k)]))};
}
