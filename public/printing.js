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
 const margin=invoice?(options.paper==='80'?'2mm 4mm':'14mm'):(options.paper==='80'?'0 4mm':'10mm');
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
