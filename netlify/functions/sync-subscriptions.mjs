import {sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {billingCheckouts} from '../../db/schema.ts';
import {syncCheckout} from '../lib/billing.mjs';
import {providerConfig} from '../lib/billing-rules.mjs';
import {deliverMessages} from '../lib/service-mail.mjs';
export default async()=>{
 // Lote acotado y orden por última consulta para no recorrer todas las cuentas cada día.
 if(providerConfig().ready){const rows=await db.select({id:billingCheckouts.id}).from(billingCheckouts).where(sql`${billingCheckouts.state} in ('pending','active') AND ${billingCheckouts.environment} = ${providerConfig().environment}`).orderBy(sql`${billingCheckouts.syncedAt} NULLS FIRST`).limit(10);await Promise.allSettled(rows.map(row=>syncCheckout(row.id)))}
 await deliverMessages(5);
};
export const config={schedule:'0 12 * * *'};
