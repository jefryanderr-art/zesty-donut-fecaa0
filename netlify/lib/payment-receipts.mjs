import {jsPDF} from 'jspdf';
import {readFile} from 'node:fs/promises';
import {and,eq,desc} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {customerPayments,users,servicePlans,billingCheckouts} from '../../db/schema.ts';
import {addMonths,billingError,providerConfig} from './billing-rules.mjs';
import {pagadito} from './pagadito.mjs';

export const approval = value => !['string','number'].includes(typeof value) || String(value).trim()==='' ? null : String(value).trim().slice(0,200);
export async function receiptSnapshot(client,payment,checkout,charge,reference,checked=false){
 const previous=payment.receiptDetails||{};
 const [user]=await client.select({name:users.name}).from(users).where(eq(users.email,payment.email));
 const [plan]=await client.select({name:servicePlans.name}).from(servicePlans).where(eq(servicePlans.id,payment.plan||''));
 return {...previous,number:previous.number||'ACT-'+payment.id,issuedAt:previous.issuedAt||payment.createdAt.toISOString(),timeZone:'America/Managua',customerName:previous.customerName||user?.name||payment.email,email:payment.email,plan:previous.plan||plan?.name||payment.plan||'Suscripción',interval:payment.interval,coverageStart:charge?.date||previous.coverageStart||payment.date,coverageEnd:charge?addMonths(charge.date,charge.months):previous.coverageEnd||addMonths(payment.date,payment.interval==='anual'?12:1),amountCents:payment.amountCents,currency:payment.currency,environment:checkout?.environment||previous.environment||payment.providerKey?.split(':')[0]||null,ern:charge?.ern||previous.ern||payment.providerKey?.split(':').slice(1).join(':')||null,approval:approval(reference)||previous.approval||null,approvalCheckedAt:checked?new Date().toISOString():previous.approvalCheckedAt||null,description:'Suscripción Acontec',status:'confirmado',method:payment.method};
}
export async function paymentForReceipt(id,email){
 const [payment]=await db.select().from(customerPayments).where(and(eq(customerPayments.id,id),eq(customerPayments.email,email)));
 if(!payment)billingError('Pago no encontrado.',404);
 if(payment.status!=='confirmado')billingError('El pago todavía no está confirmado.',409);
 if(payment.receiptDetails?.approval || payment.receiptDetails?.approvalCheckedAt)return payment;
 const ern=payment.providerKey?.split(':').slice(1).join(':');
 const rows=ern?await db.select().from(billingCheckouts).where(eq(billingCheckouts.email,email)):[];
 const checkout=rows.find(r=>r.environment===payment.providerKey.split(':')[0]&&r.charges.some(c=>c.ern===ern));
 let reference=payment.method==='Pagadito'&&payment.reference!==ern?approval(payment.reference):null,checked=false;
 const charge=checkout?.charges.find(c=>c.ern===ern);
 if(checkout&&!reference){
  // Never query a historical test payment using production credentials.
  if(checkout.environment!==providerConfig().environment)billingError('Para recuperar el Número de Aprobación histórico se requiere la configuración de su entorno.',409);
  const result=await pagadito('get-status-recurring-payments',{token:checkout.providerToken},checkout.environment);
  const record=result?.data?.pending_charges?.find(r=>r.ern===ern);
  if(!record||record.status!=='COMPLETED')billingError('Número de Aprobación pendiente de verificación.',503);
  reference=approval(record.reference);checked=true;
 }
 if(payment.method==='Pagadito'&&!reference&&!checked)billingError('Número de Aprobación pendiente de conciliación.',409);
 return db.transaction(async client=>{
  const [locked]=await client.select().from(customerPayments).where(and(eq(customerPayments.id,id),eq(customerPayments.email,email))).for('update');
  const details=await receiptSnapshot(client,locked,checkout,charge,reference,checked);
  await client.update(customerPayments).set({receiptDetails:details}).where(eq(customerPayments.id,id));
  return {...locked,receiptDetails:details};
 });
}
export function receiptLines(p){
 const d=p.receiptDetails;
 return [d.environment==='sandbox'?['Aviso','PAGO DE PRUEBA']:null,['Recibo',d.number],['Fecha y hora',new Date(d.issuedAt).toLocaleString('es-NI',{timeZone:'America/Managua'})+' (America/Managua)'],['Cliente',d.customerName],['Correo',p.email],['Plan',d.plan],['Periodo',p.interval],['Periodo cubierto',d.coverageStart+' al '+d.coverageEnd+' (fin exclusivo)'],['Descripción',d.description],['Monto',p.currency+' '+(p.amountCents/100).toFixed(2)],['Método',p.method],['Estado',p.status],['Número de Aprobación Pagadito',p.method!=='Pagadito'?'No aplica':d.approval||(d.approvalCheckedAt?'Número de Aprobación no disponible':'Pendiente de verificación')],['ERN',d.ern||'No aplica']].filter(Boolean);
}
export async function paymentPDF(payment){
 const pdf=new jsPDF();
 const logo=await readFile(process.cwd()+'/public/acontec-mark-v1.png');
 pdf.addImage(new Uint8Array(logo),'PNG',16,12,18,18);
 pdf.setFontSize(22);pdf.text('Acontec',40,25);pdf.setFontSize(17);pdf.text('Comprobante de pago',16,44);
 let y=57;pdf.setFontSize(10);
 for(const [label,value] of receiptLines(payment)){
  const lines=pdf.splitTextToSize(label+': '+String(value),177);
  if(y+lines.length*5>280){pdf.addPage();y=20}
  pdf.text(lines,16,y);y+=lines.length*5+4;
 }
 return Buffer.from(pdf.output('arraybuffer'));
}
export async function paymentHistory(session){
 if(session.member||session.support)billingError('Solo el titular puede consultar sus pagos.',403);
 let rows=await db.select().from(customerPayments).where(eq(customerPayments.email,session.email)).orderBy(desc(customerPayments.createdAt));
 rows=await Promise.all(rows.map(async p=>{if(p.status!=='confirmado'||p.receiptDetails)return p;try{return await paymentForReceipt(p.id,session.email)}catch{return p}}));
 return {payments:rows.map(p=>({id:p.id,date:p.date,plan:p.receiptDetails?.plan||p.plan,interval:p.interval,amountCents:p.amountCents,currency:p.currency,status:p.status,approval:p.receiptDetails?.approval||(p.method==='Pagadito'&&p.providerKey&&p.reference!==p.providerKey.split(':').slice(1).join(':')?p.reference:null),approvalUnavailable:!!p.receiptDetails?.approvalCheckedAt&&!p.receiptDetails?.approval,environment:p.receiptDetails?.environment||p.providerKey?.split(':')[0]||null,ern:p.receiptDetails?.ern||p.providerKey?.split(':').slice(1).join(':')||null,receiptAvailable:p.status==='confirmado'}))};
}
