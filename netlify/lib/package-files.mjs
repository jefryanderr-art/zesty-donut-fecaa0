import {clientDocumentPDF} from './client-pdf.mjs';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import * as XLSX from '@e965/xlsx';
import {WORK_NOTICE} from './period-package.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const flat=value=>value==null?'':typeof value==='object'?JSON.stringify(value):value;
const safe=value=>{const s=String(flat(value));return /^[\s]*[=+@-]/.test(s)?"'"+s:s;};
const csv=rows=>{const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return '\ufeff'+[[WORK_NOTICE],keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(v=>'"'+safe(v).replaceAll('"','""')+'"').join(',')).join('\r\n');};
const slug=s=>String(s).normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)||'reporte';
export async function packageFiles(packet,loadAttachment=async()=>null,progress=async()=>{}){
 const files={},missing=[],workbook=XLSX.utils.book_new(),pdf=new jsPDF({orientation:'landscape'}),index=[];
 const reports=Object.entries(packet.reports).filter(([,rows])=>Array.isArray(rows));
 const extra=(packet.declarations||[]).map((d,i)=>['declaracion-'+(i+1),d.fields.map(f=>({declaration:d.name,state:d.state,period:d.period,templateVersion:d.templateVersion,freshness:d.freshness,...f,notice:WORK_NOTICE}))]);
 const sheets=[...reports,...extra,['resumen',[packet.totals||{}]],['advertencias',(packet.warnings||[]).map(message=>({message}))]];
 pdf.setFontSize(20);pdf.text('Paquete contable y fiscal',14,20);pdf.setFontSize(10);
 let y=30;for(const [key,value]of Object.entries(packet.meta)){for(const line of pdf.splitTextToSize(key+': '+flat(value),265)){if(y>170){pdf.addPage();y=20}pdf.text(line,14,y);y+=5;}}
 pdf.text(WORK_NOTICE,14,190);pdf.text('El sistema no presenta declaraciones electrónicamente.',14,198);
 pdf.addPage();const indexPage=pdf.getNumberOfPages();pdf.text('Índice',14,18);
 for(const [i,[name,rows]]of sheets.entries()){
  const normalized=rows.map(r=>typeof r==='object'&&r!==null?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,flat(v)])):{value:r});
  const columns=[...new Set(normalized.flatMap(r=>Object.keys(r)))];
  pdf.addPage();index.push([name,pdf.getNumberOfPages()]);pdf.setFontSize(13);pdf.text(name,14,15);pdf.setFontSize(8);pdf.text('Importes identificados con Cents: centavos enteros.',14,21);
  autoTable(pdf,{startY:26,head:[columns.length?columns:['Sin movimientos']],body:normalized.map(r=>columns.map(k=>String(r[k]??''))),styles:{fontSize:6,overflow:'linebreak',cellWidth:'wrap'},tableWidth:'auto',horizontalPageBreak:true,margin:{bottom:18},didDrawPage:()=>{pdf.setFontSize(7);pdf.text(WORK_NOTICE,14,200);}});
  const sheet=XLSX.utils.aoa_to_sheet([[WORK_NOTICE],columns,...normalized.map(r=>columns.map(k=>typeof r[k]==='number'?r[k]:safe(r[k])))]);XLSX.utils.book_append_sheet(workbook,sheet,String(i+1).padStart(2,'0')+'-'+slug(name).slice(0,27));
  files['listados/'+slug(name)+'.csv']=strToU8(csv(normalized));await progress(Math.round(15+60*(i+1)/sheets.length));
 }
 pdf.setPage(indexPage);let iy=28;for(const [name,page]of index){if(iy>180){pdf.addPage();iy=20}pdf.setFontSize(9);pdf.text(name+' · '+page,14,iy);iy+=5;}
 const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setFontSize(7);pdf.text(`${n} / ${pages}`,270,205);}
 files['paquete.pdf']=new Uint8Array(pdf.output('arraybuffer'));files['paquete.xlsx']=new Uint8Array(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}));
 files['datos-congelados.json']=strToU8(JSON.stringify(packet));files['LEEME.txt']=strToU8(WORK_NOTICE+'\nEl sistema no presenta declaraciones electrónicamente.\nLos originales adjuntos se conservan sin alterarlos; esta leyenda se aplica al paquete de apoyo.');
 for(const [i,attachment]of packet.attachments.entries()){
  // Las claves siempre proceden de la instantánea autorizada, nunca de parámetros de descarga.
  let bytes=null;try{bytes=await loadAttachment(attachment)}catch{}const extension={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[attachment.mime||attachment.type]||'';const path='adjuntos/'+slug(attachment.type)+'/'+(i+1)+'-'+slug(attachment.name||attachment.id)+extension;
  if(bytes)files[path]=new Uint8Array(bytes);else missing.push({path,id:attachment.id,status:'faltante'});
 }
 for(const invoice of packet.reports.facturas||[]){files['documentos/'+slug(invoice.id)+'.pdf']=new Uint8Array(clientDocumentPDF({company:packet.meta.company,period:packet.meta.period,reference:invoice.number,date:invoice.date,customer:invoice.party,currency:packet.meta.currency,subtotalCents:invoice.baseCents,vatCents:invoice.vatCents,totalCents:invoice.totalCents,items:[{notice:WORK_NOTICE},...(invoice.items||[])]}));}
 const manifest={version:1,notice:WORK_NOTICE,packetHash:packet.hash,files:Object.entries(files).map(([path,bytes])=>({path,size:bytes.byteLength,sha256:digest(bytes)})),missing};
 files['manifiesto.json']=strToU8(JSON.stringify(manifest,null,2));await progress(95);
 return {bytes:zipSync(files,{level:6}),manifest};
}
export {digest};
