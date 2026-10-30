'use strict';

// Preferencias efímeras: no se escriben en el navegador ni en los documentos.
let PRINT_OPTIONS={color:'bw',paper:'a4',orientation:'portrait'},PRINT_CHOSEN=false;
function choosePrintOptions(callback,{invoice=false,receipt=false,invoiceConfig=null}={}){
 const initial={...PRINT_OPTIONS};
 if(invoice)initial.paper=({thermal:'80',letter:'letter',a4:'a4'})[(invoiceConfig||S.cfg.print)?.format]||'a4';
 const columns=Math.max(0,...[...document.querySelectorAll('#main table tr')].map(row=>[...row.cells].reduce((total,cell)=>total+cell.colSpan,0)));
 const form=modal('Opciones de impresión',selectField('color','Color de impresión',option('bw','Blanco y negro',initial.color==='bw')+option('color','A color',initial.color==='color'))+selectField('paper','Tamaño de papel',option('a4','A4',initial.paper==='a4')+option('letter','Carta',initial.paper==='letter')+option('80','Ticket 80 mm',initial.paper==='80'))+'<div data-print-orientation>'+selectField('orientation','Orientación',option('portrait','Vertical',initial.orientation==='portrait')+option('landscape','Horizontal',initial.orientation==='landscape'))+'</div><p class="accounting-notice" data-print-warning hidden>Este reporte tiene muchas columnas; en 80 mm puede verse apretado. Se recomienda A4 o Carta horizontal.</p>'+notice('Selecciona el mismo papel en la impresora y desactiva los encabezados y pies del navegador.'),async f=>{
  const options={color:v(f,'color'),paper:v(f,'paper'),orientation:v(f,'paper')==='80'?'portrait':v(f,'orientation')};
  PRINT_OPTIONS={...options};PRINT_CHOSEN=true;
  $('#modal').innerHTML='';
  await callback(options);
 },'Imprimir / guardar PDF');
 const update=()=>{const thermal=form.elements.paper.value==='80';form.querySelector('[data-print-orientation]').hidden=thermal;form.querySelector('[data-print-warning]').hidden=invoice||receipt||!thermal||columns<=5};
 form.elements.paper.addEventListener('change',()=>{if(form.elements.paper.value==='80')form.elements.color.value='bw';update()});update();
 if(receipt)form.querySelectorAll('[data-a="close"]').forEach(button=>button.addEventListener('click',()=>$('#rcpt')?.remove()));
 return form;
}
async function printWithOptions(options,{receipt=false,invoice=false,cleanup=()=>{}}={}){
 const classes=['pm-bw','pm-color','pp-a4','pp-letter','pp-80'];
 const done=()=>{document.body.classList.remove(...classes,'rc');document.getElementById('print-page')?.remove();if(receipt)$('#rcpt')?.remove();cleanup();removeEventListener('afterprint',done)};
 document.body.classList.remove(...classes,'rc');document.getElementById('print-page')?.remove();
 const style=document.createElement('style');style.id='print-page';
 const paper=options.paper==='80'?'80mm auto':(options.paper==='letter'?'letter':'A4')+' '+options.orientation;
 // Facturas conservan sus márgenes y sus diseños anteriores.
 const designMargin=receipt?document.querySelector('#rcpt')?.dataset.margin:null;
 const margin=invoice&&designMargin?designMargin+'mm':invoice?(options.paper==='80'?'2mm 4mm':'14mm'):(options.paper==='80'?'0 4mm':'10mm');
 style.textContent=`@page {size:${paper};margin:${margin};}`;
 document.head.append(style);document.body.classList.add('pm-'+options.color,'pp-'+options.paper);
 if(receipt)document.body.classList.add('rc');
 addEventListener('afterprint',done,{once:true});
 try{
  const root=receipt?$('#rcpt'):document.getElementById('platform-print')||$('#main');
  await Promise.all([...root?.querySelectorAll('img')||[]].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})})));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  window.print();
 }catch(error){done();throw error}
}
function printReceiptDocument(){
 return choosePrintOptions(options=>{
  const receipt=$('#rcpt');if(!receipt)return;
  receipt.classList.remove('invoice-a4','invoice-letter','invoice-thermal','invoice-bw','invoice-color');
  receipt.classList.add('invoice-'+(options.paper==='80'?'thermal':options.paper),'invoice-'+options.color);
  return printWithOptions(options,{receipt:true});
 },{receipt:true});
}
function printInvoiceDocument(entry){return choosePrintOptions(options=>{
 $('#rcpt')?.remove();const format=options.paper==='80'?'thermal':options.paper;
 document.body.insertAdjacentHTML('beforeend',invoiceMarkup(entry,format,options.color));
 return printWithOptions(options,{receipt:true,invoice:true});
},{invoice:true,receipt:true,invoiceConfig:invoiceSettings(entry)})}
function printPlatformReport(){return choosePrintOptions(options=>{
 const section=document.createElement('section');section.id='platform-print';
 section.innerHTML='<h1>Acontec · Cobros del servicio</h1>'+accountingTable(['Mes','Plan','Método','Moneda','Estado','Entorno','Cantidad','Monto'],platformExportRows().map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join(''));
 document.body.append(section);return printWithOptions(options,{cleanup:()=>section.remove()});
});}

// Los botones se añaden a las superficies de factura existentes sin cambiar su lógica.
READ_ACTIONS.add('invoicePdf');READ_ACTIONS.add('invoiceShare');
ACT.invoicePdf=data=>downloadInvoiceDocument(data.id);
ACT.invoiceShare=data=>downloadInvoiceDocument(data.id,true);
function invoiceDownloadButtons(id){return `<button type="button" class="lk noprint" data-a="invoicePdf" data-id="${esc(id)}">PDF</button> <button type="button" class="lk noprint" data-a="invoiceShare" data-id="${esc(id)}">Compartir</button>`}
const invoiceButtonsObserver=new MutationObserver(()=>{
 for(const button of document.querySelectorAll('[data-a="printEntry"]:not([data-pdf-added])')){
  button.dataset.pdfAdded='true';const entry=S?.entries?.find(e=>e.id===button.dataset.id);
  if(entry&&['venta','nota-credito'].includes(entry.type))button.insertAdjacentHTML('afterend',invoiceDownloadButtons(entry.id));
 }
});
invoiceButtonsObserver.observe(document.body,{subtree:true,childList:true});
const invoicePrintOriginal=printInvoiceDocument;
printInvoiceDocument=function(entry){const result=invoicePrintOriginal(entry);const form=document.querySelector('#modal form');if(form)form.insertAdjacentHTML('beforeend',invoiceDownloadButtons(entry.id));return result};
function downloadInvoiceDocument(id,share=false){
 const entry=S.entries.find(e=>e.id===id&&['venta','nota-credito'].includes(e.type));
 if(!entry||!(permission('ventas')||permission('facturacion')))throw new Error('Sin acceso a la factura.');
 const cfg=invoiceSettings(entry),paper=({thermal:'80',letter:'letter'})[cfg.format]||'a4';
 modal('Descargar factura digital',selectField('paper','Papel',option('a4','A4',paper==='a4')+option('letter','Carta',paper==='letter')+option('80','Ticket 80 mm',paper==='80'))+selectField('color','Color',option('bw','Blanco y negro',true)+option('color','Color'))+'<label class="ck"><input type="checkbox" name="emitterCopy">Incluir copia del emisor en el mismo PDF</label>',async form=>{
  const options={paper:v(form,'paper'),color:v(form,'color'),copies:form.elements.emitterCopy.checked?2:1};
  const file=await createInvoicePdf(entry,options);
  // Autoriza con el estado vigente del servidor y registra el intento antes de entregar el archivo.
  await api('operations?c='+CO.id,'POST',{operation:'invoiceDownload',invoiceId:entry.id});
  if(share&&navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:entry.reference||'Factura'});return}catch(error){if(error.name==='AbortError')return}
  }
  const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 },share?'Compartir':'Descargar PDF');
}
async function createInvoicePdf(entry,options){
 await loadExportScript('/vendor/jspdf.js?v=0f6fe797a6df06bd');await loadExportScript('/vendor/autotable.js?v=31884888608c7aab');
 const format=options.paper==='80'?'thermal':options.paper,cfg={...invoiceSettings(entry),copies:options.copies},design=AcontecInvoiceDesign.effectiveDesign(cfg,format),margin=design?.margin||(format==='thermal'?4:14),width=format==='thermal'?80:format==='letter'?215.9:210,height=format==='letter'?279.4:297;
 const frame=document.createElement('iframe');frame.title='Preparación de factura PDF';frame.setAttribute('sandbox','allow-same-origin');frame.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;height:1000px';document.body.append(frame);
 try{
  const ready=new Promise(resolve=>frame.onload=resolve),styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>`<link rel="stylesheet" href="${esc(l.href)}">`).join('');
  frame.srcdoc=`<!doctype html><html><head>${styles}</head><body class="rc">${invoiceMarkup(entry,format,options.color,cfg)}</body></html>`;await ready;
  const doc=frame.contentDocument,win=frame.contentWindow;
  for(const sheet of [...doc.styleSheets]){try{for(const rule of [...sheet.cssRules])if(rule.type===CSSRule.MEDIA_RULE&&rule.conditionText==='print'){const style=doc.createElement('style');style.textContent=[...rule.cssRules].map(r=>r.cssText).join('\n');doc.head.append(style)}}catch{}}
  const style=doc.createElement('style');style.textContent=`html,body{margin:0!important;padding:0!important;width:${width-2*margin}mm!important;background:white!important}#rcpt{display:block!important;position:static!important;width:100%!important;max-width:none!important;padding:0!important}.invoice-copy{break-after:auto!important;page-break-after:auto!important}img{max-width:100%}`;doc.head.append(style);
  await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));
  await doc.fonts.ready;
  const root=doc.getElementById('rcpt'),rootRect=root.getBoundingClientRect(),scale=(width-2*margin)/rootRect.width;
  const pageHeight=format==='thermal'?Math.max(80,rootRect.height*scale+2*margin):height,usable=pageHeight-2*margin;
  const pdf=new jspdf.jsPDF({unit:'mm',format:format==='thermal'?[80,pageHeight]:format==='letter'?'letter':'a4',compress:true});
  const copies=[...root.querySelectorAll('.invoice-copy')].map(el=>(el.getBoundingClientRect().top-rootRect.top)*scale);
  const sheetY=y=>{if(format==='thermal')return y;let offset=0;for(let i=1;i<copies.length;i++){const at=copies[i]+offset;offset+=Math.ceil(at/usable)*usable-at}return y+(copies.length>1&&y>=copies[1]?offset:0)};
  const pageFor=raw=>{const y=sheetY(raw);const page=Math.floor(y/usable)+1;while(pdf.getNumberOfPages()<page)pdf.addPage();pdf.setPage(page);return margin+y%usable};
  const color=value=>{const m=value.match(/[\d.]+/g);return m?.slice(0,3).map(Number)||[0,0,0]};
  // Paint the measured DOM as PDF vectors: text stays selectable, images remain local.
  for(const el of [...root.querySelectorAll('*')].sort((a,b)=>Number(!!a.closest('.invoice-annulled'))-Number(!!b.closest('.invoice-annulled')))){
   const cs=win.getComputedStyle(el);let opacity=1;for(let ancestor=el;ancestor&&ancestor!==root;ancestor=ancestor.parentElement)opacity*=Number(win.getComputedStyle(ancestor).opacity);pdf.setGState(new pdf.GState({opacity}));if(cs.display==='none'||cs.visibility==='hidden')continue;
   const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)continue;const x=margin+(rect.left-rootRect.left)*scale,y=(rect.top-rootRect.top)*scale,w=rect.width*scale,h=rect.height*scale;
   const bg=color(cs.backgroundColor);if(cs.backgroundColor!=='transparent'&&!cs.backgroundColor.endsWith(', 0)')&&w&&h){pdf.setFillColor(...bg);pdf.rect(x,pageFor(y),w,h,'F')}
   for(const edge of ['Bottom','Top','Left','Right']){const size=parseFloat(cs['border'+edge+'Width']);if(size>0&&cs['border'+edge+'Style']!=='none'){pdf.setDrawColor(...color(cs['border'+edge+'Color']));pdf.setLineWidth(size*scale);const dy=edge==='Bottom'?h:0,dx=edge==='Right'?w:0;pdf.line(x+dx,pageFor(y+dy),x+(edge==='Left'||edge==='Right'?dx:w),pageFor(y+(edge==='Left'||edge==='Right'?h:dy)))}}
   if(el.tagName==='IMG'&&el.complete&&el.naturalWidth){const canvas=doc.createElement('canvas');canvas.width=el.naturalWidth;canvas.height=el.naturalHeight;const ctx=canvas.getContext('2d');if(options.color==='bw')ctx.filter='grayscale(1)';ctx.drawImage(el,0,0);pdf.addImage(canvas.toDataURL('image/png'),'PNG',x,pageFor(y),w,h)}
   for(const node of el.childNodes){if(node.nodeType!==3||!node.textContent.trim())continue;
    const font=cs.fontFamily.toLowerCase(),family=font.includes('courier')?'courier':font.includes('times')?'times':'helvetica';pdf.setFont(family,(parseInt(cs.fontWeight)>=600||cs.fontWeight==='bold')?'bold':'normal');pdf.setFontSize(parseFloat(cs.fontSize)*scale*72/25.4);pdf.setTextColor(...color(cs.color));
    const range=doc.createRange();let line='',left=0,top=0,bottom=0;
    const flush=()=>{if(line.trim())pdf.text(line,margin+(left-rootRect.left)*scale,pageFor((top-rootRect.top)*scale)+(bottom-top)*scale*0.8);line=''};
    for(let i=0;i<node.length;i++){range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.width)continue;if(line&&Math.abs(r.top-top)>1)flush();if(!line){left=r.left;top=r.top;bottom=r.bottom}line+=node.textContent[i]}flush();
   }
  }
  const reference=String(entry.reference||entry.id).replace(/[^a-zA-Z0-9_-]/g,'-');return new File([pdf.output('blob')],(entry.type==='nota-credito'?'NotaCredito-':'Factura-')+reference+'.pdf',{type:'application/pdf'});
 }finally{frame.remove()}
}
const invoiceDetailOriginal=ACT.discountDetail;
ACT.discountDetail=function(data){const result=invoiceDetailOriginal(data),entry=S.entries.find(e=>e.id===data.id);if(entry&&['venta','nota-credito'].includes(entry.type))document.querySelector('#modal form')?.insertAdjacentHTML('beforeend',`<button type="button" class="btn ghost" data-pdf-added="true" data-a="printEntry" data-id="${esc(entry.id)}">Imprimir</button>${invoiceDownloadButtons(entry.id)}`);return result};
