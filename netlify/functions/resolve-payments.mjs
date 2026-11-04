import {observeTask} from '../lib/task-health.mjs';
import {reconcilePendingCheckouts} from '../lib/billing.mjs';
export default async()=>observeTask('resolve-payments',async()=>{return await reconcilePendingCheckouts()});
export const config={schedule:'0 */2 * * *'};
