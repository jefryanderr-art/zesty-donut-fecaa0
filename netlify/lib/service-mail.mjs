import nodemailer from 'nodemailer';
import {eq,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {serviceMessages} from '../../db/schema.ts';
import {env} from './billing-rules.mjs';
export const mailReady=()=>!!env('SMTP_HOST')&&!!env('SMTP_FROM')&&!!env('SMTP_USER')&&!!env('SMTP_PASSWORD');
export async function deliverMessages(limit=20){
 if(!mailReady())return;
 const transporter=nodemailer.createTransport({host:env('SMTP_HOST'),port:Number(env('SMTP_PORT')||465),secure:Number(env('SMTP_PORT')||465)===465,auth:{user:env('SMTP_USER'),pass:env('SMTP_PASSWORD')},connectionTimeout:5000,socketTimeout:8000});
 const result=await db.execute(sql`UPDATE acontec_service_messages SET state='sending',attempts=attempts+1 WHERE id IN (SELECT id FROM acontec_service_messages WHERE state='pending' AND attempts<5 ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED) RETURNING id,email,subject,body`);
 await Promise.all((result.rows||result).map(async message=>{try{await transporter.sendMail({from:env('SMTP_FROM'),to:message.email,subject:message.subject,text:message.body,messageId:`<${message.id}@acontec.company>`});await db.update(serviceMessages).set({state:'sent',sentAt:new Date()}).where(eq(serviceMessages.id,message.id))}catch{await db.update(serviceMessages).set({state:'pending'}).where(eq(serviceMessages.id,message.id))}}));
}
