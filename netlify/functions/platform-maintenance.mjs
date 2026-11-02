import {and,eq,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {transferRequests,subscriptions,serviceMessages} from '../../db/schema.ts';
import {managuaDay} from '../lib/billing-rules.mjs';
import {deliverMessages} from '../lib/service-mail.mjs';
import {event} from '../lib/billing.mjs';
import {weeklyPrivateExports,prunePrivateExports} from '../lib/private-backups.mjs';
export default async()=>{
 await db.transaction(async client=>{const expired=await client.update(transferRequests).set({state:'expired',version:sql`${transferRequests.version}+1`}).where(and(eq(transferRequests.state,'pending'),sql`${transferRequests.expiresAt}<=now()`)).returning({code:transferRequests.code,email:transferRequests.email});for(const r of expired)await event(client,r.email,'system','Solicitud de transferencia vencida',{code:r.code,reason:'Siete días sin confirmación; sin cambios de acceso.'})});
 // Notifications only. Never overwrite a manual suspension or extend access.
 const rows=await db.select().from(subscriptions).where(sql`${subscriptions.paidUntil} IS NOT NULL AND ${subscriptions.state}<>'suspendido'`);
 const today=managuaDay();for(const sub of rows){const date=managuaDay(sub.paidUntil),days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);if(![0,3].includes(days))continue;await db.insert(serviceMessages).values({email:sub.email,subject:'Recordatorio de suscripción · Acontec',body:`Tu suscripción ${days===0?'vence hoy':'vence en tres días'} (${date}). Revisa Mi suscripción y pagos.`,actor:'system',dedupeKey:'expiry:'+sub.email+':'+date+':'+days}).onConflictDoNothing()}
 await weeklyPrivateExports();await prunePrivateExports();await deliverMessages(5);
};
export const config={schedule:'15 12 * * *'};
