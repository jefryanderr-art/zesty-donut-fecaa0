import {getStore} from '@netlify/blobs';
import {randomUUID,createHash} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {customerPayments,users} from '../../db/schema.ts';
import {billingError} from './billing-rules.mjs';
import {event} from './billing.mjs';
export async function serviceReceipt(method,id,body,session){
 if(!/^[a-f0-9-]{36}$/.test(id||''))billingError('Pago inválido.');
 const [payment]=await db.select().from(customerPayments).where(eq(customerPayments.id,id));if(!payment)billingError('Pago no encontrado.',404);
 const store=getStore({name:'acontec-service-receipts',consistency:'strong'});
 if(method==='GET'){if(!payment.receipt)billingError('Sin comprobante.',404);const data=await store.get(payment.receipt.key,{type:'arrayBuffer'});if(!data)billingError('Archivo no disponible.',404);return {data:Buffer.from(data).toString('base64'),mime:payment.receipt.mime,name:payment.receipt.name}}
 if(method!=='POST')billingError('Método no permitido.',405);
 if(body.confirmed!==true||String(body.reason||'').trim().length<3)billingError('Confirma la carga e indica el motivo.');
 if(typeof body.data!=='string'||body.data.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))billingError('Archivo inválido.');
 const bytes=Buffer.from(body.data,'base64');if(!bytes.length||bytes.length>1048576)billingError('Máximo 1 MB por comprobante.');
 const mime=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':null;if(!mime)billingError('Usa PDF, JPG, PNG o WebP.');
 const key=id+'/'+randomUUID(),receipt={key,mime,name:String(body.name||'comprobante').replace(/[^\p{L}\p{N}._ -]/gu,'').slice(0,100),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 try{await db.transaction(async client=>{await client.select().from(users).where(eq(users.email,payment.email)).for('update');const [locked]=await client.select().from(customerPayments).where(eq(customerPayments.id,id)).for('update');if(locked.receipt||locked.version!==body.version)billingError('El pago cambió o ya tiene comprobante. Recarga.',409);const stats=await client.execute(sql`SELECT count(*)::int AS files,coalesce(sum((receipt->>'bytes')::bigint),0)::bigint AS bytes FROM acontec_customer_payments WHERE email=${payment.email} AND receipt IS NOT NULL`);const usage=(stats.rows||stats)[0];if(usage.files>=100||Number(usage.bytes)+bytes.length>50*1024*1024)billingError('Se alcanzó el límite de comprobantes del cliente.');await store.set(key,bytes);await client.update(customerPayments).set({receipt,version:locked.version+1}).where(eq(customerPayments.id,id));await event(client,payment.email,session.email,'Comprobante de servicio adjuntado',{paymentId:id,name:receipt.name,bytes:receipt.bytes,reason:String(body.reason).slice(0,1000)})})}catch(error){await store.delete(key);throw error}return {ok:true};
}
