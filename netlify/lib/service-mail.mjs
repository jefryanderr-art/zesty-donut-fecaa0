import nodemailer from 'nodemailer';
import {eq,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {serviceMessages,customerPayments} from '../../db/schema.ts';
import {env} from './billing-rules.mjs';
import {paymentForReceipt,paymentPDF,receiptLines} from './payment-receipts.mjs';
export const mailReady=()=>!!env('SMTP_HOST')&&!!env('SMTP_FROM')&&!!env('SMTP_USER')&&!!env('SMTP_PASSWORD');
const htmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function deliverMessages(limit=20){
 if(!mailReady())return;
 const transporter=nodemailer.createTransport({host:env('SMTP_HOST'),port:Number(env('SMTP_PORT')||465),secure:Number(env('SMTP_PORT')||465)===465,auth:{user:env('SMTP_USER'),pass:env('SMTP_PASSWORD')},connectionTimeout:5000,socketTimeout:8000});
 const result=await db.execute(sql`UPDATE acontec_service_messages SET state='sending',attempts=attempts+1 WHERE id IN (SELECT id FROM acontec_service_messages WHERE state='pending' AND attempts<5 ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED) RETURNING id,email,subject,body,dedupe_key`);
 await Promise.all((result.rows||result).map(async message=>{
  let smtpStarted=false,accepted=false,payment;
  try{
   let content={subject:message.subject,text:message.body};
   if(message.dedupe_key?.startsWith('receipt:')){
    payment=await paymentForReceipt(message.dedupe_key.slice(8),message.email);
    if(payment.notifiedAt){await db.update(serviceMessages).set({state:'sent',sentAt:payment.notifiedAt}).where(eq(serviceMessages.id,message.id));return}
    const lines=receiptLines(payment),pdf=await paymentPDF(payment);
    content={subject:'Confirmación de pago – Acontec',text:'Comprobante de pago\n'+lines.map(([k,v])=>k+': '+v).join('\n'),html:'<h1>Comprobante de pago – Acontec</h1>'+lines.map(([k,v])=>'<p><strong>'+htmlEscape(k)+':</strong> '+htmlEscape(v)+'</p>').join(''),attachments:[{filename:'Acontec-'+payment.id+'.pdf',content:pdf,contentType:'application/pdf'}]};
   }
   smtpStarted=true;
   const info=await transporter.sendMail({from:env('SMTP_FROM'),to:message.email,...content,messageId:`<${message.id}@acontec.company>`});
   if(!info.accepted?.length)throw Object.assign(new Error('SMTP rejected'),{responseCode:550});
   accepted=true;
   await db.transaction(async client=>{
    const now=new Date();
    await client.update(serviceMessages).set({state:'sent',sentAt:now,lastError:null}).where(eq(serviceMessages.id,message.id));
    if(payment)await client.update(customerPayments).set({notifiedAt:now}).where(eq(customerPayments.id,payment.id));
   });
  }catch(error){
   // SMTP cannot guarantee exactly-once delivery after an ambiguous timeout.
   // Keep ambiguous submissions claimed; never automatically send them again.
   const ambiguous=accepted||(smtpStarted&&!error.responseCode&&!['CONN','AUTH','EHLO','HELO','STARTTLS','MAIL FROM','RCPT TO'].includes(error.command));
   await db.update(serviceMessages).set({state:ambiguous?'sending':'pending',lastError:ambiguous?'SMTP_AMBIGUOUS_REVIEW_REQUIRED':'DELIVERY_FAILED'}).where(eq(serviceMessages.id,message.id));
  }
 }));
}
