import {UI_CATALOG} from '../../public/ui-text-catalog.mjs';
import {jsPDF} from 'jspdf';
// Instantánea privada creada dentro de la operación autorizada; sin consultas de empresas al entregar.
export function clientDocumentPDF(document){
 const pdf=new jsPDF();pdf.setFontSize(10);let y=16;
 const line=value=>{for(const row of pdf.splitTextToSize(String(value),180)){if(y>280){pdf.addPage();y=16}pdf.text(row,15,y);y+=5}};
 const labels={company:'Empresa',period:'Período',generatedAt:'Fecha de generación',generatedBy:'Generado por',version:'Versión',branchId:'Sucursal',reference:'Documento',date:'Fecha',due:'Vencimiento',customer:'Cliente',subtotalCents:'Base en centavos',vatCents:'IVA en centavos',totalCents:'Total en centavos',balanceCents:'Saldo en centavos',id:'Referencia',name:'Concepto',q:'Cantidad',unitCents:'Precio unitario en centavos',currency:'Moneda',unit:'Precio unitario',vatRate:'IVA configurado',p:'Producto',u:'Precio unitario'};
 line(UI_CATALOG['clients.pdfNotice'].original);
 for(const key of ['company','period','generatedAt','generatedBy','version','branchId','currency','reference','date','due','customer','subtotalCents','vatCents','totalCents'])if(document[key]!==undefined)line((UI_CATALOG['clients.'+key]?.original||labels[key]||key)+': '+document[key]);
 for(const row of document.items||document.rows||[])for(const [key,value]of Object.entries(row))if(value!==undefined&&typeof value!=='object')line((UI_CATALOG['clients.'+key]?.original||labels[key]||key)+': '+value);
 return Buffer.from(pdf.output('arraybuffer'));
}
