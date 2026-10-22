import {deliverMessages} from '../lib/service-mail.mjs';
import {eq} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {billingCheckouts} from '../../db/schema.ts';
import {verifyWebhook} from '../lib/pagadito.mjs';
import {syncCheckout} from '../lib/billing.mjs';
export default async (request,context)=>{
 const reply=(text,status)=>new Response(text,{status,headers:{'cache-control':'no-store'}});
 if(request.method!=='POST')return reply('Método no permitido',405);
 if(Number(request.headers.get('content-length')||0)>65536)return reply('Solicitud demasiado grande',413);
 const raw=Buffer.from(await request.arrayBuffer());if(raw.length>65536)return reply('Solicitud demasiado grande',413);
 if(!await verifyWebhook(request.headers,raw))return reply('Firma inválida',401);
 try{const body=JSON.parse(raw.toString('utf8')),match=/^ACT-([a-f0-9]{16})-\d{2}$/.exec(body.resource?.ern||'');
  if(body.event_type==='TRANSACTION.STATUS.CHANGE'&&match){const [row]=await db.select({id:billingCheckouts.id}).from(billingCheckouts).where(eq(billingCheckouts.id,match[1]));if(row){await syncCheckout(row.id);context.waitUntil(deliverMessages(5))}}return reply('ok',200);
 }catch{return reply('No se pudo confirmar; reintentar',503)}
};
export const config={path:'/api/pagadito-webhook'};
